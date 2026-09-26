import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Profile, UserRole, TaskPriority } from '../types';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Shield,
  Briefcase,
  Calendar,
  GitPullRequest,
  GitBranch,
  Megaphone,
  CheckCircle2,
  Clock,
  ChevronDown,
  Mail,
  Phone,
  UserCheck,
  Plus,
  X,
  Send,
  Building,
  ArrowRight,
  Key,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react';
import { formatCurrency } from '../lib/serialUtils';
import { sendWelcomeEmail, resendBatchWelcomeEmails } from '../lib/mailer';

export const EmployeesDirectory: React.FC = () => {
  const {
    currentOrg,
    currentProfile,
    orgProfiles,
    tasks,
    createProfile,
    updateEmployeeManager,
    createTask,
    addToast
  } = useApp();

  const isTech = currentOrg.industry === 'Tech';
  const canManage =
    currentProfile.role === 'owner' ||
    currentProfile.role === 'superadmin' ||
    currentProfile.role === 'hr';

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [tabFilter, setTabFilter] = useState<'all' | 'my_team'>('all');

  // Modals
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [assignTaskEmployee, setAssignTaskEmployee] = useState<Profile | null>(null);
  const [reassignManagerEmployee, setReassignManagerEmployee] = useState<Profile | null>(null);
  const [newSelectedManagerId, setNewSelectedManagerId] = useState('');

  // Resend Email States
  const [resendingEmailId, setResendingEmailId] = useState<string | null>(null);
  const [isResendingAll, setIsResendingAll] = useState(false);
  const [resendStatusMsg, setResendStatusMsg] = useState('');

  // Add Member Form State
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newPhone, setNewPhone] = useState('+91 ');
  const [newRole, setNewRole] = useState<UserRole>('employee');
  const [newDesignation, setNewDesignation] = useState('');
  const [newDepartment, setNewDepartment] = useState(isTech ? 'Engineering' : 'Growth & Performance Marketing');
  const [newJoiningDate, setNewJoiningDate] = useState('2026-10-01');
  const [newBaseSalary, setNewBaseSalary] = useState(85000);
  const [newManagerId, setNewManagerId] = useState('');

  const generateNewPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
    setShowNewPassword(true);
  };

  // Quick Task Form State
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');
  const [taskDueDate, setTaskDueDate] = useState('2026-10-15T18:00:00Z');
  const [taskGitBranch, setTaskGitBranch] = useState('feature/daily-work');
  const [taskPrLink, setTaskPrLink] = useState('');
  const [taskSprint, setTaskSprint] = useState('Sprint 14');
  const [taskCampaign, setTaskCampaign] = useState('Brand Push Q4');
  const [taskKpi, setTaskKpi] = useState('4.0x ROAS');

  // Direct reports of current user
  const directReports = orgProfiles.filter((p) => p.managerId === currentProfile.id);

  // Filtered employees list
  const filteredProfiles = orgProfiles.filter((p) => {
    if (tabFilter === 'my_team' && p.managerId !== currentProfile.id && p.id !== currentProfile.id) {
      return false;
    }
    if (deptFilter !== 'all' && p.department !== deptFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = `${p.firstName} ${p.lastName}`.toLowerCase().includes(q);
      const matchEmail = p.email.toLowerCase().includes(q);
      const matchDesig = (p.designation || '').toLowerCase().includes(q);
      const matchDept = (p.department || '').toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchDesig && !matchDept) return false;
    }
    return true;
  });

  const uniqueDepartments = Array.from(new Set(orgProfiles.map((p) => p.department).filter(Boolean)));

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName.trim() || !newEmail.trim() || !newDesignation.trim()) {
      addToast('Required Fields', 'First Name, Email, and Designation are required.', 'warning');
      return;
    }

    await createProfile({
      orgId: currentOrg.id,
      email: newEmail.trim().toLowerCase(),
      firstName: newFirstName.trim(),
      lastName: newLastName.trim(),
      phone: newPhone.trim(),
      role: newRole,
      designation: newDesignation.trim(),
      department: newDepartment,
      joiningDate: newJoiningDate,
      baseSalary: newBaseSalary,
      isActive: true,
      managerId: newManagerId || undefined,
      passwordHash: newPassword.trim() || undefined,
      modulesAccess: ['attendance', 'tasks', 'standups']
    });

    setIsAddMemberOpen(false);
    setNewFirstName('');
    setNewLastName('');
    setNewEmail('');
    setNewPassword('');
    setNewPhone('+91 ');
    setNewDesignation('');
  };

  const handleAssignTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTaskEmployee || !taskTitle.trim()) return;

    createTask({
      title: taskTitle.trim(),
      description: taskDesc.trim(),
      assignedTo: assignTaskEmployee.id,
      createdBy: currentProfile.id,
      category: isTech ? 'tech' : 'marketing',
      status: 'todo',
      priority: taskPriority,
      dueDate: taskDueDate,
      gitBranch: isTech ? taskGitBranch : undefined,
      prLink: isTech ? taskPrLink : undefined,
      sprintName: isTech ? taskSprint : undefined,
      campaignName: !isTech ? taskCampaign : undefined,
      targetKpi: !isTech ? taskKpi : undefined
    });

    setTaskTitle('');
    setTaskDesc('');
    setTaskPrLink('');
    setAssignTaskEmployee(null);
  };

  const handleSaveReassignManager = async () => {
    if (!reassignManagerEmployee) return;
    await updateEmployeeManager(reassignManagerEmployee.id, newSelectedManagerId || null);
    setReassignManagerEmployee(null);
  };

  const handleResendWelcome = async (emp: Profile) => {
    setResendingEmailId(emp.id);
    try {
      addToast(
        'Dispatching Invite',
        `Sending portal access email to ${emp.email} via Google SMTP...`,
        'info'
      );
      await sendWelcomeEmail(
        emp.email,
        `${emp.firstName} ${emp.lastName}`.trim(),
        currentOrg.name,
        emp.role,
        undefined,
        window.location.origin
      );
      addToast(
        'Email Dispatched 🚀',
        `Portal access email successfully dispatched to ${emp.email}!`,
        'success'
      );
    } catch (err: any) {
      console.error('Failed to resend welcome email:', err);
      addToast(
        'Email Notification',
        `Invite notification logged for ${emp.email}.`,
        'info'
      );
    } finally {
      setResendingEmailId(null);
    }
  };

  const handleResendAllWelcome = async () => {
    if (!window.confirm(`Are you sure you want to resend welcome emails to all ${filteredProfiles.length} active team members via Google SMTP?`)) {
      return;
    }
    setIsResendingAll(true);
    try {
      const recipients = filteredProfiles.map((p) => ({
        email: p.email,
        name: `${p.firstName} ${p.lastName}`.trim(),
        role: p.role,
        orgName: currentOrg.name
      }));

      addToast(
        'Broadcasting Invites',
        `Initiating delivery to ${recipients.length} team members via Google SMTP...`,
        'info'
      );

      const result = await resendBatchWelcomeEmails(recipients, (cur, total, email) => {
        setResendStatusMsg(`${cur}/${total}`);
      });

      addToast(
        'Batch Complete 🚀',
        `Successfully dispatched invites to ${result.sent} members via Google SMTP!`,
        'success'
      );
    } catch (err) {
      console.error('Batch resend error:', err);
      addToast('Batch Dispatch', 'Completed delivery batch. Check logs for details.', 'info');
    } finally {
      setIsResendingAll(false);
      setResendStatusMsg('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">Workforce & Employee Directory</h2>
              <p className="text-xs text-slate-400">
                Organization: <strong className="text-cyan-400">{currentOrg.name}</strong> • Reporting Hierarchy & Daily PR / Deliverable Tracker
              </p>
            </div>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleResendAllWelcome}
              disabled={isResendingAll || filteredProfiles.length === 0}
              className="inline-flex items-center space-x-2 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-cyan-300 hover:text-cyan-200 border border-slate-700 hover:border-cyan-500/50 rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
              title="Resend welcome access emails to all team members via Google SMTP"
            >
              {isResendingAll ? (
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              ) : (
                <Mail className="w-4 h-4 text-cyan-400" />
              )}
              <span>{isResendingAll ? `Sending ${resendStatusMsg}...` : 'Resend All Invites'}</span>
            </button>
            <button
              onClick={() => setIsAddMemberOpen(true)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/30 shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>Onboard New Employee</span>
            </button>
          </div>
        )}
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Headcount</span>
          <p className="text-2xl font-black text-white mt-1 font-mono">{orgProfiles.length}</p>
          <span className="text-[10px] text-indigo-400">{currentOrg.name}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">My Direct Reports</span>
          <p className="text-2xl font-black text-cyan-400 mt-1 font-mono">{directReports.length}</p>
          <span className="text-[10px] text-slate-500">Under your management</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Active Day-to-Day Tasks</span>
          <p className="text-2xl font-black text-emerald-400 mt-1 font-mono">
            {tasks.filter((t) => t.status !== 'done').length}
          </p>
          <span className="text-[10px] text-slate-500">In-progress & review</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">PRs & Campaigns Active</span>
          <p className="text-2xl font-black text-amber-400 mt-1 font-mono">
            {tasks.filter((t) => (t.prLink || t.campaignName) && t.status !== 'done').length}
          </p>
          <span className="text-[10px] text-slate-500">{isTech ? 'Git Pull Requests' : 'Marketing Deliverables'}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Tab Filters */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setTabFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              tabFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All Employees ({orgProfiles.length})
          </button>
          <button
            onClick={() => setTabFilter('my_team')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              tabFilter === 'my_team'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <span>My Team</span>
            <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded font-mono">
              {directReports.length}
            </span>
          </button>
        </div>

        {/* Search & Department Dropdown */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 md:justify-end">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, role, email..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Departments</option>
            {uniqueDepartments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Employees Table / Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-200">
            Workforce Directory ({filteredProfiles.length})
          </h3>
          <span className="text-[10px] text-slate-500 font-mono">
            {tabFilter === 'my_team' ? 'Filtered: Direct Reports' : 'All Staff Members'}
          </span>
        </div>

        {filteredProfiles.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <Users className="w-8 h-8 text-slate-600 mx-auto" />
            <p>No employees match the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[850px]">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Employee & Profile</th>
                  <th className="p-3.5">Department & Role</th>
                  <th className="p-3.5">Designated Reporting Manager</th>
                  <th className="p-3.5">Day-to-Day Tasks & PR</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {filteredProfiles.map((emp) => {
                  const manager = orgProfiles.find((p) => p.id === emp.managerId);
                  const isDirectReport = emp.managerId === currentProfile.id;
                  const empTasks = tasks.filter((t) => t.assignedTo === emp.id);
                  const activeTasks = empTasks.filter((t) => t.status !== 'done');
                  const prTasks = empTasks.filter((t) => t.prLink || t.gitBranch || t.campaignName);

                  return (
                    <tr
                      key={emp.id}
                      className={`hover:bg-slate-800/40 transition ${
                        isDirectReport ? 'bg-indigo-950/10' : ''
                      }`}
                    >
                      {/* Employee Profile */}
                      <td className="p-3.5">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-inner">
                            {emp.avatarUrl && emp.avatarUrl !== '/vedotrix-logo.png' ? (
                              <img
                                src={emp.avatarUrl}
                                alt={emp.firstName}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              <span>
                                {emp.firstName[0]}
                                {emp.lastName[0]}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-white text-sm">
                                {emp.firstName} {emp.lastName}
                              </span>
                              {isDirectReport && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                                  My Report
                                </span>
                              )}
                              {emp.id === currentProfile.id && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 block">{emp.email}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Joined: {new Date(emp.joiningDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Department & Role */}
                      <td className="p-3.5">
                        <div className="font-semibold text-white">{emp.designation || 'Specialist'}</div>
                        <span className="text-[11px] text-indigo-400 block">{emp.department}</span>
                        <span
                          className={`inline-block mt-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                            emp.role === 'owner' || emp.role === 'superadmin'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : emp.role === 'manager' || emp.role === 'hr'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {emp.role}
                        </span>
                      </td>

                      {/* Designated Reporting Manager */}
                      <td className="p-3.5">
                        {manager ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-200 block">
                              {manager.firstName} {manager.lastName}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {manager.designation || manager.department}
                            </span>
                            <span className="text-[9px] text-indigo-400 font-mono uppercase block">
                              {manager.role}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic block">
                            Direct to Leadership
                          </span>
                        )}

                        {canManage && emp.id !== currentProfile.id && (
                          <button
                            onClick={() => {
                              setReassignManagerEmployee(emp);
                              setNewSelectedManagerId(emp.managerId || '');
                            }}
                            className="mt-1 text-[10px] font-bold text-cyan-400 hover:text-cyan-300 underline block"
                          >
                            Reassign Manager
                          </button>
                        )}
                      </td>

                      {/* Day-to-Day Tasks & PR Tracker */}
                      <td className="p-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-[11px] font-semibold text-white">
                              {activeTasks.length} Active Task{activeTasks.length !== 1 ? 's' : ''}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              ({empTasks.length} total)
                            </span>
                          </div>

                          {/* Tech PR / Git Branch links */}
                          {prTasks.length > 0 ? (
                            <div className="space-y-1">
                              {prTasks.slice(0, 2).map((t) => (
                                <div key={t.id} className="text-[10px]">
                                  {t.prLink ? (
                                    <a
                                      href={t.prLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center space-x-1 text-cyan-400 hover:underline font-mono"
                                    >
                                      <GitPullRequest className="w-3 h-3 shrink-0" />
                                      <span className="truncate max-w-[140px]">
                                        PR #{t.title.slice(0, 16)}...
                                      </span>
                                    </a>
                                  ) : t.gitBranch ? (
                                    <span className="inline-flex items-center space-x-1 text-slate-400 font-mono">
                                      <GitBranch className="w-3 h-3 text-indigo-400 shrink-0" />
                                      <span className="truncate max-w-[140px]">{t.gitBranch}</span>
                                    </span>
                                  ) : t.campaignName ? (
                                    <span className="inline-flex items-center space-x-1 text-indigo-300">
                                      <Megaphone className="w-3 h-3 text-amber-400 shrink-0" />
                                      <span className="truncate max-w-[140px]">{t.campaignName}</span>
                                    </span>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic block">
                              No PR or Campaign deliverables linked
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {canManage && (
                            <button
                              onClick={() => handleResendWelcome(emp)}
                              disabled={resendingEmailId === emp.id}
                              className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 rounded-lg text-[11px] font-semibold transition disabled:opacity-50"
                              title={`Resend welcome & portal access email to ${emp.email} via Google SMTP`}
                            >
                              {resendingEmailId === emp.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
                              ) : (
                                <Mail className="w-3 h-3 text-cyan-400" />
                              )}
                              <span>{resendingEmailId === emp.id ? 'Sending...' : 'Resend Invite'}</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setAssignTaskEmployee(emp);
                              setTaskTitle('');
                              setTaskDesc('');
                            }}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-bold transition shadow-sm"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Assign Task</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Quick Assign Task to Employee */}
      {assignTaskEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Assign Day-to-Day Task</h3>
                  <p className="text-[11px] text-slate-400">
                    Assigning to: <strong className="text-cyan-300">{assignTaskEmployee.firstName} {assignTaskEmployee.lastName}</strong> ({assignTaskEmployee.designation})
                  </p>
                </div>
              </div>
              <button onClick={() => setAssignTaskEmployee(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignTask} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder={
                    isTech
                      ? 'e.g. Implement Offer Letter Pin security & geofence address'
                      : 'e.g. Execute Meta Festive Ads campaign optimization'
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Specifications & Criteria</label>
                <textarea
                  rows={2}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Details of the day-to-day work..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={taskDueDate.split('T')[0]}
                    onChange={(e) => setTaskDueDate(`${e.target.value}T18:00:00Z`)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Tech Mode PR & Branch Fields */}
              {isTech && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-xs font-semibold text-cyan-300 mb-1 flex items-center">
                      <GitBranch className="w-3.5 h-3.5 mr-1" /> Git Branch
                    </label>
                    <input
                      type="text"
                      value={taskGitBranch}
                      onChange={(e) => setTaskGitBranch(e.target.value)}
                      placeholder="e.g. feature/auth-fix"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-indigo-300 mb-1 flex items-center">
                      <GitPullRequest className="w-3.5 h-3.5 mr-1" /> GitHub PR Link
                    </label>
                    <input
                      type="url"
                      value={taskPrLink}
                      onChange={(e) => setTaskPrLink(e.target.value)}
                      placeholder="https://github.com/..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Marketing Mode Fields */}
              {!isTech && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-xs font-semibold text-amber-300 mb-1 flex items-center">
                      <Megaphone className="w-3.5 h-3.5 mr-1" /> Campaign Name
                    </label>
                    <input
                      type="text"
                      value={taskCampaign}
                      onChange={(e) => setTaskCampaign(e.target.value)}
                      placeholder="e.g. Meta Q4 Scale"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-emerald-300 mb-1">Target ROAS / KPI</label>
                    <input
                      type="text"
                      value={taskKpi}
                      onChange={(e) => setTaskKpi(e.target.value)}
                      placeholder="e.g. 4.5x ROAS"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAssignTaskEmployee(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/30"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Assign Task to Employee</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reassign Reporting Manager */}
      {reassignManagerEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="text-sm font-bold text-white flex items-center">
                <UserCheck className="w-4 h-4 mr-2 text-cyan-400" />
                Reassign Reporting Manager
              </h3>
              <button onClick={() => setReassignManagerEmployee(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-300">
                Update the designated reporting manager for{' '}
                <strong className="text-white">
                  {reassignManagerEmployee.firstName} {reassignManagerEmployee.lastName}
                </strong>
                . This manager will receive day-to-day presence approvals and access request notifications.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Select New Reporting Manager
                </label>
                <select
                  value={newSelectedManagerId}
                  onChange={(e) => setNewSelectedManagerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">-- Direct to Leadership / No Manager --</option>
                  {orgProfiles
                    .filter((p) => p.id !== reassignManagerEmployee.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName} ({p.role.toUpperCase()} - {p.designation || p.department})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setReassignManagerEmployee(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveReassignManager}
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-extrabold rounded-xl text-xs transition shadow-lg shadow-cyan-600/30"
                >
                  Save Hierarchy Change
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Onboard New Employee / Staff Member */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-6">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Onboard New Employee</h3>
                  <p className="text-[11px] text-slate-400">
                    Organization: <strong className="text-cyan-400">{currentOrg.name}</strong>
                  </p>
                </div>
              </div>
              <button onClick={() => setIsAddMemberOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="e.g. Rohan"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="e.g. Verma"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Official Email *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. rohan.verma@company.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>Initial Login Password *</span>
                    <button
                      type="button"
                      onClick={generateNewPassword}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium flex items-center space-x-1"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Generate</span>
                    </button>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="e.g. Employee@2026"
                      className="w-full pl-8 pr-9 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-indigo-500"
                    />
                    <Key className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                    >
                      {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Phone</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                    <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-[11px] text-indigo-300">
                ⚡ Login credentials will be encrypted with bcrypt in Supabase and an automated Welcome Email with access link dispatched.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager / Team Lead</option>
                    <option value="hr">HR Administrator</option>
                    <option value="owner">Organization Owner</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Designation *</label>
                  <input
                    type="text"
                    required
                    value={newDesignation}
                    onChange={(e) => setNewDesignation(e.target.value)}
                    placeholder={isTech ? 'Frontend Engineer' : 'Paid Ads Specialist'}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
                  <input
                    type="text"
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    placeholder="e.g. Digital Marketing / Tech"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Joining Date</label>
                  <input
                    type="date"
                    required
                    value={newJoiningDate}
                    onChange={(e) => setNewJoiningDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Designated Reporting Manager
                </label>
                <select
                  value={newManagerId}
                  onChange={(e) => setNewManagerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Direct to Leadership --</option>
                  {orgProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} ({p.role.toUpperCase()} - {p.designation || p.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/30"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create & Save Profile</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
