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
import { formatCurrency, formatSalaryOrStipend, getTodayISTDateString, formatISTTime, formatISTDate } from '../lib/serialUtils';

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

  // 100% Dynamic KPI computations strictly from Supabase live state (No fake fallbacks)
  const todayStr = getTodayISTDateString();
  const totalEmployees = orgProfiles.length;
  const todayPunches = attendanceRecords.filter((a) => a.date === todayStr);
  const presentCount = todayPunches.filter((a) => a.status === 'present' || a.status === 'regularized').length;
  const halfDayCount = todayPunches.filter((a) => a.status === 'half_day').length;
  const onLeaveCount = leaveRequests.filter((l) => l.status === 'approved' && l.startDate <= todayStr && l.endDate >= todayStr).length;
  const absentCount = Math.max(0, totalEmployees - (presentCount + halfDayCount + onLeaveCount));

  const attendanceRate = totalEmployees > 0 ? Math.round(((presentCount + halfDayCount * 0.5) / totalEmployees) * 100) : 0;
  const onLeaveRate = totalEmployees > 0 ? Math.round((onLeaveCount / totalEmployees) * 100) : 0;

  const pendingApprovalsCount =
    leaveRequests.filter((l) => l.status === 'pending').length +
    attendanceRecords.filter((a) => a.regularizationStatus === 'pending').length +
    accessRequests.filter((r) => r.status === 'pending').length;

  // Dynamic 7-day attendance trend data strictly from records
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const label = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
    const count = attendanceRecords.filter((a) => a.date === dateStr && (a.status === 'present' || a.status === 'regularized')).length;
    return { dateStr, label, count };
  });

  const maxChartCount = Math.max(...last7Days.map((d) => d.count), totalEmployees, 5);
  const chartPoints = last7Days.map((d, index) => {
    const x = 30 + index * (265 / 6);
    const normalizedY = maxChartCount > 0 ? d.count / maxChartCount : 0;
    const y = 120 - normalizedY * 95;
    return { x, y, count: d.count, label: d.label };
  });

  const pathD = chartPoints.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');
  const areaD = `${pathD} L ${chartPoints[chartPoints.length - 1].x} 120 L ${chartPoints[0].x} 120 Z`;

  // Dynamic Recent Activities derived strictly from real Supabase tenant rows
  const dynamicActivities: Array<{
    id: string;
    title: string;
    time: string;
    color: string;
    icon: any;
  }> = [];

  [...attendanceRecords]
    .filter((a) => a.checkInTime)
    .sort((a, b) => new Date(b.checkInTime!).getTime() - new Date(a.checkInTime!).getTime())
    .slice(0, 3)
    .forEach((a) => {
      const emp = orgProfiles.find((p) => p.id === a.employeeId);
      dynamicActivities.push({
        id: `att-${a.id}`,
        title: `${emp ? `${emp.firstName} ${emp.lastName}` : 'Employee'} marked attendance`,
        time: `${formatISTTime(a.checkInTime!)} IST`,
        color: 'bg-emerald-100 text-emerald-600',
        icon: CheckCircle2
      });
    });

  [...leaveRequests]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 2)
    .forEach((l) => {
      const emp = orgProfiles.find((p) => p.id === l.employeeId);
      dynamicActivities.push({
        id: `leave-${l.id}`,
        title: `${emp ? `${emp.firstName} ${emp.lastName}` : 'Employee'} applied for ${l.leaveType} leave`,
        time: formatISTDate(l.startDate),
        color: 'bg-rose-100 text-rose-600',
        icon: Calendar
      });
    });

  [...tasks]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 2)
    .forEach((t) => {
      dynamicActivities.push({
        id: `task-${t.id}`,
        title: `Task assigned: ${t.title}`,
        time: formatISTDate(t.createdAt),
        color: 'bg-blue-100 text-blue-600',
        icon: FileText
      });
    });

  [...offerLetters]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 2)
    .forEach((o) => {
      dynamicActivities.push({
        id: `offer-${o.id}`,
        title: `Offer letter ${o.serialNumber} issued for ${o.candidateName}`,
        time: formatISTDate(o.createdAt),
        color: 'bg-indigo-100 text-indigo-600',
        icon: UserPlus
      });
    });

  const recentActivities = dynamicActivities.slice(0, 5);

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

  return (
    <div className="space-y-6">
      {/* 1. Header Greeting & Weather/Date Widget */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Good Morning, {currentProfile?.firstName || 'Team Member'}! 👋
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
                {totalEmployees}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center text-[11px] font-semibold text-emerald-600">
            <span className="inline-flex items-center">{totalEmployees} Active in {currentOrg.orgCode}</span>
          </div>
        </div>

        {/* Present Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md transition">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">Present Today (IST)</span>
              <div className="text-2xl font-extrabold text-slate-900 leading-tight">
                {presentCount}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center text-[11px] font-semibold text-emerald-600">
            <span>{attendanceRate}% attendance rate</span>
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
                {onLeaveCount}
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
                {pendingApprovalsCount}
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
              <span>Past 7 Days (IST)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-4 items-center">
            {/* Left: Dynamic 7-Day Trend Line Chart */}
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
                  <line x1="0" y1="72" x2="320" y2="72" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="25" x2="320" y2="25" stroke="#f1f5f9" strokeWidth="1" />

                  {/* Y-Axis Labels */}
                  <text x="5" y="118" fill="#94a3b8" fontSize="9" fontFamily="sans-serif">0</text>
                  <text x="5" y="70" fill="#94a3b8" fontSize="9" fontFamily="sans-serif">{Math.round(maxChartCount * 0.5)}</text>
                  <text x="5" y="23" fill="#94a3b8" fontSize="9" fontFamily="sans-serif">{maxChartCount}</text>

                  {/* Dynamic Shaded Area Fill */}
                  <path
                    d={areaD}
                    fill="url(#areaGradient)"
                  />

                  {/* Dynamic Smooth Line Stroke */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />

                  {/* Dynamic Data Points */}
                  {chartPoints.map((pt, idx) => (
                    <circle
                      key={idx}
                      cx={pt.x}
                      cy={pt.y}
                      r={idx === chartPoints.length - 1 ? 4.5 : 3}
                      fill={idx === chartPoints.length - 1 ? '#2563eb' : '#ffffff'}
                      stroke="#2563eb"
                      strokeWidth={idx === chartPoints.length - 1 ? 2.5 : 1.5}
                    />
                  ))}
                </svg>

                {/* Dynamic X-Axis Dates */}
                <div className="flex justify-between text-[9px] text-slate-400 font-medium px-2 pt-1">
                  {chartPoints.map((pt, idx) => (
                    <span key={idx}>{pt.label}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Dynamic Donut Chart with Live Legend */}
            <div className="md:col-span-5 flex flex-col items-center justify-center">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Background track */}
                  <circle cx="50" cy="50" r="38" stroke="#f1f5f9" strokeWidth="10" fill="none" />
                  {/* Present Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    stroke="#2563eb"
                    strokeWidth="10"
                    fill="none"
                    strokeDasharray="238.76"
                    strokeDashoffset={238.76 - 238.76 * (totalEmployees > 0 ? presentCount / totalEmployees : 0)}
                    strokeLinecap="round"
                  />
                  {/* On Leave Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    stroke="#f59e0b"
                    strokeWidth="10"
                    fill="none"
                    strokeDasharray="238.76"
                    strokeDashoffset={238.76 - 238.76 * (totalEmployees > 0 ? onLeaveCount / totalEmployees : 0)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xl font-extrabold text-slate-900 leading-tight">{attendanceRate}%</span>
                  <span className="text-[10px] text-slate-400 font-semibold">Present Today</span>
                </div>
              </div>

              {/* Dynamic Legend */}
              <div className="w-full space-y-1.5 mt-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 mr-2" />
                    Present
                  </span>
                  <span className="font-bold text-slate-800">{presentCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-2" />
                    On Leave
                  </span>
                  <span className="font-bold text-slate-800">{onLeaveCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300 mr-2" />
                    Pending / Out
                  </span>
                  <span className="font-bold text-slate-800">{absentCount}</span>
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
              {recentActivities.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <p className="font-semibold text-slate-500">No activities logged yet.</p>
                  <p className="text-[10px] text-slate-400 mt-1">Live events like attendance punches and requests will appear here.</p>
                </div>
              ) : (
                recentActivities.map((act) => {
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
                })
              )}
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
