import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { GeoAttendanceCard } from './GeoAttendanceCard';
import { RegularizationApprovalQueue } from './RegularizationApprovalQueue';
import {
  Users,
  MapPin,
  FileCheck2,
  KanbanSquare,
  ShieldCheck,
  TrendingUp,
  Clock,
  Sparkles,
  ArrowRight,
  UserPlus,
  Plus,
  Mail,
  CheckCircle2,
  Calendar,
  Key,
  Eye,
  EyeOff,
  Phone,
  RefreshCw
} from 'lucide-react';
import { formatCurrency } from '../lib/serialUtils';

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
  const { currentOrg, orgProfiles, offerLetters, attendanceRecords, tasks, standups, leaveRequests, createProfile } = useApp();

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
  const [department, setDepartment] = useState('Engineering');
  const [baseSalary, setBaseSalary] = useState('65000');
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

  const isTech = currentOrg.industry === 'Tech';
  const todayStr = new Date().toISOString().split('T')[0];
  const todayPunches = attendanceRecords.filter((a) => a.date === todayStr);
  const presentCount = todayPunches.filter((a) => a.status === 'present' || a.status === 'regularized').length;
  const attendanceRate = orgProfiles.length > 0 ? Math.round((presentCount / orgProfiles.length) * 100) : 0;
  const onLeaveCount = leaveRequests.filter((l) => l.status === 'approved' && l.startDate <= todayStr && l.endDate >= todayStr).length;

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
      baseSalary: Number(baseSalary) || 50000,
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
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-950 p-6 sm:p-8 border border-slate-800 shadow-2xl">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-semibold border border-indigo-500/30">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Multi-Tenant Architecture Active</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300">{currentOrg.name}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {isTech
              ? 'Complete workforce management platform for technology companies: Geo-fenced attendance, agile sprint workflows, tamper-proof offer letter verification, and payroll.'
              : 'Growth agency operations suite: Campaign ad-spend deliverables, client ROAS tracking, field visit regularizations, and banking batch payouts.'}
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('leaves')}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold border border-cyan-500/40 transition"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Leave Management ({onLeaveCount} On Leave Today)</span>
            </button>
            <button
              onClick={() => setActiveTab('offers')}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-bold border border-indigo-500/40 transition"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Offer Letters & Contracts</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Total Employees */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 sm:p-4 rounded-xl shadow hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-400">Workforce</span>
            <button
              onClick={() => setIsAddStaffOpen(true)}
              className="px-2 py-0.5 sm:py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 text-[9px] sm:text-[10px] font-bold border border-indigo-500/30 flex items-center space-x-1 transition"
              title="Add Team Member & Dispatch Welcome Email"
            >
              <UserPlus className="w-3 h-3" />
              <span>+ Add Staff</span>
            </button>
          </div>
          <p className="text-2xl font-extrabold text-white mt-2 font-mono">{orgProfiles.length}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Active Profiles</span>
        </div>

        {/* Metric 2: Today's Attendance */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Today's Attendance</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-emerald-400 mt-2 font-mono">{attendanceRate}%</p>
          <span className="text-[11px] text-emerald-500/80 mt-1 block">{presentCount} Present / Regularized</span>
        </div>

        {/* Metric 3: Active Tasks */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">
              {isTech ? 'Active Sprint Tasks' : 'Active Campaigns'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <KanbanSquare className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-white mt-2 font-mono">
            {tasks.filter((t) => t.status !== 'done').length}
          </p>
          <span className="text-[11px] text-cyan-400/80 mt-1 block">In Progress / Review</span>
        </div>

        {/* Metric 4: Verified Offer Letters */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Offer Letters</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-white mt-2 font-mono">{offerLetters.length}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Cryptographic Serials</span>
        </div>
      </div>

      {/* Geo-Attendance Punch Card */}
      <GeoAttendanceCard
        onRequestRegularization={onRequestRegularization}
        onOpenStandup={onOpenStandup}
      />

      {/* Pending Regularizations (If any) */}
      <RegularizationApprovalQueue />

      {/* Two Column Section: Recent Tasks & Recent Offers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tasks Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              {isTech ? 'Active Sprint Tasks' : 'Recent Campaign Deliverables'}
            </h3>
            <button
              onClick={() => setActiveTab('tasks')}
              className="text-xs text-indigo-400 hover:underline flex items-center"
            >
              <span>View Board</span>
              <ArrowRight className="w-3 h-3 ml-1" />
            </button>
          </div>

          <div className="space-y-2.5">
            {tasks.slice(0, 3).map((task) => (
              <div
                key={task.id}
                className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <h4 className="font-bold text-slate-200">{task.title}</h4>
                  <span className="text-[10px] text-slate-400">
                    {task.gitBranch || task.campaignName || 'General Task'}
                  </span>
                </div>
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                    task.status === 'done'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : task.status === 'in_progress'
                      ? 'bg-indigo-500/20 text-indigo-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {task.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Offer Letters Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Issued Offer Letters & Serials
            </h3>
            <button
              onClick={() => setActiveTab('offers')}
              className="text-xs text-indigo-400 hover:underline flex items-center"
            >
              <span>Manage Offers</span>
              <ArrowRight className="w-3 h-3 ml-1" />
            </button>
          </div>

          <div className="space-y-2.5">
            {offerLetters.slice(0, 3).map((offer) => (
              <div
                key={offer.id}
                className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center space-x-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-mono text-cyan-300 font-bold">{offer.serialNumber}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {offer.candidateName} • {offer.designation}
                  </span>
                </div>

                <button
                  onClick={() => onOpenVerify(offer.serialNumber)}
                  className="px-2.5 py-1 bg-emerald-950 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold rounded hover:bg-emerald-900 transition"
                >
                  Verify
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Staff Member Modal */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Add Staff / Onboard Employee</h3>
              </div>
              <button
                onClick={() => setIsAddStaffOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStaff} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. John"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Doe"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Work Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. john.doe@company.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>Initial Login Password *</span>
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium flex items-center space-x-1"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Generate</span>
                    </button>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="e.g. Pass@2026"
                      className="w-full pl-8 pr-9 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-indigo-500"
                    />
                    <Key className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Phone</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
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
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Access Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="employee">Staff Employee</option>
                    <option value="manager">Team Manager</option>
                    <option value="hr">HR Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Engineering">Engineering / Tech</option>
                    <option value="Marketing">Growth & Marketing</option>
                    <option value="HR & Talent">HR & Talent Ops</option>
                    <option value="Design">Product & UI/UX</option>
                    <option value="Operations">Operations & Finance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Designation</label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Senior Frontend Engineer"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Monthly Base (₹)</label>
                  <input
                    type="number"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    placeholder="50000"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Designated Reporting Manager (Hierarchy Approver)
                </label>
                <select
                  value={assignedManagerId}
                  onChange={(e) => setAssignedManagerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Direct to Organization Owner / Leadership --</option>
                  {orgProfiles
                    .filter((p) => p.role === 'manager' || p.role === 'owner' || p.role === 'hr')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.firstName} {m.lastName} ({m.role.toUpperCase()} - {m.designation})
                      </option>
                    ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  All module access requests & approvals from this employee will route exclusively to this manager.
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center space-x-1.5 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Cloud Persistence & Supabase Mailer</span>
                </div>
                <p>Profile is written directly to AWS ap-northeast-1 Supabase instance and Welcome Onboarding notice is queued immediately.</p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStaff}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-cyan-500 text-slate-950 font-bold text-xs rounded-lg transition shadow-md disabled:opacity-50"
                >
                  {isSubmittingStaff ? 'Registering...' : 'Add Staff & Send Mail'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
