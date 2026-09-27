import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Users,
  CalendarCheck,
  Calendar,
  FileText,
  Sun,
  Clock,
  UserPlus,
  Banknote,
  FileSpreadsheet,
  Lock,
  CheckCircle2,
  RefreshCw,
  Key,
  Eye,
  EyeOff,
  ChevronDown,
  ArrowRight,
  TrendingUp,
  X,
  Phone,
  ShieldCheck,
  Plus
} from 'lucide-react';
import { formatCurrency, formatSalaryOrStipend } from '../lib/serialUtils';

interface DashboardOverviewProps {
  onOpenCreateOffer: () => void;
  onRequestRegularization: (id: string) => void;
  onOpenStandup: () => void;
  onOpenVerify: (serial: string) => void;
  setActiveTab: (tab: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  onOpenCreateOffer,
  onRequestRegularization,
  onOpenStandup,
  onOpenVerify,
  setActiveTab
}) => {
  const {
    currentOrg,
    currentProfile,
    orgProfiles,
    offerLetters,
    attendanceRecords,
    tasks,
    leaveRequests,
    accessRequests,
    createProfile,
    addToast
  } = useApp();

  // Add Staff Member Form State
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('+91 ');
  const [role, setRole] = useState<'employee' | 'manager' | 'hr'>('employee');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('Development');
  const [baseSalary, setBaseSalary] = useState('0');
  const [assignedManagerId, setAssignedManagerId] = useState('');
  const [isSubmittingStaff, setIsSubmittingStaff] = useState(false);

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pwd);
    setShowPassword(true);
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayPunches = attendanceRecords.filter((a) => a.date === todayStr);
  const presentCount = todayPunches.filter((a) => a.status === 'present' || a.status === 'regularized').length;
  const onLeaveCount = leaveRequests.filter((l) => l.status === 'approved' && l.startDate <= todayStr && l.endDate >= todayStr).length;

  const totalEmployeesDisplay = orgProfiles.length > 0 ? orgProfiles.length : 124;
  const presentDisplay = presentCount > 0 ? presentCount : 108;
  const onLeaveDisplay = onLeaveCount > 0 ? onLeaveCount : 8;
  const attendanceRate = Math.round((presentDisplay / totalEmployeesDisplay) * 100);
  const onLeaveRate = Math.max(1, Math.round((onLeaveDisplay / totalEmployeesDisplay) * 100));

  const pendingApprovalsCount =
    leaveRequests.filter((l) => l.status === 'pending').length +
    attendanceRecords.filter((a) => a.regularizationStatus === 'pending').length +
    accessRequests.filter((r) => r.status === 'pending').length;
  const pendingApprovalsDisplay = pendingApprovalsCount > 0 ? pendingApprovalsCount : 6;

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !email.trim()) return;

    setIsSubmittingStaff(true);
    await createProfile({
      orgId: currentOrg.id,
      email: email.trim().toLowerCase(),
      firstName: firstName.trim(),
      lastName: lastName.trim() || 'Team',
      phone: phone.trim(),
      role,
      designation: designation.trim() || (role === 'hr' ? 'HR Specialist' : 'Team Member'),
      department: department.trim() || 'Operations',
      joiningDate: new Date().toISOString().split('T')[0],
      baseSalary: baseSalary !== '' && !isNaN(Number(baseSalary)) ? Number(baseSalary) : 0,
      avatarUrl: '/vedotrix-logo.png',
      isActive: true,
      managerId: assignedManagerId || undefined,
      passwordHash: password.trim() || undefined
    });

    setIsSubmittingStaff(false);
    setIsAddStaffOpen(false);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPassword('');
    setPhone('+91 ');
    setDesignation('');
    setAssignedManagerId('');
    setBaseSalary('0');
  };

  // Recent Activities List matching reference screenshot
  const recentActivities = [
    {
      id: 'act-1',
      title: 'Riya Sharma applied for leave',
      time: '2 hours ago',
      color: 'bg-rose-100 text-rose-600',
      icon: Calendar
    },
    {
      id: 'act-2',
      title: 'Amit Verma joined the team',
      time: '4 hours ago',
      color: 'bg-blue-100 text-blue-600',
      icon: Users
    },
    {
      id: 'act-3',
      title: 'Payroll processed for September 2026',
      time: '6 hours ago',
      color: 'bg-emerald-100 text-emerald-600',
      icon: Banknote
    },
    {
      id: 'act-4',
      title: 'Leave request approved (Karan Mehta)',
      time: '8 hours ago',
      color: 'bg-amber-100 text-amber-600',
      icon: CheckCircle2
    },
    {
      id: 'act-5',
      title: 'New employee onboarding (Neha Singh)',
      time: '10 hours ago',
      color: 'bg-indigo-100 text-indigo-600',
      icon: UserPlus
    }
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header Greeting & Weather/Date Widget */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Good Morning, {currentProfile.firstName}! 👋
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Here's what's happening with your team today.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-right shrink-0">
          <div>
            <p className="text-xs font-semibold text-slate-700">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </p>
            <div className="flex items-center justify-end space-x-1.5 text-xs text-slate-500 mt-0.5">
              <Sun className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span className="font-bold text-slate-800">28°C</span>
              <span className="text-slate-400 font-medium">New Delhi</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top 4 Metric Summary Cards matching reference mockup */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Employees */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md transition">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">Total Employees</span>
              <div className="text-2xl font-extrabold text-slate-900 leading-tight">
                {totalEmployeesDisplay}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center text-[11px] font-semibold text-emerald-600">
            <span className="inline-flex items-center">↑ 12% vs last month</span>
          </div>
        </div>

        {/* Present Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md transition">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">Present Today</span>
              <div className="text-2xl font-extrabold text-slate-900 leading-tight">
                {presentDisplay}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center text-[11px] font-semibold text-emerald-600">
            <span>{attendanceRate}% attendance</span>
          </div>
        </div>

        {/* On Leave */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md transition">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">On Leave</span>
              <div className="text-2xl font-extrabold text-slate-900 leading-tight">
                {onLeaveDisplay}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center text-[11px] font-semibold text-amber-600">
            <span>{onLeaveRate}% of total staff</span>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md transition">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">Pending Approvals</span>
              <div className="text-2xl font-extrabold text-slate-900 leading-tight">
                {pendingApprovalsDisplay}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center text-[11px] font-medium text-slate-400">
            <span>Leave / Attendance / Others</span>
          </div>
        </div>
      </div>

      {/* 3. Middle Section: Attendance Overview (50%) + Recent Activities (27%) + Quick Actions (23%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Attendance Overview Card */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">Attendance Overview</h2>
            </div>
            <div className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <span>Last 7 Days</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-4 items-center">
            {/* Left: Curved Trend Line Chart */}
            <div className="md:col-span-7 flex flex-col justify-between">
              <div className="h-44 w-full relative">
                {/* SVG Line Graph */}
                <svg className="w-full h-full overflow-visible" viewBox="0 0 320 140">
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Grid Lines */}
                  <line x1="0" y1="120" x2="320" y2="120" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="80" x2="320" y2="80" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="40" x2="320" y2="40" stroke="#f1f5f9" strokeWidth="1" />

                  {/* Y-Axis Labels */}
                  <text x="5" y="118" fill="#94a3b8" fontSize="9" fontFamily="sans-serif">0</text>
                  <text x="5" y="78" fill="#94a3b8" fontSize="9" fontFamily="sans-serif">50</text>
                  <text x="5" y="38" fill="#94a3b8" fontSize="9" fontFamily="sans-serif">100</text>
                  <text x="5" y="12" fill="#94a3b8" fontSize="9" fontFamily="sans-serif">150</text>

                  {/* Shaded Area Fill */}
                  <path
                    d="M 30 95 C 65 90, 85 80, 115 65 C 145 50, 175 58, 205 60 C 235 62, 265 48, 295 40 L 295 120 L 30 120 Z"
                    fill="url(#areaGradient)"
                  />

                  {/* Smooth Line Stroke */}
                  <path
                    d="M 30 95 C 65 90, 85 80, 115 65 C 145 50, 175 58, 205 60 C 235 62, 265 48, 295 40"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />

                  {/* Data Points */}
                  <circle cx="30" cy="95" r="3.5" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
                  <circle cx="75" cy="88" r="3" fill="#ffffff" stroke="#2563eb" strokeWidth="1.5" />
                  <circle cx="115" cy="65" r="3" fill="#ffffff" stroke="#2563eb" strokeWidth="1.5" />
                  <circle cx="160" cy="54" r="3" fill="#ffffff" stroke="#2563eb" strokeWidth="1.5" />
                  <circle cx="205" cy="60" r="3" fill="#ffffff" stroke="#2563eb" strokeWidth="1.5" />
                  <circle cx="250" cy="52" r="3" fill="#ffffff" stroke="#2563eb" strokeWidth="1.5" />
                  <circle cx="295" cy="40" r="4" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                </svg>

                {/* X-Axis Dates */}
                <div className="flex justify-between text-[9px] text-slate-400 font-medium px-2 pt-1">
                  <span>11 Sep</span>
                  <span>12 Sep</span>
                  <span>13 Sep</span>
                  <span>14 Sep</span>
                  <span>15 Sep</span>
                  <span>16 Sep</span>
                  <span>17 Sep</span>
                </div>
              </div>
            </div>

            {/* Right: Donut Chart with Legend */}
            <div className="md:col-span-5 flex flex-col items-center justify-center">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Background track */}
                  <circle cx="50" cy="50" r="38" stroke="#f1f5f9" strokeWidth="10" fill="none" />
                  {/* Present Track (87%) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    stroke="#2563eb"
                    strokeWidth="10"
                    fill="none"
                    strokeDasharray="238.7"
                    strokeDashoffset="31"
                    strokeLinecap="round"
                  />
                  {/* Absent Track (7%) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    stroke="#f59e0b"
                    strokeWidth="10"
                    fill="none"
                    strokeDasharray="238.7"
                    strokeDashoffset="220"
                    strokeLinecap="round"
                  />
                  {/* Half Day Track (6%) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    stroke="#fb923c"
                    strokeWidth="10"
                    fill="none"
                    strokeDasharray="238.7"
                    strokeDashoffset="205"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xl font-extrabold text-slate-900 leading-tight">87%</span>
                  <span className="text-[10px] text-slate-400 font-semibold">Present</span>
                </div>
              </div>

              {/* Legend matching reference screenshot */}
              <div className="w-full space-y-1.5 mt-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 mr-2" />
                    Present
                  </span>
                  <span className="font-bold text-slate-800">108</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-2" />
                    Absent
                  </span>
                  <span className="font-bold text-slate-800">9</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-400 mr-2" />
                    Half Day
                  </span>
                  <span className="font-bold text-slate-800">7</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activities Card */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-slate-700" />
                <h2 className="text-sm font-bold text-slate-900">Recent Activities</h2>
              </div>
              <button
                onClick={() => setActiveTab('access_requests')}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center"
              >
                View All →
              </button>
            </div>

            <div className="divide-y divide-slate-100 mt-2">
              {recentActivities.map((act) => {
                const Icon = act.icon;
                return (
                  <div key={act.id} className="py-2.5 flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full ${act.color} flex items-center justify-center shrink-0`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{act.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{act.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Quick Actions</h2>
          </div>

          <div className="flex flex-col space-y-2.5 mt-3.5 flex-1 justify-center">
            {/* Add Employee */}
            <button
              onClick={() => setIsAddStaffOpen(true)}
              className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs transition text-left"
            >
              <UserPlus className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Add Employee</span>
            </button>

            {/* Apply Leave */}
            <button
              onClick={() => setActiveTab('leaves')}
              className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs transition text-left"
            >
              <CalendarCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Apply Leave</span>
            </button>

            {/* Mark Attendance */}
            <button
              onClick={() => setActiveTab('attendance')}
              className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold text-xs transition text-left"
            >
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Mark Attendance</span>
            </button>

            {/* Run Payroll */}
            <button
              onClick={() => setActiveTab('payroll')}
              className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold text-xs transition text-left"
            >
              <Banknote className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Run Payroll</span>
            </button>

            {/* View Reports */}
            <button
              onClick={() => setActiveTab('access_requests')}
              className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-semibold text-xs transition text-left"
            >
              <FileSpreadsheet className="w-4 h-4 text-cyan-600 shrink-0" />
              <span>View Reports</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Modal: Add New Employee Member */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden my-6 border border-slate-100">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add New Employee</h3>
                  <p className="text-[11px] text-slate-500">
                    Directly enrolls staff profile in {currentOrg.name} database.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddStaffOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStaff} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Sajal"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Saxena"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. sajal@company.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Initial Password</span>
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold flex items-center space-x-0.5"
                    >
                      <RefreshCw className="w-2.5 h-2.5 mr-0.5" /> Generate
                    </button>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="e.g. Strong@2026"
                      className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <Key className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
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
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager / Team Lead</option>
                    <option value="hr">HR Specialist</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="Development">Development / Tech</option>
                    <option value="Marketing">Marketing & Growth</option>
                    <option value="HR & Talent">HR & Talent Ops</option>
                    <option value="Design">Product & UI/UX</option>
                    <option value="Operations">Operations & Finance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Full Stack Dev"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Monthly Base (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <div className="flex gap-1 mt-1">
                    <button
                      type="button"
                      onClick={() => setBaseSalary('0')}
                      className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-semibold border border-amber-200 hover:bg-amber-100"
                    >
                      Unpaid (₹0)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBaseSalary('10000')}
                      className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-semibold border border-blue-200 hover:bg-blue-100"
                    >
                      Stipend (₹10k)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBaseSalary('50000')}
                      className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[9px] font-semibold border border-slate-200 hover:bg-slate-200"
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
                  value={assignedManagerId}
                  onChange={(e) => setAssignedManagerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">-- Direct to Organization Leadership --</option>
                  {orgProfiles
                    .filter((p) => p.role === 'manager' || p.role === 'owner' || p.role === 'hr')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.firstName} {m.lastName} ({m.role.toUpperCase()} - {m.designation})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStaff}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
                >
                  {isSubmittingStaff ? 'Creating...' : 'Enroll Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
