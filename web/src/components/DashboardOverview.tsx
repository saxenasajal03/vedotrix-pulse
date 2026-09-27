import React, { useState, useEffect } from 'react';
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
  Plus,
  Video,
  Megaphone,
  Pin,
  ExternalLink,
  Building2
} from 'lucide-react';
import { formatCurrency, formatSalaryOrStipend, getTodayISTDateString, formatISTTime, formatISTDate } from '../lib/serialUtils';
import { EditOrganizationModal } from './EditOrganizationModal';

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
    isVedotrixSuperadmin,
    orgProfiles,
    offerLetters,
    attendanceRecords,
    tasks,
    leaveRequests,
    accessRequests,
    meetings,
    notices,
    createProfile,
    getLeaveBalance,
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
  const [isEditOrgOpen, setIsEditOrgOpen] = useState(false);

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pwd);
    setShowPassword(true);
  };

  const todayStr = getTodayISTDateString();

  // Role Scoping:
  // 1. Top Leadership (Owner, Superadmin, HR, Root Superadmin) -> Org-wide KPIs
  // 2. Managers (managedTeam.length > 0) -> Only their managed team
  // 3. Individual Employees (manage 0 reports) -> Their personal metrics only
  const isTopLeadership =
    currentProfile?.role === 'hr' ||
    currentProfile?.role === 'owner' ||
    currentProfile?.role === 'superadmin' ||
    isVedotrixSuperadmin;

  const managedTeam = orgProfiles.filter((p) => p.managerId === currentProfile?.id);
  const isManager = !isTopLeadership && managedTeam.length > 0;
  const isIndividual = !isTopLeadership && !isManager;

  // 1. Top Leadership Metrics (Org-wide)
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

  // 2. Manager Metrics (Strictly scoped to employees managed by them)
  const managedTeamIds = new Set(managedTeam.map((m) => m.id));
  const managerPunches = todayPunches.filter((a) => managedTeamIds.has(a.employeeId));
  const managerPresentCount = managerPunches.filter((a) => a.status === 'present' || a.status === 'regularized').length;
  const managerOnLeaveCount = leaveRequests.filter(
    (l) => l.status === 'approved' && l.startDate <= todayStr && l.endDate >= todayStr && managedTeamIds.has(l.employeeId)
  ).length;
  const managerAbsentCount = Math.max(0, managedTeam.length - (managerPresentCount + managerOnLeaveCount));
  const managerAttendanceRate = managedTeam.length > 0 ? Math.round((managerPresentCount / managedTeam.length) * 100) : 0;
  const managerPendingApprovals =
    leaveRequests.filter((l) => l.status === 'pending' && (l.assignedApproverId === currentProfile?.id || managedTeamIds.has(l.employeeId))).length +
    attendanceRecords.filter((a) => a.regularizationStatus === 'pending' && managedTeamIds.has(a.employeeId)).length;

  // 3. Individual Employee Metrics (Strictly personal)
  const myTodayPunch = todayPunches.find((a) => a.employeeId === currentProfile?.id);
  const myActiveLeave = leaveRequests.find(
    (l) => l.employeeId === currentProfile?.id && (l.status === 'approved' || l.status === 'pending') && l.startDate <= todayStr && l.endDate >= todayStr
  );
  const myMonthPunchesCount = attendanceRecords.filter(
    (a) => a.employeeId === currentProfile?.id && a.date.startsWith(todayStr.slice(0, 7)) && (a.status === 'present' || a.status === 'regularized')
  ).length;
  const myPendingRequestsCount =
    leaveRequests.filter((l) => l.employeeId === currentProfile?.id && l.status === 'pending').length +
    attendanceRecords.filter((a) => a.employeeId === currentProfile?.id && a.regularizationStatus === 'pending').length;
  const myLeaveBal = getLeaveBalance(currentProfile?.id);
  const myAvailableDays = myLeaveBal.casual.remaining + myLeaveBal.sick.remaining + myLeaveBal.privilege.remaining;

  // Scoped metrics for Attendance Overview Donut Chart & Legend
  const displayTotal = isTopLeadership ? totalEmployees : isManager ? managedTeam.length : 1;
  const displayPresent = isTopLeadership
    ? presentCount
    : isManager
    ? managerPresentCount
    : (myTodayPunch && (myTodayPunch.status === 'present' || myTodayPunch.status === 'regularized') ? 1 : 0);
  const displayOnLeave = isTopLeadership ? onLeaveCount : isManager ? managerOnLeaveCount : (myActiveLeave ? 1 : 0);
  const displayAbsent = Math.max(0, displayTotal - (displayPresent + displayOnLeave));
  const displayRate = isTopLeadership
    ? attendanceRate
    : isManager
    ? managerAttendanceRate
    : (displayPresent ? 100 : 0);
  const displayRateLabel = isTopLeadership ? 'Present Today' : isManager ? 'Team Present' : (displayPresent ? 'Present Today' : myActiveLeave ? 'On Leave' : 'Not Punched');

  // Dynamic 7-day attendance trend data strictly scoped
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const label = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
    let count = 0;
    if (isTopLeadership) {
      count = attendanceRecords.filter((a) => a.date === dateStr && (a.status === 'present' || a.status === 'regularized')).length;
    } else if (isManager) {
      count = attendanceRecords.filter((a) => a.date === dateStr && managedTeamIds.has(a.employeeId) && (a.status === 'present' || a.status === 'regularized')).length;
    } else {
      count = attendanceRecords.filter((a) => a.date === dateStr && a.employeeId === currentProfile?.id && (a.status === 'present' || a.status === 'regularized')).length;
    }
    return { dateStr, label, count };
  });

  const maxChartCount = isTopLeadership
    ? Math.max(...last7Days.map((d) => d.count), totalEmployees, 5)
    : isManager
    ? Math.max(...last7Days.map((d) => d.count), managedTeam.length, 3)
    : 1;

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

  // Dynamic IST Clock and Greeting
  const [liveISTTime, setLiveISTTime] = useState(() => {
    return new Date().toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveISTTime(
        new Date().toLocaleTimeString('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })
      );
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const getISTGreeting = () => {
    const istHours = parseInt(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        hour12: false
      }).format(new Date()),
      10
    );

    if (istHours >= 4 && istHours < 12) return { greeting: 'Good Morning', icon: '🌅' };
    if (istHours >= 12 && istHours < 17) return { greeting: 'Good Afternoon', icon: '☀️' };
    if (istHours >= 17 && istHours < 22) return { greeting: 'Good Evening', icon: '🌆' };
    return { greeting: 'Good Night', icon: '🌙' };
  };

  const istGreeting = getISTGreeting();

  // Hierarchy Activity Scoping:
  // Elevated roles (Superadmin, Owner, HR) see all org activities.
  // Managers see their own activities plus those of their direct reports.
  // Regular employees see only their own activities.
  const isElevatedRole =
    currentProfile?.role === 'superadmin' ||
    currentProfile?.role === 'owner' ||
    currentProfile?.role === 'hr' ||
    isVedotrixSuperadmin;

  const directReportIds = new Set(
    orgProfiles.filter((p) => p.managerId === currentProfile?.id).map((p) => p.id)
  );

  const canViewEmployeeActivity = (targetEmployeeId?: string) => {
    if (isElevatedRole) return true;
    if (!targetEmployeeId) return false;
    if (targetEmployeeId === currentProfile?.id) return true;
    if (directReportIds.has(targetEmployeeId)) return true;
    return false;
  };

  // Dynamic Recent Activities strictly scoped by hierarchy
  const dynamicActivities: Array<{
    id: string;
    title: string;
    time: string;
    color: string;
    icon: any;
  }> = [];

  [...attendanceRecords]
    .filter((a) => a.checkInTime && canViewEmployeeActivity(a.employeeId))
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
    .filter((l) => canViewEmployeeActivity(l.employeeId))
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
    .filter((t) => canViewEmployeeActivity(t.assignedTo) || t.createdBy === currentProfile?.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 2)
    .forEach((t) => {
      dynamicActivities.push({
        id: `task-${t.id}`,
        title: `Task: ${t.title}`,
        time: formatISTDate(t.createdAt),
        color: 'bg-blue-100 text-blue-600',
        icon: FileText
      });
    });

  [...offerLetters]
    .filter((o) => canViewEmployeeActivity(o.employeeId) || o.managerId === currentProfile?.id || o.issuedBy === currentProfile?.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 2)
    .forEach((o) => {
      dynamicActivities.push({
        id: `offer-${o.id}`,
        title: `Offer letter ${o.serialNumber} for ${o.candidateName}`,
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
      {/* 1. Header Greeting & Weather/Date Widget with Dynamic IST Time */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            {istGreeting.greeting}, {currentProfile?.firstName || 'Team Member'}! {istGreeting.icon}
          </h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
              <Clock className="w-3 h-3 mr-1" />
              {liveISTTime} IST
            </span>
            <span>•</span>
            <span>Indian Standard Time (Asia/Kolkata)</span>
            <span>•</span>
            <span className="font-medium text-slate-700">{currentOrg.name}</span>
          </p>
        </div>

        <div className="flex items-center space-x-3 text-right shrink-0">
          <div>
            <p className="text-xs font-semibold text-slate-700">
              {new Date().toLocaleDateString('en-IN', {
                timeZone: 'Asia/Kolkata',
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </p>
            <div className="flex items-center justify-end space-x-1.5 text-xs text-slate-500 mt-0.5">
              <Sun className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span className="font-bold text-slate-800">28°C</span>
              <span className="text-slate-400 font-medium">IST Zone</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top 4 Metric Summary Cards scoped by role & management hierarchy */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Headcount / Managed Team / Today's Presence */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md transition">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">
                {isTopLeadership
                  ? 'Total Employees'
                  : isManager
                  ? 'My Managed Team'
                  : "Today's Presence"}
              </span>
              <div className="text-2xl font-extrabold text-slate-900 leading-tight">
                {isTopLeadership
                  ? totalEmployees
                  : isManager
                  ? managedTeam.length
                  : (myTodayPunch ? 'PRESENT' : myActiveLeave ? 'ON LEAVE' : 'NOT PUNCHED')}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center text-[11px] font-semibold text-purple-600">
            <span>
              {isTopLeadership
                ? `${totalEmployees} Active in ${currentOrg.orgCode}`
                : isManager
                ? `${managedTeam.length} Direct Reports assigned to you`
                : 'Punched at IST office / remote location'}
            </span>
          </div>
        </div>

        {/* Card 2: Present Today / Team Present / Monthly Attendance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md transition">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">
                {isTopLeadership
                  ? 'Present Today (IST)'
                  : isManager
                  ? 'Team Present Today'
                  : 'Monthly Present Days'}
              </span>
              <div className="text-2xl font-extrabold text-slate-900 leading-tight">
                {isTopLeadership
                  ? presentCount
                  : isManager
                  ? `${managerPresentCount} / ${managedTeam.length}`
                  : `${myMonthPunchesCount} Days`}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center text-[11px] font-semibold text-emerald-600">
            <span>
              {isTopLeadership
                ? `${attendanceRate}% organization rate`
                : isManager
                ? `${managerAttendanceRate}% of managed direct reports`
                : 'Logged this calendar month (IST)'}
            </span>
          </div>
        </div>

        {/* Card 3: On Leave / Team on Leave / Personal Leave Balance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md transition">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">
                {isTopLeadership
                  ? 'On Leave Today'
                  : isManager
                  ? 'Team on Leave'
                  : 'My Leave Balance'}
              </span>
              <div className="text-2xl font-extrabold text-slate-900 leading-tight">
                {isTopLeadership
                  ? onLeaveCount
                  : isManager
                  ? managerOnLeaveCount
                  : `${myAvailableDays} Days`}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center text-[11px] font-semibold text-amber-600">
            <span>
              {isTopLeadership
                ? `${onLeaveRate}% of total staff`
                : isManager
                ? 'Direct reports on leave today'
                : 'Casual + Sick + Privilege remaining'}
            </span>
          </div>
        </div>

        {/* Card 4: Approvals / Team Approvals / Personal Pending Requests */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md transition">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">
                {isTopLeadership
                  ? 'Pending Approvals'
                  : isManager
                  ? 'Team Approvals'
                  : 'My Pending Requests'}
              </span>
              <div className="text-2xl font-extrabold text-slate-900 leading-tight">
                {isTopLeadership
                  ? pendingApprovalsCount
                  : isManager
                  ? managerPendingApprovals
                  : myPendingRequestsCount}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center text-[11px] font-medium text-slate-400">
            <span>
              {isTopLeadership
                ? 'Leave / Attendance / Access'
                : isManager
                ? 'Awaiting your manager sign-off'
                : 'Leave or regularization pending decision'}
            </span>
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
              <span>
                {isTopLeadership
                  ? 'Past 7 Days (Organization-wide)'
                  : isManager
                  ? 'Past 7 Days (My Managed Team)'
                  : 'Past 7 Days (My Attendance)'}
              </span>
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
                    strokeDashoffset={238.76 - 238.76 * (displayTotal > 0 ? displayPresent / displayTotal : 0)}
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
                    strokeDashoffset={238.76 - 238.76 * (displayTotal > 0 ? displayOnLeave / displayTotal : 0)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xl font-extrabold text-slate-900 leading-tight">{displayRate}%</span>
                  <span className="text-[10px] text-slate-400 font-semibold">{displayRateLabel}</span>
                </div>
              </div>

              {/* Dynamic Legend */}
              <div className="w-full space-y-1.5 mt-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 mr-2" />
                    Present
                  </span>
                  <span className="font-bold text-slate-800">{displayPresent}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-2" />
                    On Leave
                  </span>
                  <span className="font-bold text-slate-800">{displayOnLeave}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300 mr-2" />
                    Pending / Out
                  </span>
                  <span className="font-bold text-slate-800">{displayAbsent}</span>
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

            {/* Edit Organization Profile (HR, Owner, Superadmin) */}
            {isElevatedRole && (
              <button
                onClick={() => setIsEditOrgOpen(true)}
                className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs transition text-left"
              >
                <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Organization Profile</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Interactive Widgets: Today's Meetings & Corporate Notice Board */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's Meetings & Video Conferences */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Meetings & Sessions 📅</h2>
                  <p className="text-[10px] text-slate-400">Assigned by Manager or Superadmin</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('meetings')}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center"
              >
                Full Calendar →
              </button>
            </div>

            <div className="divide-y divide-slate-100 mt-2 space-y-2">
              {meetings.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <p className="font-semibold text-slate-500">No scheduled meetings.</p>
                  <p className="text-[10px] text-slate-400 mt-1">Sessions scheduled by leadership or managers appear here.</p>
                </div>
              ) : (
                meetings.slice(0, 3).map((meeting) => (
                  <div key={meeting.id} className="pt-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-900 truncate">{meeting.title}</span>
                        {meeting.date === todayStr && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-blue-100 text-blue-700 uppercase">
                            Today
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                        <span className="font-mono text-blue-600 font-semibold">{meeting.startTime} IST</span>
                        <span>•</span>
                        <span>{meeting.organizerName}</span>
                        <span>•</span>
                        <span className="capitalize">{meeting.isOnline ? 'Online 🎥' : meeting.location}</span>
                      </p>
                    </div>

                    {meeting.isOnline && meeting.meetingUrl && (
                      <a
                        href={meeting.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs shrink-0 self-start sm:self-center"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Join 🎥</span>
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Corporate Notice Board Feed */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Notice Board 📢</h2>
                  <p className="text-[10px] text-slate-400">Corporate circulars & holiday notices</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('notices')}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center"
              >
                All Notices →
              </button>
            </div>

            <div className="divide-y divide-slate-100 mt-2 space-y-2">
              {notices.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <p className="font-semibold text-slate-500">Notice board is clear.</p>
                  <p className="text-[10px] text-slate-400 mt-1">Official circulars and announcements will appear here.</p>
                </div>
              ) : (
                notices.slice(0, 3).map((notice) => (
                  <div key={notice.id} className="pt-2.5">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center space-x-1.5">
                        {notice.isPinned && (
                          <Pin className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                        )}
                        <span className="text-xs font-bold text-slate-900 line-clamp-1">{notice.title}</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 shrink-0">
                        {notice.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {notice.content}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                      <span>By {notice.authorName} ({notice.authorRole.toUpperCase()})</span>
                      <span>{formatISTDate(notice.date || notice.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Modal: Add New Employee Member */}
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

      {/* Edit Organization Modal */}
      <EditOrganizationModal
        isOpen={isEditOrgOpen}
        onClose={() => setIsEditOrgOpen(false)}
      />
    </div>
  );
};
