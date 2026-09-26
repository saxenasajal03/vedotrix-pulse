import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldCheck,
  KeyRound,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  GitBranch,
  Building,
  UserCheck,
  AlertCircle,
  FileCheck2,
  Banknote,
  KanbanSquare,
  MapPin,
  Send,
  ChevronRight,
  Crown
} from 'lucide-react';
import { AccessRequest, Profile } from '../types';

export const AccessRequestsView: React.FC = () => {
  const {
    currentOrg,
    currentProfile,
    orgProfiles,
    allProfiles,
    accessRequests,
    submitAccessRequest,
    resolveAccessRequest,
    updateEmployeeManager,
    addToast
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'approvals' | 'my_requests' | 'hierarchy' | 'tenant_features'>('approvals');
  
  // New Request Modal State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [targetModule, setTargetModule] = useState('payroll');
  const [justification, setJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Decision Note State
  const [decisionNotes, setDecisionNotes] = useState<{ [id: string]: string }>({});

  const isSuperadmin = currentProfile.role === 'superadmin';
  const isOwner = currentProfile.role === 'owner';
  const isManager = currentProfile.role === 'manager';

  // Requests assigned specifically to the logged-in user
  const myAssignedApprovals = accessRequests.filter((r) => {
    if (r.status !== 'pending') return false;
    if (isSuperadmin) return true; // Superadmin can audit all
    if (r.assignedApproverId === currentProfile.id) return true;
    if (isOwner && r.orgId === currentOrg.id) return true;
    return false;
  });

  // Requests submitted by the current user
  const myRequests = accessRequests.filter((r) => r.requesterId === currentProfile.id);

  // Available managers in the organization for hierarchy assignment
  const availableManagers = orgProfiles.filter(
    (p) => p.role === 'manager' || p.role === 'owner' || p.role === 'hr'
  );

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justification.trim()) return;

    setIsSubmitting(true);
    await submitAccessRequest(targetModule, justification.trim(), 'module_access');
    setIsSubmitting(false);
    setIsRequestModalOpen(false);
    setJustification('');
  };

  const handleDecision = async (requestId: string, status: 'approved' | 'rejected') => {
    const notes = decisionNotes[requestId] || (status === 'approved' ? 'Approved based on organizational hierarchy review.' : 'Rejected per policy.');
    await resolveAccessRequest(requestId, status, notes);
  };

  const getModuleBadge = (mod: string) => {
    switch (mod) {
      case 'payroll':
        return { label: 'Payroll & Disbursals', icon: Banknote, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
      case 'offers':
        return { label: 'Offer Letters & Serials', icon: FileCheck2, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' };
      case 'tech_sprints':
        return { label: 'Tech Sprints & Git PRs', icon: KanbanSquare, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' };
      case 'geo_override':
        return { label: 'Remote Geo-Fence Punch', icon: MapPin, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
      default:
        return { label: mod.toUpperCase(), icon: KeyRound, color: 'text-slate-300 bg-slate-800 border-slate-700' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 p-6 sm:p-8 border border-slate-800 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-[11px] font-semibold border border-cyan-500/30 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Multi-Hierarchy Role-Based Access Control</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Access Requests & Team Hierarchy
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Strictly routed approval chains. Access requests are evaluated and authorized only by designated reporting managers.
            </p>
          </div>

          <button
            onClick={() => setIsRequestModalOpen(true)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition self-start sm:self-auto"
          >
            <KeyRound className="w-4 h-4 text-slate-950" />
            <span>Request Module Access</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 overflow-x-auto text-xs font-semibold whitespace-nowrap">
        <button
          onClick={() => setActiveSubTab('approvals')}
          className={`px-3.5 sm:px-4 py-2 rounded-xl transition flex items-center space-x-2 shrink-0 ${
            activeSubTab === 'approvals'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Approvals Queue</span>
          {myAssignedApprovals.length > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-cyan-500 text-slate-950">
              {myAssignedApprovals.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('my_requests')}
          className={`px-3.5 sm:px-4 py-2 rounded-xl transition flex items-center space-x-2 shrink-0 ${
            activeSubTab === 'my_requests'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>My Submissions ({myRequests.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('hierarchy')}
          className={`px-3.5 sm:px-4 py-2 rounded-xl transition flex items-center space-x-2 shrink-0 ${
            activeSubTab === 'hierarchy'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <GitBranch className="w-4 h-4" />
          <span>Reporting Team Tree</span>
        </button>

        {isOwner && (
          <button
            onClick={() => setActiveSubTab('tenant_features')}
            className={`px-3.5 sm:px-4 py-2 rounded-xl transition flex items-center space-x-2 shrink-0 ${
              activeSubTab === 'tenant_features'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Add-On Requests</span>
          </button>
        )}
      </div>

      {/* TAB 1: DESIGNATED APPROVALS QUEUE */}
      {activeSubTab === 'approvals' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                <strong>Hierarchy Security:</strong> You are authorized to review access requests only for staff reporting directly to you.
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              Logged in as: {currentProfile.firstName} ({currentProfile.role.toUpperCase()})
            </span>
          </div>

          {myAssignedApprovals.length === 0 ? (
            <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-2xl">
              <CheckCircle2 className="w-12 h-12 text-emerald-400/60 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-white">No Pending Approvals</h3>
              <p className="text-xs text-slate-400 mt-1">
                All requests routed to you have been reviewed and resolved.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {myAssignedApprovals.map((req) => {
                const requester = allProfiles.find((p) => p.id === req.requesterId);
                const badge = getModuleBadge(req.targetModule);
                const Icon = badge.icon;
                const noteVal = decisionNotes[req.id] || '';

                return (
                  <div
                    key={req.id}
                    className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-sm border border-indigo-500/30">
                          {requester?.firstName[0] || 'U'}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-white text-sm">
                              {requester ? `${requester.firstName} ${requester.lastName}` : 'Employee'}
                            </span>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                              {requester?.role || 'Staff'}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400">
                            {requester?.designation} • {requester?.department} • {requester?.email}
                          </span>
                        </div>
                      </div>

                      <div className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                        <span>Requesting: {badge.label}</span>
                      </div>
                    </div>

                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Business Justification
                      </span>
                      <p className="text-xs text-slate-200 leading-relaxed italic">
                        "{req.justification}"
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                      <input
                        type="text"
                        value={noteVal}
                        onChange={(e) => setDecisionNotes({ ...decisionNotes, [req.id]: e.target.value })}
                        placeholder="Optional approval/rejection notes..."
                        className="w-full sm:max-w-md px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      />

                      <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0">
                        <button
                          onClick={() => handleDecision(req.id, 'rejected')}
                          className="px-3.5 py-2 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-200 text-xs font-bold rounded-lg transition flex items-center space-x-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                        <button
                          onClick={() => handleDecision(req.id, 'approved')}
                          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-extrabold rounded-lg shadow-lg shadow-emerald-500/20 transition flex items-center space-x-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve Access</span>
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

      {/* TAB 2: MY ACCESS REQUESTS */}
      {activeSubTab === 'my_requests' && (
        <div className="space-y-4">
          {/* Active Granted Modules summary */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Your Active Granted Permissions</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {(currentProfile.modulesAccess || ['attendance', 'tasks', 'standups']).map((mod) => {
                const b = getModuleBadge(mod);
                const Icon = b.icon;
                return (
                  <span
                    key={mod}
                    className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${b.color}`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{b.label}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Submissions List */}
          {myRequests.length === 0 ? (
            <div className="text-center py-10 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-slate-400">
              You have not submitted any access requests yet. Click "+ Request Module Access" above.
            </div>
          ) : (
            <div className="space-y-3">
              {myRequests.map((r) => {
                const badge = getModuleBadge(r.targetModule);
                const approver = allProfiles.find((p) => p.id === r.assignedApproverId);

                return (
                  <div
                    key={r.id}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white">{badge.label}</span>
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                            r.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : r.status === 'rejected'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-1 italic">
                        "{r.justification}"
                      </p>
                      {r.approverDecisionNotes && (
                        <p className="text-cyan-300 text-[11px] mt-1 font-mono">
                          Reviewer Note: {r.approverDecisionNotes}
                        </p>
                      )}
                    </div>

                    <div className="text-right text-[11px] text-slate-400 shrink-0">
                      <div>
                        Designated Reviewer: <strong className="text-slate-200">{approver ? `${approver.firstName} ${approver.lastName}` : 'Management'}</strong>
                      </div>
                      <span className="text-[10px] text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REPORTING STRUCTURE & TEAM TREE */}
      {activeSubTab === 'hierarchy' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
            <span>
              <strong>Organization Team Tree:</strong> Employees are grouped under their designated reporting managers for approvals.
            </span>
            <span className="text-[11px] text-indigo-400 font-mono">
              Total Staff: {orgProfiles.length}
            </span>
          </div>

          {/* Hierarchy Cards Grouped by Managers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableManagers.map((mgr) => {
              const directReports = orgProfiles.filter((p) => p.managerId === mgr.id && p.id !== mgr.id);

              return (
                <div
                  key={mgr.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4"
                >
                  <div className="flex items-center space-x-3 pb-3 border-b border-slate-800">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-sm border border-cyan-500/30">
                      {mgr.firstName[0]}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white text-sm">
                          {mgr.firstName} {mgr.lastName}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 uppercase">
                          {mgr.role === 'owner' ? 'Org Owner' : 'Manager'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {mgr.designation} • {mgr.department}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Direct Report Team ({directReports.length})</span>
                      <span className="text-cyan-400">Approvals Authority</span>
                    </span>

                    {directReports.length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-2">
                        No team members currently assigned to report to this manager.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {directReports.map((emp) => (
                          <div
                            key={emp.id}
                            className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-semibold text-white block">
                                {emp.firstName} {emp.lastName}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {emp.designation} ({emp.department})
                              </span>
                            </div>

                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                              Reports Here
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Unassigned Staff / Reassignment Section */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Designate / Update Staff Reporting Managers</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">Staff Member</th>
                    <th className="p-3">Role & Department</th>
                    <th className="p-3">Designated Reporting Manager</th>
                    <th className="p-3 text-right">Approvals Routing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {orgProfiles.map((emp) => {
                    const currentMgr = availableManagers.find((m) => m.id === emp.managerId);
                    return (
                      <tr key={emp.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-semibold text-white">
                          {emp.firstName} {emp.lastName}
                        </td>
                        <td className="p-3 text-slate-400">
                          {emp.designation} ({emp.department})
                        </td>
                        <td className="p-3">
                          {(isOwner || isSuperadmin) ? (
                            <select
                              value={emp.managerId || ''}
                              onChange={(e) => updateEmployeeManager(emp.id, e.target.value || null)}
                              className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-cyan-500"
                            >
                              <option value="">-- No Direct Manager (Direct to Owner) --</option>
                              {availableManagers
                                .filter((m) => m.id !== emp.id)
                                .map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.firstName} {m.lastName} ({m.designation})
                                  </option>
                                ))}
                            </select>
                          ) : (
                            <span className="text-slate-300">
                              {currentMgr ? `${currentMgr.firstName} ${currentMgr.lastName}` : 'Organization Owner'}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right text-[10px] font-mono text-cyan-400">
                          {currentMgr ? `→ Routes to ${currentMgr.firstName}` : '→ Routes to Owner'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TENANT PLATFORM FEATURE REQUESTS */}
      {activeSubTab === 'tenant_features' && isOwner && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center space-x-3 pb-3 border-b border-slate-800">
            <Building className="w-6 h-6 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Request Enterprise SaaS Add-Ons from Vedotrix</h2>
              <p className="text-xs text-slate-400">
                Request feature activations (Enterprise S3 Bucket Quota, White-Label Domain, Multi-Branch Geo Locations).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <h3 className="font-bold text-white text-xs">S3 Storage Expansion</h3>
              <p className="text-slate-400 text-[11px]">
                Dedicated S3 bucket storage with 50GB asset allowance for organization documents.
              </p>
              <button
                onClick={() => submitAccessRequest('s3_expansion', 'Requesting 50GB S3 Storage Quota for Org Documents', 'org_feature')}
                className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition"
              >
                Request S3 Expansion
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <h3 className="font-bold text-white text-xs">Multi-Office Geofencing</h3>
              <p className="text-slate-400 text-[11px]">
                Add up to 10 distinct GPS coordinates for regional branches and client on-site geofencing.
              </p>
              <button
                onClick={() => submitAccessRequest('multi_office_gps', 'Requesting multi-office GPS geofencing activation', 'org_feature')}
                className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition"
              >
                Request Multi-Office
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <h3 className="font-bold text-white text-xs">Custom White-Label Portal</h3>
              <p className="text-slate-400 text-[11px]">
                Custom sub-domain with branded offer letter verification URL and emails.
              </p>
              <button
                onClick={() => submitAccessRequest('white_label_portal', 'Requesting custom branded portal sub-domain', 'org_feature')}
                className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition"
              >
                Request White-Label
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REQUEST ACCESS MODAL */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Request Module Access</h3>
              </div>
              <button
                onClick={() => setIsRequestModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Module / Capability
                </label>
                <select
                  value={targetModule}
                  onChange={(e) => setTargetModule(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="payroll">Payroll & Bank Disbursals</option>
                  <option value="offers">Offer Letters & Verification Management</option>
                  <option value="tech_sprints">Tech Sprints & Git PR Tracking</option>
                  <option value="geo_override">Remote Geo-Fence Punch Authorization</option>
                  <option value="admin_console">Organization Settings & Staff Administration</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Business Justification *
                </label>
                <textarea
                  required
                  rows={3}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Explain why you require access to this module (e.g. Taking over sprint lead responsibilities)..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center space-x-1.5 text-cyan-300 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Automatic Hierarchy Routing</span>
                </div>
                <p>
                  This request will automatically be sent to your designated reporting manager for review.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-bold text-xs rounded-lg transition shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Routing...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
