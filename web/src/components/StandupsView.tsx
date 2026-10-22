import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Clock,
  Plus,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  User,
  Calendar,
  Filter,
  Search,
  Download,
  GitPullRequest,
  ExternalLink,
  ShieldAlert,
  Users,
  CheckCheck,
  ChevronDown
} from 'lucide-react';
import { formatISTDate, getTodayISTDateString } from '../lib/serialUtils';

interface StandupsViewProps {
  onOpenSubmitModal: () => void;
}

export const StandupsView: React.FC<StandupsViewProps> = ({ onOpenSubmitModal }) => {
  const {
    currentOrg,
    standups,
    orgProfiles,
    currentProfile,
    isVedotrixSuperadmin,
    attendanceRecords,
    tasks,
    addToast
  } = useApp();

  const isHrOrSuperadmin =
    isVedotrixSuperadmin ||
    currentProfile?.role === 'superadmin' ||
    currentProfile?.role === 'hr' ||
    currentProfile?.role === 'owner';

  // Direct reports managed by current user
  const directReports = useMemo(() => {
    return orgProfiles.filter((p) => p.managerId === currentProfile?.id);
  }, [orgProfiles, currentProfile]);

  const isManager = !isHrOrSuperadmin && directReports.length > 0;

  // Filter States
  const [selectedEmpFilter, setSelectedEmpFilter] = useState<string>('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customDate, setCustomDate] = useState('');

  const todayStr = getTodayISTDateString();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  // Has current user submitted today?
  const hasSubmittedToday = standups.some(
    (s) => s.employeeId === currentProfile?.id && s.date === todayStr
  );

  // Accessible employees based on role hierarchy
  const selectableEmployees = useMemo(() => {
    if (isHrOrSuperadmin) {
      return orgProfiles.filter((p) => p.isActive);
    }
    if (isManager) {
      return [currentProfile, ...directReports.filter((p) => p.isActive)];
    }
    return [currentProfile];
  }, [isHrOrSuperadmin, isManager, orgProfiles, directReports, currentProfile]);

  const allowedEmpIds = useMemo(() => {
    return new Set(selectableEmployees.map((p) => p.id));
  }, [selectableEmployees]);

  // Unique departments
  const departments = useMemo(() => {
    return Array.from(new Set(selectableEmployees.map((p) => p.department).filter(Boolean)));
  }, [selectableEmployees]);

  // Today's attendance punches to detect missing submissions
  const todayCheckedInEmployees = useMemo(() => {
    const punchesToday = attendanceRecords.filter((a) => a.date === todayStr && a.status === 'present');
    const checkedInEmpIds = new Set(punchesToday.map((a) => a.employeeId));
    return selectableEmployees.filter((emp) => checkedInEmpIds.has(emp.id));
  }, [attendanceRecords, todayStr, selectableEmployees]);

  const missingEodEmployees = useMemo(() => {
    const submittedEmpIds = new Set(
      standups.filter((s) => s.date === todayStr).map((s) => s.employeeId)
    );
    return todayCheckedInEmployees.filter((emp) => !submittedEmpIds.has(emp.id));
  }, [todayCheckedInEmployees, standups, todayStr]);

  // Filtered Standup Logs
  const filteredStandups = useMemo(() => {
    return standups
      .filter((s) => {
        // Scope to allowed employees (hierarchy)
        if (!allowedEmpIds.has(s.employeeId)) return false;

        // Specific employee filter
        if (selectedEmpFilter !== 'all' && s.employeeId !== selectedEmpFilter) return false;

        // Department filter
        if (selectedDeptFilter !== 'all') {
          const emp = orgProfiles.find((p) => p.id === s.employeeId);
          if (emp?.department !== selectedDeptFilter) return false;
        }

        // Date filter
        if (selectedDateFilter === 'today' && s.date !== todayStr) return false;
        if (selectedDateFilter === 'yesterday' && s.date !== yesterdayStr) return false;
        if (selectedDateFilter === 'week') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const sevenDaysAgoStr = sevenDaysAgo.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
          if (s.date < sevenDaysAgoStr) return false;
        }
        if (selectedDateFilter === 'custom' && customDate && s.date !== customDate) return false;

        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const emp = orgProfiles.find((p) => p.id === s.employeeId);
          const empName = emp ? `${emp.firstName} ${emp.lastName}`.toLowerCase() : '';
          const empDept = (emp?.department || '').toLowerCase();
          const completed = (s.completedToday || '').toLowerCase();
          const planned = (s.plannedTomorrow || '').toLowerCase();
          const blockers = (s.blockers || '').toLowerCase();

          return (
            empName.includes(q) ||
            empDept.includes(q) ||
            completed.includes(q) ||
            planned.includes(q) ||
            blockers.includes(q) ||
            s.date.includes(q)
          );
        }

        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [
    standups,
    allowedEmpIds,
    selectedEmpFilter,
    selectedDeptFilter,
    selectedDateFilter,
    todayStr,
    yesterdayStr,
    customDate,
    searchQuery,
    orgProfiles
  ]);

  // Metrics for Today
  const todayStandups = useMemo(() => {
    return standups.filter((s) => s.date === todayStr && allowedEmpIds.has(s.employeeId));
  }, [standups, todayStr, allowedEmpIds]);

  const totalHoursLoggedToday = useMemo(() => {
    return todayStandups.reduce((acc, s) => acc + (Number(s.hoursLogged) || 8), 0);
  }, [todayStandups]);

  const blockersLoggedToday = useMemo(() => {
    return todayStandups.filter((s) => s.blockers && s.blockers.trim().length > 0).length;
  }, [todayStandups]);

  // PR Link Extractor: detects GitHub/GitLab PRs or URLs from standup text
  const extractUrls = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };

  // Export Standups Report to CSV
  const handleExportCSV = () => {
    if (filteredStandups.length === 0) {
      addToast('No Records', 'There are no standup records to export for current filters.', 'warning');
      return;
    }

    const headers = [
      'Date',
      'Employee Name',
      'Work Email',
      'Department',
      'Designation',
      'Hours Logged',
      'Completed Today',
      'Planned Tomorrow',
      'Blockers',
      'PR / Deliverable Links'
    ];

    const rows = filteredStandups.map((s) => {
      const emp = orgProfiles.find((p) => p.id === s.employeeId);
      const prs = extractUrls(`${s.completedToday} ${s.plannedTomorrow} ${s.blockers || ''}`).join(' | ');
      return [
        `"${s.date}"`,
        `"${emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown'}"`,
        `"${emp?.email || ''}"`,
        `"${emp?.department || ''}"`,
        `"${emp?.designation || ''}"`,
        `"${s.hoursLogged}"`,
        `"${(s.completedToday || '').replace(/"/g, '""')}"`,
        `"${(s.plannedTomorrow || '').replace(/"/g, '""')}"`,
        `"${(s.blockers || '').replace(/"/g, '""')}"`,
        `"${prs}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `EOD_Standups_${currentOrg.orgCode}_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast('EOD Report Exported 📄', `Exported ${filteredStandups.length} daily logs to CSV.`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5 flex-wrap">
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
              <span>Daily EOD Standup & Work Reports</span>
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {currentOrg.industry} Mode
            </span>
            {isHrOrSuperadmin && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                HR / Admin Scope
              </span>
            )}
            {isManager && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Reporting Manager Scope ({directReports.length} reports)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            End of day progress check-ins, PR deliverables, roadblock detection, and sprint accountability synced with Supabase.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(isHrOrSuperadmin || isManager) && (
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition border border-slate-700 shadow-sm"
              title="Download EOD Standups CSV Report"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export CSV</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSubmitModal}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>{hasSubmittedToday ? "Update Today's Standup" : 'Submit EOD Standup'}</span>
          </button>
        </div>
      </div>

      {/* 2. Executive Metrics Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Today's Logs</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-extrabold text-white">{todayStandups.length}</span>
            <span className="text-xs text-slate-400 font-semibold">/ {selectableEmployees.length} members</span>
          </div>
          <div className="mt-1.5 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-300"
              style={{
                width: `${selectableEmployees.length > 0 ? Math.min(100, (todayStandups.length / selectableEmployees.length) * 100) : 0}%`
              }}
            />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hours Logged</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-extrabold text-cyan-400 font-mono">{totalHoursLoggedToday}</span>
            <span className="text-xs text-slate-400">hrs today</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">Verified work log hours</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Blockers Flagged</span>
            <AlertCircle className={`w-4 h-4 ${blockersLoggedToday > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-xl font-extrabold ${blockersLoggedToday > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
              {blockersLoggedToday}
            </span>
            <span className="text-xs text-slate-400">impediments</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">Requires manager unblock</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Missing EOD</span>
            <ShieldAlert className={`w-4 h-4 ${missingEodEmployees.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-xl font-extrabold ${missingEodEmployees.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {missingEodEmployees.length}
            </span>
            <span className="text-xs text-slate-400">pending today</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">Checked-in without EOD</span>
        </div>
      </div>

      {/* 3. Missing Submissions Alert for Managers/HR */}
      {(isHrOrSuperadmin || isManager) && missingEodEmployees.length > 0 && (
        <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <div>
              <span className="font-bold text-rose-300">Pending EOD Standup Today: </span>
              <span className="text-rose-200">
                {missingEodEmployees.map((e) => `${e.firstName} ${e.lastName}`).join(', ')}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-rose-400 whitespace-nowrap bg-rose-950/50 px-2 py-0.5 rounded border border-rose-800/40">
            Shift Wrap Reminder Sent
          </span>
        </div>
      )}

      {/* 4. Smart Hierarchy Filters */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Employee Selector */}
          <div className="flex items-center space-x-2 flex-1 min-w-[220px]">
            <User className="w-4 h-4 text-indigo-400 shrink-0" />
            <select
              value={selectedEmpFilter}
              onChange={(e) => setSelectedEmpFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">
                {isHrOrSuperadmin ? '👥 All Organization Employees' : isManager ? '👥 All Direct Reports + Self' : '👤 Team Standup Feed'}
              </option>
              {selectableEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.designation || emp.role}) {emp.id === currentProfile?.id ? '★ You' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          {departments.length > 1 && (
            <div className="flex items-center space-x-2 min-w-[180px]">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">🏢 All Departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search standup tasks, PRs, blockers..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Date Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-800/80 text-xs">
          <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Date:
          </span>
          {[
            { key: 'all', label: 'All History' },
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: 'week', label: 'Past 7 Days' },
            { key: 'custom', label: 'Pick Date' }
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSelectedDateFilter(tab.key)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                selectedDateFilter === tab.key
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}

          {selectedDateFilter === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="px-2 py-1 bg-slate-950 border border-indigo-500/50 rounded-lg text-xs text-white font-semibold focus:outline-none"
            />
          )}

          <div className="ml-auto text-[11px] text-slate-400 font-semibold">
            Showing <strong className="text-white font-bold">{filteredStandups.length}</strong> logs
          </div>
        </div>
      </div>

      {/* 5. Standup Feed Cards */}
      <div className="space-y-4">
        {filteredStandups.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
            <div className="text-3xl">🚀</div>
            <p className="font-bold text-slate-300">No EOD Standup Logs Found</p>
            <p className="text-[11px] text-slate-500">
              No logs matched the selected employee, department, or date filter.
            </p>
          </div>
        ) : (
          filteredStandups.map((standup) => {
            const emp = orgProfiles.find((p) => p.id === standup.employeeId);
            const manager = orgProfiles.find((p) => p.id === emp?.managerId);

            // Detected links / PRs
            const fullText = `${standup.completedToday} ${standup.plannedTomorrow} ${standup.blockers || ''}`;
            const links = extractUrls(fullText);

            // Cross-reference completed tasks for this employee on this date or done
            const completedEmpTasks = tasks.filter(
              (t) => t.assignedTo === standup.employeeId && (t.status === 'done' || t.prLink || t.gitBranch)
            );

            return (
              <div
                key={standup.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4 hover:border-slate-700 transition"
              >
                {/* Standup Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-extrabold text-sm shadow-md shrink-0 select-none">
                      {emp ? `${emp.firstName[0]}${emp.lastName?.[0] || ''}` : 'U'}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-xs sm:text-sm font-bold text-white">
                          {emp ? `${emp.firstName} ${emp.lastName}` : 'Team Member'}
                        </h4>
                        {emp?.id === currentProfile?.id && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        <span className="text-slate-300 font-semibold">{emp?.designation || 'Specialist'}</span> •{' '}
                        <span>{emp?.department || 'Operations'}</span>
                        {manager && (
                          <span className="text-slate-500 ml-1">
                            • Mgr: <span className="text-slate-400 font-medium">{manager.firstName} {manager.lastName}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2.5 text-xs self-start sm:self-auto pl-13 sm:pl-0">
                    <span className="text-slate-400 text-xs flex items-center bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                      <Calendar className="w-3.5 h-3.5 mr-1 text-slate-500" />
                      {formatISTDate(standup.date)}
                    </span>
                    <span className="font-mono text-cyan-300 font-bold bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-xs flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      {standup.hoursLogged} hrs
                    </span>
                  </div>
                </div>

                {/* Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Completed Today */}
                  <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      1. Accomplishments Today
                    </span>
                    <p className="text-slate-200 text-xs leading-relaxed whitespace-pre-line">
                      {standup.completedToday}
                    </p>
                  </div>

                  {/* Planned Tomorrow */}
                  <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-cyan-400 flex items-center">
                      <Sparkles className="w-3.5 h-3.5 mr-1" />
                      2. Priorities for Tomorrow
                    </span>
                    <p className="text-slate-200 text-xs leading-relaxed whitespace-pre-line">
                      {standup.plannedTomorrow}
                    </p>
                  </div>
                </div>

                {/* Blockers Alert Banner */}
                {standup.blockers && standup.blockers.trim() ? (
                  <div className="flex items-start space-x-2 p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold text-amber-300 uppercase tracking-wide text-[10px] block mb-0.5">
                        ⚠️ Roadblock / Dependency Reported:
                      </strong>
                      <span className="leading-relaxed">{standup.blockers}</span>
                    </div>
                  </div>
                ) : null}

                {/* PR Deliverables & Task Links Section */}
                {(links.length > 0 || completedEmpTasks.some((t) => t.prLink || t.gitBranch)) && (
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/90 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-[10px] uppercase font-extrabold text-purple-400 flex items-center gap-1 mr-1">
                      <GitPullRequest className="w-3.5 h-3.5" />
                      PR Deliverables / Artifacts:
                    </span>
                    {links.map((link, lIdx) => {
                      const isGithubPR = link.includes('github.com') && link.includes('/pull/');
                      const prNumber = isGithubPR ? link.split('/pull/')[1]?.split(/[\/?#]/)[0] : null;
                      return (
                        <a
                          key={lIdx}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-[11px] font-mono font-semibold transition"
                        >
                          <GitPullRequest className="w-3 h-3" />
                          <span>{isGithubPR ? `PR #${prNumber}` : 'Deliverable Link'}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </a>
                      );
                    })}

                    {/* Linked task PRs */}
                    {completedEmpTasks
                      .filter((t) => t.prLink && !links.includes(t.prLink))
                      .map((t) => (
                        <a
                          key={t.id}
                          href={t.prLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-[11px] font-mono font-semibold transition"
                        >
                          <CheckCheck className="w-3 h-3 text-emerald-400" />
                          <span className="truncate max-w-[140px]">{t.title}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </a>
                      ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
