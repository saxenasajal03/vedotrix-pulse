import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Home,
  Users,
  CalendarDays,
  Menu,
  MessageSquare
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
  const { orgProfiles, leaveRequests, currentProfile, isVedotrixSuperadmin } = useApp();

  const isTopLeadership =
    currentProfile?.role === 'hr' ||
    currentProfile?.role === 'owner' ||
    currentProfile?.role === 'superadmin' ||
    isVedotrixSuperadmin;

  const managedEmployeesCount = orgProfiles.filter((p) => p.managerId === currentProfile?.id).length;
  const canAccessEmployees = isTopLeadership || managedEmployeesCount > 0;

  const pendingLeaves = leaveRequests.filter((l) => l.status === 'pending').length;

  const navItems = [
    {
      id: 'dashboard',
      label: 'Home',
      icon: Home,
      badge: null
    },
    canAccessEmployees
      ? {
          id: 'employees',
          label: isTopLeadership ? 'Employees' : 'Team',
          icon: Users,
          badge: isTopLeadership ? `${orgProfiles.length}` : `${managedEmployeesCount}`
        }
      : {
          id: 'chat',
          label: 'Chat',
          icon: MessageSquare,
          badge: null
        },
    {
      id: 'leaves',
      label: 'Leave',
      icon: CalendarDays,
      badge: pendingLeaves > 0 ? `${pendingLeaves}` : null,
      badgeColor: 'bg-amber-500 text-white'
    }
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200 px-3 py-1.5 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-150 ${
                isActive
                  ? 'text-blue-600 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                {item.badge && (
                  <span
                    className={`absolute -top-1.5 -right-2.5 text-[8px] font-extrabold px-1.5 py-0.2 rounded-full ${
                      item.badgeColor || 'bg-blue-600 text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-bold text-blue-600' : 'font-medium text-slate-500'}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-blue-600 mt-0.5" />
              )}
            </button>
          );
        })}

        {/* More Menu Toggle Button */}
        <button
          onClick={onOpenMobileMenu}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-xl text-slate-500 hover:text-slate-800 transition"
        >
          <Menu className="w-5 h-5 text-slate-400" />
          <span className="text-[10px] mt-0.5 font-medium text-slate-500">More</span>
        </button>
      </div>
    </nav>
  );
};
