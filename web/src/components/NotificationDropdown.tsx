import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Bell,
  CheckCircle2,
  FileCheck2,
  MapPin,
  Banknote,
  Radio,
  Clock,
  Sparkles,
  X
} from 'lucide-react';
import { InAppNotification } from '../types';

interface NotificationDropdownProps {
  onNavigateTab: (tab: string) => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ onNavigateTab }) => {
  const { notifications, markNotificationRead, markAllNotificationsRead, unreadNotificationCount } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getCategoryIcon = (cat: InAppNotification['category']) => {
    switch (cat) {
      case 'offer':
        return <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'attendance':
        return <MapPin className="w-3.5 h-3.5 text-cyan-400" />;
      case 'payroll':
        return <Banknote className="w-3.5 h-3.5 text-indigo-400" />;
      case 'broadcast':
        return <Radio className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const handleNotificationClick = (n: InAppNotification) => {
    markNotificationRead(n.id);
    if (n.linkTab) {
      onNavigateTab(n.linkTab);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle In-App Notifications"
        className="relative p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/80 transition"
      >
        <Bell className="w-4 h-4" />
        {unreadNotificationCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan-500 text-slate-950 font-extrabold text-[9px] flex items-center justify-center shadow-lg shadow-cyan-500/40">
            {unreadNotificationCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 max-w-[calc(100vw-2rem)] w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          {/* Header */}
          <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bell className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-white">Notifications</h3>
              {unreadNotificationCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  {unreadNotificationCount} new
                </span>
              )}
            </div>

            {unreadNotificationCount > 0 && (
              <button
                onClick={markAllNotificationsRead}
                className="text-[10px] text-cyan-400 hover:underline font-semibold"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No notifications right now.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 transition cursor-pointer flex items-start space-x-3 ${
                    n.isRead ? 'bg-slate-900/60 hover:bg-slate-800/40' : 'bg-indigo-950/20 hover:bg-indigo-950/40'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 shrink-0 mt-0.5">
                    {getCategoryIcon(n.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className={`text-xs truncate ${n.isRead ? 'text-slate-300 font-medium' : 'text-white font-bold'}`}>
                        {n.title}
                      </h4>
                      <span className="text-[10px] text-slate-500 shrink-0 ml-2">{n.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
                      {n.message}
                    </p>
                  </div>
                  {!n.isRead && (
                    <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 self-center" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-950 border-t border-slate-800 text-center text-[10px] text-slate-500">
            Vedotrix Real-Time Push Gateway
          </div>
        </div>
      )}
    </div>
  );
};
