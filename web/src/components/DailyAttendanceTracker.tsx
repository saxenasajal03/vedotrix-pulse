import React, { useState, useMemo } from 'react';
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
  Send
} from 'lucide-react';
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

  // Pending regularizations count for badge & tab
  const pendingRegularizationsCount = useMemo(() => {
    if (isHrOrSuperadmin) {
      return attendanceRecords.filter((a) => a.regularizationStatus === 'pending').length;
    }
    const reportIds = new Set(selectableEmployees.map((m) => m.id));
    return attendanceRecords.filter((a) => a.regularizationStatus === 'pending' && reportIds.has(a.employeeId)).length;
  }, [attendanceRecords, isHrOrSuperadmin, selectableEmployees]);

  // Regularizations queue filter states
  const [regFilterStatus, setRegFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [regSearchQuery, setRegSearchQuery] = useState('');

  // Date Popup on Click
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<any | null>(null);

  // Shift & Week-Off Configuration Modal (Superadmin / HR only)
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [shiftStart, setShiftStart] = useState(currentOrg.settings?.shiftStartTime || '10:00');
  const [shiftEnd, setShiftEnd] = useState(currentOrg.settings?.shiftEndTime || '19:00');
  const [graceMins, setGraceMins] = useState(currentOrg.settings?.gracePeriodMins || 15);
  const [halfDayHours, setHalfDayHours] = useState(currentOrg.settings?.halfDayThresholdHours || 4.5);
  const [weekOffs, setWeekOffs] = useState<number[]>(currentOrg.settings?.weekOffDays || [0]);
  const [isSavingShift, setIsSavingShift] = useState(false);

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

  const handleSaveShiftSettings = async () => {
    setIsSavingShift(true);
    try {
      await updateOrganization(currentOrg.id, {
        settings: {
          ...currentOrg.settings,
          shiftStartTime: shiftStart,
          shiftEndTime: shiftEnd,
          gracePeriodMins: Number(graceMins) || 15,
          halfDayThresholdHours: Number(halfDayHours) || 4.5,
          weekOffDays: weekOffs
        }
      });
      addToast('Shift & Week-Offs Saved ⚙️', 'Configured shift timing & weekly holidays applied dynamically across the team.', 'success');
      setIsShiftModalOpen(false);
    } catch (err) {
      addToast('Error', 'Could not update shift timing.', 'error');
    } finally {
      setIsSavingShift(false);
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

  // Attendance records for inspected employee in this month
  const employeeMonthPunches = useMemo(() => {
    return attendanceRecords.filter(
      (a) => a.employeeId === inspectedEmployee.id && a.date.startsWith(monthPrefix)
    );
  }, [attendanceRecords, inspectedEmployee.id, monthPrefix]);

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

    // Week-off configuration (default [0] = Sunday)
    const weekOffDays = currentOrg.settings?.weekOffDays || [0];
    const joiningDateStr = inspectedEmployee.joiningDate || '';

    // Shift timing calculation for today (IST)
    const [shiftEndH, shiftEndM] = (currentOrg.settings?.shiftEndTime || '18:30').split(':').map(Number);
    const shiftEndMins = (shiftEndH || 18) * 60 + (shiftEndM || 30);
    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const currentTotalMins = nowIST.getHours() * 60 + nowIST.getMinutes();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = new Date(currentYear, currentMonth - 1, day).getDay();
      const isWeekOff = weekOffDays.includes(dayOfWeek);

      const holiday = orgHolidays.find((h) => h.date === dateStr);

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
        if (punch.regularizationStatus === 'pending' || punch.approvalStatus === 'pending_manager_approval') {
          status = 'pending';
        } else if (punch.status === 'regularized' || (!punch.checkInTime && punch.regularizationStatus === 'approved')) {
          // Only true absent-day regularizations without punch-in are tagged regularized
          status = 'regularized';
        } else if (punch.status === 'absent' && punch.regularizationStatus !== 'approved') {
          status = 'absent';
        } else {
          // Standard punch-in or verified presence
          status = 'present';
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
  }, [currentYear, currentMonth, currentOrg.settings, orgHolidays, employeeLeaves, employeeMonthPunches, todayIST, inspectedEmployee.joiningDate]);

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
  const [rosterFilterTab, setRosterFilterTab] = useState<'all' | 'present' | 'not_marked' | 'on_leave'>('all');
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

  const rosterEmployeeData = useMemo(() => {
    return managedTeam.map((emp) => {
      const record = attendanceRecords.find(
        (a) => a.employeeId === emp.id && a.date === selectedRosterDate
      );
      const leave = leaveRequests.find(
        (l) =>
          l.employeeId === emp.id &&
          (l.status === 'approved' || l.status === 'pending') &&
          l.startDate <= selectedRosterDate &&
          l.endDate >= selectedRosterDate
      );

      let status: 'present' | 'on_leave' | 'not_marked' = 'not_marked';
      if (record && (record.status === 'present' || record.status === 'regularized' || record.status === 'half_day')) {
        status = 'present';
      } else if (leave) {
        status = 'on_leave';
      }

      return { employee: emp, record, leave, status };
    });
  }, [managedTeam, attendanceRecords, leaveRequests, selectedRosterDate]);

  const filteredRosterData = useMemo(() => {
    return rosterEmployeeData.filter(({ employee, status }) => {
      if (rosterFilterTab === 'present' && status !== 'present') return false;
      if (rosterFilterTab === 'on_leave' && status !== 'on_leave') return false;
      if (rosterFilterTab === 'not_marked' && status !== 'not_marked') return false;
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
    const headers = ['Employee Name', 'Email', 'Role', 'Department', 'Date', 'Status', 'Check-In Time', 'Location / Office', 'Distance (m)', 'Leave Type'];
    const rows = filteredRosterData.map(({ employee, record, leave, status }) => {
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
        leave ? `"${leave.leaveType.toUpperCase()} (${leave.status})"` : 'N/A'
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

  const departments = useMemo(() => {
    return Array.from(new Set(managedTeam.map((p) => p.department).filter(Boolean)));
  }, [managedTeam]);

  // Regularization records memo for View 3
  const regularizationList = useMemo(() => {
    const allowedEmpIds = isHrOrSuperadmin ? null : new Set(managedTeam.map((m) => m.id));

    return attendanceRecords
      .filter((a) => {
        if (!a.regularizationStatus || a.regularizationStatus === 'none') return false;
        if (allowedEmpIds && !allowedEmpIds.has(a.employeeId)) return false;
        if (regFilterStatus !== 'all' && a.regularizationStatus !== regFilterStatus) return false;
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
      if (!a.regularizationStatus || a.regularizationStatus === 'none') return false;
      if (allowedEmpIds && !allowedEmpIds.has(a.employeeId)) return false;
      return true;
    });
    return {
      all: allRegs.length,
      pending: allRegs.filter((a) => a.regularizationStatus === 'pending').length,
      approved: allRegs.filter((a) => a.regularizationStatus === 'approved').length,
      rejected: allRegs.filter((a) => a.regularizationStatus === 'rejected').length
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
            </div>
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
                  <th className="py-3 px-4">Inspection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {filteredRosterData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-[var(--text-muted)]">
                      No team members found for this date.
                    </td>
                  </tr>
                ) : (
                  filteredRosterData.map(({ employee, record, leave, status }) => (
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
                        ) : status === 'on_leave' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            ✈️ Leave ({leave?.leaveType})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            ✗ Not Marked
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {record?.checkInTime ? formatISTTime(record.checkInTime) : '—'}
                      </td>
                      <td className="py-3 px-4 truncate max-w-xs text-[var(--text-muted)]">
                        {record?.officeAddress || (record?.isRemote ? 'Remote (WFH)' : '—')}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => {
                            setSelectedEmpId(employee.id);
                            setActiveViewTab('calendar');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[11px] font-bold transition"
                        >
                          View Calendar
                        </button>
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
                            Shift: {currentOrg.settings?.shiftStartTime || '10:00'} - {currentOrg.settings?.shiftEndTime || '19:00'}
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
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Approved</span>
                            </span>
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
                        ? 'Unmarked Shift • Marked as Absent'
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
                        ? 'Shift completed without punch. Marked as absent until regularized by reporting lead or HR.'
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
                    Shift starts {currentOrg.settings?.shiftStartTime || '10:00'} IST
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
                    Shift ends {currentOrg.settings?.shiftEndTime || '19:00'} IST
                  </span>
                </div>
              </div>

              {/* Total Hours & Geolocation */}
              <div className="p-3.5 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)] space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
                  <span className="text-slate-400 font-medium">Shift Configuration:</span>
                  <span className="font-bold text-[var(--text-primary)] font-mono">
                    {currentOrg.settings?.shiftStartTime || '10:00'} - {currentOrg.settings?.shiftEndTime || '19:00'} IST ({currentOrg.settings?.workHoursPerDay || 8}h Shift)
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

              {/* Regularization Notes (if applicable) */}
              {(selectedCalendarDay.status === 'regularized' || selectedCalendarDay.status === 'pending') && selectedCalendarDay.punch?.regularizationStatus && selectedCalendarDay.punch.regularizationStatus !== 'none' && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
                  <span className="text-[10px] font-bold uppercase tracking-wider block mb-1">
                    Regularization Details ({selectedCalendarDay.punch.regularizationStatus})
                  </span>
                  <p className="text-[11px] leading-relaxed">
                    Reason: {selectedCalendarDay.punch.regularizationReason || 'No reason specified'}
                  </p>
                  {selectedCalendarDay.punch.regularizationNotes && (
                    <p className="text-[10px] text-amber-400/80 mt-1">
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
      {/* 4. SHIFT TIMING & WEEK-OFF CONFIGURATION MODAL (SUPERADMIN / HR ONLY)      */}
      {/* ========================================================================= */}
      {isShiftModalOpen && isHrOrSuperadmin && (
        <div
          onClick={() => setIsShiftModalOpen(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-hidden animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-[var(--bg-card)] rounded-t-3xl sm:rounded-2xl border border-[var(--border-color)] shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
          >
            <div className="p-4 sm:p-5 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-card-subtle)] shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/15 text-blue-500 flex items-center justify-center font-bold">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                    Team Shift Timings & Week-Offs
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Configure official shift hours & weekly off days for {currentOrg.name}
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

            <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1 overscroll-contain">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">
                    Shift Start Time (IST)
                  </label>
                  <input
                    type="time"
                    value={shiftStart}
                    onChange={(e) => setShiftStart(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] font-mono text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">
                    Shift End Time (IST)
                  </label>
                  <input
                    type="time"
                    value={shiftEnd}
                    onChange={(e) => setShiftEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] font-mono text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
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
                </div>
              </div>

              {/* Week-Off Days */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold text-[var(--text-primary)]">
                    Scheduled Team Week-Offs
                  </label>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setWeekOffs([0])}
                      className="text-[10px] text-blue-400 hover:underline font-semibold"
                    >
                      Sunday Only
                    </button>
                    <span className="text-[var(--text-muted)]">•</span>
                    <button
                      type="button"
                      onClick={() => setWeekOffs([0, 6])}
                      className="text-[10px] text-blue-400 hover:underline font-semibold"
                    >
                      Sat + Sun
                    </button>
                    <span className="text-[var(--text-muted)]">•</span>
                    <button
                      type="button"
                      onClick={() => setWeekOffs([])}
                      className="text-[10px] text-rose-400 hover:underline font-semibold"
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
                        className={`py-2 rounded-xl text-xs font-bold transition border ${
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

            <div className="p-3.5 sm:p-4 border-t border-[var(--border-color)] flex items-center justify-end space-x-2 bg-[var(--bg-card-subtle)] shrink-0">
              <button
                type="button"
                onClick={() => setIsShiftModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--border-color)] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingShift}
                onClick={handleSaveShiftSettings}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
              >
                <span>{isSavingShift ? 'Saving...' : 'Save Shift Settings'}</span>
              </button>
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
    </div>
  );
};
