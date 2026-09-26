import React from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard,
  FileCheck2,
  MapPin,
  KanbanSquare,
  Clock,
  Banknote,
  ShieldCheck,
  Building,
  Sparkles,
  Crown,
  X,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenVerifyModal: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenVerifyModal,
  mobileOpen = false,
  onCloseMobile
}) => {
  const { currentOrg, currentProfile, offerLetters, attendanceRecords, tasks, accessRequests } = useApp();

  const isSuperadmin =
    currentProfile.role === 'superadmin' &&
    (currentProfile.orgId === '00000000-0000-0000-0000-000000000001' ||
     currentProfile.email.toLowerCase() === 'admin@vedotrix.com' ||
     currentProfile.email.toLowerCase() === 'sajalsaxenagola@gmail.com');
  const pendingRegularizations = attendanceRecords.filter((a) => a.regularizationStatus === 'pending').length;
  const pendingOffers = offerLetters.filter((o) => o.status === 'issued').length;
  const pendingApprovalsCount = accessRequests.filter(
    (r) =>
      r.status === 'pending' &&
      (r.assignedApproverId === currentProfile.id ||
        (currentProfile.role === 'owner' && r.orgId === currentOrg.id) ||
        (currentProfile.role === 'superadmin'))
  ).length;

  const navItems = [
    ...(isSuperadmin
      ? [
          {
            id: 'superadmin',
            label: 'Super Controller Hub',
            icon: Crown,
            badge: 'MASTER',
            color: 'text-cyan-400'
          }
        ]
      : []),
    {
      id: 'dashboard',
      label: 'Dashboard Overview',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'offers',
      label: 'Offer Letters & Verification',
      icon: FileCheck2,
      badge: pendingOffers > 0 ? `${pendingOffers} Active` : null
    },
    {
      id: 'attendance',
      label: 'Geo-Fenced Attendance',
      icon: MapPin,
      badge: pendingRegularizations > 0 && (currentProfile.role === 'hr' || currentProfile.role === 'owner') ? `${pendingRegularizations} Regs` : null
    },
    {
      id: 'tasks',
      label: currentOrg.industry === 'Tech' ? 'Tech Sprints & Git' : 'Campaigns & ROAS',
      icon: KanbanSquare,
      badge: `${tasks.length} Tasks`
    },
    {
      id: 'standups',
      label: 'Daily EOD Standups',
      icon: Clock,
      badge: null
    },
    {
      id: 'payroll',
      label: 'Payroll & Disbursals',
      icon: Banknote,
      badge: 'Auto'
    },
    {
      id: 'access_requests',
      label: 'Access & Hierarchy',
      icon: ShieldCheck,
      badge: pendingApprovalsCount > 0 ? `${pendingApprovalsCount} Req` : null
    }
  ];

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    if (onCloseMobile) onCloseMobile();
  };

  const renderNavContent = (isMobileView = false) => (
    <div className="flex flex-col justify-between h-full">
      <div className="p-4 space-y-5 overflow-y-auto">
        {/* Mobile Header with Close Button */}
        {isMobileView && (
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <img src="/vedotrix-logo.png" alt="Vedotrix" className="w-7 h-7 object-contain" />
              <span className="font-extrabold text-sm text-white">
                Vedotrix <span className="text-cyan-400">Pulse</span>
              </span>
            </div>
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              aria-label="Close Navigation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Organization Card */}
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-900 border border-slate-700/60 shadow-inner">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-500/30 overflow-hidden shrink-0">
              <img src="/vedotrix-logo.png" alt="Org Logo" className="w-full h-full object-contain p-0.5" />
            </div>
            <div className="overflow-hidden min-w-0">
              <h2 className="text-xs font-bold text-white truncate">{currentOrg.name}</h2>
              <span className="inline-flex items-center text-[10px] text-cyan-400 font-medium">
                <Sparkles className="w-3 h-3 mr-1 shrink-0" />
                <span className="truncate">{currentOrg.industry} ({currentOrg.orgCode})</span>
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-600 via-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/30 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : item.color || 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge ? (
                  <span
                    className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                      isActive
                        ? 'bg-indigo-700 text-indigo-100'
                        : item.id === 'superadmin'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'bg-slate-800 text-indigo-300 border border-indigo-500/20'
                    }`}
                  >
                    {item.badge}
                  </span>
                ) : (
                  isMobileView && <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Quick Verification Widget */}
        <div className="pt-2">
          <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 space-y-2">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-bold">Public Verification</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Verify candidate credentials instantly using cryptographic serial codes.
            </p>
            <button
              onClick={() => {
                onOpenVerifyModal();
                if (onCloseMobile) onCloseMobile();
              }}
              className="w-full py-2 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
            >
              Open Serial Verifier
            </button>
          </div>
        </div>
      </div>

      {/* Footer Branding with Official Logo */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/60 shrink-0">
        <div className="flex items-center space-x-3">
          <img
            src="/vedotrix-logo.png"
            alt="Vedotrix Logo"
            className="w-8 h-8 object-contain rounded-lg p-0.5 bg-slate-900 border border-cyan-500/30 shrink-0"
          />
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400">Designed & Managed by</p>
            <p className="text-xs font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400 truncate">
              Vedotrix Technologies
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 bg-slate-900 border-r border-slate-800 flex-col shrink-0 min-h-[calc(100vh-4rem)] transition-colors">
        {renderNavContent(false)}
      </aside>

      {/* 2. Mobile Off-Canvas Drawer with Backdrop */}
      <div
        className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Dark Backdrop */}
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
          onClick={onCloseMobile}
        />

        {/* Slide-over Panel */}
        <div
          className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {renderNavContent(true)}
        </div>
      </div>
    </>
  );
};
