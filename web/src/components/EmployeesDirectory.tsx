import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Profile, UserRole, TaskPriority, Holiday, HolidayType } from '../types';
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
  Edit3,
  Calendar,
  Building2,
  CreditCard,
  Trash2,
  Lock,
  Check,
  Copy,
  Sparkles,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { formatSalaryOrStipend, formatISTDate, getTodayISTDateString } from '../lib/serialUtils';
import { sendWelcomeEmail, resendBatchWelcomeEmails } from '../lib/mailer';
import { OrganizationTree } from './OrganizationTree';

export const EmployeesDirectory: React.FC = () => {
  const {
    currentOrg,
    currentProfile,
    orgProfiles,
    tasks,
    holidays,
    addHoliday,
    updateHoliday,
    deleteHoliday,
    createProfile,
    updateProfile,
    updateEmployeeManager,
    createTask,
    isVedotrixSuperadmin,
    addToast
  } = useApp();

  const isTech = currentOrg.industry === 'Tech';
  const isTopLeadership =
    currentProfile?.role === 'owner' ||
    currentProfile?.role === 'superadmin' ||
    currentProfile?.role === 'hr' ||
    isVedotrixSuperadmin;

  const canManage = isTopLeadership;

  // Main Tab: Workforce Directory vs Organization Tree vs Holiday Calendar
  const [activeMainTab, setActiveMainTab] = useState<'directory' | 'hierarchy' | 'holidays'>('directory');

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
  const [editJoiningDate, setEditJoiningDate] = useState('');
  // Statutory Banking & PF (editable by HR/Superadmin)
  const [editBankName, setEditBankName] = useState('');
  const [editAccountNumber, setEditAccountNumber] = useState('');
  const [editIfscCode, setEditIfscCode] = useState('');
  const [editPfNumber, setEditPfNumber] = useState('');
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
    setEditJoiningDate(emp.joiningDate || getTodayISTDateString());
    setEditBankName(emp.bankName || '');
    setEditAccountNumber(emp.accountNumber || '');
    setEditIfscCode(emp.ifscCode || '');
    setEditPfNumber(emp.pfNumber || '');
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
      phone: editPhone.trim(),
      joiningDate: editJoiningDate || undefined,
      bankName: editBankName.trim() || undefined,
      accountNumber: editAccountNumber.trim() || undefined,
      ifscCode: editIfscCode.trim().toUpperCase() || undefined,
      pfNumber: editPfNumber.trim().toUpperCase() || undefined
    });
    setIsSavingEdit(false);
    setEditingEmployee(null);
  };

  // Holiday Calendar State & Handlers
  const [holidaySearchQuery, setHolidaySearchQuery] = useState('');
  const [holidayTypeFilter, setHolidayTypeFilter] = useState<'all' | HolidayType>('all');
  const [isAddHolidayModalOpen, setIsAddHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('2026-10-02');
  const [holidayType, setHolidayType] = useState<HolidayType>('gazetted');
  const [holidayDesc, setHolidayDesc] = useState('');
  const [holidayIsMandatory, setHolidayIsMandatory] = useState(true);
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);

  const currentOrgHolidays = holidays.filter((h) => h.orgId === currentOrg.id || !h.orgId);

  const filteredHolidays = currentOrgHolidays.filter((h) => {
    if (holidayTypeFilter !== 'all' && h.type !== holidayTypeFilter) return false;
    if (holidaySearchQuery.trim()) {
      const q = holidaySearchQuery.toLowerCase();
      const matchName = h.name.toLowerCase().includes(q);
      const matchDesc = (h.description || '').toLowerCase().includes(q);
      const matchDate = h.date.includes(q);
      if (!matchName && !matchDesc && !matchDate) return false;
    }
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date));

  const handleOpenAddHoliday = () => {
    setEditingHoliday(null);
    setHolidayName('');
    setHolidayDate(new Date().toISOString().split('T')[0]);
    setHolidayType('gazetted');
    setHolidayDesc('');
    setHolidayIsMandatory(true);
    setIsAddHolidayModalOpen(true);
  };

  const handleOpenEditHoliday = (h: Holiday) => {
    setEditingHoliday(h);
    setHolidayName(h.name);
    setHolidayDate(h.date);
    setHolidayType(h.type);
    setHolidayDesc(h.description || '');
    setHolidayIsMandatory(h.isMandatory ?? true);
    setIsAddHolidayModalOpen(true);
  };

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayName.trim() || !holidayDate) {
      addToast('Validation Error', 'Holiday name and date are required.', 'warning');
      return;
    }

    setIsSavingHoliday(true);
    try {
      if (editingHoliday) {
        await updateHoliday(editingHoliday.id, {
          name: holidayName.trim(),
          date: holidayDate,
          type: holidayType,
          description: holidayDesc.trim() || undefined,
          isMandatory: holidayIsMandatory
        });
      } else {
        await addHoliday({
          name: holidayName.trim(),
          date: holidayDate,
          type: holidayType,
          description: holidayDesc.trim() || undefined,
          isMandatory: holidayIsMandatory
        });
      }
      setIsAddHolidayModalOpen(false);
      setEditingHoliday(null);
    } catch (err) {
      console.error('Save holiday error:', err);
    } finally {
      setIsSavingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (h: Holiday) => {
    if (!window.confirm(`Are you sure you want to remove "${h.name}" (${h.date}) from official organization holidays?`)) {
      return;
    }
    await deleteHoliday(h.id);
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
  const [newJoiningDate, setNewJoiningDate] = useState(() => getTodayISTDateString());
  const [newBaseSalary, setNewBaseSalary] = useState(0);
  const [newManagerId, setNewManagerId] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newIfscCode, setNewIfscCode] = useState('');
  const [newPfNumber, setNewPfNumber] = useState('');

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
  const canAccessEmployees = isTopLeadership || directReports.length > 0;

  // Baseline pool of employees: Top leadership manages all org profiles, managers only view their direct reports
  const baseProfiles = isTopLeadership ? orgProfiles : directReports;

  // Filtered employees list
  const filteredProfiles = baseProfiles.filter((p) => {
    if (isTopLeadership && tabFilter === 'my_team' && p.managerId !== currentProfile.id && p.id !== currentProfile.id) {
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
      modulesAccess: ['attendance', 'tasks', 'standups'],
      bankName: newBankName.trim() || undefined,
      accountNumber: newAccountNumber.trim() || undefined,
      ifscCode: newIfscCode.trim().toUpperCase() || undefined,
      pfNumber: newPfNumber.trim().toUpperCase() || undefined
    });

    setIsAddMemberOpen(false);
    setNewFirstName('');
    setNewLastName('');
    setNewEmail('');
    setNewPassword('');
    setNewPhone('+91 ');
    setNewDesignation('');
    setNewBaseSalary(0);
    setNewBankName('');
    setNewAccountNumber('');
    setNewIfscCode('');
    setNewPfNumber('');
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

  if (!canAccessEmployees) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-xs max-w-lg mx-auto my-12">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
          <Shield className="w-6 h-6 text-slate-500" />
        </div>
        <h3 className="text-base font-bold text-slate-800">Restricted Section</h3>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          Employee workforce management is strictly reserved for organization top leadership (Owner, HR, Superadmin) and reporting managers who have direct reports assigned to them.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 1. Header & Actions matching Employee Management screenshot */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {activeMainTab === 'directory'
              ? (isTopLeadership ? 'Employee Management' : 'My Managed Team')
              : activeMainTab === 'hierarchy'
              ? 'Organization Hierarchy Tree'
              : 'Organization Holiday Calendar'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeMainTab === 'directory'
              ? (isTopLeadership
                  ? `Manage your workforce, hierarchical reporting, statutory records, and PR deliverables for ${currentOrg.name}.`
                  : 'Manage performance, task assignments, and review deliverables for your direct reports.')
              : activeMainTab === 'hierarchy'
              ? `Visual hierarchy tree and designated reporting management for ${currentOrg.name}.`
              : `Official gazetted, national and corporate holidays scheduled by ${currentOrg.name} leadership.`}
          </p>
        </div>

        {canManage && (
          <div className="flex items-center space-x-2 shrink-0">
            {activeMainTab === 'directory' ? (
              <>
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
              </>
            ) : activeMainTab === 'holidays' ? (
              <button
                onClick={handleOpenAddHoliday}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Holiday</span>
              </button>
            ) : null}
          </div>
        )}
      </div>

      {/* 2. Top-level Tab Switcher: Workforce Directory vs Organization Tree vs Holiday Calendar */}
      <div className="flex items-center space-x-2 border-b border-slate-200/80 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveMainTab('directory')}
          className={`inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
            activeMainTab === 'directory'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Workforce Directory ({baseProfiles.length})</span>
        </button>

        <button
          onClick={() => setActiveMainTab('hierarchy')}
          className={`inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
            activeMainTab === 'hierarchy'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <GitBranch className="w-4 h-4" />
          <span>Organization Tree ({baseProfiles.length})</span>
        </button>

        <button
          onClick={() => setActiveMainTab('holidays')}
          className={`inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
            activeMainTab === 'holidays'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Holiday Calendar ({currentOrgHolidays.length})</span>
        </button>
      </div>

      {/* 3. Main Content Views */}
      {activeMainTab === 'directory' && (
        <div className="space-y-5">
          {/* Filter & Search Bar Toolbar matching reference screenshot */}
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

          {/* My Team Tab - Only for top leadership */}
          {isTopLeadership && (
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
          )}
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
                        {emp.joiningDate && (
                          <span className="text-[10px] text-slate-400 flex items-center mt-0.5">
                            <Calendar className="w-2.5 h-2.5 mr-1 text-blue-500 shrink-0" />
                            Joined {formatISTDate(emp.joiningDate)}
                          </span>
                        )}
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
    </div>
  )}

  {/* 3B. Organization Hierarchy Tree View */}
  {activeMainTab === 'hierarchy' && (
    <OrganizationTree />
  )}

  {/* 4. Organization Holiday Calendar View */}
  {activeMainTab === 'holidays' && (
    <div className="space-y-4">
      {/* Holiday Filter & Controls Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={holidaySearchQuery}
            onChange={(e) => setHolidaySearchQuery(e.target.value)}
            placeholder="Search holidays by name, month, description..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
        </div>

        {/* Filter Dropdown */}
        <div className="flex items-center space-x-2">
          <select
            value={holidayTypeFilter}
            onChange={(e) => setHolidayTypeFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="all">All Holiday Types</option>
            <option value="gazetted">Gazetted Holidays</option>
            <option value="national">National Holidays</option>
            <option value="restricted">Restricted Holidays</option>
            <option value="optional">Optional Holidays</option>
            <option value="company">Corporate / Branch Off</option>
          </select>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <span>Official Holiday Schedule (IST)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-600 text-white font-bold">
                {currentOrgHolidays.length} Holidays
              </span>
            </h4>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
              Attendance punch-in is automatically locked on scheduled holidays for {currentOrg.name}. Superadmin & HR can configure organization-wide holidays here.
            </p>
          </div>
        </div>

        {canManage && (
          <button
            onClick={handleOpenAddHoliday}
            className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-blue-600 border border-blue-200 rounded-xl text-xs font-bold transition shadow-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule Holiday</span>
          </button>
        )}
      </div>

      {/* Holiday Cards Grid */}
      {filteredHolidays.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-xs text-slate-400 space-y-2 shadow-xs">
          <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="font-semibold text-slate-700">No holidays found</p>
          <p className="text-[11px] text-slate-500">No scheduled holidays match your current filter.</p>
          {canManage && (
            <button
              onClick={handleOpenAddHoliday}
              className="mt-2 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule First Holiday</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredHolidays.map((h) => {
            const d = new Date(h.date + 'T12:00:00Z');
            const dayNum = d.getUTCDate();
            const monthShort = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
            const dayName = d.toLocaleString('en-US', { weekday: 'long', timeZone: 'UTC' });
            const year = d.getUTCFullYear();

            const typeStyles: Record<HolidayType, { bg: string; text: string; label: string; border: string }> = {
              national: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'National Holiday', border: 'border-blue-200' },
              gazetted: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Gazetted', border: 'border-emerald-200' },
              restricted: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Restricted', border: 'border-purple-200' },
              optional: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Optional Off', border: 'border-amber-200' },
              company: { bg: 'bg-cyan-50', text: 'text-cyan-700', label: 'Corporate Event', border: 'border-cyan-200' },
              festival: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Festival Celebration', border: 'border-rose-200' }
            };
            const style = typeStyles[h.type] || typeStyles.gazetted;

            return (
              <div
                key={h.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-4 flex flex-col justify-between hover:border-slate-200 transition relative"
              >
                <div className="flex items-start space-x-3.5">
                  {/* Date Block */}
                  <div className="w-14 h-16 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] font-extrabold text-blue-600 tracking-wider">
                      {monthShort}
                    </span>
                    <span className="text-xl font-extrabold text-slate-900 leading-none my-0.5">
                      {dayNum}
                    </span>
                    <span className="text-[9px] font-medium text-slate-400">
                      {year}
                    </span>
                  </div>

                  {/* Holiday Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1.5 flex-wrap gap-y-1 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
                        {style.label}
                      </span>
                      {h.isMandatory !== false ? (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          Mandatory
                        </span>
                      ) : (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                          Optional
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 tracking-tight truncate" title={h.name}>
                      {h.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{dayName} (IST)</span>
                    </p>
                  </div>
                </div>

                {h.description && (
                  <p className="text-xs text-slate-600 mt-3 pt-2.5 border-t border-slate-100 leading-relaxed">
                    {h.description}
                  </p>
                )}

                {/* Card Footer: Lock badge & HR Actions */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center space-x-1 text-[10px] text-slate-500 font-medium">
                    <Shield className="w-3 h-3 text-emerald-500" />
                    <span>Punch Locked</span>
                  </span>

                  {canManage && (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleOpenEditHoliday(h)}
                        className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-blue-600 rounded-lg transition"
                        title="Edit Holiday Details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteHoliday(h)}
                        className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                        title="Delete Holiday"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  )}

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

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Official Joining Date (IST) *</span>
                  <span className="text-[10px] text-blue-600 font-normal">Attendance tracks from this date</span>
                </label>
                <input
                  type="date"
                  required
                  value={editJoiningDate}
                  onChange={(e) => setEditJoiningDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Configured by Superadmin / HR. Attendance & absent checks apply strictly starting from this date.
                </span>
              </div>

              {/* Banking & Statutory Details (HR / Superadmin Editable) */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex items-center space-x-1.5">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-900">
                    Banking & Statutory Details (Real / Non-Static)
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Real employee account credentials and Provident Fund (UAN) for direct payroll disbursement. Editable strictly by HR & Superadmin.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={editBankName}
                      onChange={(e) => setEditBankName(e.target.value)}
                      placeholder="e.g. HDFC Bank / State Bank of India"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={editAccountNumber}
                      onChange={(e) => setEditAccountNumber(e.target.value)}
                      placeholder="e.g. 50100492817291"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      value={editIfscCode}
                      onChange={(e) => setEditIfscCode(e.target.value.toUpperCase())}
                      placeholder="e.g. HDFC0001234"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      PF Number (UAN)
                    </label>
                    <input
                      type="text"
                      value={editPfNumber}
                      onChange={(e) => setEditPfNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. UP/LKO/0049281/000/0001092"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Official Joining Date (IST) *</label>
                  <input
                    type="date"
                    required
                    value={newJoiningDate}
                    onChange={(e) => setNewJoiningDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Base / Stipend (₹)</label>
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

              {/* Banking & Statutory Details (Optional on Onboarding) */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex items-center space-x-1.5">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-900">
                    Banking & Statutory Details (Optional)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={newBankName}
                      onChange={(e) => setNewBankName(e.target.value)}
                      placeholder="e.g. HDFC Bank"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Account Number</label>
                    <input
                      type="text"
                      value={newAccountNumber}
                      onChange={(e) => setNewAccountNumber(e.target.value)}
                      placeholder="e.g. 50100492817291"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">IFSC Code</label>
                    <input
                      type="text"
                      value={newIfscCode}
                      onChange={(e) => setNewIfscCode(e.target.value.toUpperCase())}
                      placeholder="e.g. HDFC0001234"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">PF Number (UAN)</label>
                    <input
                      type="text"
                      value={newPfNumber}
                      onChange={(e) => setNewPfNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. UP/LKO/0049281/000/0001092"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>
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

      {/* Modal: Add / Edit Organization Holiday */}
      {isAddHolidayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden my-6 border border-slate-100">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingHoliday ? 'Edit Organization Holiday' : 'Schedule New Holiday'}
                  </h3>
                  <p className="text-[11px] text-slate-500">{currentOrg.name} (IST)</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAddHolidayModalOpen(false);
                  setEditingHoliday(null);
                }}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveHoliday} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Holiday Name *
                </label>
                <input
                  type="text"
                  required
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  placeholder="e.g. Diwali / Independence Day"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Holiday Date * (IST)
                  </label>
                  <input
                    type="date"
                    required
                    value={holidayDate}
                    onChange={(e) => setHolidayDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Holiday Category
                  </label>
                  <select
                    value={holidayType}
                    onChange={(e) => setHolidayType(e.target.value as HolidayType)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="gazetted">Gazetted Holiday</option>
                    <option value="national">National Holiday</option>
                    <option value="restricted">Restricted Holiday</option>
                    <option value="optional">Optional Holiday</option>
                    <option value="company">Corporate / Branch Off</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Notice Notes
                </label>
                <textarea
                  rows={2}
                  value={holidayDesc}
                  onChange={(e) => setHolidayDesc(e.target.value)}
                  placeholder="e.g. Observed across all corporate offices in India."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-800 block">
                    Mandatory Closure
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Attendance punch is strictly paused on this date
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={holidayIsMandatory}
                  onChange={(e) => setHolidayIsMandatory(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddHolidayModalOpen(false);
                    setEditingHoliday(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingHoliday}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center space-x-1.5"
                >
                  {isSavingHoliday ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingHoliday ? 'Save Changes' : 'Schedule Holiday'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
