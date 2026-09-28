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
  X
} from 'lucide-react';
import { getTodayISTDateString, formatISTTime, formatISTDate } from '../lib/serialUtils';
import { AttendanceRecord, Profile, TaskItem, DailyStandup, Holiday, LeaveRequest } from '../types';

export const DailyAttendanceTracker: React.FC = () => {
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
  // For managers/HR/superadmin: can toggle between 'calendar' (monthly calendar + work PR profile) and 'daily_roster' (team daily attendance)
  // For employees: strictly 'calendar'
  const [activeViewTab, setActiveViewTab] = useState<'calendar' | 'daily_roster'>('calendar');

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

  // Calendar Days calculation
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay();

    const daysArray = [];

    // Week-off configuration (default [0] = Sunday)
    const weekOffDays = currentOrg.settings?.weekOffDays || [0];

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

      let status: 'holiday' | 'week_off' | 'leave' | 'present' | 'pending' | 'absent' | 'future' = 'future';

      if (holiday) {
        status = 'holiday';
      } else if (isWeekOff) {
        status = 'week_off';
      } else if (leave) {
        status = 'leave';
      } else if (punch) {
        if (punch.regularizationStatus === 'pending' || punch.approvalStatus === 'pending_manager_approval') {
          status = 'pending';
        } else {
          status = 'present';
        }
      } else if (isPast) {
        status = 'absent';
      } else {
        status = 'future';
      }

      daysArray.push({
        day,
        dateStr,
        dayOfWeek,
        isWeekOff,
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
  }, [currentYear, currentMonth, currentOrg.settings, orgHolidays, employeeLeaves, employeeMonthPunches, todayIST]);

  // Monthly summary metrics
  const monthlyMetrics = useMemo(() => {
    const list = calendarDays.daysArray;
    const totalDays = list.length;
    const holidaysCount = list.filter((d) => d.status === 'holiday').length;
    const weekOffsCount = list.filter((d) => d.status === 'week_off').length;
    const workingDays = Math.max(0, totalDays - holidaysCount - weekOffsCount);
    const presentCount = list.filter((d) => d.status === 'present').length;
    const leavesCount = list.filter((d) => d.status === 'leave').length;
    const pendingCount = list.filter((d) => d.status === 'pending').length;
    const absentCount = list.filter((d) => d.status === 'absent').length;

    const workingDaysSoFar = list.filter((d) => (d.isPast || d.isToday) && !d.isWeekOff && !d.holiday).length;
    const attendancePercentage = workingDaysSoFar > 0
      ? Math.min(100, Math.round(((presentCount + leavesCount * 0.5) / workingDaysSoFar) * 100))
      : 100;

    return {
      totalDays,
      workingDays,
      workingDaysSoFar,
      holidaysCount,
      weekOffsCount,
      presentCount,
      leavesCount,
      pendingCount,
      absentCount,
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
                <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                  {inspectedEmployee.designation || 'Staff'} • {inspectedEmployee.department} • Joined: {formatISTDate(inspectedEmployee.joiningDate)}
                </p>
              </div>
            </div>

            {/* Quick Performance & Attendance Chips */}
            <div className="flex items-center flex-wrap gap-2.5">
              <div className="px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center shadow-xs">
                <span className="text-[10px] text-[var(--text-muted)] block font-semibold">Attendance Rate</span>
                <span className="text-sm font-extrabold text-emerald-400 font-mono">
                  {monthlyMetrics.attendancePercentage}%
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center shadow-xs">
                <span className="text-[10px] text-[var(--text-muted)] block font-semibold">Days Present</span>
                <span className="text-sm font-extrabold text-blue-400 font-mono">
                  {monthlyMetrics.presentCount} / {monthlyMetrics.workingDays}
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center shadow-xs">
                <span className="text-[10px] text-[var(--text-muted)] block font-semibold">Logged Hours</span>
                <span className="text-sm font-extrabold text-indigo-400 font-mono">
                  {totalStandupHours} hrs
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center shadow-xs">
                <span className="text-[10px] text-[var(--text-muted)] block font-semibold">Tasks Done</span>
                <span className="text-sm font-extrabold text-amber-400 font-mono">
                  {taskStats.done} / {taskStats.total}
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
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Holiday
              </span>
              <span className="inline-flex items-center gap-1 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500" /> Week-Off
              </span>
              <span className="inline-flex items-center gap-1 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Approved Leave
              </span>
              <span className="inline-flex items-center gap-1 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Pending Approval
              </span>
              <span className="inline-flex items-center gap-1 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Absent / Unmarked
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

                      {status === 'pending' && punch && (
                        <div className="p-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300">
                          <span className="block text-[9px] font-bold truncate">
                            ⏳ Pending
                          </span>
                          <span className="block text-[8px] opacity-75 truncate">
                            Approval Req.
                          </span>
                        </div>
                      )}

                      {status === 'absent' && (
                        <div className="p-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
                          <span className="block text-[9px] font-semibold truncate">
                            ✗ Unmarked
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
      {/* 3. DATE DETAILS POPUP MODAL (ON CLICKING ANY CALENDAR DAY CELL)           */}
      {/* ========================================================================= */}
      {selectedCalendarDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] shadow-2xl overflow-hidden my-6">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-card-subtle)]">
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
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
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
                    : 'bg-slate-800/20 border-slate-700/40 text-slate-400'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <span className="text-base">
                    {selectedCalendarDay.status === 'present'
                      ? '✓'
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
                      : '🗓️'}
                  </span>
                  <div>
                    <span className="font-extrabold block text-xs uppercase tracking-wide">
                      {selectedCalendarDay.status === 'present'
                        ? 'Present • Verified Punch'
                        : selectedCalendarDay.status === 'holiday'
                        ? `Official Holiday: ${selectedCalendarDay.holiday?.name}`
                        : selectedCalendarDay.status === 'week_off'
                        ? 'Scheduled Team Week-Off'
                        : selectedCalendarDay.status === 'leave'
                        ? `Approved ${selectedCalendarDay.leave?.leaveType.toUpperCase()} Leave`
                        : selectedCalendarDay.status === 'pending'
                        ? 'Regularization Pending Approval'
                        : selectedCalendarDay.status === 'absent'
                        ? 'Unmarked / Absent Day'
                        : 'Future Shift Scheduled'}
                    </span>
                    <span className="text-[10px] opacity-80">
                      {selectedCalendarDay.status === 'present'
                        ? `Total of ${selectedCalendarDay.punch?.totalHours || 8} hours logged`
                        : selectedCalendarDay.status === 'week_off'
                        ? 'No attendance required as per organization shift schedule'
                        : selectedCalendarDay.status === 'holiday'
                        ? 'Mandatory paid corporate holiday'
                        : selectedCalendarDay.status === 'absent'
                        ? 'Punch-in was not recorded within official shift timings'
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
              {selectedCalendarDay.punch?.regularizationStatus && selectedCalendarDay.punch.regularizationStatus !== 'none' && (
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

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--border-color)] flex items-center justify-end space-x-2 bg-[var(--bg-card-subtle)]">
              <button
                type="button"
                onClick={() => setSelectedCalendarDay(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--bg-card)] hover:bg-[var(--border-color)] text-[var(--text-primary)] transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SHIFT TIMING & WEEK-OFF CONFIGURATION MODAL (SUPERADMIN / HR ONLY)      */}
      {/* ========================================================================= */}
      {isShiftModalOpen && isHrOrSuperadmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] shadow-2xl overflow-hidden my-6">
            <div className="p-4 sm:p-5 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-card-subtle)]">
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

            <div className="p-5 space-y-4 text-xs">
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

            <div className="p-4 border-t border-[var(--border-color)] flex items-center justify-end space-x-2 bg-[var(--bg-card-subtle)]">
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
    </div>
  );
};
