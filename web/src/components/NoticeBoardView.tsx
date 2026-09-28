import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { NoticeItem, NoticeCategory, NoticePriority } from '../types';
import {
  Bell,
  Megaphone,
  Pin,
  Calendar,
  AlertTriangle,
  FileText,
  Plus,
  Trash2,
  X,
  Search,
  CheckCircle,
  Building,
  UserCheck
} from 'lucide-react';
import { formatISTDateTime, getTodayISTDateString } from '../lib/serialUtils';

export const NoticeBoardView: React.FC = () => {
  const {
    currentOrg,
    currentProfile,
    isVedotrixSuperadmin,
    notices,
    createNotice,
    deleteNotice,
    addToast
  } = useApp();

  const isHrOrSuperadmin =
    currentProfile?.role === 'hr' ||
    currentProfile?.role === 'owner' ||
    currentProfile?.role === 'superadmin' ||
    isVedotrixSuperadmin;

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Post Notice Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<NoticeCategory>('announcement');
  const [priority, setPriority] = useState<NoticePriority>('medium');
  const [isPinned, setIsPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtered Notices strictly scoped to active organization
  const filteredNotices = notices.filter((notice) => {
    if (currentOrg && notice.orgId && notice.orgId !== currentOrg.id) return false;
    if (activeCategory === 'pinned') return notice.isPinned;
    if (activeCategory !== 'all' && notice.category !== activeCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        notice.title.toLowerCase().includes(q) ||
        notice.content.toLowerCase().includes(q) ||
        notice.authorName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Sort pinned notices to the top, then newest date
  const sortedNotices = [...filteredNotices].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const handleOpenPostModal = () => {
    setTitle('');
    setContent('');
    setCategory('announcement');
    setPriority('medium');
    setIsPinned(false);
    setIsModalOpen(true);
  };

  const handlePostNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      addToast('Incomplete Form', 'Please provide a notice title and content description.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await createNotice({
        title: title.trim(),
        content: content.trim(),
        category,
        priority,
        authorId: currentProfile.id,
        authorName: `${currentProfile.firstName} ${currentProfile.lastName}`.trim(),
        authorRole: currentProfile.role,
        date: new Date().toISOString(),
        isPinned
      });

      setIsModalOpen(false);
    } catch (err) {
      addToast('Error', 'Failed to publish notice.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryMeta = (cat: NoticeCategory) => {
    switch (cat) {
      case 'holiday':
        return { label: 'Company Holiday 🌴', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Calendar };
      case 'policy':
        return { label: 'Policy Update 📜', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: FileText };
      case 'urgent':
        return { label: 'Urgent Alert 🚨', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: AlertTriangle };
      default:
        return { label: 'Announcement 📢', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Megaphone };
    }
  };

  const getPriorityBadge = (p: NoticePriority) => {
    switch (p) {
      case 'critical':
        return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-600 text-white uppercase animate-pulse">Critical</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white uppercase">High Priority</span>;
      case 'low':
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 uppercase">Routine</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 uppercase">Standard</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Megaphone className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Corporate Notice Board 📢
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Official announcements, workplace circulars, company holiday schedules, and executive broadcasts.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          {isHrOrSuperadmin ? (
            <button
              onClick={handleOpenPostModal}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Post New Notice</span>
            </button>
          ) : (
            <div className="text-[11px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              Notices are managed by Corporate HR & Superadmin
            </div>
          )}
        </div>
      </div>

      {/* 2. Filter Pills & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Circulars' },
            { id: 'pinned', label: 'Pinned 📌' },
            { id: 'announcement', label: 'Announcements 📢' },
            { id: 'policy', label: 'Policy Updates 📜' },
            { id: 'holiday', label: 'Holidays 🌴' },
            { id: 'urgent', label: 'Urgent 🚨' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                activeCategory === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search circulars, topics..."
            className="w-full px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>

      {/* 3. Notice Cards */}
      {sortedNotices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Bell className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-700">No Notices Published</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            There are currently no active corporate circulars or announcements under this category.
          </p>
          {isHrOrSuperadmin && (
            <button
              onClick={handleOpenPostModal}
              className="mt-4 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-xl text-xs transition"
            >
              + Post First Notice
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedNotices.map((notice) => {
            const meta = getCategoryMeta(notice.category);
            const CategoryIcon = meta.icon;

            return (
              <div
                key={notice.id}
                className={`bg-white rounded-2xl border transition shadow-[0_2px_12px_rgba(0,0,0,0.02)] p-5 relative overflow-hidden ${
                  notice.isPinned
                    ? 'border-amber-300 ring-1 ring-amber-100/70 bg-gradient-to-r from-amber-50/20 to-transparent'
                    : 'border-slate-100'
                }`}
              >
                {/* Notice Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${meta.color}`}
                    >
                      <CategoryIcon className="w-3 h-3 mr-1" />
                      {meta.label}
                    </span>

                    {getPriorityBadge(notice.priority)}

                    {notice.isPinned && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                        <Pin className="w-3 h-3 mr-1 text-amber-600 fill-amber-600" />
                        PINNED
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 text-xs text-slate-400">
                    <span className="flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      {formatISTDateTime(notice.date || notice.createdAt)}
                    </span>

                    {isHrOrSuperadmin && (
                      <button
                        onClick={() => deleteNotice(notice.id)}
                        className="text-slate-400 hover:text-rose-600 transition p-1"
                        title="Delete Notice"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Notice Body */}
                <div className="mt-3">
                  <h3 className="text-base font-bold text-slate-900 tracking-tight leading-snug">
                    {notice.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-2 whitespace-pre-line leading-relaxed">
                    {notice.content}
                  </p>
                </div>

                {/* Notice Footer Author */}
                <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center space-x-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span>Published by:</span>
                    <span className="font-bold text-slate-800">{notice.authorName}</span>
                    <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[9px] uppercase font-bold">
                      {notice.authorRole}
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-400">
                    {currentOrg.name} Corporate Circular
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Post Notice Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden my-6 border border-slate-100">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Post Corporate Notice</h3>
                  <p className="text-[11px] text-slate-500">
                    Will be broadcasted to all {currentOrg.name} staff members.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePostNotice} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notice Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q4 Company Holidays & Work Schedules"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="announcement">Announcement 📢</option>
                    <option value="policy">Policy Update 📜</option>
                    <option value="holiday">Company Holiday 🌴</option>
                    <option value="urgent">Urgent Alert 🚨</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="low">Low (Routine)</option>
                    <option value="medium">Standard</option>
                    <option value="high">High Priority</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Content / Circular Details *</label>
                <textarea
                  rows={4}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter the full official notice details..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold flex items-center">
                    <Pin className="w-3.5 h-3.5 mr-1 text-amber-500" />
                    Pin this notice to top of the Corporate Board
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Publishing...' : 'Publish Notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
