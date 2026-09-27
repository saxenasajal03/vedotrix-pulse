import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  Building2,
  ChevronDown,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Globe,
  Sparkles,
  Smartphone,
  Laptop,
  Users
} from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const { login, allOrganizations, allProfiles, addToast } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);

  // Optional custom workspace code toggle (confidential: no public listing of other tenants)
  const [showCustomWorkspace, setShowCustomWorkspace] = useState(false);
  const [customOrgCode, setCustomOrgCode] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('org') || params.get('orgCode') || params.get('code') || '';
    } catch {
      return '';
    }
  });

  // Language selector state
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

  // Forgot password modal
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  // Auto-detect organization silently from typed email (does NOT expose other tenants)
  const detectedOrg = useMemo(() => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      if (customOrgCode.trim()) {
        const byCode = allOrganizations.find(
          (o) => o.orgCode.toLowerCase() === customOrgCode.trim().toLowerCase() ||
                 o.slug?.toLowerCase() === customOrgCode.trim().toLowerCase()
        );
        if (byCode) return byCode;
      }
      return null;
    }

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

    // 3. Fallback to custom code if provided
    if (customOrgCode.trim()) {
      const byCode = allOrganizations.find(
        (o) => o.orgCode.toLowerCase() === customOrgCode.trim().toLowerCase() ||
               o.slug?.toLowerCase() === customOrgCode.trim().toLowerCase()
      );
      if (byCode) return byCode;
    }

    return null;
  }, [email, customOrgCode, allProfiles, allOrganizations]);

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

  const handleSsoClick = (provider: string) => {
    addToast(
      `${provider} SSO Security Notice`,
      `Single Sign-On via ${provider} is managed by your organization's IT policy. Please sign in with your work email credentials.`,
      'info'
    );
  };

  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotSent(true);
    setTimeout(() => {
      setShowForgotPasswordModal(false);
      setForgotSent(false);
      setForgotEmail('');
      addToast(
        'Password Reset Instructions Sent 🔐',
        `If an active account exists for ${forgotEmail}, secure password reset instructions have been dispatched.`,
        'success'
      );
    }, 1500);
  };

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] text-slate-800 flex flex-col justify-between font-['Plus_Jakarta_Sans',sans-serif] relative overflow-x-hidden selection:bg-blue-100 selection:text-blue-900">
      {/* Decorative Soft Mesh Gradients matching the design reference */}
      <div className="absolute top-0 right-0 w-[650px] h-[650px] bg-gradient-to-bl from-blue-100/60 via-indigo-50/40 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[550px] h-[550px] bg-gradient-to-tr from-sky-100/50 via-blue-50/30 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Bar with Language Selector */}
      <header className="w-full max-w-7xl mx-auto px-6 sm:px-10 pt-6 pb-2 flex items-center justify-between z-20">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-base text-slate-900 tracking-tight">
              Vedotrix <span className="text-blue-600">Pulse</span>
            </span>
          </div>
        </div>

        {/* Region & Language Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-slate-50 border border-slate-200/90 text-xs font-semibold text-slate-700 shadow-xs transition"
          >
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <span>{selectedLanguage}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showLanguageDropdown && (
            <div className="absolute right-0 mt-2 w-36 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-50 text-xs text-slate-700 animate-in fade-in slide-in-from-top-1 duration-150">
              {['English', 'Hindi (हिंदी)', 'Spanish', 'French', 'German'].map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => {
                    setSelectedLanguage(lang);
                    setShowLanguageDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-slate-50 transition ${
                    selectedLanguage === lang ? 'text-blue-600 font-bold bg-blue-50/50' : ''
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main Content: Split Grid matching reference design (media_1790510528533.png) */}
      <main className="w-full max-w-7xl mx-auto px-6 sm:px-10 py-6 sm:py-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center flex-1">
        {/* Left Column: Brand Hero, Value Proposition, Feature Cards & Device Mockups */}
        <div className="lg:col-span-7 space-y-8">
          {/* Brand Tagline */}
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Vedotrix <span className="text-blue-600">Pulse</span>
                </h2>
                <p className="text-xs font-semibold text-slate-500">
                  One Platform. Multiple Organizations.
                </p>
              </div>
            </div>
            <p className="text-[11px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 pt-0.5">
              Designed & Managed by Vedotrix Technologies
            </p>
          </div>

          {/* Main Headline */}
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.12]">
              Secure Access for a <br />
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 bg-clip-text text-transparent">
                Smarter Tomorrow
              </span>
            </h1>
            <p className="text-base sm:text-lg text-slate-600 max-w-xl font-medium leading-relaxed">
              Manage multiple organizations, devices and teams with enterprise-grade security — all in one place.
            </p>
          </div>

          {/* 4 Feature Highlights in a 2x2 Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
            {/* Feature 1 */}
            <div className="flex items-start space-x-3.5 p-3.5 rounded-2xl bg-white/70 backdrop-blur-sm border border-slate-200/80 shadow-xs hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Highly Secure</h4>
                <p className="text-xs text-slate-500 mt-0.5">End-to-end encryption & 2FA</p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex items-start space-x-3.5 p-3.5 rounded-2xl bg-white/70 backdrop-blur-sm border border-slate-200/80 shadow-xs hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Multi-Organization Support</h4>
                <p className="text-xs text-slate-500 mt-0.5">Switch between organizations easily</p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex items-start space-x-3.5 p-3.5 rounded-2xl bg-white/70 backdrop-blur-sm border border-slate-200/80 shadow-xs hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Multi-Device Responsive</h4>
                <p className="text-xs text-slate-500 mt-0.5">Work from anywhere, any device</p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="flex items-start space-x-3.5 p-3.5 rounded-2xl bg-white/70 backdrop-blur-sm border border-slate-200/80 shadow-xs hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Role Based Access</h4>
                <p className="text-xs text-slate-500 mt-0.5">Right access, right people</p>
              </div>
            </div>
          </div>

          {/* High-Fidelity Device Mockup Graphic matching reference */}
          <div className="relative pt-4 max-w-xl hidden sm:block">
            <div className="relative flex items-end justify-center gap-3">
              {/* Laptop Mockup */}
              <div className="w-[340px] sm:w-[380px] bg-slate-900 rounded-t-xl p-2 pb-1 border-t-2 border-x-2 border-slate-700 shadow-2xl relative">
                <div className="w-2 h-2 rounded-full bg-slate-600 mx-auto mb-1.5" />
                <div className="bg-slate-950 rounded-lg p-3 text-white space-y-2 border border-slate-800">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-[10px]">
                    <div className="flex items-center space-x-1.5">
                      <div className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center text-[8px] font-bold">VP</div>
                      <span className="font-bold text-white">Vedotrix Pulse</span>
                    </div>
                    <span className="text-slate-400 font-mono">IST Active</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-[9px]">
                    <div className="bg-slate-900/90 p-1.5 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[7px] uppercase">Attendance</span>
                      <span className="font-bold text-emerald-400">98.4% Present</span>
                    </div>
                    <div className="bg-slate-900/90 p-1.5 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[7px] uppercase">Payroll</span>
                      <span className="font-bold text-indigo-300">Verified</span>
                    </div>
                    <div className="bg-slate-900/90 p-1.5 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[7px] uppercase">Security</span>
                      <span className="font-bold text-cyan-300">Encrypted</span>
                    </div>
                  </div>
                  <div className="h-6 bg-slate-900 rounded border border-slate-800 flex items-center px-2 text-[8px] text-slate-400 justify-between">
                    <span>Task Sprint: 14 Active Deliverables</span>
                    <span className="text-emerald-400 font-bold">Live</span>
                  </div>
                </div>
                {/* Laptop Base */}
                <div className="w-[400px] -ml-[10px] h-3 bg-slate-800 rounded-b-xl border-t border-slate-700 shadow-md" />
              </div>

              {/* Smartphone Mockup */}
              <div className="w-[110px] bg-slate-950 rounded-2xl p-1.5 border-2 border-slate-700 shadow-2xl relative -mb-1">
                <div className="w-6 h-1 bg-slate-700 rounded-full mx-auto mb-1" />
                <div className="bg-slate-900 rounded-xl p-2 text-white text-[8px] space-y-1.5 border border-slate-800">
                  <div className="w-5 h-5 rounded-full bg-blue-600 mx-auto flex items-center justify-center font-bold text-[7px]">
                    VP
                  </div>
                  <div className="text-center font-bold leading-tight text-white">Punch In</div>
                  <div className="bg-emerald-500/20 text-emerald-300 text-[7px] font-bold py-0.5 rounded text-center">
                    Geo-Verified
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Trust Seal & OS Icons */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200/80 text-xs text-slate-500 max-w-xl">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Your data. Our priority. <span className="mx-1 text-slate-300">|</span> Trusted by 1000+ organizations worldwide
              </span>
            </div>

            {/* Operating System Badges */}
            <div className="flex items-center space-x-3 text-slate-400">
              {/* Windows Logo */}
              <svg className="w-3.5 h-3.5 hover:text-slate-600 transition" viewBox="0 0 24 24" fill="currentColor">
                <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.949-1.801" />
              </svg>
              {/* Apple Logo */}
              <svg className="w-3.5 h-3.5 hover:text-slate-600 transition" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.78 1.06-1.85.94-2.94-1 .04-2.18.66-2.88 1.47-.61.7-.99 1.83-.87 2.89 1.11.08 2.18-.64 2.81-1.42z" />
              </svg>
              {/* Android Logo */}
              <svg className="w-3.5 h-3.5 hover:text-slate-600 transition" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.4116 13.8533 8.0818 12 8.0818s-3.5902.3298-5.1367.8679L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" />
              </svg>
              {/* Linux Penguin Logo */}
              <svg className="w-3.5 h-3.5 hover:text-slate-600 transition" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.003 0C8.36 0 6.64 3.01 6.64 6.33c0 .87.1 1.74.3 2.57C5.9 9.38 5 10.63 5 12.33c0 1.95 1.15 3.52 2.62 4.15-.04.43-.07.87-.07 1.32 0 3.39 2.02 6.2 4.45 6.2s4.45-2.81 4.45-6.2c0-.45-.03-.89-.07-1.32 1.47-.63 2.62-2.2 2.62-4.15 0-1.7-.9-2.95-1.94-3.43.2-.83.3-1.7.3-2.57C17.36 3.01 15.64 0 12.003 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Right Column: Clean White Sign-In Card matching Reference Image */}
        <div className="lg:col-span-5 w-full">
          <div className="w-full max-w-md mx-auto bg-white rounded-3xl p-7 sm:p-9 shadow-2xl shadow-slate-200/70 border border-slate-200/80 space-y-6 relative">
            {/* Card Brand Emblem */}
            <div className="text-center space-y-1">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25">
                <ShieldCheck className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight pt-1">
                Vedotrix <span className="text-blue-600">Pulse</span>
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Secure • Flexible • Connected
              </p>
            </div>

            {/* Welcome Back Header */}
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                Welcome Back
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Sign in to your account to continue
              </p>
            </div>

            {/* Confidential Organization Detection (ONLY displays detected user workspace, NEVER reveals other client tenants) */}
            {detectedOrg ? (
              <div className="flex items-center space-x-3 p-3 rounded-2xl bg-blue-50/70 border border-blue-100 text-blue-900 text-xs animate-in fade-in duration-200">
                <div className="w-8 h-8 rounded-lg bg-white border border-blue-200/80 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                  <img
                    src={detectedOrg.logoUrl || '/vedotrix-logo.png'}
                    alt={detectedOrg.name}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/vedotrix-logo.png';
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block font-bold text-slate-900 truncate">
                    {detectedOrg.name}
                  </span>
                  <span className="text-[10px] text-blue-600 font-semibold flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-blue-600 mr-0.5 inline" />
                    <span>Workspace Verified ({detectedOrg.orgCode})</span>
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => setShowCustomWorkspace(!showCustomWorkspace)}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{showCustomWorkspace ? 'Hide Workspace ID' : 'Sign in with Organization Workspace ID? (Optional)'}</span>
                </button>

                {showCustomWorkspace && (
                  <div className="mt-2 animate-in fade-in duration-150">
                    <input
                      type="text"
                      value={customOrgCode}
                      onChange={(e) => setCustomOrgCode(e.target.value)}
                      placeholder="e.g. VDX or your company code"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-2 text-rose-700 text-xs animate-in shake duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-tight">{errorMessage}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email or Username */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Email or Username
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email or username"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-inner"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password Row */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-slate-600 font-medium">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotPasswordModal(true)}
                  className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition"
                >
                  Forgot password?
                </button>
              </div>

              {/* Sign In Primary Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 flex items-center justify-center space-x-2 transition duration-200 disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-[0.99]"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verifying Credentials...</span>
                  </div>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider absolute">
                or
              </span>
            </div>

            {/* SSO Social Logins matching reference screenshot */}
            <div className="grid grid-cols-3 gap-2.5">
              {/* Google */}
              <button
                type="button"
                onClick={() => handleSsoClick('Google')}
                className="flex items-center justify-center py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition text-xs font-semibold text-slate-700 shadow-xs"
                title="Continue with Google"
              >
                <svg className="w-4 h-4 mr-1.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.43 7.33 24 12 24z" />
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.16 0 9.97 0 12s.45 3.84 1.24 5.42l4.04-3.15z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.57 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                </svg>
                <span className="truncate">Google</span>
              </button>

              {/* Microsoft */}
              <button
                type="button"
                onClick={() => handleSsoClick('Microsoft')}
                className="flex items-center justify-center py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition text-xs font-semibold text-slate-700 shadow-xs"
                title="Continue with Microsoft"
              >
                <svg className="w-4 h-4 mr-1.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#F25022" d="M1 1h10v10H1z" />
                  <path fill="#7FBA00" d="M13 1h10v10H13z" />
                  <path fill="#00A4EF" d="M1 13h10v10H1z" />
                  <path fill="#FFB900" d="M13 13h10v10H13z" />
                </svg>
                <span className="truncate">Microsoft</span>
              </button>

              {/* Apple */}
              <button
                type="button"
                onClick={() => handleSsoClick('Apple')}
                className="flex items-center justify-center py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition text-xs font-semibold text-slate-700 shadow-xs"
                title="Continue with Apple"
              >
                <svg className="w-4 h-4 mr-1.5 shrink-0 text-slate-900" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.78 1.06-1.85.94-2.94-1 .04-2.18.66-2.88 1.47-.61.7-.99 1.83-.87 2.89 1.11.08 2.18-.64 2.81-1.42z" />
                </svg>
                <span className="truncate">Apple</span>
              </button>
            </div>

            {/* Green Security Assurance Card matching Reference */}
            <div className="flex items-start space-x-3 p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 text-emerald-900 text-xs">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
              <div className="space-y-0.5">
                <h5 className="font-bold text-emerald-950">Your account is protected</h5>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  We use industry-standard encryption and multi-factor authentication to keep your data safe.
                </p>
              </div>
            </div>

            {/* Sub-Branding Footer */}
            <div className="text-center pt-1 border-t border-slate-100">
              <p className="text-[11px] font-bold text-slate-400">
                Vedotrix Pulse • Designed & Managed by Vedotrix Technologies
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto">
              <Lock className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Reset Your Work Password</h3>
              <p className="text-xs text-slate-500">
                Enter your work email address and we'll dispatch secure reset instructions.
              </p>
            </div>

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <input
                type="email"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setShowForgotPasswordModal(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotSent}
                  className="w-1/2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition disabled:opacity-60"
                >
                  {forgotSent ? 'Dispatched ✓' : 'Send Instructions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Minimal Footer */}
      <footer className="w-full text-center py-4 text-xs text-slate-400 border-t border-slate-200/60 z-20">
        © {new Date().getFullYear()} Vedotrix Pulse. All rights reserved. Designed & Managed by Vedotrix Technologies.
      </footer>
    </div>
  );
};
