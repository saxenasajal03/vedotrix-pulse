import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  Crown,
  Sparkles,
  ArrowRight,
  AlertCircle,
  KeyRound,
  Building2,
  ChevronDown,
  Check
} from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const { login, allOrganizations, allProfiles } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);

  // Tenant selection / auto-detection
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const orgParam = params.get('org') || params.get('orgCode') || params.get('code');
      return orgParam || null;
    } catch {
      return null;
    }
  });
  const [showOrgPicker, setShowOrgPicker] = useState(false);

  // Auto-detect organization from typed email
  const detectedOrg = useMemo(() => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return null;

    // 1. Direct profile match
    const matchedProfile = allProfiles.find((p) => p.email?.toLowerCase() === cleanEmail);
    if (matchedProfile) {
      const org = allOrganizations.find((o) => o.id === matchedProfile.orgId);
      if (org) return org;
    }

    // 2. Email domain match against organization website or slug
    if (cleanEmail.includes('@')) {
      const domain = cleanEmail.split('@')[1];
      const matchedByDomain = allOrganizations.find((o) => {
        if (!domain) return false;
        const orgDomain = (o.website || '')
          .replace(/https?:\/\//i, '')
          .replace(/^www\./i, '')
          .split('/')[0]
          .toLowerCase();
        const orgSlug = (o.slug || '').toLowerCase();
        return (orgDomain && orgDomain === domain) || (orgSlug && domain.includes(orgSlug));
      });
      if (matchedByDomain) return matchedByDomain;
    }

    return null;
  }, [email, allProfiles, allOrganizations]);

  // Determine active display organization
  const activeOrg = useMemo(() => {
    if (selectedOrgId && selectedOrgId !== 'auto') {
      const explicit = allOrganizations.find((o) => o.id === selectedOrgId || o.orgCode.toLowerCase() === selectedOrgId.toLowerCase());
      if (explicit) return explicit;
    }
    if (detectedOrg) return detectedOrg;

    // Default to root Vedotrix organization
    return (
      allOrganizations.find((o) => o.id === '00000000-0000-0000-0000-000000000001') ||
      allOrganizations[0] || {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Vedotrix Technologies Global',
        slug: 'vedotrix',
        orgCode: 'VDX',
        industry: 'Tech',
        website: 'https://vedotrix.com',
        address: 'Bengaluru, India',
        phone: '+91 80 4400 9900',
        logoUrl: '/vedotrix-logo.png'
      }
    );
  }, [selectedOrgId, detectedOrg, allOrganizations]);

  const isMasterRoot = activeOrg.id === '00000000-0000-0000-0000-000000000001';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    if (failedAttempts >= 5) {
      setErrorMessage('Too many failed attempts. Security lockout active for 60 seconds.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const result = await login(email.trim(), password);

    if (result.success) {
      if (onLoginSuccess) onLoginSuccess();
    } else {
      setFailedAttempts((prev) => prev + 1);
      setErrorMessage(result.message);
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Background Cyber Glow & Grid */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-cyan-500/10 via-indigo-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

      {/* Main Login Card */}
      <div className="relative w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-cyan-950/20 space-y-6 z-10">
        {/* Dynamic Organization Header & Logo */}
        <div className="text-center space-y-3">
          <div className="relative inline-block group">
            <img
              src={activeOrg.logoUrl || '/vedotrix-logo.png'}
              alt={activeOrg.name}
              className="w-20 h-20 mx-auto object-contain rounded-2xl p-2 bg-slate-950 border-2 border-cyan-500/40 shadow-xl shadow-cyan-500/20 transition-transform group-hover:scale-105 duration-300"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/vedotrix-logo.png';
              }}
            />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-cyan-400 border-2 border-slate-900 shadow-md" />
          </div>

          <div>
            <div className="flex items-center justify-center space-x-1.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                {activeOrg.name}
              </h1>
            </div>

            {/* Tenant Status Pill */}
            <div className="flex items-center justify-center space-x-2 mt-1">
              {isMasterRoot ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 inline-flex items-center space-x-1">
                  <Crown className="w-3 h-3 text-cyan-400" />
                  <span>Super Controller Portal</span>
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 inline-flex items-center space-x-1">
                  <Building2 className="w-3 h-3 text-indigo-400" />
                  <span>{activeOrg.orgCode} Corporate Workspace</span>
                </span>
              )}
            </div>

            {/* Platform Sub-Branding */}
            <div className="mt-2.5 pt-2 border-t border-slate-800/60">
              <p className="text-xs font-bold text-white tracking-tight">
                Vedotrix <span className="text-cyan-400">Pulse</span>
              </p>
              <p className="text-[10px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">
                Designed & Managed by Vedotrix Technologies
              </p>
            </div>
          </div>

          {/* Tenant Switcher on Login Screen */}
          <div className="relative inline-block text-left pt-1">
            <button
              type="button"
              onClick={() => setShowOrgPicker(!showOrgPicker)}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-[11px] text-slate-300 transition"
            >
              <Building2 className="w-3 h-3 text-cyan-400" />
              <span className="truncate max-w-[170px] font-medium">
                {selectedOrgId && selectedOrgId !== 'auto'
                  ? activeOrg.name
                  : detectedOrg
                  ? `Detected: ${detectedOrg.name}`
                  : 'Select Organization'}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showOrgPicker && (
              <div className="absolute left-1/2 -translate-x-1/2 mt-1 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl py-1.5 z-50 text-left max-h-60 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOrgId('auto');
                    setShowOrgPicker(false);
                  }}
                  className={`w-full px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800 transition ${
                    selectedOrgId === 'auto' || !selectedOrgId ? 'text-cyan-400 font-bold bg-slate-800/40' : 'text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>⚡ Auto-Detect by Email</span>
                  </div>
                  {(!selectedOrgId || selectedOrgId === 'auto') && <Check className="w-3.5 h-3.5" />}
                </button>

                <div className="px-3 py-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider border-t border-slate-800/80 mt-1">
                  Registered Organizations
                </div>

                {allOrganizations.map((org) => {
                  const isSelected = activeOrg.id === org.id;
                  return (
                    <button
                      key={org.id}
                      type="button"
                      onClick={() => {
                        setSelectedOrgId(org.id);
                        setShowOrgPicker(false);
                      }}
                      className={`w-full px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800 transition ${
                        isSelected ? 'text-cyan-400 font-bold bg-slate-800/40' : 'text-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <img
                          src={org.logoUrl || '/vedotrix-logo.png'}
                          alt=""
                          className="w-4 h-4 object-contain rounded shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/vedotrix-logo.png';
                          }}
                        />
                        <span className="truncate">{org.name}</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500 shrink-0 ml-2">{org.orgCode}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center space-x-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Work Email Address</span>
              <span className="text-[10px] text-slate-500 font-mono">
                {activeOrg.orgCode} Account
              </span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Security Password</span>
              <span className="text-[10px] text-slate-500">256-Bit Encrypted</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-gradient-to-r from-cyan-500 via-indigo-600 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition flex items-center justify-center space-x-2 disabled:opacity-50 mt-2"
          >
            {isLoading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <KeyRound className="w-4 h-4 text-slate-950" />
                <span>Sign In to {activeOrg.name}</span>
                <ArrowRight className="w-4 h-4 text-slate-950" />
              </>
            )}
          </button>
        </form>

        {/* Security Trust Badges */}
        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-around text-[10px] text-slate-400">
          <div className="flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Supabase RLS Protected</span>
          </div>
          <span>•</span>
          <div className="flex items-center space-x-1">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <span>End-to-End SSL</span>
          </div>
          <span>•</span>
          <div className="flex items-center space-x-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Multi-Tenant Vault</span>
          </div>
        </div>
      </div>
    </div>
  );
};
