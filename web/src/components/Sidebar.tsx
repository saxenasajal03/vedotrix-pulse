import React from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarDays,
  Banknote,
  TrendingUp,
  Briefcase,
  GraduationCap,
  FileSpreadsheet,
  Settings,
  Headphones,
  X,
  ChevronRight,
  ShieldCheck,
  Crown
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
  const {
    currentOrg,
    currentProfile,
    isVedotrixSuperadmin,
    offerLetters,
    attendanceRecords,
    tasks,
    accessRequests,
    orgProfiles,
    leaveRequests,
    addToast
  } = useApp();

  const pendingRegularizations = attendanceRecords.filter((a) => a.regularizationStatus === 'pending').length;
  const pendingOffers = offerLetters.filter((o) => o.status === 'issued').length;
  const pendingApprovalsCount = accessRequests.filter(
    (r) =>
      r.status === 'pending' &&
      (r.assignedApproverId === currentProfile?.id ||
        (currentProfile?.role === 'owner' && r.orgId === currentOrg?.id) ||
        (currentProfile?.role === 'superadmin' && isVedotrixSuperadmin))
  ).length;

  const pendingLeavesCount = leaveRequests.filter(
    (l) =>
      l.status === 'pending' &&
      (l.assignedApproverId === currentProfile?.id ||
        (currentProfile?.role === 'owner' && l.orgId === currentOrg?.id) ||
        (currentProfile?.role === 'superadmin' && isVedotrixSuperadmin) ||
        (currentProfile?.role === 'hr' && l.orgId === currentOrg?.id))
  ).length;

  const isHrOrSuperadmin =
    currentProfile?.role === 'hr' ||
    currentProfile?.role === 'owner' ||
    currentProfile?.role === 'superadmin' ||
    isVedotrixSuperadmin;

  // Exact navigation item list matching the reference image
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'employees',
      label: 'Employees',
      icon: Users,
      badge: `${orgProfiles.length}`
    },
    {
      id: 'attendance',
      label: 'Attendance',
      icon: Clock,
      badge: pendingRegularizations > 0 && isHrOrSuperadmin ? `${pendingRegularizations}` : null
    },
    {
      id: 'leaves',
      label: 'Leave',
      icon: CalendarDays,
      badge: pendingLeavesCount > 0 ? `${pendingLeavesCount}` : null
    },
    {
      id: 'payroll',
      label: 'Payroll',
      icon: Banknote,
      badge: isHrOrSuperadmin ? null : 'Slips'
    },
    {
      id: 'tasks',
      label: 'Performance',
      icon: TrendingUp,
      badge: `${tasks.length}`
    },
    {
      id: 'offers',
      label: 'Recruitment',
      icon: Briefcase,
      badge: pendingOffers > 0 && isHrOrSuperadmin ? `${pendingOffers}` : null
    },
    {
      id: 'standups',
      label: 'Training & Development',
      icon: GraduationCap,
      badge: null
    },
    {
      id: 'access_requests',
      label: 'Reports',
      icon: FileSpreadsheet,
      badge: pendingApprovalsCount > 0 ? `${pendingApprovalsCount}` : null
    },
    {
      id: isVedotrixSuperadmin ? 'superadmin' : 'access_requests',
      label: 'Settings',
      icon: Settings,
      badge: isVedotrixSuperadmin ? 'MASTER' : null
    }
  ];

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    if (onCloseMobile) onCloseMobile();
  };

  const handleContactSupport = () => {
    addToast(
      'Support Team Alerted 🎧',
      'Our 24/7 technical team has received your inquiry. We will contact you at ' + (currentProfile?.email || 'your registered work email.'),
      'info'
    );
  };

  const renderNavContent = (isMobileView = false) => (
    <div className="flex flex-col justify-between h-full bg-[#0b1329] text-white select-none">
      <div className="p-5 space-y-6 overflow-y-auto">
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <div
            onClick={() => handleTabClick('dashboard')}
            className="flex items-center space-x-3 cursor-pointer group min-w-0"
          >
            {/* Dynamic Organization Logo */}
            <div className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center shadow-lg shadow-blue-500/10 shrink-0 group-hover:scale-105 transition-transform overflow-hidden p-1.5">
              <img
                src={currentOrg.logoUrl || '/vedotrix-logo.png'}
                alt={currentOrg.name}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/vedotrix-logo.png';
                }}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <span className="text-sm font-extrabold text-white tracking-tight leading-snug truncate">
                  {currentOrg.name}
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-bold text-cyan-400">
                  Vedotrix Pulse
                </span>
                {isVedotrixSuperadmin ? (
                  <span className="text-[8px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    SUPER CONTROLLER
                  </span>
                ) : (
                  <span className="text-[8px] font-bold px-1 rounded bg-slate-800 text-slate-400">
                    {currentOrg.orgCode}
                  </span>
                )}
              </div>
              <p className="text-[9px] text-slate-400 font-medium tracking-tight truncate">
                Designed & Managed by Vedotrix Technologies
              </p>
            </div>
          </div>

          {isMobileView && (
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white shrink-0 ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Current Org Indicator Pill */}
        <div className="px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="font-semibold text-slate-200 truncate">{currentOrg.name}</span>
          </div>
          <span className="text-[10px] font-mono text-cyan-400 font-bold ml-1 shrink-0">
            {currentOrg.orgCode}
          </span>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.label}
                onClick={() => handleTabClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                      isActive
                        ? 'bg-blue-700/80 text-white'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Support Card & Org branding */}
      <div className="p-4 space-y-3 border-t border-slate-800/80">
        {/* Exact Need Help Card from Screenshot */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900 to-[#0e172e] border border-slate-800 text-center space-y-2 shadow-inner">
          <div className="w-9 h-9 mx-auto rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <Headphones className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Need Help?</h4>
            <p className="text-[10px] text-slate-400 leading-snug mt-0.5">
              Our support team is here 24/7.
            </p>
          </div>
          <button
            onClick={handleContactSupport}
            className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700"
          >
            Contact Support
          </button>
        </div>

        {/* Verification Shortcut */}
        <button
          onClick={() => {
            onOpenVerifyModal();
            if (onCloseMobile) onCloseMobile();
          }}
          className="w-full flex items-center justify-center space-x-1.5 py-1.5 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30 rounded-lg transition border border-emerald-500/20"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Verify Offer / Credentials</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 bg-[#0b1329] border-r border-slate-800/80 flex-col shrink-0 h-screen sticky top-0 z-30 transition-colors">
        {renderNavContent(false)}
      </aside>

      {/* 2. Mobile Off-Canvas Drawer with Backdrop */}
      <div
        className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
          onClick={onCloseMobile}
        />
        <div
          className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-[#0b1329] border-r border-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {renderNavContent(true)}
        </div>
      </div>
    </>
  );
};
