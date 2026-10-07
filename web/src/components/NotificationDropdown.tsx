import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Bell,
  BellRing,
  FileCheck2,
  MapPin,
  Banknote,
  Radio,
  Clock,
  Sparkles,
  CheckCircle2,
  Calendar,
  CheckSquare,
  Volume2,
  Check,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Inbox
} from 'lucide-react';
import { InAppNotification } from '../types';
import { formatRelativeTime } from '../lib/serialUtils';
import {
  getDeviceNotificationPermission,
  requestDeviceNotificationPermission,
  playNotificationChime
} from '../lib/deviceNotifications';

interface NotificationDropdownProps {
  onNavigateTab: (tab: string) => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ onNavigateTab }) => {
  const { notifications, markNotificationRead, markAllNotificationsRead, unreadNotificationCount } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'attendance' | 'task' | 'system'>('all');
  const [devicePerm, setDevicePerm] = useState<NotificationPermission | 'unsupported'>(() => getDeviceNotificationPermission());
  const [, setTick] = useState(0);
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

  // Dynamic relative time updater: ticks every 30 seconds to recalculate relative elapsed time
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Refresh permission when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setDevicePerm(getDeviceNotificationPermission());
    }
  }, [isOpen]);

  const handleEnableDeviceAlerts = async () => {
    const granted = await requestDeviceNotificationPermission();
    setDevicePerm(granted ? 'granted' : 'denied');
  };

  const getCategoryDetails = (cat: InAppNotification['category']) => {
    switch (cat) {
      case 'attendance':
        return {
          icon: <MapPin className="w-3.5 h-3.5" />,
          colorClass: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
          label: 'Attendance'
        };
      case 'leave':
        return {
          icon: <Calendar className="w-3.5 h-3.5" />,
          colorClass: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
          label: 'Leave'
        };
      case 'task':
        return {
          icon: <CheckSquare className="w-3.5 h-3.5" />,
          colorClass: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/30',
          label: 'Task'
        };
      case 'payroll':
        return {
          icon: <Banknote className="w-3.5 h-3.5" />,
          colorClass: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
          label: 'Payroll'
        };
      case 'offer':
        return {
          icon: <FileCheck2 className="w-3.5 h-3.5" />,
          colorClass: 'text-blue-400 bg-blue-500/15 border-blue-500/30',
          label: 'Offer Letter'
        };
      case 'broadcast':
      case 'announcement':
        return {
          icon: <Radio className="w-3.5 h-3.5" />,
          colorClass: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
          label: 'Announcement'
        };
      default:
        return {
          icon: <Sparkles className="w-3.5 h-3.5" />,
          colorClass: 'text-slate-400 bg-slate-500/15 border-slate-500/30',
          label: 'System'
        };
    }
  };

  const handleNotificationClick = (n: InAppNotification) => {
    markNotificationRead(n.id);
    if (n.linkTab) {
      onNavigateTab(n.linkTab);
      setIsOpen(false);
    }
  };

  // Filter notifications by active tab
  const filteredNotifications = useMemo(() => {
    if (activeTab === 'unread') {
      return notifications.filter((n) => !n.isRead);
    }
    if (activeTab === 'attendance') {
      return notifications.filter((n) => n.category === 'attendance' || n.category === 'leave');
    }
    if (activeTab === 'task') {
      return notifications.filter((n) => n.category === 'task');
    }
    if (activeTab === 'system') {
      return notifications.filter((n) => n.category === 'system' || n.category === 'broadcast' || n.category === 'announcement' || n.category === 'offer');
    }
    return notifications;
  }, [notifications, activeTab]);

  const countDisplay = unreadNotificationCount;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle In-App Notifications"
        className="relative p-2 rounded-full hover:bg-[var(--bg-card-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
        title="Notifications & Alerts"
      >
        <Bell className="w-5 h-5" />
        {countDisplay > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white font-black text-[9px] flex items-center justify-center shadow-xs animate-in zoom-in-50 duration-150">
            {countDisplay > 99 ? '99+' : countDisplay}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-[420px] max-w-[420px] rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="p-3.5 bg-[var(--bg-card-subtle)] border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-[var(--text-primary)] leading-tight">Notifications</h3>
                <span className="text-[10px] text-[var(--text-muted)]">Live Workspace Alerts</span>
              </div>
              {unreadNotificationCount > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 ml-1">
                  {unreadNotificationCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => playNotificationChime()}
                title="Test Audio Chime"
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-blue-400 hover:bg-[var(--bg-card)] transition text-[11px]"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>

              {unreadNotificationCount > 0 && (
                <button
                  type="button"
                  onClick={markAllNotificationsRead}
                  className="text-[10px] text-blue-400 hover:text-blue-300 font-bold transition flex items-center gap-1 hover:underline px-1.5 py-0.5 rounded"
                >
                  <Check className="w-3 h-3" />
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Device Push Notification Banner (if not granted) */}
          {devicePerm !== 'granted' && (
            <div className="p-2.5 bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border-b border-blue-800/30 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center space-x-2 min-w-0">
                <BellRing className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                <p className="text-[10px] text-[var(--text-primary)] leading-tight font-medium truncate">
                  Enable device push alerts for shift & message chimes
                </p>
              </div>
              <button
                type="button"
                onClick={handleEnableDeviceAlerts}
                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] transition shrink-0 shadow-xs"
              >
                Enable
              </button>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-card)] overflow-x-auto no-scrollbar shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-subtle)]'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unread')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition whitespace-nowrap ${
                activeTab === 'unread'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-subtle)]'
              }`}
            >
              Unread ({unreadNotificationCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition whitespace-nowrap ${
                activeTab === 'attendance'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-subtle)]'
              }`}
            >
              Attendance
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('task')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition whitespace-nowrap ${
                activeTab === 'task'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-subtle)]'
              }`}
            >
              Tasks
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('system')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition whitespace-nowrap ${
                activeTab === 'system'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-subtle)]'
              }`}
            >
              System
            </button>
          </div>

          {/* List of Notifications */}
          <div className="overflow-y-auto divide-y divide-[var(--border-color)] flex-1 overscroll-contain">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-[var(--bg-card-subtle)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] mb-2.5">
                  <Inbox className="w-5 h-5 opacity-60" />
                </div>
                <h4 className="text-xs font-bold text-[var(--text-primary)]">You're all caught up!</h4>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  {activeTab === 'unread' ? 'No unread notifications.' : 'No alerts in this category.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((n) => {
                const catDetails = getCategoryDetails(n.category);
                const displayTime = formatRelativeTime(n.createdAt || n.timestamp);

                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-3.5 transition cursor-pointer flex items-start space-x-3 group relative ${
                      n.isRead
                        ? 'bg-[var(--bg-card)] hover:bg-[var(--bg-card-subtle)]'
                        : 'bg-blue-500/5 hover:bg-blue-500/10'
                    }`}
                  >
                    {/* Category Icon Badge */}
                    <div
                      className={`p-2 rounded-xl border shrink-0 mt-0.5 shadow-xs ${catDetails.colorClass}`}
                      title={catDetails.label}
                    >
                      {catDetails.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center space-x-1.5 truncate">
                          <h4
                            className={`text-xs truncate ${
                              n.isRead
                                ? 'text-[var(--text-primary)] font-semibold'
                                : 'text-[var(--text-primary)] font-extrabold'
                            }`}
                          >
                            {n.title}
                          </h4>
                          <span
                            className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded border ${catDetails.colorClass}`}
                          >
                            {catDetails.label}
                          </span>
                        </div>

                        {/* Formatted Relative Timestamp */}
                        <div className="flex items-center space-x-1 shrink-0 ml-1">
                          <Clock className="w-2.5 h-2.5 text-[var(--text-muted)]" />
                          <span className="text-[10px] font-mono text-[var(--text-muted)] font-medium">
                            {displayTime}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-relaxed break-words">
                        {n.message}
                      </p>

                      {/* Action Hint */}
                      {n.linkTab && (
                        <div className="mt-2 flex items-center space-x-1 text-[10px] text-blue-400 group-hover:text-blue-300 font-bold transition">
                          <span>Open in {n.linkTab.toUpperCase()}</span>
                          <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      )}
                    </div>

                    {/* Unread Indicator & Mark Read Button */}
                    <div className="shrink-0 flex items-center pl-1 self-center">
                      {!n.isRead ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markNotificationRead(n.id);
                          }}
                          title="Mark as read"
                          className="w-4 h-4 rounded-full bg-blue-600 hover:bg-emerald-500 text-white flex items-center justify-center transition shadow-xs"
                        >
                          <Check className="w-2.5 h-2.5" />
                        </button>
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-transparent" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-[var(--bg-card-subtle)] border-t border-[var(--border-color)] flex items-center justify-between text-[10px] text-[var(--text-muted)] shrink-0">
            <div className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold">Supabase Realtime Live</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-[9px]">
                {devicePerm === 'granted' ? '🔔 Device Alerts ON' : '🔕 Device Alerts OFF'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
