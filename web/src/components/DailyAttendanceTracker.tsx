import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Users,
  CheckCircle2,
  XCircle,
  CalendarDays,
  Clock,
  MapPin,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building,
  AlertTriangle,
  UserCheck,
  CalendarCheck,
  Calendar,
  Briefcase,
  FileCode2,
  CheckSquare,
  Sparkles,
  Check,
  Info,
  Award,
  User,
  Coffee,
  Sun,
  Flame,
  FileText,
  TrendingUp,
  Percent,
  Settings,
  Sliders,
  X,
  FileEdit,
  Edit3,
  Send,
  Printer,
  FileSpreadsheet
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getTodayISTDateString, formatISTTime, formatISTDate } from '../lib/serialUtils';
import { AttendanceRecord, Profile, TaskItem, DailyStandup, Holiday, LeaveRequest } from '../types';

interface DailyAttendanceTrackerProps {
  onRequestRegularization?: (attendanceId?: string | null, date?: string | null) => void;
}

export const DailyAttendanceTracker: React.FC<DailyAttendanceTrackerProps> = ({
  onRequestRegularization
}) => {
  const {
    currentOrg,
    currentProfile,
    orgProfiles,
    attendanceRecords,
    leaveRequests,
    tasks,
    standups,
    holidays,
    addHoliday,
    deleteHoliday,
    isVedotrixSuperadmin,
    resolveRegularization,
    requestRegularization,
    updateProfile,
    updateOrganization,
    addToast
  } = useApp();

  const isHrOrSuperadmin =
    currentProfile?.role === 'hr' ||
    currentProfile?.role === 'owner' ||
    currentProfile?.role === 'superadmin' ||
    isVedotrixSuperadmin;

  const isManager = currentProfile?.role === 'manager';

  // Available managed team members:
  // Superadmin / HR: all active profiles in the org
  // Manager: direct reports + themselves
  // Employee: themselves
  const selectableEmployees = useMemo(() => {
    if (isHrOrSuperadmin) {
      return orgProfiles.filter((p) => p.isActive);
    }
    if (isManager) {
      const reports = orgProfiles.filter((p) => p.isActive && p.managerId === currentProfile.id);
      return [currentProfile, ...reports];
    }
    return [currentProfile];
  }, [isHrOrSuperadmin, isManager, orgProfiles, currentProfile]);

  // Selected Employee for Inspection
  const [selectedEmpId, setSelectedEmpId] = useState<string>(currentProfile.id);

  // Active view tab:
  // For managers/HR/superadmin: can toggle between 'calendar', 'daily_roster', and 'regularizations' queue
  // For employees: strictly 'calendar'
  const [activeViewTab, setActiveViewTab] = useState<'calendar' | 'daily_roster' | 'regularizations'>('calendar');

  // Pending regularizations & out-of-office presence approval count for badge & tab
  const pendingRegularizationsCount = useMemo(() => {
    const isPendingRecord = (a: any) =>
      (a.regularizationStatus === 'pending' || a.approvalStatus === 'pending_manager_approval') &&
      a.approvalStatus !== 'approved' &&
      a.regularizationStatus !== 'approved';

    if (isHrOrSuperadmin) {
      return attendanceRecords.filter(isPendingRecord).length;
    }
    const reportIds = new Set(selectableEmployees.map((m) => m.id));
    return attendanceRecords.filter(
      (a) => isPendingRecord(a) && reportIds.has(a.employeeId)
    ).length;
  }, [attendanceRecords, isHrOrSuperadmin, selectableEmployees]);

  // Regularizations queue filter states
  const [regFilterStatus, setRegFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [regSearchQuery, setRegSearchQuery] = useState('');

  // Date Popup on Click
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<any | null>(null);

  // Shift & Organization Calendar Configuration Modal (Superadmin / HR only)
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [shiftModalTab, setShiftModalTab] = useState<'shift' | 'emp_weekoffs' | 'holidays'>('shift');
  const [shiftStart, setShiftStart] = useState(currentOrg.settings?.shiftStartTime || currentOrg.settings?.shiftStart || '09:30');
  const [shiftEnd, setShiftEnd] = useState(currentOrg.settings?.shiftEndTime || currentOrg.settings?.shiftEnd || '18:30');
  const [graceMins, setGraceMins] = useState(currentOrg.settings?.gracePeriodMins || 15);
  const [halfDayHours, setHalfDayHours] = useState(currentOrg.settings?.halfDayThresholdHours || 4.5);
  const [weekOffs, setWeekOffs] = useState<number[]>(currentOrg.settings?.weekOffDays || [0]);
  const [isSavingShift, setIsSavingShift] = useState(false);

  // Employee-Specific Week-Off customization state
  const [selectedEmpForWeekOff, setSelectedEmpForWeekOff] = useState<string>('');
  const [empWeekOffDays, setEmpWeekOffDays] = useState<number[]>([0]);

  // Synchronize state with current organization settings from Supabase
  useEffect(() => {
    if (currentOrg.settings) {
      setShiftStart(currentOrg.settings.shiftStartTime || currentOrg.settings.shiftStart || '09:30');
      setShiftEnd(currentOrg.settings.shiftEndTime || currentOrg.settings.shiftEnd || '18:30');
      setGraceMins(currentOrg.settings.gracePeriodMins || 15);
      setHalfDayHours(currentOrg.settings.halfDayThresholdHours || 4.5);
      setWeekOffs(currentOrg.settings.weekOffDays || [0]);
    }
  }, [currentOrg]);

  // Synchronize selected employee week-off state
  useEffect(() => {
    const targetEmpId = selectedEmpForWeekOff || (orgProfiles[0]?.id || '');
    if (targetEmpId) {
      if (!selectedEmpForWeekOff) setSelectedEmpForWeekOff(targetEmpId);
      const cur = currentOrg.settings?.employeeWeekOffs?.[targetEmpId] || currentOrg.settings?.weekOffDays || [0];
      setEmpWeekOffDays(cur);
    }
  }, [selectedEmpForWeekOff, currentOrg.settings, orgProfiles]);

  // Holiday management state
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayType, setNewHolidayType] = useState<'public' | 'optional' | 'restricted'>('public');
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);

  // Joining Date Management State (Superadmin / HR can set/edit)
  const [isEditingJoiningDate, setIsEditingJoiningDate] = useState(false);
  const [editingJoiningDateVal, setEditingJoiningDateVal] = useState('');
  const [isSavingJoiningDate, setIsSavingJoiningDate] = useState(false);

  // Inline Regularization Request State
  const [regularizingDay, setRegularizingDay] = useState<string | null>(null);
  const [regCategory, setRegCategory] = useState('Missed Punch-In / Punch-Out');
  const [regReason, setRegReason] = useState('');
  const [regInTime, setRegInTime] = useState(currentOrg.settings?.shiftStartTime || '09:30');
  const [regOutTime, setRegOutTime] = useState(currentOrg.settings?.shiftEndTime || '18:30');
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);

  // Attendance Report PDF Export State (HR / Superadmin / Managers only)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [reportDate, setReportDate] = useState(() => getTodayISTDateString());
  const [reportMonthYear, setReportMonthYear] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleSaveShiftSettings = async () => {
    setIsSavingShift(true);
    try {
      await updateOrganization(currentOrg.id, {
        settings: {
          ...currentOrg.settings,
          shiftStart: shiftStart,
          shiftStartTime: shiftStart,
          shiftEnd: shiftEnd,
          shiftEndTime: shiftEnd,
          gracePeriodMins: Number(graceMins) || 15,
          halfDayThresholdHours: Number(halfDayHours) || 4.5,
          weekOffDays: weekOffs
        }
      });
      addToast('Shift & Week-Offs Saved ⚙️', 'Configured shift timing & weekly holidays synced to Supabase.', 'success');
      setIsShiftModalOpen(false);
    } catch (err: any) {
      addToast('Error', err?.message || 'Could not update shift timing.', 'error');
    } finally {
      setIsSavingShift(false);
    }
  };

  const handleSaveEmployeeWeekOff = async () => {
    const targetEmpId = selectedEmpForWeekOff || (orgProfiles[0]?.id || '');
    if (!targetEmpId) {
      addToast('Select Employee', 'Please select a team member to set custom weekly off days.', 'warning');
      return;
    }
    setIsSavingShift(true);
    try {
      const curEmpWeekOffs = { ...(currentOrg.settings?.employeeWeekOffs || {}) };
      curEmpWeekOffs[targetEmpId] = empWeekOffDays;
      await updateOrganization(currentOrg.id, {
        settings: {
          ...currentOrg.settings,
          employeeWeekOffs: curEmpWeekOffs
        }
      });
      const empObj = orgProfiles.find((p) => p.id === targetEmpId);
      addToast('Employee Week-Off Saved ☕', `Custom weekly off days configured for ${empObj ? empObj.firstName : 'Employee'} and synced to Supabase.`, 'success');
    } catch (err: any) {
      addToast('Error', err?.message || 'Could not update employee week-off.', 'error');
    } finally {
      setIsSavingShift(false);
    }
  };

  const handleResetEmployeeWeekOff = async () => {
    const targetEmpId = selectedEmpForWeekOff || (orgProfiles[0]?.id || '');
    if (!targetEmpId) return;
    setIsSavingShift(true);
    try {
      const curEmpWeekOffs = { ...(currentOrg.settings?.employeeWeekOffs || {}) };
      delete curEmpWeekOffs[targetEmpId];
      await updateOrganization(currentOrg.id, {
        settings: {
          ...currentOrg.settings,
          employeeWeekOffs: curEmpWeekOffs
        }
      });
      setEmpWeekOffDays(currentOrg.settings?.weekOffDays || [0]);
      const empObj = orgProfiles.find((p) => p.id === targetEmpId);
      addToast('Reset to Org Default', `Reset ${empObj ? empObj.firstName : 'Employee'} to standard organization week-offs.`, 'info');
    } catch (err: any) {
      addToast('Error', err?.message || 'Failed to reset employee week-off.', 'error');
    } finally {
      setIsSavingShift(false);
    }
  };

  const handleAddNewHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayName.trim() || !newHolidayDate) return;
    setIsSavingHoliday(true);
    try {
      await addHoliday({
        name: newHolidayName.trim(),
        date: newHolidayDate,
        type: newHolidayType
      });
      setNewHolidayName('');
      setNewHolidayDate('');
      addToast('Holiday Added 🎊', 'Holiday added to organization calendar in Supabase.', 'success');
    } catch (err: any) {
      addToast('Error', err?.message || 'Failed to add holiday.', 'error');
    } finally {
      setIsSavingHoliday(false);
    }
  };

  const handleToggleDayWeekOff = async (dateStr: string, empId: string) => {
    const key = `${dateStr}_${empId}`;
    const reverseKey = `${empId}_${dateStr}`;
    const curOverrides = { ...(currentOrg.settings?.customDayOverrides || {}) };
    const currentType = curOverrides[key]?.type || curOverrides[reverseKey]?.type || curOverrides[dateStr]?.type;
    
    let newType: 'working' | 'week_off';
    if (currentType === 'week_off') {
      newType = 'working';
      curOverrides[key] = { type: 'working', employeeId: empId };
      addToast('Day Marked as Working 💼', `Marked ${dateStr} as active working day for this employee.`, 'info');
    } else {
      newType = 'week_off';
      curOverrides[key] = { type: 'week_off', employeeId: empId };
      addToast('Day Marked as Week-Off ☕', `Marked ${dateStr} as scheduled week-off for this employee.`, 'success');
    }

    if (selectedCalendarDay && selectedCalendarDay.dateStr === dateStr) {
      setSelectedCalendarDay({
        ...selectedCalendarDay,
        isWeekOff: newType === 'week_off',
        status: newType === 'week_off' ? 'week_off' : (selectedCalendarDay.isPast ? 'absent' : 'future')
      });
    }

    await updateOrganization(currentOrg.id, {
      settings: {
        ...currentOrg.settings,
        customDayOverrides: curOverrides
      }
    });
  };

  const handleToggleHolidayForDate = async (dateStr: string) => {
    const existing = holidays.find((h) => (h.orgId === currentOrg.id || !h.orgId) && h.date === dateStr);
    if (existing) {
      await deleteHoliday(existing.id);
      addToast('Holiday Removed', `Removed ${existing.name} (${dateStr}) from company calendar.`, 'info');
    } else {
      await addHoliday({
        name: 'Corporate Holiday / Off',
        date: dateStr,
        type: 'public'
      });
      addToast('Holiday Declared 🎊', `Marked ${dateStr} as company holiday.`, 'success');
    }
  };

  // Month navigation for Calendar View
  const todayIST = getTodayISTDateString();
  const [currentYear, setCurrentYear] = useState(() => parseInt(todayIST.split('-')[0], 10));
  const [currentMonth, setCurrentMonth] = useState(() => parseInt(todayIST.split('-')[1], 10)); // 1 - 12

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleJumpToCurrentMonth = () => {
    setCurrentYear(parseInt(todayIST.split('-')[0], 10));
    setCurrentMonth(parseInt(todayIST.split('-')[1], 10));
  };

  // The inspected profile object
  const inspectedEmployee = useMemo(() => {
    return selectableEmployees.find((p) => p.id === selectedEmpId) || currentProfile;
  }, [selectableEmployees, selectedEmpId, currentProfile]);

  // Month string prefix e.g. "2026-09"
  const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

  // Organization official holidays for current month
  const orgHolidays = useMemo(() => {
    return holidays.filter(
      (h) => (h.orgId === currentOrg.id || !h.orgId)
    );
  }, [holidays, currentOrg.id]);

  // Attendance records for inspected employee in this month (match by ID or matching email across profiles)
  const employeeMonthPunches = useMemo(() => {
    return attendanceRecords.filter((a) => {
      if (a.employeeId === inspectedEmployee.id) return true;
      if (inspectedEmployee.email) {
        const p = orgProfiles.find((x) => x.id === a.employeeId);
        if (p?.email && p.email.toLowerCase() === inspectedEmployee.email.toLowerCase()) return true;
      }
      return false;
    }).filter((a) => a.date.startsWith(monthPrefix));
  }, [attendanceRecords, inspectedEmployee.id, inspectedEmployee.email, monthPrefix, orgProfiles]);

  // Leave requests for inspected employee
  const employeeLeaves = useMemo(() => {
    return leaveRequests.filter(
      (l) => l.employeeId === inspectedEmployee.id && (l.status === 'approved' || l.status === 'pending')
    );
  }, [leaveRequests, inspectedEmployee.id]);

  // Standups for inspected employee in this month
  const employeeMonthStandups = useMemo(() => {
    return standups
      .filter((s) => s.employeeId === inspectedEmployee.id && s.date.startsWith(monthPrefix))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [standups, inspectedEmployee.id, monthPrefix]);

  // Tasks assigned to inspected employee
  const employeeTasks = useMemo(() => {
    return tasks.filter((t) => t.assignedTo === inspectedEmployee.id);
  }, [tasks, inspectedEmployee]);

  // Calendar Days calculation strictly from Joining Date onwards
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay();

    const daysArray = [];

    // Week-off configuration: respects employee-specific week-offs if configured
    const empWeekOffs = currentOrg.settings?.employeeWeekOffs?.[inspectedEmployee.id];
    const weekOffDays = Array.isArray(empWeekOffs) ? empWeekOffs : (currentOrg.settings?.weekOffDays || [0]);
    const joiningDateStr = inspectedEmployee.joiningDate || '';

    // Shift timing calculation strictly from organization settings
    const orgShiftEnd = currentOrg.settings?.shiftEndTime || '18:30';
    const [shiftEndH, shiftEndM] = orgShiftEnd.split(':').map(Number);
    const shiftEndMins = (shiftEndH || 18) * 60 + (shiftEndM || 30);
    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const currentTotalMins = nowIST.getHours() * 60 + nowIST.getMinutes();

    const customOverrides = currentOrg.settings?.customDayOverrides || {};

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = new Date(currentYear, currentMonth - 1, day).getDay();
      
      let isWeekOff = weekOffDays.includes(dayOfWeek);
      let holiday = orgHolidays.find((h) => h.date === dateStr);

      // Check per-employee or per-date overrides
      const empOverrideKey = `${dateStr}_${inspectedEmployee.id}`;
      const dayOverride = customOverrides[empOverrideKey] || customOverrides[dateStr];
      if (dayOverride) {
        if (dayOverride.type === 'week_off') {
          isWeekOff = true;
          holiday = undefined;
        } else if (dayOverride.type === 'working') {
          isWeekOff = false;
          holiday = undefined;
        } else if (dayOverride.type === 'holiday') {
          holiday = { id: `override_${dateStr}`, name: dayOverride.name || 'Company Holiday', date: dateStr, orgId: currentOrg.id };
          isWeekOff = false;
        }
      }

      const leave = employeeLeaves.find(
        (l) => l.startDate <= dateStr && l.endDate >= dateStr
      );

      const punch = employeeMonthPunches.find((p) => p.date === dateStr);

      const isToday = dateStr === todayIST;
      const isPast = dateStr < todayIST;
      const isFuture = dateStr > todayIST;
      const isBeforeJoining = Boolean(joiningDateStr && dateStr < joiningDateStr);

      let status: 'holiday' | 'week_off' | 'leave' | 'present' | 'regularized' | 'pending' | 'absent' | 'future' | 'pre_joining' = 'future';

      if (isBeforeJoining) {
        status = 'pre_joining';
      } else if (holiday) {
        status = 'holiday';
      } else if (isWeekOff) {
        status = 'week_off';
      } else if (leave) {
        status = 'leave';
      } else if (punch) {
        const isRejected = punch.regularizationStatus === 'rejected' || punch.approvalStatus === 'rejected';
        const isPending = !isRejected && (
          punch.regularizationStatus === 'pending' ||
          punch.approvalStatus === 'pending_manager_approval' ||
          punch.status === 'pending'
        );
        const isApproved = !isRejected && !isPending && (
          punch.approvalStatus === 'approved' ||
          punch.regularizationStatus === 'approved'
        );

        if (isRejected) {
          // Explicitly rejected regularization: must NEVER be marked present, show in original absent state
          status = 'absent';
        } else if (isPending) {
          // Unapproved / pending regularization: must NOT count as present
          status = 'pending';
        } else if (isApproved) {
          status = (!punch.checkInTime && punch.regularizationStatus === 'approved') ? 'regularized' : 'present';
        } else if (punch.status === 'present' && punch.approvalStatus !== 'pending_manager_approval') {
          status = 'present';
        } else if (punch.status === 'regularized') {
          status = 'regularized';
        } else if (punch.status === 'half_day') {
          status = 'present';
        } else {
          status = 'absent';
        }
      } else if (isPast) {
        // Past working day after joining date without punch -> Automatically Absent until regularized!
        status = 'absent';
      } else if (isToday) {
        // Today's shift evaluation: if shift has ended and no punch -> Automatically Absent until regularized!
        if (currentTotalMins >= shiftEndMins) {
          status = 'absent';
        } else {
          status = 'future';
        }
      } else {
        status = 'future';
      }

      daysArray.push({
        day,
        dateStr,
        dayOfWeek,
        isWeekOff,
        isBeforeJoining,
        holiday,
        leave,
        punch,
        isToday,
        isPast,
        isFuture,
        status
      });
    }

    return { daysArray, firstDayIndex, daysInMonth };
  }, [currentYear, currentMonth, currentOrg.settings, orgHolidays, employeeLeaves, employeeMonthPunches, todayIST, inspectedEmployee.joiningDate, inspectedEmployee.id]);

  // Monthly summary metrics strictly based on post-joining active days
  const monthlyMetrics = useMemo(() => {
    const list = calendarDays.daysArray;
    const totalDays = list.length;
    
    // Only evaluate days on or after employee joining date
    const eligibleDays = list.filter((d) => !d.isBeforeJoining);
    const holidaysCount = eligibleDays.filter((d) => d.status === 'holiday').length;
    const weekOffsCount = eligibleDays.filter((d) => d.status === 'week_off').length;
    const workingDays = Math.max(0, eligibleDays.length - holidaysCount - weekOffsCount);
    
    const presentCount = eligibleDays.filter((d) => d.status === 'present').length;
    const regularizedCount = eligibleDays.filter((d) => d.status === 'regularized').length;
    const leavesCount = eligibleDays.filter((d) => d.status === 'leave').length;
    const pendingCount = eligibleDays.filter((d) => d.status === 'pending').length;
    const absentCount = eligibleDays.filter((d) => d.status === 'absent').length;
    const preJoiningCount = list.filter((d) => d.status === 'pre_joining').length;

    const workingDaysSoFar = eligibleDays.filter((d) => (d.isPast || d.isToday) && !d.isWeekOff && !d.holiday).length;
    // Regularized approved count strictly included in total Present Days
    const totalPresentDays = presentCount + regularizedCount;
    const totalEffectivePresent = totalPresentDays + (leavesCount * 0.5);
    const attendancePercentage = workingDaysSoFar > 0
      ? Math.min(100, Math.round((totalEffectivePresent / workingDaysSoFar) * 100))
      : 100;

    return {
      totalDays,
      workingDays,
      workingDaysSoFar,
      holidaysCount,
      weekOffsCount,
      presentCount,
      regularizedCount,
      totalPresentDays,
      leavesCount,
      pendingCount,
      absentCount,
      preJoiningCount,
      attendancePercentage
    };
  }, [calendarDays]);

  // Tasks statistics
  const taskStats = useMemo(() => {
    const total = employeeTasks.length;
    const done = employeeTasks.filter((t) => t.status === 'done').length;
    const inProgress = employeeTasks.filter((t) => t.status === 'in_progress').length;
    const todo = employeeTasks.filter((t) => t.status === 'todo').length;
    return { total, done, inProgress, todo };
  }, [employeeTasks]);

  // Total Standup Hours logged this month
  const totalStandupHours = useMemo(() => {
    return employeeMonthStandups.reduce((acc, s) => acc + (s.hoursLogged || 8), 0);
  }, [employeeMonthStandups]);

  // Month Name Formatter in IST
  const monthName = new Date(currentYear, currentMonth - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric'
  });

  // -------------------------------------------------------------
  // DAILY ROSTER VIEW STATE (FOR MANAGERS & LEADERSHIP)
  // -------------------------------------------------------------
  const [selectedRosterDate, setSelectedRosterDate] = useState<string>(todayIST);
  const [rosterFilterTab, setRosterFilterTab] = useState<'all' | 'present' | 'pending' | 'on_leave' | 'week_off_holiday' | 'absent'>('all');
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterDept, setRosterDept] = useState('all');

  const handleShiftRosterDate = (days: number) => {
    const current = new Date(selectedRosterDate);
    current.setDate(current.getDate() + days);
    setSelectedRosterDate(current.toISOString().split('T')[0]);
  };

  const managedTeam = useMemo(() => {
    if (isHrOrSuperadmin) return orgProfiles.filter((p) => p.isActive);
    if (isManager) return orgProfiles.filter((p) => p.isActive && p.managerId === currentProfile.id);
    return [currentProfile];
  }, [isHrOrSuperadmin, isManager, orgProfiles, currentProfile]);

  // Holiday and Week-off information for selected roster date
  const holidayOnDate = useMemo(() => {
    return orgHolidays.find((h) => h.date === selectedRosterDate);
  }, [orgHolidays, selectedRosterDate]);

  const weekOffOnDate = useMemo(() => {
    const [rYear, rMonth, rDay] = selectedRosterDate.split('-').map(Number);
    const dayOfWeek = new Date(rYear, rMonth - 1, rDay).getDay();
    const isWeekOff = (currentOrg.settings?.weekOffDays || [0]).includes(dayOfWeek);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return { isWeekOff, dayName: dayNames[dayOfWeek] };
  }, [selectedRosterDate, currentOrg.settings?.weekOffDays]);

  const rosterEmployeeData = useMemo(() => {
    const [shiftEndH, shiftEndM] = (currentOrg.settings?.shiftEndTime || '18:30').split(':').map(Number);
    const shiftEndMins = (shiftEndH || 18) * 60 + (shiftEndM || 30);
    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const currentTotalMins = nowIST.getHours() * 60 + nowIST.getMinutes();
    const isPast = selectedRosterDate < todayIST;
    const isToday = selectedRosterDate === todayIST;
    const [rYear, rMonth, rDay] = selectedRosterDate.split('-').map(Number);
    const dayOfWeek = new Date(rYear, rMonth - 1, rDay).getDay();
    const customDayOverrides = currentOrg.settings?.customDayOverrides || {};

    return managedTeam.map((emp) => {
      const isBeforeJoining = Boolean(emp.joiningDate && selectedRosterDate < emp.joiningDate);
      const empWeekOffDays = currentOrg.settings?.employeeWeekOffs?.[emp.id] || currentOrg.settings?.weekOffDays || [0];
      let isEmpWeekOff = empWeekOffDays.includes(dayOfWeek);
      let empHoliday = holidayOnDate;

      // Check per-employee or per-date overrides
      const empOverrideKey = `${selectedRosterDate}_${emp.id}`;
      const empOverride = customDayOverrides[empOverrideKey] || customDayOverrides[selectedRosterDate];
      if (empOverride) {
        if (empOverride.type === 'week_off') {
          isEmpWeekOff = true;
          empHoliday = undefined;
        } else if (empOverride.type === 'working') {
          isEmpWeekOff = false;
          empHoliday = undefined;
        } else if (empOverride.type === 'holiday') {
          empHoliday = { id: `override_${selectedRosterDate}`, name: empOverride.name || 'Company Holiday', date: selectedRosterDate, orgId: currentOrg.id };
          isEmpWeekOff = false;
        }
      }

      const empRecords = attendanceRecords.filter((a) => {
        if (a.employeeId === emp.id) return true;
        if (emp.email) {
          const p = orgProfiles.find((x) => x.id === a.employeeId);
          if (p?.email && p.email.toLowerCase() === emp.email.toLowerCase()) return true;
        }
        return false;
      }).filter((a) => a.date === selectedRosterDate);

      // Prefer approved, pending, or active records
      const record = empRecords.find((a) =>
        a.approvalStatus === 'approved' ||
        a.regularizationStatus === 'approved' ||
        a.approvalStatus === 'pending_manager_approval' ||
        a.regularizationStatus === 'pending' ||
        a.approvalStatus === 'rejected' ||
        a.regularizationStatus === 'rejected' ||
        a.status === 'present' ||
        a.status === 'regularized' ||
        a.status === 'half_day'
      ) || empRecords[0];

      const leave = leaveRequests.find(
        (l) =>
          l.employeeId === emp.id &&
          (l.status === 'approved' || l.status === 'pending') &&
          l.startDate <= selectedRosterDate &&
          l.endDate >= selectedRosterDate
      );

      let status: 'present' | 'pending_approval' | 'on_leave' | 'holiday' | 'week_off' | 'pre_joining' | 'absent' | 'not_marked' = 'not_marked';

      if (isBeforeJoining) {
        status = 'pre_joining';
      } else if (record) {
        const isRejected = record.approvalStatus === 'rejected' || record.regularizationStatus === 'rejected';
        const isPending = !isRejected && (
          record.approvalStatus === 'pending_manager_approval' ||
          record.regularizationStatus === 'pending' ||
          record.status === 'pending'
        );
        const isApproved = !isRejected && !isPending && (
          record.approvalStatus === 'approved' ||
          record.regularizationStatus === 'approved'
        );

        if (isRejected) {
          // If rejected, do NOT mark as present. Show original state (absent / week-off / holiday)
          if (empHoliday) status = 'holiday';
          else if (isEmpWeekOff) status = 'week_off';
          else status = 'absent';
        } else if (isPending) {
          // Pending approval: strictly pending, not counted as present
          status = 'pending_approval';
        } else if (isApproved) {
          status = 'present';
        } else if (record.status === 'present' && record.approvalStatus !== 'pending_manager_approval') {
          status = 'present';
        } else if (record.status === 'regularized' || record.status === 'half_day') {
          status = 'present';
        } else if (record.status === 'absent') {
          if (empHoliday) status = 'holiday';
          else if (isEmpWeekOff) status = 'week_off';
          else status = 'absent';
        }
      } else if (leave) {
        status = 'on_leave';
      } else if (empHoliday) {
        status = 'holiday';
      } else if (isEmpWeekOff) {
        status = 'week_off';
      } else if (isPast || (isToday && currentTotalMins >= shiftEndMins)) {
        status = 'absent';
      }

      return {
        employee: emp,
        record,
        leave,
        holiday: empHoliday,
        isWeekOff: isEmpWeekOff,
        isBeforeJoining,
        status
      };
    });
  }, [managedTeam, attendanceRecords, leaveRequests, selectedRosterDate, todayIST, currentOrg.settings, orgProfiles, holidayOnDate]);

  const rosterStats = useMemo(() => {
    const total = rosterEmployeeData.length;
    const present = rosterEmployeeData.filter((d) => d.status === 'present').length;
    const pending = rosterEmployeeData.filter((d) => d.status === 'pending_approval').length;
    const onLeave = rosterEmployeeData.filter((d) => d.status === 'on_leave').length;
    const weekOffHoliday = rosterEmployeeData.filter((d) => d.status === 'week_off' || d.status === 'holiday').length;
    const absent = rosterEmployeeData.filter((d) => d.status === 'absent').length;
    const notMarked = rosterEmployeeData.filter((d) => d.status === 'not_marked').length;
    return { total, present, pending, onLeave, weekOffHoliday, absent, notMarked };
  }, [rosterEmployeeData]);

  const filteredRosterData = useMemo(() => {
    return rosterEmployeeData.filter(({ employee, status }) => {
      if (rosterFilterTab === 'present' && status !== 'present') return false;
      if (rosterFilterTab === 'pending' && status !== 'pending_approval') return false;
      if (rosterFilterTab === 'on_leave' && status !== 'on_leave') return false;
      if (rosterFilterTab === 'week_off_holiday' && status !== 'week_off' && status !== 'holiday') return false;
      if (rosterFilterTab === 'absent' && status !== 'absent' && status !== 'not_marked') return false;
      if (rosterDept !== 'all' && employee.department !== rosterDept) return false;
      if (rosterSearch.trim()) {
        const q = rosterSearch.toLowerCase();
        const full = `${employee.firstName} ${employee.lastName}`.toLowerCase();
        return full.includes(q) || employee.email.toLowerCase().includes(q) || (employee.designation || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [rosterEmployeeData, rosterFilterTab, rosterDept, rosterSearch]);

  const handleExportCSV = () => {
    const headers = ['Employee Name', 'Email', 'Role', 'Department', 'Date', 'Status', 'Check-In Time', 'Location / Office', 'Distance (m)', 'Leave Type', 'Reviewer / Approver'];
    const rows = filteredRosterData.map(({ employee, record, leave, status }) => {
      const isRejected = record?.approvalStatus === 'rejected' || record?.regularizationStatus === 'rejected';
      const isPending = !isRejected && (record?.approvalStatus === 'pending_manager_approval' || record?.regularizationStatus === 'pending');
      const approverId = record?.approvedBy || record?.regularizedBy;
      const approverProfile = approverId ? orgProfiles.find((p) => p.id === approverId) : null;
      let approverText = '—';
      if (isRejected) {
        approverText = approverProfile ? `Rejected by ${approverProfile.firstName} ${approverProfile.lastName}` : 'Rejected';
      } else if (isPending) {
        approverText = 'Awaiting Approval';
      } else if (approverProfile) {
        approverText = `Approved by ${approverProfile.firstName} ${approverProfile.lastName}`;
      }
      return [
        `"${employee.firstName} ${employee.lastName}"`,
        employee.email,
        employee.role,
        employee.department,
        selectedRosterDate,
        status.toUpperCase(),
        record?.checkInTime ? formatISTTime(record.checkInTime) : 'N/A',
        `"${record?.officeAddress || (record?.isRemote ? 'Remote' : 'N/A')}"`,
        record?.distanceMeters || '0',
        leave ? `"${leave.leaveType.toUpperCase()} (${leave.status})"` : 'N/A',
        `"${approverText}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_${currentOrg.orgCode}_${selectedRosterDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Report Exported 📄', `Exported attendance sheet for ${filteredRosterData.length} team members.`, 'info');
  };

  // Helper to load logo as Base64 for vector PDF embed and watermark
  const loadBase64Image = (url?: string): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!url) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  // Corporate Attendance Report PDF Generator (Daily / Weekly / Monthly for HR / Superadmin / Managers)
  const handleGenerateAttendancePDF = async () => {
    if (!isHrOrSuperadmin && !isManager) {
      addToast('Permission Denied', 'Attendance PDF generation is restricted to Managers and HR/Superadmins.', 'error');
      return;
    }

    const targetEmployees = managedTeam.length > 0 ? managedTeam : [currentProfile];
    if (targetEmployees.length === 0) {
      addToast('No Employees Found', 'No managed employee records found to generate attendance report.', 'warning');
      return;
    }

    setIsGeneratingPdf(true);
    addToast('Generating PDF Report...', 'Processing attendance data, digital verification stamp & corporate branding...', 'info');

    try {
      const logoBase64 = await loadBase64Image(currentOrg.logoUrl);
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth(); // 842 pt
      const pageHeight = doc.internal.pageSize.getHeight(); // 595 pt
      const margin = 36;
      const contentWidth = pageWidth - margin * 2;

      // Function to render light organization watermark on any page
      const drawWatermark = () => {
        try {
          if (logoBase64) {
            if ((doc as any).GState) {
              doc.setGState(new (doc as any).GState({ opacity: 0.055 }));
            }
            const wmSize = 220;
            doc.addImage(logoBase64, 'PNG', (pageWidth - wmSize) / 2, (pageHeight - wmSize) / 2, wmSize, wmSize);
            if ((doc as any).GState) {
              doc.setGState(new (doc as any).GState({ opacity: 1.0 }));
            }
          }
        } catch {}
      };

      // Header Branding Bar
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 8, 'F');
      doc.setFillColor(37, 99, 235); // blue-600
      doc.rect(0, 8, pageWidth, 3, 'F');

      let currentY = 30;

      // Logo + Company Name
      if (logoBase64) {
        try {
          doc.addImage(logoBase64, 'PNG', margin, currentY, 34, 34);
        } catch {}
      }
      const titleX = logoBase64 ? margin + 44 : margin;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(currentOrg.name?.toUpperCase() || 'VEDOTRIX PULSE HRMS', titleX, currentY + 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      const reportTitle =
        reportType === 'daily'
          ? `DAILY ATTENDANCE & SHIFT VERIFICATION REPORT • Date: ${formatISTDate(reportDate)}`
          : reportType === 'weekly'
          ? `WEEKLY ATTENDANCE REGISTER & WORK HOURS AUDIT • Week Ending: ${formatISTDate(reportDate)}`
          : `MONTHLY ATTENDANCE REGISTER & STATUTORY AUDIT • Month: ${reportMonthYear}`;
      doc.text(reportTitle, titleX, currentY + 24);

      // Meta Info on Top Right
      const nowISTString = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Generated: ${nowISTString} IST`, pageWidth - margin, currentY + 10, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.text(`Scope: ${isManager ? 'Direct Managed Team' : 'Organization Directory'} (${targetEmployees.length} Staff)`, pageWidth - margin, currentY + 22, { align: 'right' });
      doc.text(`Signatory: ${currentProfile.firstName} ${currentProfile.lastName} (${currentProfile.role.toUpperCase()})`, pageWidth - margin, currentY + 34, { align: 'right' });

      currentY += 44;

      // ==========================================
      // 1. DAILY ATTENDANCE REPORT
      // ==========================================
      if (reportType === 'daily') {
        const rows: any[] = [];
        let pCount = 0;
        let rCount = 0;
        let aCount = 0;
        let lCount = 0;
        let pendingCount = 0;
        let totalHoursLogged = 0;

        targetEmployees.forEach((emp, idx) => {
          const punch = attendanceRecords.find((a) => a.employeeId === emp.id && a.date === reportDate);
          const leave = leaveRequests.find((l) => l.employeeId === emp.id && (l.status === 'approved' || l.status === 'pending') && l.startDate <= reportDate && l.endDate >= reportDate);
          const isBeforeJoining = emp.joiningDate && reportDate < emp.joiningDate;

          const customOverride = currentOrg.settings?.customDayOverrides?.[reportDate] || currentOrg.settings?.customDayOverrides?.[`${reportDate}_${emp.id}`];
          const isOverrideWorking = customOverride?.type === 'working';
          const isOverrideWeekOff = customOverride?.type === 'week_off';
          const isOverrideHol = customOverride?.type === 'holiday';

          const [rY, rM, rD] = reportDate.split('-').map(Number);
          const dayOfWeek = new Date(rY, rM - 1, rD).getDay();
          const empWeekOffs: number[] = currentOrg.settings?.employeeWeekOffs?.[emp.id] || currentOrg.settings?.weekOffDays || [0];
          const isWeeklyOff = empWeekOffs.includes(dayOfWeek);
          const isEffectiveWeekOff = (isWeeklyOff || isOverrideWeekOff) && !isOverrideWorking;
          const matchingHol = orgHolidays.find((h) => h.date === reportDate);
          const isEffectiveHol = (matchingHol || isOverrideHol) && !isOverrideWorking;

          const isRejected = punch?.regularizationStatus === 'rejected' || punch?.approvalStatus === 'rejected';
          const isPending = !isRejected && (punch?.regularizationStatus === 'pending' || punch?.approvalStatus === 'pending_manager_approval' || punch?.status === 'pending');
          const isApproved = !isRejected && !isPending && (punch?.regularizationStatus === 'approved' || punch?.approvalStatus === 'approved');

          let statusStr = 'ABSENT';
          let cinStr = '—';
          let coutStr = '—';
          let hours = 0;
          let notes = '—';

          if (isBeforeJoining) {
            statusStr = 'PRE-JOINING';
          } else if (isEffectiveHol) {
            statusStr = `HOLIDAY (${matchingHol?.name || customOverride?.name || 'Declared'})`;
          } else if (isEffectiveWeekOff) {
            statusStr = 'WEEK-OFF';
          } else if (leave) {
            statusStr = `LEAVE (${leave.leaveType.toUpperCase()})`;
            lCount++;
          } else if (isRejected) {
            statusStr = 'REJECTED • ABSENT';
            aCount++;
            const approver = punch?.approvedBy ? orgProfiles.find((p) => p.id === punch.approvedBy) : null;
            notes = `Rej by ${approver?.firstName || 'Manager'}${punch?.approvalNotes ? `: ${punch.approvalNotes}` : ''}`;
          } else if (isPending) {
            statusStr = 'PENDING APPROVAL';
            pendingCount++;
            notes = punch?.regularizationReason ? `Req: ${punch.regularizationReason}` : 'Pending Manager Review';
          } else if (isApproved) {
            if (punch?.status === 'regularized' || !punch?.checkInTime) {
              statusStr = 'REGULARIZED ★';
              rCount++;
            } else {
              statusStr = 'PRESENT ✓';
              pCount++;
            }
            hours = punch?.totalHours || 8;
            totalHoursLogged += hours;
            const approver = (punch?.approvedBy || punch?.regularizedBy) ? orgProfiles.find((p) => p.id === (punch.approvedBy || punch.regularizedBy)) : null;
            notes = `Approved by ${approver?.firstName || 'Manager'}${punch?.approvalNotes ? `: ${punch.approvalNotes}` : ''}`;
          } else if (punch?.status === 'present' && punch?.approvalStatus !== 'pending_manager_approval') {
            statusStr = 'PRESENT ✓';
            pCount++;
            hours = punch?.totalHours || 8;
            totalHoursLogged += hours;
            notes = punch.isRemote ? 'Remote (WFH)' : 'Office Biometric';
          } else {
            statusStr = 'ABSENT';
            aCount++;
            notes = 'Unmarked Shift';
          }

          if (punch?.checkInTime) {
            cinStr = formatISTTime(punch.checkInTime);
          }
          if (punch?.checkOutTime) {
            coutStr = formatISTTime(punch.checkOutTime);
          }

          rows.push([
            idx + 1,
            `${emp.firstName} ${emp.lastName}\n(${emp.employeeCode || emp.id.slice(0, 6)})`,
            `${emp.department || 'Operations'}\n${emp.designation || 'Staff'}`,
            statusStr,
            cinStr,
            coutStr,
            `${hours}h`,
            punch?.officeAddress || (punch?.isRemote ? 'Remote / Field' : 'HQ Office'),
            notes
          ]);
        });

        const workingCount = pCount + rCount + aCount + pendingCount;
        const totalEffectivePresent = pCount + rCount + lCount * 0.5;
        const presencePct = workingCount > 0 ? Math.min(100, Math.round((totalEffectivePresent / workingCount) * 100)) : 100;

        doc.setFillColor(241, 245, 249); // slate-100
        doc.roundedRect(margin, currentY, contentWidth, 26, 4, 4, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(margin, currentY, contentWidth, 26, 4, 4, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);

        const summaryText = `Managed Team: ${targetEmployees.length}   |   Present (Punch): ${pCount}   |   Regularized (Approved): ${rCount}   |   Pending Review: ${pendingCount}   |   Absent: ${aCount}   |   Leaves: ${lCount}   |   Total Hours: ${totalHoursLogged}h   |   Presence: ${presencePct}%`;
        doc.text(summaryText, margin + 10, currentY + 16);

        currentY += 34;

        autoTable(doc, {
          head: [['#', 'Employee Name & Code', 'Department & Role', 'Status', 'Check-In', 'Check-Out', 'Hours', 'Location', 'Approver / Remarks']],
          body: rows,
          startY: currentY,
          margin: { left: margin, right: margin, bottom: 35 },
          theme: 'grid',
          styles: { fontSize: 7.5, cellPadding: 4, overflow: 'linebreak' },
          headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
          columnStyles: {
            0: { halign: 'center', cellWidth: 24 },
            1: { cellWidth: 105, fontStyle: 'bold' },
            2: { cellWidth: 95 },
            3: { halign: 'center', cellWidth: 85, fontStyle: 'bold' },
            4: { halign: 'center', cellWidth: 50 },
            5: { halign: 'center', cellWidth: 50 },
            6: { halign: 'center', cellWidth: 40, fontStyle: 'bold' },
            7: { cellWidth: 90 },
            8: { cellWidth: 'auto' }
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 3) {
              const val = String(data.cell.raw || '');
              if (val.includes('PRESENT')) {
                data.cell.styles.textColor = [16, 185, 129];
              } else if (val.includes('REGULARIZED')) {
                data.cell.styles.textColor = [6, 182, 212];
              } else if (val.includes('REJECTED') || val === 'ABSENT') {
                data.cell.styles.textColor = [225, 29, 72];
              } else if (val.includes('PENDING')) {
                data.cell.styles.textColor = [245, 158, 11];
              } else if (val.includes('LEAVE')) {
                data.cell.styles.textColor = [59, 130, 246];
              } else {
                data.cell.styles.textColor = [100, 116, 139];
              }
            }
          }
        });
      }

      // ==========================================
      // 2. WEEKLY ATTENDANCE REGISTER
      // ==========================================
      else if (reportType === 'weekly') {
        const dates: string[] = [];
        const baseDate = new Date(reportDate);
        for (let i = 6; i >= 0; i--) {
          const d = new Date(baseDate);
          d.setDate(d.getDate() - i);
          dates.push(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
        }

        const dateLabels = dates.map((d) => {
          const dateObj = new Date(d);
          const dayShort = dateObj.toLocaleDateString('en-IN', { weekday: 'short' });
          const [yy, mm, dd] = d.split('-');
          return `${dayShort}\n${dd}/${mm}`;
        });

        const rows: any[] = [];
        let totalPresentShifts = 0;
        let totalRegularizedShifts = 0;
        let totalAbsentShifts = 0;
        let grandTotalHours = 0;

        targetEmployees.forEach((emp, idx) => {
          let empPresent = 0;
          let empReg = 0;
          let empAbsent = 0;
          let empLeave = 0;
          let empHours = 0;

          const dayCols = dates.map((dStr) => {
            const punch = attendanceRecords.find((a) => a.employeeId === emp.id && a.date === dStr);
            const leave = leaveRequests.find((l) => l.employeeId === emp.id && (l.status === 'approved' || l.status === 'pending') && l.startDate <= dStr && l.endDate >= dStr);
            const isBeforeJoining = emp.joiningDate && dStr < emp.joiningDate;

            const [y, m, d] = dStr.split('-').map(Number);
            const dow = new Date(y, m - 1, d).getDay();
            const empWeekOffs: number[] = currentOrg.settings?.employeeWeekOffs?.[emp.id] || currentOrg.settings?.weekOffDays || [0];
            const isWeekOff = empWeekOffs.includes(dow);
            const isHol = orgHolidays.some((h) => h.date === dStr);

            const isRejected = punch?.regularizationStatus === 'rejected' || punch?.approvalStatus === 'rejected';
            const isPending = !isRejected && (punch?.regularizationStatus === 'pending' || punch?.approvalStatus === 'pending_manager_approval' || punch?.status === 'pending');
            const isApproved = !isRejected && !isPending && (punch?.regularizationStatus === 'approved' || punch?.approvalStatus === 'approved');

            if (isBeforeJoining) return '—';
            if (isHol) return 'HOL';
            if (isWeekOff) return 'WO';
            if (leave) {
              empLeave++;
              return 'LEAVE';
            }
            if (isRejected) {
              empAbsent++;
              return 'REJ';
            }
            if (isPending) {
              return 'PEND';
            }
            if (isApproved) {
              const h = punch?.totalHours || 8;
              empHours += h;
              if (punch?.status === 'regularized' || !punch?.checkInTime) {
                empReg++;
                return `REG\n(${h}h)`;
              } else {
                empPresent++;
                return `P\n(${h}h)`;
              }
            }
            if (punch?.status === 'present' && punch?.approvalStatus !== 'pending_manager_approval') {
              const h = punch?.totalHours || 8;
              empHours += h;
              empPresent++;
              return `P\n(${h}h)`;
            }
            if (dStr <= getTodayISTDateString()) {
              empAbsent++;
              return 'ABS';
            }
            return '—';
          });

          totalPresentShifts += empPresent;
          totalRegularizedShifts += empReg;
          totalAbsentShifts += empAbsent;
          grandTotalHours += empHours;

          const totalWorkDays = empPresent + empReg + empAbsent;
          const presenceRate = totalWorkDays > 0 ? Math.round(((empPresent + empReg) / totalWorkDays) * 100) : 100;

          rows.push([
            idx + 1,
            `${emp.firstName} ${emp.lastName}`,
            emp.department || 'Operations',
            ...dayCols,
            empPresent + empReg,
            empAbsent,
            `${empHours}h`,
            `${presenceRate}%`
          ]);
        });

        doc.setFillColor(241, 245, 249);
        doc.roundedRect(margin, currentY, contentWidth, 26, 4, 4, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(margin, currentY, contentWidth, 26, 4, 4, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        const weeklySummary = `Week: ${formatISTDate(dates[0])} to ${formatISTDate(dates[6])}   |   Team: ${targetEmployees.length}   |   Present Shifts: ${totalPresentShifts}   |   Regularized Shifts: ${totalRegularizedShifts}   |   Absent Shifts: ${totalAbsentShifts}   |   Total Hours: ${grandTotalHours}h`;
        doc.text(weeklySummary, margin + 10, currentY + 16);

        currentY += 34;

        autoTable(doc, {
          head: [['#', 'Employee Name', 'Dept', ...dateLabels, 'Present', 'Absent', 'Total Hours', 'Presence %']],
          body: rows,
          startY: currentY,
          margin: { left: margin, right: margin, bottom: 35 },
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 3, halign: 'center' },
          headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 100, halign: 'left', fontStyle: 'bold' },
            2: { cellWidth: 70, halign: 'left' }
          }
        });
      }

      // ==========================================
      // 3. MONTHLY ATTENDANCE REGISTER
      // ==========================================
      else if (reportType === 'monthly') {
        const [targetYear, targetMonthNum] = reportMonthYear.split('-').map(Number);
        const daysInMonth = new Date(targetYear, targetMonthNum, 0).getDate();
        const monthPrefix = `${targetYear}-${String(targetMonthNum).padStart(2, '0')}`;
        const todayISTStr = getTodayISTDateString();

        const rows: any[] = [];
        let grandPresent = 0;
        let grandReg = 0;
        let grandLeaves = 0;
        let grandAbsent = 0;
        let grandHours = 0;

        targetEmployees.forEach((emp, idx) => {
          let workingDays = 0;
          let presentCount = 0;
          let regCount = 0;
          let leavesCount = 0;
          let absentCount = 0;
          let totalHours = 0;

          for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
            if (emp.joiningDate && dateStr < emp.joiningDate) continue;

            const dayOfWeek = new Date(targetYear, targetMonthNum - 1, d).getDay();
            const empWeekOffs: number[] = currentOrg.settings?.employeeWeekOffs?.[emp.id] || currentOrg.settings?.weekOffDays || [0];
            const isWeekOff = empWeekOffs.includes(dayOfWeek);
            const isHol = orgHolidays.some((h) => h.date === dateStr);
            const leave = leaveRequests.find((l) => l.employeeId === emp.id && (l.status === 'approved' || l.status === 'pending') && l.startDate <= dateStr && l.endDate >= dateStr);

            if (isHol || isWeekOff) continue;
            workingDays++;

            const punch = attendanceRecords.find((a) => a.employeeId === emp.id && a.date === dateStr);
            const isRejected = punch?.regularizationStatus === 'rejected' || punch?.approvalStatus === 'rejected';
            const isPending = !isRejected && (punch?.regularizationStatus === 'pending' || punch?.approvalStatus === 'pending_manager_approval' || punch?.status === 'pending');
            const isApproved = !isRejected && !isPending && (punch?.regularizationStatus === 'approved' || punch?.approvalStatus === 'approved');

            if (leave) {
              leavesCount++;
            } else if (isRejected) {
              absentCount++;
            } else if (isPending) {
              absentCount++;
            } else if (isApproved) {
              const h = punch?.totalHours || 8;
              totalHours += h;
              if (punch?.status === 'regularized' || !punch?.checkInTime) {
                regCount++;
              } else {
                presentCount++;
              }
            } else if (punch?.status === 'present' && punch?.approvalStatus !== 'pending_manager_approval') {
              const h = punch?.totalHours || 8;
              totalHours += h;
              presentCount++;
            } else if (dateStr <= todayISTStr) {
              absentCount++;
            }
          }

          grandPresent += presentCount;
          grandReg += regCount;
          grandLeaves += leavesCount;
          grandAbsent += absentCount;
          grandHours += totalHours;

          const totalEffective = presentCount + regCount + leavesCount * 0.5;
          const pct = workingDays > 0 ? Math.min(100, Math.round((totalEffective / workingDays) * 100)) : 100;
          const auditStatus = pct >= 85 ? 'COMPLIANT' : 'ATTENTION REQUIRED';

          rows.push([
            idx + 1,
            `${emp.firstName} ${emp.lastName}\n(${emp.employeeCode || emp.id.slice(0, 6)})`,
            emp.department || 'Operations',
            workingDays,
            presentCount,
            regCount,
            presentCount + regCount,
            leavesCount,
            absentCount,
            `${totalHours}h`,
            `${pct}%`,
            auditStatus
          ]);
        });

        const grandWorking = grandPresent + grandReg + grandAbsent;
        const grandPct = grandWorking > 0 ? Math.round(((grandPresent + grandReg) / grandWorking) * 100) : 100;

        doc.setFillColor(241, 245, 249);
        doc.roundedRect(margin, currentY, contentWidth, 26, 4, 4, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(margin, currentY, contentWidth, 26, 4, 4, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        const monthlySummary = `Month: ${reportMonthYear}   |   Team Size: ${targetEmployees.length}   |   Present Days: ${grandPresent}   |   Regularized: ${grandReg}   |   Leaves: ${grandLeaves}   |   Absent / LOP: ${grandAbsent}   |   Total Hours: ${grandHours}h   |   Team Presence: ${grandPct}%`;
        doc.text(monthlySummary, margin + 10, currentY + 16);

        currentY += 34;

        autoTable(doc, {
          head: [['#', 'Employee Name & Code', 'Department', 'Working Days', 'Verified Present', 'Regularized (Approved)', 'Total Present', 'Leaves', 'Absent / LOP', 'Logged Hours', 'Presence %', 'Audit Status']],
          body: rows,
          startY: currentY,
          margin: { left: margin, right: margin, bottom: 35 },
          theme: 'grid',
          styles: { fontSize: 7.5, cellPadding: 3.5, halign: 'center' },
          headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 120, halign: 'left', fontStyle: 'bold' },
            2: { cellWidth: 90, halign: 'left' },
            11: { fontStyle: 'bold' }
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 11) {
              const val = String(data.cell.raw || '');
              if (val === 'COMPLIANT') {
                data.cell.styles.textColor = [16, 185, 129];
              } else {
                data.cell.styles.textColor = [225, 29, 72];
              }
            }
          }
        });
      }

      // ==========================================
      // DIGITAL SEAL & FOOTER ON ALL PAGES
      // ==========================================
      const totalPages = (doc.internal as any).getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawWatermark();

        // If last page, render Official Digital Stamp
        if (i === totalPages) {
          const finalY = (doc as any).lastAutoTable?.finalY || 420;
          if (finalY + 70 < pageHeight - 30) {
            const stampX = pageWidth - margin - 220;
            const stampY = finalY + 12;

            // Stamp Border Box
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(stampX, stampY, 220, 56, 4, 4, 'F');
            doc.setDrawColor(37, 99, 235);
            doc.setLineWidth(1.2);
            doc.roundedRect(stampX, stampY, 220, 56, 4, 4, 'S');

            // Stamp Circle
            doc.setDrawColor(37, 99, 235);
            doc.circle(stampX + 26, stampY + 28, 18, 'S');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(5);
            doc.setTextColor(37, 99, 235);
            doc.text('HRMS AUDIT', stampX + 26, stampY + 26, { align: 'center' });
            doc.text('VERIFIED', stampX + 26, stampY + 32, { align: 'center' });

            // Stamp Text
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(15, 23, 42);
            doc.text('OFFICIALLY AUTHENTICATED', stampX + 52, stampY + 15);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(71, 85, 105);
            doc.text(`Signatory: ${currentProfile.firstName} ${currentProfile.lastName} (${currentProfile.role.toUpperCase()})`, stampX + 52, stampY + 26);
            doc.text(`Org: ${currentOrg.name} (${currentOrg.orgCode})`, stampX + 52, stampY + 36);
            doc.text(`Timestamp: ${nowISTString} IST`, stampX + 52, stampY + 48);
          }
        }

        // Bottom Footer
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Official Corporate Document • Generated via Vedotrix Pulse HRMS Cloud • Page ${i} of ${totalPages} • Strictly Confidential`,
          pageWidth / 2,
          pageHeight - 14,
          { align: 'center' }
        );
      }

      const safeDateStr = reportType === 'monthly' ? reportMonthYear : reportDate;
      const filename = `Attendance_${reportType.toUpperCase()}_${currentOrg.orgCode}_${safeDateStr}.pdf`;
      doc.save(filename);

      addToast('PDF Report Exported 📄', `Successfully generated ${reportType.toUpperCase()} attendance report.`, 'success');
      setIsReportModalOpen(false);
    } catch (err: any) {
      console.error('Attendance report PDF generation error:', err);
      addToast('Export Failed', err?.message || 'Could not generate attendance PDF report.', 'error');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const departments = useMemo(() => {
    return Array.from(new Set(managedTeam.map((p) => p.department).filter(Boolean)));
  }, [managedTeam]);

  // Regularization & out-of-office presence records memo for View 3
  const regularizationList = useMemo(() => {
    const allowedEmpIds = isHrOrSuperadmin ? null : new Set(managedTeam.map((m) => m.id));

    return attendanceRecords
      .filter((a) => {
        const isRejected = a.approvalStatus === 'rejected' || a.regularizationStatus === 'rejected';
        const isPending = !isRejected && (a.approvalStatus === 'pending_manager_approval' || a.regularizationStatus === 'pending');
        const isApproved = !isRejected && !isPending && (a.approvalStatus === 'approved' || a.regularizationStatus === 'approved');
        
        if (!isApproved && !isRejected && !isPending) return false;
        if (allowedEmpIds && !allowedEmpIds.has(a.employeeId)) return false;

        const effectiveStatus = isRejected ? 'rejected' : isApproved ? 'approved' : 'pending';
        if (regFilterStatus !== 'all' && effectiveStatus !== regFilterStatus) return false;
        if (regSearchQuery.trim()) {
          const emp = orgProfiles.find((p) => p.id === a.employeeId);
          const name = emp ? `${emp.firstName} ${emp.lastName}`.toLowerCase() : '';
          const reason = (a.regularizationReason || '').toLowerCase();
          const query = regSearchQuery.toLowerCase();
          return name.includes(query) || reason.includes(query) || a.date.includes(query);
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendanceRecords, isHrOrSuperadmin, managedTeam, regFilterStatus, regSearchQuery, orgProfiles]);

  const regStats = useMemo(() => {
    const allowedEmpIds = isHrOrSuperadmin ? null : new Set(managedTeam.map((m) => m.id));
    const allRegs = attendanceRecords.filter((a) => {
      const isRejected = a.approvalStatus === 'rejected' || a.regularizationStatus === 'rejected';
      const isPending = !isRejected && (a.approvalStatus === 'pending_manager_approval' || a.regularizationStatus === 'pending');
      const isApproved = !isRejected && !isPending && (a.approvalStatus === 'approved' || a.regularizationStatus === 'approved');
      if (!isApproved && !isRejected && !isPending) return false;
      if (allowedEmpIds && !allowedEmpIds.has(a.employeeId)) return false;
      return true;
    });
    return {
      all: allRegs.length,
      pending: allRegs.filter((a) => (a.approvalStatus === 'pending_manager_approval' || a.regularizationStatus === 'pending') && a.approvalStatus !== 'approved' && a.regularizationStatus !== 'approved' && a.approvalStatus !== 'rejected' && a.regularizationStatus !== 'rejected').length,
      approved: allRegs.filter((a) => (a.regularizationStatus === 'approved' || a.approvalStatus === 'approved') && a.regularizationStatus !== 'rejected' && a.approvalStatus !== 'rejected').length,
      rejected: allRegs.filter((a) => a.regularizationStatus === 'rejected' || a.approvalStatus === 'rejected').length
    };
  }, [attendanceRecords, isHrOrSuperadmin, managedTeam]);

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] shadow-xl overflow-hidden text-[var(--text-primary)] transition-colors duration-200 space-y-0">
      {/* 1. Header Toolbar & View Mode Switcher */}
      <div className="p-4 sm:p-5 border-b border-[var(--border-color)] bg-[var(--bg-card-subtle)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center border border-blue-500/20 shrink-0">
            <CalendarDays className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                Attendance & Performance Console (IST)
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase tracking-wide">
                Asia/Kolkata
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Shift: <span className="font-semibold text-[var(--text-primary)]">{currentOrg.settings?.shiftStartTime || '09:30'} AM - {currentOrg.settings?.shiftEndTime || '18:30'} PM IST</span> • Grace Period: <span className="text-cyan-400 font-semibold">{currentOrg.settings?.gracePeriodMins || 15} mins</span>
            </p>
          </div>
        </div>

        {/* View Switcher (for Managers / HR / Superadmin) */}
        <div className="flex flex-wrap items-center gap-2.5">
          {(isHrOrSuperadmin || isManager) && (
            <div className="flex items-center bg-[var(--bg-card)] border border-[var(--border-color)] p-1 rounded-xl shadow-xs">
              <button
                onClick={() => setActiveViewTab('calendar')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                  activeViewTab === 'calendar'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Monthly Calendar & Work PR</span>
              </button>
              <button
                onClick={() => setActiveViewTab('daily_roster')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                  activeViewTab === 'daily_roster'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Team Daily Roster</span>
              </button>
              <button
                onClick={() => setActiveViewTab('regularizations')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                  activeViewTab === 'regularizations'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <FileEdit className="w-3.5 h-3.5" />
                <span>Regularizations</span>
                {pendingRegularizationsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-500 text-slate-950 animate-pulse">
                    {pendingRegularizationsCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Employee Selector for Managers & Leadership */}
          {activeViewTab === 'calendar' && (isHrOrSuperadmin || isManager) && (
            <div className="flex items-center space-x-2 bg-[var(--bg-card)] border border-[var(--border-color)] px-3 py-1.5 rounded-xl shadow-xs">
              <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="text-[11px] text-[var(--text-muted)] font-medium hidden sm:inline">Employee:</span>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="bg-transparent text-xs font-bold text-[var(--text-primary)] focus:outline-none cursor-pointer pr-1"
              >
                {selectableEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id} className="bg-[var(--bg-card)] text-[var(--text-primary)]">
                    {emp.firstName} {emp.lastName} ({emp.role.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Shift Timing & Week-Offs configuration button for Superadmin & HR */}
          {isHrOrSuperadmin && (
            <button
              onClick={() => setIsShiftModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/30 rounded-xl text-xs font-bold transition shadow-xs"
              title="Configure Shift Timings & Team Week-Offs"
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Shift & Week-Offs</span>
              <span className="sm:hidden">Shift</span>
            </button>
          )}

          {/* Attendance Report PDF Button for HR / Superadmin / Managers */}
          {(isHrOrSuperadmin || isManager) && (
            <button
              onClick={() => {
                setReportDate(selectedRosterDate || getTodayISTDateString());
                setIsReportModalOpen(true);
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              title="Generate Official Attendance Report PDF (Daily / Weekly / Monthly)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export PDF Report</span>
              <span className="sm:hidden">PDF Report</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: MONTHLY CALENDAR LAYOUT & WORK PR DELIVERABLES PROFILE            */}
      {/* ========================================================================= */}
      {activeViewTab === 'calendar' && (
        <div className="p-4 sm:p-6 space-y-6">
          {/* Employee Profile Header Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-600/10 via-indigo-600/5 to-transparent border border-blue-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5 min-w-0">
              {inspectedEmployee.avatarUrl && inspectedEmployee.avatarUrl !== '/vedotrix-logo.png' ? (
                <img
                  src={inspectedEmployee.avatarUrl}
                  alt={inspectedEmployee.firstName}
                  className="w-12 h-12 rounded-xl object-cover border-2 border-blue-500/30 shrink-0 shadow-sm"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-blue-600 text-white font-extrabold text-base flex items-center justify-center shrink-0 shadow-sm">
                  {inspectedEmployee.firstName[0]}
                  {inspectedEmployee.lastName?.[0] || ''}
                </div>
              )}
              <div className="truncate">
                <div className="flex items-center space-x-2 truncate">
                  <h3 className="text-base font-bold text-[var(--text-primary)] truncate">
                    {inspectedEmployee.firstName} {inspectedEmployee.lastName}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
                    {inspectedEmployee.role}
                  </span>
                </div>
                <div className="text-xs text-[var(--text-muted)] truncate mt-0.5 flex items-center flex-wrap gap-1.5">
                  <span>{inspectedEmployee.designation || 'Staff'} • {inspectedEmployee.department}</span>
                  <span>•</span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    Joined: {inspectedEmployee.joiningDate ? formatISTDate(inspectedEmployee.joiningDate) : 'Not Set'}
                  </span>
                  {isHrOrSuperadmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingJoiningDateVal(inspectedEmployee.joiningDate || getTodayISTDateString());
                        setIsEditingJoiningDate(true);
                      }}
                      className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-blue-500 hover:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition cursor-pointer"
                      title="Set/Change official joining date (Superadmin/HR only)"
                    >
                      <Edit3 className="w-2.5 h-2.5" />
                      <span>{inspectedEmployee.joiningDate ? 'Edit Joining Date' : 'Set Joining Date'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Performance & Attendance Chips */}
            <div className="flex items-center flex-wrap gap-2">
              <div className="px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center shadow-xs">
                <span className="text-[10px] text-[var(--text-muted)] block font-semibold">Attendance Rate</span>
                <span className="text-sm font-extrabold text-emerald-400 font-mono">
                  {monthlyMetrics.attendancePercentage}%
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center shadow-xs">
                <span className="text-[10px] text-[var(--text-muted)] block font-semibold">Days Present</span>
                <span className="text-sm font-extrabold text-blue-400 font-mono">
                  {monthlyMetrics.totalPresentDays} / {monthlyMetrics.workingDays}
                </span>
                {monthlyMetrics.regularizedCount > 0 && (
                  <span className="text-[9px] text-teal-400 font-semibold block -mt-0.5">
                    ({monthlyMetrics.presentCount} + {monthlyMetrics.regularizedCount} Reg)
                  </span>
                )}
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center shadow-xs">
                <span className="text-[10px] text-[var(--text-muted)] block font-semibold">Regularized</span>
                <span className="text-sm font-extrabold text-teal-400 font-mono">
                  {monthlyMetrics.regularizedCount}
                </span>
                <span className="text-[9px] text-emerald-400/90 font-medium block -mt-0.5">
                  Counted in Present
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center shadow-xs">
                <span className="text-[10px] text-[var(--text-muted)] block font-semibold">Absent</span>
                <span className="text-sm font-extrabold text-rose-400 font-mono">
                  {monthlyMetrics.absentCount}
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center shadow-xs">
                <span className="text-[10px] text-[var(--text-muted)] block font-semibold">Logged Hours</span>
                <span className="text-sm font-extrabold text-indigo-400 font-mono">
                  {totalStandupHours} hrs
                </span>
              </div>
            </div>
          </div>

          {/* Month Selector Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePrevMonth}
                className="p-2 rounded-xl bg-[var(--bg-card-subtle)] hover:bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h3 className="text-base font-extrabold text-[var(--text-primary)] min-w-[180px] text-center">
                {monthName}
              </h3>
              <button
                onClick={handleNextMonth}
                className="p-2 rounded-xl bg-[var(--bg-card-subtle)] hover:bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={handleJumpToCurrentMonth}
                className="ml-2 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 transition"
              >
                Current Month
              </button>
            </div>

            {/* Legend */}
            <div className="flex items-center flex-wrap gap-2 text-[10px] text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Present
              </span>
              <span className="inline-flex items-center gap-1 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500" /> Regularized
              </span>
              <span className="inline-flex items-center gap-1 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Holiday
              </span>
              <span className="inline-flex items-center gap-1 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500" /> Week-Off
              </span>
              <span className="inline-flex items-center gap-1 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Leave
              </span>
              <span className="inline-flex items-center gap-1 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Pending Reg.
              </span>
              <span className="inline-flex items-center gap-1 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Absent (Unmarked)
              </span>
              <span className="inline-flex items-center gap-1 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-700" /> Pre-Joining
              </span>
            </div>
          </div>

          {/* Monthly Calendar 7-Column Grid (Responsive Mobile Scroll + Touch-Friendly) */}
          <div className="overflow-x-auto pb-3 -mx-4 sm:mx-0 px-4 sm:px-0">
            <div className="min-w-[620px] rounded-2xl border border-[var(--border-color)] overflow-hidden bg-[var(--bg-card)] shadow-xs">
              {/* Days of week header */}
              <div className="grid grid-cols-7 border-b border-[var(--border-color)] bg-[var(--bg-card-subtle)] text-center text-xs font-bold py-2.5">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, idx) => (
                  <div key={d} className={idx === 0 || idx === 6 ? 'text-amber-400' : 'text-[var(--text-secondary)]'}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 divide-x divide-y divide-[var(--border-color)]">
                {/* Spacer cells for days before the 1st of month */}
                {Array.from({ length: calendarDays.firstDayIndex }).map((_, i) => (
                  <div key={`spacer-${i}`} className="min-h-[95px] p-2 bg-[var(--bg-card-subtle)]/40 opacity-40" />
                ))}

                {/* Month Day Cells */}
                {calendarDays.daysArray.map((dayObj) => {
                  const { day, isToday, status, holiday, leave, punch } = dayObj;

                  let badgeBg = 'bg-[var(--bg-card)]';
                  let badgeBorder = 'border-transparent';

                  if (isToday) {
                    badgeBorder = 'ring-2 ring-blue-500 border-blue-500';
                  }

                  return (
                    <div
                      key={dayObj.dateStr}
                      onClick={() => setSelectedCalendarDay(dayObj)}
                      role="button"
                      tabIndex={0}
                      title="Click to view detailed day punch breakdown & shift details"
                      className={`min-h-[95px] p-2 flex flex-col justify-between transition cursor-pointer hover:bg-[var(--bg-card-subtle)] hover:shadow-xs active:scale-[0.98] ${badgeBg} ${badgeBorder}`}
                    >
                    {/* Day Number Header */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-extrabold ${
                          isToday
                            ? 'w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center'
                            : dayObj.dayOfWeek === 0
                            ? 'text-amber-400 font-bold'
                            : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {day}
                      </span>
                      {isToday && (
                        <span className="text-[8px] font-extrabold uppercase px-1 py-0.2 rounded bg-blue-500/20 text-blue-400">
                          Today
                        </span>
                      )}
                    </div>

                    {/* Status Pill in Calendar Cell */}
                    <div className="mt-1.5 space-y-1">
                      {status === 'holiday' && (
                        <div className="p-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300">
                          <span className="block text-[9px] font-extrabold truncate">
                            🎊 {holiday?.name || 'Holiday'}
                          </span>
                          <span className="block text-[8px] opacity-75 truncate uppercase">
                            Official Holiday
                          </span>
                        </div>
                      )}

                      {status === 'week_off' && (
                        <div className="p-1 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-400">
                          <span className="block text-[9px] font-bold truncate">
                            🏖️ Week-Off
                          </span>
                        </div>
                      )}

                      {status === 'leave' && (
                        <div className="p-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300">
                          <span className="block text-[9px] font-bold truncate">
                            ✈️ {leave?.leaveType.toUpperCase()}
                          </span>
                          <span className="block text-[8px] opacity-75 truncate">
                            {leave?.status}
                          </span>
                        </div>
                      )}

                      {status === 'present' && punch && (
                        <div className="p-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                          <div className="flex items-center justify-between text-[9px] font-bold">
                            <span>✓ Present</span>
                            <span className="font-mono">{punch.totalHours}h</span>
                          </div>
                          <span className="block text-[8px] text-emerald-400 truncate">
                            In: {formatISTTime(punch.checkInTime!)}
                          </span>
                        </div>
                      )}

                      {status === 'regularized' && (
                        <div className="p-1 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-300">
                          <div className="flex items-center justify-between text-[9px] font-bold">
                            <span>★ Regularized</span>
                            <span className="font-mono">{punch?.totalHours || 8}h</span>
                          </div>
                          <span className="block text-[8px] text-teal-400 truncate">
                            Approved by Lead
                          </span>
                        </div>
                      )}

                      {status === 'pending' && (
                        <div className="p-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300">
                          <span className="block text-[9px] font-bold truncate">
                            ⏳ Pending Reg.
                          </span>
                          <span className="block text-[8px] opacity-75 truncate">
                            Approval Req.
                          </span>
                        </div>
                      )}

                      {status === 'absent' && (
                        <div className="p-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300">
                          <span className="block text-[9px] font-bold truncate">
                            ✗ Absent
                          </span>
                          <span className="block text-[8px] text-rose-400/80 truncate">
                            Unmarked Shift
                          </span>
                        </div>
                      )}

                      {status === 'pre_joining' && (
                        <div className="p-1 rounded-lg bg-slate-800/30 border border-slate-700/40 text-slate-500">
                          <span className="block text-[8px] font-bold truncate uppercase tracking-wider">
                            ⚪ Pre-Joining
                          </span>
                        </div>
                      )}

                      {status === 'future' && (
                        <span className="block text-[9px] text-[var(--text-muted)] opacity-40">
                          Shift Scheduled
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
          {/* WORK PR & DELIVERABLES PROFILE (TASKS, SPRINT PRs, STANDUPS, DELIVERABLES)*/}
          {/* ========================================================================= */}
          <div className="pt-2 border-t border-[var(--border-color)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                    Work Deliverables, PRs & Sprint Progress
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Official task delivery log, daily standups, and performance tracking for {inspectedEmployee.firstName}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Section A: Assigned Tasks & Deliverables */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                  <div className="flex items-center space-x-2">
                    <CheckSquare className="w-4 h-4 text-blue-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                      Tasks & Technical Deliverables
                    </h4>
                  </div>
                  <span className="text-xs font-mono font-bold text-blue-400">
                    {taskStats.done} of {taskStats.total} Completed
                  </span>
                </div>

                {employeeTasks.length === 0 ? (
                  <div className="py-8 text-center bg-[var(--bg-card-subtle)]/50 rounded-xl border border-dashed border-[var(--border-color)]">
                    <p className="text-xs text-[var(--text-muted)] font-medium">
                      No deliverables or tasks assigned currently.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {employeeTasks.map((t) => (
                      <div
                        key={t.id}
                        className="p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)] flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-[var(--text-primary)] block truncate">
                            {t.title}
                          </span>
                          {t.description && (
                            <p className="text-[11px] text-[var(--text-muted)] line-clamp-1 mt-0.5">
                              {t.description}
                            </p>
                          )}
                          <div className="flex items-center space-x-2 mt-1 text-[10px]">
                            <span className="text-[var(--text-muted)]">Priority:</span>
                            <span
                              className={`font-bold uppercase ${
                                t.priority === 'critical'
                                  ? 'text-rose-400'
                                  : t.priority === 'high'
                                  ? 'text-amber-400'
                                  : 'text-blue-400'
                              }`}
                            >
                              {t.priority}
                            </span>
                            {t.dueDate && (
                              <>
                                <span className="text-[var(--text-muted)]">•</span>
                                <span className="text-[var(--text-muted)]">Due: {t.dueDate}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase shrink-0 border ${
                            t.status === 'done'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : t.status === 'in_progress'
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                              : 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                          }`}
                        >
                          {t.status.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section B: Daily Standups & Engineering Log */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                      Daily Standup Logs ({monthName})
                    </h4>
                  </div>
                  <span className="text-xs font-mono font-bold text-indigo-400">
                    {employeeMonthStandups.length} Submissions
                  </span>
                </div>

                {employeeMonthStandups.length === 0 ? (
                  <div className="py-8 text-center bg-[var(--bg-card-subtle)]/50 rounded-xl border border-dashed border-[var(--border-color)]">
                    <p className="text-xs text-[var(--text-muted)] font-medium">
                      No daily standups logged for {monthName}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {employeeMonthStandups.map((s) => (
                      <div
                        key={s.id}
                        className="p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)] space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-indigo-400 font-mono">📅 {formatISTDate(s.date)}</span>
                          <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[10px]">
                            {s.hoursLogged || 8} hrs logged
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)]">
                          <strong className="text-[var(--text-primary)]">Completed Today:</strong> {s.completedToday}
                        </div>
                        {s.plannedTomorrow && (
                          <div className="text-[11px] text-[var(--text-secondary)]">
                            <strong className="text-[var(--text-primary)]">Planned Next:</strong> {s.plannedTomorrow}
                          </div>
                        )}
                        {s.blockers && (
                          <div className="text-[11px] text-amber-300 bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20">
                            <strong>Blockers:</strong> {s.blockers}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: TEAM DAILY ROSTER (FOR SUPERADMIN, HR & MANAGERS)                 */}
      {/* ========================================================================= */}
      {activeViewTab === 'daily_roster' && (
        <div>
          {/* Controls Bar */}
          <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-card)] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleShiftRosterDate(-1)}
                className="p-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-card-subtle)] transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="date"
                value={selectedRosterDate}
                onChange={(e) => setSelectedRosterDate(e.target.value)}
                className="bg-[var(--bg-card-subtle)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-primary)] px-3 py-1.5 rounded-xl cursor-pointer"
              />
              <button
                onClick={() => handleShiftRosterDate(1)}
                className="p-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-card-subtle)] transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Filters & Export */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search team member..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              {departments.length > 0 && (
                <select
                  value={rosterDept}
                  onChange={(e) => setRosterDept(e.target.value)}
                  className="px-2.5 py-1.5 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="all">All Departments</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              )}

              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-xs transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              {(isHrOrSuperadmin || isManager) && (
                <button
                  onClick={() => {
                    setReportDate(selectedRosterDate || getTodayISTDateString());
                    setIsReportModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-xs transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Export PDF</span>
                </button>
              )}
            </div>
          </div>

          {/* Dynamic Holiday / Week-Off Banner */}
          {holidayOnDate && (
            <div className="p-3 mx-4 mt-4 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-between text-xs text-purple-300">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                <span>
                  <strong>Official Corporate Holiday: {holidayOnDate.name}</strong> • Mandatory paid holiday for all employees.
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Paid Corporate Holiday
              </span>
            </div>
          )}

          {weekOffOnDate.isWeekOff && !holidayOnDate && (
            <div className="p-3 mx-4 mt-4 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-between text-xs text-indigo-300">
              <div className="flex items-center space-x-2">
                <Coffee className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>
                  <strong>Scheduled Organization Week-Off ({weekOffOnDate.dayName})</strong> • Regular rest day according to shift policy.
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Weekly Off
              </span>
            </div>
          )}

          {/* Quick Filter Status Tabs */}
          <div className="px-4 py-2.5 bg-[var(--bg-card)] border-b border-[var(--border-color)] flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setRosterFilterTab('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${rosterFilterTab === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'bg-[var(--bg-card-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            >
              All ({rosterStats.total})
            </button>
            <button
              type="button"
              onClick={() => setRosterFilterTab('present')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${rosterFilterTab === 'present' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'}`}
            >
              ✓ Present ({rosterStats.present})
            </button>
            {rosterStats.pending > 0 && (
              <button
                type="button"
                onClick={() => setRosterFilterTab('pending')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${rosterFilterTab === 'pending' ? 'bg-amber-600 text-white shadow-xs' : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'}`}
              >
                ⏳ Pending ({rosterStats.pending})
              </button>
            )}
            <button
              type="button"
              onClick={() => setRosterFilterTab('on_leave')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${rosterFilterTab === 'on_leave' ? 'bg-blue-600 text-white shadow-xs' : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'}`}
            >
              ✈ Leave ({rosterStats.onLeave})
            </button>
            <button
              type="button"
              onClick={() => setRosterFilterTab('week_off_holiday')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${rosterFilterTab === 'week_off_holiday' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20'}`}
            >
              ☕ Week Off / Holiday ({rosterStats.weekOffHoliday})
            </button>
            <button
              type="button"
              onClick={() => setRosterFilterTab('absent')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${rosterFilterTab === 'absent' ? 'bg-rose-600 text-white shadow-xs' : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'}`}
            >
              ✗ Absent ({rosterStats.absent})
            </button>
          </div>

          {/* Roster Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-card-subtle)] border-b border-[var(--border-color)] text-[var(--text-muted)] uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Department & Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Punch Time (IST)</th>
                  <th className="py-3 px-4">Location / Address</th>
                  <th className="py-3 px-4">Approver</th>
                  <th className="py-3 px-4">Inspection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {filteredRosterData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-[var(--text-muted)]">
                      No team members found for this date.
                    </td>
                  </tr>
                ) : (
                  filteredRosterData.map(({ employee, record, leave, holiday, isWeekOff, isBeforeJoining, status }) => (
                    <tr key={employee.id} className="hover:bg-[var(--bg-card-subtle)]/60 transition">
                      <td className="py-3 px-4 font-bold text-[var(--text-primary)]">
                        {employee.firstName} {employee.lastName}
                        <span className="block text-[10px] text-[var(--text-muted)] font-normal">{employee.email}</span>
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)]">
                        {employee.department} • <span className="uppercase text-[10px] font-bold">{employee.role}</span>
                      </td>
                      <td className="py-3 px-4">
                        {status === 'present' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            ✓ Present
                          </span>
                        ) : status === 'pending_approval' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3" />
                            Pending Approval
                          </span>
                        ) : status === 'on_leave' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            ✈️ Leave ({leave?.leaveType})
                          </span>
                        ) : status === 'holiday' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1 w-fit">
                            <Sparkles className="w-3 h-3" />
                            Holiday ({holiday?.name || 'Corporate'})
                          </span>
                        ) : status === 'week_off' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 w-fit">
                            <Coffee className="w-3 h-3" />
                            Week Off
                          </span>
                        ) : status === 'pre_joining' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-500/20 text-slate-400 border border-slate-500/30">
                            ⏳ Pre-Joining
                          </span>
                        ) : status === 'absent' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            ✗ Absent
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-500/20 text-slate-400 border border-slate-500/30">
                            ⏱️ Not Marked
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {record?.checkInTime ? formatISTTime(record.checkInTime) : '—'}
                      </td>
                      <td className="py-3 px-4 truncate max-w-xs text-[var(--text-muted)]">
                        {status === 'holiday'
                          ? `Official Corporate Holiday: ${holiday?.name || 'Holiday'}`
                          : status === 'week_off'
                          ? 'Scheduled Weekly Rest Day'
                          : status === 'pre_joining'
                          ? `Joined on ${formatISTDate(employee.joiningDate)}`
                          : (record?.officeAddress || (record?.isRemote ? `Remote (${record.distanceMeters ? `${Math.round(record.distanceMeters)}m` : 'WFH'})` : '—'))}
                      </td>
                      {/* Approver Column */}
                      <td className="py-3 px-4">
                        {record?.approvedBy || record?.regularizedBy ? (() => {
                          const appProf = orgProfiles.find((p) => p.id === (record.approvedBy || record.regularizedBy));
                          return (
                            <div className="flex items-center space-x-1.5 text-emerald-400 text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <div className="min-w-0">
                                <span className="font-bold text-white block truncate max-w-[120px]" title={appProf ? `${appProf.firstName} ${appProf.lastName}` : 'Approved'}>
                                  {appProf ? `${appProf.firstName} ${appProf.lastName?.[0]}.` : 'Manager'}
                                </span>
                                <span className="text-[9px] text-emerald-400/80 block uppercase font-mono font-bold">
                                  {appProf?.role || 'MGR'}
                                </span>
                              </div>
                            </div>
                          );
                        })() : status === 'pending_approval' ? (
                          <span className="text-[10px] text-amber-400 italic bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            Awaiting Approval
                          </span>
                        ) : record?.checkInTime ? (
                          <span className="text-[10px] text-cyan-400/80 font-mono">
                            Geo Verified
                          </span>
                        ) : (
                          <span className="text-[10px] text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5 justify-end">
                          {status === 'pending_approval' && record?.id && (isHrOrSuperadmin || (isManager && employee.managerId === currentProfile.id)) && (
                            <>
                              <button
                                type="button"
                                onClick={() => resolveRegularization(record.id, 'approved', `Approved by ${currentProfile.firstName}`)}
                                className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition flex items-center gap-1"
                                title="Approve Presence"
                              >
                                <Check className="w-3 h-3" />
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => resolveRegularization(record.id, 'rejected', `Rejected by ${currentProfile.firstName}`)}
                                className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold transition flex items-center gap-1"
                                title="Reject Presence"
                              >
                                <X className="w-3 h-3" />
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => {
                              setSelectedEmpId(employee.id);
                              setActiveViewTab('calendar');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[11px] font-bold transition"
                          >
                            Calendar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2B. REGULARIZATIONS MANAGEMENT & APPROVAL QUEUE (VIEW 3)                  */}
      {/* ========================================================================= */}
      {activeViewTab === 'regularizations' && (
        <div className="p-4 sm:p-6 space-y-5 animate-in fade-in duration-150">
          {/* Subheader & Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-card-subtle)] p-4 rounded-xl border border-[var(--border-color)]">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold shrink-0">
                <FileEdit className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Attendance Regularization Central
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Review employee miss-punch, field-visit, and absent-day regularization requests
                </p>
              </div>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-color)] shadow-xs">
              {(
                [
                  { key: 'all', label: 'All', count: regStats.all, color: 'bg-slate-500/20 text-slate-300' },
                  { key: 'pending', label: 'Pending', count: regStats.pending, color: 'bg-amber-500/20 text-amber-400' },
                  { key: 'approved', label: 'Approved', count: regStats.approved, color: 'bg-emerald-500/20 text-emerald-400' },
                  { key: 'rejected', label: 'Rejected', count: regStats.rejected, color: 'bg-rose-500/20 text-rose-400' }
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setRegFilterStatus(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                    regFilterStatus === tab.key
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      regFilterStatus === tab.key ? 'bg-white/20 text-white' : tab.color
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Search bar & Quick Direct Regularize action */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search employee, date, reason..."
                value={regSearchQuery}
                onChange={(e) => setRegSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-blue-500 shadow-xs"
              />
              {regSearchQuery && (
                <button
                  type="button"
                  onClick={() => setRegSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setRegularizingDay(todayIST)}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition flex items-center justify-center space-x-1.5 shadow-xs shrink-0 cursor-pointer"
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>+ Direct Regularize Day</span>
            </button>
          </div>

          {/* Regularizations Table */}
          <div className="overflow-x-auto rounded-xl border border-[var(--border-color)] shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-card-subtle)] border-b border-[var(--border-color)] text-[var(--text-muted)] uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Department & Designation</th>
                  <th className="py-3 px-4">Target Date (IST)</th>
                  <th className="py-3 px-4">Reason & Justification</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-card)]">
                {regularizationList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-xs text-[var(--text-muted)]">
                      <div className="max-w-xs mx-auto space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto opacity-40" />
                        <p className="font-semibold text-[var(--text-primary)]">No regularization records</p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {regFilterStatus === 'pending'
                            ? 'All attendance regularization requests have been cleared!'
                            : 'No records found matching the current filters.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  regularizationList.map((req) => {
                    const emp = orgProfiles.find((p) => p.id === req.employeeId);
                    const isSelf = req.employeeId === currentProfile.id;
                    const canApprove =
                      isHrOrSuperadmin ||
                      (isManager && emp?.managerId === currentProfile.id) ||
                      (isSelf && isHrOrSuperadmin);

                    return (
                      <tr key={req.id} className="hover:bg-[var(--bg-card-subtle)]/60 transition">
                        {/* Employee */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs overflow-hidden shrink-0">
                              {emp?.avatarUrl && emp.avatarUrl !== '/vedotrix-logo.png' ? (
                                <img src={emp.avatarUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span>{emp?.firstName?.[0] || 'U'}{emp?.lastName?.[0] || ''}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-[var(--text-primary)] block truncate">
                                {emp ? `${emp.firstName} ${emp.lastName}` : 'Employee'}
                              </span>
                              <span className="text-[10px] text-[var(--text-muted)] block truncate">{emp?.email}</span>
                            </div>
                          </div>
                        </td>

                        {/* Designation & Dept */}
                        <td className="py-3 px-4 text-[var(--text-secondary)]">
                          <span className="font-semibold text-[var(--text-primary)] block">
                            {emp?.designation || 'Staff'}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] block">
                            {emp?.department || 'Operations'} • <span className="uppercase font-bold">{emp?.role}</span>
                          </span>
                        </td>

                        {/* Target Date */}
                        <td className="py-3 px-4 font-mono">
                          <span className="font-bold text-[var(--text-primary)] block">
                            {formatISTDate(req.date)}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] block">
                            Shift: {currentOrg.settings?.shiftStartTime || '09:30'} - {currentOrg.settings?.shiftEndTime || '18:30'}
                          </span>
                        </td>

                        {/* Reason */}
                        <td className="py-3 px-4 max-w-sm">
                          <p className="text-[11px] text-[var(--text-primary)] leading-snug line-clamp-2">
                            {req.regularizationReason || 'No justification provided.'}
                          </p>
                          {req.regularizationNotes && (
                            <p className="text-[10px] text-[var(--text-muted)] mt-0.5 line-clamp-1 italic">
                              Note: {req.regularizationNotes}
                            </p>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-4">
                          {req.regularizationStatus === 'pending' ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              <Clock className="w-3 h-3" />
                              <span>Pending Review</span>
                            </span>
                          ) : req.regularizationStatus === 'approved' ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Approved</span>
                              </span>
                              {(() => {
                                const approver = orgProfiles.find((p) => p.id === (req.approvedBy || req.regularizedBy));
                                return approver ? (
                                  <span className="block text-[10px] text-emerald-400 font-medium truncate max-w-[140px]">
                                    by {approver.firstName} {approver.lastName} ({approver.role.toUpperCase()})
                                  </span>
                                ) : (
                                  <span className="block text-[10px] text-emerald-400/80 font-medium">
                                    by Manager/HR
                                  </span>
                                );
                              })()}
                            </div>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              <XCircle className="w-3 h-3" />
                              <span>Rejected</span>
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          {req.regularizationStatus === 'pending' ? (
                            canApprove ? (
                              <div className="inline-flex items-center space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => resolveRegularization(req.id, 'approved', `Approved by ${currentProfile.firstName}`)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition flex items-center space-x-1 shadow-xs cursor-pointer"
                                  title="Approve Presence"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => resolveRegularization(req.id, 'rejected', `Rejected by ${currentProfile.firstName}`)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-[11px] font-bold transition flex items-center space-x-1 cursor-pointer"
                                  title="Reject Request"
                                >
                                  <X className="w-3 h-3" />
                                  <span>Reject</span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-[var(--text-muted)] italic">
                                Awaiting Manager Approval
                              </span>
                            )
                          ) : req.regularizationStatus === 'approved' ? (
                            canApprove ? (
                              <button
                                type="button"
                                onClick={() => resolveRegularization(req.id, 'rejected', `Reverted to rejected by ${currentProfile.firstName}`)}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition"
                              >
                                Revoke Approval
                              </button>
                            ) : (
                              <span className="text-[10px] text-emerald-400 font-bold">✓ Closed</span>
                            )
                          ) : (
                            canApprove ? (
                              <button
                                type="button"
                                onClick={() => resolveRegularization(req.id, 'approved', `Re-approved by ${currentProfile.firstName}`)}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold text-[var(--text-muted)] hover:text-emerald-400 hover:bg-emerald-500/10 transition"
                              >
                                Re-Approve
                              </button>
                            ) : (
                              <span className="text-[10px] text-rose-400 font-bold">✗ Closed</span>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. DATE DETAILS POPUP MODAL (ON CLICKING ANY CALENDAR DAY CELL)           */}
      {/* ========================================================================= */}
      {selectedCalendarDay && (
        <div
          onClick={() => setSelectedCalendarDay(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-hidden animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-[var(--bg-card)] rounded-t-3xl sm:rounded-2xl border border-[var(--border-color)] shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-card-subtle)] shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/15 text-blue-500 flex items-center justify-center font-bold">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                    {formatISTDate(selectedCalendarDay.dateStr)}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Day Attendance & Shift Verification Record (IST)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCalendarDay(null)}
                className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] rounded-xl transition"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1 overscroll-contain">
              {/* Employee Header */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)]">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs overflow-hidden shrink-0">
                    {inspectedEmployee.avatarUrl && inspectedEmployee.avatarUrl !== '/vedotrix-logo.png' ? (
                      <img src={inspectedEmployee.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span>{inspectedEmployee.firstName[0]}{inspectedEmployee.lastName[0]}</span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[var(--text-primary)]">
                      {inspectedEmployee.firstName} {inspectedEmployee.lastName}
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {inspectedEmployee.designation} • {inspectedEmployee.department}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {inspectedEmployee.role}
                </span>
              </div>

              {/* Day Status Banner */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  selectedCalendarDay.status === 'present'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : selectedCalendarDay.status === 'regularized'
                    ? 'bg-teal-500/10 border-teal-500/30 text-teal-300'
                    : selectedCalendarDay.status === 'holiday'
                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                    : selectedCalendarDay.status === 'week_off'
                    ? 'bg-slate-800/40 border-slate-700/60 text-slate-300'
                    : selectedCalendarDay.status === 'leave'
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                    : selectedCalendarDay.status === 'pending'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : selectedCalendarDay.status === 'absent'
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    : selectedCalendarDay.status === 'pre_joining'
                    ? 'bg-slate-800/30 border-slate-700/40 text-slate-400'
                    : 'bg-slate-800/20 border-slate-700/40 text-slate-400'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <span className="text-base">
                    {selectedCalendarDay.status === 'present'
                      ? '✓'
                      : selectedCalendarDay.status === 'regularized'
                      ? '★'
                      : selectedCalendarDay.status === 'holiday'
                      ? '🎊'
                      : selectedCalendarDay.status === 'week_off'
                      ? '🏖️'
                      : selectedCalendarDay.status === 'leave'
                      ? '✈️'
                      : selectedCalendarDay.status === 'pending'
                      ? '⏳'
                      : selectedCalendarDay.status === 'absent'
                      ? '✗'
                      : selectedCalendarDay.status === 'pre_joining'
                      ? '⚪'
                      : '🗓️'}
                  </span>
                  <div>
                    <span className="font-extrabold block text-xs uppercase tracking-wide">
                      {selectedCalendarDay.status === 'present'
                        ? 'Present • Verified Punch'
                        : selectedCalendarDay.status === 'regularized'
                        ? 'Present • Regularized by Lead'
                        : selectedCalendarDay.status === 'holiday'
                        ? `Official Holiday: ${selectedCalendarDay.holiday?.name}`
                        : selectedCalendarDay.status === 'week_off'
                        ? 'Scheduled Team Week-Off'
                        : selectedCalendarDay.status === 'leave'
                        ? `Approved ${selectedCalendarDay.leave?.leaveType.toUpperCase()} Leave`
                        : selectedCalendarDay.status === 'pending'
                        ? 'Regularization Pending Approval'
                        : selectedCalendarDay.status === 'absent'
                        ? (selectedCalendarDay.punch?.regularizationStatus === 'rejected' || selectedCalendarDay.punch?.approvalStatus === 'rejected'
                            ? 'Regularization Rejected • Absent'
                            : 'Unmarked Shift • Marked as Absent')
                        : selectedCalendarDay.status === 'pre_joining'
                        ? 'Pre-Joining Period'
                        : 'Future Shift Scheduled'}
                    </span>
                    <span className="text-[10px] opacity-80">
                      {selectedCalendarDay.status === 'present'
                        ? `Total of ${selectedCalendarDay.punch?.totalHours || 8} hours logged`
                        : selectedCalendarDay.status === 'regularized'
                        ? `Attendance regularized with ${selectedCalendarDay.punch?.totalHours || 8} hours credited`
                        : selectedCalendarDay.status === 'week_off'
                        ? 'No attendance required as per organization shift schedule'
                        : selectedCalendarDay.status === 'holiday'
                        ? 'Mandatory paid corporate holiday'
                        : selectedCalendarDay.status === 'absent'
                        ? (selectedCalendarDay.punch?.regularizationStatus === 'rejected' || selectedCalendarDay.punch?.approvalStatus === 'rejected'
                            ? 'Regularization was rejected by manager/HR. Attendance is not approved and remains absent.'
                            : 'Shift completed without punch. Marked as absent until regularized by reporting lead or HR.')
                        : selectedCalendarDay.status === 'pre_joining'
                        ? `Employee joined on ${formatISTDate(inspectedEmployee.joiningDate)}. Attendance is only tracked from joining date onwards.`
                        : 'Scheduled according to corporate roster'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Shift & Biometric Geofence Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)]">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">
                    Check-In (IST)
                  </span>
                  <span className="text-sm font-extrabold text-[var(--text-primary)] font-mono">
                    {selectedCalendarDay.punch?.checkInTime
                      ? formatISTTime(selectedCalendarDay.punch.checkInTime)
                      : '—'}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                    Shift starts {currentOrg.settings?.shiftStartTime || '09:30'} IST
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)]">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">
                    Check-Out (IST)
                  </span>
                  <span className="text-sm font-extrabold text-[var(--text-primary)] font-mono">
                    {selectedCalendarDay.punch?.checkOutTime
                      ? formatISTTime(selectedCalendarDay.punch.checkOutTime)
                      : selectedCalendarDay.punch?.checkInTime
                      ? 'In Progress'
                      : '—'}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                    Shift ends {currentOrg.settings?.shiftEndTime || '18:30'} IST
                  </span>
                </div>
              </div>

              {/* Total Hours & Geolocation */}
              <div className="p-3.5 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)] space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
                  <span className="text-slate-400 font-medium">Shift Configuration:</span>
                  <span className="font-bold text-[var(--text-primary)] font-mono">
                    {currentOrg.settings?.shiftStartTime || '09:30'} - {currentOrg.settings?.shiftEndTime || '18:30'} IST ({currentOrg.settings?.workHoursPerDay || 8}h Shift)
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
                  <span className="text-slate-400 font-medium">Logged Work Duration:</span>
                  <span className="font-extrabold text-blue-400 font-mono">
                    {selectedCalendarDay.punch?.totalHours ? `${selectedCalendarDay.punch.totalHours} hrs` : '0.0 hrs'}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
                  <span className="text-slate-400 font-medium">Office Location & GPS:</span>
                  <span className="font-bold text-[var(--text-primary)] text-right truncate max-w-[220px]">
                    {selectedCalendarDay.punch?.officeAddress || currentOrg.address || 'Office Geofence'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Geofence Distance:</span>
                  <span className="font-bold text-[var(--text-primary)] font-mono">
                    {selectedCalendarDay.punch?.distanceMeters
                      ? `${selectedCalendarDay.punch.distanceMeters}m from center (verified)`
                      : selectedCalendarDay.punch?.isRemote
                      ? 'Remote (Approved WFH)'
                      : '—'}
                  </span>
                </div>
              </div>

              {/* Approver Details (Shown when approved/regularized) */}
              {(selectedCalendarDay.punch?.approvedBy || selectedCalendarDay.punch?.regularizedBy) && (() => {
                const approverId = selectedCalendarDay.punch.approvedBy || selectedCalendarDay.punch.regularizedBy;
                const approver = orgProfiles.find((p) => p.id === approverId);
                return (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider block text-emerald-400">
                          Attendance Approved & Verified
                        </span>
                        <p className="text-xs font-bold text-white mt-0.5 truncate">
                          Approved by: {approver ? `${approver.firstName} ${approver.lastName}` : 'Authorized Manager'}
                          <span className="ml-1.5 text-[10px] font-semibold text-emerald-300 px-1.5 py-0.2 rounded bg-emerald-500/20">
                            {approver?.role?.toUpperCase() || 'MANAGEMENT'}
                          </span>
                        </p>
                      </div>
                    </div>
                    {selectedCalendarDay.punch?.approvalNotes && (
                      <p className="text-[11px] text-emerald-400/90 mt-2 pt-2 border-t border-emerald-500/20">
                        <strong>Approval Notes:</strong> {selectedCalendarDay.punch.approvalNotes}
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Calendar Customization Controls (Superadmin & HR) */}
              {isHrOrSuperadmin && (
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-200 flex items-center space-x-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-blue-400" />
                      <span>Calendar Customization for {selectedCalendarDay.dateStr}</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-mono font-bold">
                      {selectedCalendarDay.isWeekOff ? 'Week-Off' : selectedCalendarDay.holiday ? 'Holiday' : 'Working Day'}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Change week-off or holiday classification for this employee ({inspectedEmployee.firstName}) or the entire organization on this date.
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleToggleDayWeekOff(selectedCalendarDay.dateStr, inspectedEmployee.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 transition flex items-center space-x-1 cursor-pointer"
                    >
                      <Coffee className="w-3.5 h-3.5 text-indigo-300" />
                      <span>
                        {selectedCalendarDay.isWeekOff ? 'Mark as Working Day 💼' : 'Set as Custom Week-Off ☕'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleHolidayForDate(selectedCalendarDay.dateStr)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 transition flex items-center space-x-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                      <span>
                        {selectedCalendarDay.holiday ? 'Remove Holiday ❌' : 'Declare Company Holiday 🎊'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Regularization Notes (if applicable: approved, pending, or rejected) */}
              {selectedCalendarDay.punch?.regularizationStatus && selectedCalendarDay.punch.regularizationStatus !== 'none' && (
                <div className={`p-3 rounded-xl border ${
                  selectedCalendarDay.punch.regularizationStatus === 'approved' || selectedCalendarDay.punch.approvalStatus === 'approved'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : selectedCalendarDay.punch.regularizationStatus === 'rejected' || selectedCalendarDay.punch.approvalStatus === 'rejected'
                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                }`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider block mb-1">
                    Regularization Details: {(selectedCalendarDay.punch.regularizationStatus || '').toUpperCase()}
                  </span>
                  <p className="text-[11px] leading-relaxed">
                    Reason: {selectedCalendarDay.punch.regularizationReason || 'No reason specified'}
                  </p>
                  {selectedCalendarDay.punch.regularizationNotes && (
                    <p className="text-[10px] mt-1 font-medium opacity-90">
                      Notes: {selectedCalendarDay.punch.regularizationNotes}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer with Direct Regularization Actions */}
            <div className="p-3.5 sm:p-4 border-t border-[var(--border-color)] flex flex-wrap items-center justify-between gap-2 bg-[var(--bg-card-subtle)] shrink-0">
              <div className="flex items-center flex-wrap gap-2">
                {/* 1. Request Regularization for Absent days (Employee self-service) */}
                {selectedCalendarDay.status === 'absent' && selectedEmpId === currentProfile.id && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onRequestRegularization) {
                        onRequestRegularization(selectedCalendarDay.punch?.id || null, selectedCalendarDay.dateStr);
                        setSelectedCalendarDay(null);
                      } else {
                        setRegularizingDay(selectedCalendarDay.dateStr);
                        setSelectedCalendarDay(null);
                      }
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center space-x-1.5 shadow-sm active:scale-98 cursor-pointer"
                  >
                    <FileEdit className="w-3.5 h-3.5" />
                    <span>Request Regularization</span>
                  </button>
                )}

                {/* 2. Direct Regularize for Employee / Self (Manager / HR / Superadmin action) */}
                {selectedCalendarDay.status === 'absent' && (isHrOrSuperadmin || (isManager && selectedEmpId !== currentProfile.id)) && (
                  <button
                    type="button"
                    onClick={() => {
                      setRegularizingDay(selectedCalendarDay.dateStr);
                      setSelectedCalendarDay(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition flex items-center space-x-1.5 shadow-sm active:scale-98 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{selectedEmpId === currentProfile.id ? 'Direct Regularize Day' : 'Regularize for Employee'}</span>
                  </button>
                )}

                {/* 3. Pending Review Actions (Manager / HR) */}
                {selectedCalendarDay.status === 'pending' && (isHrOrSuperadmin || isManager) && (
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedCalendarDay.punch?.id) {
                          resolveRegularization(selectedCalendarDay.punch.id, 'approved', 'Approved from Attendance Console');
                          setSelectedCalendarDay(null);
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center space-x-1 shadow-sm active:scale-98 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedCalendarDay.punch?.id) {
                          resolveRegularization(selectedCalendarDay.punch.id, 'rejected', 'Rejected from Attendance Console');
                          setSelectedCalendarDay(null);
                        }
                      }}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition flex items-center space-x-1 shadow-sm active:scale-98 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedCalendarDay(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--bg-card)] hover:bg-[var(--border-color)] text-[var(--text-primary)] border border-[var(--border-color)] transition shadow-xs cursor-pointer ml-auto"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SHIFT TIMING & ORGANIZATION CALENDAR CONFIGURATION (SUPERADMIN / HR)    */}
      {/* ========================================================================= */}
      {isShiftModalOpen && isHrOrSuperadmin && (
        <div
          onClick={() => setIsShiftModalOpen(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-hidden animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xl bg-[var(--bg-card)] rounded-t-3xl sm:rounded-2xl border border-[var(--border-color)] shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-card-subtle)] shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/15 text-blue-500 flex items-center justify-center font-bold">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                    Organization Shift & Calendar Console
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Configure shifts, employee week-offs & corporate holidays for {currentOrg.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsShiftModalOpen(false)}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs Navigation */}
            <div className="flex items-center px-4 pt-2.5 border-b border-[var(--border-color)] bg-[var(--bg-card)] gap-2 shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => setShiftModalTab('shift')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
                  shiftModalTab === 'shift'
                    ? 'border-blue-500 text-blue-500'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Shift Timings & Global Offs</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShiftModalTab('emp_weekoffs');
                  if (!selectedEmpForWeekOff && orgProfiles.length > 0) {
                    const firstEmp = orgProfiles[0].id;
                    setSelectedEmpForWeekOff(firstEmp);
                    const curEmpDays = currentOrg.settings?.employeeWeekOffs?.[firstEmp] || currentOrg.settings?.weekOffDays || [0];
                    setEmpWeekOffDays(curEmpDays);
                  }
                }}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
                  shiftModalTab === 'emp_weekoffs'
                    ? 'border-blue-500 text-blue-500'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Employee-Specific Week-Offs</span>
              </button>
              <button
                type="button"
                onClick={() => setShiftModalTab('holidays')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
                  shiftModalTab === 'holidays'
                    ? 'border-blue-500 text-blue-500'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Corporate Holidays ({orgHolidays.length})</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1 overscroll-contain">
              {/* TAB 1: SHIFT TIMINGS & GLOBAL WEEK-OFFS */}
              {shiftModalTab === 'shift' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">
                        Shift Start Time (IST) *
                      </label>
                      <input
                        type="time"
                        value={shiftStart}
                        onChange={(e) => setShiftStart(e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] font-mono text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">
                        Official punch-in window opens 30 min before
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">
                        Shift End Time (IST) *
                      </label>
                      <input
                        type="time"
                        value={shiftEnd}
                        onChange={(e) => setShiftEnd(e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] font-mono text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">
                        Shift ends; unrecorded shifts marked absent
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">
                        Grace Period (Minutes)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="120"
                        value={graceMins}
                        onChange={(e) => setGraceMins(Number(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] font-mono text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">
                        Late-login threshold
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">
                        Half-Day Threshold (Hours)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        max="12"
                        value={halfDayHours}
                        onChange={(e) => setHalfDayHours(Number(e.target.value) || 4.5)}
                        className="w-full px-3 py-2 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] font-mono text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">
                        Minimum hours for half day
                      </span>
                    </div>
                  </div>

                  {/* Standard Team Week-Offs */}
                  <div className="pt-2 border-t border-[var(--border-color)]">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--text-primary)]">
                          Default Organization Week-Offs
                        </label>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          Applies to team members without custom schedules
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setWeekOffs([0])}
                          className="text-[10px] text-blue-400 hover:underline font-semibold cursor-pointer"
                        >
                          Sunday Only
                        </button>
                        <span className="text-[var(--text-muted)]">•</span>
                        <button
                          type="button"
                          onClick={() => setWeekOffs([0, 6])}
                          className="text-[10px] text-blue-400 hover:underline font-semibold cursor-pointer"
                        >
                          Sat + Sun
                        </button>
                        <span className="text-[var(--text-muted)]">•</span>
                        <button
                          type="button"
                          onClick={() => setWeekOffs([])}
                          className="text-[10px] text-rose-400 hover:underline font-semibold cursor-pointer"
                        >
                          None
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {[
                        { name: 'Sun', day: 0 },
                        { name: 'Mon', day: 1 },
                        { name: 'Tue', day: 2 },
                        { name: 'Wed', day: 3 },
                        { name: 'Thu', day: 4 },
                        { name: 'Fri', day: 5 },
                        { name: 'Sat', day: 6 }
                      ].map(({ name, day }) => {
                        const isSelected = weekOffs.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setWeekOffs(weekOffs.filter((d) => d !== day));
                              } else {
                                setWeekOffs([...weekOffs, day].sort());
                              }
                            }}
                            className={`py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-[var(--bg-card-subtle)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: EMPLOYEE-SPECIFIC WEEK-OFFS */}
              {shiftModalTab === 'emp_weekoffs' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 space-y-1">
                    <p className="font-bold flex items-center space-x-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                      <span>Custom Employee Weekly Rosters (Synced with Live Supabase)</span>
                    </p>
                    <p className="text-[11px] text-blue-300/80 leading-relaxed">
                      Configure custom weekly off days for individual team members. These settings override organization defaults and synchronize directly to mobile and database.
                    </p>
                  </div>

                  {/* Summary of active custom configurations */}
                  {Object.keys(currentOrg.settings?.employeeWeekOffs || {}).length > 0 && (
                    <div className="p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)] space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                        Team Members with Custom Schedules ({Object.keys(currentOrg.settings?.employeeWeekOffs || {}).length}):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(currentOrg.settings?.employeeWeekOffs || {}).map(([id, days]) => {
                          const emp = orgProfiles.find((p) => p.id === id);
                          if (!emp || !Array.isArray(days) || days.length === 0) return null;
                          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                          const isCurrentlySelected = selectedEmpForWeekOff === id;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => {
                                setSelectedEmpForWeekOff(id);
                                setEmpWeekOffDays(days);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 border cursor-pointer ${
                                isCurrentlySelected
                                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                                  : 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)] hover:border-indigo-400'
                              }`}
                            >
                              <span>{emp.firstName}:</span>
                              <span className="text-indigo-200">{days.map((d) => dayNames[d]).join(', ')}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">
                      Select Team Member *
                    </label>
                    <select
                      value={selectedEmpForWeekOff || (orgProfiles[0]?.id || '')}
                      onChange={(e) => {
                        const empId = e.target.value;
                        setSelectedEmpForWeekOff(empId);
                        const cur = currentOrg.settings?.employeeWeekOffs?.[empId] || currentOrg.settings?.weekOffDays || [0];
                        setEmpWeekOffDays(cur);
                      }}
                      className="w-full px-3 py-2 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      {orgProfiles.map((p) => {
                        const hasCustom = Boolean(currentOrg.settings?.employeeWeekOffs?.[p.id]);
                        return (
                          <option key={p.id} value={p.id} className="bg-[var(--bg-card)] text-[var(--text-primary)]">
                            {p.firstName} {p.lastName} ({p.role.toUpperCase()} • {p.department}){hasCustom ? ' ★ [Custom Schedule]' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {(selectedEmpForWeekOff || orgProfiles[0]?.id) && (
                    <div className="space-y-3 pt-2 border-t border-[var(--border-color)]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="block text-[11px] font-bold text-[var(--text-primary)]">
                          Weekly Off Days for {orgProfiles.find((p) => p.id === (selectedEmpForWeekOff || orgProfiles[0]?.id))?.firstName || 'Employee'}:
                        </label>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => setEmpWeekOffDays([0])}
                            className="text-[10px] text-blue-400 hover:underline font-semibold cursor-pointer"
                          >
                            Sunday Only
                          </button>
                          <span className="text-[var(--text-muted)]">•</span>
                          <button
                            type="button"
                            onClick={() => setEmpWeekOffDays([0, 6])}
                            className="text-[10px] text-blue-400 hover:underline font-semibold cursor-pointer"
                          >
                            Sat + Sun
                          </button>
                          <span className="text-[var(--text-muted)]">•</span>
                          <button
                            type="button"
                            onClick={() => setEmpWeekOffDays([1])}
                            className="text-[10px] text-indigo-400 hover:underline font-semibold cursor-pointer"
                          >
                            Monday Only
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-1">
                        {[
                          { name: 'Sun', day: 0 },
                          { name: 'Mon', day: 1 },
                          { name: 'Tue', day: 2 },
                          { name: 'Wed', day: 3 },
                          { name: 'Thu', day: 4 },
                          { name: 'Fri', day: 5 },
                          { name: 'Sat', day: 6 }
                        ].map(({ name, day }) => {
                          const isSelected = empWeekOffDays.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setEmpWeekOffDays(empWeekOffDays.filter((d) => d !== day));
                                } else {
                                  setEmpWeekOffDays([...empWeekOffDays, day].sort());
                                }
                              }}
                              className={`py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                  : 'bg-[var(--bg-card-subtle)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              {name}
                            </button>
                          );
                        })}
                      </div>

                      <div className="pt-2 flex items-center justify-between">
                        {currentOrg.settings?.employeeWeekOffs?.[selectedEmpForWeekOff || orgProfiles[0]?.id] && (
                          <button
                            type="button"
                            onClick={handleResetEmployeeWeekOff}
                            disabled={isSavingShift}
                            className="px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-xl transition cursor-pointer"
                          >
                            Reset to Org Default
                          </button>
                        )}
                        <div className="ml-auto">
                          <button
                            type="button"
                            onClick={handleSaveEmployeeWeekOff}
                            disabled={isSavingShift}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-sm cursor-pointer flex items-center space-x-1.5"
                          >
                            <span>{isSavingShift ? 'Saving to Cloud...' : 'Save Employee Week-Off ✓'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: CORPORATE HOLIDAYS MANAGEMENT */}
              {shiftModalTab === 'holidays' && (
                <div className="space-y-4">
                  {/* Form to declare new holiday */}
                  <form onSubmit={handleAddNewHoliday} className="p-3.5 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)] space-y-3">
                    <span className="text-[11px] font-bold text-[var(--text-primary)] block">
                      + Declare Corporate Holiday / Paid Off Day
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-1">
                        <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Date *</label>
                        <input
                          type="date"
                          required
                          value={newHolidayDate}
                          onChange={(e) => setNewHolidayDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Holiday Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Diwali / Republic Day / Company Foundation Day"
                          value={newHolidayName}
                          onChange={(e) => setNewHolidayName(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center space-x-2">
                        <label className="text-[10px] font-semibold text-[var(--text-muted)]">Type:</label>
                        <select
                          value={newHolidayType}
                          onChange={(e) => setNewHolidayType(e.target.value as any)}
                          className="px-2 py-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[11px] text-[var(--text-primary)]"
                        >
                          <option value="public">Official Public / National Holiday</option>
                          <option value="optional">Optional / Floating Holiday</option>
                          <option value="restricted">Restricted Company Off</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        disabled={isSavingHoliday || !newHolidayName.trim() || !newHolidayDate}
                        className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer flex items-center space-x-1"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isSavingHoliday ? 'Declaring...' : 'Add Holiday'}</span>
                      </button>
                    </div>
                  </form>

                  {/* Existing Holidays List */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-[var(--text-primary)] block">
                      Scheduled Organization Holidays ({orgHolidays.length})
                    </span>
                    <div className="divide-y divide-[var(--border-color)] rounded-xl border border-[var(--border-color)] overflow-hidden bg-[var(--bg-card)] max-h-56 overflow-y-auto">
                      {orgHolidays.length === 0 ? (
                        <div className="p-4 text-center text-xs text-[var(--text-muted)]">
                          No official corporate holidays configured.
                        </div>
                      ) : (
                        orgHolidays
                          .sort((a, b) => a.date.localeCompare(b.date))
                          .map((h) => (
                            <div key={h.id} className="p-2.5 flex items-center justify-between gap-2 hover:bg-[var(--bg-card-subtle)] transition text-xs">
                              <div className="flex items-center space-x-2.5 min-w-0">
                                <span className="font-mono font-bold text-blue-400 text-[11px] shrink-0 bg-blue-500/10 px-2 py-0.5 rounded">
                                  {h.date}
                                </span>
                                <div className="truncate">
                                  <span className="font-bold text-[var(--text-primary)] block truncate">
                                    {h.name}
                                  </span>
                                  <span className="text-[10px] text-[var(--text-muted)] uppercase">
                                    {h.type || 'Public'}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteHoliday(h.id);
                                  addToast('Holiday Removed', `Removed ${h.name} from calendar.`, 'info');
                                }}
                                className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition cursor-pointer shrink-0"
                                title="Delete Holiday"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 border-t border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-card-subtle)] shrink-0">
              <span className="text-[11px] text-[var(--text-muted)]">
                Syncs dynamically with Supabase & Mobile Apps
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsShiftModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--border-color)] transition cursor-pointer"
                >
                  Close
                </button>
                {shiftModalTab === 'shift' && (
                  <button
                    type="button"
                    disabled={isSavingShift}
                    onClick={handleSaveShiftSettings}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    <span>{isSavingShift ? 'Saving...' : 'Save Shift Settings'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. INLINE REGULARIZATION REQUEST MODAL (FOR ABSENT / UNMARKED SHIFTS)     */}
      {/* ========================================================================= */}
      {regularizingDay && (
        <div
          onClick={() => setRegularizingDay(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-hidden animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-[var(--bg-card)] rounded-t-3xl sm:rounded-2xl border border-[var(--border-color)] shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
          >
            <div className="p-4 sm:p-5 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-card-subtle)] shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold">
                  <FileEdit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                    Attendance Regularization
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Target Date: <span className="font-mono font-bold text-[var(--text-primary)]">{formatISTDate(regularizingDay)}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRegularizingDay(null)}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!regReason.trim()) return;
                setIsSubmittingReg(true);
                try {
                  const fullReason = `[${regCategory}] Shift Hours: ${regInTime} - ${regOutTime} IST. Justification: ${regReason.trim()}`;
                  // If HR / Superadmin is regularizing (can regularize anyone including self), or Manager for reportee:
                  const isDirectApprover = isHrOrSuperadmin || (isManager && selectedEmpId !== currentProfile.id);
                  if (isDirectApprover) {
                    const existing = attendanceRecords.find((a) => a.employeeId === inspectedEmployee.id && a.date === regularizingDay);
                    if (existing) {
                      resolveRegularization(existing.id, 'approved', `Directly regularized by ${currentProfile.firstName} (${currentProfile.role.toUpperCase()}): ${fullReason}`);
                    } else {
                      // Insert approved record directly
                      const { getSupabaseClient } = await import('../lib/supabaseClient');
                      const client = getSupabaseClient();
                      const newId = crypto.randomUUID ? crypto.randomUUID() : `reg-${Date.now()}`;
                      await client.from('attendance').insert({
                        id: newId,
                        org_id: currentOrg.id,
                        employee_id: inspectedEmployee.id,
                        date: regularizingDay,
                        status: 'present',
                        is_remote: false,
                        total_hours: currentOrg.settings?.workHoursPerDay || 8,
                        regularization_status: 'approved',
                        approval_status: 'approved',
                        regularization_reason: fullReason,
                        regularized_by: currentProfile.id,
                        approved_by: currentProfile.id
                      });
                      addToast('Attendance Regularized ✅', `Presence record approved for ${inspectedEmployee.firstName}.`, 'success');
                    }
                  } else {
                    // Employee requesting for themselves
                    requestRegularization(regularizingDay, fullReason, regularizingDay);
                  }
                  setRegularizingDay(null);
                  setRegReason('');
                } catch (err: any) {
                  addToast('Regularization Error', err?.message || 'Could not regularize attendance.', 'error');
                } finally {
                  setIsSubmittingReg(false);
                }
              }}
              className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1 overscroll-contain"
            >
              <div>
                <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">
                  Regularization Reason Category *
                </label>
                <select
                  value={regCategory}
                  onChange={(e) => setRegCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-xs font-semibold focus:outline-none focus:border-blue-500"
                >
                  <option value="Missed Punch-In / Punch-Out">Missed Punch-In / Punch-Out (Forgot to record)</option>
                  <option value="Client On-Site Visit">Client On-Site Visit / Field Work</option>
                  <option value="Approved Work-From-Home">Approved Work-From-Home (WFH)</option>
                  <option value="Biometric / Network Glitch">Biometric / GPS Glitch</option>
                  <option value="Official Travel">Official Travel / Corporate Conference</option>
                  <option value="Medical / Family Emergency">Medical / Emergency Reporting</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">
                    Shift In Time (IST)
                  </label>
                  <input
                    type="time"
                    required
                    value={regInTime}
                    onChange={(e) => setRegInTime(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] font-mono text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">
                    Shift Out Time (IST)
                  </label>
                  <input
                    type="time"
                    required
                    value={regOutTime}
                    onChange={(e) => setRegOutTime(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] font-mono text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">
                  Detailed Justification / Official Remarks *
                </label>
                <textarea
                  required
                  rows={3}
                  value={regReason}
                  onChange={(e) => setRegReason(e.target.value)}
                  placeholder="e.g. Completed scheduled work sprint at office. Missed biometric punch out due to client meeting at departure."
                  className="w-full px-3 py-2 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-xs focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 space-y-1">
                <span className="font-bold block text-[11px]">Notice:</span>
                <p className="text-[10px] leading-relaxed">
                  Upon approval, this day will transition from <strong>Absent</strong> to <strong>Present (Regularized)</strong> with official working hours credited.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setRegularizingDay(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--border-color)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReg || !regReason.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <span>{isSubmittingReg ? 'Submitting...' : selectedEmpId === currentProfile.id ? 'Submit Request' : 'Regularize Immediately'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. SET / EDIT JOINING DATE MODAL (SUPERADMIN / HR ONLY)                   */}
      {/* ========================================================================= */}
      {isEditingJoiningDate && isHrOrSuperadmin && (
        <div
          onClick={() => setIsEditingJoiningDate(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-hidden animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
          >
            <div className="p-4 sm:p-5 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-card-subtle)] shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/15 text-blue-500 flex items-center justify-center font-bold">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                    Official Joining Date
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Employee: {inspectedEmployee.firstName} {inspectedEmployee.lastName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditingJoiningDate(false)}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editingJoiningDateVal) return;
                setIsSavingJoiningDate(true);
                try {
                  await updateProfile(inspectedEmployee.id, { joiningDate: editingJoiningDateVal });
                  addToast('Joining Date Updated 📅', `Official joining date set to ${editingJoiningDateVal} for ${inspectedEmployee.firstName}.`, 'success');
                  setIsEditingJoiningDate(false);
                } catch (err: any) {
                  addToast('Update Failed', err?.message || 'Could not update joining date.', 'error');
                } finally {
                  setIsSavingJoiningDate(false);
                }
              }}
              className="p-5 space-y-4 text-xs"
            >
              <div>
                <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">
                  Select Official Joining Date (IST) *
                </label>
                <input
                  type="date"
                  required
                  value={editingJoiningDateVal}
                  onChange={(e) => setEditingJoiningDateVal(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] font-mono text-xs font-semibold focus:outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-[var(--text-muted)] mt-1 block leading-relaxed">
                  Configured strictly by HR / Superadmin. Attendance records, absent flags, and working day percentages will calculate strictly from this date onwards.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditingJoiningDate(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--border-color)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingJoiningDate || !editingJoiningDateVal}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <span>{isSavingJoiningDate ? 'Saving...' : 'Save Joining Date'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ATTENDANCE REPORT PDF EXPORT MODAL (FOR HR / SUPERADMIN / MANAGERS)       */}
      {/* ========================================================================= */}
      {isReportModalOpen && (isHrOrSuperadmin || isManager) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => !isGeneratingPdf && setIsReportModalOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl p-5 sm:p-6 z-10 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Generate Attendance Audit PDF Report
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Official corporate attendance register with digital authentication
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isGeneratingPdf && setIsReportModalOpen(false)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border-color)] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Managed Scope Indicator */}
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                <span>
                  <strong>Authorized Scope:</strong> {isManager ? `Your Managed Direct Reports (${managedTeam.length} Staff)` : `Organization Roster (${managedTeam.length} Active Staff)`}
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold uppercase">
                {currentProfile.role}
              </span>
            </div>

            {/* Report Type Selector Tabs */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                Select Report Cadence *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'daily', label: 'Daily Report', sub: 'Single shift audit', icon: Calendar },
                  { key: 'weekly', label: 'Weekly Summary', sub: '7-day register', icon: CalendarDays },
                  { key: 'monthly', label: 'Monthly Register', sub: 'Full month audit', icon: FileSpreadsheet }
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setReportType(item.key as any)}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      reportType === item.key
                        ? 'bg-blue-600/15 border-blue-500 text-blue-400 font-bold shadow-xs'
                        : 'bg-[var(--bg-card-subtle)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold">{item.label}</span>
                      <item.icon className="w-3.5 h-3.5 opacity-70" />
                    </div>
                    <span className="text-[10px] opacity-75 font-normal">{item.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Date / Month Controls */}
            {reportType === 'daily' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[var(--text-muted)] block">
                  Report Date (IST) *
                </label>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl text-xs font-mono font-bold text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-[var(--text-muted)] block">
                  Captures check-in, check-out, geofence verification, punch status, and approver/rejection notes for {formatISTDate(reportDate)}.
                </span>
              </div>
            )}

            {reportType === 'weekly' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[var(--text-muted)] block">
                  Week Ending Date (IST) *
                </label>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl text-xs font-mono font-bold text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-[var(--text-muted)] block">
                  Generates 7-day attendance matrix ending on {formatISTDate(reportDate)} with day-wise hours and presence metrics.
                </span>
              </div>
            )}

            {reportType === 'monthly' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[var(--text-muted)] block">
                  Select Month & Year *
                </label>
                <input
                  type="month"
                  value={reportMonthYear}
                  onChange={(e) => setReportMonthYear(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl text-xs font-mono font-bold text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-[var(--text-muted)] block">
                  Full statutory register for {reportMonthYear} including working days, verified punch, regularized, leaves, absent, and presence %.
                </span>
              </div>
            )}

            {/* Corporate Digital Stamping Notice */}
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 text-[11px] text-slate-300 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-slate-200">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Certified Corporate PDF Export Features</span>
              </div>
              <ul className="list-disc list-inside text-[10px] text-slate-400 space-y-0.5">
                <li>Official {currentOrg.name} logo & letterhead branding</li>
                <li>Digital security stamp with timestamp & signatory authentication</li>
                <li>Light background watermark with company seal</li>
                <li>Detailed audit status (Compliant vs Attention Required)</li>
              </ul>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end space-x-2.5">
              <button
                type="button"
                disabled={isGeneratingPdf}
                onClick={() => setIsReportModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--border-color)] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isGeneratingPdf}
                onClick={handleGenerateAttendancePDF}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition flex items-center space-x-1.5 shadow-md disabled:opacity-50 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download Official PDF'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
