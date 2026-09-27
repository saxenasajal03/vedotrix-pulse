import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Bell,
  FileCheck2,
  MapPin,
  Banknote,
  Radio,
  Clock,
  Sparkles,
  CheckCircle2
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
        return <FileCheck2 className="w-3.5 h-3.5 text-blue-600" />;
      case 'attendance':
        return <MapPin className="w-3.5 h-3.5 text-emerald-600" />;
      case 'payroll':
        return <Banknote className="w-3.5 h-3.5 text-purple-600" />;
      case 'broadcast':
        return <Radio className="w-3.5 h-3.5 text-amber-600" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const handleNotificationClick = (n: InAppNotification) => {
    markNotificationRead(n.id);
    if (n.linkTab) {
      onNavigateTab(n.linkTab);
      setIsOpen(false);
    }
  };

  const countDisplay = unreadNotificationCount;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle In-App Notifications"
        className="relative p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
      >
        <Bell className="w-5 h-5" />
        {countDisplay > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white font-extrabold text-[9px] flex items-center justify-center shadow-xs animate-in zoom-in-50 duration-150">
            {countDisplay > 99 ? '99+' : countDisplay}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 max-w-[calc(100vw-2rem)] w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          {/* Header */}
          <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bell className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-900">Notifications</h3>
              {unreadNotificationCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {unreadNotificationCount} new
                </span>
              )}
            </div>

            {unreadNotificationCount > 0 && (
              <button
                onClick={markAllNotificationsRead}
                className="text-[10px] text-blue-600 hover:underline font-semibold"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No notifications right now.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 transition cursor-pointer flex items-start space-x-3 ${
                    n.isRead ? 'bg-white hover:bg-slate-50' : 'bg-blue-50/40 hover:bg-blue-50/70'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 shrink-0 mt-0.5">
                    {getCategoryIcon(n.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className={`text-xs truncate ${n.isRead ? 'text-slate-700 font-medium' : 'text-slate-900 font-bold'}`}>
                        {n.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 shrink-0 ml-2">{n.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                      {n.message}
                    </p>
                  </div>
                  {!n.isRead && (
                    <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0 self-center" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center text-[10px] text-slate-400">
            Vedotrix Push Gateway Active
          </div>
        </div>
      )}
    </div>
  );
};
