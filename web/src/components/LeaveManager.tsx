import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { LeaveRequest, LeaveType, LeaveStatus } from '../types';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  FileText,
  User,
  Users,
  ShieldCheck,
  Send,
  UploadCloud,
  Check,
  X,
  Filter,
  Search,
  Sparkles,
  ArrowRight,
  DownloadCloud,
  HeartPulse,
  Sun,
  Award,
  HelpCircle,
  ChevronRight
} from 'lucide-react';
import { uploadFileToStorage } from '../lib/storage';

export const LeaveManager: React.FC = () => {
  const {
    currentOrg,
    currentProfile,
    orgProfiles,
    leaveRequests,
    submitLeaveRequest,
    resolveLeaveRequest,
    cancelLeaveRequest,
    getLeaveBalance,
    addToast
  } = useApp();

  const canApprove =
    currentProfile.role === 'manager' ||
    currentProfile.role === 'hr' ||
    currentProfile.role === 'owner' ||
    currentProfile.role === 'superadmin';

  // Active view tab
  const [activeTab, setActiveTab] = useState<'my_leaves' | 'approvals' | 'calendar'>('my_leaves');

  // Modals
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);

  // Apply Form State
  const [leaveType, setLeaveType] = useState<LeaveType>('casual');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDaySession, setHalfDaySession] = useState<'first_half' | 'second_half'>('first_half');
  const [reason, setReason] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [docName, setDocName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Approval Decision Remarks Map
  const [decisionNotes, setDecisionNotes] = useState<{ [key: string]: string }>({});

  // Employee's Leave Balance
  const myBalance = getLeaveBalance(currentProfile.id);

  // Filter pending approvals relevant to current user
  const pendingApprovals = leaveRequests.filter((l) => {
    if (l.status !== 'pending') return false;
    if (currentProfile.role === 'superadmin') return true;
    if (currentProfile.role === 'owner') return l.orgId === currentOrg.id;
    if (l.assignedApproverId === currentProfile.id) return true;
    if (currentProfile.role === 'hr' && l.orgId === currentOrg.id) return true;
    return false;
  });

  // Calculate days count
  const calculateDays = () => {
    if (isHalfDay) return 0.5;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) return 0;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const totalRequestedDays = calculateDays();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const res = await uploadFileToStorage(file, 'documents', 'leave_proof');
    if (res.success && res.url) {
      setDocUrl(res.url);
      setDocName(file.name);
      addToast('Document Attached 📄', `Attached "${file.name}" to leave application.`, 'success');
    } else {
      addToast('Upload Failed', res.error || 'Could not upload attachment.', 'error');
    }
    setIsUploading(false);
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      addToast('Required Field', 'Please provide a reason for the leave.', 'warning');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      addToast('Invalid Dates', 'End date cannot be earlier than start date.', 'warning');
      return;
    }

    await submitLeaveRequest({
      leaveType,
      startDate,
      endDate: isHalfDay ? startDate : endDate,
      totalDays: totalRequestedDays,
      isHalfDay,
      halfDaySession: isHalfDay ? halfDaySession : undefined,
      reason: reason.trim(),
      documentUrl: docUrl || undefined
    });

    setIsApplyModalOpen(false);
    setReason('');
    setDocUrl('');
    setDocName('');
    setIsHalfDay(false);
  };

  const handleResolve = async (leaveId: string, status: 'approved' | 'rejected') => {
    const notes = decisionNotes[leaveId] || '';
    await resolveLeaveRequest(leaveId, status, notes);
    setDecisionNotes((prev) => {
      const next = { ...prev };
      delete next[leaveId];
      return next;
    });
  };

  const myLeaves = leaveRequests.filter((l) => l.employeeId === currentProfile.id);

  // Today on leave
  const todayStr = new Date().toISOString().split('T')[0];
  const onLeaveToday = leaveRequests.filter(
    (l) => l.status === 'approved' && l.startDate <= todayStr && l.endDate >= todayStr
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-extrabold text-white">Leave & Time-Off Management</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              Enterprise HRMS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Quota tracking, multi-tier approvals, half-day leaves, and automated payroll sync.
          </p>
        </div>

        <button
          onClick={() => setIsApplyModalOpen(true)}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/30"
        >
          <Plus className="w-4 h-4" />
          <span>Apply for Leave</span>
        </button>
      </div>

      {/* Leave Balance Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Casual Leave */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Casual Leave (CL)</span>
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Sun className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-white font-mono">{myBalance.casual.remaining}</span>
            <span className="text-xs text-slate-500">/ {myBalance.casual.total} Days Left</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-cyan-400 h-1.5 rounded-full transition-all"
              style={{ width: `${(myBalance.casual.used / myBalance.casual.total) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-500 block">{myBalance.casual.used} Days Consumed</span>
        </div>

        {/* Sick Leave */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Sick Leave (SL)</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
              <HeartPulse className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-white font-mono">{myBalance.sick.remaining}</span>
            <span className="text-xs text-slate-500">/ {myBalance.sick.total} Days Left</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-rose-400 h-1.5 rounded-full transition-all"
              style={{ width: `${(myBalance.sick.used / myBalance.sick.total) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-500 block">{myBalance.sick.used} Days Consumed</span>
        </div>

        {/* Privilege Leave */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Privilege Leave (PL)</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-white font-mono">{myBalance.privilege.remaining}</span>
            <span className="text-xs text-slate-500">/ {myBalance.privilege.total} Days Left</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-indigo-400 h-1.5 rounded-full transition-all"
              style={{ width: `${(myBalance.privilege.used / myBalance.privilege.total) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-500 block">{myBalance.privilege.used} Days Consumed</span>
        </div>

        {/* Unpaid / LOP */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Unpaid / LOP</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-amber-400 font-mono">{myBalance.unpaid.used}</span>
            <span className="text-xs text-slate-500">Days Taken</span>
          </div>
          <span className="text-[10px] text-slate-500 block pt-3.5">
            Deducted from monthly payroll as Loss of Pay
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('my_leaves')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'my_leaves'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          My Leave History ({myLeaves.length})
        </button>

        {canApprove && (
          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'approvals'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <span>Team Approvals Queue</span>
            {pendingApprovals.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-amber-400 text-slate-950">
                {pendingApprovals.length}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => setActiveTab('calendar')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
            activeTab === 'calendar'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <span>Who's On Leave Today</span>
          {onLeaveToday.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-400 text-slate-950">
              {onLeaveToday.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: MY LEAVE APPLICATIONS */}
      {activeTab === 'my_leaves' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200">
              My Applied Leaves ({myLeaves.length})
            </h3>
            <span className="text-[10px] text-slate-400">
              Syncs with Attendance and Payroll
            </span>
          </div>

          {myLeaves.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 space-y-2">
              <Calendar className="w-8 h-8 text-slate-600 mx-auto" />
              <p>You haven't submitted any leave applications yet.</p>
              <button
                onClick={() => setIsApplyModalOpen(true)}
                className="text-xs text-indigo-400 font-bold hover:underline"
              >
                Apply for leave now →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {myLeaves.map((leave) => {
                const approver = orgProfiles.find((p) => p.id === leave.assignedApproverId);
                return (
                  <div key={leave.id} className="p-4 hover:bg-slate-800/40 transition space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white uppercase bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          {leave.leaveType}
                        </span>
                        <span className="text-xs font-bold text-cyan-400 font-mono">
                          {leave.totalDays} Day(s) {leave.isHalfDay ? `(Half-Day • ${leave.halfDaySession})` : ''}
                        </span>
                        <span className="text-xs text-slate-400">
                          {leave.startDate} {leave.startDate !== leave.endDate ? `to ${leave.endDate}` : ''}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {leave.status === 'pending' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            <Clock className="w-3 h-3 mr-1" /> Pending Review
                          </span>
                        )}
                        {leave.status === 'approved' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Approved
                          </span>
                        )}
                        {leave.status === 'rejected' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            <XCircle className="w-3 h-3 mr-1" /> Rejected
                          </span>
                        )}
                        {leave.status === 'cancelled' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300">
                            Cancelled
                          </span>
                        )}

                        {leave.status === 'pending' && (
                          <button
                            onClick={() => cancelLeaveRequest(leave.id)}
                            className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold underline ml-2"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                      <strong>Reason:</strong> {leave.reason}
                    </p>

                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
                      <div className="flex items-center space-x-3">
                        <span>
                          Approver: <strong className="text-slate-400">{approver ? `${approver.firstName} ${approver.lastName}` : 'Management'}</strong>
                        </span>
                        {leave.documentUrl && (
                          <a
                            href={leave.documentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-400 hover:underline inline-flex items-center space-x-1"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Attached Proof</span>
                          </a>
                        )}
                      </div>

                      {leave.approverDecisionNotes && (
                        <span className="text-slate-400">
                          Remarks: <em className="text-slate-300">"{leave.approverDecisionNotes}"</em>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TEAM APPROVALS QUEUE */}
      {canApprove && activeTab === 'approvals' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl space-y-4">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-200">
                Team Leave Approval Queue ({pendingApprovals.length} Pending)
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Review and approve leave applications for your team. Approved leaves update presence and payroll.
              </p>
            </div>
          </div>

          {pendingApprovals.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
              No pending leave applications in your queue.
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {pendingApprovals.map((req) => {
                const employee = orgProfiles.find((p) => p.id === req.employeeId);
                const empBalance = getLeaveBalance(req.employeeId);
                const currentNotes = decisionNotes[req.id] || '';

                return (
                  <div
                    key={req.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center font-bold text-xs text-cyan-400">
                          {employee?.firstName[0] || 'U'}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="text-xs font-bold text-white">
                              {employee ? `${employee.firstName} ${employee.lastName}` : 'Team Member'}
                            </h4>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {employee?.designation}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {employee?.department} • {employee?.email}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-cyan-300 bg-cyan-950/60 px-2.5 py-1 rounded-lg border border-cyan-500/30 font-mono">
                          {req.totalDays} Day(s) {req.leaveType.toUpperCase()}
                        </span>
                        {req.isHalfDay && (
                          <span className="text-[10px] text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/30">
                            Half-Day ({req.halfDaySession})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800/60 space-y-1">
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Requested Dates</span>
                        <p className="text-white font-semibold">
                          {req.startDate} to {req.endDate}
                        </p>
                        <p className="text-[11px] text-slate-300 mt-1">
                          <strong>Reason:</strong> {req.reason}
                        </p>
                        {req.documentUrl && (
                          <a
                            href={req.documentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center space-x-1 text-[11px] text-cyan-400 hover:underline pt-1"
                          >
                            <FileText className="w-3 h-3" />
                            <span>View Attached Document</span>
                          </a>
                        )}
                      </div>

                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800/60 space-y-1">
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Applicant Balance</span>
                        <div className="grid grid-cols-3 gap-1 pt-1 text-center text-[10px]">
                          <div className="p-1.5 bg-slate-950 rounded border border-slate-800">
                            <span className="text-slate-400 block">CL Left</span>
                            <span className="font-bold text-white font-mono">{empBalance.casual.remaining}</span>
                          </div>
                          <div className="p-1.5 bg-slate-950 rounded border border-slate-800">
                            <span className="text-slate-400 block">SL Left</span>
                            <span className="font-bold text-white font-mono">{empBalance.sick.remaining}</span>
                          </div>
                          <div className="p-1.5 bg-slate-950 rounded border border-slate-800">
                            <span className="text-slate-400 block">PL Left</span>
                            <span className="font-bold text-white font-mono">{empBalance.privilege.remaining}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Decision Remarks & Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                      <input
                        type="text"
                        value={currentNotes}
                        onChange={(e) =>
                          setDecisionNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        placeholder="Optional approval notes or rejection reason..."
                        className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />

                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          onClick={() => handleResolve(req.id, 'rejected')}
                          className="px-3.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition flex items-center space-x-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                        <button
                          onClick={() => handleResolve(req.id, 'approved')}
                          className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold transition shadow-sm flex items-center space-x-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve Leave</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: WHO'S ON LEAVE TODAY */}
      {activeTab === 'calendar' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl space-y-4">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-200">
                Staff On Leave Today ({onLeaveToday.length})
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Date: {todayStr} • Synchronized with team sprint tasks and attendance geofencing
              </p>
            </div>
          </div>

          {onLeaveToday.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              <Sun className="w-8 h-8 text-amber-400/60 mx-auto mb-2" />
              Full team attendance! No employees are scheduled on leave today.
            </div>
          ) : (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {onLeaveToday.map((leave) => {
                const emp = orgProfiles.find((p) => p.id === leave.employeeId);
                return (
                  <div
                    key={leave.id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold text-xs flex items-center justify-center">
                        {emp?.firstName[0] || 'U'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">
                          {emp ? `${emp.firstName} ${emp.lastName}` : 'Staff'}
                        </h4>
                        <span className="text-[10px] text-slate-400 truncate block">
                          {emp?.designation} • {emp?.department}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/80">
                      <span className="text-amber-400 font-semibold uppercase">{leave.leaveType} Leave</span>
                      <span className="text-slate-400 font-mono">
                        {leave.startDate} to {leave.endDate}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* APPLY FOR LEAVE MODAL */}
      {isApplyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto my-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Apply for Leave / Time-Off</h3>
                  <p className="text-[11px] text-slate-400">
                    Applicant: <strong className="text-cyan-400">{currentProfile.firstName} {currentProfile.lastName}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsApplyModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleApplySubmit} className="p-5 space-y-4">
              {/* Leave Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  Select Leave Category *
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setLeaveType('casual')}
                    className={`p-2.5 rounded-lg border text-left transition ${
                      leaveType === 'casual'
                        ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="block font-semibold">Casual (CL)</span>
                    <span className="text-[10px] text-slate-400">{myBalance.casual.remaining} days left</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLeaveType('sick')}
                    className={`p-2.5 rounded-lg border text-left transition ${
                      leaveType === 'sick'
                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="block font-semibold">Sick (SL)</span>
                    <span className="text-[10px] text-slate-400">{myBalance.sick.remaining} days left</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLeaveType('privilege')}
                    className={`p-2.5 rounded-lg border text-left transition ${
                      leaveType === 'privilege'
                        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="block font-semibold">Privilege (PL)</span>
                    <span className="text-[10px] text-slate-400">{myBalance.privilege.remaining} days left</span>
                  </button>
                </div>
              </div>

              {/* Date Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (isHalfDay || e.target.value > endDate) {
                        setEndDate(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    disabled={isHalfDay}
                    value={isHalfDay ? startDate : endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Half-Day Toggle */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white block">Half-Day Leave</span>
                  <span className="text-[10px] text-slate-400">0.5 day deduction</span>
                </div>
                <input
                  type="checkbox"
                  checked={isHalfDay}
                  onChange={(e) => setIsHalfDay(e.target.checked)}
                  className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                />
              </div>

              {isHalfDay && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHalfDaySession('first_half')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold border ${
                      halfDaySession === 'first_half'
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    First Half (Morning)
                  </button>
                  <button
                    type="button"
                    onClick={() => setHalfDaySession('second_half')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold border ${
                      halfDaySession === 'second_half'
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    Second Half (Post-Lunch)
                  </button>
                </div>
              )}

              {/* Total Duration Preview */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/30 text-xs">
                <span className="text-slate-300">Total Duration:</span>
                <span className="font-extrabold text-cyan-300 font-mono">
                  {totalRequestedDays} Working Day(s)
                </span>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reason for Leave *
                </label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why you are requesting leave..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Optional Attachment */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Medical / Supporting Document</span>
                  <span className="text-[10px] text-slate-500">Optional</span>
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                {docUrl ? (
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-emerald-500/40 rounded-lg text-xs text-emerald-300">
                    <span className="truncate">{docName || 'Attached Document'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setDocUrl('');
                        setDocName('');
                      }}
                      className="text-slate-400 hover:text-rose-400 ml-2"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full py-2.5 px-3 border border-dashed border-slate-700 hover:border-indigo-500 rounded-lg text-xs text-slate-400 hover:text-white bg-slate-950 transition flex items-center justify-center space-x-1.5"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{isUploading ? 'Uploading...' : 'Attach Medical Certificate / Proof'}</span>
                  </button>
                )}
              </div>

              {/* Designated Approver Notice */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                <span className="text-white font-semibold block">Routing Notice:</span>
                This request will be routed directly to your designated manager / HR team for formal sign-off.
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsApplyModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center space-x-1.5 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-indigo-600/30"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Leave Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
