import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  Building2, 
  UserCheck, 
  ShieldCheck, 
  ChevronDown,
  Moon,
  Sun,
  Palette,
  Crown,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { UserRole, ThemeMode } from '../types';
import { NotificationDropdown } from './NotificationDropdown';

interface NavbarProps {
  onOpenVerifyModal: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onToggleMobileMenu?: () => void;
  mobileOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenVerifyModal,
  activeTab,
  setActiveTab,
  onToggleMobileMenu,
  mobileOpen = false
}) => {
  const {
    currentOrg,
    availableOrgs,
    switchOrganization,
    currentProfile,
    theme,
    setTheme,
    logout
  } = useApp();

  const isVedotrixSuperadmin =
    currentProfile.role === 'superadmin' &&
    (currentProfile.orgId === '00000000-0000-0000-0000-000000000001' ||
     currentProfile.email.toLowerCase() === 'admin@vedotrix.com' ||
     currentProfile.email.toLowerCase() === 'sajalsaxenagola@gmail.com');
  const isSuperadmin = isVedotrixSuperadmin;

  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Brand Logo & Hamburger */}
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              onClick={onToggleMobileMenu}
              className="p-2 -ml-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 md:hidden transition shrink-0"
              aria-label="Toggle Navigation Menu"
            >
              {mobileOpen ? <X className="w-5 h-5 text-cyan-400" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Brand Logo & Title */}
            <div
              className="flex items-center space-x-2.5 cursor-pointer min-w-0"
              onClick={() => setActiveTab('dashboard')}
            >
              <div className="relative group shrink-0">
                <img
                  src="/vedotrix-logo.png"
                  alt="Vedotrix Technologies Logo"
                  className="w-9 h-9 sm:w-10 sm:h-10 object-contain rounded-xl p-0.5 bg-slate-900 border border-cyan-500/40 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition"
                />
                <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-cyan-400 border-2 border-slate-900" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center space-x-1.5">
                  <span className="font-extrabold text-base sm:text-lg tracking-tight text-white truncate">
                    Vedotrix <span className="text-cyan-400">Pulse</span>
                  </span>
                  {isSuperadmin && (
                    <span className="hidden sm:inline-flex text-[9px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-1.5 py-0.5 rounded-full items-center space-x-1 shrink-0">
                      <Crown className="w-2.5 h-2.5 mr-0.5" />
                      <span>SUPER CONTROLLER</span>
                    </span>
                  )}
                </div>
                <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 truncate">
                  Designed & Managed by <span className="text-cyan-400 font-semibold">Vedotrix Technologies</span>
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions & Controls */}
          <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
            {/* SuperAdmin Quick Tab Button (Desktop) */}
            {isSuperadmin && (
              <button
                onClick={() => setActiveTab('superadmin')}
                className={`hidden lg:inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-extrabold rounded-lg transition border ${
                  activeTab === 'superadmin'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/30'
                    : 'bg-cyan-950/40 text-cyan-300 border-cyan-500/30 hover:bg-cyan-900/40'
                }`}
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Super Controller</span>
              </button>
            )}

            {/* Public Verification Quick Button */}
            <button
              onClick={onOpenVerifyModal}
              className="inline-flex items-center space-x-1 px-2 sm:px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all shadow-sm"
              title="Verify any offer letter by serial number"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">Verify</span>
            </button>

            {/* In-App Notifications Center */}
            <NotificationDropdown onNavigateTab={(tab) => setActiveTab(tab)} />

            {/* Multi-Theme Switcher Dropdown */}
            <div className="relative group">
              <div
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/80 cursor-pointer flex items-center space-x-1"
                title="Change UI Theme"
              >
                {theme === 'cyber-dark' && <Moon className="w-4 h-4 text-cyan-400" />}
                {theme === 'midnight' && <Palette className="w-4 h-4 text-indigo-400" />}
                {theme === 'corporate-light' && <Sun className="w-4 h-4 text-amber-400" />}
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as ThemeMode)}
                  aria-label="Select Theme Mode"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                >
                  <option value="cyber-dark">Cyber Dark (Vedotrix Neon)</option>
                  <option value="midnight">Midnight Blue (Deep Navy)</option>
                  <option value="corporate-light">Corporate Light (White)</option>
                </select>
              </div>
            </div>

            {/* Tenant Switcher (Vedotrix Superadmin Only) or Fixed Org Badge */}
            <div className="relative hidden sm:block">
              <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200">
                <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="font-bold text-xs text-white max-w-[150px] truncate">
                  {currentOrg.name}
                </span>
                <span className="font-semibold text-[10px] bg-slate-700 text-indigo-300 px-1.5 py-0.5 rounded">
                  {currentOrg.orgCode}
                </span>
                {isVedotrixSuperadmin && (
                  <>
                    <select
                      value={currentOrg.id}
                      onChange={(e) => switchOrganization(e.target.value)}
                      aria-label="Select Active Organization"
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    >
                      {availableOrgs.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name} ({org.orgCode}) {org.id === '00000000-0000-0000-0000-000000000001' ? '★ ROOT' : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </>
                )}
              </div>
            </div>

            {/* Authenticated User Badge */}
            <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-200">
              <UserCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="font-bold text-[9px] sm:text-[10px] bg-indigo-950 border border-indigo-500/40 text-cyan-300 px-1.5 py-0.5 rounded uppercase">
                {currentProfile.role}
              </span>
            </div>

            {/* Logout Action Button */}
            <button
              onClick={() => logout()}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700/80 hover:border-rose-500/40 transition"
              title="Secure Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
