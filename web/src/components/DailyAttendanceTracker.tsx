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
  CalendarCheck
} from 'lucide-react';
import { getTodayISTDateString, formatISTTime, formatISTDate } from '../lib/serialUtils';
import { AttendanceRecord, Profile } from '../types';

export const DailyAttendanceTracker: React.FC = () => {
  const {
    currentOrg,
    currentProfile,
    orgProfiles,
    attendanceRecords,
    leaveRequests,
    isVedotrixSuperadmin,
    resolveRegularization,
    addToast
  } = useApp();

  const isHrOrSuperadmin =
    currentProfile?.role === 'hr' ||
    currentProfile?.role === 'owner' ||
    currentProfile?.role === 'superadmin' ||
    isVedotrixSuperadmin;

  const isManager = currentProfile?.role === 'manager';

  // Only Superadmins, HR, and Managers with team have access to team daily tracker
  const managedTeam = useMemo(() => {
    if (isHrOrSuperadmin) {
      return orgProfiles.filter((p) => p.isActive);
    }
    if (isManager) {
      return orgProfiles.filter((p) => p.isActive && p.managerId === currentProfile.id);
    }
    return [];
  }, [isHrOrSuperadmin, isManager, orgProfiles, currentProfile.id]);

  const [selectedDate, setSelectedDate] = useState<string>(getTodayISTDateString());
  const [filterTab, setFilterTab] = useState<'all' | 'present' | 'not_marked' | 'on_leave'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  // Change date by offset in days
  const handleShiftDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const isToday = selectedDate === getTodayISTDateString();

  // Departments available in managed team
  const departments = useMemo(() => {
    const set = new Set(managedTeam.map((p) => p.department).filter(Boolean));
    return Array.from(set);
  }, [managedTeam]);

  // Compute attendance status for each managed employee on selected date
  const employeeAttendanceData = useMemo(() => {
    return managedTeam.map((emp) => {
      // Find attendance record for this employee on selected date
      const record = attendanceRecords.find(
        (a) => a.employeeId === emp.id && a.date === selectedDate
      );

      // Check if employee is on leave on selected date
      const leave = leaveRequests.find(
        (l) =>
          l.employeeId === emp.id &&
          (l.status === 'approved' || l.status === 'pending') &&
          l.startDate <= selectedDate &&
          l.endDate >= selectedDate
      );

      let status: 'present' | 'on_leave' | 'not_marked' = 'not_marked';
      if (record && (record.status === 'present' || record.status === 'regularized' || record.status === 'half_day')) {
        status = 'present';
      } else if (leave) {
        status = 'on_leave';
      }

      return {
        employee: emp,
        record,
        leave,
        status
      };
    });
  }, [managedTeam, attendanceRecords, leaveRequests, selectedDate]);

  // Summary counts
  const totalCount = employeeAttendanceData.length;
  const presentCount = employeeAttendanceData.filter((d) => d.status === 'present').length;
  const leaveCount = employeeAttendanceData.filter((d) => d.status === 'on_leave').length;
  const notMarkedCount = employeeAttendanceData.filter((d) => d.status === 'not_marked').length;
  const presentRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  // Filtered employees based on tab and search
  const filteredData = useMemo(() => {
    return employeeAttendanceData.filter(({ employee, status }) => {
      // Tab filter
      if (filterTab === 'present' && status !== 'present') return false;
      if (filterTab === 'on_leave' && status !== 'on_leave') return false;
      if (filterTab === 'not_marked' && status !== 'not_marked') return false;

      // Department filter
      if (selectedDepartment !== 'all' && employee.department !== selectedDepartment) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullName = `${employee.firstName} ${employee.lastName}`.toLowerCase();
        const email = employee.email.toLowerCase();
        const designation = (employee.designation || '').toLowerCase();
        const dept = (employee.department || '').toLowerCase();
        return fullName.includes(q) || email.includes(q) || designation.includes(q) || dept.includes(q);
      }

      return true;
    });
  }, [employeeAttendanceData, filterTab, selectedDepartment, searchQuery]);

  // Export CSV of attendance
  const handleExportCSV = () => {
    const headers = ['Employee Name', 'Email', 'Role', 'Department', 'Date', 'Status', 'Check-In Time', 'Location / Office', 'Distance (m)', 'Leave Type'];
    const rows = filteredData.map(({ employee, record, leave, status }) => {
      return [
        `"${employee.firstName} ${employee.lastName}"`,
        employee.email,
        employee.role,
        employee.department,
        selectedDate,
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
    link.setAttribute('download', `Attendance_${currentOrg.orgCode}_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Report Exported 📄', `Exported attendance sheet for ${filteredData.length} team members.`, 'info');
  };

  // If regular employee without direct reports, don't show manager team console
  if (!isHrOrSuperadmin && !isManager) {
    return null;
  }

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] shadow-xl overflow-hidden text-[var(--text-primary)] transition-colors duration-200">
      {/* 1. Header Toolbar */}
      <div className="p-4 sm:p-5 border-b border-[var(--border-color)] bg-[var(--bg-card-subtle)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center border border-blue-500/20 shrink-0">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                {isHrOrSuperadmin ? 'Organization Daily Attendance' : 'My Team Daily Attendance'}
              </h2>
              {isToday && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase tracking-wide">
                  Today (IST)
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Live punch-in verification, missing attendance tracking, and leave status
            </p>
          </div>
        </div>

        {/* Date Navigator & Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Picker Pill */}
          <div className="flex items-center bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-2 py-1 shadow-xs">
            <button
              onClick={() => handleShiftDate(-1)}
              className="p-1 hover:bg-[var(--bg-card-subtle)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-[var(--text-primary)] px-2 focus:outline-none cursor-pointer"
            />
            <button
              onClick={() => handleShiftDate(1)}
              className="p-1 hover:bg-[var(--bg-card-subtle)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {!isToday && (
            <button
              onClick={() => setSelectedDate(getTodayISTDateString())}
              className="px-2.5 py-1 text-xs font-semibold rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition"
            >
              Jump to Today
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 shadow-xs"
            title="Download CSV Attendance Log"
          >
            <Download className="w-3.5 h-3.5 text-slate-300" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:p-5 border-b border-[var(--border-color)] bg-[var(--bg-card)]">
        {/* Total Managed */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)]">
          <span className="text-[11px] font-medium text-[var(--text-muted)] block">Total Expected</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-black font-mono text-[var(--text-primary)]">{totalCount}</span>
            <span className="text-[11px] text-[var(--text-muted)]">Members</span>
          </div>
        </div>

        {/* Present Today */}
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <span className="text-[11px] font-bold text-emerald-400 block flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Marked Present
          </span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-black font-mono text-emerald-400">{presentCount}</span>
            <span className="text-[11px] text-emerald-500/80 font-bold">({presentRate}%)</span>
          </div>
        </div>

        {/* On Leave */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <span className="text-[11px] font-bold text-amber-400 block flex items-center gap-1">
            <CalendarCheck className="w-3.5 h-3.5 text-amber-400" />
            On Leave
          </span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-black font-mono text-amber-400">{leaveCount}</span>
            <span className="text-[11px] text-amber-500/80">Approved / Pending</span>
          </div>
        </div>

        {/* Missing / Not Marked */}
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
          <span className="text-[11px] font-bold text-rose-400 block flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            Not Marked
          </span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-black font-mono text-rose-400">{notMarkedCount}</span>
            <span className="text-[11px] text-rose-500/80">Absent / Missing</span>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-card)]/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filterTab === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-[var(--bg-card-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]'
            }`}
          >
            All ({totalCount})
          </button>
          <button
            onClick={() => setFilterTab('present')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1 ${
              filterTab === 'present'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-[var(--bg-card-subtle)] text-emerald-400 hover:bg-emerald-500/10 border border-[var(--border-color)]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Present ({presentCount})</span>
          </button>
          <button
            onClick={() => setFilterTab('not_marked')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1 ${
              filterTab === 'not_marked'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-[var(--bg-card-subtle)] text-rose-400 hover:bg-rose-500/10 border border-[var(--border-color)]'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Not Marked ({notMarkedCount})</span>
          </button>
          <button
            onClick={() => setFilterTab('on_leave')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1 ${
              filterTab === 'on_leave'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-[var(--bg-card-subtle)] text-amber-400 hover:bg-amber-500/10 border border-[var(--border-color)]'
            }`}
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>On Leave ({leaveCount})</span>
          </button>
        </div>

        {/* Search & Department Filters */}
        <div className="flex items-center space-x-2">
          {departments.length > 1 && (
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="px-2.5 py-1.5 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-primary)] font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}

          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search member..."
              className="w-full pl-8 pr-3 py-1.5 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      </div>

      {/* 4. Detailed Employee Attendance Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-color)] bg-[var(--bg-card-subtle)] text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-wider">
              <th className="py-3 px-4">Employee</th>
              <th className="py-3 px-3">Role & Dept</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Check-In Time</th>
              <th className="py-3 px-3">Location / Geofence</th>
              <th className="py-3 px-4 text-right">Action / Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-[var(--text-muted)]">
                  <UserCheck className="w-8 h-8 mx-auto text-[var(--text-muted)] mb-2 opacity-40" />
                  <p className="font-semibold">No attendance records found.</p>
                  <p className="text-[11px] mt-1">Try switching filters or selecting a different date.</p>
                </td>
              </tr>
            ) : (
              filteredData.map(({ employee, record, leave, status }) => {
                const hasPendingRegularization = record?.regularizationStatus === 'pending';

                return (
                  <tr
                    key={employee.id}
                    className="hover:bg-[var(--bg-card-subtle)]/70 transition"
                  >
                    {/* Employee Avatar & Name */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center overflow-hidden border border-blue-500/30">
                            {employee.avatarUrl && employee.avatarUrl !== '/vedotrix-logo.png' ? (
                              <img src={employee.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span>{employee.firstName[0]}{employee.lastName?.[0] || ''}</span>
                            )}
                          </div>
                          <span
                            className={`w-2.5 h-2.5 rounded-full absolute -bottom-0.5 -right-0.5 border-2 border-[var(--bg-card)] ${
                              status === 'present'
                                ? 'bg-emerald-500'
                                : status === 'on_leave'
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                          />
                        </div>
                        <div>
                          <span className="font-bold text-[var(--text-primary)] block">
                            {employee.firstName} {employee.lastName}
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)] font-mono">
                            {employee.email}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Role & Dept */}
                    <td className="py-3 px-3">
                      <span className="capitalize font-semibold text-[var(--text-primary)] block">
                        {employee.designation || employee.role}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] uppercase">
                        {employee.department}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-3">
                      {status === 'present' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {record?.status === 'regularized' ? 'REGULARIZED' : 'PRESENT'}
                        </span>
                      )}
                      {status === 'on_leave' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <CalendarCheck className="w-3 h-3 mr-1" />
                          LEAVE ({leave?.leaveType.toUpperCase()})
                        </span>
                      )}
                      {status === 'not_marked' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="w-3 h-3 mr-1" />
                          NOT MARKED
                        </span>
                      )}
                    </td>

                    {/* Check-In Time */}
                    <td className="py-3 px-3 font-mono">
                      {record?.checkInTime ? (
                        <span className="font-bold text-blue-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-blue-500" />
                          {formatISTTime(record.checkInTime)} IST
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)] italic">--:--</span>
                      )}
                    </td>

                    {/* Location / Geofence */}
                    <td className="py-3 px-3">
                      {record ? (
                        <div className="space-y-0.5">
                          <span className="font-medium text-[var(--text-primary)] flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                            {record.isRemote ? 'Remote / WFH' : (record.officeAddress || currentOrg.name)}
                          </span>
                          {!record.isRemote && (
                            <span className="text-[10px] text-[var(--text-muted)] block">
                              Distance: {record.distanceMeters ? `${record.distanceMeters}m from office` : 'Within 150m'}
                            </span>
                          )}
                        </div>
                      ) : leave ? (
                        <span className="text-[11px] text-amber-400 italic">
                          {leave.reason ? `Reason: ${leave.reason.slice(0, 30)}...` : 'Approved leave'}
                        </span>
                      ) : (
                        <span className="text-[11px] text-rose-400/80 italic">
                          No punch recorded
                        </span>
                      )}
                    </td>

                    {/* Action / Notes */}
                    <td className="py-3 px-4 text-right">
                      {hasPendingRegularization ? (
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={async () => {
                              await resolveRegularization(record.id, 'approved', 'Approved by Manager/Admin');
                              addToast('Regularization Approved', `Approved for ${employee.firstName}.`, 'success');
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition shadow-xs"
                          >
                            Approve
                          </button>
                          <button
                            onClick={async () => {
                              await resolveRegularization(record.id, 'rejected', 'Rejected by Manager/Admin');
                              addToast('Regularization Rejected', `Rejected for ${employee.firstName}.`, 'info');
                            }}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded-lg transition shadow-xs"
                          >
                            Reject
                          </button>
                        </div>
                      ) : status === 'present' ? (
                        <span className="text-[10px] font-semibold text-emerald-500">
                          Verified & Synced
                        </span>
                      ) : status === 'on_leave' ? (
                        <span className="text-[10px] text-amber-400 font-semibold">
                          {leave?.status.toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-[10px] text-rose-400/70">
                          Awaiting Punch
                        </span>
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
  );
};
