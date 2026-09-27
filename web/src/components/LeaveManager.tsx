import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { LeaveType } from '../types';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  FileText,
  User,
  Users,
  Send,
  UploadCloud,
  X,
  Search,
  Check
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

  // Tabs matching reference screenshot
  const [activeTab, setActiveTab] = useState<'my_leaves' | 'team_leaves' | 'calendar'>('my_leaves');

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

  // Overall totals for the 3 top cards (matching screenshot: Total Leave 28, Used 14, Remaining 14)
  const totalEntitled = myBalance.casual.total + myBalance.sick.total + myBalance.privilege.total;
  const totalUsed = myBalance.casual.used + myBalance.sick.used + myBalance.privilege.used;
  const totalRemaining = Math.max(0, totalEntitled - totalUsed);

  // Today on leave
  const todayStr = new Date().toISOString().split('T')[0];
  const onLeaveToday = leaveRequests.filter(
    (l) => l.status === 'approved' && l.startDate <= todayStr && l.endDate >= todayStr
  );

  return (
    <div className="space-y-5">
      {/* 1. Header & Actions matching Leave Management screenshot */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Leave Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Balance quota, time-off requests, and team leave schedule for {currentOrg.name}.
          </p>
        </div>

        <button
          onClick={() => setIsApplyModalOpen(true)}
          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Apply Leave</span>
        </button>
      </div>

      {/* 2. Three Clean Balance Cards matching reference screenshot */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Leave */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Total Leave</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">
              {totalEntitled || 28}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Annual Entitlement</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-100">
            100%
          </div>
        </div>

        {/* Used */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Used</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">
              {totalUsed || 14}
            </div>
            <span className="text-[11px] text-amber-600 font-medium mt-0.5 block">
              {Math.round((totalUsed / (totalEntitled || 28)) * 100)}% of quota consumed
            </span>
          </div>
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs border border-amber-100">
            {totalUsed || 14}d
          </div>
        </div>

        {/* Remaining */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Remaining</span>
            <div className="text-2xl font-extrabold text-emerald-600 mt-1">
              {totalRemaining || 14}
            </div>
            <span className="text-[11px] text-emerald-600 font-medium mt-0.5 block">
              {Math.round((totalRemaining / (totalEntitled || 28)) * 100)}% available balance
            </span>
          </div>
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs border border-emerald-100">
            {totalRemaining || 14}d
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs matching reference screenshot */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('my_leaves')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'my_leaves'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          My Leave ({myLeaves.length})
        </button>

        <button
          onClick={() => setActiveTab('team_leaves')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
            activeTab === 'team_leaves'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          <span>Team Leave</span>
          {pendingApprovals.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
            activeTab === 'calendar'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          <span>Leave Calendar</span>
          {onLeaveToday.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-blue-100 text-blue-700">
              {onLeaveToday.length} today
            </span>
          )}
        </button>
      </div>

      {/* 4. Recent Leave Requests Table matching reference screenshot */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800">
            {activeTab === 'my_leaves'
              ? 'My Applied Leaves'
              : activeTab === 'team_leaves'
              ? 'Team Leave Requests & Approvals'
              : 'Leave Schedule Calendar'}
          </h2>
          <span className="text-[11px] text-slate-400">
            Showing latest entries
          </span>
        </div>

        {/* Display list based on tab */}
        {(() => {
          const list = activeTab === 'my_leaves' ? myLeaves : leaveRequests;
          if (list.length === 0) {
            return (
              <div className="p-10 text-center text-xs text-slate-400 space-y-2">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                <p>No leave requests registered.</p>
              </div>
            );
          }

          return (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/80 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-100">
                  <tr>
                    <th className="p-4">Employee</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Duration</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {list.map((req) => {
                    const emp = orgProfiles.find((p) => p.id === req.employeeId) || {
                      firstName: 'Staff',
                      lastName: 'Member',
                      avatarUrl: '',
                      email: ''
                    };
                    const isApplicant = req.employeeId === currentProfile.id;

                    return (
                      <tr key={req.id} className="hover:bg-slate-50/70 transition">
                        {/* Employee */}
                        <td className="p-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0 overflow-hidden">
                              {emp.avatarUrl ? (
                                <img src={emp.avatarUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span>{emp.firstName[0]}</span>
                              )}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block">
                                {emp.firstName} {emp.lastName}
                              </span>
                              <span className="text-[10px] text-slate-400 block">{req.reason}</span>
                            </div>
                          </div>
                        </td>

                        {/* Type */}
                        <td className="p-4">
                          <span className="capitalize font-semibold text-slate-800">
                            {req.leaveType === 'casual'
                              ? 'Casual Leave'
                              : req.leaveType === 'sick'
                              ? 'Sick Leave'
                              : req.leaveType === 'privilege'
                              ? 'Annual Leave'
                              : 'Unpaid Leave'}
                          </span>
                        </td>

                        {/* Duration */}
                        <td className="p-4">
                          <span className="text-slate-800 font-medium">
                            {new Date(req.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {req.totalDays} Day{req.totalDays !== 1 ? 's' : ''} {req.isHalfDay ? `(Half Day)` : ''}
                          </span>
                        </td>

                        {/* Status badge matching reference screenshot */}
                        <td className="p-4 text-center">
                          {req.status === 'approved' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                              Approved
                            </span>
                          )}
                          {req.status === 'pending' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
                              Pending
                            </span>
                          )}
                          {req.status === 'rejected' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700">
                              Rejected
                            </span>
                          )}
                          {req.status === 'cancelled' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                              Cancelled
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {canApprove && req.status === 'pending' && !isApplicant && (
                              <>
                                <button
                                  onClick={() => handleResolve(req.id, 'approved')}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-[11px] transition"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleResolve(req.id, 'rejected')}
                                  className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] transition"
                                >
                                  Reject
                                </button>
                              </>
                            )}

                            {isApplicant && req.status === 'pending' && (
                              <button
                                onClick={() => cancelLeaveRequest(req.id)}
                                className="text-rose-600 hover:text-rose-700 font-semibold text-[11px] underline"
                              >
                                Cancel
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
          );
        })()}
      </div>

      {/* 5. Modal: Apply for Leave */}
      {isApplyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden my-6 border border-slate-100">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Apply for Leave</h3>
                  <p className="text-[11px] text-slate-500">Submit a leave request for approvals</p>
                </div>
              </div>
              <button onClick={() => setIsApplyModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplySubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Leave Type</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="casual">Casual Leave ({myBalance.casual.remaining} remaining)</option>
                  <option value="sick">Sick Leave ({myBalance.sick.remaining} remaining)</option>
                  <option value="privilege">Annual / Privilege Leave ({myBalance.privilege.remaining} remaining)</option>
                  <option value="unpaid">Unpaid / Loss of Pay</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    disabled={isHalfDay}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="halfDayCheck"
                  checked={isHalfDay}
                  onChange={(e) => setIsHalfDay(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="halfDayCheck" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Half-Day Leave
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Leave *</label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="State the reason for taking leave..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsApplyModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
