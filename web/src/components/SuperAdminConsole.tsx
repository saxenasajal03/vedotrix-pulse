import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldCheck,
  Building,
  Plus,
  Radio,
  Database,
  CheckCircle2,
  AlertTriangle,
  Send,
  Eye,
  Settings,
  Sparkles,
  Layers,
  Copy,
  ExternalLink,
  Lock,
  Globe,
  HardDrive,
  ShieldAlert,
  Key,
  EyeOff,
  Mail,
  Phone,
  UserCheck,
  RefreshCw,
  Briefcase
} from 'lucide-react';
import { Organization } from '../types';
import { ImageUpload } from './ImageUpload';
import { S3_CONFIG } from '../lib/storage';
import { fetchRecentEmailLogs, EmailLogEntry } from '../lib/mailer';

export const SuperAdminConsole: React.FC = () => {
  const {
    isVedotrixSuperadmin,
    currentOrg,
    allOrganizations,
    createOrganization,
    toggleOrganizationStatus,
    updateSubscriptionPlan,
    switchOrganization,
    allOfferLetters,
    broadcasts,
    createBroadcast,
    supabaseConfig,
    updateSupabaseCredentials,
    addToast
  } = useApp();

  if (!isVedotrixSuperadmin) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 text-center bg-slate-900 border border-red-500/30 rounded-2xl shadow-2xl">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Vedotrix Parental Authority Required</h2>
        <p className="text-slate-400 text-sm mb-4 leading-relaxed">
          The Super Controller Hub, live database connectivity, and cloud storage configurations are strictly restricted to parental administrators at Vedotrix Technologies.
        </p>
        <div className="text-xs text-slate-500 bg-slate-950 p-3 rounded-lg border border-slate-800">
          Current Organization: <span className="text-white font-bold">{currentOrg.name}</span>
        </div>
      </div>
    );
  }

  // New Organization Form
  const [isAddOrgOpen, setIsAddOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [newOrgCode, setNewOrgCode] = useState('');
  const [newOrgIndustry, setNewOrgIndustry] = useState<'Tech' | 'Digital Marketing' | 'Hybrid'>('Tech');
  const [newOrgWebsite, setNewOrgWebsite] = useState('https://');
  const [newOrgAddress, setNewOrgAddress] = useState('');
  const [newOrgPhone, setNewOrgPhone] = useState('+91 ');
  const [newOrgLogo, setNewOrgLogo] = useState('');
  const [newOrgPlan, setNewOrgPlan] = useState<'Starter' | 'Professional' | 'Enterprise'>('Professional');

  // Superadmin Credentials State
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminPhone, setAdminPhone] = useState('+91 ');
  const [adminDesignation, setAdminDesignation] = useState('Superadmin / Managing Director');
  const [adminDepartment, setAdminDepartment] = useState('HR & Administration');
  const [isSubmittingOrg, setIsSubmittingOrg] = useState(false);

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAdminPassword(pwd);
    setShowAdminPassword(true);
  };

  // Automatic Mailer Logs State
  const [emailLogs, setEmailLogs] = useState<EmailLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [emailLogFilter, setEmailLogFilter] = useState<'all' | 'welcome' | 'security' | 'offer_letter'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const loadEmailLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const logs = await fetchRecentEmailLogs(50);
      setEmailLogs(logs);
    } catch (e) {
      console.warn('Failed to load email logs:', e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadEmailLogs();
  }, []);

  const filteredEmailLogs = emailLogs.filter((log) => {
    if (emailLogFilter === 'all') return true;
    if (emailLogFilter === 'security') {
      return log.template_type === 'security' || log.recipient_email.includes('sajal') || log.recipient_email.includes('chiefhead');
    }
    return log.template_type === emailLogFilter;
  });

  // Supabase Configuration State
  const [supabaseUrl, setSupabaseUrl] = useState(supabaseConfig.url);
  const [supabaseKey, setSupabaseKey] = useState(supabaseConfig.anonKey);
  const [isTestingDb, setIsTestingDb] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Broadcast Form
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastPriority, setBroadcastPriority] = useState<'info' | 'alert' | 'critical'>('info');

  const handleAddOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim() || !newOrgCode.trim()) {
      addToast('Missing Details', 'Please specify Company Name and Org Code.', 'warning');
      return;
    }

    if (!adminEmail.trim() || !adminPassword.trim() || !adminFirstName.trim()) {
      addToast('Credentials Required', 'Please provide Superadmin First Name, Login Email, and Initial Password.', 'warning');
      return;
    }

    setIsSubmittingOrg(true);
    try {
      await createOrganization(
        {
          name: newOrgName.trim(),
          slug: newOrgSlug.trim() || newOrgName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          orgCode: newOrgCode.trim().toUpperCase(),
          industry: newOrgIndustry,
          website: newOrgWebsite.trim(),
          address: newOrgAddress.trim() || 'Corporate Headquarters',
          phone: newOrgPhone.trim(),
          logoUrl: newOrgLogo || '/vedotrix-logo.png',
          subscriptionPlan: newOrgPlan
        },
        {
          firstName: adminFirstName.trim(),
          lastName: adminLastName.trim(),
          email: adminEmail.trim().toLowerCase(),
          password: adminPassword.trim(),
          phone: adminPhone.trim(),
          designation: adminDesignation.trim() || 'Superadmin / Managing Director',
          department: adminDepartment.trim() || 'HR & Administration',
          role: 'superadmin'
        }
      );

      setIsAddOrgOpen(false);
      // Reset form
      setNewOrgName('');
      setNewOrgCode('');
      setNewOrgSlug('');
      setNewOrgLogo('');
      setNewOrgAddress('');
      setNewOrgPhone('+91 ');
      setAdminFirstName('');
      setAdminLastName('');
      setAdminEmail('');
      setAdminPassword('');
      setAdminPhone('+91 ');
      setAdminDesignation('Superadmin / Managing Director');
      setAdminDepartment('HR & Administration');
    } catch (err: any) {
      console.error('Failed to create organization:', err);
      addToast('Onboarding Failed', err.message || 'Could not onboard organization', 'error');
    } finally {
      setIsSubmittingOrg(false);
    }
  };

  const handleTestAndSaveDb = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTestingDb(true);
    setDbTestResult(null);

    const res = await updateSupabaseCredentials(supabaseUrl, supabaseKey);
    setDbTestResult(res);
    setIsTestingDb(false);
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMsg.trim()) return;

    createBroadcast(broadcastTitle.trim(), broadcastMsg.trim(), broadcastPriority);
    setBroadcastTitle('');
    setBroadcastMsg('');
  };

  return (
    <div className="space-y-8">
      {/* Super Controller Master Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 p-6 sm:p-8 border border-cyan-500/30 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center space-x-4">
            <img
              src="/vedotrix-logo.png"
              alt="Vedotrix Technologies Logo"
              className="w-16 h-16 object-contain rounded-xl p-1 bg-slate-900 border border-cyan-500/40 shadow-lg shadow-cyan-500/20"
            />
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-extrabold text-white">Vedotrix Super Controller Hub</h1>
                <span className="text-[10px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  ROOT SUPERADMIN
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-xl">
                Master command center for <strong>Vedotrix Technologies</strong>. Manage client organizations, S3 image storage, live Supabase DB, and platform broadcasts.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsAddOrgOpen(true)}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-cyan-500/30 transition w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 text-slate-950" />
            <span>Onboard New Organization</span>
          </button>
        </div>
      </div>

      {/* Grid: Live Database & Supabase S3 Storage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Live Supabase Database Connection Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2.5">
              <Database className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Live Supabase Database</h2>
            </div>
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live Active</span>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Connected PostgreSQL cluster: <code className="text-cyan-300 font-mono text-[11px]">cqevzpvyqvckvenutuzz.supabase.co</code> (AWS ap-northeast-1). All client records, offer letters, attendance, and payroll persist in the cloud.
          </p>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Project Endpoint:</span>
              <span className="text-cyan-300 truncate max-w-xs">{supabaseConfig.url}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Pooler Session:</span>
              <span className="text-slate-300">port 5432 / PostgreSQL 17</span>
            </div>
          </div>
        </div>

        {/* 2. Supabase S3 Storage Bucket Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2.5">
              <HardDrive className="w-5 h-5 text-cyan-400" />
              <h2 className="text-sm font-bold text-white">Supabase S3 Object Storage</h2>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              S3 ACTIVE
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Dedicated S3-compatible cloud object storage for organization logos, user avatars, and offer letter verification documents.
          </p>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">S3 Endpoint</span>
              <span className="text-cyan-300 font-mono text-[10px] truncate max-w-xs">{S3_CONFIG.endpoint}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-[10px]">
              <div className="p-2 bg-slate-950 rounded border border-slate-800">
                <span className="text-slate-400 block">organization-logos</span>
                <span className="text-emerald-400 font-bold">Public (Active)</span>
              </div>
              <div className="p-2 bg-slate-950 rounded border border-slate-800">
                <span className="text-slate-400 block">avatars</span>
                <span className="text-emerald-400 font-bold">Public (Active)</span>
              </div>
              <div className="p-2 bg-slate-950 rounded border border-slate-800">
                <span className="text-slate-400 block">documents</span>
                <span className="text-emerald-400 font-bold">Public (Active)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global System Broadcast Dispatcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <Radio className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">Broadcast Global Platform Alert</h2>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Pushes to all Client Portals & Mobile Apps</span>
        </div>

        <form onSubmit={handleSendBroadcast} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Announcement Headline *
              </label>
              <input
                type="text"
                required
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="e.g. Platform update or holiday schedule notice"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">Priority</label>
              <select
                value={broadcastPriority}
                onChange={(e) => setBroadcastPriority(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="info">Info / Notice</option>
                <option value="alert">System Alert</option>
                <option value="critical">Critical / Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">Message Content *</label>
            <textarea
              required
              rows={2}
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              placeholder="Broadcast details sent immediately to notification center and push tokens..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-extrabold text-xs rounded-lg transition shadow-md"
          >
            Send Live Broadcast
          </button>
        </form>
      </div>

      {/* Client Organizations Management Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-white">
              Client Organizations on Vedotrix Platform ({allOrganizations.length})
            </h2>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Live Supabase Sync</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-xs text-left">
            <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
              <tr>
                <th className="p-3.5">Organization</th>
                <th className="p-3.5">Industry / Domain</th>
                <th className="p-3.5">Subscription Plan</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Super Controller Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {allOrganizations.map((org) => {
                const isMaster = org.id === '00000000-0000-0000-0000-000000000001';
                const isActive = org.status !== 'suspended';
                return (
                  <tr key={org.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3.5">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs border border-indigo-500/30 overflow-hidden">
                          <img
                            src={org.logoUrl || '/vedotrix-logo.png'}
                            alt={org.name}
                            className="w-full h-full object-contain p-0.5"
                          />
                        </div>
                        <div>
                          <span className="font-bold text-white block">{org.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{org.website || org.slug}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-cyan-300">
                        {org.industry}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <select
                        value={org.subscriptionPlan || 'Professional'}
                        onChange={(e) => updateSubscriptionPlan(org.id, e.target.value as any)}
                        disabled={isMaster}
                        className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-[11px] text-indigo-300 font-medium focus:outline-none focus:border-cyan-500 disabled:opacity-60"
                      >
                        <option value="Starter">Starter (Free)</option>
                        <option value="Professional">Professional Tier</option>
                        <option value="Enterprise">Enterprise Cloud</option>
                      </select>
                    </td>

                    <td className="p-3.5 text-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          isActive
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>

                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => switchOrganization(org.id)}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-bold transition shadow-sm"
                        title="Enter and control this tenant"
                      >
                        Impersonate
                      </button>
                      {!isMaster && (
                        <button
                          onClick={() => toggleOrganizationStatus(org.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                            isActive
                              ? 'bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-500/30'
                              : 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {isActive ? 'Suspend' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Automatic Mailer & Delivery Registry */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-white">Live Automatic Mailer & Delivery Registry</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {emailLogs.length} Logged Dispatches
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time delivery audit trail from Supabase PostgreSQL <code className="text-cyan-300 font-mono">email_logs</code> table.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
              {(['all', 'welcome', 'security', 'offer_letter'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setEmailLogFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition capitalize ${
                    emailLogFilter === filter
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {filter === 'all' ? 'All' : filter === 'security' ? 'Parental Alerts' : filter.replace('_', ' ')}
                </button>
              ))}
            </div>

            <button
              onClick={loadEmailLogs}
              disabled={isLoadingLogs}
              className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition disabled:opacity-50"
              title="Refresh Mailer Logs from Supabase"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingLogs ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Logs Table / List */}
        <div className="overflow-x-auto">
          {filteredEmailLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No email dispatch logs found for this filter.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[11px] font-semibold">
                  <th className="p-3.5">Recipient</th>
                  <th className="p-3.5">Subject</th>
                  <th className="p-3.5">Template</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Dispatched At</th>
                  <th className="p-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredEmailLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const isParental = log.template_type === 'security' || log.recipient_email.includes('sajal') || log.recipient_email.includes('chiefhead');
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-800/40 transition">
                        <td className="p-3.5">
                          <div className="font-semibold text-white">{log.recipient_name || 'System Recipient'}</div>
                          <div className="text-[11px] font-mono text-cyan-400">{log.recipient_email}</div>
                        </td>
                        <td className="p-3.5 max-w-xs truncate font-medium text-slate-200">
                          {log.subject}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                              isParental
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : log.template_type === 'welcome'
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            }`}
                          >
                            {isParental ? 'Parental Alert' : log.template_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>{log.status}</span>
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                          {new Date(log.sent_at).toLocaleString()}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="px-2.5 py-1 text-[11px] font-bold text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-800 rounded-lg border border-slate-800 transition"
                          >
                            {isExpanded ? 'Hide' : 'Inspect'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-950/80 border-b border-slate-800">
                          <td colSpan={6} className="p-4">
                            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-xs">
                              <div className="flex items-center justify-between text-slate-400 text-[11px] pb-1 border-b border-slate-800 font-mono">
                                <span>Payload ID: {log.id}</span>
                                <span>Sent via Supabase Transactional Engine</span>
                              </div>
                              <pre className="text-[11px] font-mono text-cyan-300 bg-slate-950 p-3 rounded-lg overflow-x-auto">
                                {JSON.stringify(log.metadata || {}, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Organization Modal with S3 Image Upload & Explicit Superadmin Credentials */}
      {isAddOrgOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto my-4 sm:my-6">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950 sticky top-0 z-20">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Onboard New Enterprise Tenant</h3>
                  <p className="text-[11px] text-slate-400">Register company profile and create designated Superadmin credentials</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddOrgOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddOrg} className="p-6 space-y-6">
              {/* SECTION 1: Tenant Details */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">1. Organization Details & Branding</h4>
                </div>

                {/* S3 Image Logo Upload Component */}
                <ImageUpload
                  bucket="organization-logos"
                  currentUrl={newOrgLogo}
                  onUploaded={(url) => setNewOrgLogo(url)}
                  label="Company Logo (Stored in Supabase S3)"
                  helperText="Upload official company logo (PNG, JPG, SVG, WEBP)"
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Company Name *</label>
                    <input
                      type="text"
                      required
                      value={newOrgName}
                      onChange={(e) => {
                        setNewOrgName(e.target.value);
                        if (!newOrgSlug) {
                          setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                        }
                      }}
                      placeholder="e.g. BNK Digital"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Org Code (3-4 Chars) *</label>
                    <input
                      type="text"
                      required
                      maxLength={4}
                      value={newOrgCode}
                      onChange={(e) => setNewOrgCode(e.target.value.toUpperCase())}
                      placeholder="e.g. BNK"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono uppercase text-cyan-300 focus:outline-none focus:border-cyan-500"
                    />
                    <span className="text-[10px] text-slate-500">For serials: VDX-[CODE]-YYYY</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Industry Type</label>
                    <select
                      value={newOrgIndustry}
                      onChange={(e) => setNewOrgIndustry(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="Tech">Tech / Software House</option>
                      <option value="Digital Marketing">Digital Marketing Agency</option>
                      <option value="Hybrid">Hybrid Enterprise</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Subscription Plan</label>
                    <select
                      value={newOrgPlan}
                      onChange={(e) => setNewOrgPlan(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="Starter">Starter (Free Tier)</option>
                      <option value="Professional">Professional Tier</option>
                      <option value="Enterprise">Enterprise Cloud</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Company Website</label>
                    <input
                      type="text"
                      value={newOrgWebsite}
                      onChange={(e) => setNewOrgWebsite(e.target.value)}
                      placeholder="https://bnkdigital.com"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Company Contact Phone</label>
                    <input
                      type="text"
                      value={newOrgPhone}
                      onChange={(e) => setNewOrgPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Headquarters Office Address</label>
                  <input
                    type="text"
                    value={newOrgAddress}
                    onChange={(e) => setNewOrgAddress(e.target.value)}
                    placeholder="e.g. Tower B, Tech Park, Bangalore, Karnataka"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[10px] text-slate-500">Used as default geofenced punch-in location for employees.</span>
                </div>
              </div>

              {/* SECTION 2: Superadmin Credentials */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center space-x-2">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">2. Designated Superadmin Credentials</h4>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Full Tenant Authority
                  </span>
                </div>

                {/* Email Notice Card */}
                <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-xs text-slate-300 space-y-1">
                  <div className="flex items-center space-x-1.5 text-indigo-300 font-bold text-[11px]">
                    <Mail className="w-3.5 h-3.5" />
                    <span>Supabase Automatic Free Mailer & CC Dispatch</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Upon onboarding, login credentials will be stored with bcrypt encryption in Supabase PostgreSQL. An automated welcome email will be dispatched to the candidate, with an instant CC notification sent to <strong className="text-white">sajalsaxenagola@gmail.com</strong> and <strong className="text-white">chiefhead.interndesire@gmail.com</strong>.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Superadmin First Name *</label>
                    <input
                      type="text"
                      required
                      value={adminFirstName}
                      onChange={(e) => setAdminFirstName(e.target.value)}
                      placeholder="e.g. Kshitiz"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Superadmin Last Name</label>
                    <input
                      type="text"
                      value={adminLastName}
                      onChange={(e) => setAdminLastName(e.target.value)}
                      placeholder="e.g. Narayan"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                      <span>Work / Login Email *</span>
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="kshitiznarayan543@gmail.com"
                        className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                      <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                      <span>Initial Login Password *</span>
                      <button
                        type="button"
                        onClick={generateRandomPassword}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium flex items-center space-x-1"
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        <span>Generate</span>
                      </button>
                    </label>
                    <div className="relative">
                      <input
                        type={showAdminPassword ? 'text' : 'password'}
                        required
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="e.g. Kshitiz@2006"
                        className="w-full pl-8 pr-9 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                      />
                      <Key className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                      >
                        {showAdminPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Phone</label>
                    <input
                      type="text"
                      value={adminPhone}
                      onChange={(e) => setAdminPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Designation</label>
                    <input
                      type="text"
                      value={adminDesignation}
                      onChange={(e) => setAdminDesignation(e.target.value)}
                      placeholder="e.g. Superadmin / HR Head"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
                    <input
                      type="text"
                      value={adminDepartment}
                      onChange={(e) => setAdminDepartment(e.target.value)}
                      placeholder="e.g. HR Department"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  disabled={isSubmittingOrg}
                  onClick={() => setIsAddOrgOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOrg}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 via-indigo-600 to-emerald-500 text-slate-950 font-extrabold text-xs rounded-xl transition shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 disabled:opacity-50"
                >
                  {isSubmittingOrg ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
                      <span>Onboarding Tenant & Notifying...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />
                      <span>Onboard Tenant & Dispatch Credentials</span>
                    </>
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
