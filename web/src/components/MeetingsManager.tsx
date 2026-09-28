import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MeetingEvent, UserRole } from '../types';
import {
  Calendar,
  Clock,
  Video,
  MapPin,
  Users,
  Plus,
  X,
  ExternalLink,
  CheckCircle,
  PlayCircle,
  XCircle,
  Filter,
  UserCheck,
  Building2,
  CalendarCheck
} from 'lucide-react';
import { getTodayISTDateString, formatISTDate, formatISTTime } from '../lib/serialUtils';

export const MeetingsManager: React.FC = () => {
  const {
    currentOrg,
    currentProfile,
    isVedotrixSuperadmin,
    orgProfiles,
    meetings,
    createMeeting,
    updateMeetingStatus,
    addToast
  } = useApp();

  const isHrOrSuperadmin =
    currentProfile?.role === 'hr' ||
    currentProfile?.role === 'owner' ||
    currentProfile?.role === 'superadmin' ||
    isVedotrixSuperadmin;

  const isManager = currentProfile?.role === 'manager';
  const canScheduleMeeting = isHrOrSuperadmin || isManager;

  // Direct reports of the current user
  const directReports = orgProfiles.filter((p) => p.managerId === currentProfile?.id);

  // Filter state
  const [filterTab, setFilterTab] = useState<'all' | 'today' | 'upcoming' | 'past' | 'online'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Schedule Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getTodayISTDateString());
  const [startTime, setStartTime] = useState('11:00');
  const [endTime, setEndTime] = useState('11:45');
  const [isOnline, setIsOnline] = useState(true);
  const [meetingUrl, setMeetingUrl] = useState('https://meet.google.com/new');
  const [location, setLocation] = useState('Google Meet');
  const [department, setDepartment] = useState('Engineering');
  const [audienceType, setAudienceType] = useState<'all' | 'direct_reports' | 'custom'>('all');
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const todayStr = getTodayISTDateString();

  // Filtered Meetings strictly scoped to active organization
  const filteredMeetings = meetings.filter((m) => {
    if (currentOrg && m.orgId && m.orgId !== currentOrg.id) return false;

    // Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        m.title.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q) ||
        m.organizerName.toLowerCase().includes(q) ||
        m.department?.toLowerCase().includes(q);
      if (!match) return false;
    }

    if (filterTab === 'today') return m.date === todayStr;
    if (filterTab === 'upcoming') return m.date > todayStr || (m.date === todayStr && m.status === 'scheduled');
    if (filterTab === 'past') return m.date < todayStr || m.status === 'completed' || m.status === 'cancelled';
    if (filterTab === 'online') return m.isOnline;
    return true;
  });

  const handleOpenScheduleModal = () => {
    setTitle('');
    setDescription('');
    setDate(getTodayISTDateString());
    setStartTime('11:00');
    setEndTime('11:45');
    setIsOnline(true);
    setMeetingUrl('https://meet.google.com/new');
    setLocation('Google Meet');
    setDepartment(currentProfile?.department || 'Engineering');
    setAudienceType(isHrOrSuperadmin ? 'all' : 'direct_reports');
    setSelectedAttendees(isManager ? directReports.map((p) => p.id) : []);
    setIsModalOpen(true);
  };

  const handleToggleAttendee = (empId: string) => {
    setSelectedAttendees((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleSubmitMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date || !startTime) {
      addToast('Incomplete Form', 'Please provide a meeting title, date, and time slot.', 'warning');
      return;
    }

    let finalAttendeeIds: string[] = [];
    if (audienceType === 'all') {
      finalAttendeeIds = ['all'];
    } else if (audienceType === 'direct_reports') {
      finalAttendeeIds = directReports.map((p) => p.id);
      if (finalAttendeeIds.length === 0) finalAttendeeIds = [currentProfile.id];
    } else {
      finalAttendeeIds = selectedAttendees.length > 0 ? selectedAttendees : [currentProfile.id];
    }

    setIsSubmitting(true);
    try {
      await createMeeting({
        title: title.trim(),
        description: description.trim() || undefined,
        date,
        startTime,
        endTime: endTime || undefined,
        isOnline,
        meetingUrl: isOnline ? (meetingUrl.trim() || 'https://meet.google.com/new') : undefined,
        location: isOnline ? (location.trim() || 'Google Meet') : (location.trim() || 'Main Conference Room'),
        organizerId: currentProfile.id,
        organizerName: `${currentProfile.firstName} ${currentProfile.lastName}`.trim(),
        organizerRole: currentProfile.role,
        attendeeIds: finalAttendeeIds,
        department
      });

      setIsModalOpen(false);
    } catch (err) {
      addToast('Error', 'Failed to schedule meeting.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: MeetingEvent['status']) => {
    switch (status) {
      case 'in_progress':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>
            LIVE NOW
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <CheckCircle className="w-3 h-3 mr-1 text-slate-500" /> Completed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 mr-1 text-rose-500" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3 mr-1 text-blue-500" /> Scheduled
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Corporate Meetings & Events 📅
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Live schedule of technical syncs, standups, performance evaluations, and department conferences.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          {canScheduleMeeting ? (
            <button
              onClick={handleOpenScheduleModal}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Meeting</span>
            </button>
          ) : (
            <div className="text-[11px] text-slate-500 italic bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              Meetings are assigned by your Manager or Superadmin
            </div>
          )}
        </div>
      </div>

      {/* 2. Filter Pills & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Meetings' },
            { id: 'today', label: "Today's Sessions ⚡" },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'online', label: 'Online (Video) 🎥' },
            { id: 'past', label: 'Past / Archive' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                filterTab === tab.id
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
            placeholder="Search meetings, organizers..."
            className="w-full px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>

      {/* 3. Meetings List */}
      {filteredMeetings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-700">No Meetings Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {filterTab === 'today'
              ? 'No sessions scheduled for today in Indian Standard Time (IST).'
              : 'There are no active or scheduled meetings matching the selected filter.'}
          </p>
          {canScheduleMeeting && (
            <button
              onClick={handleOpenScheduleModal}
              className="mt-4 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-xl text-xs transition"
            >
              + Schedule First Meeting
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMeetings.map((meeting) => {
            const isToday = meeting.date === todayStr;
            const canManage =
              isHrOrSuperadmin ||
              meeting.organizerId === currentProfile?.id ||
              (isManager && meeting.organizerId === currentProfile?.id);

            return (
              <div
                key={meeting.id}
                className={`bg-white rounded-2xl border transition shadow-[0_2px_12px_rgba(0,0,0,0.02)] p-5 flex flex-col justify-between ${
                  isToday ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-100'
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                        {meeting.department || 'All Departments'}
                      </span>
                      {isToday && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-extrabold uppercase">
                          Today
                        </span>
                      )}
                    </div>
                    {getStatusBadge(meeting.status)}
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-base font-bold text-slate-900 tracking-tight leading-snug">
                    {meeting.title}
                  </h3>
                  {meeting.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {meeting.description}
                    </p>
                  )}

                  {/* Time & Date Meta */}
                  <div className="mt-4 space-y-2 bg-slate-50/70 p-3 rounded-xl border border-slate-100 text-xs">
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="flex items-center text-slate-500">
                        <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        Date
                      </span>
                      <span className="font-semibold text-slate-900">{formatISTDate(meeting.date)}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-700">
                      <span className="flex items-center text-slate-500">
                        <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        IST Slot
                      </span>
                      <span className="font-mono font-bold text-blue-700">
                        {meeting.startTime} {meeting.endTime ? `- ${meeting.endTime}` : ''} IST
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-700">
                      <span className="flex items-center text-slate-500">
                        {meeting.isOnline ? (
                          <Video className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                        ) : (
                          <MapPin className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                        )}
                        Format
                      </span>
                      <span className="font-semibold text-slate-800">
                        {meeting.isOnline ? 'Online Video Meeting' : (meeting.location || 'Office')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-700 pt-1 border-t border-slate-200/50">
                      <span className="flex items-center text-slate-500">
                        <UserCheck className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        Organizer
                      </span>
                      <span className="font-medium text-slate-700">
                        {meeting.organizerName} ({meeting.organizerRole.toUpperCase()})
                      </span>
                    </div>
                  </div>

                  {/* Attendees Badges */}
                  <div className="mt-3 flex items-center space-x-1.5 text-[11px] text-slate-500">
                    <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Audience:</span>
                    {meeting.attendeeIds.includes('all') ? (
                      <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                        All Organization Staff
                      </span>
                    ) : (
                      <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                        {meeting.attendeeIds.length} designated attendee(s)
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  {meeting.isOnline && meeting.meetingUrl ? (
                    <a
                      href={meeting.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm hover:shadow"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Join Meeting 🎥</span>
                      <ExternalLink className="w-3 h-3 ml-0.5" />
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium">In-Person Meeting</span>
                  )}

                  {canManage && meeting.status !== 'completed' && meeting.status !== 'cancelled' && (
                    <div className="flex items-center space-x-1.5">
                      {meeting.status !== 'in_progress' && (
                        <button
                          onClick={() => updateMeetingStatus(meeting.id, 'in_progress')}
                          className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-xs rounded-lg transition"
                          title="Start Meeting"
                        >
                          <PlayCircle className="w-3.5 h-3.5 inline mr-1" />
                          Start
                        </button>
                      )}
                      <button
                        onClick={() => updateMeetingStatus(meeting.id, 'completed')}
                        className="px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold text-xs rounded-lg transition"
                        title="Mark as Completed"
                      >
                        <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
                        End
                      </button>
                      <button
                        onClick={() => updateMeetingStatus(meeting.id, 'cancelled')}
                        className="px-2.5 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 font-semibold text-xs rounded-lg transition"
                        title="Cancel Meeting"
                      >
                        <X className="w-3.5 h-3.5 inline" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Schedule Meeting Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden my-6 border border-slate-100">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Schedule Meeting / Event</h3>
                  <p className="text-[11px] text-slate-500">
                    Assigned by {currentProfile?.firstName} {currentProfile?.lastName} ({currentProfile?.role?.toUpperCase()})
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

            <form onSubmit={handleSubmitMeeting} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Meeting Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Daily Technical Sprint & Blocker Sync"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Agenda / Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Points to discuss, sprint deliverables, links..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date (IST) *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Time (IST) *</label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Time (IST)</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="Engineering">Engineering / Tech</option>
                    <option value="Operations">Operations & HR</option>
                    <option value="Marketing">Marketing & Growth</option>
                    <option value="Design">Product & UI/UX</option>
                    <option value="All Departments">All Departments</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Format</label>
                  <div className="flex items-center space-x-2 pt-1">
                    <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isOnline}
                        onChange={(e) => setIsOnline(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Online Video Call (Meet/Zoom)</span>
                    </label>
                  </div>
                </div>
              </div>

              {isOnline ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Meeting URL (Google Meet / Zoom) *</span>
                    <button
                      type="button"
                      onClick={() => setMeetingUrl('https://meet.google.com/new')}
                      className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold"
                    >
                      Use Google Meet Link
                    </button>
                  </label>
                  <input
                    type="url"
                    required
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    placeholder="https://meet.google.com/xyz-abcd-efg"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">In-Person Meeting Room / Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Conference Room 2B / Main Office"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              )}

              {/* Target Audience / Attendees Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Attendees *</label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {isHrOrSuperadmin && (
                    <button
                      type="button"
                      onClick={() => setAudienceType('all')}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border text-center transition ${
                        audienceType === 'all'
                          ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      All Staff (Whole Org)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setAudienceType('direct_reports')}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border text-center transition ${
                      audienceType === 'direct_reports'
                        ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    My Direct Reports ({directReports.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudienceType('custom')}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border text-center transition ${
                      audienceType === 'custom'
                        ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    Select Specific Staff
                  </button>
                </div>

                {audienceType === 'custom' && (
                  <div className="max-h-36 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50/50 space-y-1">
                    {(isHrOrSuperadmin ? orgProfiles : directReports).map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center space-x-2 px-2 py-1 rounded-lg hover:bg-white text-xs cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAttendees.includes(p.id)}
                          onChange={() => handleToggleAttendee(p.id)}
                          className="rounded border-slate-300 text-blue-600"
                        />
                        <span className="font-medium text-slate-800">
                          {p.firstName} {p.lastName}
                        </span>
                        <span className="text-[10px] text-slate-400">({p.designation || p.role})</span>
                      </label>
                    ))}
                  </div>
                )}
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
                  {isSubmitting ? 'Scheduling...' : 'Confirm & Send Invitations'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
