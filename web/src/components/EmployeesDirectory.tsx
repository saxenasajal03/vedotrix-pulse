import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Profile, UserRole, TaskPriority } from '../types';
import {
  Users,
  UserPlus,
  Search,
  CheckCircle2,
  Mail,
  UserCheck,
  Plus,
  X,
  Send,
  GitPullRequest,
  GitBranch,
  Megaphone,
  RefreshCw,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Shield,
  Key,
  Eye,
  EyeOff,
  Phone,
  Edit3
} from 'lucide-react';
import { formatSalaryOrStipend } from '../lib/serialUtils';
import { sendWelcomeEmail, resendBatchWelcomeEmails } from '../lib/mailer';

export const EmployeesDirectory: React.FC = () => {
  const {
    currentOrg,
    currentProfile,
    orgProfiles,
    tasks,
    createProfile,
    updateProfile,
    updateEmployeeManager,
    createTask,
    addToast
  } = useApp();

  const isTech = currentOrg.industry === 'Tech';
  const canManage =
    currentProfile?.role === 'owner' ||
    currentProfile?.role === 'superadmin' ||
    currentProfile?.role === 'hr';

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tabFilter, setTabFilter] = useState<'all' | 'my_team'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [assignTaskEmployee, setAssignTaskEmployee] = useState<Profile | null>(null);
  const [reassignManagerEmployee, setReassignManagerEmployee] = useState<Profile | null>(null);
  const [newSelectedManagerId, setNewSelectedManagerId] = useState('');

  // Edit Employee State
  const [editingEmployee, setEditingEmployee] = useState<Profile | null>(null);
  const [editDesignation, setEditDesignation] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editBaseSalary, setEditBaseSalary] = useState('0');
  const [editRole, setEditRole] = useState<UserRole>('employee');
  const [editManagerId, setEditManagerId] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editPhone, setEditPhone] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleOpenEdit = (emp: Profile) => {
    setEditingEmployee(emp);
    setEditDesignation(emp.designation || '');
    setEditDepartment(emp.department || 'Operations');
    setEditBaseSalary(emp.baseSalary !== null && emp.baseSalary !== undefined ? String(emp.baseSalary) : '0');
    setEditRole(emp.role);
    setEditManagerId(emp.managerId || '');
    setEditIsActive(emp.isActive ?? true);
    setEditPhone(emp.phone || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    setIsSavingEdit(true);
    await updateProfile(editingEmployee.id, {
      designation: editDesignation.trim(),
      department: editDepartment.trim(),
      baseSalary: editBaseSalary !== '' && !isNaN(Number(editBaseSalary)) ? Number(editBaseSalary) : 0,
      role: editRole,
      managerId: editManagerId || undefined,
      isActive: editIsActive,
      phone: editPhone.trim()
    });
    setIsSavingEdit(false);
    setEditingEmployee(null);
  };

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
  const [newDepartment, setNewDepartment] = useState('Development');
  const [newJoiningDate, setNewJoiningDate] = useState('2026-10-01');
  const [newBaseSalary, setNewBaseSalary] = useState(0);
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
    if (statusFilter === 'active' && !p.isActive) return false;
    if (statusFilter === 'inactive' && p.isActive) return false;

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
    setNewBaseSalary(0);
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
      addToast('Dispatching Invite', `Sending portal access email to ${emp.email} via Google SMTP...`, 'info');
      await sendWelcomeEmail(
        emp.email,
        `${emp.firstName} ${emp.lastName}`.trim(),
        currentOrg.name,
        emp.role,
        undefined,
        window.location.origin
      );
      addToast('Email Dispatched 🚀', `Portal access email successfully dispatched to ${emp.email}!`, 'success');
    } catch (err: any) {
      console.error('Failed to resend welcome email:', err);
      addToast('Email Notification', `Invite notification logged for ${emp.email}.`, 'info');
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

      addToast('Broadcasting Invites', `Initiating delivery to ${recipients.length} team members via Google SMTP...`, 'info');

      const result = await resendBatchWelcomeEmails(recipients, (cur, total) => {
        setResendStatusMsg(`${cur}/${total}`);
      });

      addToast('Batch Complete 🚀', `Successfully dispatched invites to ${result.sent} members via Google SMTP!`, 'success');
    } catch (err) {
      console.error('Batch resend error:', err);
      addToast('Batch Dispatch', 'Completed delivery batch. Check logs for details.', 'info');
    } finally {
      setIsResendingAll(false);
      setResendStatusMsg('');
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Header & Actions matching Employee Management screenshot */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Employee Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your workforce, hierarchical reporting, and PR deliverables for {currentOrg.name}.
          </p>
        </div>

        {canManage && (
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleResendAllWelcome}
              disabled={isResendingAll || filteredProfiles.length === 0}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition shadow-xs disabled:opacity-50"
              title="Resend welcome email to all employees"
            >
              {isResendingAll ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
              ) : (
                <Mail className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span>{isResendingAll ? `Sending ${resendStatusMsg}...` : 'Resend All'}</span>
            </button>

            <button
              onClick={() => setIsAddMemberOpen(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Employee</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Filter & Search Bar Toolbar matching reference screenshot */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search employees..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex items-center space-x-2">
          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="all">All Departments</option>
            {uniqueDepartments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {/* My Team Tab */}
          <button
            onClick={() => setTabFilter(tabFilter === 'all' ? 'my_team' : 'all')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${
              tabFilter === 'my_team'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            My Reports ({directReports.length})
          </button>
        </div>
      </div>

      {/* 3. Clean White Employee Table matching reference screenshot */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        {filteredProfiles.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <p>No employees found matching the filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-100">
                <tr>
                  <th className="p-4 w-20">ID</th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Department</th>
                  <th className="p-4">Designation</th>
                  <th className="p-4 text-center">Status</th>
                  {(canManage || true) && <th className="p-4 text-right">Compensation</th>}
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredProfiles.map((emp, idx) => {
                  const empCode = `EMP${String(idx + 1).padStart(3, '0')}`;
                  const manager = orgProfiles.find((p) => p.id === emp.managerId);
                  const isDirectReport = emp.managerId === currentProfile.id;
                  const canAssignToEmp =
                    canManage || emp.managerId === currentProfile.id || emp.id === currentProfile.id;
                  const empTasks = tasks.filter((t) => t.assignedTo === emp.id);
                  const activeTasks = empTasks.filter((t) => t.status !== 'done');
                  const prTasks = empTasks.filter((t) => t.prLink || t.gitBranch || t.campaignName);

                  return (
                    <tr
                      key={emp.id}
                      className={`hover:bg-slate-50/70 transition ${
                        isDirectReport ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      {/* ID */}
                      <td className="p-4 font-mono font-medium text-slate-500">
                        {empCode}
                      </td>

                      {/* Name & Avatar */}
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0 overflow-hidden">
                            {emp.avatarUrl && emp.avatarUrl !== '/vedotrix-logo.png' ? (
                              <img src={emp.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span>{emp.firstName[0]}{emp.lastName[0]}</span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-slate-900 text-xs">
                                {emp.firstName} {emp.lastName}
                              </span>
                              {isDirectReport && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700">
                                  Report
                                </span>
                              )}
                              {emp.id === currentProfile.id && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-cyan-100 text-cyan-700">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 block">{emp.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="p-4">
                        <span className="text-slate-800 font-medium">{emp.department || 'Operations'}</span>
                      </td>

                      {/* Designation */}
                      <td className="p-4">
                        <span className="text-slate-800 font-medium">{emp.designation || 'Specialist'}</span>
                        {manager && (
                          <span className="text-[10px] text-slate-400 block">
                            Lead: {manager.firstName} {manager.lastName}
                          </span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                          Active
                        </span>
                      </td>

                      {/* Salary / Compensation */}
                      <td className="p-4 text-right font-mono font-semibold">
                        {canManage || emp.id === currentProfile.id ? (
                          formatSalaryOrStipend(emp.baseSalary)
                        ) : (
                          <span className="text-slate-300 text-[10px] font-sans">Confidential</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {canAssignToEmp ? (
                            <button
                              onClick={() => {
                                setAssignTaskEmployee(emp);
                                setTaskTitle('');
                                setTaskDesc('');
                              }}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-semibold transition"
                              title="Assign direct report task"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Assign</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">
                              Lead Only
                            </span>
                          )}

                          {canManage && (
                            <button
                              onClick={() => handleResendWelcome(emp)}
                              disabled={resendingEmailId === emp.id}
                              className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition"
                              title={`Resend invite to ${emp.email}`}
                            >
                              {resendingEmailId === emp.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                              ) : (
                                <Mail className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}

                          {canManage && emp.id !== currentProfile.id && (
                            <button
                              onClick={() => {
                                setReassignManagerEmployee(emp);
                                setNewSelectedManagerId(emp.managerId || '');
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                              title="Reassign manager"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canManage && (
                            <button
                              onClick={() => handleOpenEdit(emp)}
                              className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition"
                              title="Edit employee details, role & salary"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Pagination matching reference screenshot */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-800">{filteredProfiles.length}</strong> employees
          </span>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
              1
            </button>
            <button className="w-7 h-7 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center">
              2
            </button>
            <button className="w-7 h-7 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center">
              3
            </button>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Quick Assign Task */}
      {assignTaskEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Assign Task</h3>
                  <p className="text-[11px] text-slate-500">
                    Assigning to: <strong className="text-slate-800">{assignTaskEmployee.firstName} {assignTaskEmployee.lastName}</strong>
                  </p>
                </div>
              </div>
              <button onClick={() => setAssignTaskEmployee(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignTask} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Implement Offer Letter Pin security & geofence address"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Task specifications..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={taskDueDate.split('T')[0]}
                    onChange={(e) => setTaskDueDate(`${e.target.value}T18:00:00Z`)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              {isTech && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Git Branch</label>
                    <input
                      type="text"
                      value={taskGitBranch}
                      onChange={(e) => setTaskGitBranch(e.target.value)}
                      placeholder="feature/auth-fix"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">PR Link</label>
                    <input
                      type="url"
                      value={taskPrLink}
                      onChange={(e) => setTaskPrLink(e.target.value)}
                      placeholder="https://github.com/..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssignTaskEmployee(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  Assign Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reassign Reporting Manager */}
      {reassignManagerEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center">
                <UserCheck className="w-4 h-4 mr-2 text-blue-600" />
                Reassign Reporting Manager
              </h3>
              <button onClick={() => setReassignManagerEmployee(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Update reporting manager for{' '}
                <strong className="text-slate-900">
                  {reassignManagerEmployee.firstName} {reassignManagerEmployee.lastName}
                </strong>
                .
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select New Manager
                </label>
                <select
                  value={newSelectedManagerId}
                  onChange={(e) => setNewSelectedManagerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReassignManagerEmployee(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveReassignManager}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  Save Hierarchy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Employee Details & Compensation */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden my-6 border border-slate-100">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Edit Employee Details
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingEmployee.firstName} {editingEmployee.lastName} ({editingEmployee.email})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingEmployee(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Designation *
                  </label>
                  <input
                    type="text"
                    required
                    value={editDesignation}
                    onChange={(e) => setEditDesignation(e.target.value)}
                    placeholder="e.g. Lead Engineer / Intern"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department *
                  </label>
                  <select
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="Development">Development</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Operations">Operations</option>
                    <option value="Design">Design</option>
                    <option value="Sales">Sales</option>
                    <option value="HR">HR</option>
                    <option value="Finance">Finance</option>
                    <option value="Leadership">Leadership</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Platform Role
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="employee">Employee / Intern</option>
                    <option value="manager">Manager / Team Lead</option>
                    <option value="hr">HR Administrator</option>
                    <option value="owner">Organization Owner</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Base Salary / Stipend (₹/mo)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={editBaseSalary}
                    onChange={(e) => setEditBaseSalary(e.target.value)}
                    placeholder="0 for Unpaid Intern"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    ₹0 represents unpaid intern / trainee
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reporting Manager
                  </label>
                  <select
                    value={editManagerId}
                    onChange={(e) => setEditManagerId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">-- No Direct Manager / Executive --</option>
                    {orgProfiles
                      .filter((p) => p.id !== editingEmployee.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.firstName} {p.lastName} ({p.role.toUpperCase()})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-xs font-semibold text-slate-800 block">
                    Account Status
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Suspended employees cannot log in or record attendance
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  <span className="ml-2 text-xs font-bold text-slate-700">
                    {editIsActive ? 'Active' : 'Suspended'}
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center space-x-1.5"
                >
                  {isSavingEdit ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving to Supabase...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Onboard New Employee */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden my-6 border border-slate-100">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Onboard New Employee</h3>
                  <p className="text-[11px] text-slate-500">{currentOrg.name}</p>
                </div>
              </div>
              <button onClick={() => setIsAddMemberOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="e.g. Riya"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="e.g. Sharma"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Official Email *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. riya@company.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Initial Password</span>
                    <button
                      type="button"
                      onClick={generateNewPassword}
                      className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold flex items-center"
                    >
                      <RefreshCw className="w-2.5 h-2.5 mr-0.5" /> Generate
                    </button>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Strong@2026"
                      className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <Key className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                    >
                      {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="hr">HR Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Designation *</label>
                  <input
                    type="text"
                    required
                    value={newDesignation}
                    onChange={(e) => setNewDesignation(e.target.value)}
                    placeholder="e.g. Full Stack Dev"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    placeholder="e.g. Development"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Base (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={newBaseSalary}
                    onChange={(e) => setNewBaseSalary(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <div className="flex gap-1 mt-1">
                    <button
                      type="button"
                      onClick={() => setNewBaseSalary(0)}
                      className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-semibold border border-amber-200"
                    >
                      Unpaid (₹0)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewBaseSalary(10000)}
                      className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-semibold border border-blue-200"
                    >
                      Stipend (₹10k)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewBaseSalary(50000)}
                      className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[9px] font-semibold border border-slate-200"
                    >
                      Full-time (₹50k)
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Designated Reporting Manager
                </label>
                <select
                  value={newManagerId}
                  onChange={(e) => setNewManagerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">-- Direct to Leadership --</option>
                  {orgProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} ({p.role.toUpperCase()} - {p.designation || p.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  Create Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
