import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Search,
  Building2,
  ShieldCheck,
  ChevronDown,
  LogOut,
  Menu,
  X,
  Crown,
  User,
  Settings
} from 'lucide-react';
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
    isVedotrixSuperadmin,
    logout
  } = useApp();

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setActiveTab('employees');
    }
  };

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] h-16">
      <div className="w-full h-full px-4 sm:px-8 flex items-center justify-between gap-3">
        {/* Left: Mobile Toggle & Global Search Bar */}
        <div className="flex items-center space-x-3 flex-1 max-w-xl">
          {/* Mobile Hamburger Toggle */}
          <button
            onClick={onToggleMobileMenu}
            className="p-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 md:hidden transition shrink-0"
            aria-label="Toggle Navigation Menu"
          >
            {mobileOpen ? <X className="w-5 h-5 text-blue-600" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Search bar matching reference screenshot */}
          <form onSubmit={handleSearchSubmit} className="relative w-full max-w-md">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search employees, departments, or anything..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-inner"
            />
          </form>
        </div>

        {/* Right: Actions, Notifications & User Profile */}
        <div className="flex items-center space-x-2 sm:space-x-4 shrink-0">
          {/* Tenant Switcher Pill */}
          <div className="relative hidden lg:block">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-700 hover:bg-slate-100 transition cursor-pointer">
              <div className="w-5 h-5 rounded-md bg-white border border-slate-200 p-0.5 flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src={currentOrg?.logoUrl || '/vedotrix-logo.png'}
                  alt={currentOrg?.name || 'Organization'}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/vedotrix-logo.png';
                  }}
                />
              </div>
              <span className="font-semibold text-xs text-slate-800 max-w-[130px] truncate">
                {currentOrg?.name || 'Vedotrix Technologies'}
              </span>
              <span className="font-mono text-[10px] text-slate-400 font-bold">
                {currentOrg?.orgCode || 'VDX'}
              </span>
              {isVedotrixSuperadmin && <ChevronDown className="w-3 h-3 text-slate-400" />}
            </div>
            {isVedotrixSuperadmin && (
              <select
                value={currentOrg?.id}
                onChange={(e) => switchOrganization(e.target.value)}
                aria-label="Switch Active Organization"
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              >
                {availableOrgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.orgCode}) {org.id === '00000000-0000-0000-0000-000000000001' ? '★ ROOT' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Quick Verification Button */}
          <button
            onClick={onOpenVerifyModal}
            className="hidden sm:inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition shadow-xs"
            title="Verify offer letters by serial code"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Verify</span>
          </button>

          {/* In-App Notifications Dropdown */}
          <NotificationDropdown onNavigateTab={(tab) => setActiveTab(tab)} />

          {/* User Profile Pill matching screenshot */}
          <div className="relative">
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center space-x-2.5 pl-2 py-1 pr-1.5 rounded-full hover:bg-slate-50 transition border border-transparent hover:border-slate-200"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs overflow-hidden border border-slate-200">
                {currentProfile?.avatarUrl && currentProfile.avatarUrl !== '/vedotrix-logo.png' ? (
                  <img
                    src={currentProfile.avatarUrl}
                    alt={currentProfile?.firstName || 'User'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{(currentProfile?.firstName?.[0] || 'U')}{(currentProfile?.lastName?.[0] || '')}</span>
                )}
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <span className="text-xs font-bold text-slate-900 block truncate max-w-[120px]">
                  {currentProfile?.firstName || 'User'} {currentProfile?.lastName || ''}
                </span>
                <span className="text-[10px] text-slate-500 font-medium capitalize block truncate max-w-[120px]">
                  {currentProfile?.role === 'owner' || currentProfile?.role === 'superadmin'
                    ? 'Admin'
                    : currentProfile?.designation || currentProfile?.role || 'Member'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                onClick={() => setIsProfileMenuOpen(false)}
              >
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900">
                    {currentProfile?.firstName || 'User'} {currentProfile?.lastName || ''}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">{currentProfile?.email || ''}</p>
                  <span className="inline-block mt-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {currentProfile?.role || 'member'}
                  </span>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => setActiveTab('employees')}
                    className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                  >
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>My Profile & Team</span>
                  </button>

                  {isVedotrixSuperadmin && (
                    <button
                      onClick={() => setActiveTab('superadmin')}
                      className="w-full px-4 py-2 text-left text-xs text-blue-700 hover:bg-blue-50 flex items-center space-x-2 font-semibold"
                    >
                      <Crown className="w-3.5 h-3.5 text-blue-600" />
                      <span>Super Controller Hub</span>
                    </button>
                  )}

                  <button
                    onClick={() => setActiveTab('access_requests')}
                    className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    <span>Preferences & Approvals</span>
                  </button>
                </div>

                <div className="pt-1 border-t border-slate-100">
                  <button
                    onClick={() => logout()}
                    className="w-full px-4 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center space-x-2 font-semibold"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
