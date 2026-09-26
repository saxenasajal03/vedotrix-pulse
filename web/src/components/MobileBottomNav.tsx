import React from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard,
  MapPin,
  KanbanSquare,
  ShieldCheck,
  Menu,
  Crown
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenMobileMenu: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenMobileMenu
}) => {
  const { currentProfile, accessRequests, attendanceRecords } = useApp();

  const isSuperadmin = currentProfile.role === 'superadmin';
  const pendingApprovalsCount = accessRequests.filter(
    (r) =>
      r.status === 'pending' &&
      (r.assignedApproverId === currentProfile.id || currentProfile.role === 'superadmin')
  ).length;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayAttendance = attendanceRecords.find((a) => a.date === todayStr);
  const isPunchedIn = !!(todayAttendance && !todayAttendance.checkOutTime);

  const navItems = [
    {
      id: isSuperadmin ? 'superadmin' : 'dashboard',
      label: isSuperadmin ? 'SuperAdmin' : 'Dashboard',
      icon: isSuperadmin ? Crown : LayoutDashboard,
      badge: null
    },
    {
      id: 'attendance',
      label: 'GPS Punch',
      icon: MapPin,
      badge: isPunchedIn ? 'IN' : null,
      badgeColor: 'bg-emerald-500'
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: KanbanSquare,
      badge: null
    },
    {
      id: 'access_requests',
      label: 'Access',
      icon: ShieldCheck,
      badge: pendingApprovalsCount > 0 ? `${pendingApprovalsCount}` : null,
      badgeColor: 'bg-cyan-500'
    }
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 px-3 py-1.5 shadow-[0_-4px_25px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-cyan-400 font-bold scale-105'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]' : 'text-slate-400'}`} />
                {item.badge && (
                  <span
                    className={`absolute -top-1.5 -right-2 text-[8px] font-extrabold text-slate-950 px-1 py-0.2 rounded-full ${
                      item.badgeColor || 'bg-cyan-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-extrabold text-white' : 'font-medium text-slate-400'}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-cyan-400 mt-0.5 animate-pulse" />
              )}
            </button>
          );
        })}

        {/* Menu Toggle Button */}
        <button
          onClick={onOpenMobileMenu}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-slate-400 hover:text-cyan-400 transition"
        >
          <div className="p-1 rounded-lg bg-slate-800/80 border border-slate-700/80">
            <Menu className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="text-[10px] mt-0.5 font-medium text-slate-400">More</span>
        </button>
      </div>
    </nav>
  );
};
