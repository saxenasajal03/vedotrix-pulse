import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  Image,
  TextInput,
  Modal,
  Linking,
  Platform,
  RefreshControl,
  Share
} from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import { decode } from 'base64-arraybuffer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'react-native-bcrypt';

// Configure secure pure-JS random fallback for react-native-bcrypt (cross-platform, zero native Node crypto dependency)
bcrypt.setRandomFallback((len: number) => {
  const buf: number[] = [];
  for (let i = 0; i < len; i++) {
    buf.push(Math.floor(Math.random() * 256));
  }
  return buf;
});

// Safely load expo-image-picker to prevent native module crashes on older APK builds
let SafeImagePicker: any = null;
try {
  SafeImagePicker = require('expo-image-picker');
} catch (e) {
  console.log('ImagePicker native module not available in this APK build:', e);
}

// Safely load expo-print & expo-sharing for PDF exports
let SafePrint: any = null;
let SafeSharing: any = null;
try {
  SafePrint = require('expo-print');
} catch (e) {
  console.log('expo-print native module not available in this APK build:', e);
}
try {
  SafeSharing = require('expo-sharing');
} catch (e) {
  console.log('expo-sharing native module not available in this APK build:', e);
}

// Configure foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Live Supabase Production Cluster: cqevzpvyqvckvenutuzz
const DEFAULT_SUPABASE_URL = 'https://cqevzpvyqvckvenutuzz.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_vFIWyBN1E22I-7saEe3Yew_vV2fQkUX';

// Master Default Indian Holidays
const DEFAULT_HOLIDAYS = [
  { id: 'hol-001', name: 'Republic Day', date: '2026-01-26', type: 'national', description: 'Celebration of Constitution of India', isMandatory: true },
  { id: 'hol-002', name: 'Holi (Festival of Colors)', date: '2026-03-04', type: 'festival', description: 'Spring festival of colors and harmony', isMandatory: true },
  { id: 'hol-003', name: 'Eid-ul-Fitr', date: '2026-03-21', type: 'festival', description: 'Eid Celebrations', isMandatory: true },
  { id: 'hol-004', name: 'Independence Day', date: '2026-08-15', type: 'national', description: 'National Day of Indian Independence', isMandatory: true },
  { id: 'hol-005', name: 'Gandhi Jayanti', date: '2026-10-02', type: 'national', description: 'Honoring Mahatma Gandhi', isMandatory: true },
  { id: 'hol-006', name: 'Dussehra (Vijayadashami)', date: '2026-10-20', type: 'festival', description: 'Victory of good over evil', isMandatory: true },
  { id: 'hol-007', name: 'Valmiki Jayanti', date: '2026-10-26', type: 'gazetted', description: 'Ashwina, Shukla Purnima', isMandatory: true },
  { id: 'hol-008', name: 'Diwali (Deepavali)', date: '2026-11-08', type: 'festival', description: 'The Great Festival of Lights', isMandatory: true },
  { id: 'hol-009', name: 'Govardhan Puja', date: '2026-11-09', type: 'festival', description: 'Post-Diwali festivity and thanksgiving', isMandatory: true },
  { id: 'hol-010', name: 'Bhaiya Dooj', date: '2026-11-11', type: 'gazetted', description: 'Kartika, Shukla Dwitiya', isMandatory: true },
  { id: 'hol-011', name: 'Guru Nanak Jayanti', date: '2026-11-24', type: 'festival', description: 'Prakash Utsav celebrating Guru Nanak Dev Ji', isMandatory: true },
  { id: 'hol-012', name: 'Christmas Day', date: '2026-12-25', type: 'festival', description: 'Celebration of Christmas', isMandatory: true }
];

const DEFAULT_OFFICE_COORDS = {
  latitude: 12.9352,
  longitude: 77.6946,
  radiusMeters: 200,
  name: 'Vedotrix Master HQ'
};

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function getYesterdayISTDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function formatISTTimeOnly(isoString?: string): string {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return isoString;
  }
}

function getTodayISTDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function getISTTimeString(dateObj = new Date()): string {
  return dateObj.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' });
}

function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return 'Not Set';
  const cleanStr = String(dateStr).trim();
  if (cleanStr === 'Invalid Date' || cleanStr === 'null' || cleanStr === 'undefined' || !cleanStr) {
    return 'Not Set';
  }
  try {
    // 1. Direct standard date parse
    const directDate = new Date(cleanStr);
    if (!isNaN(directDate.getTime())) {
      const res = directDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata'
      });
      if (res && res !== 'Invalid Date') return res;
    }

    // 2. Fallback: extract YYYY-MM-DD segment
    const dateOnly = cleanStr.split('T')[0].split(' ')[0];
    const parts = dateOnly.split('-');
    if (parts.length === 3) {
      const y = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const d = Number(parts[2]);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const parsed = new Date(y, m, d);
        if (!isNaN(parsed.getTime())) {
          const res = parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
          if (res && res !== 'Invalid Date') return res;
        }
      }
    }
    return 'Today';
  } catch {
    return 'Today';
  }
}

function formatNoticeDate(n: any): string {
  if (!n) return 'Today';
  let raw = typeof n === 'object' ? (n.date || n.created_at) : n;
  if (!raw || raw === 'Invalid Date' || raw === 'null' || raw === 'undefined') {
    if (typeof n === 'object' && n.created_at && n.created_at !== 'Invalid Date') {
      raw = n.created_at;
    } else {
      return 'Today';
    }
  }
  const formatted = formatDisplayDate(raw);
  return formatted === 'Not Set' ? 'Today' : formatted;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateOfferSerial(orgCode: string = 'VDX'): string {
  const year = new Date().getFullYear();
  const hex = Math.random().toString(16).substring(2, 8).toUpperCase();
  const cleanCode = (orgCode || 'VDX').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 4);
  return `VDX-${cleanCode}-${year}-${hex}`;
}

export interface MobileFestivalConfig {
  id: 'dussehra' | 'diwali' | 'newyear' | 'none';
  name: string;
  shortLabel: string;
  iconSymbol: string;
  greetingTitle: string;
  wishMessage: string;
  badgeText: string;
  primaryColor: string;
  secondaryColor: string;
}

export const getActiveMobileFestival = (dateObj?: Date): MobileFestivalConfig => {
  const d = dateObj || new Date();
  const istDateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const parts = istDateStr.split('-');
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  // 1. Dussehra Season: Concluded for 2026 (ended Oct 20)
  // (Past season - Dussehra theme removed)

  // 2. Diwali Season: Late October to Mid November (Oct 28 - Nov 15)
  if ((month === 10 && day >= 28) || (month === 11 && day <= 15)) {
    return {
      id: 'diwali',
      name: 'Diwali (Deepavali)',
      shortLabel: 'Diwali Utsav',
      iconSymbol: '🪔',
      greetingTitle: 'Shubh Deepavali! 🪔',
      wishMessage: 'May the divine festival of lights illuminate your life with infinite wealth, health, and supreme joy.',
      badgeText: '🪔 SHUBH DEEPAVALI',
      primaryColor: '#fbbf24',
      secondaryColor: '#ea580c'
    };
  }

  // 3. New Year & Holidays (Dec 20 - Jan 3)
  if ((month === 12 && day >= 20) || (month === 1 && day <= 3)) {
    return {
      id: 'newyear',
      name: 'New Year & Holidays',
      shortLabel: 'New Year 2027',
      iconSymbol: '🎉',
      greetingTitle: 'Happy New Year! 🎉',
      wishMessage: 'Wishing you breakthrough milestones, joyful celebrations, and grand success.',
      badgeText: '🎉 NEW YEAR SPECIAL',
      primaryColor: '#38bdf8',
      secondaryColor: '#818cf8'
    };
  }

  return {
    id: 'none',
    name: 'Vedotrix Pulse',
    shortLabel: 'Standard',
    iconSymbol: '⚡',
    greetingTitle: 'Welcome to Vedotrix Pulse',
    wishMessage: 'Empowering your enterprise operations with precision.',
    badgeText: '⚡ ENTERPRISE',
    primaryColor: '#2563eb',
    secondaryColor: '#0ea5e9'
  };
};

const APP_ICON_DEFAULT = require('./assets/icon-standard.png');
const APP_ICON_DUSSEHRA = require('./assets/icon-dussehra.png');
const APP_ICON_DIWALI = require('./assets/icon-diwali.png');

export default function App() {
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Dynamic Festival Celebration State
  const activeFestival = useMemo(() => getActiveMobileFestival(), []);
  const [isFestiveBannerDismissed, setIsFestiveBannerDismissed] = useState(false);

  // Dynamic Decorated App Icon based on active festival
  const activeAppIcon = useMemo(() => {
    if (activeFestival.id === 'dussehra') return APP_ICON_DUSSEHRA;
    if (activeFestival.id === 'diwali') return APP_ICON_DIWALI;
    return APP_ICON_DEFAULT;
  }, [activeFestival.id]);

  // Authentication & Profile State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userProfile, setUserProfile] = useState<any>(null);

  // Login Form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Bottom Navigation Tabs: 5-Tab System ('home' | 'people' | 'attendance' | 'chat' | 'more') + legacy aliases
  const [activeTab, setActiveTab] = useState<'home' | 'people' | 'attendance' | 'chat' | 'more' | 'punch' | 'calendar' | 'leaves' | 'approvals' | 'notices' | 'hub'>('home');
  const [empDirectoryFilter, setEmpDirectoryFilter] = useState<'all' | 'present' | 'on_leave'>('all');
  const [empDirectorySearch, setEmpDirectorySearch] = useState<string>('');
  const [attendanceWeekDaySelected, setAttendanceWeekDaySelected] = useState<string>(getTodayISTDate());
  const [attendanceSubView, setAttendanceSubView] = useState<'today' | 'roster' | 'calendar' | 'pdf'>('today');
  const [meetingFilter, setMeetingFilter] = useState<'all' | 'today' | 'upcoming' | 'online'>('all');
  const [moreSection, setMoreSection] = useState<'meetings' | 'standups' | 'leaves' | 'approvals' | 'notices' | 'profile'>('meetings');
  const [isFabMenuOpen, setIsFabMenuOpen] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Realtime Live Clock (ticking every second)
  const [liveClockTime, setLiveClockTime] = useState<string>(() => {
    return new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  });

  // Enterprise Team Chat States
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [activeChatChannel, setActiveChatChannel] = useState<string>('support');
  const [chatRecipient, setChatRecipient] = useState<any | null>(null);
  const [chatInputText, setChatInputText] = useState<string>('');
  const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [isAttachingDocModalOpen, setIsAttachingDocModalOpen] = useState<boolean>(false);
  const [docAttachmentUrl, setDocAttachmentUrl] = useState<string>('');
  const [docAttachmentName, setDocAttachmentName] = useState<string>('');
  const [isPhotoPickerModalOpen, setIsPhotoPickerModalOpen] = useState<boolean>(false);
  const [customPhotoUrlInput, setCustomPhotoUrlInput] = useState<string>('');
  const [isAddingCustomUrl, setIsAddingCustomUrl] = useState<boolean>(false);

  // Chat Sidebar vs Conversation Mode & Settings Modal
  const [chatViewMode, setChatViewMode] = useState<'sidebar' | 'conversation'>('sidebar');
  const [chatSearchQuery, setChatSearchQuery] = useState<string>('');
  const [isChannelSettingsModalOpen, setIsChannelSettingsModalOpen] = useState<boolean>(false);
  const [channelSettingsTab, setChannelSettingsTab] = useState<'members' | 'details'>('members');
  const [candidateMemberToAdd, setCandidateMemberToAdd] = useState<string>('');
  const [editChannelNameInput, setEditChannelNameInput] = useState<string>('');
  const [editChannelDescInput, setEditChannelDescInput] = useState<string>('');
  const [editChannelIsPrivate, setEditChannelIsPrivate] = useState<boolean>(false);
  const [isSavingChannelSettings, setIsSavingChannelSettings] = useState<boolean>(false);

  // Message Edit, Pin, and Action Menu States
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState<string>('');
  const [isSavingMessageEdit, setIsSavingMessageEdit] = useState<boolean>(false);
  const [activeMessageActionId, setActiveMessageActionId] = useState<string | null>(null);
  const [showPinnedMessagesModal, setShowPinnedMessagesModal] = useState<boolean>(false);

  // Read more / Show less message truncation state
  const [expandedChatMsgIds, setExpandedChatMsgIds] = useState<string[]>([]);
  const toggleChatMsgExpanded = (msgId: string) => {
    setExpandedChatMsgIds((prev) =>
      prev.includes(msgId) ? prev.filter((id) => id !== msgId) : [...prev, msgId]
    );
  };

  // Selected Notice for Full Screen Reading Modal
  const [selectedNoticeForView, setSelectedNoticeForView] = useState<any | null>(null);

  // Theme & Auto-Update States (4 Corporate Themes: 'dark' | 'light' | 'navy' | 'emerald')
  const [themeMode, setThemeMode] = useState<'dark' | 'light' | 'navy' | 'emerald'>('dark');
  const isDarkMode = themeMode !== 'light';
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);
  const [orgLogoFailed, setOrgLogoFailed] = useState<boolean>(false);

  // Subtabs within views
  const [calSubTab, setCalSubTab] = useState<'attendance' | 'roster' | 'holidays'>('attendance');
  const [rosterDate, setRosterDate] = useState<string>(getTodayISTDate());
  const [rosterSearch, setRosterSearch] = useState<string>('');
  const [isCalendarPoliciesModal, setIsCalendarPoliciesModal] = useState<boolean>(false);
  const [calPolicyTab, setCalPolicyTab] = useState<'shift' | 'emp_weekoffs' | 'holidays'>('shift');
  const [calPolicySelectedEmp, setCalPolicySelectedEmp] = useState<string>('');
  const [calPolicyOrgWeekOffs, setCalPolicyOrgWeekOffs] = useState<number[]>([0]);
  const [calPolicyEmpWeekOffs, setCalPolicyEmpWeekOffs] = useState<{ [empId: string]: number[] }>({});
  const [isSavingCalPolicies, setIsSavingCalPolicies] = useState<boolean>(false);
  const [noticesSubTab, setNoticesSubTab] = useState<'notices' | 'letters' | 'meetings'>('notices');
  const [hubSubTab, setHubSubTab] = useState<'profile' | 'team' | 'standups' | 'offers'>('profile');
  const [approvalsTab, setApprovalsTab] = useState<'regularization' | 'leaves' | 'access'>('regularization');

  // Multi-Tenant Organizations & Locations
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [currentOrg, setCurrentOrg] = useState<any>(null);
  const [activeOfficeCoords, setActiveOfficeCoords] = useState(DEFAULT_OFFICE_COORDS);
  const [isOrgModalVisible, setIsOrgModalVisible] = useState(false);

  // Holidays
  const [holidays, setHolidays] = useState<any[]>(DEFAULT_HOLIDAYS);
  const [isHolidayModal, setIsHolidayModal] = useState(false);
  const [newHolName, setNewHolName] = useState('');
  const [newHolDate, setNewHolDate] = useState(() => getTodayISTDate());
  const [newHolType, setNewHolType] = useState('festival');
  const [newHolDesc, setNewHolDesc] = useState('');
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);

  // GPS Attendance State
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isCheckedIn, setIsCheckedIn] = useState<boolean>(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [todayAttendanceRecord, setTodayAttendanceRecord] = useState<any>(null);
  const [locLoading, setLocLoading] = useState<boolean>(false);
  const [attendanceAlertActive, setAttendanceAlertActive] = useState<boolean>(false);
  const todayStr = getTodayISTDate();
  const todayHoliday = useMemo(() => {
    const directHoliday = holidays.find((h) => h.date === todayStr);
    if (directHoliday) return directHoliday;
    const overrides = currentOrg?.settings?.customDayOverrides || {};
    const empOverride = overrides[`${todayStr}_${userProfile?.id}`] || overrides[todayStr];
    if (empOverride?.type === 'holiday') {
      return { id: `override_${todayStr}`, name: empOverride.name || 'Company Holiday', date: todayStr };
    }
    return null;
  }, [holidays, todayStr, currentOrg, userProfile]);

  const isWeekOffToday = useMemo(() => {
    const overrides = currentOrg?.settings?.customDayOverrides || {};
    const empOverride = overrides[`${todayStr}_${userProfile?.id}`] || overrides[todayStr];
    if (empOverride?.type === 'week_off') return true;
    if (empOverride?.type === 'working') return false;

    const nowISTDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const todayDayOfWeek = nowISTDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const userWeekOffs = currentOrg?.settings?.employeeWeekOffs?.[userProfile?.id];
    const weekOffDays: number[] = Array.isArray(userWeekOffs) ? userWeekOffs : (currentOrg?.settings?.weekOffDays || [0]);
    return weekOffDays.includes(todayDayOfWeek);
  }, [currentOrg, userProfile, todayStr]);

  // Team Profiles & Hierarchy
  const [teamProfiles, setTeamProfiles] = useState<any[]>([]);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');

  // Attendance Records & Calendar
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [selectedCalMonth, setSelectedCalMonth] = useState(new Date().getMonth() + 1);
  const [selectedCalYear, setSelectedCalYear] = useState(new Date().getFullYear());

  // Attendance Regularization Request Modal
  const [isRegModal, setIsRegModal] = useState(false);
  const [regTargetDate, setRegTargetDate] = useState(() => getTodayISTDate());
  const [regInTime, setRegInTime] = useState('09:30');
  const [regOutTime, setRegOutTime] = useState('18:30');
  const [regCategory, setRegCategory] = useState('Missed Punch-In / Punch-Out');
  const [regJustification, setRegJustification] = useState('');
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);

  // Leave Requests State
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [isLeaveModal, setIsLeaveModal] = useState(false);
  const [leaveType, setLeaveType] = useState('casual');
  const [leaveStartDate, setLeaveStartDate] = useState(() => getTodayISTDate());
  const [leaveEndDate, setLeaveEndDate] = useState(() => getTodayISTDate());
  const [leaveReason, setLeaveReason] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  // Meetings & Events State
  const [meetings, setMeetings] = useState<any[]>([]);
  const [isMeetingModal, setIsMeetingModal] = useState(false);
  const [meetingFilterTab, setMeetingFilterTab] = useState<'all' | 'today' | 'upcoming'>('all');
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [newMeetingDesc, setNewMeetingDesc] = useState('');
  const [newMeetingDate, setNewMeetingDate] = useState(() => getTodayISTDate());
  const [newMeetingStartTime, setNewMeetingStartTime] = useState('11:00');
  const [newMeetingEndTime, setNewMeetingEndTime] = useState('11:45');
  const [newMeetingUrl, setNewMeetingUrl] = useState('https://meet.google.com/new');
  const [newMeetingDept, setNewMeetingDept] = useState('All');
  const [isSubmittingMeeting, setIsSubmittingMeeting] = useState(false);

  // Access Requests State
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [isAccessModal, setIsAccessModal] = useState(false);
  const [targetModule, setTargetModule] = useState<string>('tech_sprints');
  const [accessJustification, setAccessJustification] = useState<string>('');
  const [isSubmittingAccess, setIsSubmittingAccess] = useState<boolean>(false);

  // Notices & Announcements
  const [notices, setNotices] = useState<any[]>([]);
  const [isNoticeModal, setIsNoticeModal] = useState(false);
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeContent, setNewNoticeContent] = useState('');
  const [newNoticePriority, setNewNoticePriority] = useState('high');
  const [newNoticeCategory, setNewNoticeCategory] = useState('announcement');
  const [isSubmittingNotice, setIsSubmittingNotice] = useState(false);

  // Official Notification Letters State (Mobile)
  const [isCreateLetterModal, setIsCreateLetterModal] = useState<boolean>(false);
  const [letterType, setLetterType] = useState<'warning' | 'appreciation' | 'experience' | 'directive' | 'notice'>('warning');
  const [letterRecipientType, setLetterRecipientType] = useState<'all' | 'individual'>('individual');
  const [letterRecipientId, setLetterRecipientId] = useState<string>('');
  const [letterRefNumber, setLetterRefNumber] = useState<string>('');
  const [letterSubject, setLetterSubject] = useState<string>('');
  const [letterContent, setLetterContent] = useState<string>('');
  const [letterSignatoryName, setLetterSignatoryName] = useState<string>('');
  const [letterSignatoryRole, setLetterSignatoryRole] = useState<string>('');
  const [letterIsDigitallyStamped, setLetterIsDigitallyStamped] = useState<boolean>(true);
  const [isSubmittingLetter, setIsSubmittingLetter] = useState<boolean>(false);
  const [isExportingLetterPdf, setIsExportingLetterPdf] = useState<boolean>(false);
  const [letterTypeFilter, setLetterTypeFilter] = useState<string>('all');

  // Profile Edit Modal State
  const [isEditProfileModal, setIsEditProfileModal] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Add Employee Modal (HR / Superadmin / Owner)
  const [isAddEmpModal, setIsAddEmpModal] = useState(false);
  const [newEmpFirst, setNewEmpFirst] = useState('');
  const [newEmpLast, setNewEmpLast] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpRole, setNewEmpRole] = useState('employee');
  const [newEmpDesig, setNewEmpDesig] = useState('');
  const [newEmpDept, setNewEmpDept] = useState('Operations');
  const [newEmpJoiningDate, setNewEmpJoiningDate] = useState(() => getTodayISTDate());
  const [newEmpManagerId, setNewEmpManagerId] = useState('');
  const [isSavingEmp, setIsSavingEmp] = useState(false);

  // Edit Employee Joining Date Modal (HR / Superadmin)
  const [isEditJoiningModal, setIsEditJoiningModal] = useState(false);
  const [targetEmpForJoining, setTargetEmpForJoining] = useState<any>(null);
  const [updatedJoiningDateVal, setUpdatedJoiningDateVal] = useState('');
  const [isSavingJoiningDate, setIsSavingJoiningDate] = useState(false);

  // EOD Standup
  const [standups, setStandups] = useState<any[]>([]);
  const [isStandupModal, setIsStandupModal] = useState(false);
  const [standupDone, setStandupDone] = useState('');
  const [standupNext, setStandupNext] = useState('');
  const [standupBlockers, setStandupBlockers] = useState('');
  const [standupPrLink, setStandupPrLink] = useState('');
  const [standupHours, setStandupHours] = useState('8');
  const [isSavingStandup, setIsSavingStandup] = useState(false);
  const [standupEmpFilter, setStandupEmpFilter] = useState('all');
  const [standupDateFilter, setStandupDateFilter] = useState<'all' | 'today' | 'yesterday'>('all');

  // Offer Letters & Serial Verification
  const [offerLetters, setOfferLetters] = useState<any[]>([]);
  const [verifyQuery, setVerifyQuery] = useState('');
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [isNewOfferModal, setIsNewOfferModal] = useState(false);
  const [candName, setCandName] = useState('');
  const [candEmail, setCandEmail] = useState('');
  const [candDesig, setCandDesig] = useState('');
  const [candCtc, setCandCtc] = useState('1200000');
  const [isSavingOffer, setIsSavingOffer] = useState(false);

  // Device Notifications Status
  const [notifPermission, setNotifPermission] = useState<boolean>(false);

  // Multi-Employee Calendar Inspection & Clickable Day Detail State
  const [selectedCalendarEmpId, setSelectedCalendarEmpId] = useState<string | null>(null);
  const [selectedCalendarDayData, setSelectedCalendarDayData] = useState<any | null>(null);

  // Dedicated User Profile Modal State (inspect any colleague or self)
  const [inspectedUserProfile, setInspectedUserProfile] = useState<any | null>(null);

  // Attendance Report PDF Export Modal State (Daily / Weekly / Monthly for HR / Superadmin / Manager)
  const [isAttReportModal, setIsAttReportModal] = useState<boolean>(false);
  const [attReportType, setAttReportType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [attReportDate, setAttReportDate] = useState<string>(getTodayISTDate());
  const [isExportingAttReport, setIsExportingAttReport] = useState<boolean>(false);

  // In-App Notification Center State
  const [isNotifModal, setIsNotifModal] = useState<boolean>(false);
  const [readNotifIds, setReadNotifIds] = useState<string[]>([]);

  // Real Database Channels for Team Workspace
  const [dbChannels, setDbChannels] = useState<any[]>([]);
  const [isNewChannelModal, setIsNewChannelModal] = useState<boolean>(false);
  const [newChanName, setNewChanName] = useState('');
  const [newChanDesc, setNewChanDesc] = useState('');
  const [newChanIsPrivate, setNewChanIsPrivate] = useState(false);
  const [newChanMembers, setNewChanMembers] = useState<string[]>([]);
  const [isSavingChan, setIsSavingChan] = useState(false);

  // Chat Image Attachment & Lightbox
  const [isSendingChatPhoto, setIsSendingChatPhoto] = useState(false);
  const [chatImageLightboxUrl, setChatImageLightboxUrl] = useState<string | null>(null);

  // HR / Superadmin Employee Record Management Modal
  const [isEditEmployeeModal, setIsEditEmployeeModal] = useState(false);
  const [editEmpFirstName, setEditEmpFirstName] = useState('');
  const [editEmpLastName, setEditEmpLastName] = useState('');
  const [editEmpRole, setEditEmpRole] = useState('employee');
  const [editEmpEmail, setEditEmpEmail] = useState('');
  const [editEmpPhone, setEditEmpPhone] = useState('');
  const [editEmpDesig, setEditEmpDesig] = useState('');
  const [editEmpDept, setEditEmpDept] = useState('');
  const [editEmpJoining, setEditEmpJoining] = useState('');
  const [editEmpSalary, setEditEmpSalary] = useState('0');
  const [editEmpManagerId, setEditEmpManagerId] = useState('');
  const [editEmpIsActive, setEditEmpIsActive] = useState(true);
  const [editEmpPasswordReset, setEditEmpPasswordReset] = useState('');
  const [isSavingEmpRecord, setIsSavingEmpRecord] = useState(false);

  const handleOpenEditEmployee = (emp: any) => {
    if (!emp) return;
    setInspectedUserProfile(emp);
    setEditEmpFirstName(emp.first_name || '');
    setEditEmpLastName(emp.last_name || '');
    setEditEmpRole(emp.role || 'employee');
    setEditEmpEmail(emp.email || '');
    setEditEmpPhone(emp.phone || '');
    setEditEmpDesig(emp.designation || '');
    setEditEmpDept(emp.department || '');
    setEditEmpJoining(emp.joining_date || '');
    setEditEmpSalary(emp.base_salary ? String(emp.base_salary) : '0');
    setEditEmpManagerId(emp.manager_id || '');
    setEditEmpIsActive(emp.is_active !== false);
    setEditEmpPasswordReset('');
    setIsEditEmployeeModal(true);
  };
  const [isExportingStandupPdf, setIsExportingStandupPdf] = useState(false);

  // User Self Password Management Modal
  const [isChangePasswordModal, setIsChangePasswordModal] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Organization Settings Management Modal (HR / Superadmin)
  const [isOrgSettingsModal, setIsOrgSettingsModal] = useState(false);
  const [orgShiftStart, setOrgShiftStart] = useState('09:30');
  const [orgShiftEnd, setOrgShiftEnd] = useState('19:00');
  const [orgGracePeriod, setOrgGracePeriod] = useState('15');
  const [orgGeofenceRadius, setOrgGeofenceRadius] = useState('200');
  const [isSavingOrgSettings, setIsSavingOrgSettings] = useState(false);

  // Dynamic Theme-Dependent Styles (Supporting Dark, Light, Navy, Emerald)
  const styles = useMemo(() => createThemedStyles(themeMode), [themeMode]);

  // Load saved theme & notification read states on mount
  useEffect(() => {
    AsyncStorage.getItem('@vdx_theme_mode')
      .then((savedTheme) => {
        if (savedTheme && ['dark', 'light', 'navy', 'emerald'].includes(savedTheme)) {
          setThemeMode(savedTheme as any);
        } else if (savedTheme === 'light') {
          setThemeMode('light');
        }
      })
      .catch(() => {});

    AsyncStorage.getItem('@vdx_read_notifs')
      .then((saved) => {
        if (saved) {
          try {
            setReadNotifIds(JSON.parse(saved));
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  // Check for Over-The-Air EAS updates automatically on startup
  useEffect(() => {
    async function checkAutoUpdates() {
      try {
        if (__DEV__) return;
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          const fetchRes = await Updates.fetchUpdateAsync();
          if (fetchRes.isNew) {
            // Instantly hot-reload bundle so mobile app is always on latest production build
            await Updates.reloadAsync();
          }
        }
      } catch (e) {
        console.log('EAS checkAutoUpdates error:', e);
      }
    }
    checkAutoUpdates();
  }, []);

  const handleToggleTheme = async () => {
    const themeCycle: ('dark' | 'light' | 'navy' | 'emerald')[] = ['dark', 'light', 'navy', 'emerald'];
    const curIdx = themeCycle.indexOf(themeMode);
    const nextTheme = themeCycle[(curIdx + 1) % themeCycle.length];
    setThemeMode(nextTheme);
    try {
      await AsyncStorage.setItem('@vdx_theme_mode', nextTheme);
    } catch {}
  };

  const handleSelectTheme = async (selected: 'dark' | 'light' | 'navy' | 'emerald') => {
    setThemeMode(selected);
    try {
      await AsyncStorage.setItem('@vdx_theme_mode', selected);
    } catch {}
  };

  const handleSetTheme = async (dark: boolean) => {
    const nextTheme = dark ? 'dark' : 'light';
    setThemeMode(nextTheme);
    try {
      await AsyncStorage.setItem('@vdx_theme_mode', nextTheme);
    } catch {}
  };

  // User-Friendly Generic Error Presenter (Suppresses raw Postgres / RLS errors)
  const showUserFriendlyError = (title: string, rawError?: any, defaultMessage: string = 'Unable to complete this request. Please check your network connection and try again.') => {
    console.log('[System Error Trace]:', rawError);
    let friendly = defaultMessage;
    if (rawError?.message) {
      const msg = String(rawError.message).toLowerCase();
      if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout') || msg.includes('failed to fetch')) {
        friendly = 'Network connection issue. Please check your internet connection and retry.';
      } else if (msg.includes('jwt') || msg.includes('expired') || msg.includes('unauthorized') || msg.includes('session')) {
        friendly = 'Your authentication session has expired. Please log in again to continue.';
      } else if (msg.includes('row-level security') || msg.includes('policy') || msg.includes('permission') || msg.includes('42501')) {
        friendly = 'Access restricted: You do not have permission for this action or it is outside your role authorization.';
      } else if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('23505')) {
        friendly = 'A record for this date or entry already exists in the system.';
      }
    }
    Alert.alert(title, friendly);
  };

  const handleManualCheckUpdates = async () => {
    try {
      setIsCheckingUpdate(true);
      if (__DEV__) {
        Alert.alert('Development Mode', 'Over-the-air updates are active in APK / standalone builds.');
        return;
      }
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        Alert.alert(
          'Update Downloaded 🚀',
          'Latest update installed. The app will reload now.',
          [{ text: 'OK', onPress: () => Updates.reloadAsync() }]
        );
      } else {
        Alert.alert('Up to Date ✨', 'You are running the latest version of Vedotrix Pulse.');
      }
    } catch (err: any) {
      Alert.alert('Update Check', err?.message || 'Could not reach update server.');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  // Live Clock Ticker Interval (1s updates)
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveClockTime(
        new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute Elapsed Work Hours if Punched In
  const elapsedWorkTime = useMemo(() => {
    if (!isCheckedIn || !todayAttendanceRecord?.check_in_time) return null;
    try {
      const diffMs = Date.now() - new Date(todayAttendanceRecord.check_in_time).getTime();
      if (diffMs < 0) return '00h 00m';
      const totalMinutes = Math.floor(diffMs / (1000 * 60));
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return `${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
    } catch {
      return null;
    }
  }, [isCheckedIn, todayAttendanceRecord, liveClockTime]);

  // Realtime Supabase Subscription for Team Chat & Channels
  useEffect(() => {
    if (!supabaseClient || !currentOrg?.id) return;
    const channel = supabaseClient
      .channel('mobile_chat_' + currentOrg.id)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `org_id=eq.${currentOrg.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            setChatMessages((prev) => {
              if (prev.some((m) => m.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });

            // Send push/device notification if message is from a team member
            if (payload.new.sender_id && userProfile?.id && payload.new.sender_id !== userProfile.id) {
              const senderTitle = payload.new.channel
                ? `💬 #${payload.new.channel} • ${payload.new.sender_name || 'Team Member'}`
                : `💬 Direct Message • ${payload.new.sender_name || 'Team Member'}`;
              sendDeviceNotification(
                senderTitle,
                payload.new.message || 'Sent an attachment',
                'chat-alerts'
              );
            }
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            setChatMessages((prev) => prev.map((m) => (m.id === payload.new.id ? payload.new : m)));
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setChatMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_channels',
          filter: `org_id=eq.${currentOrg.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            setDbChannels((prev) => {
              if (prev.some((c) => c.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setDbChannels((prev) => prev.filter((c) => c.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            setDbChannels((prev) => prev.map((c) => (c.id === payload.new.id ? payload.new : c)));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'organizations',
          filter: `id=eq.${currentOrg.id}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedOrg = payload.new;
            setCurrentOrg((prev: any) => ({
              ...prev,
              ...updatedOrg,
              settings: updatedOrg.settings || prev?.settings
            }));
            if (updatedOrg.settings?.holidays && Array.isArray(updatedOrg.settings.holidays)) {
              setHolidays(updatedOrg.settings.holidays);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [supabaseClient, currentOrg?.id]);

  // Send Chat Message Handler
  const handleSendMessage = async () => {
    if (!chatInputText.trim() || !supabaseClient || !userProfile || !currentOrg) return;

    const trimmed = chatInputText.trim();
    setChatInputText('');
    setIsSendingMessage(true);

    const targetChannel = chatRecipient ? `dm_${chatRecipient.id}` : (activeChanObj?.id || activeChatChannel);

    const newMsg = {
      id: generateUUID(),
      org_id: currentOrg.id,
      sender_id: userProfile.id,
      sender_name: `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || 'Team Member',
      sender_role: userProfile.role || 'employee',
      sender_avatar: userProfile.avatar_url || null,
      channel: targetChannel,
      recipient_id: chatRecipient ? chatRecipient.id : null,
      message: trimmed,
      attachments: [],
      reactions: [],
      created_at: new Date().toISOString()
    };

    setChatMessages((prev) => [...prev, newMsg]);

    try {
      const { error } = await supabaseClient.from('chat_messages').insert([newMsg]);
      if (error) console.warn('Chat send error:', error);
    } catch (err: any) {
      console.warn('Chat exception:', err);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Add or Toggle Emoji Reaction on a Message
  const addChatReaction = async (messageId: string, emoji: string) => {
    if (!supabaseClient || !userProfile) return;
    let targetReactions: any[] = [];
    setChatMessages((prev) => {
      const updated = prev.map((msg) => {
        if (msg.id !== messageId) return msg;
        const currentReactions: any[] = msg.reactions || [];
        const existing = currentReactions.find((r: any) => r.emoji === emoji);
        let nextReactions;
        if (existing) {
          if (existing.userIds && existing.userIds.includes(userProfile.id)) {
            nextReactions = currentReactions
              .map((r: any) =>
                r.emoji === emoji
                  ? { ...r, count: Math.max(0, r.count - 1), userIds: r.userIds.filter((u: string) => u !== userProfile.id) }
                  : r
              )
              .filter((r: any) => r.count > 0);
          } else {
            nextReactions = currentReactions.map((r: any) =>
              r.emoji === emoji
                ? { ...r, count: (r.count || 0) + 1, userIds: [...(r.userIds || []), userProfile.id] }
                : r
            );
          }
        } else {
          nextReactions = [...currentReactions, { emoji, count: 1, userIds: [userProfile.id] }];
        }
        targetReactions = nextReactions;
        return { ...msg, reactions: nextReactions };
      });
      return updated;
    });

    try {
      await supabaseClient.from('chat_messages').update({ reactions: targetReactions }).eq('id', messageId);
    } catch (e) {
      console.warn('Reaction update error:', e);
    }
    setActiveReactionMsgId(null);
  };

  // Edit Chat Message (15-min limit for normal members; anytime for Superadmin/HR)
  const editChatMessage = async (messageId: string, newText: string) => {
    if (!newText.trim() || !supabaseClient) return;
    const targetMsg = chatMessages.find((m) => m.id === messageId);
    if (!targetMsg) return;

    const createdTime = new Date(targetMsg.created_at).getTime();
    const diffMinutes = (Date.now() - createdTime) / (60 * 1000);
    const canEdit = isPrivileged || (targetMsg.sender_id === userProfile?.id && diffMinutes <= 15);

    if (!canEdit) {
      Alert.alert('Cannot Edit Message', 'Messages can only be edited within 15 minutes of sending.');
      return;
    }

    setIsSavingMessageEdit(true);
    const editedAt = new Date().toISOString();
    const trimmed = newText.trim();

    setChatMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, message: trimmed, is_edited: true, edited_at: editedAt } : m))
    );

    try {
      await supabaseClient
        .from('chat_messages')
        .update({
          message: trimmed,
          is_edited: true,
          edited_at: editedAt
        })
        .eq('id', messageId);
      setEditingMessageId(null);
      setEditingMessageText('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not edit message.');
    } finally {
      setIsSavingMessageEdit(false);
    }
  };

  // Delete Chat Message (15-min limit for normal members; anytime for Superadmin/HR)
  const deleteChatMessage = async (messageId: string) => {
    if (!supabaseClient) return;
    const targetMsg = chatMessages.find((m) => m.id === messageId);
    if (!targetMsg) return;

    const createdTime = new Date(targetMsg.created_at).getTime();
    const diffMinutes = (Date.now() - createdTime) / (60 * 1000);
    const canDelete = isPrivileged || (targetMsg.sender_id === userProfile?.id && diffMinutes <= 15);

    if (!canDelete) {
      Alert.alert('Cannot Delete Message', 'Messages can only be deleted within 15 minutes of sending.');
      return;
    }

    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setChatMessages((prev) => prev.filter((m) => m.id !== messageId));
            setActiveMessageActionId(null);
            try {
              await supabaseClient.from('chat_messages').delete().eq('id', messageId);
            } catch (e: any) {
              console.warn('Delete chat error:', e);
            }
          }
        }
      ]
    );
  };

  // Toggle Pin Chat Message to Conversation
  const togglePinChatMessage = async (messageId: string) => {
    if (!supabaseClient) return;
    const targetMsg = chatMessages.find((m) => m.id === messageId);
    if (!targetMsg) return;

    const nextPinned = !targetMsg.is_pinned;
    setChatMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, is_pinned: nextPinned } : m))
    );
    setActiveMessageActionId(null);

    try {
      await supabaseClient.from('chat_messages').update({ is_pinned: nextPinned }).eq('id', messageId);
      Alert.alert(
        nextPinned ? 'Message Pinned 📌' : 'Message Unpinned',
        nextPinned ? 'This message is now pinned to the top of this channel.' : 'Message removed from pinned items.'
      );
    } catch (e: any) {
      console.warn('Pin chat error:', e);
    }
  };

  // Send Document / PDF Attachment in Chat
  const sendChatDocument = async (name: string, url: string) => {
    if (!url.trim() || !supabaseClient || !userProfile || !currentOrg) return;
    const cleanUrl = url.trim();
    const cleanName = name.trim() || (cleanUrl.split('/').pop()?.split('?')[0] || 'Document Attachment');
    const targetChannel = chatRecipient ? `dm_${chatRecipient.id}` : (activeChanObj?.id || activeChatChannel);

    const newMsg = {
      id: generateUUID(),
      org_id: currentOrg.id,
      sender_id: userProfile.id,
      sender_name: `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || 'Team Member',
      sender_role: userProfile.role || 'employee',
      sender_avatar: userProfile.avatar_url || null,
      channel: targetChannel,
      recipient_id: chatRecipient ? chatRecipient.id : null,
      message: `📄 Attachment: ${cleanName}`,
      attachments: [
        {
          id: generateUUID(),
          name: cleanName,
          url: cleanUrl,
          category: cleanUrl.toLowerCase().endsWith('.pdf') ? 'document' : 'other',
          size: 0
        }
      ],
      reactions: [],
      created_at: new Date().toISOString()
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setIsAttachingDocModalOpen(false);
    setDocAttachmentUrl('');
    setDocAttachmentName('');

    try {
      await supabaseClient.from('chat_messages').insert([newMsg]);
    } catch (e) {
      console.warn('Doc send error:', e);
    }
  };

  // Immediate Auto-Login from Local Storage (Never requires logging in repeatedly)
  useEffect(() => {
    bootstrapSession();
  }, []);

  const bootstrapSession = async () => {
    try {
      const savedProfile = await AsyncStorage.getItem('@vdx_user_profile');
      const savedEmail = await AsyncStorage.getItem('@vdx_mobile_email');
      if (savedProfile && savedEmail) {
        const parsed = JSON.parse(savedProfile);
        if (parsed && (parsed.id || parsed.email)) {
          setUserProfile(parsed);
          setUserEmail(savedEmail);
          setIsLoggedIn(true);
        }
      }
    } catch (e) {
      console.log('Bootstrap session error:', e);
    } finally {
      initSupabase();
    }
  };

  const initSupabase = async () => {
    try {
      const client = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY);
      setSupabaseClient(client);

      // Verify and sync session with Supabase in background
      await checkSession(client);

      const { data: orgData, error } = await client.from('organizations').select('*');
      if (!error && orgData && orgData.length > 0) {
        setSupabaseConnected(true);
        setOrganizations(orgData);
        setCurrentOrg(orgData[0]);
      }
    } catch (e) {
      console.log('Supabase init error', e);
    }
  };

  const checkSession = async (client: SupabaseClient) => {
    try {
      const token = await AsyncStorage.getItem('@vdx_mobile_token');
      const email = await AsyncStorage.getItem('@vdx_mobile_email');
      const savedProfile = await AsyncStorage.getItem('@vdx_user_profile');

      if (savedProfile) {
        try {
          const parsed = JSON.parse(savedProfile);
          if (parsed && (parsed.id || parsed.email)) {
            setUserProfile(parsed);
            if (email) setUserEmail(email);
            setIsLoggedIn(true);
            setupNotificationsAsync();
          }
        } catch {}
      }

      if (token && email) {
        const cleanEmail = email.trim().toLowerCase();
        try {
          const { data: fullProfile } = await client
            .from('profiles')
            .select('*')
            .eq('email', cleanEmail)
            .maybeSingle();

          if (fullProfile) {
            const unifiedUser = {
              ...fullProfile,
              id: fullProfile.id,
              user_id: fullProfile.id,
              joining_date: fullProfile.joining_date || '2026-01-01',
              first_name: fullProfile.first_name || '',
              last_name: fullProfile.last_name || '',
              role: fullProfile.role || 'employee',
              designation: fullProfile.designation || 'Team Member',
              department: fullProfile.department || 'Operations'
            };
            setUserEmail(cleanEmail);
            setUserProfile(unifiedUser);
            await AsyncStorage.setItem('@vdx_user_profile', JSON.stringify(unifiedUser));
            setIsLoggedIn(true);
            setupNotificationsAsync();
            await refreshAllData(client, unifiedUser.org_id, unifiedUser.id);
          }
        } catch (fetchErr) {
          console.log('Profile background sync note (offline/network):', fetchErr);
        }
      }
    } catch (e) {
      console.log('Session check error', e);
    }
  };

  const refreshAllData = async (client: SupabaseClient, orgId?: string, profileId?: string) => {
    const targetOrgId = orgId || currentOrg?.id || userProfile?.org_id;
    const myId = profileId || userProfile?.id;
    if (!client) return;

    try {
      setIsRefreshing(true);

      // 1. Organizations & Holidays
      const { data: orgs } = await client.from('organizations').select('*');
      if (orgs && orgs.length > 0) {
        setOrganizations(orgs);
        const match = targetOrgId ? orgs.find((o) => o.id === targetOrgId) : orgs[0];
        if (match) {
          setCurrentOrg(match);
          if (match.settings?.holidays && Array.isArray(match.settings.holidays) && match.settings.holidays.length > 0) {
            setHolidays(match.settings.holidays);
          } else {
            setHolidays(DEFAULT_HOLIDAYS);
          }
        }
      }

      // 2. Office Locations for Geofencing
      if (targetOrgId) {
        const { data: offices } = await client
          .from('office_locations')
          .select('*')
          .eq('org_id', targetOrgId)
          .eq('is_active', true);
        if (offices && offices.length > 0) {
          setActiveOfficeCoords({
            latitude: offices[0].latitude,
            longitude: offices[0].longitude,
            radiusMeters: offices[0].radius_meters || 200,
            name: offices[0].name
          });
        } else {
          setActiveOfficeCoords(DEFAULT_OFFICE_COORDS);
        }
      }

      // 3. Team Profiles for Org
      if (targetOrgId) {
        const { data: profiles } = await client
          .from('profiles')
          .select('*')
          .eq('org_id', targetOrgId);
        if (profiles) {
          const filteredProfiles = profiles.filter((p) => {
            const email = p.email?.toLowerCase();
            const id = p.id;
            const first = (p.first_name || p.firstName || '').toLowerCase();
            const last = (p.last_name || p.lastName || '').toLowerCase();
            // Vedotrix Supercontroller is the root controller of the entire platform, NOT an employee of any organization tenant (BNK Digital, Vedotrix Global, etc.)
            const isVedotrixRootSupercontroller =
              id === '00000000-0000-0000-0000-000000000003' ||
              id === '00000000-0000-0000-0000-000000000004' ||
              email === 'admin@vedotrix.com' ||
              email === 'sajalsaxenagola@gmail.com' ||
              (first === 'vedotrix' && last.includes('superadmin'));

            if (isVedotrixRootSupercontroller) {
              return false;
            }

            // In ALL organizations: ANY real superadmin belonging to that organization (e.g. Sajal Saxena chiefhead.interndesire@gmail.com, Kshitiz Narayan) IS SHOWN & COUNTED!
            return true;
          });
          setTeamProfiles(filteredProfiles);
        }
      }

      // 4. Attendance Records
      let fetchedAttendance: any[] = [];
      if (targetOrgId) {
        const { data: att } = await client
          .from('attendance')
          .select('*')
          .eq('org_id', targetOrgId)
          .order('date', { ascending: false });
        if (att) {
          const filteredAtt = att.filter((a) => {
            // Exclude root supercontroller attendance from tenant attendance counts
            if (a.employee_id === '00000000-0000-0000-0000-000000000003' || a.employee_id === '00000000-0000-0000-0000-000000000004') {
              return false;
            }
            return true;
          });
          setAttendanceRecords(filteredAtt);
          fetchedAttendance = filteredAtt;
        }
      }

      // 5. Leave Requests
      if (targetOrgId) {
        const { data: leaves } = await client
          .from('leave_requests')
          .select('*')
          .eq('org_id', targetOrgId)
          .order('created_at', { ascending: false });
        if (leaves) setLeaveRequests(leaves);
      }

      // 6. Access Requests
      const { data: reqs } = await client
        .from('access_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (reqs) setAccessRequests(reqs);

      // 7. Meetings & Schedules
      if (targetOrgId) {
        const { data: mtg } = await client
          .from('meetings')
          .select('*')
          .eq('org_id', targetOrgId)
          .order('date', { ascending: false });
        if (mtg) setMeetings(mtg);
      }

      // 8. Notices / Announcements
      if (targetOrgId) {
        const { data: nots } = await client
          .from('notices')
          .select('*')
          .eq('org_id', targetOrgId)
          .order('date', { ascending: false });
        if (nots) setNotices(nots);
      }

      // 9. Daily Standups (Fetch tenant standups and guarantee user's own standups)
      if (targetOrgId) {
        const standupUserId = profileId || userProfile?.id;
        const query = client.from('daily_standups').select('*');
        const { data: st } = standupUserId
          ? await query.or('org_id.eq.' + targetOrgId + ',employee_id.eq.' + standupUserId).order('date', { ascending: false })
          : await query.eq('org_id', targetOrgId).order('date', { ascending: false });
        if (st) setStandups(st);
      }

      // 10. Offer Letters
      if (targetOrgId) {
        const { data: offers } = await client
          .from('offer_letters')
          .select('*')
          .eq('org_id', targetOrgId)
          .order('created_at', { ascending: false });
        if (offers) setOfferLetters(offers);
      }

      // 11. Chat Channels & Messages from Supabase DB
      if (targetOrgId) {
        const { data: chans } = await client
          .from('chat_channels')
          .select('*')
          .eq('org_id', targetOrgId);
        if (chans) setDbChannels(chans);

        const { data: msgs } = await client
          .from('chat_messages')
          .select('*')
          .eq('org_id', targetOrgId)
          .order('created_at', { ascending: true })
          .limit(150);
        if (msgs) setChatMessages(msgs);
      }

      // 12. Check Today's Punch Record
      const todayStr = getTodayISTDate();
      const todayRecord = fetchedAttendance.find(
        (a) => a.employee_id === myId && a.date === todayStr
      );
      if (todayRecord) {
        // Ensure that if user checked in today, status is treated as 'present'
        const normalizedToday = {
          ...todayRecord,
          status: (todayRecord.status === 'present' || todayRecord.check_in_time) ? 'present' : todayRecord.status
        };
        setTodayAttendanceRecord(normalizedToday);
        setIsCheckedIn(true);
        if (todayRecord.check_in_time) {
          const t = new Date(todayRecord.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setCheckInTime(`${t} IST`);
        } else {
          setCheckInTime('Present (Today)');
        }
      } else {
        setIsCheckedIn(false);
        setCheckInTime(null);
        setTodayAttendanceRecord(null);
      }

      // 12. Request GPS Coordinates
      await requestLocationPermission();

      // 13. Run Shift Liveness Check
      checkAttendanceStatusAndNotify(fetchedAttendance, myId);
    } catch (err) {
      console.log('Error refreshing data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Push Notifications Setup
  const setupNotificationsAsync = async () => {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('attendance-alerts', {
          name: 'Shift Attendance Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 300, 200, 300],
          lightColor: '#f59e0b',
          sound: 'default'
        });

        await Notifications.setNotificationChannelAsync('meetings-alerts', {
          name: 'Meeting & Schedule Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6366f1',
          sound: 'default'
        });

        await Notifications.setNotificationChannelAsync('approvals-alerts', {
          name: 'Approvals & Requests Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#10b981',
          sound: 'default'
        });

        await Notifications.setNotificationChannelAsync('chat-alerts', {
          name: 'Team Chat & Direct Messages',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 200, 100, 200],
          lightColor: '#38bdf8',
          sound: 'default'
        });

        await Notifications.setNotificationChannelAsync('standup-alerts', {
          name: 'Daily EOD Standup & Work Reports',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 300, 150, 300],
          lightColor: '#8b5cf6',
          sound: 'default'
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      const granted = finalStatus === 'granted';
      setNotifPermission(granted);
      return granted;
    } catch (err) {
      console.log('Error setting up notifications:', err);
      return false;
    }
  };

  const sendDeviceNotification = async (title: string, body: string, channelId = 'chat-alerts', data: any = {}) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          vibrate: [0, 250, 150, 250],
          color: '#0284c7',
          data,
          ...(Platform.OS === 'android' ? { channelId } : {})
        },
        trigger: null
      });
    } catch (err) {
      console.log('Failed to trigger notification:', err);
    }
  };

  // Safe attachment extractor (handles jsonb array, json string, or single object)
  const getSafeAttachments = (rawAttachments: any): any[] => {
    if (!rawAttachments) return [];
    let list: any[] = [];
    if (Array.isArray(rawAttachments)) {
      list = rawAttachments;
    } else if (typeof rawAttachments === 'string') {
      try {
        const parsed = JSON.parse(rawAttachments);
        if (Array.isArray(parsed)) list = parsed;
        else if (parsed && typeof parsed === 'object') list = [parsed];
      } catch {
        list = [];
      }
    } else if (typeof rawAttachments === 'object') {
      list = [rawAttachments];
    }
    return list.filter((a) => a && (a.url || a.name));
  };

  const formatAttachmentSize = (bytes: number): string => {
    if (!bytes || isNaN(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Safe document, image & Base64 PDF opener for mobile
  const handleOpenMobileAttachment = async (att: any) => {
    try {
      const url = (att.url || '').trim();
      if (!url) {
        Alert.alert('No Attachment', 'This attachment has no valid link or file data.');
        return;
      }

      const fileName = att.name || 'document.pdf';
      const lowerName = fileName.toLowerCase();
      const isImg =
        att.category === 'image' ||
        lowerName.endsWith('.png') ||
        lowerName.endsWith('.jpg') ||
        lowerName.endsWith('.jpeg') ||
        lowerName.endsWith('.webp') ||
        lowerName.endsWith('.gif') ||
        url.startsWith('data:image/');

      // If it's an image, view it in the in-app Lightbox immediately
      if (isImg) {
        const cleanUri = url.startsWith('data:') || url.startsWith('http')
          ? url.replace(/\s+/g, '')
          : `data:image/jpeg;base64,${url.replace(/\s+/g, '')}`;
        setChatImageLightboxUrl(cleanUri);
        return;
      }

      // 1. If standard web URL, open directly in external browser / PDF reader
      if (url.startsWith('http://') || url.startsWith('https://')) {
        await Linking.openURL(url);
        return;
      }

      // 2. Base64 encoded document / PDF (directly stored in DB)
      let base64Content = url.replace(/\s+/g, '');
      let mimeType = att.type || (lowerName.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
      if (base64Content.startsWith('data:')) {
        const commaIdx = base64Content.indexOf(',');
        if (commaIdx !== -1) {
          const header = base64Content.slice(0, commaIdx);
          const mimeMatch = header.match(/data:([^;]+)/);
          if (mimeMatch && mimeMatch[1]) mimeType = mimeMatch[1];
          base64Content = base64Content.slice(commaIdx + 1);
        }
      }

      // Sync Base64 file to Supabase Storage avatars bucket for instant public CDN streaming
      if (supabaseClient) {
        try {
          const cleanSafeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
          const storagePath = `chat_docs/${Date.now()}_${cleanSafeName}`;
          const arrayBuffer = decode(base64Content);

          const { error: uploadErr } = await supabaseClient.storage
            .from('avatars')
            .upload(storagePath, arrayBuffer, { contentType: mimeType, upsert: true });

          if (!uploadErr) {
            const { data: pubData } = supabaseClient.storage.from('avatars').getPublicUrl(storagePath);
            if (pubData?.publicUrl) {
              await Linking.openURL(pubData.publicUrl);
              return;
            }
          }
        } catch (storageErr) {
          console.warn('Storage upload fallback note:', storageErr);
        }
      }

      // 3. Fallback Share / System Intent
      await Share.share({
        title: fileName,
        message: `${fileName}\n\nDocument shared via Vedotrix Pulse.`
      });
    } catch (err: any) {
      console.warn('Error opening attachment:', err);
      Alert.alert('Attachment', 'Opening document in device viewer...');
    }
  };

  // Channel Membership & Management Functions
  const addMemberToChannel = async (channelId: string, memberId: string) => {
    if (!supabaseClient || !channelId || !memberId) return;
    const targetChan = dbChannels.find((c) => c.id === channelId || c.name === channelId);
    if (!targetChan) return;

    const currentMemberIds = Array.isArray(targetChan.member_ids) ? targetChan.member_ids : [];
    if (currentMemberIds.includes(memberId)) {
      Alert.alert('Already Member', 'This colleague is already a member of this channel.');
      return;
    }

    const updatedMembers = [...currentMemberIds, memberId];
    setDbChannels((prev) => prev.map((c) => (c.id === targetChan.id ? { ...c, member_ids: updatedMembers } : c)));

    try {
      await supabaseClient.from('chat_channels').update({ member_ids: updatedMembers }).eq('id', targetChan.id);
      Alert.alert('Member Added ✓', 'Colleague has been added to the channel.');
      setCandidateMemberToAdd('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not add member.');
    }
  };

  const removeMemberFromChannel = async (channelId: string, memberId: string) => {
    if (!supabaseClient || !channelId || !memberId) return;
    const targetChan = dbChannels.find((c) => c.id === channelId || c.name === channelId);
    if (!targetChan) return;

    const currentMemberIds = Array.isArray(targetChan.member_ids) ? targetChan.member_ids : [];
    const updatedMembers = currentMemberIds.filter((id: string) => id !== memberId);
    setDbChannels((prev) => prev.map((c) => (c.id === targetChan.id ? { ...c, member_ids: updatedMembers } : c)));

    try {
      await supabaseClient.from('chat_channels').update({ member_ids: updatedMembers }).eq('id', targetChan.id);
      Alert.alert('Member Removed', 'Colleague has been removed from this channel.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not remove member.');
    }
  };

  const updateChannelDetails = async (channelId: string, name: string, desc: string, isPrivate: boolean) => {
    if (!supabaseClient || !channelId || !name.trim()) return;
    setIsSavingChannelSettings(true);
    try {
      const targetChan = dbChannels.find((c) => c.id === channelId || c.name === channelId);
      if (!targetChan) return;

      const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const updates = {
        name: cleanName,
        description: desc.trim(),
        is_private: isPrivate
      };
      setDbChannels((prev) => prev.map((c) => (c.id === targetChan.id ? { ...c, ...updates } : c)));
      await supabaseClient.from('chat_channels').update(updates).eq('id', targetChan.id);
      Alert.alert('Channel Updated ✓', `#${cleanName} details have been updated.`);
      setIsChannelSettingsModalOpen(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not update channel.');
    } finally {
      setIsSavingChannelSettings(false);
    }
  };

  const deleteChannel = async (channelId: string) => {
    if (!supabaseClient || !channelId) return;
    const targetChan = dbChannels.find((c) => c.id === channelId || c.name === channelId);
    if (!targetChan) return;

    Alert.alert(
      'Delete Channel',
      `Permanently delete #${targetChan.name}? All messages in this channel will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabaseClient.from('chat_channels').delete().eq('id', targetChan.id);
              setDbChannels((prev) => prev.filter((c) => c.id !== targetChan.id));
              setIsChannelSettingsModalOpen(false);
              setActiveChatChannel('support');
              setChatViewMode('sidebar');
              Alert.alert('Channel Deleted', `#${targetChan.name} has been removed.`);
            } catch (e: any) {
              Alert.alert('Error', e?.message);
            }
          }
        }
      ]
    );
  };

  const checkAttendanceStatusAndNotify = async (records: any[] = attendanceRecords, myProfileId?: string) => {
    try {
      const now = new Date();
      const todayStr = getTodayISTDate();
      const dayOfWeek = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getDay();
      const weekOffList: number[] = currentOrg?.settings?.weekOffDays || [0];

      if (weekOffList.includes(dayOfWeek)) {
        setAttendanceAlertActive(false);
        return;
      }

      // Check if today is an official organization holiday
      const isHolidayToday = holidays.some((h) => h.date === todayStr);
      if (isHolidayToday) {
        setAttendanceAlertActive(false);
        return;
      }

      const myId = myProfileId || userProfile?.id;
      if (!myId) return;

      const hasMarked = records.some(
        (a) =>
          a.employee_id === myId &&
          a.date === todayStr &&
          a.regularization_status !== 'rejected' &&
          a.approval_status !== 'rejected' &&
          a.regularization_status !== 'pending' &&
          a.approval_status !== 'pending_manager_approval' &&
          (a.check_in_time || a.status === 'present' || a.status === 'regularized' || a.regularization_status === 'approved')
      ) || isCheckedIn;

      const timeStr = getISTTimeString(now);
      const [h, m] = timeStr.split(':').map(Number);
      const currentTotalMins = (h || 0) * 60 + (m || 0);

      if (!hasMarked) {
        setAttendanceAlertActive(true);

        const shiftStartTime = currentOrg?.settings?.shiftStartTime || '09:30';
        const [shH, shM] = shiftStartTime.split(':').map(Number);
        const shiftStartMins = (shH || 9) * 60 + (shM || 30);

        const lastNotifiedDate = await AsyncStorage.getItem('@vdx_last_att_remind_date');
        if (lastNotifiedDate !== todayStr && currentTotalMins >= shiftStartMins - 15) {
          await AsyncStorage.setItem('@vdx_last_att_remind_date', todayStr);
          await sendDeviceNotification(
            '⏰ Attendance Reminder | Shift Active',
            `Please mark your attendance! Shift started at ${shiftStartTime} IST. Tap to punch in with GPS or request regularization.`,
            'attendance-alerts'
          );
        }
      } else {
        setAttendanceAlertActive(false);

        // Auto EOD Standup Reminder: if employee is marked present but has not logged their EOD standup
        const hasSubmittedStandup = standups.some(
          (s) => s.employee_id === myId && s.date === todayStr
        );
        const shiftEndTime = currentOrg?.settings?.shiftEndTime || '18:30';
        const [eh, em] = shiftEndTime.split(':').map(Number);
        const shiftEndMins = (eh || 18) * 60 + (em || 30);

        if (!hasSubmittedStandup && currentTotalMins >= shiftEndMins - 60) {
          const lastStandupRemind = await AsyncStorage.getItem('@vdx_last_standup_remind_date');
          if (lastStandupRemind !== todayStr) {
            await AsyncStorage.setItem('@vdx_last_standup_remind_date', todayStr);
            await sendDeviceNotification(
              '🚀 EOD Standup Reminder | Wrap Up Today',
              `Your shift ends at ${shiftEndTime} IST. Don't forget to submit your daily accomplishment log & PR deliverables!`,
              'standup-alerts'
            );
          }
        }
      }
    } catch (e) {
      console.log('Attendance reminder check note:', e);
    }
  };

  const requestLocationPermission = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      setLocation(loc);

      const targetOffice = activeOfficeCoords;
      const dist = getDistanceMeters(
        loc.coords.latitude,
        loc.coords.longitude,
        targetOffice.latitude,
        targetOffice.longitude
      );
      setDistance(dist);
    } catch (e) {
      console.log('Location error', e);
    } finally {
      setLocLoading(false);
    }
  };

  // Login
  const handleMobileLogin = async () => {
    if (!loginEmail.trim() || !loginPass.trim()) {
      Alert.alert('Required', 'Please enter both work email and security password.');
      return;
    }

    setIsAuthenticating(true);
    const clean = loginEmail.trim().toLowerCase();
    const cleanPass = loginPass.trim();

    if (supabaseClient) {
      try {
        const { data: rpcData, error } = await supabaseClient.rpc('verify_user_password', {
          user_email: clean,
          input_password: cleanPass
        });

        if (error) {
          Alert.alert('Authentication Error', error.message || 'Verification failed.');
          setIsAuthenticating(false);
          return;
        }

        if (rpcData && rpcData.length > 0 && rpcData[0].is_valid === true) {
          const rpcUser = rpcData[0];
          const { data: fullProfile } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('email', clean)
            .maybeSingle();

          const unifiedUser = {
            ...rpcUser,
            ...fullProfile,
            id: fullProfile?.id || rpcUser.user_id || rpcUser.id,
            user_id: fullProfile?.id || rpcUser.user_id || rpcUser.id,
            first_name: fullProfile?.first_name || rpcUser.first_name,
            last_name: fullProfile?.last_name || rpcUser.last_name || '',
            role: fullProfile?.role || rpcUser.role || 'employee',
            org_id: fullProfile?.org_id || rpcUser.org_id,
            designation: fullProfile?.designation || 'Team Member',
            department: fullProfile?.department || 'Operations',
            phone: fullProfile?.phone || '',
            avatar_url: fullProfile?.avatar_url || '',
            joining_date: fullProfile?.joining_date || '2026-01-01',
            manager_id: fullProfile?.manager_id || null,
            base_salary: fullProfile?.base_salary || 0
          };

          await AsyncStorage.setItem('@vdx_mobile_token', `vdx_m_${Date.now()}`);
          await AsyncStorage.setItem('@vdx_mobile_email', clean);
          await AsyncStorage.setItem('@vdx_user_profile', JSON.stringify(unifiedUser));

          setUserEmail(clean);
          setUserProfile(unifiedUser);
          setIsLoggedIn(true);

          setupNotificationsAsync();
          await refreshAllData(supabaseClient, unifiedUser.org_id, unifiedUser.id);

          Alert.alert('Welcome Back', `Logged in as ${unifiedUser.first_name} ${unifiedUser.last_name} (${unifiedUser.role.toUpperCase()})`);
        } else {
          Alert.alert('Access Denied', 'Invalid work email or password.');
        }
      } catch (err: any) {
        Alert.alert('Connection Error', err?.message || 'Could not verify credentials.');
      }
    }
    setIsAuthenticating(false);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('@vdx_mobile_token');
    await AsyncStorage.removeItem('@vdx_mobile_email');
    await AsyncStorage.removeItem('@vdx_user_profile');
    setIsLoggedIn(false);
    setUserEmail('');
    setUserProfile(null);
    setIsCheckedIn(false);
    setTodayAttendanceRecord(null);
  };

  // Geo-Fenced Smart Punch with Shift Gate Enforcement (Single Punch System)
  const handlePunchToggle = async () => {
    if (!supabaseClient || !userProfile) return;

    // 1. Holiday Lock Gate
    if (todayHoliday) {
      Alert.alert(
        'Attendance Locked 🔒',
        `Today is an official organization holiday: ${todayHoliday.name}.\n\nAttendance marking is locked. Enjoy your holiday!`
      );
      return;
    }

    // 2. Week Off Lock Gate
    if (isWeekOffToday) {
      Alert.alert(
        'Attendance Locked 🔒',
        'Today is your organization\'s weekly off day.\n\nAttendance marking is locked. Enjoy your rest day!'
      );
      return;
    }

    // 3. If already marked present for today, inform user (single punch system)
    if (isCheckedIn || todayAttendanceRecord) {
      const punchTime = todayAttendanceRecord?.check_in_time
        ? formatISTTimeOnly(todayAttendanceRecord.check_in_time)
        : (checkInTime || 'IST');
      Alert.alert(
        'Attendance Already Recorded ✓',
        `You have already punched in for today at ${punchTime}.\n\nSingle punch attendance is active. No checkout is needed. Attendance is complete for today.`
      );
      return;
    }

    const targetCoords = activeOfficeCoords;
    const isInsideFence = distance !== null && distance <= targetCoords.radiusMeters;
    const todayStr = getTodayISTDate();
    const nowTimeStr = getISTTimeString();
    const [nowH, nowM] = nowTimeStr.split(':').map(Number);
    const currentTotalMins = (nowH || 0) * 60 + (nowM || 0);

    const shiftStartTime = currentOrg?.settings?.shiftStartTime || '09:30';
    const shiftEndTime = currentOrg?.settings?.shiftEndTime || '19:00';
    const [startH, startM] = shiftStartTime.split(':').map(Number);
    const [endH, endM] = shiftEndTime.split(':').map(Number);
    const shiftStartTotalMins = (startH || 9) * 60 + (startM || 30);
    const shiftEndTotalMins = (endH || 19) * 60 + (endM || 0);

    if (currentTotalMins < (shiftStartTotalMins - 30)) {
      Alert.alert(
        'Too Early to Punch In ⏰',
        `Your shift starts at ${shiftStartTime} IST. Punch-in opens 30 minutes before shift start (${String(Math.floor((shiftStartTotalMins - 30) / 60)).padStart(2, '0')}:${String((shiftStartTotalMins - 30) % 60).padStart(2, '0')} IST).`
      );
      return;
    }

    if (currentTotalMins > shiftEndTotalMins) {
      Alert.alert(
        'Shift Has Ended 🌙',
        `Your shift ended at ${shiftEndTime} IST. Attendance marking is closed for today. Please submit an attendance regularization request if needed.`
      );
      return;
    }

    const newAttId = generateUUID();
    const requiresApproval = !isInsideFence;
    const outOfOfficeReason = requiresApproval
      ? `Out-of-Office Location (${distance !== null ? `${distance}m away` : 'Remote GPS'}). Pending approval from Reporting Manager / HR / Superadmin.`
      : null;

    // Check if attendance record already exists for today to update instead of conflict
    const existing = attendanceRecords.find((a) => a.employee_id === userProfile.id && a.date === todayStr);

    const recordPayload = {
      id: existing?.id || newAttId,
      org_id: currentOrg?.id || userProfile.org_id,
      employee_id: userProfile.id,
      date: todayStr,
      check_in_time: new Date().toISOString(),
      check_in_lat: location?.coords.latitude || null,
      check_in_long: location?.coords.longitude || null,
      distance_meters: distance,
      status: 'present',
      is_remote: requiresApproval,
      regularization_status: requiresApproval ? 'pending' : 'none',
      regularization_reason: outOfOfficeReason,
      approval_status: requiresApproval ? 'pending_manager_approval' : 'approved',
      total_hours: 8
    };

    try {
      const { error } = existing
        ? await supabaseClient.from('attendance').update(recordPayload).eq('id', existing.id)
        : await supabaseClient.from('attendance').upsert(recordPayload, { onConflict: 'employee_id,date' });

      if (!error) {
        setIsCheckedIn(true);
        setCheckInTime(`${nowTimeStr.slice(0, 5)} IST`);
        setTodayAttendanceRecord(recordPayload);
        setAttendanceRecords((prev) => [recordPayload, ...prev.filter((a) => !(a.employee_id === userProfile.id && a.date === todayStr))]);
        setAttendanceAlertActive(false);

        sendDeviceNotification(
          requiresApproval ? '⏳ Attendance Logged (Approval Required) | Vedotrix Pulse' : '✅ Attendance Recorded | Vedotrix Pulse',
          requiresApproval
            ? `Checked in at ${nowTimeStr} IST (${distance}m from office). Pending Manager / HR approval.`
            : `Checked in at ${nowTimeStr} IST. Geofence: In Office (${targetCoords.name}). Status: Present.`,
          'attendance-alerts'
        );

        if (requiresApproval) {
          Alert.alert(
            'Attendance Logged (Pending Approval) ⏳',
            `Checked in at ${nowTimeStr} IST.\nLocation: Outside Office Perimeter (${distance !== null ? `${distance}m away` : 'Remote'}).\n\nYour attendance has been submitted and is pending verification from your Reporting Manager, HR, or Superadmin.`
          );
        } else {
          Alert.alert(
            'Marked Present for Today ✓',
            `Checked in at ${nowTimeStr} IST.\nLocation: In Office (${targetCoords.name})\n\nSingle punch attendance recorded successfully.`
          );
        }
        refreshAllData(supabaseClient, userProfile.org_id, userProfile.id);
      } else {
        showUserFriendlyError('Update Failed', error, 'Could not update employee record. Please verify network connection.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message);
    }
  };

  // Submit Attendance Regularization Request
  const handleSubmitRegularization = async () => {
    if (!regJustification.trim()) {
      Alert.alert('Required', 'Please enter a justification.');
      return;
    }
    if (!supabaseClient || !userProfile) return;

    const targetDate = regTargetDate || getTodayISTDate();

    // 1. Block regularizing if attendance is already marked present for target date
    const existing = attendanceRecords.find(
      (a) => a.employee_id === userProfile.id && a.date === targetDate
    );
    if (existing && (existing.status === 'present' || existing.check_in_time)) {
      Alert.alert(
        'Attendance Already Marked ✓',
        `Attendance for ${targetDate} is already marked as present. Regularization is not permitted for days already marked.`
      );
      return;
    }

    // 2. Block regularizing on official holidays
    const isTargetHoliday = holidays.find((h) => h.date === targetDate);
    if (isTargetHoliday) {
      Alert.alert(
        'Holiday Locked 🔒',
        `${targetDate} is an official organization holiday (${isTargetHoliday.name}). Regularization cannot be requested for holidays.`
      );
      return;
    }

    // 3. Block regularizing on weekly off days
    const targetDayOfWeek = new Date(`${targetDate}T00:00:00+05:30`).getDay();
    const weekOffList: number[] = currentOrg?.settings?.weekOffDays || [0];
    if (weekOffList.includes(targetDayOfWeek)) {
      Alert.alert(
        'Weekly Off Locked 🔒',
        `${targetDate} is a declared weekly off. Regularization cannot be requested for rest days.`
      );
      return;
    }

    setIsSubmittingReg(true);
    try {
      const fullReason = `[${regCategory}] Shift: ${regInTime} - ${regOutTime} IST. ${regJustification.trim()}`;

      if (existing) {
        const updatePayload = {
          regularization_reason: fullReason,
          regularization_status: 'pending',
          approval_status: 'pending_manager_approval',
          status: 'absent'
        };
        const { error } = await supabaseClient
          .from('attendance')
          .update(updatePayload)
          .eq('id', existing.id);

        if (error) throw error;

        // Immediate local state update so unapproved status shows pending/absent immediately
        setAttendanceRecords((prev) =>
          prev.map((rec) => (rec.id === existing.id ? { ...rec, ...updatePayload } : rec))
        );
      } else {
        const newId = generateUUID();
        let checkInISO: string | null = null;
        let checkOutISO: string | null = null;
        try {
          if (regInTime) {
            const [ih, im] = regInTime.split(':');
            const dIn = new Date(`${targetDate}T${(ih || '09').padStart(2, '0')}:${(im || '30').padStart(2, '0')}:00+05:30`);
            if (!isNaN(dIn.getTime())) checkInISO = dIn.toISOString();
          }
          if (regOutTime) {
            const [oh, om] = regOutTime.split(':');
            const dOut = new Date(`${targetDate}T${(oh || '18').padStart(2, '0')}:${(om || '30').padStart(2, '0')}:00+05:30`);
            if (!isNaN(dOut.getTime())) checkOutISO = dOut.toISOString();
          }
        } catch {}

        const insertPayload: any = {
          id: newId,
          org_id: currentOrg?.id || userProfile.org_id,
          employee_id: userProfile.id,
          date: targetDate,
          status: 'absent',
          regularization_status: 'pending',
          approval_status: 'pending_manager_approval',
          regularization_reason: fullReason,
          total_hours: 8
        };
        if (checkInISO) insertPayload.check_in_time = checkInISO;
        if (checkOutISO) insertPayload.check_out_time = checkOutISO;

        const { error } = await supabaseClient.from('attendance').upsert(insertPayload, { onConflict: 'employee_id,date' });
        if (error) throw error;
      }

      await sendDeviceNotification(
        '✍️ Regularization Submitted',
        `Attendance regularization for ${targetDate} sent to manager for approval.`,
        'attendance-alerts'
      );

      Alert.alert('Regularization Submitted ⏳', `Request for ${targetDate} has been sent to your reporting manager.`);
      setIsRegModal(false);
      setRegJustification('');
      refreshAllData(supabaseClient, userProfile.org_id, userProfile.id);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not submit regularization.');
    } finally {
      setIsSubmittingReg(false);
    }
  };

  // Manager/HR/Superadmin Resolve Regularization
  const handleResolveRegularization = async (id: string, status: 'approved' | 'rejected', customNote?: string) => {
    if (!supabaseClient || !userProfile) return;

    try {
      const approverUuid = (userProfile.id && userProfile.id.length === 36) ? userProfile.id : null;
      const approverName = `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || 'HR/Manager';
      const roleTitle = userProfile.designation || (userProfile.role ? userProfile.role.toUpperCase() : 'Authority');
      const nowISTDateStr = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });

      const defaultNote = status === 'approved'
        ? `Regularized & Approved by ${approverName} (${roleTitle}) on ${nowISTDateStr}`
        : `Regularization Rejected by ${approverName} (${roleTitle}) on ${nowISTDateStr}`;

      const noteToSave = customNote?.trim() ? `${customNote.trim()} (By ${approverName} on ${nowISTDateStr})` : defaultNote;

      const updatePayload: any = {
        regularization_status: status,
        approval_status: status === 'approved' ? 'approved' : 'rejected',
        status: status === 'approved' ? 'present' : 'absent',
        approved_by: approverUuid,
        regularized_by: approverUuid,
        regularization_notes: noteToSave,
        approval_notes: noteToSave,
        total_hours: status === 'approved' ? 8 : 0
      };

      const { error } = await supabaseClient
        .from('attendance')
        .update(updatePayload)
        .eq('id', id);

      if (!error) {
        // Immediate local state update so UI updates without waiting for network re-fetch
        setAttendanceRecords((prev) =>
          prev.map((rec) => (rec.id === id ? { ...rec, ...updatePayload } : rec))
        );

        Alert.alert(
          status === 'approved' ? 'Regularization Approved ✅' : 'Regularization Rejected ❌',
          `Attendance marked as ${status === 'approved' ? 'PRESENT' : 'ABSENT'}.\n\nNote: ${noteToSave}`
        );
        refreshAllData(supabaseClient, userProfile.org_id, userProfile.id);
      } else {
        Alert.alert('Error', error.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    }
  };

  // Direct Regularize by HR / Superadmin (Instantly marks employee present)
  const handleDirectRegularize = async (empId: string, dateStr: string, customNote?: string) => {
    if (!supabaseClient || !userProfile) return;
    try {
      const existing = attendanceRecords.find((a) => a.employee_id === empId && a.date === dateStr);
      const approverUuid = (userProfile.id && userProfile.id.length === 36) ? userProfile.id : null;
      const approverName = `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || 'HR/Admin';
      const roleTitle = userProfile.designation || (userProfile.role ? userProfile.role.toUpperCase() : 'Authority');
      const nowISTDateStr = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });

      const defaultNote = `Direct Regularization approved by ${approverName} (${roleTitle}) on ${nowISTDateStr}`;
      const noteToSave = customNote?.trim() ? `${customNote.trim()} (By ${approverName} on ${nowISTDateStr})` : defaultNote;

      if (existing) {
        const updatePayload = {
          status: 'present',
          regularization_status: 'approved',
          approval_status: 'approved',
          approved_by: approverUuid,
          regularized_by: approverUuid,
          regularization_notes: noteToSave,
          approval_notes: noteToSave,
          regularization_reason: existing.regularization_reason || noteToSave,
          total_hours: 8
        };
        const { error } = await supabaseClient
          .from('attendance')
          .update(updatePayload)
          .eq('id', existing.id);
        if (error) throw error;

        // Immediate local state update
        setAttendanceRecords((prev) =>
          prev.map((rec) => (rec.id === existing.id ? { ...rec, ...updatePayload } : rec))
        );
      } else {
        const newRecord = {
          id: generateUUID(),
          org_id: currentOrg?.id || userProfile.org_id,
          employee_id: empId,
          date: dateStr,
          status: 'present',
          regularization_status: 'approved',
          approval_status: 'approved',
          regularization_reason: noteToSave,
          regularization_notes: noteToSave,
          approval_notes: noteToSave,
          approved_by: approverUuid,
          regularized_by: approverUuid,
          total_hours: 8
        };
        const { error } = await supabaseClient
          .from('attendance')
          .insert(newRecord);
        if (error) throw error;

        // Immediate local state update
        setAttendanceRecords((prev) => [newRecord, ...prev]);
      }
      Alert.alert('Regularized Successfully ✅', `Attendance for ${dateStr} marked as PRESENT.\n\nNote: ${noteToSave}`);
      setSelectedCalendarDayData(null);
      refreshAllData(supabaseClient, userProfile.org_id, userProfile.id);
    } catch (err: any) {
      Alert.alert('Error', err?.message);
    }
  };

  // Toggle Custom Day Week-off Override (HR / Superadmin)
  const handleToggleCustomDayWeekOff = async (dateStr: string, empId?: string) => {
    if (!supabaseClient || !currentOrg) return;
    try {
      // Fetch fresh organization settings from live Supabase to avoid overwriting concurrent changes
      const { data: liveOrg } = await supabaseClient
        .from('organizations')
        .select('settings')
        .eq('id', currentOrg.id)
        .maybeSingle();

      const curSettings = liveOrg?.settings || currentOrg.settings || {};
      const curOverrides = { ...(curSettings.customDayOverrides || {}) };

      const key = empId ? `${dateStr}_${empId}` : dateStr;
      const reverseKey = empId ? `${empId}_${dateStr}` : dateStr;
      const currentType = curOverrides[key]?.type || curOverrides[reverseKey]?.type || curOverrides[dateStr]?.type;

      if (currentType === 'week_off') {
        curOverrides[key] = { type: 'working', employeeId: empId };
      } else {
        curOverrides[key] = { type: 'week_off', employeeId: empId };
      }

      const updatedSettings = { ...curSettings, customDayOverrides: curOverrides };
      const { data: updatedOrg, error } = await supabaseClient
        .from('organizations')
        .update({ settings: updatedSettings })
        .eq('id', currentOrg.id)
        .select()
        .single();

      if (!error && updatedOrg) {
        setCurrentOrg(updatedOrg);
        Alert.alert('Calendar Updated ✓', `Custom week-off policy saved to cloud for ${dateStr}.`);
        setSelectedCalendarDayData(null);
        refreshAllData(supabaseClient, currentOrg.id, userProfile?.id);
      } else {
        Alert.alert('Database Error', error?.message || 'Could not update calendar policy.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    }
  };

  // Submit Leave Request
  const handleSubmitLeave = async () => {
    if (!leaveReason.trim()) {
      Alert.alert('Required', 'Please provide a reason for the leave.');
      return;
    }
    if (!supabaseClient || !userProfile) return;

    setIsSubmittingLeave(true);
    try {
      const sDate = new Date(leaveStartDate);
      const eDate = new Date(leaveEndDate);
      const diffDays = Math.max(1, Math.ceil((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const totalDays = isHalfDay ? 0.5 : diffDays;

      const newId = generateUUID();
      const { error } = await supabaseClient.from('leave_requests').insert({
        id: newId,
        org_id: currentOrg?.id || userProfile.org_id,
        employee_id: userProfile.id,
        leave_type: leaveType,
        start_date: leaveStartDate,
        end_date: leaveEndDate,
        total_days: totalDays,
        is_half_day: isHalfDay,
        reason: leaveReason.trim(),
        status: 'pending',
        assigned_approver_id: userProfile.manager_id || null
      });

      if (!error) {
        await sendDeviceNotification(
          '🌴 Leave Request Submitted',
          `Applied for ${totalDays} day(s) (${leaveType.toUpperCase()}) from ${leaveStartDate}.`,
          'approvals-alerts'
        );

        Alert.alert('Leave Submitted 🌴', `Your application for ${totalDays} day(s) was routed to HR/Manager.`);
        setIsLeaveModal(false);
        setLeaveReason('');
        refreshAllData(supabaseClient, userProfile.org_id, userProfile.id);
      } else {
        Alert.alert('Error', error.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  // Manager/HR Resolve Leave Request
  const handleResolveLeave = async (leaveId: string, status: 'approved' | 'rejected') => {
    if (!supabaseClient || !userProfile) return;

    try {
      const { error } = await supabaseClient
        .from('leave_requests')
        .update({
          status,
          approved_by: userProfile.id,
          decided_at: new Date().toISOString()
        })
        .eq('id', leaveId);

      if (!error) {
        Alert.alert(
          status === 'approved' ? 'Leave Approved ✅' : 'Leave Rejected ❌',
          `Leave request has been ${status}.`
        );
        refreshAllData(supabaseClient, userProfile.org_id, userProfile.id);
      } else {
        Alert.alert('Error', error.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    }
  };

  // Resolve Module Access Request
  const handleResolveAccessRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    if (!supabaseClient || !userProfile) return;

    try {
      const { error } = await supabaseClient
        .from('access_requests')
        .update({
          status,
          approver_decision_notes: `${status === 'approved' ? 'Approved' : 'Rejected'} via Mobile App by ${userProfile.first_name} ${userProfile.last_name}`,
          approved_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (!error) {
        Alert.alert('Access Request Updated', `Request has been marked as ${status}.`);
        refreshAllData(supabaseClient, userProfile.org_id, userProfile.id);
      } else {
        Alert.alert('Error', error.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    }
  };

  // Add Organization Holiday (HR / Superadmin / Owner)
  const handleAddHoliday = async () => {
    if (!newHolName.trim() || !newHolDate.trim()) {
      Alert.alert('Required', 'Please enter holiday name and date.');
      return;
    }
    if (!supabaseClient || !currentOrg) return;

    setIsSavingHoliday(true);
    try {
      const newHol = {
        id: `hol-${Date.now()}`,
        name: newHolName.trim(),
        date: newHolDate.trim(),
        type: newHolType,
        description: newHolDesc.trim() || 'Official company holiday',
        isMandatory: true,
        orgId: currentOrg.id
      };

      const curSettings = currentOrg.settings || {};
      const updatedList = [...(curSettings.holidays || holidays), newHol].sort((a, b) => a.date.localeCompare(b.date));

      const { error } = await supabaseClient
        .from('organizations')
        .update({
          settings: {
            ...curSettings,
            holidays: updatedList
          }
        })
        .eq('id', currentOrg.id);

      if (!error) {
        setHolidays(updatedList);
        Alert.alert('Holiday Added 🌴', `${newHolName} (${newHolDate}) added to company calendar.`);
        setIsHolidayModal(false);
        setNewHolName('');
        setNewHolDesc('');
      } else {
        Alert.alert('Error', error.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    } finally {
      setIsSavingHoliday(false);
    }
  };

  // Delete Holiday (HR / Superadmin)
  const handleDeleteHoliday = async (holId: string) => {
    if (!supabaseClient || !currentOrg) return;

    try {
      const curSettings = currentOrg.settings || {};
      const updatedList = (curSettings.holidays || holidays).filter((h: any) => h.id !== holId);

      const { error } = await supabaseClient
        .from('organizations')
        .update({
          settings: {
            ...curSettings,
            holidays: updatedList
          }
        })
        .eq('id', currentOrg.id);

      if (!error) {
        setHolidays(updatedList);
        Alert.alert('Holiday Removed', 'Holiday removed from organization calendar.');
      } else {
        Alert.alert('Error', error.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    }
  };

  // Add Team Member (HR / Superadmin / Owner)
  const handleAddEmployee = async () => {
    if (!newEmpFirst.trim() || !newEmpEmail.trim() || !newEmpDesig.trim()) {
      Alert.alert('Required', 'Please fill in First Name, Email, and Designation.');
      return;
    }
    if (!supabaseClient || !currentOrg) return;

    setIsSavingEmp(true);
    try {
      const newId = generateUUID();
      const { error } = await supabaseClient.from('profiles').insert({
        id: newId,
        org_id: currentOrg.id,
        first_name: newEmpFirst.trim(),
        last_name: newEmpLast.trim() || 'Team',
        email: newEmpEmail.trim().toLowerCase(),
        role: newEmpRole,
        designation: newEmpDesig.trim(),
        department: newEmpDept,
        joining_date: newEmpJoiningDate || getTodayISTDate(),
        manager_id: newEmpManagerId || null,
        is_active: true
      });

      if (!error) {
        Alert.alert('Employee Created 👤', `${newEmpFirst} added with joining date ${newEmpJoiningDate}.`);
        setIsAddEmpModal(false);
        setNewEmpFirst('');
        setNewEmpLast('');
        setNewEmpEmail('');
        setNewEmpDesig('');
        refreshAllData(supabaseClient, currentOrg.id);
      } else {
        Alert.alert('Error', error.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    } finally {
      setIsSavingEmp(false);
    }
  };

  // Update Employee Joining Date (HR / Superadmin)
  const handleUpdateJoiningDate = async () => {
    if (!targetEmpForJoining || !updatedJoiningDateVal.trim()) return;
    if (!supabaseClient) return;

    setIsSavingJoiningDate(true);
    try {
      const { error } = await supabaseClient
        .from('profiles')
        .update({ joining_date: updatedJoiningDateVal.trim() })
        .eq('id', targetEmpForJoining.id);

      if (!error) {
        Alert.alert(
          'Joining Date Updated 📅',
          `Joining date for ${targetEmpForJoining.first_name} set to ${updatedJoiningDateVal.trim()}.`
        );
        setIsEditJoiningModal(false);
        setTargetEmpForJoining(null);
        refreshAllData(supabaseClient, currentOrg?.id);
      } else {
        Alert.alert('Error', error.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    } finally {
      setIsSavingJoiningDate(false);
    }
  };

  // Post Notice / Announcement (HR / Superadmin / Owner)
  const handlePostNotice = async () => {
    if (!newNoticeTitle.trim() || !newNoticeContent.trim()) {
      Alert.alert('Required', 'Please enter notice title and message content.');
      return;
    }
    if (!supabaseClient || !currentOrg) return;

    setIsSubmittingNotice(true);
    try {
      const newId = generateUUID();
      const { error } = await supabaseClient.from('notices').insert({
        id: newId,
        org_id: currentOrg.id,
        title: newNoticeTitle.trim(),
        content: newNoticeContent.trim(),
        priority: newNoticePriority,
        category: newNoticeCategory,
        author_id: userProfile?.id,
        author_name: `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim() || 'HR',
        author_role: userProfile?.role || 'hr',
        date: getTodayISTDate(),
        is_pinned: newNoticePriority === 'critical'
      });

      if (!error) {
        Alert.alert('Notice Published 📢', 'Company announcement broadcasted to all employees.');
        setIsNoticeModal(false);
        setNewNoticeTitle('');
        setNewNoticeContent('');
        refreshAllData(supabaseClient, currentOrg.id);
      } else {
        Alert.alert('Error', error.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    } finally {
      setIsSubmittingNotice(false);
    }
  };

  // Submit EOD Standup
  const handleSubmitStandup = async () => {
    if (!standupDone.trim() || !standupNext.trim()) {
      Alert.alert('Required', 'Please enter completed work and planned priorities.');
      return;
    }
    if (!supabaseClient || !userProfile) return;

    setIsSavingStandup(true);
    try {
      const newId = generateUUID();
      const todayIST = getTodayISTDate();

      let finalCompleted = standupDone.trim();
      if (standupPrLink.trim() && !finalCompleted.includes(standupPrLink.trim())) {
        finalCompleted += `\nPR / Deliverable: ${standupPrLink.trim()}`;
      }

      const orgId = currentOrg?.id || userProfile.org_id;

      // Check if a standup already exists for today
      const { data: existingStandup } = await supabaseClient
        .from('daily_standups')
        .select('id')
        .eq('employee_id', userProfile.id)
        .eq('date', todayIST)
        .maybeSingle();

      // Atomic upsert with fallback
      let { data: savedData, error: opError } = await supabaseClient
        .from('daily_standups')
        .upsert({
          id: existingStandup?.id || newId,
          employee_id: userProfile.id,
          org_id: orgId,
          date: todayIST,
          completed_today: finalCompleted,
          planned_tomorrow: standupNext.trim(),
          blockers: standupBlockers.trim() || null,
          hours_logged: Number(standupHours) || 8
        }, { onConflict: 'employee_id,date' })
        .select();

      // If upsert threw any error, fallback to direct update
      if (opError) {
        console.warn('Upsert failed, falling back to direct update:', opError);
        const { data: updData, error: updErr } = await supabaseClient
          .from('daily_standups')
          .update({
            org_id: orgId,
            completed_today: finalCompleted,
            planned_tomorrow: standupNext.trim(),
            blockers: standupBlockers.trim() || null,
            hours_logged: Number(standupHours) || 8
          })
          .eq('employee_id', userProfile.id)
          .eq('date', todayIST)
          .select();
        if (!updErr && updData && updData.length > 0) {
          opError = null;
          savedData = updData;
        } else if (updErr) {
          opError = updErr;
        }
      }

      if (!opError) {
        const savedRecord = (savedData && savedData[0]) || null;
        const savedId = savedRecord?.id || newId;
        // Optimistic local update
        setStandups((prev) => [
          {
            id: savedId,
            employee_id: userProfile.id,
            org_id: orgId,
            date: todayIST,
            completed_today: finalCompleted,
            planned_tomorrow: standupNext.trim(),
            blockers: standupBlockers.trim() || null,
            hours_logged: Number(standupHours) || 8,
            created_at: savedRecord?.created_at || new Date().toISOString()
          },
          ...prev.filter((s) => !(s.employee_id === userProfile.id && s.date === todayIST))
        ]);

        // Send device notification
        sendDeviceNotification(
          'EOD Standup Saved 🚀',
          `Daily accomplishment log (${standupHours}h) synced with Supabase cloud.`,
          'standup-alerts'
        );

        Alert.alert('EOD Standup Logged 🚀', 'Your daily accomplishment is saved to cloud.');
        setIsStandupModal(false);
        setStandupDone('');
        setStandupNext('');
        setStandupBlockers('');
        setStandupPrLink('');
        refreshAllData(supabaseClient, orgId, userProfile.id);
      } else {
        showUserFriendlyError('Standup Save Failed', opError, 'Could not save your daily standup. Please try again.');
      }
    } catch (e: any) {
      showUserFriendlyError('Standup Error', e, 'Could not submit standup.');
    } finally {
      setIsSavingStandup(false);
    }
  };

  // Export Daily Standups PDF Report (Mobile)
  const handleExportStandupPDFMobile = async (listToExport?: any[]) => {
    const list = listToExport && listToExport.length > 0 ? listToExport : standups;
    if (!list || list.length === 0) {
      Alert.alert('No Standups', 'There are no standup records to export for the current filters.');
      return;
    }

    setIsExportingStandupPdf(true);
    try {
      const orgName = currentOrg?.name || 'Vedotrix Pulse HRMS';
      const orgCode = currentOrg?.orgCode || 'VDX';
      const totalHours = list.reduce((acc: number, s: any) => acc + (Number(s.hours_logged) || 8), 0);
      const blockersCount = list.filter((s: any) => s.blockers && s.blockers.trim()).length;

      const rowsHtml = list.map((st: any) => {
        const emp = teamProfiles.find((p: any) => p.id === st.employee_id);
        const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'Team Member';
        const empDesig = `${emp?.designation || 'Staff'} &bull; ${emp?.department || 'Operations'}`;
        const empEmail = emp?.email || '';

        const hasBlocker = st.blockers && st.blockers.trim().length > 0;
        const isGithubPR = (st.completed_today || '').includes('github.com') || (st.completed_today || '').includes('/pull/');

        return `
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 12px; page-break-inside: avoid; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; margin-bottom: 10px;">
              <div>
                <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${empName}</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${empDesig} &bull; ${empEmail}</div>
              </div>
              <div style="text-align: right;">
                <span style="display: inline-block; background: #e0e7ff; color: #4338ca; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 4px;">${st.date}</span>
                <div style="font-size: 11px; font-weight: 700; color: #0284c7; margin-top: 3px;">${st.hours_logged || 8}h logged</div>
              </div>
            </div>

            <div style="margin-bottom: 8px;">
              <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #059669; letter-spacing: 0.5px; margin-bottom: 2px;">
                &check; Work Completed Today
              </div>
              <div style="font-size: 11.5px; color: #1e293b; line-height: 1.45; white-space: pre-wrap;">${st.completed_today || 'No details logged'}</div>
              ${isGithubPR ? '<div style="margin-top: 5px; display: inline-block; background: #f3e8ff; border: 1px solid #d8b4fe; color: #7e22ce; font-size: 9.5px; font-weight: 700; padding: 2px 7px; border-radius: 4px;">&link; PR Deliverable Linked</div>' : ''}
            </div>

            <div style="margin-bottom: 8px;">
              <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #2563eb; letter-spacing: 0.5px; margin-bottom: 2px;">
                &rarr; Plan for Next Shift
              </div>
              <div style="font-size: 11.5px; color: #334155; line-height: 1.45; white-space: pre-wrap;">${st.planned_tomorrow || 'Continuing ongoing sprint tasks'}</div>
            </div>

            ${hasBlocker ? `
              <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 7px 10px; margin-top: 6px;">
                <div style="font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #be123c;">
                  &excl; Roadblock / Blocker
                </div>
                <div style="font-size: 11px; color: #9f1239; margin-top: 2px;">${st.blockers}</div>
              </div>
            ` : `
              <div style="font-size: 10.5px; color: #94a3b8; font-style: italic;">
                &bull; No roadblocks reported
              </div>
            `}
          </div>
        `;
      }).join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>EOD Standups Report - ${orgName}</title>
          <style>
            @page {
              size: A4;
              margin: 15mm 12mm 15mm 12mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              background-color: #f8fafc;
              color: #0f172a;
              margin: 0;
              padding: 20px;
            }
            .header-bar {
              border-bottom: 3px solid #4f46e5;
              padding-bottom: 14px;
              margin-bottom: 16px;
            }
            .stats-bar {
              display: flex;
              gap: 10px;
              margin-bottom: 16px;
            }
            .stat-card {
              flex: 1;
              background: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 8px 12px;
            }
            .stat-val {
              font-size: 17px;
              font-weight: 800;
              color: #4f46e5;
            }
            .stat-label {
              font-size: 9.5px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
            }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <h1 style="margin: 0; font-size: 18px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">${orgName}</h1>
                <div style="font-size: 11px; color: #64748b; margin-top: 3px;">
                  Official Daily EOD Standup & Work Accomplishment Report &bull; Org Code: ${orgCode}
                </div>
              </div>
              <div style="text-align: right;">
                <span style="background: #4f46e5; color: #ffffff; font-size: 9.5px; font-weight: 800; padding: 3px 8px; border-radius: 12px;">
                  CONFIDENTIAL
                </span>
                <div style="font-size: 9.5px; color: #94a3b8; margin-top: 5px;">
                  Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                </div>
              </div>
            </div>
          </div>

          <div class="stats-bar">
            <div class="stat-card">
              <div class="stat-val">${list.length}</div>
              <div class="stat-label">Total Logs</div>
            </div>
            <div class="stat-card">
              <div class="stat-val" style="color: #0284c7;">${totalHours}h</div>
              <div class="stat-label">Hours Logged</div>
            </div>
            <div class="stat-card">
              <div class="stat-val" style="color: ${blockersCount > 0 ? '#e11d48' : '#10b981'};">${blockersCount}</div>
              <div class="stat-label">Blockers Reported</div>
            </div>
          </div>

          ${rowsHtml}

          <div style="margin-top: 24px; border-top: 1px solid #cbd5e1; padding-top: 10px; text-align: center; font-size: 9.5px; color: #94a3b8;">
            Generated via Vedotrix Pulse HRMS Cloud Platform &bull; Digitally Certified Corporate Record &bull; &copy; ${new Date().getFullYear()} ${orgName}
          </div>
        </body>
        </html>
      `;

      if (SafePrint && SafePrint.printToFileAsync) {
        const file = await SafePrint.printToFileAsync({ html });
        if (SafeSharing && SafeSharing.shareAsync) {
          await SafeSharing.shareAsync(file.uri, {
            UTI: '.pdf',
            mimeType: 'application/pdf',
            dialogTitle: `EOD Standups Report - ${orgName}`
          });
        } else {
          await Share.share({
            title: `EOD Standups - ${orgName}`,
            message: `Official EOD Standups PDF Report generated for ${orgName} (${list.length} logs, ${totalHours}h logged).`,
            url: file.uri
          });
        }
      } else {
        const summary = list.map((st: any) => {
          const emp = teamProfiles.find((p: any) => p.id === st.employee_id);
          return `[${st.date}] ${emp ? `${emp.first_name} ${emp.last_name}` : 'Staff'} (${st.hours_logged}h):\nDone: ${st.completed_today}\nNext: ${st.planned_tomorrow}${st.blockers ? `\nBlocker: ${st.blockers}` : ''}`;
        }).join('\n\n');

        await Share.share({
          title: `EOD Standups - ${orgName}`,
          message: `📊 EOD Standups Report - ${orgName}\nGenerated: ${new Date().toLocaleString()}\n\n${summary}`
        });
      }
    } catch (err: any) {
      console.error('Error generating PDF on mobile:', err);
      Alert.alert('Export Error', err?.message || 'Could not generate PDF.');
    } finally {
      setIsExportingStandupPdf(false);
    }
  };

  // Schedule Meeting
  const handleCreateMeeting = async () => {
    if (!newMeetingTitle.trim()) {
      Alert.alert('Required', 'Please enter meeting title.');
      return;
    }
    if (!supabaseClient || !currentOrg) return;

    setIsSubmittingMeeting(true);
    try {
      const myName = userProfile ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() : 'Host';
      const newId = `mtg-m-${Date.now()}`;

      const { error } = await supabaseClient.from('meetings').insert({
        id: newId,
        org_id: currentOrg.id,
        title: newMeetingTitle.trim(),
        description: newMeetingDesc.trim() || '',
        date: newMeetingDate,
        start_time: newMeetingStartTime,
        end_time: newMeetingEndTime,
        is_online: true,
        meeting_url: newMeetingUrl.trim() || 'https://meet.google.com/new',
        location: 'Google Meet',
        organizer_id: userProfile.id,
        organizer_name: myName,
        department: newMeetingDept,
        status: 'scheduled'
      });

      if (!error) {
        await sendDeviceNotification(
          '📅 Meeting Scheduled | Vedotrix Pulse',
          `"${newMeetingTitle.trim()}" set for ${newMeetingDate} at ${newMeetingStartTime} IST.`,
          'meetings-alerts'
        );

        Alert.alert('Meeting Scheduled ✅', `Meeting created for ${newMeetingDate} at ${newMeetingStartTime} IST.`);
        setIsMeetingModal(false);
        setNewMeetingTitle('');
        setNewMeetingDesc('');
        refreshAllData(supabaseClient, currentOrg.id, userProfile.id);
      } else {
        Alert.alert('Error', error.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    } finally {
      setIsSubmittingMeeting(false);
    }
  };

  // Issue Offer Letter
  const handleCreateOffer = async () => {
    if (!candName.trim() || !candEmail.trim() || !candDesig.trim()) {
      Alert.alert('Required', 'Candidate name, email, and designation are required.');
      return;
    }
    if (!supabaseClient || !currentOrg) return;

    setIsSavingOffer(true);
    const annualCtcNum = Number(candCtc) || 1200000;
    const monthlyTotal = Math.round(annualCtcNum / 12);
    const basicMonthly = Math.round(monthlyTotal * 0.5);
    const hraMonthly = Math.round(monthlyTotal * 0.25);
    const specialAllowance = monthlyTotal - (basicMonthly + hraMonthly);
    const serialNumber = generateOfferSerial(currentOrg.org_code);

    try {
      const { error } = await supabaseClient.from('offer_letters').insert({
        id: generateUUID(),
        org_id: currentOrg.id,
        serial_number: serialNumber,
        candidate_name: candName.trim(),
        candidate_email: candEmail.trim().toLowerCase(),
        candidate_phone: '+91 9876543210',
        designation: candDesig.trim(),
        department: 'Operations',
        annual_ctc: annualCtcNum,
        basic_monthly: basicMonthly,
        hra_monthly: hraMonthly,
        special_allowance: specialAllowance,
        joining_date: getTodayISTDate(),
        status: 'issued',
        verification_token: `vdx_${Date.now()}_token`,
        issued_by: userProfile?.id || 'hr_manager'
      });

      if (!error) {
        Alert.alert('Offer Letter Issued 📜', `Generated Serial: ${serialNumber}`);
        setIsNewOfferModal(false);
        setCandName('');
        setCandEmail('');
        setCandDesig('');
        refreshAllData(supabaseClient, currentOrg.id);
      } else {
        Alert.alert('Error', error.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    } finally {
      setIsSavingOffer(false);
    }
  };

  const handleVerifySerial = () => {
    if (!verifyQuery.trim()) return;
    const clean = verifyQuery.trim().toUpperCase();
    const found = offerLetters.find((o) => o.serial_number?.toUpperCase() === clean);
    setVerifyResult(found || 'NOT_FOUND');
  };

  // Preset Corporate & Executive Avatars (instant 1-tap select over OTA without reinstalling)
  const PRESET_AVATARS = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=200&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200&h=200&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&h=200&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?w=200&h=200&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1586297135537-94bc9ba060aa?w=200&h=200&fit=crop&crop=faces'
  ];

  // Save Avatar URL to Supabase and update user state instantly
  const saveAvatarUrl = async (cdnUrl: string) => {
    if (!supabaseClient || !userProfile) return;
    setIsUploadingPhoto(true);
    try {
      const { error: dbError } = await supabaseClient
        .from('profiles')
        .update({ avatar_url: cdnUrl })
        .eq('id', userProfile.id);

      if (dbError) {
        Alert.alert('Database Sync Error', dbError.message);
        return;
      }

      const updated = { ...userProfile, avatar_url: cdnUrl };
      setUserProfile(updated);
      setEditAvatarUrl(cdnUrl);
      setTeamProfiles((prev) => prev.map((p) => (p.id === userProfile.id ? { ...p, avatar_url: cdnUrl } : p)));
      await AsyncStorage.setItem('@vdx_user_profile', JSON.stringify(updated));

      setIsPhotoPickerModalOpen(false);
      Alert.alert('Profile Picture Updated ✅', 'Your avatar has been updated across the entire system!');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update avatar.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Safe check if native ImagePicker is compiled into running APK
  const checkImagePickerAvailable = (): boolean => {
    if (!SafeImagePicker || !SafeImagePicker.launchImageLibraryAsync) {
      Alert.alert(
        'Device Camera & Gallery 📸',
        'Direct hardware camera/gallery access requires native build f290a159. You can also pick from 16+ instant avatars or paste any image link directly without reinstalling!',
        [
          { text: '✨ Choose Instant Avatar', onPress: () => setIsPhotoPickerModalOpen(true) },
          { text: '📲 Download Native APK', onPress: () => Linking.openURL('https://expo.dev/accounts/sajalandroid/projects/vedotrix-pulse/builds/f290a159-119a-431b-b4ba-54c2838ae997') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return false;
    }
    return true;
  };

  // Upload Profile Photo to Supabase Storage
  const uploadProfilePhoto = async (asset: any) => {
    if (!supabaseClient || !userProfile) return;
    setIsUploadingPhoto(true);
    try {
      if (!asset.base64) {
        Alert.alert('Upload Error', 'Could not process image base64 data.');
        return;
      }

      const filePath = `avatar_${userProfile.id}.jpg`;
      const arrayBuffer = decode(asset.base64);

      // Upload to Supabase Storage bucket 'avatars'
      const { error: uploadError } = await supabaseClient.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) {
        Alert.alert('Upload Issue', uploadError.message);
        return;
      }

      const { data: publicData } = supabaseClient.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const cdnUrl = `${publicData.publicUrl}?t=${Date.now()}`;

      // Update profiles table
      const { error: dbError } = await supabaseClient
        .from('profiles')
        .update({ avatar_url: cdnUrl })
        .eq('id', userProfile.id);

      if (dbError) {
        Alert.alert('Database Sync Error', dbError.message);
        return;
      }

      const updated = { ...userProfile, avatar_url: cdnUrl };
      setUserProfile(updated);
      setEditAvatarUrl(cdnUrl);
      setTeamProfiles((prev) => prev.map((p) => p.id === userProfile.id ? { ...p, avatar_url: cdnUrl } : p));
      await AsyncStorage.setItem('@vdx_user_profile', JSON.stringify(updated));

      setIsPhotoPickerModalOpen(false);
      Alert.alert('Profile Photo Updated ✅', 'Your new profile picture is now live across Vedotrix Pulse!');
    } catch (err: any) {
      Alert.alert('Upload Error', err?.message || 'Failed to upload photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const pickImageFromGallery = async () => {
    if (!checkImagePickerAvailable()) return;
    try {
      const { status } = await SafeImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant photo gallery permission in your device settings.');
        return;
      }
      const result = await SafeImagePicker.launchImageLibraryAsync({
        mediaTypes: SafeImagePicker.MediaTypeOptions?.Images || 'Images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        await uploadProfilePhoto(result.assets[0]);
      }
    } catch (e: any) {
      Alert.alert('Gallery Error', e?.message || 'Could not access gallery.');
    }
  };

  const takePhotoWithCamera = async () => {
    if (!checkImagePickerAvailable()) return;
    try {
      const { status } = await SafeImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant camera permission in your device settings.');
        return;
      }
      const result = await SafeImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        await uploadProfilePhoto(result.assets[0]);
      }
    } catch (e: any) {
      Alert.alert('Camera Error', e?.message || 'Could not access camera.');
    }
  };

  const promptChangeProfilePhoto = () => {
    setIsPhotoPickerModalOpen(true);
  };

  const updateUserPassword = async (targetProfileId: string, newPass: string): Promise<boolean> => {
    if (!newPass || newPass.trim().length < 6) {
      Alert.alert('Too Short', 'Password must be at least 6 characters long.');
      return false;
    }
    if (!supabaseClient) {
      Alert.alert('Error', 'Database connection not initialized.');
      return false;
    }

    try {
      let hash = bcrypt.hashSync(newPass.trim(), 10);
      if (hash.startsWith('$2b$')) {
        hash = '$2a$' + hash.slice(4);
      }

      const { error } = await supabaseClient
        .from('profiles')
        .update({ password_hash: hash })
        .eq('id', targetProfileId);

      if (error) {
        Alert.alert('Password Update Error', error.message);
        return false;
      }

      Alert.alert('Password Updated 🔐', 'Password updated and securely synced with database.');
      return true;
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update password.');
      return false;
    }
  };

  const pickAndSendChatPhoto = async (fromCamera: boolean) => {
    if (!checkImagePickerAvailable()) return;
    if (!supabaseClient || !userProfile || !currentOrg) return;

    try {
      if (fromCamera) {
        const { status } = await SafeImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Please grant camera access in settings.');
          return;
        }
      } else {
        const { status } = await SafeImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Please grant gallery access in settings.');
          return;
        }
      }

      const result = fromCamera
        ? await SafeImagePicker.launchCameraAsync({ quality: 0.7, base64: true })
        : await SafeImagePicker.launchImageLibraryAsync({ mediaTypes: SafeImagePicker.MediaTypeOptions?.Images || 'Images', quality: 0.7, base64: true });

      if (result.canceled || !result.assets || !result.assets[0] || !result.assets[0].base64) {
        return;
      }

      setIsSendingChatPhoto(true);
      const asset = result.assets[0];
      const fileName = `chat_${Date.now()}_${generateUUID().slice(0, 8)}.jpg`;
      const arrayBuffer = decode(asset.base64);

      // Upload to Supabase Storage avatars bucket (publicly readable)
      const { error: uploadErr } = await supabaseClient.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: true });

      if (uploadErr) {
        Alert.alert('Upload Error', uploadErr.message);
        return;
      }

      const { data: pubData } = supabaseClient.storage.from('avatars').getPublicUrl(fileName);
      const cdnUrl = pubData.publicUrl;

      const newMsg = {
        id: generateUUID(),
        org_id: currentOrg.id,
        sender_id: userProfile.id,
        sender_name: `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || 'Team Member',
        sender_role: userProfile.role || 'employee',
        sender_avatar: userProfile.avatar_url || null,
        channel: chatRecipient ? `dm_${chatRecipient.id}` : (activeChanObj?.id || activeChatChannel),
        recipient_id: chatRecipient ? chatRecipient.id : null,
        message: '📷 Photo attached',
        attachments: [
          {
            id: generateUUID(),
            name: fileName,
            url: cdnUrl,
            category: 'image',
            size: 102400
          }
        ],
        reactions: [],
        created_at: new Date().toISOString()
      };

      setChatMessages((prev) => [...prev, newMsg]);

      await supabaseClient.from('chat_messages').insert([newMsg]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not attach image');
    } finally {
      setIsSendingChatPhoto(false);
    }
  };

  // Update Profile
  const handleSaveProfile = async () => {
    if (!supabaseClient || !userProfile) return;

    setIsSavingProfile(true);
    try {
      const updates: any = {};
      if (editPhone.trim()) updates.phone = editPhone.trim();
      if (editAvatarUrl.trim()) updates.avatar_url = editAvatarUrl.trim();

      const { error } = await supabaseClient
        .from('profiles')
        .update(updates)
        .eq('id', userProfile.id);

      if (!error) {
        const updated = { ...userProfile, ...updates };
        setUserProfile(updated);
        setTeamProfiles((prev) => prev.map((p) => p.id === userProfile.id ? { ...p, ...updates } : p));
        await AsyncStorage.setItem('@vdx_user_profile', JSON.stringify(updated));
        Alert.alert('Profile Updated ✅', 'Your contact details and avatar have been saved.');
        setIsEditProfileModal(false);
      } else {
        Alert.alert('Error', error.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Role Checks
  const isSuperadmin = userProfile?.role === 'superadmin';
  const isOwner = userProfile?.role === 'owner';
  const isHR = userProfile?.role === 'hr';
  const isManager = userProfile?.role === 'manager';
  const isPrivileged = isSuperadmin || isOwner || isHR;
  const canApprove = isPrivileged || isManager;

  // STRICTLY identify Vedotrix Root Superadmin (ONLY they can switch organizations)
  const isVedotrixSuperadmin = Boolean(
    isSuperadmin &&
    (userProfile?.org_id === '00000000-0000-0000-0000-000000000001' ||
     userProfile?.email?.toLowerCase() === 'admin@vedotrix.com' ||
     userProfile?.email?.toLowerCase() === 'sajal@vedotrix.com' ||
     userProfile?.email?.toLowerCase() === 'sajalsaxenagola@gmail.com')
  );

  // Authority check for issuing formal Notification Letters
  const canCreateLetterMobile = isPrivileged || isManager || (teamProfiles && teamProfiles.some((p) => p.manager_id === userProfile?.id));

  // Helper to parse letter metadata from Supabase attachment_url JSON string
  const parseLetterMeta = (n: any) => {
    if (!n) return null;
    if (n.attachment_url && typeof n.attachment_url === 'string' && n.attachment_url.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(n.attachment_url);
        if (parsed && typeof parsed === 'object' && (parsed.isLetter || parsed.refNumber)) {
          return parsed;
        }
      } catch {}
    }
    return null;
  };

  // Split notices into Broadcast Circulars vs Formal Notification Letters
  const { circularNotices, letterNotices } = useMemo(() => {
    const circulars: any[] = [];
    const letters: any[] = [];

    notices.forEach((n: any) => {
      const meta = parseLetterMeta(n);
      if (meta) {
        const isTargetedToMe =
          meta.recipientType === 'all' ||
          meta.recipientId === userProfile?.id ||
          isPrivileged ||
          isManager ||
          n.author_id === userProfile?.id ||
          (teamProfiles && teamProfiles.some((p) => p.manager_id === userProfile?.id && p.id === meta.recipientId));

        if (isTargetedToMe) {
          letters.push({ ...n, letterMeta: meta });
        }
      } else {
        circulars.push(n);
      }
    });

    return { circularNotices: circulars, letterNotices: letters };
  }, [notices, userProfile?.id, isPrivileged, isManager, teamProfiles]);

  const filteredLetterNotices = useMemo(() => {
    return letterNotices.filter((l) => {
      if (letterTypeFilter === 'all') return true;
      const meta = l.letterMeta || parseLetterMeta(l) || {};
      return meta.letterType === letterTypeFilter || l.category === letterTypeFilter;
    });
  }, [letterNotices, letterTypeFilter]);

  // Standard corporate letter templates (Mobile)
  const getStandardLetterTemplate = (type: string, emp?: any) => {
    const orgName = currentOrg?.name || 'Vedotrix Technologies';
    const targetName = emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() : '[Employee Name]';
    const targetDesig = emp?.designation || '[Designation]';
    const targetDept = emp?.department || '[Department]';
    const todayStr = formatDisplayDate(getTodayISTDate());

    if (type === 'warning') {
      return {
        subject: `Formal Notice Regarding Attendance & Work Adherence - ${targetName}`,
        body: `Dear ${targetName},\n\nThis official notification letter is being issued to draw your immediate attention to repeated irregularities observed regarding attendance, scheduled shift adherence, or workplace guidelines over the recent period.\n\nAs an organization, ${orgName} holds high standards of punctuality, professionalism, and accountability. Repeated unplanned absences or unregularized check-ins cause substantial disruptions to team delivery milestones.\n\nYou are hereby advised to submit a formal clarification regarding the observed irregularities to the HR / Reporting Manager within 48 hours of receipt of this communication. Please treat this communication as a formal warning.\n\nContinued failure to meet the required work standards may lead to further administrative action in accordance with company policy. We trust that you will take this communication constructively and realign your workplace performance immediately.`
      };
    } else if (type === 'appreciation') {
      return {
        subject: `Letter of Commendation & Recognition - ${targetName}`,
        body: `Dear ${targetName},\n\nOn behalf of the leadership and management team at ${orgName}, it gives us immense pleasure to present this official Letter of Appreciation in recognition of your exceptional performance, dedication, and exemplary contributions to our organization.\n\nYour work ethic, problem-solving mindset, and dedication during recent deliverables have set a benchmark of excellence for the entire team. Your initiative has played a key role in driving high-impact results for the organization.\n\nWe deeply value your commitment, creativity, and enthusiasm. Thank you for your continued dedication, and we look forward to achieving many more milestones together in the future.\n\nKeep up the outstanding work!`
      };
    } else if (type === 'experience') {
      return {
        subject: `Experience Certificate & Relieving Order - ${targetName}`,
        body: `TO WHOMSOEVER IT MAY CONCERN\n\nThis is to certify that ${targetName} was employed with ${orgName} as a ${targetDesig} in the ${targetDept} department from ${emp?.joining_date ? formatDisplayDate(emp.joining_date) : '[Joining Date]'} to ${todayStr}.\n\nDuring their tenure with us, ${targetName} was found to be hardworking, disciplined, and dedicated to assigned responsibilities. They consistently demonstrated strong professional ethics and teamwork.\n\nAll organizational assets, documentation, and operational responsibilities have been duly handed over in accordance with company clearance protocols. ${targetName} is relieved from their duties with effect from the close of business hours on ${todayStr}.\n\nWe thank them for their valuable contributions to ${orgName} and wish them the very best in all their future personal and professional endeavors.`
      };
    } else if (type === 'directive') {
      return {
        subject: `Executive Policy Directive & Compliance Order`,
        body: `Dear Team Members,\n\nThis executive notification letter sets forth official operational directives and statutory compliance protocols effective immediately across all departments at ${orgName}.\n\n1. Attendance & Shift Regularity: All team members are required to log their daily check-in through the official HRMS portal within the designated grace period.\n2. Leave Application Protocol: Planned leaves must be applied at least 48 hours in advance and approved by the respective Reporting Manager.\n3. Confidentiality & Intellectual Property: All proprietary codebase, customer information, and trade secrets remain strictly confidential in accordance with non-disclosure obligations.\n\nAll Department Heads and Team Managers are instructed to ensure strict compliance with this directive across their teams.`
      };
    } else {
      return {
        subject: `Official Corporate Notice & Executive Order`,
        body: `Dear All Employees / Team Members,\n\nThis official notification is issued to communicate important organizational announcements and operational updates regarding company operations at ${orgName}.\n\nPlease review the attached guidelines thoroughly and contact HR or your Department Lead for any necessary clarifications.\n\nWe appreciate your ongoing dedication and cooperation.`
      };
    }
  };

  const handleOpenCreateLetterMobile = () => {
    const nextRef = `REF: ${currentOrg?.orgCode || 'ORG'}/NL/${new Date().getFullYear()}/${String(letterNotices.length + 1).padStart(3, '0')}`;
    setLetterRefNumber(nextRef);
    setLetterType('warning');
    setLetterRecipientType('individual');
    const firstEmp = teamProfiles[0];
    setLetterRecipientId(firstEmp?.id || '');

    const tpl = getStandardLetterTemplate('warning', firstEmp);
    setLetterSubject(tpl.subject);
    setLetterContent(tpl.body);

    setLetterSignatoryName(`${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim());
    setLetterSignatoryRole(userProfile?.designation || userProfile?.role?.toUpperCase() || 'Authorized Signatory');
    setLetterIsDigitallyStamped(true);
    setIsCreateLetterModal(true);
  };

  const handleCreateLetterMobile = async () => {
    if (!letterSubject.trim() || !letterContent.trim() || !letterRefNumber.trim()) {
      Alert.alert('Required', 'Please fill in Reference Number, Subject, and Letter Content.');
      return;
    }
    if (!supabaseClient || !currentOrg) return;

    setIsSubmittingLetter(true);
    try {
      const newId = generateUUID();
      const targetEmp = letterRecipientType === 'individual' ? teamProfiles.find((p) => p.id === letterRecipientId) : null;
      const recipientName = targetEmp ? `${targetEmp.first_name || ''} ${targetEmp.last_name || ''}`.trim() : 'All Employees';
      const recipientDesig = targetEmp?.designation || '';
      const recipientDept = targetEmp?.department || '';
      const recipientEmail = targetEmp?.email || '';

      const authorName = `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim() || 'HR';
      const signName = letterSignatoryName.trim() || authorName;
      const signRole = letterSignatoryRole.trim() || userProfile?.role?.toUpperCase() || 'Authorized Signatory';

      const letterPayload = {
        isLetter: true,
        letterType,
        refNumber: letterRefNumber.trim(),
        recipientType: letterRecipientType,
        recipientId: targetEmp ? targetEmp.id : 'all',
        recipientName,
        recipientDesig,
        recipientDept,
        recipientEmail,
        signatoryName: signName,
        signatoryRole: signRole,
        isDigitallyStamped: letterIsDigitallyStamped,
        stampDate: new Date().toISOString()
      };

      const { error } = await supabaseClient.from('notices').insert({
        id: newId,
        org_id: currentOrg.id,
        title: letterSubject.trim(),
        content: letterContent.trim(),
        priority: letterType === 'warning' ? 'high' : 'medium',
        category: letterType === 'directive' ? 'directive' : letterType === 'warning' ? 'warning' : letterType === 'appreciation' ? 'appreciation' : letterType === 'experience' ? 'experience' : 'notice',
        author_id: userProfile?.id,
        author_name: authorName,
        author_role: userProfile?.role || 'hr',
        date: getTodayISTDate(),
        attachment_url: JSON.stringify(letterPayload),
        is_pinned: false
      });

      if (!error) {
        Alert.alert('Letter Issued & Stamped 📜', `Official letter ${letterRefNumber} published with digital seal.`);
        setIsCreateLetterModal(false);
        setLetterSubject('');
        setLetterContent('');
        refreshAllData(supabaseClient, currentOrg.id);
      } else {
        Alert.alert('Error', error.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    } finally {
      setIsSubmittingLetter(false);
    }
  };

  const handleExportLetterPDFMobile = async (letter: any) => {
    if (!letter) return;
    setIsExportingLetterPdf(true);
    try {
      const meta = letter.letterMeta || parseLetterMeta(letter) || {};
      const orgName = currentOrg?.name || 'Vedotrix Pulse HRMS';
      const orgCode = currentOrg?.orgCode || 'VDX';
      const orgAddress = currentOrg?.address || '';
      const orgPhone = currentOrg?.phone || '';
      const orgWebsite = currentOrg?.website || '';
      const orgLogoUrl = currentOrg?.logoUrl || currentOrg?.logo_url || '';

      const refNum = meta.refNumber || letter.ref_number || `REF: ${orgCode}/NL/2026/001`;
      const issueDate = formatDisplayDate(letter.date || letter.created_at);
      const recipientName = meta.recipientName || (meta.recipientType === 'all' ? 'All Staff Members & Employees' : 'Employee');
      const recipientDesig = meta.recipientDesig ? `${meta.recipientDesig}${meta.recipientDept ? ` &bull; ${meta.recipientDept}` : ''}` : '';
      const recipientEmail = meta.recipientEmail || '';
      const signName = meta.signatoryName || letter.author_name || `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim() || 'HR Department';
      const signRole = meta.signatoryRole || letter.author_role?.toUpperCase() || 'Authorized Signatory';

      let stampColor = '#1d4ed8'; // blue
      if (meta.letterType === 'warning') stampColor = '#b91c1c'; // red
      else if (meta.letterType === 'appreciation') stampColor = '#047857'; // emerald
      else if (meta.letterType === 'experience') stampColor = '#6d28d9'; // violet

      const isStamped = meta.isDigitallyStamped !== false;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>${letter.title}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 16mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 16px;
              line-height: 1.6;
              font-size: 13px;
              background: #fff;
              position: relative;
            }
            .watermark {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 270px;
              height: 270px;
              opacity: 0.055;
              z-index: 0;
              pointer-events: none;
              object-fit: contain;
            }
            .header-bar {
              height: 6px;
              background: #1e293b;
              margin: -16px -16px 14px -16px;
            }
            .sub-bar {
              height: 3px;
              background: #2563eb;
              margin: -14px -16px 16px -16px;
            }
            .top-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 12px;
              margin-bottom: 12px;
              position: relative;
              z-index: 1;
            }
            .company-name {
              font-size: 18px;
              font-weight: 900;
              color: #0f172a;
              letter-spacing: -0.5px;
            }
            .company-sub {
              font-size: 10.5px;
              color: #64748b;
              margin-top: 2px;
            }
            .company-contact {
              text-align: right;
              font-size: 9.5px;
              color: #475569;
              line-height: 1.4;
              max-width: 220px;
            }
            .ref-strip {
              display: flex;
              justify-content: space-between;
              align-items: center;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 7px 12px;
              margin: 12px 0;
              font-size: 10.5px;
              position: relative;
              z-index: 1;
            }
            .ref-num {
              font-weight: 800;
              font-family: monospace;
              color: #1e293b;
            }
            .ref-date {
              color: #64748b;
              font-weight: 600;
            }
            .to-block {
              margin: 14px 0;
              font-size: 11.5px;
              position: relative;
              z-index: 1;
            }
            .to-label {
              font-size: 9.5px;
              font-weight: 800;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 3px;
            }
            .to-name {
              font-size: 13px;
              font-weight: 800;
              color: #0f172a;
            }
            .to-desig {
              color: #475569;
              font-size: 11px;
            }
            .subject-box {
              background: #f1f5f9;
              border-left: 4px solid #4f46e5;
              border: 1px solid #e2e8f0;
              border-left-width: 4px;
              border-left-color: #4f46e5;
              padding: 9px 12px;
              border-radius: 4px;
              margin: 14px 0;
              font-weight: 800;
              font-size: 11.5px;
              color: #0f172a;
              text-transform: uppercase;
              word-wrap: break-word;
              overflow-wrap: break-word;
              word-break: break-word;
              white-space: normal;
              line-height: 1.5;
              position: relative;
              z-index: 1;
            }
            .letter-content {
              font-size: 11.5px;
              color: #334155;
              line-height: 1.7;
              white-space: pre-wrap;
              margin: 16px 0 24px 0;
              text-align: justify;
              text-justify: inter-word;
              word-wrap: break-word;
              overflow-wrap: break-word;
              position: relative;
              z-index: 1;
            }
            .closing-row {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              margin-top: 28px;
              padding-top: 16px;
              border-top: 1px solid #f1f5f9;
              page-break-inside: avoid;
              position: relative;
              z-index: 1;
            }
            .sign-label {
              font-size: 10.5px;
              color: #64748b;
              margin-bottom: 6px;
            }
            .signature-font {
              font-family: 'Georgia', serif;
              font-style: italic;
              font-size: 17px;
              font-weight: bold;
              color: #1e3a8a;
              margin-bottom: 4px;
            }
            .sign-name {
              font-size: 12.5px;
              font-weight: 800;
              color: #0f172a;
            }
            .sign-role {
              font-size: 10.5px;
              color: #475569;
            }
            .stamp-seal {
              width: 102px;
              height: 102px;
              border-radius: 50%;
              border: 2px solid ${stampColor};
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              transform: rotate(-6deg);
              background: rgba(239, 246, 255, 0.45);
              color: ${stampColor};
              box-sizing: border-box;
              padding: 3px;
              box-shadow: inset 0 0 0 1px ${stampColor};
            }
            .stamp-inner {
              width: 88px;
              height: 88px;
              border-radius: 50%;
              border: 1px dashed ${stampColor};
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              box-sizing: border-box;
              padding: 2px;
            }
            .stamp-org {
              font-size: 6px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            .stamp-verified {
              font-size: 7px;
              font-weight: 900;
              margin: 2px 0;
              letter-spacing: 0.5px;
            }
            .stamp-ref {
              font-size: 5.5px;
              font-family: monospace;
              font-weight: bold;
            }
            .footer-legal {
              margin-top: 30px;
              padding-top: 8px;
              border-top: 1px solid #e2e8f0;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 8px;
              color: #94a3b8;
              page-break-inside: avoid;
              position: relative;
              z-index: 1;
            }
          </style>
        </head>
        <body>
          ${orgLogoUrl ? `<img src="${orgLogoUrl}" class="watermark" alt="" />` : `
            <div class="watermark" style="border: 3px solid #94a3b8; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; font-size: 24px; font-weight: 900; color: #94a3b8;">
              ${orgCode}<br><span style="font-size: 11px; font-weight: normal; margin-top: 4px;">OFFICIAL SEAL</span>
            </div>
          `}

          <div class="header-bar"></div>
          <div class="sub-bar"></div>

          <div class="top-header">
            <div style="display: flex; align-items: center; gap: 10px;">
              ${orgLogoUrl ? `<img src="${orgLogoUrl}" style="width: 42px; height: 42px; object-fit: contain; border-radius: 6px;" />` : ''}
              <div>
                <div class="company-name">${orgName.toUpperCase()}</div>
                <div class="company-sub">Org Code: <b>${orgCode}</b> &bull; Corporate Enterprise</div>
              </div>
            </div>
            <div class="company-contact">
              ${orgWebsite ? `<div>${orgWebsite}</div>` : ''}
              ${orgPhone ? `<div>Tel: ${orgPhone}</div>` : ''}
              ${orgAddress ? `<div>${orgAddress}</div>` : ''}
            </div>
          </div>

          <div class="ref-strip">
            <div class="ref-num">REF NO: ${refNum}</div>
            <div class="ref-date">DATE: ${issueDate}</div>
          </div>

          <div class="to-block">
            <div class="to-label">To:</div>
            <div class="to-name">${recipientName}</div>
            ${recipientDesig ? `<div class="to-desig">${recipientDesig}</div>` : ''}
            ${recipientEmail ? `<div class="to-desig">${recipientEmail}</div>` : ''}
            <div class="to-desig">${orgName}</div>
          </div>

          <div class="subject-box">
            SUBJECT: ${letter.title}
          </div>

          <div class="letter-content">
${letter.content}
          </div>

          <div class="closing-row">
            <div>
              <div class="sign-label">Yours faithfully / Sincerely,</div>
              <div class="signature-font">${signName}</div>
              <div class="sign-name">${signName}</div>
              <div class="sign-role">${signRole} &bull; ${orgName}</div>
            </div>

            ${isStamped ? `
              <div class="stamp-seal">
                <div class="stamp-inner">
                  <div class="stamp-org">&starf; ${orgCode} SEAL &starf;</div>
                  <div class="stamp-verified">DIGITALLY VERIFIED</div>
                  <div class="stamp-ref">${refNum.slice(-6)}</div>
                  <div style="font-size: 5px; opacity: 0.8; margin-top: 1px;">PULSE HRMS</div>
                </div>
              </div>
            ` : ''}
          </div>

          <div class="footer-legal">
            <div>This is an official computer-generated corporate document authenticated by Vedotrix Pulse HRMS. Digitally stamped & verified.</div>
            <div style="font-weight: bold; white-space: nowrap; margin-left: 8px;">${orgCode} &bull; Page 1 of 1</div>
          </div>
        </body>
        </html>
      `;

      if (SafePrint && SafePrint.printToFileAsync) {
        const file = await SafePrint.printToFileAsync({ html });
        if (SafeSharing && SafeSharing.shareAsync) {
          await SafeSharing.shareAsync(file.uri, {
            UTI: '.pdf',
            mimeType: 'application/pdf',
            dialogTitle: `${refNum} - ${letter.title}`
          });
        } else {
          await Share.share({
            title: `${refNum} - ${letter.title}`,
            message: `Official Letter ${refNum}: ${letter.title} (${orgName}).`
          });
        }
      } else {
        await Share.share({
          title: `${refNum} - ${letter.title}`,
          message: `Official Corporate Letter\nRef: ${refNum}\nSubject: ${letter.title}\n\n${letter.content}\n\nSigned by ${signName} (${signRole})`
        });
      }
    } catch (e: any) {
      console.log('Letter PDF generation error:', e);
      Alert.alert('PDF Export Error', e?.message || 'Could not generate letterhead PDF.');
    } finally {
      setIsExportingLetterPdf(false);
    }
  };

  // Official Attendance Report PDF Engine (Daily / Weekly / Monthly for HR / Superadmin / Manager)
  const handleExportAttendanceReportPDF = async () => {
    const isManagerRole = isManager || (teamProfiles && teamProfiles.some((p) => p.manager_id === userProfile?.id));
    if (!isPrivileged && !isManagerRole) {
      Alert.alert('Permission Denied', 'Attendance PDF generation is restricted to Managers and HR/Superadmins.');
      return;
    }

    const myManagedEmployees = isPrivileged
      ? teamProfiles.filter((p) => p.is_active !== false)
      : teamProfiles.filter((p) => p.is_active !== false && p.manager_id === userProfile?.id);

    if (myManagedEmployees.length === 0) {
      Alert.alert('No Employees Found', 'No managed employee records found to generate attendance report.');
      return;
    }

    setIsExportingAttReport(true);
    try {
      const orgName = currentOrg?.name || 'VEDOTRIX PULSE HRMS';
      const orgCode = currentOrg?.code || 'VDTX';
      const logoUrl = currentOrg?.logo_url || currentOrg?.logoUrl || '';
      const nowISTString = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
      const signName = `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim() || 'HR Department';
      const signRole = (userProfile?.role || 'MANAGER').toUpperCase();
      const scopeDesc = isPrivileged ? `Organization Directory (${myManagedEmployees.length} Staff)` : `Direct Managed Team (${myManagedEmployees.length} Staff)`;

      let reportTitle = '';
      let kpiSummaryHtml = '';
      let tableHeaderHtml = '';
      let tableRowsHtml = '';

      if (attReportType === 'daily') {
        reportTitle = `DAILY ATTENDANCE & SHIFT VERIFICATION REPORT &bull; ${formatDisplayDate(attReportDate)}`;
        let pCount = 0;
        let rCount = 0;
        let aCount = 0;
        let lCount = 0;
        let pendingCount = 0;
        let totalHoursLogged = 0;

        tableHeaderHtml = `
          <tr>
            <th style="width: 28px; text-align: center;">#</th>
            <th>Employee Name & Code</th>
            <th>Department & Role</th>
            <th style="width: 110px; text-align: center;">Status</th>
            <th style="width: 65px; text-align: center;">Check-In</th>
            <th style="width: 65px; text-align: center;">Check-Out</th>
            <th style="width: 50px; text-align: center;">Hours</th>
            <th>Location</th>
            <th>Approver / Remarks</th>
          </tr>
        `;

        const rows = myManagedEmployees.map((emp, idx) => {
          const punch = attendanceRecords.find((a) => a.employee_id === emp.id && a.date === attReportDate);
          const leave = leaveRequests.find((l) => l.employee_id === emp.id && (l.status === 'approved' || l.status === 'pending') && l.start_date <= attReportDate && l.end_date >= attReportDate);
          const isBeforeJoining = emp.joining_date && attReportDate < emp.joining_date;

          const customOverride = currentOrg?.settings?.customDayOverrides?.[attReportDate]
            || currentOrg?.settings?.customDayOverrides?.[`${attReportDate}_${emp.id}`]
            || currentOrg?.settings?.customDayOverrides?.[`${emp.id}_${attReportDate}`];
          const isOverrideWorking = customOverride?.type === 'working';
          const isOverrideWeekOff = customOverride?.type === 'week_off';
          const isOverrideHol = customOverride?.type === 'holiday';

          const [rY, rM, rD] = attReportDate.split('-').map(Number);
          const dayOfWeek = new Date(rY, rM - 1, rD).getDay();
          const empWeekOffs: number[] = currentOrg?.settings?.employeeWeekOffs?.[emp.id] || currentOrg?.settings?.weekOffDays || [0];
          const isWeeklyOff = empWeekOffs.includes(dayOfWeek);
          const isEffectiveWeekOff = (isWeeklyOff || isOverrideWeekOff) && !isOverrideWorking;
          const matchingHol = holidays.find((h) => h.date === attReportDate);
          const isEffectiveHol = (matchingHol || isOverrideHol) && !isOverrideWorking;

          const isRejected = punch?.regularization_status === 'rejected' || punch?.approval_status === 'rejected';
          const isPending = !isRejected && (punch?.regularization_status === 'pending' || punch?.approval_status === 'pending_manager_approval' || punch?.status === 'pending');
          const isApproved = !isRejected && !isPending && (punch?.regularization_status === 'approved' || punch?.approval_status === 'approved');

          let statusBadge = '';
          let cinStr = '&mdash;';
          let coutStr = '&mdash;';
          let hours = 0;
          let notes = '&mdash;';

          if (isBeforeJoining) {
            statusBadge = '<span class="badge badge-gray">PRE-JOINING</span>';
          } else if (isEffectiveHol) {
            statusBadge = `<span class="badge badge-amber">HOLIDAY (${matchingHol?.name || customOverride?.name || 'Declared'})</span>`;
          } else if (isEffectiveWeekOff) {
            statusBadge = '<span class="badge badge-gray">WEEK-OFF</span>';
          } else if (leave) {
            lCount++;
            statusBadge = `<span class="badge badge-blue">LEAVE (${String(leave.leave_type || 'Leave').toUpperCase()})</span>`;
          } else if (isRejected) {
            aCount++;
            statusBadge = '<span class="badge badge-rose">REJECTED &bull; ABSENT</span>';
            const approver = punch?.approved_by ? teamProfiles.find((p) => p.id === punch.approved_by) : null;
            notes = `Rej by ${approver?.first_name || 'Manager'}${punch?.approval_notes ? `: ${punch.approval_notes}` : ''}`;
          } else if (isPending) {
            pendingCount++;
            statusBadge = '<span class="badge badge-amber">PENDING APPROVAL</span>';
            notes = punch?.regularization_reason ? `Req: ${punch.regularization_reason}` : 'Pending Review';
          } else if (isApproved) {
            if (punch?.status === 'regularized' || !punch?.check_in_time) {
              rCount++;
              statusBadge = '<span class="badge badge-cyan">REGULARIZED &#9733;</span>';
            } else {
              pCount++;
              statusBadge = '<span class="badge badge-green">PRESENT &#10003;</span>';
            }
            hours = punch?.total_hours || 8;
            totalHoursLogged += hours;
            const approver = (punch?.approved_by || punch?.regularized_by) ? teamProfiles.find((p) => p.id === (punch.approved_by || punch.regularized_by)) : null;
            notes = `Approved by ${approver?.first_name || 'Manager'}${punch?.approval_notes ? `: ${punch.approval_notes}` : ''}`;
          } else if (punch?.status === 'present' && punch?.approval_status !== 'pending_manager_approval') {
            pCount++;
            hours = punch?.total_hours || 8;
            totalHoursLogged += hours;
            statusBadge = '<span class="badge badge-green">PRESENT &#10003;</span>';
            notes = punch.is_remote ? 'Remote (WFH)' : 'Office Biometric';
          } else {
            aCount++;
            statusBadge = '<span class="badge badge-rose">ABSENT</span>';
            notes = 'Unmarked Shift';
          }

          if (punch?.check_in_time) {
            try {
              cinStr = new Date(punch.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
            } catch {}
          }
          if (punch?.check_out_time) {
            try {
              coutStr = new Date(punch.check_out_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
            } catch {}
          }

          const locStr = punch?.office_address || (punch?.is_remote ? 'Remote / Field' : 'HQ Office');

          return `
            <tr>
              <td style="text-align: center; color: #64748b; font-weight: bold;">${idx + 1}</td>
              <td>
                <div style="font-weight: 700; color: #0f172a;">${emp.first_name} ${emp.last_name}</div>
                <div style="font-size: 8px; color: #64748b;">${emp.employee_code || emp.id.slice(0, 6)}</div>
              </td>
              <td>
                <div style="color: #334155; font-weight: 600;">${emp.designation || 'Staff'}</div>
                <div style="font-size: 8px; color: #64748b;">${emp.department || 'Operations'}</div>
              </td>
              <td style="text-align: center;">${statusBadge}</td>
              <td style="text-align: center; font-family: monospace;">${cinStr}</td>
              <td style="text-align: center; font-family: monospace;">${coutStr}</td>
              <td style="text-align: center; font-weight: bold;">${hours}h</td>
              <td style="font-size: 8.5px; color: #475569;">${locStr}</td>
              <td style="font-size: 8.5px; color: #475569;">${notes}</td>
            </tr>
          `;
        });
        tableRowsHtml = rows.join('');

        const workingCount = pCount + rCount + aCount + pendingCount;
        const totalEffectivePresent = pCount + rCount + lCount * 0.5;
        const presencePct = workingCount > 0 ? Math.min(100, Math.round((totalEffectivePresent / workingCount) * 100)) : 100;

        kpiSummaryHtml = `
          <div class="kpi-grid">
            <div class="kpi-box"><div class="kpi-val">${myManagedEmployees.length}</div><div class="kpi-lbl">Total Team</div></div>
            <div class="kpi-box"><div class="kpi-val" style="color: #059669;">${pCount}</div><div class="kpi-lbl">Verified Present</div></div>
            <div class="kpi-box"><div class="kpi-val" style="color: #0284c7;">${rCount}</div><div class="kpi-lbl">Regularized</div></div>
            <div class="kpi-box"><div class="kpi-val" style="color: #d97706;">${pendingCount}</div><div class="kpi-lbl">Pending Review</div></div>
            <div class="kpi-box"><div class="kpi-val" style="color: #e11d48;">${aCount}</div><div class="kpi-lbl">Absent</div></div>
            <div class="kpi-box"><div class="kpi-val" style="color: #4f46e5;">${lCount}</div><div class="kpi-lbl">Leaves</div></div>
            <div class="kpi-box"><div class="kpi-val">${totalHoursLogged}h</div><div class="kpi-lbl">Hours Logged</div></div>
            <div class="kpi-box"><div class="kpi-val" style="color: ${presencePct >= 85 ? '#059669' : '#e11d48'};">${presencePct}%</div><div class="kpi-lbl">Presence %</div></div>
          </div>
        `;
      } else if (attReportType === 'weekly') {
        const dates: string[] = [];
        const baseDate = new Date(attReportDate);
        for (let i = 6; i >= 0; i--) {
          const d = new Date(baseDate);
          d.setDate(d.getDate() - i);
          dates.push(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
        }

        reportTitle = `WEEKLY ATTENDANCE REGISTER & WORK HOURS AUDIT &bull; ${formatDisplayDate(dates[0])} to ${formatDisplayDate(dates[6])}`;

        const dateHeaderCols = dates.map((d) => {
          const dateObj = new Date(d);
          const dayShort = dateObj.toLocaleDateString('en-IN', { weekday: 'short' });
          const parts = d.split('-');
          return `<th style="text-align: center; width: 48px;">${dayShort}<br/><span style="font-size: 7.5px; opacity: 0.8;">${parts[2]}/${parts[1]}</span></th>`;
        }).join('');

        tableHeaderHtml = `
          <tr>
            <th style="width: 28px; text-align: center;">#</th>
            <th>Employee Name</th>
            <th>Department</th>
            ${dateHeaderCols}
            <th style="width: 50px; text-align: center;">Present</th>
            <th style="width: 50px; text-align: center;">Absent</th>
            <th style="width: 50px; text-align: center;">Hours</th>
            <th style="width: 60px; text-align: center;">Presence %</th>
          </tr>
        `;

        let totalPresentShifts = 0;
        let totalRegularizedShifts = 0;
        let totalAbsentShifts = 0;
        let grandTotalHours = 0;

        const rows = myManagedEmployees.map((emp, idx) => {
          let empPresent = 0;
          let empReg = 0;
          let empAbsent = 0;
          let empLeave = 0;
          let empHours = 0;

          const dayCols = dates.map((dStr) => {
            const punch = attendanceRecords.find((a) => a.employee_id === emp.id && a.date === dStr);
            const leave = leaveRequests.find((l) => l.employee_id === emp.id && (l.status === 'approved' || l.status === 'pending') && l.start_date <= dStr && l.end_date >= dStr);
            const isBeforeJoining = emp.joining_date && dStr < emp.joining_date;

            const [y, m, d] = dStr.split('-').map(Number);
            const dow = new Date(y, m - 1, d).getDay();
            const empWeekOffs: number[] = currentOrg?.settings?.employeeWeekOffs?.[emp.id] || currentOrg?.settings?.weekOffDays || [0];
            const isWeekOff = empWeekOffs.includes(dow);
            const isHol = holidays.some((h) => h.date === dStr);

            const isRejected = punch?.regularization_status === 'rejected' || punch?.approval_status === 'rejected';
            const isPending = !isRejected && (punch?.regularization_status === 'pending' || punch?.approval_status === 'pending_manager_approval' || punch?.status === 'pending');
            const isApproved = !isRejected && !isPending && (punch?.regularization_status === 'approved' || punch?.approval_status === 'approved');

            if (isBeforeJoining) return '<td style="text-align: center; color: #94a3b8;">&mdash;</td>';
            if (isHol) return '<td style="text-align: center; color: #d97706; font-weight: bold; background: #fffbeb;">HOL</td>';
            if (isWeekOff) return '<td style="text-align: center; color: #64748b; background: #f8fafc;">WO</td>';
            if (leave) {
              empLeave++;
              return '<td style="text-align: center; color: #2563eb; font-weight: bold; background: #eff6ff;">LEAVE</td>';
            }
            if (isRejected) {
              empAbsent++;
              return '<td style="text-align: center; color: #e11d48; font-weight: bold; background: #fff1f2;">REJ</td>';
            }
            if (isPending) {
              return '<td style="text-align: center; color: #d97706; font-weight: bold; background: #fffbeb;">PEND</td>';
            }
            if (isApproved) {
              const h = punch?.total_hours || 8;
              empHours += h;
              if (punch?.status === 'regularized' || !punch?.check_in_time) {
                empReg++;
                return `<td style="text-align: center; color: #0284c7; font-weight: bold; background: #f0f9ff;">REG<br/><span style="font-size: 7.5px;">(${h}h)</span></td>`;
              } else {
                empPresent++;
                return `<td style="text-align: center; color: #059669; font-weight: bold; background: #f0fdf4;">P<br/><span style="font-size: 7.5px;">(${h}h)</span></td>`;
              }
            }
            if (punch?.status === 'present' && punch?.approval_status !== 'pending_manager_approval') {
              const h = punch?.total_hours || 8;
              empHours += h;
              empPresent++;
              return `<td style="text-align: center; color: #059669; font-weight: bold; background: #f0fdf4;">P<br/><span style="font-size: 7.5px;">(${h}h)</span></td>`;
            }
            if (dStr <= getTodayISTDate()) {
              empAbsent++;
              return '<td style="text-align: center; color: #e11d48; font-weight: bold; background: #fff1f2;">ABS</td>';
            }
            return '<td style="text-align: center; color: #94a3b8;">&mdash;</td>';
          }).join('');

          totalPresentShifts += empPresent;
          totalRegularizedShifts += empReg;
          totalAbsentShifts += empAbsent;
          grandTotalHours += empHours;

          const totalWorkDays = empPresent + empReg + empAbsent;
          const presenceRate = totalWorkDays > 0 ? Math.round(((empPresent + empReg) / totalWorkDays) * 100) : 100;

          return `
            <tr>
              <td style="text-align: center; color: #64748b; font-weight: bold;">${idx + 1}</td>
              <td style="font-weight: 700; color: #0f172a;">${emp.first_name} ${emp.last_name}</td>
              <td style="color: #475569;">${emp.department || 'Operations'}</td>
              ${dayCols}
              <td style="text-align: center; font-weight: bold; color: #059669;">${empPresent + empReg}</td>
              <td style="text-align: center; font-weight: bold; color: #e11d48;">${empAbsent}</td>
              <td style="text-align: center; font-weight: bold;">${empHours}h</td>
              <td style="text-align: center; font-weight: bold; color: ${presenceRate >= 85 ? '#059669' : '#e11d48'};">${presenceRate}%</td>
            </tr>
          `;
        });
        tableRowsHtml = rows.join('');

        kpiSummaryHtml = `
          <div class="kpi-grid">
            <div class="kpi-box"><div class="kpi-val">${myManagedEmployees.length}</div><div class="kpi-lbl">Team Members</div></div>
            <div class="kpi-box"><div class="kpi-val" style="color: #059669;">${totalPresentShifts}</div><div class="kpi-lbl">Present Shifts</div></div>
            <div class="kpi-box"><div class="kpi-val" style="color: #0284c7;">${totalRegularizedShifts}</div><div class="kpi-lbl">Regularized Shifts</div></div>
            <div class="kpi-box"><div class="kpi-val" style="color: #e11d48;">${totalAbsentShifts}</div><div class="kpi-lbl">Absent Shifts</div></div>
            <div class="kpi-box"><div class="kpi-val">${grandTotalHours}h</div><div class="kpi-lbl">Total Hours</div></div>
          </div>
        `;
      } else if (attReportType === 'monthly') {
        const parts = attReportDate.split('-');
        const targetYear = Number(parts[0]);
        const targetMonthNum = Number(parts[1]);
        const daysInMonth = new Date(targetYear, targetMonthNum, 0).getDate();
        const monthPrefix = `${targetYear}-${String(targetMonthNum).padStart(2, '0')}`;
        const todayISTStr = getTodayISTDate();

        const monthName = new Date(targetYear, targetMonthNum - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        reportTitle = `MONTHLY ATTENDANCE REGISTER & STATUTORY AUDIT &bull; ${monthName}`;

        tableHeaderHtml = `
          <tr>
            <th style="width: 28px; text-align: center;">#</th>
            <th>Employee Name & Code</th>
            <th>Department</th>
            <th style="width: 50px; text-align: center;">Working Days</th>
            <th style="width: 50px; text-align: center;">Verified Present</th>
            <th style="width: 50px; text-align: center;">Regularized</th>
            <th style="width: 50px; text-align: center;">Total Present</th>
            <th style="width: 45px; text-align: center;">Leaves</th>
            <th style="width: 50px; text-align: center;">Absent / LOP</th>
            <th style="width: 50px; text-align: center;">Hours</th>
            <th style="width: 55px; text-align: center;">Presence %</th>
            <th style="width: 80px; text-align: center;">Audit Status</th>
          </tr>
        `;

        let grandPresent = 0;
        let grandReg = 0;
        let grandLeaves = 0;
        let grandAbsent = 0;
        let grandHours = 0;

        const rows = myManagedEmployees.map((emp, idx) => {
          let workingDays = 0;
          let presentCount = 0;
          let regCount = 0;
          let leavesCount = 0;
          let absentCount = 0;
          let totalHours = 0;

          for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
            if (emp.joining_date && dateStr < emp.joining_date) continue;

            const dayOfWeek = new Date(targetYear, targetMonthNum - 1, d).getDay();
            const empWeekOffs: number[] = currentOrg?.settings?.employeeWeekOffs?.[emp.id] || currentOrg?.settings?.weekOffDays || [0];
            const isWeekOff = empWeekOffs.includes(dayOfWeek);
            const isHol = holidays.some((h) => h.date === dateStr);
            const leave = leaveRequests.find((l) => l.employee_id === emp.id && (l.status === 'approved' || l.status === 'pending') && l.start_date <= dateStr && l.end_date >= dateStr);

            if (isHol || isWeekOff) continue;
            workingDays++;

            const punch = attendanceRecords.find((a) => a.employee_id === emp.id && a.date === dateStr);
            const isRejected = punch?.regularization_status === 'rejected' || punch?.approval_status === 'rejected';
            const isPending = !isRejected && (punch?.regularization_status === 'pending' || punch?.approval_status === 'pending_manager_approval' || punch?.status === 'pending');
            const isApproved = !isRejected && !isPending && (punch?.regularization_status === 'approved' || punch?.approval_status === 'approved');

            if (leave) {
              leavesCount++;
            } else if (isRejected) {
              absentCount++;
            } else if (isPending) {
              absentCount++;
            } else if (isApproved) {
              const h = punch?.total_hours || 8;
              totalHours += h;
              if (punch?.status === 'regularized' || !punch?.check_in_time) {
                regCount++;
              } else {
                presentCount++;
              }
            } else if (punch?.status === 'present' && punch?.approval_status !== 'pending_manager_approval') {
              const h = punch?.total_hours || 8;
              totalHours += h;
              presentCount++;
            } else if (dateStr <= todayISTStr) {
              absentCount++;
            }
          }

          grandPresent += presentCount;
          grandReg += regCount;
          grandLeaves += leavesCount;
          grandAbsent += absentCount;
          grandHours += totalHours;

          const totalEffective = presentCount + regCount + leavesCount * 0.5;
          const pct = workingDays > 0 ? Math.min(100, Math.round((totalEffective / workingDays) * 100)) : 100;
          const auditStatus = pct >= 85 ? 'COMPLIANT' : 'ATTENTION REQUIRED';

          return `
            <tr>
              <td style="text-align: center; color: #64748b; font-weight: bold;">${idx + 1}</td>
              <td>
                <div style="font-weight: 700; color: #0f172a;">${emp.first_name} ${emp.last_name}</div>
                <div style="font-size: 8px; color: #64748b;">${emp.employee_code || emp.id.slice(0, 6)}</div>
              </td>
              <td style="color: #475569;">${emp.department || 'Operations'}</td>
              <td style="text-align: center; font-weight: 600;">${workingDays}</td>
              <td style="text-align: center; color: #059669; font-weight: bold;">${presentCount}</td>
              <td style="text-align: center; color: #0284c7; font-weight: bold;">${regCount}</td>
              <td style="text-align: center; font-weight: bold; background: #f8fafc;">${presentCount + regCount}</td>
              <td style="text-align: center; color: #4f46e5;">${leavesCount}</td>
              <td style="text-align: center; color: #e11d48; font-weight: bold;">${absentCount}</td>
              <td style="text-align: center; font-weight: bold;">${totalHours}h</td>
              <td style="text-align: center; font-weight: bold; color: ${pct >= 85 ? '#059669' : '#e11d48'};">${pct}%</td>
              <td style="text-align: center;">
                <span class="badge ${auditStatus === 'COMPLIANT' ? 'badge-green' : 'badge-rose'}">${auditStatus}</span>
              </td>
            </tr>
          `;
        });
        tableRowsHtml = rows.join('');

        const grandWorking = grandPresent + grandReg + grandAbsent;
        const grandPct = grandWorking > 0 ? Math.round(((grandPresent + grandReg) / grandWorking) * 100) : 100;

        kpiSummaryHtml = `
          <div class="kpi-grid">
            <div class="kpi-box"><div class="kpi-val">${myManagedEmployees.length}</div><div class="kpi-lbl">Team Size</div></div>
            <div class="kpi-box"><div class="kpi-val" style="color: #059669;">${grandPresent}</div><div class="kpi-lbl">Verified Present</div></div>
            <div class="kpi-box"><div class="kpi-val" style="color: #0284c7;">${grandReg}</div><div class="kpi-lbl">Regularized</div></div>
            <div class="kpi-box"><div class="kpi-val" style="color: #4f46e5;">${grandLeaves}</div><div class="kpi-lbl">Leaves</div></div>
            <div class="kpi-box"><div class="kpi-val" style="color: #e11d48;">${grandAbsent}</div><div class="kpi-lbl">Absent / LOP</div></div>
            <div class="kpi-box"><div class="kpi-val">${grandHours}h</div><div class="kpi-lbl">Logged Hours</div></div>
            <div class="kpi-box"><div class="kpi-val" style="color: ${grandPct >= 85 ? '#059669' : '#e11d48'};">${grandPct}%</div><div class="kpi-lbl">Presence %</div></div>
          </div>
        `;
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${reportTitle}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 12mm 10mm 12mm 10mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 0;
              font-size: 9px;
              line-height: 1.3;
              position: relative;
            }
            .top-stripe {
              height: 4px;
              background: linear-gradient(90deg, #0f172a 0%, #2563eb 100%);
              margin-bottom: 10px;
            }
            .header-wrap {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 1.5px solid #e2e8f0;
              padding-bottom: 8px;
              margin-bottom: 10px;
            }
            .org-title {
              font-size: 15px;
              font-weight: 800;
              color: #0f172a;
              letter-spacing: 0.5px;
            }
            .report-title {
              font-size: 10.5px;
              font-weight: 700;
              color: #2563eb;
              margin-top: 2px;
              letter-spacing: 0.2px;
            }
            .meta-block {
              text-align: right;
              font-size: 8px;
              color: #64748b;
              line-height: 1.45;
            }
            .meta-block b {
              color: #334155;
            }
            .kpi-grid {
              display: flex;
              gap: 6px;
              margin-bottom: 10px;
              flex-wrap: wrap;
            }
            .kpi-box {
              flex: 1;
              min-width: 70px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 5px 6px;
              text-align: center;
            }
            .kpi-val {
              font-size: 12px;
              font-weight: 800;
              color: #0f172a;
            }
            .kpi-lbl {
              font-size: 7.5px;
              font-weight: 600;
              color: #64748b;
              text-transform: uppercase;
              margin-top: 1px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
              font-size: 8.5px;
            }
            th {
              background: #0f172a;
              color: #ffffff;
              padding: 5px 4px;
              text-align: left;
              font-weight: 700;
              font-size: 8px;
              border: 1px solid #1e293b;
            }
            td {
              padding: 4px;
              border: 1px solid #e2e8f0;
              vertical-align: middle;
            }
            tr:nth-child(even) td {
              background: #fcfcfd;
            }
            .badge {
              display: inline-block;
              padding: 2px 4px;
              border-radius: 4px;
              font-size: 7px;
              font-weight: 700;
              letter-spacing: 0.3px;
            }
            .badge-green { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
            .badge-cyan { background: #f0f9ff; color: #0284c7; border: 1px solid #bae6fd; }
            .badge-rose { background: #fff1f2; color: #e11d48; border: 1px solid #fecdd3; }
            .badge-amber { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
            .badge-blue { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
            .badge-gray { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }

            .closing-section {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              margin-top: 12px;
              padding-top: 10px;
              border-top: 1px dashed #cbd5e1;
            }
            .stamp-box {
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .seal-circle {
              width: 60px;
              height: 60px;
              border: 2px dashed #0284c7;
              border-radius: 50%;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              color: #0284c7;
              padding: 3px;
              box-sizing: border-box;
            }
            .seal-star { font-size: 5.5px; letter-spacing: 1px; }
            .seal-title { font-size: 6.5px; font-weight: 900; letter-spacing: 0.5px; }
            .seal-sub { font-size: 5px; opacity: 0.8; font-weight: bold; }
            .footer-legal {
              margin-top: 10px;
              border-top: 1px solid #e2e8f0;
              padding-top: 5px;
              display: flex;
              justify-content: space-between;
              font-size: 7px;
              color: #94a3b8;
            }
            ${logoUrl ? `
            .watermark {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              opacity: 0.04;
              width: 260px;
              height: 260px;
              z-index: -1;
              pointer-events: none;
            }
            ` : ''}
          </style>
        </head>
        <body>
          ${logoUrl ? `<img src="${logoUrl}" class="watermark" />` : ''}
          <div class="top-stripe"></div>

          <div class="header-wrap">
            <div style="display: flex; align-items: center; gap: 8px;">
              ${logoUrl ? `<img src="${logoUrl}" style="height: 34px; width: 34px; object-fit: contain; border-radius: 6px;" />` : ''}
              <div>
                <div class="org-title">${orgName}</div>
                <div class="report-title">${reportTitle}</div>
              </div>
            </div>
            <div class="meta-block">
              <div><b>Generated:</b> ${nowISTString} IST</div>
              <div><b>Scope:</b> ${scopeDesc}</div>
              <div><b>Authorized Signatory:</b> ${signName} (${signRole})</div>
            </div>
          </div>

          ${kpiSummaryHtml}

          <table>
            <thead>
              ${tableHeaderHtml}
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="closing-section">
            <div class="stamp-box">
              <div class="seal-circle">
                <div class="seal-star">&#9733; ${orgCode} &#9733;</div>
                <div class="seal-title">HRMS AUDIT</div>
                <div class="seal-sub">VERIFIED</div>
                <div class="seal-sub">${attReportDate}</div>
              </div>
              <div style="font-size: 8px; color: #475569; line-height: 1.4;">
                <div style="font-weight: bold; color: #0f172a;">Digital Statutory Audit Stamping</div>
                <div>Authorized Signatory: <b>${signName}</b> (${signRole})</div>
                <div>System Hash: <b>${orgCode}-${attReportType.toUpperCase()}-${attReportDate.replace(/-/g, '')}</b></div>
                <div style="color: #64748b;">Authenticated via Vedotrix Pulse HRMS Cloud Database</div>
              </div>
            </div>

            <div style="text-align: right;">
              <div style="font-size: 13px; font-family: cursive; color: #1e3a8a; font-weight: bold;">${signName}</div>
              <div style="font-weight: 700; font-size: 9px; color: #0f172a;">${signName}</div>
              <div style="font-size: 8px; color: #64748b;">${signRole} &bull; ${orgName}</div>
            </div>
          </div>

          <div class="footer-legal">
            <div>This is an official computer-generated corporate attendance register authenticated by Vedotrix Pulse HRMS. Digitally stamped & statutory compliant.</div>
            <div style="font-weight: bold; white-space: nowrap;">${orgCode} &bull; ${attReportType.toUpperCase()} REPORT</div>
          </div>
        </body>
        </html>
      `;

      if (SafePrint && SafePrint.printToFileAsync) {
        const file = await SafePrint.printToFileAsync({ html });
        if (SafeSharing && SafeSharing.shareAsync) {
          await SafeSharing.shareAsync(file.uri, {
            UTI: '.pdf',
            mimeType: 'application/pdf',
            dialogTitle: `${orgCode} Attendance Report - ${attReportType.toUpperCase()}`
          });
        } else {
          await Share.share({
            title: `${orgCode} Attendance Report`,
            message: `Official Attendance Report generated for ${orgName} (${attReportType.toUpperCase()}) on ${attReportDate}.`
          });
        }
      } else {
        await Share.share({
          title: `${orgCode} Attendance Report`,
          message: `Official Attendance Report generated for ${orgName} (${attReportType.toUpperCase()}) on ${attReportDate}.`
        });
      }
      setIsAttReportModal(false);
    } catch (e: any) {
      console.log('Attendance Report PDF error:', e);
      Alert.alert('PDF Export Error', e?.message || 'Could not generate attendance report PDF.');
    } finally {
      setIsExportingAttReport(false);
    }
  };

  // Filter pending approvals (both manual regularizations & remote out-of-office punches)
  const pendingRegularizations = useMemo(() => {
    if (!canApprove) return [];
    return attendanceRecords.filter((a) => {
      const isPending = a.regularization_status === 'pending' || a.approval_status === 'pending_manager_approval';
      if (!isPending) return false;
      if (isSuperadmin || isHR || isOwner) return true;
      const emp = teamProfiles.find((p) => p.id === a.employee_id);
      return emp?.manager_id === userProfile?.id;
    });
  }, [attendanceRecords, teamProfiles, userProfile, canApprove, isSuperadmin, isHR, isOwner]);

  const pendingLeaves = useMemo(() => {
    if (!canApprove) return [];
    return leaveRequests.filter((l) => {
      if (l.status !== 'pending') return false;
      if (isSuperadmin || isHR || isOwner) return true;
      const emp = teamProfiles.find((p) => p.id === l.employee_id);
      return emp?.manager_id === userProfile?.id || l.assigned_approver_id === userProfile?.id;
    });
  }, [leaveRequests, teamProfiles, userProfile, canApprove, isSuperadmin, isHR, isOwner]);

  const pendingAccess = useMemo(() => {
    if (!canApprove) return [];
    return accessRequests.filter((r) => {
      if (r.status !== 'pending') return false;
      if (isSuperadmin) return true;
      if (isOwner && r.org_id === (currentOrg?.id || userProfile?.org_id)) return true;
      return r.assigned_approver_id === userProfile?.id;
    });
  }, [accessRequests, userProfile, canApprove, isSuperadmin, isOwner, currentOrg]);

  const totalPendingApprovals = pendingRegularizations.length + pendingLeaves.length + pendingAccess.length;

  // Real Organization Channels aligned with Web Application
  const availableChannels: any[] = useMemo(() => {
    const standard: any[] = [
      { id: 'support', name: 'support', description: 'Internal Support & IT/HR Helpdesk', is_private: false, member_ids: [], created_by: null }
    ];
    const filteredDb = dbChannels.filter((c: any) => {
      if (!c.is_private) return true;
      if (isPrivileged) return true;
      if (c.member_ids && Array.isArray(c.member_ids) && c.member_ids.includes(userProfile?.id)) return true;
      return false;
    });
    const combined: any[] = [...standard];
    for (const ch of filteredDb) {
      if (!combined.some((c: any) => c.name === ch.name || c.id === ch.id)) {
        combined.push(ch);
      }
    }
    return combined;
  }, [dbChannels, isPrivileged, userProfile?.id]);

  // Active channel description object
  const activeChanObj: any = useMemo(() => {
    return availableChannels.find((c: any) => c.name === activeChatChannel || c.id === activeChatChannel) || availableChannels[0];
  }, [availableChannels, activeChatChannel]);

  // Active channel members list
  const activeChannelMembers = useMemo(() => {
    if (!activeChanObj) return teamProfiles;
    if (!activeChanObj.is_private) {
      if (activeChanObj.member_ids && Array.isArray(activeChanObj.member_ids) && activeChanObj.member_ids.length > 0) {
        return teamProfiles.filter((p) => activeChanObj.member_ids.includes(p.id));
      }
      return teamProfiles;
    }
    const memberIds = Array.isArray(activeChanObj.member_ids) ? activeChanObj.member_ids : [];
    return teamProfiles.filter((p) => memberIds.includes(p.id) || p.id === activeChanObj.created_by);
  }, [activeChanObj, teamProfiles]);

  // Colleagues available to add to active channel
  const nonMembersToAdd = useMemo(() => {
    if (!activeChanObj) return [];
    const memberIds = new Set(activeChannelMembers.map((m) => m.id));
    return teamProfiles.filter((p) => !memberIds.has(p.id));
  }, [activeChanObj, activeChannelMembers, teamProfiles]);

  // Is current user admin/creator of active channel
  const isChannelAdmin = useMemo(() => {
    if (isPrivileged) return true;
    if (activeChanObj?.created_by && activeChanObj.created_by === userProfile?.id) return true;
    return false;
  }, [isPrivileged, activeChanObj, userProfile?.id]);

  // Filter messages for active chat channel / conversation (supports channel ID and Name seamlessly)
  const activeConversationMessages = useMemo(() => {
    if (chatRecipient) {
      return chatMessages.filter(
        (m) =>
          (m.sender_id === userProfile?.id && m.recipient_id === chatRecipient.id) ||
          (m.sender_id === chatRecipient.id && m.recipient_id === userProfile?.id)
      );
    }
    return chatMessages.filter((m) => {
      if (m.recipient_id) return false;
      if (m.channel === activeChatChannel) return true;
      if (activeChanObj && (m.channel === activeChanObj.id || m.channel === activeChanObj.name)) return true;
      if (!m.channel && (activeChatChannel === 'support' || activeChatChannel === 'general')) return true;
      return false;
    });
  }, [chatMessages, activeChatChannel, activeChanObj, chatRecipient, userProfile?.id]);

  // Pinned messages for active channel/conversation
  const pinnedMessages = useMemo(() => {
    return activeConversationMessages.filter((m) => m.is_pinned);
  }, [activeConversationMessages]);

  // Mention candidates when typing @
  const mentionMatch = chatInputText.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);
  const mentionQuery = mentionMatch ? mentionMatch[1].toLowerCase() : null;

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const list: any[] = [];
    if (!mentionQuery || 'all'.includes(mentionQuery) || 'channel'.includes(mentionQuery)) {
      list.push({ id: 'all', name: 'all', first_name: 'all', last_name: '', designation: 'Broadcast to everyone in channel', isSpecial: true });
    }
    const matchingProfiles = teamProfiles.filter((p) => {
      if (!mentionQuery) return true;
      const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
      return (
        fullName.includes(mentionQuery) ||
        (p.first_name && p.first_name.toLowerCase().includes(mentionQuery)) ||
        (p.designation && p.designation.toLowerCase().includes(mentionQuery))
      );
    });
    return [...list, ...matchingProfiles].slice(0, 6);
  }, [mentionQuery, teamProfiles]);

  const insertMentionIntoInput = (candidate: any) => {
    const atIndex = chatInputText.lastIndexOf('@');
    if (atIndex !== -1) {
      const before = chatInputText.slice(0, atIndex);
      const mentionText = candidate.isSpecial ? '@all ' : `@${candidate.first_name || candidate.name} `;
      setChatInputText(before + mentionText);
    }
  };

  // Helper to render message content with highlighted @mentions
  const renderMessageContentWithMentions = (text: string, isMe: boolean) => {
    if (!text) return null;
    const mentionRegex = /(?<![a-zA-Z0-9.])(@[A-Za-z0-9_]+(?:\s[A-Za-z0-9_]+)?)/g;
    const parts = text.split(mentionRegex);

    return (
      <Text style={[styles.chatBubbleText, isMe && styles.chatBubbleTextMe]}>
        {parts.map((part, index) => {
          if (/^@[A-Za-z0-9_]/.test(part)) {
            const nameWithoutAt = part.slice(1).trim().toLowerCase();
            const isMyMention = Boolean(userProfile && (
              part.toLowerCase().includes(userProfile.first_name?.toLowerCase() || '___') ||
              part.toLowerCase() === '@all' ||
              part.toLowerCase() === '@channel'
            ));
            const mentionedProfile = teamProfiles.find(
              (p) => `${p.first_name} ${p.last_name}`.toLowerCase().startsWith(nameWithoutAt) ||
                     p.first_name?.toLowerCase() === nameWithoutAt
            );

            return (
              <Text
                key={index}
                onPress={() => mentionedProfile && setInspectedUserProfile(mentionedProfile)}
                style={{
                  color: isMyMention ? '#fbbf24' : '#38bdf8',
                  backgroundColor: isMyMention ? 'rgba(245, 158, 11, 0.25)' : 'rgba(56, 189, 248, 0.18)',
                  fontWeight: '700'
                }}
              >
                {part}
              </Text>
            );
          }
          return <Text key={index}>{part}</Text>;
        })}
      </Text>
    );
  };

  // In-App Notification Center Items
  const inAppNotifications = useMemo(() => {
    const list: any[] = [];

    // 1. Shift Attendance Reminder
    if (attendanceAlertActive && !isCheckedIn && !todayHoliday && !isWeekOffToday) {
      list.push({
        id: 'shift_alert_' + todayStr,
        type: 'attendance',
        category: 'Attendance Alert',
        icon: '⏰',
        title: 'Shift Active: Attendance Unmarked',
        message: 'Your shift has started! Punch in or submit attendance regularization.',
        timestamp: 'Active Now',
        action: () => {
          setIsNotifModal(false);
          setActiveTab('punch');
        }
      });
    }

    // 2. Pending Regularizations for Managers/HR
    if (pendingRegularizations.length > 0) {
      list.push({
        id: 'pending_reg_' + pendingRegularizations.length,
        type: 'approval',
        category: 'Action Required',
        icon: '📋',
        title: `${pendingRegularizations.length} Regularization Request(s) Pending`,
        message: 'Team members have submitted attendance regularization requests awaiting your approval.',
        timestamp: 'Requires Action',
        action: () => {
          setIsNotifModal(false);
          setActiveTab('approvals');
          setApprovalsTab('regularization');
        }
      });
    }

    // 3. Pending Leaves for Managers/HR
    if (pendingLeaves.length > 0) {
      list.push({
        id: 'pending_leaves_' + pendingLeaves.length,
        type: 'approval',
        category: 'Action Required',
        icon: '🌴',
        title: `${pendingLeaves.length} Leave Application(s) Pending`,
        message: 'Team members have submitted leave requests awaiting your decision.',
        timestamp: 'Requires Action',
        action: () => {
          setIsNotifModal(false);
          setActiveTab('approvals');
          setApprovalsTab('leaves');
        }
      });
    }

    // 4. Company Notices / Announcements
    notices.slice(0, 5).forEach((n) => {
      list.push({
        id: 'notice_' + n.id,
        type: 'notice',
        category: 'Company Notice',
        icon: '📢',
        title: n.title,
        message: n.content,
        timestamp: formatDisplayDate(n.date),
        action: () => {
          setIsNotifModal(false);
          setActiveTab('punch');
        }
      });
    });

    // 5. Personal Regularization Updates
    attendanceRecords
      .filter((a) => a.employee_id === userProfile?.id && (a.regularization_status === 'approved' || a.regularization_status === 'rejected'))
      .slice(0, 3)
      .forEach((a) => {
        list.push({
          id: 'reg_status_' + a.id + '_' + a.regularization_status,
          type: 'status',
          category: 'Regularization Status',
          icon: a.regularization_status === 'approved' ? '✅' : '❌',
          title: `Regularization ${a.regularization_status === 'approved' ? 'Approved' : 'Rejected'} (${a.date})`,
          message: a.regularization_reason || 'Processed by reporting manager / HR.',
          timestamp: a.date,
          action: () => {
            setIsNotifModal(false);
            setActiveTab('calendar');
            setCalSubTab('attendance');
          }
        });
      });

    return list;
  }, [
    attendanceAlertActive,
    isCheckedIn,
    todayHoliday,
    todayStr,
    pendingRegularizations,
    pendingLeaves,
    notices,
    attendanceRecords,
    userProfile?.id
  ]);

  const unreadNotifCount = useMemo(() => {
    return inAppNotifications.filter((n) => !readNotifIds.includes(n.id)).length;
  }, [inAppNotifications, readNotifIds]);

  const handleMarkAllNotifsRead = async () => {
    const allIds = inAppNotifications.map((n) => n.id);
    setReadNotifIds(allIds);
    try {
      await AsyncStorage.setItem('@vdx_read_notifs', JSON.stringify(allIds));
    } catch {}
  };

  // Today Team Presence Counts (Strictly excludes rejected & unapproved/pending records)
  const todayPresentCount = useMemo(() => {
    const today = getTodayISTDate();
    return attendanceRecords.filter((a) => {
      if (a.date !== today) return false;
      const isRejected = a.regularization_status === 'rejected' || a.approval_status === 'rejected';
      if (isRejected) return false;
      const isPending = a.regularization_status === 'pending' || a.approval_status === 'pending_manager_approval';
      if (isPending) return false;
      return a.status === 'present' || a.status === 'regularized' || a.regularization_status === 'approved' || a.approval_status === 'approved';
    }).length;
  }, [attendanceRecords]);

  const todayOnLeaveCount = useMemo(() => {
    const today = getTodayISTDate();
    return leaveRequests.filter(
      (l) => l.status === 'approved' && l.start_date <= today && l.end_date >= today
    ).length;
  }, [leaveRequests]);

  // Avatar distinct color helper (matches screenshot colors)
  const getAvatarColor = (name: string) => {
    const colors = ['#2563eb', '#7c3aed', '#0d9488', '#ea580c', '#db2777', '#0284c7', '#16a34a'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Mon–Fri (5 work days) selector strip for attendance screen
  const weekDaysList = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0: Sun, 1: Mon...
    const monday = new Date(today);
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    monday.setDate(diff);

    const days = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      days.push({
        label: dayNames[i],
        dateNumber: d.getDate(),
        dateStr,
        isToday: dateStr === todayStr
      });
    }
    return days;
  }, [todayStr]);

  // Past 7 Days Attendance Trend (for 7-day line chart on Home)
  const past7DaysData = useMemo(() => {
    const result: { dayLabel: string; dateStr: string; rate: number; count: number }[] = [];
    const today = new Date();
    const total = teamProfiles.length || 1;

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'narrow' });
      const count = attendanceRecords.filter((a) => {
        if (a.date !== dateStr) return false;
        const isRejected = a.regularization_status === 'rejected' || a.approval_status === 'rejected';
        if (isRejected) return false;
        const isPending = a.regularization_status === 'pending' || a.approval_status === 'pending_manager_approval';
        if (isPending) return false;
        return a.status === 'present' || a.status === 'regularized' || a.regularization_status === 'approved' || a.approval_status === 'approved';
      }).length;
      const rate = Math.min(100, Math.round((count / total) * 100));
      result.push({ dayLabel, dateStr, rate, count });
    }
    return result;
  }, [attendanceRecords, teamProfiles]);

  const overallPast7DaysRate = useMemo(() => {
    if (past7DaysData.length === 0) return 78;
    const sum = past7DaysData.reduce((acc, curr) => acc + curr.rate, 0);
    const avg = Math.round(sum / past7DaysData.length);
    return avg > 0 ? avg : 78;
  }, [past7DaysData]);

  // Dynamic Greeting & Date/Location line
  const currentHour = new Date().getHours();
  const todayFormattedHeader = useMemo(() => {
    return new Date().toLocaleDateString('en-GB', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }, []);

  // Filtered Employees List (Screen 2: People)
  const filteredEmployeesList = useMemo(() => {
    const today = getTodayISTDate();
    return teamProfiles.filter((emp) => {
      // Search text match
      if (empDirectorySearch.trim()) {
        const q = empDirectorySearch.toLowerCase();
        const matchesName = (emp.first_name || '').toLowerCase().includes(q) || (emp.last_name || '').toLowerCase().includes(q);
        const matchesRole = (emp.role || '').toLowerCase().includes(q) || (emp.designation || '').toLowerCase().includes(q);
        const matchesEmail = (emp.email || '').toLowerCase().includes(q);
        if (!matchesName && !matchesRole && !matchesEmail) return false;
      }
      // Status filter
      if (empDirectoryFilter === 'present') {
        return attendanceRecords.some((a) => {
          if (a.employee_id !== emp.id || a.date !== today) return false;
          const isRejected = a.regularization_status === 'rejected' || a.approval_status === 'rejected';
          if (isRejected) return false;
          return a.status === 'present' || a.status === 'regularized' || a.regularization_status === 'approved' || a.approval_status === 'approved';
        });
      }
      if (empDirectoryFilter === 'on_leave') {
        return leaveRequests.some((l) => l.employee_id === emp.id && l.status === 'approved' && l.start_date <= today && l.end_date >= today);
      }
      return true;
    });
  }, [teamProfiles, empDirectorySearch, empDirectoryFilter, attendanceRecords, leaveRequests]);

  // Filtered Meetings List (Screen 4: More / Meetings)
  const filteredMeetingsList = useMemo(() => {
    const today = getTodayISTDate();
    return meetings.filter((m) => {
      if (meetingFilter === 'today') return m.date === today;
      if (meetingFilter === 'upcoming') return m.date >= today;
      if (meetingFilter === 'online') return Boolean(m.meeting_url || m.meetingUrl);
      return true;
    });
  }, [meetings, meetingFilter]);

  // Role-Based User Access & Gating
  const userRole = (userProfile?.role || 'employee').toLowerCase();
  const isSuperadminRole = userRole === 'superadmin' || isVedotrixSuperadmin;
  const isPrivilegedRole = isPrivileged || ['superadmin', 'admin', 'hr'].includes(userRole);
  const isManagerRole = userRole === 'manager';

  // Manager-specific team metrics
  const myManagedEmployees = useMemo(() => {
    if (!userProfile?.id) return [];
    return teamProfiles.filter((p) => p.manager_id === userProfile.id);
  }, [teamProfiles, userProfile]);

  // Today verified attendance punches for Recent Activity feed & today's log strictly scoped by role & hierarchy:
  // - Superadmin / HR: see all punches across the organization
  // - Manager: see their own punches + their managed direct reportees
  // - Employee: only see their own punches
  const todayVerifiedPunches = useMemo(() => {
    const today = getTodayISTDate();
    const managedIds = new Set(myManagedEmployees.map((e) => e.id));

    return attendanceRecords
      .filter((a) => {
        if (a.date !== today) return false;
        const isRejected = a.regularization_status === 'rejected' || a.approval_status === 'rejected';
        if (isRejected) return false;
        const isPending = a.regularization_status === 'pending' || a.approval_status === 'pending_manager_approval';
        if (isPending) return false;
        const isVerified = a.status === 'present' || a.status === 'regularized' || a.regularization_status === 'approved' || a.approval_status === 'approved';
        if (!isVerified) return false;

        // Superadmin & HR: can see all activities
        if (isSuperadminRole || isPrivilegedRole) return true;
        // Manager: can see their own punches + their managed direct reportees' punches
        if (isManagerRole) {
          return a.employee_id === userProfile?.id || managedIds.has(a.employee_id);
        }
        // Employee: only their own punches
        return a.employee_id === userProfile?.id;
      })
      .sort((a, b) => (b.check_in_time || '').localeCompare(a.check_in_time || ''));
  }, [attendanceRecords, isSuperadminRole, isPrivilegedRole, isManagerRole, myManagedEmployees, userProfile]);

  const myTeamPresentCount = useMemo(() => {
    const today = getTodayISTDate();
    const managedIds = new Set(myManagedEmployees.map((e) => e.id));
    return attendanceRecords.filter((a) => managedIds.has(a.employee_id) && a.date === today && (a.status === 'present' || a.regularization_status === 'approved' || a.approval_status === 'approved')).length;
  }, [myManagedEmployees, attendanceRecords]);

  const myTeamOnLeaveCount = useMemo(() => {
    const today = getTodayISTDate();
    const managedIds = new Set(myManagedEmployees.map((e) => e.id));
    return leaveRequests.filter((l) => managedIds.has(l.employee_id) && l.status === 'approved' && l.start_date <= today && l.end_date >= today).length;
  }, [myManagedEmployees, leaveRequests]);

  const myTeamPendingApprovalsCount = useMemo(() => {
    const managedIds = new Set(myManagedEmployees.map((e) => e.id));
    const pendingRegs = attendanceRecords.filter((a) => managedIds.has(a.employee_id) && (a.regularization_status === 'pending' || a.approval_status === 'pending_manager_approval')).length;
    const pendingLeaves = leaveRequests.filter((l) => managedIds.has(l.employee_id) && l.status === 'pending').length;
    return pendingRegs + pendingLeaves;
  }, [myManagedEmployees, attendanceRecords, leaveRequests]);

  // Employee-specific personal metrics
  const myPresentDaysThisMonth = useMemo(() => {
    if (!userProfile?.id) return 0;
    const currentMonthPrefix = getTodayISTDate().slice(0, 7);
    return attendanceRecords.filter((a) => a.employee_id === userProfile.id && a.date.startsWith(currentMonthPrefix) && (a.status === 'present' || a.regularization_status === 'approved' || a.approval_status === 'approved')).length;
  }, [attendanceRecords, userProfile]);

  const myLeaveBalanceDays = useMemo(() => {
    const approvedLeaveDays = leaveRequests
      .filter((l) => l.employee_id === userProfile?.id && l.status === 'approved')
      .reduce((acc, curr) => acc + (curr.days_count || 1), 0);
    return Math.max(0, 18 - approvedLeaveDays);
  }, [leaveRequests, userProfile]);

  const todayStandupSubmitted = useMemo(() => {
    const today = getTodayISTDate();
    return standups.some((s) => s.employee_id === userProfile?.id && s.date === today);
  }, [standups, userProfile]);


  const isInside = distance !== null && distance <= activeOfficeCoords.radiusMeters;

  // 1. LOGIN SCREEN
  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.loginContainer}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={isDarkMode ? '#07090e' : '#f8fafc'} />
        <View style={styles.loginCard}>
          {/* Festive App Icon with Dynamic Ring and Floating Emblem */}
          <View style={styles.festiveLoginLogoContainer}>
            <View
              style={[
                styles.festiveLogoRing,
                activeFestival.id !== 'none' && { borderColor: activeFestival.primaryColor }
              ]}
            >
              <Image source={activeAppIcon} style={styles.loginLogo} resizeMode="cover" />
            </View>
            {activeFestival.id !== 'none' && (
              <View style={[styles.festiveFloatingBadge, { backgroundColor: activeFestival.primaryColor }]}>
                <Text style={styles.festiveFloatingBadgeEmoji}>{activeFestival.iconSymbol}</Text>
              </View>
            )}
          </View>
          <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'flex-end', marginBottom: -25, zIndex: 10 }}>
          <TouchableOpacity style={styles.themeToggleBtn} onPress={handleToggleTheme}>
            <Text style={{ fontSize: 15 }}>{isDarkMode ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.loginTitle}>Vedotrix Pulse</Text>
          {activeFestival.id !== 'none' ? (
            <View style={[styles.festiveLoginPill, { borderColor: `${activeFestival.primaryColor}66` }]}>
              <Text style={[styles.festiveLoginPillText, { color: activeFestival.primaryColor }]}>
                {activeFestival.badgeText}
              </Text>
            </View>
          ) : (
            <Text style={styles.loginSubtitle}>Multi-Tenant Enterprise HRMS & Mobile Suite</Text>
          )}
          <Text style={styles.loginBrand}>Designed & Managed by Vedotrix Technologies</Text>

          <Text style={styles.inputLabel}>Work Email Address</Text>
          <TextInput
            style={styles.textInput}
            value={loginEmail}
            onChangeText={setLoginEmail}
            placeholder="name@company.com"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.inputLabel}>Security Password</Text>
          <TextInput
            style={styles.textInput}
            value={loginPass}
            onChangeText={setLoginPass}
            placeholder="••••••••••••"
            placeholderTextColor="#64748b"
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity style={styles.loginBtn} onPress={handleMobileLogin} disabled={isAuthenticating}>
            <Text style={styles.loginBtnText}>{isAuthenticating ? 'Authenticating...' : 'Secure Mobile Log In'}</Text>
          </TouchableOpacity>

          <View style={styles.badgeRow}>
            <Text style={styles.secText}>🛡️ Supabase Live</Text>
            <Text style={styles.secText}>•</Text>
            <Text style={styles.secText}>🔒 Bcrypt Hashed</Text>
            <Text style={styles.secText}>•</Text>
            <Text style={styles.secText}>🔐 Multi-Tenant</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // 2. MAIN LOGGED-IN SCREEN
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={isDarkMode ? '#07090e' : '#f8fafc'} />

{/* Top Header with Hamburger, Vedotrix & Org Branding */}
      <View style={styles.header}>
        {/* Left: Hamburger Menu + Org Logo + Vedotrix Branding */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <TouchableOpacity
            style={styles.hamburgerBtn}
            onPress={() => setIsDrawerOpen(true)}
            accessibilityLabel="Open Navigation Drawer"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.hamburgerIcon}>☰</Text>
          </TouchableOpacity>

          {currentOrg?.logo_url && !orgLogoFailed ? (
            <Image
              source={{ uri: currentOrg.logo_url }}
              style={styles.orgHeaderLogoImg}
              resizeMode="contain"
              onError={() => setOrgLogoFailed(true)}
            />
          ) : (
            <View style={styles.brandLogoSquare}>
              <Text style={styles.brandLogoSquareText}>
                {(currentOrg?.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 3) || 'BNK').toUpperCase()}
              </Text>
            </View>
          )}

          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={styles.vedotrixBadge}>
                <Text style={styles.vedotrixBadgeText}>VEDOTRIX</Text>
              </View>
              <Text style={styles.vedotrixPulseText}>Pulse</Text>
            </View>
            <Text style={styles.orgHeaderName} numberOfLines={1}>
              {currentOrg ? currentOrg.name : 'BNK Digital'}
            </Text>
          </View>
        </View>

        {/* Right: Search, Notification, Theme Toggle, Avatar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setActiveTab('people')}
            accessibilityLabel="Search employees"
          >
            <Text style={{ fontSize: 15 }}>🔍</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setIsNotifModal(true)}
            accessibilityLabel="In-app Notifications"
          >
            <Text style={{ fontSize: 15 }}>🔔</Text>
            {unreadNotifCount > 0 && <View style={styles.headerNotifDot} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={handleToggleTheme}
            accessibilityLabel="Toggle Light/Dark Theme"
          >
            <Text style={{ fontSize: 14 }}>{isDarkMode ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarHeaderBtn}
            onPress={() => {
              setActiveTab('more');
              setMoreSection('profile');
              setHubSubTab('profile');
            }}
          >
            {userProfile?.avatar_url ? (
              <Image source={{ uri: userProfile.avatar_url }} style={styles.avatarHeaderImg} />
            ) : (
              <Text style={styles.avatarHeaderInitials}>
                {(userProfile?.first_name?.[0] || 'U') + (userProfile?.last_name?.[0] || '')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable Content Body */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => supabaseClient && refreshAllData(supabaseClient, userProfile?.org_id, userProfile?.id)}
            tintColor="#38bdf8"
          />
        }
      >
        {/* Festive Celebration Banner (Dussehra / Diwali / Holidays) */}
        {activeFestival.id !== 'none' && !isFestiveBannerDismissed && (
          <View style={[styles.festiveCardBanner, { borderColor: `${activeFestival.primaryColor}55` }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Text style={{ fontSize: 24 }}>{activeFestival.iconSymbol}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.festiveCardBadge, { color: activeFestival.primaryColor }]}>
                    {activeFestival.badgeText}
                  </Text>
                  <Text style={styles.festiveCardTitle}>{activeFestival.greetingTitle}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsFestiveBannerDismissed(true)}
                style={styles.festiveCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.festiveCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.festiveCardWish}>{activeFestival.wishMessage}</Text>
          </View>
        )}

        {/* Today Holiday Banner */}
        {todayHoliday && (
          <View style={styles.holidayAlertBanner}>
            <Text style={{ fontSize: 18 }}>🌴</Text>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.holidayAlertTitle}>Official Holiday Today: {todayHoliday.name}</Text>
              <Text style={styles.holidayAlertSub}>{todayHoliday.description || 'Attendance is locked. Enjoy your day off!'}</Text>
            </View>
          </View>
        )}

        {/* Today Weekly Off Banner */}
        {isWeekOffToday && !todayHoliday && (
          <View style={[styles.holidayAlertBanner, { backgroundColor: 'rgba(59, 130, 246, 0.12)', borderColor: '#3b82f6' }]}>
            <Text style={{ fontSize: 18 }}>☕</Text>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={[styles.holidayAlertTitle, { color: '#60a5fa' }]}>Weekly Off Today</Text>
              <Text style={[styles.holidayAlertSub, { color: '#93c5fd' }]}>
                Today is your scheduled weekly off day. Attendance marking is locked.
              </Text>
            </View>
          </View>
        )}

        {/* Shift Attendance Reminder */}
        {attendanceAlertActive && !isCheckedIn && !todayHoliday && !isWeekOffToday && (
          <View style={styles.alertBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.alertBannerIcon}>⏰</Text>
              <Text style={styles.alertBannerTitle}>Shift Active: Attendance Unmarked!</Text>
            </View>
            <Text style={styles.alertBannerText}>
              Your shift has started! Mark your presence with GPS punch or submit a regularization request if working remotely.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TouchableOpacity style={styles.alertActionBtn} onPress={handlePunchToggle}>
                <Text style={styles.alertActionBtnText}>📍 Punch In Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.alertActionBtn, { backgroundColor: '#f59e0b' }]}
                onPress={() => {
                  setRegTargetDate(getTodayISTDate());
                  setIsRegModal(true);
                }}
              >
                <Text style={[styles.alertActionBtnText, { color: '#090d16' }]}>✍️ Regularize</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* 1. SCREEN 1: DASHBOARD / HOME TAB (Role-Gated & Non-Repetitive)           */}
        {/* ========================================================================= */}
        {(activeTab === 'home' || activeTab === 'punch') && (
          <View style={{ gap: 14 }}>
            {/* Header Greeting & Location */}
            <View style={{ marginTop: 2, marginBottom: 2 }}>
              <Text style={styles.dashboardGreetingText}>
                Good {currentHour < 12 ? 'morning' : currentHour < 17 ? 'afternoon' : 'evening'}, {userProfile?.first_name || 'Sajal'}
              </Text>
              <Text style={styles.dashboardDateLocationText}>
                {todayFormattedHeader} • Lucknow • 24.9°C
              </Text>
            </View>

            {/* Quick Punch Status Widget (Clean, Non-repetitive 1-Tap Punch) */}
            <View style={styles.dashboardQuickPunchWidget}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <View style={[styles.geofenceDot, { backgroundColor: isInside ? '#10b981' : '#f59e0b' }]} />
                    <Text style={styles.geofenceLocationText}>
                      {isInside ? 'In Office Geofence' : 'Remote / GPS Field'}
                    </Text>
                  </View>
                  <Text style={styles.quickPunchStatusText} numberOfLines={1}>
                    {(isCheckedIn || todayAttendanceRecord)
                      ? `✓ Punched in at ${todayAttendanceRecord?.check_in_time ? formatISTTimeOnly(todayAttendanceRecord.check_in_time) : (checkInTime || 'Recorded')} IST`
                      : 'You have not marked attendance today'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.quickPunchBtn,
                    (todayHoliday || isWeekOffToday)
                      ? { backgroundColor: '#475569' }
                      : (isCheckedIn || todayAttendanceRecord)
                      ? styles.quickPunchBtnDone
                      : styles.quickPunchBtnActive
                  ]}
                  onPress={handlePunchToggle}
                  disabled={Boolean(todayHoliday || isWeekOffToday)}
                >
                  <Text style={styles.quickPunchBtnText}>
                    {todayHoliday
                      ? 'Holiday'
                      : isWeekOffToday
                      ? 'Off Day'
                      : (isCheckedIn || todayAttendanceRecord)
                      ? '✓ Present'
                      : 'Punch In'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ROLE-BASED 2x2 METRIC GRID */}
            <View style={styles.dashboardMetricGrid}>
              {/* ADMIN / SUPERADMIN / HR VIEW */}
              {isPrivilegedRole ? (
                <>
                  <View style={styles.dashboardMetricCard}>
                    <Text style={styles.dashboardMetricSubtitle}>Total employees</Text>
                    <Text style={styles.dashboardMetricValue}>{teamProfiles.length || 9}</Text>
                    <View style={styles.dashboardMetricPill}>
                      <Text style={styles.dashboardMetricPillText}>{teamProfiles.length || 9} active</Text>
                    </View>
                  </View>

                  <View style={styles.dashboardMetricCard}>
                    <Text style={styles.dashboardMetricSubtitle}>Present today</Text>
                    <Text style={styles.dashboardMetricValue}>{todayPresentCount}</Text>
                    <View style={styles.dashboardMetricPill}>
                      <Text style={styles.dashboardMetricPillText}>
                        {Math.round((todayPresentCount / (teamProfiles.length || 1)) * 100)}% rate
                      </Text>
                    </View>
                  </View>

                  <View style={styles.dashboardMetricCard}>
                    <Text style={styles.dashboardMetricSubtitle}>On leave today</Text>
                    <Text style={styles.dashboardMetricValue}>{todayOnLeaveCount}</Text>
                    <View style={styles.dashboardMetricPill}>
                      <Text style={styles.dashboardMetricPillText}>
                        {Math.round((todayOnLeaveCount / (teamProfiles.length || 1)) * 100)}% of staff
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.dashboardMetricCard}
                    onPress={() => {
                      setActiveTab('more');
                      setMoreSection('approvals');
                    }}
                  >
                    <Text style={styles.dashboardMetricSubtitle}>Pending approvals</Text>
                    <Text style={[styles.dashboardMetricValue, totalPendingApprovals > 0 && { color: '#f59e0b' }]}>
                      {totalPendingApprovals}
                    </Text>
                    <View style={styles.dashboardMetricPill}>
                      <Text style={styles.dashboardMetricPillText}>Leave & access →</Text>
                    </View>
                  </TouchableOpacity>
                </>
              ) : isManagerRole ? (
                /* MANAGER VIEW (Focused on managed direct reports) */
                <>
                  <View style={styles.dashboardMetricCard}>
                    <Text style={styles.dashboardMetricSubtitle}>My team members</Text>
                    <Text style={styles.dashboardMetricValue}>{myManagedEmployees.length || teamProfiles.length}</Text>
                    <View style={styles.dashboardMetricPill}>
                      <Text style={styles.dashboardMetricPillText}>Direct reports</Text>
                    </View>
                  </View>

                  <View style={styles.dashboardMetricCard}>
                    <Text style={styles.dashboardMetricSubtitle}>Team present</Text>
                    <Text style={styles.dashboardMetricValue}>{myTeamPresentCount}</Text>
                    <View style={styles.dashboardMetricPill}>
                      <Text style={styles.dashboardMetricPillText}>
                        {Math.round((myTeamPresentCount / (myManagedEmployees.length || 1)) * 100)}% present
                      </Text>
                    </View>
                  </View>

                  <View style={styles.dashboardMetricCard}>
                    <Text style={styles.dashboardMetricSubtitle}>Team on leave</Text>
                    <Text style={styles.dashboardMetricValue}>{myTeamOnLeaveCount}</Text>
                    <View style={styles.dashboardMetricPill}>
                      <Text style={styles.dashboardMetricPillText}>On leave today</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.dashboardMetricCard}
                    onPress={() => {
                      setActiveTab('more');
                      setMoreSection('approvals');
                    }}
                  >
                    <Text style={styles.dashboardMetricSubtitle}>Team approvals</Text>
                    <Text style={[styles.dashboardMetricValue, myTeamPendingApprovalsCount > 0 && { color: '#f59e0b' }]}>
                      {myTeamPendingApprovalsCount}
                    </Text>
                    <View style={styles.dashboardMetricPill}>
                      <Text style={styles.dashboardMetricPillText}>Action queue →</Text>
                    </View>
                  </TouchableOpacity>
                </>
              ) : (
                /* INDIVIDUAL EMPLOYEE VIEW (Personal Stats) */
                <>
                  <View style={styles.dashboardMetricCard}>
                    <Text style={styles.dashboardMetricSubtitle}>This month present</Text>
                    <Text style={styles.dashboardMetricValue}>{myPresentDaysThisMonth}d</Text>
                    <View style={styles.dashboardMetricPill}>
                      <Text style={styles.dashboardMetricPillText}>Punches recorded</Text>
                    </View>
                  </View>

                  <View style={styles.dashboardMetricCard}>
                    <Text style={styles.dashboardMetricSubtitle}>Leave balance</Text>
                    <Text style={styles.dashboardMetricValue}>{myLeaveBalanceDays}d</Text>
                    <View style={styles.dashboardMetricPill}>
                      <Text style={styles.dashboardMetricPillText}>Available this year</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.dashboardMetricCard}
                    onPress={() => {
                      setActiveTab('more');
                      setMoreSection('standups');
                    }}
                  >
                    <Text style={styles.dashboardMetricSubtitle}>Daily standup</Text>
                    <Text style={[styles.dashboardMetricValue, { fontSize: 20 }]}>
                      {todayStandupSubmitted ? 'Done ✅' : 'Pending ⏳'}
                    </Text>
                    <View style={styles.dashboardMetricPill}>
                      <Text style={styles.dashboardMetricPillText}>{todayStandupSubmitted ? 'Logged today' : 'Tap to submit →'}</Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.dashboardMetricCard}>
                    <Text style={styles.dashboardMetricSubtitle}>Shift timing</Text>
                    <Text style={[styles.dashboardMetricValue, { fontSize: 16, marginTop: 4 }]}>
                      {currentOrg?.settings?.shiftStartTime || '09:30'} - {currentOrg?.settings?.shiftEndTime || '18:30'}
                    </Text>
                    <View style={styles.dashboardMetricPill}>
                      <Text style={styles.dashboardMetricPillText}>{(isCheckedIn || todayAttendanceRecord) ? 'Present logged' : 'Rest / Ready'}</Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Daily Standup Action Card (All Roles: Superadmin, Manager, Employee) */}
            <View style={styles.dashboardSectionCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 6 }}>
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: todayStandupSubmitted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: todayStandupSubmitted ? '#10b981' : '#f59e0b'
                  }}>
                    <Text style={{ fontSize: 18 }}>{todayStandupSubmitted ? '✅' : '🚀'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dashboardCardTitle, { marginBottom: 2 }]}>
                      {todayStandupSubmitted ? "Today's EOD Standup Logged" : "Daily EOD Standup Pending"}
                    </Text>
                    <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                      {todayStandupSubmitted
                        ? "Your accomplishments and shift hours are synced with Supabase"
                        : "Log what you accomplished today and planned next shift"}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.compactJoinBtn,
                    { backgroundColor: todayStandupSubmitted ? (isDarkMode ? '#1e293b' : '#f1f5f9') : '#2563eb' }
                  ]}
                  onPress={() => setIsStandupModal(true)}
                >
                  <Text style={[
                    styles.compactJoinBtnText,
                    todayStandupSubmitted && { color: isDarkMode ? '#38bdf8' : '#2563eb' }
                  ]}>
                    {todayStandupSubmitted ? '✏️ Edit' : '+ Submit'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Daily Corporate Inspiration Quote Card */}
            {(() => {
              const quotes = [
  { text: "Quality means doing it right when no one is looking.", author: "Henry Ford" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Excellence is not an act, but a habit.", author: "Aristotle" },
  { text: "Talent wins games, but teamwork and intelligence win championships.", author: "Michael Jordan" },
  { text: "Alone we can do so little; together we can do so much.", author: "Helen Keller" },
  { text: "Great things in business are never done by one person.", author: "Steve Jobs" }
];
              const todayQuote = quotes[new Date().getDate() % quotes.length];
              return (
                <View style={styles.dashboardQuoteCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Text style={{ fontSize: 14 }}>💡</Text>
                    <Text style={styles.dashboardQuoteHeading}>DAILY WORKPLACE INSPIRATION</Text>
                  </View>
                  <Text style={styles.dashboardQuoteText}>"{todayQuote.text}"</Text>
                  <Text style={styles.dashboardQuoteAuthor}>— {todayQuote.author}</Text>
                </View>
              );
            })()}

            {/* UPCOMING MEETINGS CARD (Dashboard First Page - Clean Modern UI) */}
            {(() => {
              const upcomingMeetings = meetings.filter((m) => m.date >= todayStr);
              return (
                <View style={styles.dashboardSectionCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 16 }}>📹</Text>
                      <Text style={styles.dashboardCardTitle}>Upcoming Meetings ({upcomingMeetings.length})</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setActiveTab('more');
                        setMoreSection('meetings');
                      }}
                    >
                      <Text style={styles.viewAllLinkText}>View All →</Text>
                    </TouchableOpacity>
                  </View>

                  {upcomingMeetings.length === 0 ? (
                    <View style={styles.emptyCardContainer}>
                      <Text style={{ fontSize: 20, marginBottom: 2 }}>🗓️</Text>
                      <Text style={styles.emptyCardHeading}>No upcoming meetings scheduled</Text>
                      <Text style={styles.emptyCardSubtext}>Your schedule is clear to focus on work</Text>
                    </View>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {upcomingMeetings.slice(0, 2).map((m) => {
                        const meetUrl = m.meeting_url || m.meetingUrl || 'https://meet.google.com/new';
                        return (
                          <View key={m.id} style={styles.compactMeetingItem}>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                <View style={styles.meetingDeptBadge}>
                                  <Text style={styles.meetingDeptBadgeText}>{(m.department || 'ALL').toUpperCase()}</Text>
                                </View>
                                <Text style={styles.compactMeetingDateText}>• {formatDisplayDate(m.date)}</Text>
                              </View>
                              <Text style={styles.compactMeetingTitleText} numberOfLines={1}>{m.title}</Text>
                              <Text style={styles.compactMeetingTimeText}>⏰ {m.start_time} - {m.end_time || '1 hr'} IST</Text>
                            </View>

                            <TouchableOpacity
                              style={styles.compactJoinBtn}
                              onPress={() => Linking.openURL(meetUrl).catch(() => Alert.alert('Error', 'Could not open meeting link.'))}
                            >
                              <Text style={styles.compactJoinBtnText}>🎥 Join</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })()}

            {/* COMPANY ANNOUNCEMENTS CARD (Dashboard First Page - Clean Modern UI) */}
            <View style={styles.dashboardSectionCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16 }}>📢</Text>
                  <Text style={styles.dashboardCardTitle}>Company Notices ({notices.length})</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setActiveTab('more');
                    setMoreSection('notices');
                  }}
                >
                  <Text style={styles.viewAllLinkText}>View All →</Text>
                </TouchableOpacity>
              </View>

              {notices.length === 0 ? (
                <View style={styles.emptyCardContainer}>
                  <Text style={styles.emptyCardHeading}>No company announcements published yet</Text>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {notices.slice(0, 2).map((notice) => (
                    <TouchableOpacity
                      key={notice.id}
                      style={styles.compactNoticeItem}
                      onPress={() => setSelectedNoticeForView(notice)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                        <View style={[
                          styles.noticePriorityBadge,
                          notice.priority === 'urgent' ? styles.priorityUrgent :
                          notice.priority === 'high' ? styles.priorityHigh : styles.priorityNormal
                        ]}>
                          <Text style={styles.noticePriorityText}>{(notice.priority || 'NORMAL').toUpperCase()}</Text>
                        </View>
                        <Text style={styles.compactNoticeDateText}>{formatNoticeDate(notice)}</Text>
                      </View>
                      <Text style={styles.compactNoticeTitleText} numberOfLines={1}>{notice.title}</Text>
                      <Text style={styles.compactNoticeSnippetText} numberOfLines={2}>{notice.content}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Attendance, past 7 days card */}
            <View style={styles.dashboardChartCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.dashboardCardTitle}>Attendance, past 7 days</Text>
                <View style={styles.chartBadgePill}>
                  <Text style={styles.chartBadgePillText}>{overallPast7DaysRate}%</Text>
                </View>
              </View>

              {/* Smooth 7-Day Trend Chart */}
              <View style={styles.chartContainer}>
                <View style={styles.chartGuideLine} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 70, paddingHorizontal: 12 }}>
                  {past7DaysData.map((d, idx) => {
                    const normalizedRate = Math.max(15, Math.min(100, d.rate || (idx === 6 ? 78 : (idx % 2 === 0 ? 85 : 70))));
                    const barHeight = Math.round((normalizedRate / 100) * 55);
                    const isLast = idx === past7DaysData.length - 1;

                    return (
                      <View key={d.dateStr || idx} style={{ alignItems: 'center', flex: 1 }}>
                        <View style={{ height: 60, justifyContent: 'flex-end', alignItems: 'center' }}>
                          <View
                            style={[
                              styles.chartPointDot,
                              isLast && styles.chartPointDotActive
                            ]}
                          />
                          <View
                            style={[
                              styles.chartVerticalBar,
                              { height: barHeight },
                              isLast && { backgroundColor: '#2563eb' }
                            ]}
                          />
                        </View>
                        <Text style={[styles.chartDayLabel, isLast && { color: '#2563eb', fontWeight: 'bold' }]}>
                          {d.dayLabel}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Recent activity card */}
            <View style={styles.dashboardChartCard}>
              <Text style={[styles.dashboardCardTitle, { marginBottom: 10 }]}>Recent activity</Text>
              {todayVerifiedPunches.length === 0 ? (
                <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                    {isSuperadminRole || isPrivilegedRole
                      ? 'No attendance punches logged yet today'
                      : isManagerRole
                      ? 'No punches logged by your team yet today'
                      : 'No punch recorded yet today'}
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {todayVerifiedPunches.slice(0, 5).map((punch) => {
                    const emp = teamProfiles.find((p) => p.id === punch.employee_id);
                    const empName = emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() : 'Employee';
                    const initial = (emp?.first_name?.[0] || 'E').toUpperCase();
                    const color = getAvatarColor(empName);
                    const timeStr = punch.check_in_time ? formatISTTimeOnly(punch.check_in_time) : '09:00 am';

                    return (
                      <View key={punch.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={[styles.recentActivityAvatar, { backgroundColor: color }]}>
                          <Text style={styles.recentActivityAvatarText}>{initial}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recentActivityName}>
                            {empName} <Text style={{ fontWeight: 'normal', color: isDarkMode ? '#94a3b8' : '#64748b' }}>marked attendance</Text>
                          </Text>
                          <Text style={styles.recentActivityTime}>{timeStr} IST</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* 2. SCREEN 2: EMPLOYEES DIRECTORY TAB (Aligned with Screenshot 2)          */}
        {/* ========================================================================= */}
        {activeTab === 'people' && (
          <View style={{ gap: 12 }}>
            {/* Title & Count */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.screenMainTitle}>
                Employees <Text style={{ color: '#94a3b8', fontSize: 16 }}>· {filteredEmployeesList.length}</Text>
              </Text>
              {isPrivileged && (
                <TouchableOpacity
                  style={styles.smallAddBtn}
                  onPress={() => setIsAddEmpModal(true)}
                >
                  <Text style={styles.smallAddBtnText}>+ Add Member</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Search Input Bar */}
            <View style={styles.searchBarContainer}>
              <Text style={{ fontSize: 15, marginRight: 8, color: '#94a3b8' }}>🔍</Text>
              <TextInput
                style={styles.searchBarInput}
                value={empDirectorySearch}
                onChangeText={setEmpDirectorySearch}
                placeholder="Search employees"
                placeholderTextColor="#94a3b8"
              />
              {empDirectorySearch.length > 0 && (
                <TouchableOpacity onPress={() => setEmpDirectorySearch('')}>
                  <Text style={{ color: '#94a3b8', fontSize: 14 }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Filter Pills */}
            <View style={{ flexDirection: 'row', gap: 8, marginVertical: 4 }}>
              {[
                { key: 'all', label: 'All' },
                { key: 'present', label: 'Present' },
                { key: 'on_leave', label: 'On leave' }
              ].map((pill) => {
                const isActive = empDirectoryFilter === pill.key;
                return (
                  <TouchableOpacity
                    key={pill.key}
                    style={[
                      styles.filterPill,
                      isActive && styles.filterPillActive
                    ]}
                    onPress={() => setEmpDirectoryFilter(pill.key as any)}
                  >
                    <Text style={[
                      styles.filterPillText,
                      isActive && styles.filterPillTextActive
                    ]}>
                      {pill.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Employee Cards List */}
            <View style={{ gap: 8, marginTop: 4 }}>
              {filteredEmployeesList.length === 0 ? (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <Text style={{ color: '#94a3b8', fontSize: 13 }}>No employees found matching filter</Text>
                </View>
              ) : (
                filteredEmployeesList.map((emp) => {
                  const empName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Employee';
                  const initial = (emp.first_name?.[0] || 'E').toUpperCase();
                  const avatarBg = getAvatarColor(empName);
                  const isPresentToday = attendanceRecords.some((a) => {
                    if (a.employee_id !== emp.id || a.date !== todayStr) return false;
                    const isRejected = a.regularization_status === 'rejected' || a.approval_status === 'rejected';
                    if (isRejected) return false;
                    return a.status === 'present' || a.status === 'regularized' || a.regularization_status === 'approved' || a.approval_status === 'approved';
                  });
                  const isOnLeaveToday = leaveRequests.some((l) => l.employee_id === emp.id && l.status === 'approved' && l.start_date <= todayStr && l.end_date >= todayStr);

                  return (
                    <TouchableOpacity
                      key={emp.id}
                      style={styles.empDirectoryCard}
                      activeOpacity={0.75}
                      onPress={() => setInspectedUserProfile(emp)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                        <View style={[styles.empAvatarCircle, { backgroundColor: avatarBg }]}>
                          <Text style={styles.empAvatarInitial}>{initial}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.empCardName} numberOfLines={1}>{empName}</Text>
                          <Text style={styles.empCardRole} numberOfLines={1}>{emp.designation || emp.role || 'Staff'}</Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {isPrivileged && (
                          <TouchableOpacity
                            style={styles.empCardEditBtn}
                            onPress={() => handleOpenEditEmployee(emp)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={styles.empCardEditBtnText}>✏️ Edit</Text>
                          </TouchableOpacity>
                        )}
                        {/* Status badge pill on right */}
                        <View style={[
                          styles.empStatusPill,
                          isPresentToday ? styles.empStatusPillPresent :
                          isOnLeaveToday ? styles.empStatusPillLeave : styles.empStatusPillAbsent
                        ]}>
                          <Text style={[
                            styles.empStatusPillText,
                            isPresentToday ? styles.empStatusPillTextPresent :
                            isOnLeaveToday ? styles.empStatusPillTextLeave : styles.empStatusPillTextAbsent
                          ]}>
                            {isPresentToday ? 'Present' : isOnLeaveToday ? 'On leave' : 'Absent'}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* 2. ENTERPRISE TEAM CHAT TAB (Design Reference Aligned) */}
        {/* ========================================================================= */}
        {activeTab === 'chat' && (
          <View style={{ gap: 10 }}>
            {/* =================================================================== */}
            {/* MODE 1: WORKSPACE SIDEBAR VIEW (Full Navigation & Directory)        */}
            {/* =================================================================== */}
            {chatViewMode === 'sidebar' && (
              <View style={{ gap: 12 }}>
                {/* Workspace Hub Card */}
                <View style={{
                  backgroundColor: '#3F0E40',
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: '#522653',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.2,
                  shadowRadius: 5,
                  elevation: 4
                }}>
                  {/* Workspace Title & Create Channel Row */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: '#ffffff', letterSpacing: 0.3 }} numberOfLines={1}>
                        {currentOrg?.name || 'Vedotrix Workspace'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#10b981' }} />
                        <Text style={{ fontSize: 11, color: '#e0cde2', fontWeight: '600' }}>
                          Online • {userProfile?.first_name || 'You'} ({userProfile?.designation || userProfile?.role || 'Staff'})
                        </Text>
                      </View>
                    </View>

                    {isPrivileged && (
                      <TouchableOpacity
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.18)',
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.3)'
                        }}
                        onPress={() => {
                          setNewChanName('');
                          setNewChanDesc('');
                          setIsNewChannelModal(true);
                        }}
                      >
                        <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: 'bold' }}>+ New Channel</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Channel & Colleague Search Bar */}
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.2)'
                  }}>
                    <Text style={{ marginRight: 6, fontSize: 13, color: '#f1def4' }}>🔍</Text>
                    <TextInput
                      style={{ flex: 1, color: '#ffffff', fontSize: 13, padding: 0 }}
                      placeholder="Jump to a channel or colleague..."
                      placeholderTextColor="#d1a4d6"
                      value={chatSearchQuery}
                      onChangeText={setChatSearchQuery}
                    />
                    {Boolean(chatSearchQuery) && (
                      <TouchableOpacity onPress={() => setChatSearchQuery('')}>
                        <Text style={{ color: '#e0cde2', fontSize: 12, fontWeight: 'bold', paddingHorizontal: 4 }}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* 1. PUBLIC CHANNELS SECTION */}
                <View style={[styles.card, { paddingVertical: 12, paddingHorizontal: 14 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: isDarkMode ? '#94a3b8' : '#475569', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                      # Channels ({availableChannels.filter((c) => !c.is_private).length})
                    </Text>
                    <Text style={{ fontSize: 10, color: '#0284c7', fontWeight: 'bold' }}>Public Discussions</Text>
                  </View>

                  <View style={{ gap: 6 }}>
                    {availableChannels
                      .filter((c) => !c.is_private && (!chatSearchQuery.trim() || c.name.toLowerCase().includes(chatSearchQuery.toLowerCase())))
                      .map((chan) => {
                        const chanId = chan.id || chan.name;
                        const isCurrentActive = !chatRecipient && (activeChatChannel === chanId || activeChatChannel === chan.name);
                        return (
                          <TouchableOpacity
                            key={chan.id || chan.name}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              borderRadius: 10,
                              backgroundColor: isCurrentActive
                                ? (isDarkMode ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.1)')
                                : (isDarkMode ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc'),
                              borderWidth: 1,
                              borderColor: isCurrentActive ? '#0284c7' : (isDarkMode ? '#334155' : '#e2e8f0')
                            }}
                            onPress={() => {
                              setChatRecipient(null);
                              setActiveChatChannel(chanId);
                              setChatViewMode('conversation');
                            }}
                          >
                            <View style={{ flex: 1, marginRight: 10 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: isCurrentActive ? '#0284c7' : (isDarkMode ? '#f8fafc' : '#0f172a') }}>
                                  # {chan.name}
                                </Text>
                                {isCurrentActive && (
                                  <View style={{ backgroundColor: '#0284c7', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>Active</Text>
                                  </View>
                                )}
                              </View>
                              {Boolean(chan.description) && (
                                <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b', marginTop: 2 }} numberOfLines={1}>
                                  {chan.description}
                                </Text>
                              )}
                            </View>
                            <Text style={{ fontSize: 16, color: '#94a3b8' }}>›</Text>
                          </TouchableOpacity>
                        );
                      })}
                  </View>
                </View>

                {/* 2. PRIVATE GROUPS SECTION */}
                {availableChannels.some((c) => c.is_private) && (
                  <View style={[styles.card, { paddingVertical: 12, paddingHorizontal: 14 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                        🔒 Private Groups ({availableChannels.filter((c) => c.is_private).length})
                      </Text>
                      <Text style={{ fontSize: 10, color: '#f59e0b', fontWeight: 'bold' }}>Members Only</Text>
                    </View>

                    <View style={{ gap: 6 }}>
                      {availableChannels
                        .filter((c) => c.is_private && (!chatSearchQuery.trim() || c.name.toLowerCase().includes(chatSearchQuery.toLowerCase())))
                        .map((chan) => {
                          const chanId = chan.id || chan.name;
                          const isCurrentActive = !chatRecipient && (activeChatChannel === chanId || activeChatChannel === chan.name);
                          const memberCount = (chan.member_ids && Array.isArray(chan.member_ids)) ? chan.member_ids.length : 1;
                          return (
                            <TouchableOpacity
                              key={chan.id || chan.name}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingVertical: 10,
                                paddingHorizontal: 12,
                                borderRadius: 10,
                                backgroundColor: isCurrentActive
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : (isDarkMode ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc'),
                                borderWidth: 1,
                                borderColor: isCurrentActive ? '#f59e0b' : (isDarkMode ? '#334155' : '#e2e8f0')
                              }}
                              onPress={() => {
                                setChatRecipient(null);
                                setActiveChatChannel(chanId);
                                setChatViewMode('conversation');
                              }}
                            >
                              <View style={{ flex: 1, marginRight: 10 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: isCurrentActive ? '#f59e0b' : (isDarkMode ? '#fde68a' : '#b45309') }}>
                                    🔒 {chan.name}
                                  </Text>
                                  <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                                    <Text style={{ color: '#f59e0b', fontSize: 9, fontWeight: 'bold' }}>{memberCount} members</Text>
                                  </View>
                                </View>
                                {Boolean(chan.description) && (
                                  <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b', marginTop: 2 }} numberOfLines={1}>
                                    {chan.description}
                                  </Text>
                                )}
                              </View>
                              <Text style={{ fontSize: 16, color: '#f59e0b' }}>›</Text>
                            </TouchableOpacity>
                          );
                        })}
                    </View>
                  </View>
                )}

                {/* 3. DIRECT MESSAGES SECTION */}
                <View style={[styles.card, { paddingVertical: 12, paddingHorizontal: 14 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: isDarkMode ? '#94a3b8' : '#475569', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                      💬 Direct Messages ({teamProfiles.filter((p) => p.id !== userProfile?.id).length})
                    </Text>
                    <Text style={{ fontSize: 10, color: '#10b981', fontWeight: 'bold' }}>Colleagues</Text>
                  </View>

                  <View style={{ gap: 6 }}>
                    {teamProfiles
                      .filter((p) => {
                        if (p.id === userProfile?.id) return false;
                        if (!chatSearchQuery.trim()) return true;
                        const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
                        return (
                          fullName.includes(chatSearchQuery.toLowerCase()) ||
                          (p.designation && p.designation.toLowerCase().includes(chatSearchQuery.toLowerCase())) ||
                          (p.department && p.department.toLowerCase().includes(chatSearchQuery.toLowerCase()))
                        );
                      })
                      .map((member) => {
                        const isSelected = chatRecipient?.id === member.id;
                        const hasValidAvatar = member.avatar_url && (member.avatar_url.startsWith('http') || member.avatar_url.startsWith('data:image'));
                        const initials = ((member.first_name?.[0] || 'U') + (member.last_name?.[0] || '')).toUpperCase();
                        return (
                          <TouchableOpacity
                            key={member.id}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingVertical: 9,
                              paddingHorizontal: 12,
                              borderRadius: 10,
                              backgroundColor: isSelected
                                ? (isDarkMode ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.1)')
                                : (isDarkMode ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc'),
                              borderWidth: 1,
                              borderColor: isSelected ? '#0284c7' : (isDarkMode ? '#334155' : '#e2e8f0')
                            }}
                            onPress={() => {
                              setChatRecipient(member);
                              setChatViewMode('conversation');
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
                              <View style={{ position: 'relative' }}>
                                <View style={{ width: 34, height: 34, borderRadius: 17, overflow: 'hidden', backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' }}>
                                  {hasValidAvatar ? (
                                    <Image source={{ uri: member.avatar_url }} style={{ width: '100%', height: '100%' }} />
                                  ) : (
                                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{initials}</Text>
                                  )}
                                </View>
                                <View style={{ position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#10b981', borderWidth: 1.5, borderColor: isDarkMode ? '#0f172a' : '#ffffff' }} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                                  {member.first_name} {member.last_name || ''}
                                </Text>
                                <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b' }} numberOfLines={1}>
                                  {member.designation || member.department || 'Team Member'}
                                </Text>
                              </View>
                            </View>
                            <Text style={{ fontSize: 16, color: '#94a3b8' }}>›</Text>
                          </TouchableOpacity>
                        );
                      })}
                  </View>
                </View>
              </View>
            )}

            {/* =================================================================== */}
            {/* MODE 2: ACTIVE CONVERSATION VIEW (Header, Feed, & Composer)         */}
            {/* =================================================================== */}
            {chatViewMode === 'conversation' && (
              <View style={{ gap: 10 }}>
                {/* Conversation Header Bar (Deep Aubergine Theme) */}
                <View style={{
                  backgroundColor: '#3F0E40',
                  borderRadius: 14,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: '#522653',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 4,
                  elevation: 3
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    {/* Left: Back to Channels Button */}
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.25)'
                      }}
                      onPress={() => setChatViewMode('sidebar')}
                    >
                      <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: 'bold' }}>← Channels</Text>
                    </TouchableOpacity>

                    {/* Center: Title & Subtitle */}
                    <View style={{ flex: 1, marginHorizontal: 10, alignItems: 'center' }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#ffffff' }} numberOfLines={1}>
                        {chatRecipient
                          ? `@${chatRecipient.first_name} ${chatRecipient.last_name || ''}`
                          : (activeChanObj?.is_private ? `🔒 ${activeChanObj.name}` : `# ${activeChanObj?.name || activeChatChannel}`)}
                      </Text>
                      <Text style={{ fontSize: 10, color: '#e0cde2' }} numberOfLines={1}>
                        {chatRecipient
                          ? (chatRecipient.designation || 'Colleague')
                          : `${activeChannelMembers.length} members • ${activeChanObj?.description || 'Team discussion'}`}
                      </Text>
                    </View>

                    {/* Right: Channel Settings / DM Profile Button */}
                    {!chatRecipient ? (
                      <TouchableOpacity
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.18)',
                          paddingHorizontal: 9,
                          paddingVertical: 6,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.3)',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4
                        }}
                        onPress={() => {
                          setEditChannelNameInput(activeChanObj?.name || '');
                          setEditChannelDescInput(activeChanObj?.description || '');
                          setEditChannelIsPrivate(Boolean(activeChanObj?.is_private));
                          setCandidateMemberToAdd('');
                          setChannelSettingsTab('members');
                          setIsChannelSettingsModalOpen(true);
                        }}
                      >
                        <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: 'bold' }}>⚙️ Members</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={{
                          backgroundColor: 'rgba(56, 189, 248, 0.2)',
                          paddingHorizontal: 9,
                          paddingVertical: 6,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: 'rgba(56, 189, 248, 0.4)'
                        }}
                        onPress={() => setInspectedUserProfile(chatRecipient)}
                      >
                        <Text style={{ color: '#38bdf8', fontSize: 11, fontWeight: 'bold' }}>👤 Profile</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Pinned Messages Banner */}
                {pinnedMessages.length > 0 && (
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                      marginBottom: 2
                    }}
                    onPress={() => setShowPinnedMessagesModal(true)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 }}>
                      <Text style={{ fontSize: 13 }}>📌</Text>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                        {pinnedMessages.length} Pinned {pinnedMessages.length === 1 ? 'Message' : 'Messages'}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#94a3b8' }} numberOfLines={1}>
                        • {pinnedMessages[pinnedMessages.length - 1].sender_name}: "{pinnedMessages[pinnedMessages.length - 1].message || 'Attachment'}"
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#0284c7' }}>View All ›</Text>
                  </TouchableOpacity>
                )}

                {/* Messages Feed Area */}
                <View style={[styles.card, { minHeight: 360, paddingBottom: 10 }]}>
                  {activeConversationMessages.length === 0 ? (
                    <View style={{ paddingVertical: 45, alignItems: 'center' }}>
                      <Text style={{ fontSize: 34, marginBottom: 8 }}>💬</Text>
                      <Text style={{ color: isDarkMode ? '#ffffff' : '#0f172a', fontSize: 15, fontWeight: 'bold' }}>
                        Welcome to {chatRecipient ? `@${chatRecipient.first_name}` : (activeChanObj?.is_private ? `🔒${activeChanObj.name}` : `#${activeChanObj?.name || activeChatChannel}`)}!
                      </Text>
                      <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 4, textAlign: 'center', maxWidth: 280, lineHeight: 16 }}>
                        This is the start of your workspace conversation. Share messages, @mention colleagues, attach photos or documents to collaborate!
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 10 }}>
                      {activeConversationMessages.map((msg, index) => {
                        const isMe = msg.sender_id === userProfile?.id;
                        const prevMsg = index > 0 ? activeConversationMessages[index - 1] : null;

                        // Date Separator logic
                        const msgDateStr = new Date(msg.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
                        const prevMsgDateStr = prevMsg ? new Date(prevMsg.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : null;
                        const showDateSep = !prevMsgDateStr || msgDateStr !== prevMsgDateStr;
                        const todayDateStr = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
                        const yDate = new Date(); yDate.setDate(yDate.getDate() - 1);
                        const yDateStr = yDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
                        const datePillLabel = msgDateStr === todayDateStr ? 'Today' : msgDateStr === yDateStr ? 'Yesterday' : msgDateStr;

                        const isGrouped = !showDateSep && prevMsg && prevMsg.sender_id === msg.sender_id &&
                          (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 5 * 60 * 1000);
                        const senderProfile = teamProfiles.find((p) => p.id === msg.sender_id) || (isMe ? userProfile : null);

                        const effectiveAvatar = (senderProfile?.avatar_url && (senderProfile.avatar_url.startsWith('http') || senderProfile.avatar_url.startsWith('data:image')))
                          ? senderProfile.avatar_url
                          : (msg.sender_avatar && (msg.sender_avatar.startsWith('http') || msg.sender_avatar.startsWith('data:image')))
                            ? msg.sender_avatar
                            : null;
                        const initials = ((senderProfile?.first_name?.[0] || msg.sender_name?.[0] || 'U') + (senderProfile?.last_name?.[0] || '')).toUpperCase();

                        const isReactionPickerOpen = activeReactionMsgId === msg.id;
                        const safeAttachments = getSafeAttachments(msg.attachments);

                        return (
                          <React.Fragment key={msg.id || index}>
                            {showDateSep && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
                                <View style={{ flex: 1, height: 1, backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0' }} />
                                <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', paddingHorizontal: 12, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#cbd5e1' }}>
                                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: isDarkMode ? '#94a3b8' : '#64748b' }}>{datePillLabel}</Text>
                                </View>
                                <View style={{ flex: 1, height: 1, backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0' }} />
                              </View>
                            )}

                            <TouchableOpacity
                              activeOpacity={0.88}
                              onLongPress={() => setActiveMessageActionId(msg.id)}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'flex-start',
                                paddingVertical: isGrouped ? 3 : 6,
                                paddingHorizontal: 8,
                                borderRadius: 10,
                                backgroundColor: isMe
                                  ? (isDarkMode ? 'rgba(56, 189, 248, 0.08)' : 'rgba(2, 132, 199, 0.06)')
                                  : 'transparent',
                                borderLeftWidth: isMe ? 3 : 0,
                                borderLeftColor: '#0284c7',
                                marginBottom: isGrouped ? 2 : 6
                              }}
                            >
                              {/* Left Avatar */}
                              <View style={{ width: 36, marginRight: 10, alignItems: 'center' }}>
                                {!isGrouped ? (
                                  <TouchableOpacity
                                    style={{ width: 34, height: 34, borderRadius: 17, overflow: 'hidden', backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' }}
                                    onPress={() => senderProfile && setInspectedUserProfile(senderProfile)}
                                  >
                                    {effectiveAvatar ? (
                                      <Image source={{ uri: effectiveAvatar }} style={{ width: '100%', height: '100%' }} />
                                    ) : (
                                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
                                        {initials}
                                      </Text>
                                    )}
                                  </TouchableOpacity>
                                ) : (
                                  <View style={{ width: 34 }} />
                                )}
                              </View>

                              {/* Right Content Column */}
                              <View style={{ flex: 1 }}>
                                {/* Sender Info Row */}
                                {!isGrouped && (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                                      <TouchableOpacity onPress={() => senderProfile && setInspectedUserProfile(senderProfile)}>
                                        <Text style={{ fontSize: 13, fontWeight: '800', color: isMe ? '#0284c7' : (isDarkMode ? '#f8fafc' : '#0f172a') }}>
                                          {isMe ? `${userProfile?.first_name || 'You'} (You)` : msg.sender_name}
                                        </Text>
                                      </TouchableOpacity>
                                      {senderProfile?.designation && (
                                        <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#e0f2fe', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 5 }}>
                                          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#0284c7' }}>{senderProfile.designation}</Text>
                                        </View>
                                      )}
                                      <Text style={{ fontSize: 10, color: '#94a3b8' }}>
                                        {formatISTTimeOnly(msg.created_at)}
                                      </Text>
                                      {msg.is_edited && (
                                        <Text style={{ fontSize: 9, color: '#94a3b8', fontStyle: 'italic' }}>(edited)</Text>
                                      )}
                                      {msg.is_pinned && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(245, 158, 11, 0.18)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                          <Text style={{ fontSize: 9 }}>📌</Text>
                                          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#f59e0b' }}>Pinned</Text>
                                        </View>
                                      )}
                                    </View>

                                    <TouchableOpacity
                                      style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}
                                      onPress={() => setActiveMessageActionId(msg.id)}
                                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                      <Text style={{ color: '#94a3b8', fontSize: 15, fontWeight: 'bold' }}>⋯</Text>
                                    </TouchableOpacity>
                                  </View>
                                )}

                                {/* Message Text or Inline Edit Box */}
                                {editingMessageId === msg.id ? (
                                  <View style={{
                                    backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                                    borderWidth: 1,
                                    borderColor: '#0284c7',
                                    borderRadius: 10,
                                    padding: 8,
                                    marginTop: 4
                                  }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#0284c7' }}>✏️ Editing Message</Text>
                                      <Text style={{ fontSize: 9, color: '#94a3b8' }}>• 15-min window</Text>
                                    </View>
                                    <TextInput
                                      style={{
                                        color: isDarkMode ? '#f8fafc' : '#0f172a',
                                        fontSize: 13,
                                        minHeight: 45,
                                        padding: 8,
                                        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                                        borderRadius: 6,
                                        borderWidth: 1,
                                        borderColor: isDarkMode ? '#334155' : '#e2e8f0'
                                      }}
                                      value={editingMessageText}
                                      onChangeText={setEditingMessageText}
                                      multiline
                                      autoFocus
                                    />
                                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                                      <TouchableOpacity
                                        style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: isDarkMode ? '#334155' : '#e2e8f0' }}
                                        onPress={() => { setEditingMessageId(null); setEditingMessageText(''); }}
                                      >
                                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#475569' }}>Cancel</Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6, backgroundColor: '#0284c7', opacity: isSavingMessageEdit || !editingMessageText.trim() ? 0.6 : 1 }}
                                        disabled={isSavingMessageEdit || !editingMessageText.trim()}
                                        onPress={() => editChatMessage(msg.id, editingMessageText)}
                                      >
                                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#ffffff' }}>
                                          {isSavingMessageEdit ? 'Saving...' : 'Save Changes'}
                                        </Text>
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                ) : (
                                  msg.message && msg.message !== '📷 Photo attached' && (() => {
                                    const isLong = msg.message.length > 250 || (msg.message.match(/\n/g) || []).length >= 5;
                                    const isExpanded = expandedChatMsgIds.includes(msg.id);
                                    const displayText = isLong && !isExpanded
                                      ? msg.message.slice(0, 250).trimEnd() + '…'
                                      : msg.message;

                                    return (
                                      <View style={{ marginTop: 1 }}>
                                        {renderMessageContentWithMentions(displayText, false)}
                                        {isLong && (
                                          <TouchableOpacity
                                            onPress={() => toggleChatMsgExpanded(msg.id)}
                                            style={{ marginTop: 4, paddingVertical: 2, alignSelf: 'flex-start' }}
                                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                          >
                                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#0284c7' }}>
                                              {isExpanded ? 'Show less ↑' : 'Read more ↓'}
                                            </Text>
                                          </TouchableOpacity>
                                        )}
                                      </View>
                                    );
                                  })()
                                )}

                                {/* Attachments rendering (Images, Documents, PDFs) */}
                                {safeAttachments.length > 0 && (
                                  <View style={{ gap: 8, marginTop: 6 }}>
                                    {safeAttachments.map((att: any, attIdx: number) => {
                                      const fileName = att.name || 'Attachment';
                                      const lowerName = fileName.toLowerCase();
                                      const isImg = att.category === 'image' ||
                                        lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') ||
                                        lowerName.endsWith('.webp') || lowerName.endsWith('.gif') ||
                                        (att.url && att.url.startsWith('data:image/'));

                                      if (!isImg) {
                                        const isPdf = lowerName.endsWith('.pdf');
                                        const isSheet = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv');
                                        const isWord = lowerName.endsWith('.doc') || lowerName.endsWith('.docx');
                                        const isZip = lowerName.endsWith('.zip') || lowerName.endsWith('.rar');

                                        const docBadgeBg = isPdf ? '#ef4444' : isSheet ? '#10b981' : isWord ? '#3b82f6' : isZip ? '#f59e0b' : '#64748b';
                                        const docIcon = isPdf ? '📕' : isSheet ? '📗' : isWord ? '📘' : isZip ? '📦' : '📄';
                                        const docTypeLabel = isPdf ? 'PDF Document' : isSheet ? 'Spreadsheet' : isWord ? 'Word Document' : isZip ? 'Archive' : 'Document';

                                        return (
                                          <TouchableOpacity
                                            key={att.id || attIdx}
                                            activeOpacity={0.85}
                                            style={{
                                              flexDirection: 'row',
                                              alignItems: 'center',
                                              gap: 12,
                                              backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                                              padding: 12,
                                              borderRadius: 12,
                                              borderWidth: 1,
                                              borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                                              maxWidth: 320,
                                              shadowColor: '#000',
                                              shadowOffset: { width: 0, height: 1 },
                                              shadowOpacity: 0.08,
                                              shadowRadius: 2,
                                              elevation: 2
                                            }}
                                            onPress={() => handleOpenMobileAttachment(att)}
                                          >
                                            <View style={{
                                              width: 40,
                                              height: 40,
                                              borderRadius: 10,
                                              backgroundColor: docBadgeBg + '22',
                                              borderWidth: 1,
                                              borderColor: docBadgeBg + '55',
                                              alignItems: 'center',
                                              justifyContent: 'center'
                                            }}>
                                              <Text style={{ fontSize: 20 }}>{docIcon}</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                              <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#f8fafc' : '#0f172a' }} numberOfLines={1}>
                                                {fileName}
                                              </Text>
                                              <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, fontWeight: '600' }}>
                                                {att.size ? `${formatAttachmentSize(att.size)} • ` : ''}{docTypeLabel}
                                              </Text>
                                            </View>
                                            <View style={{
                                              backgroundColor: '#0284c7',
                                              paddingHorizontal: 8,
                                              paddingVertical: 5,
                                              borderRadius: 6
                                            }}>
                                              <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: 'bold' }}>View ↗</Text>
                                            </View>
                                          </TouchableOpacity>
                                        );
                                      }

                                      // Photo Attachment Card
                                      const rawImgUrl = att.url || '';
                                      const safeImgUri = rawImgUrl.startsWith('data:') || rawImgUrl.startsWith('http')
                                        ? rawImgUrl.replace(/\s+/g, '')
                                        : `data:image/jpeg;base64,${rawImgUrl.replace(/\s+/g, '')}`;

                                      return (
                                        <TouchableOpacity
                                          key={att.id || attIdx}
                                          activeOpacity={0.88}
                                          onPress={() => setChatImageLightboxUrl(safeImgUri)}
                                          style={{
                                            borderRadius: 12,
                                            overflow: 'hidden',
                                            maxWidth: 260,
                                            borderWidth: 1,
                                            borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                                            backgroundColor: '#0f172a',
                                            marginTop: 2
                                          }}
                                        >
                                          <Image
                                            source={{ uri: safeImgUri }}
                                            style={{ width: 260, height: 180, borderRadius: 11 }}
                                            resizeMode="cover"
                                          />
                                          <View style={{
                                            position: 'absolute',
                                            bottom: 6,
                                            right: 6,
                                            backgroundColor: 'rgba(0,0,0,0.65)',
                                            paddingHorizontal: 6,
                                            paddingVertical: 2,
                                            borderRadius: 6,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 4
                                          }}>
                                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>🔍 Tap to zoom</Text>
                                          </View>
                                        </TouchableOpacity>
                                      );
                                    })}
                                  </View>
                                )}

                                {/* Reactions Badges & Add Reaction Button */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                                  {msg.reactions && Array.isArray(msg.reactions) && msg.reactions.map((r: any, rIdx: number) => {
                                    const hasReacted = r.userIds && r.userIds.includes(userProfile?.id);
                                    return (
                                      <TouchableOpacity
                                        key={r.emoji || rIdx}
                                        style={{
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          gap: 4,
                                          backgroundColor: hasReacted ? 'rgba(56, 189, 248, 0.2)' : (isDarkMode ? '#1e293b' : '#f1f5f9'),
                                          borderColor: hasReacted ? '#0284c7' : (isDarkMode ? '#334155' : '#cbd5e1'),
                                          borderWidth: 1,
                                          borderRadius: 12,
                                          paddingHorizontal: 8,
                                          paddingVertical: 2
                                        }}
                                        onPress={() => addChatReaction(msg.id, r.emoji)}
                                      >
                                        <Text style={{ fontSize: 12 }}>{r.emoji}</Text>
                                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: hasReacted ? '#0284c7' : (isDarkMode ? '#94a3b8' : '#64748b') }}>
                                          {r.count}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}

                                  {/* Toggle Quick Reaction Bar */}
                                  <TouchableOpacity
                                    style={{
                                      backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
                                      paddingHorizontal: 7,
                                      paddingVertical: 2,
                                      borderRadius: 10,
                                      borderWidth: 1,
                                      borderColor: isDarkMode ? '#334155' : '#cbd5e1'
                                    }}
                                    onPress={() => setActiveReactionMsgId(isReactionPickerOpen ? null : msg.id)}
                                  >
                                    <Text style={{ fontSize: 11, color: '#94a3b8' }}>☺ +</Text>
                                  </TouchableOpacity>
                                </View>

                                {/* Quick Reaction Emoji Picker Row */}
                                {isReactionPickerOpen && (
                                  <View style={{
                                    flexDirection: 'row',
                                    gap: 6,
                                    backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 14,
                                    borderWidth: 1,
                                    borderColor: '#0284c7',
                                    marginTop: 6,
                                    alignSelf: 'flex-start',
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.2,
                                    shadowRadius: 3,
                                    elevation: 4
                                  }}>
                                    {['👍', '❤️', '🎉', '🔥', '🚀', '👀', '👏', '💯'].map((em) => (
                                      <TouchableOpacity
                                        key={em}
                                        style={{ padding: 4 }}
                                        onPress={() => addChatReaction(msg.id, em)}
                                      >
                                        <Text style={{ fontSize: 18 }}>{em}</Text>
                                      </TouchableOpacity>
                                    ))}
                                  </View>
                                )}
                              </View>
                            </TouchableOpacity>
                          </React.Fragment>
                        );
                      })}
                    </View>
                  )}

                  {/* Mention Suggestions Popover (Appears above composer when typing @) */}
                  {mentionCandidates.length > 0 && (
                    <View style={{
                      backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                      borderWidth: 1,
                      borderColor: '#0284c7',
                      borderRadius: 12,
                      marginTop: 10,
                      overflow: 'hidden',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: -2 },
                      shadowOpacity: 0.15,
                      shadowRadius: 4,
                      elevation: 5
                    }}>
                      <View style={{ backgroundColor: '#0284c7', paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#ffffff' }}>Mention Colleague</Text>
                      </View>
                      {mentionCandidates.map((cand) => (
                        <TouchableOpacity
                          key={cand.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderBottomWidth: 1,
                            borderBottomColor: isDarkMode ? '#1e293b' : '#f1f5f9'
                          }}
                          onPress={() => insertMentionIntoInput(cand)}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ fontSize: 14 }}>{cand.isSpecial ? '📢' : '👤'}</Text>
                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                              {cand.isSpecial ? '@all' : `@${cand.first_name} ${cand.last_name || ''}`}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 10, color: '#94a3b8' }}>{cand.designation}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Compose Box (Clean, Enterprise bottom bar) */}
                  <View style={styles.chatComposerContainer}>
                    {/* Left Attachment / Action Plus Button */}
                    <TouchableOpacity
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#334155' : '#cbd5e1'
                      }}
                      onPress={() => {
                        Alert.alert(
                          'Attach & Share 📎',
                          'Choose an action for this conversation:',
                          [
                            { text: '📸 Take Photo (Camera)', onPress: () => pickAndSendChatPhoto(true) },
                            { text: '🖼️ Choose Photo (Gallery)', onPress: () => pickAndSendChatPhoto(false) },
                            { text: '📄 Attach Document / PDF URL', onPress: () => setIsAttachingDocModalOpen(true) },
                            { text: '✨ Choose Instant Avatar (No Reinstall)', onPress: () => setIsPhotoPickerModalOpen(true) },
                            { text: 'Cancel', style: 'cancel' }
                          ]
                        );
                      }}
                    >
                      <Text style={{ fontSize: 18, fontWeight: '700', color: '#0284c7' }}>+</Text>
                    </TouchableOpacity>

                    <TextInput
                      style={styles.chatComposerInput}
                      value={chatInputText}
                      onChangeText={setChatInputText}
                      placeholder={chatRecipient ? `Message @${chatRecipient.first_name}...` : `Message #${activeChanObj?.name || activeChatChannel}...`}
                      placeholderTextColor="#64748b"
                      multiline
                    />

                    <TouchableOpacity
                      style={[styles.chatSendBtn, (!chatInputText.trim() || isSendingMessage) && { opacity: 0.5 }]}
                      onPress={handleSendMessage}
                      disabled={!chatInputText.trim() || isSendingMessage}
                    >
                      <Text style={styles.chatSendBtnText}>
                        {isSendingMessage ? '...' : 'Send'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* 3. SCREEN 3: ATTENDANCE & SHIFTS TAB (Aligned with Screenshot 3)          */}
        {/* ========================================================================= */}
        {(activeTab === 'attendance' || activeTab === 'calendar') && (
          <View style={{ gap: 14 }}>
            {/* Top Subview Switcher Pills */}
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 2 }}>
              {[
                { key: 'today', label: 'Attendance' },
                { key: 'roster', label: 'Team Roster' },
                { key: 'calendar', label: 'Calendar' },
                { key: 'pdf', label: 'Export PDF' }
              ].map((sub) => {
                const isActive = attendanceSubView === sub.key;
                return (
                  <TouchableOpacity
                    key={sub.key}
                    style={[
                      styles.attendanceSubTabPill,
                      isActive && styles.attendanceSubTabPillActive
                    ]}
                    onPress={() => {
                      setAttendanceSubView(sub.key as any);
                      if (sub.key === 'roster') setCalSubTab('roster');
                      else if (sub.key === 'calendar') setCalSubTab('attendance');
                    }}
                  >
                    <Text style={[
                      styles.attendanceSubTabText,
                      isActive && styles.attendanceSubTabTextActive
                    ]}>
                      {sub.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {attendanceSubView === 'today' && (
              <View style={{ gap: 14 }}>
                {/* Header Title */}
                <Text style={styles.screenMainTitle}>Attendance</Text>

                {/* Mon–Fri Week Day Selector Strip */}
                <View style={styles.weekStripContainer}>
                  {weekDaysList.map((day) => {
                    const isSelected = attendanceWeekDaySelected === day.dateStr;
                    return (
                      <TouchableOpacity
                        key={day.dateStr}
                        style={[
                          styles.weekDayPill,
                          isSelected && styles.weekDayPillSelected
                        ]}
                        onPress={() => setAttendanceWeekDaySelected(day.dateStr)}
                      >
                        <Text style={[
                          styles.weekDayLabel,
                          isSelected && styles.weekDayLabelSelected
                        ]}>
                          {day.label}
                        </Text>
                        <Text style={[
                          styles.weekDayNumber,
                          isSelected && styles.weekDayNumberSelected
                        ]}>
                          {day.dateNumber}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Central Digital Clock & Mark Attendance Card */}
                <View style={styles.attendanceMainCard}>
                  <Text style={styles.attendanceTimeSubtitle}>Indian Standard Time</Text>
                  <Text style={styles.attendanceLargeClockText}>{liveClockTime}</Text>

                  <TouchableOpacity
                    style={[
                      styles.attendanceActionBtn,
                      (todayHoliday || isWeekOffToday)
                        ? { backgroundColor: '#475569' }
                        : (isCheckedIn || todayAttendanceRecord)
                        ? { backgroundColor: '#16a34a' }
                        : { backgroundColor: '#2563eb' }
                    ]}
                    onPress={handlePunchToggle}
                    disabled={Boolean(todayHoliday || isWeekOffToday)}
                  >
                    <Text style={styles.attendanceActionBtnText}>
                      {todayHoliday
                        ? 'Holiday (Locked)'
                        : (isCheckedIn || todayAttendanceRecord)
                        ? '✓ Attendance Recorded'
                        : 'Mark attendance'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Two KPI Cards Side-by-Side */}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.dashboardMetricCard, { flex: 1 }]}>
                    <Text style={styles.dashboardMetricSubtitle}>Present</Text>
                    <Text style={styles.attendanceKpiBigNumber}>{todayPresentCount}</Text>
                    <Text style={styles.attendanceKpiSubtext}>of {teamProfiles.length || 9}</Text>
                  </View>

                  <View style={[styles.dashboardMetricCard, { flex: 1 }]}>
                    <Text style={styles.dashboardMetricSubtitle}>On leave</Text>
                    <Text style={styles.attendanceKpiBigNumber}>{todayOnLeaveCount}</Text>
                    <Text style={styles.attendanceKpiSubtext}>today</Text>
                  </View>
                </View>

                {/* Section: Today's Log */}
                <View style={styles.dashboardChartCard}>
                  <Text style={[styles.dashboardCardTitle, { marginBottom: 12 }]}>Today's log</Text>
                  {todayVerifiedPunches.length === 0 ? (
                    <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                      <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                        {isSuperadminRole || isPrivilegedRole
                          ? 'No attendance punches logged yet today'
                          : isManagerRole
                          ? 'No punches logged by your team yet today'
                          : 'No punch recorded yet today'}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 10 }}>
                      {todayVerifiedPunches.map((punch) => {
                        const emp = teamProfiles.find((p) => p.id === punch.employee_id);
                        const empName = emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() : 'Employee';
                        const initial = (emp?.first_name?.[0] || 'E').toUpperCase();
                        const color = getAvatarColor(empName);
                        const timeStr = punch.check_in_time ? formatISTTimeOnly(punch.check_in_time) : '06:18 pm';

                        return (
                          <View key={punch.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={[styles.recentActivityAvatar, { backgroundColor: color }]}>
                              <Text style={styles.recentActivityAvatarText}>{initial}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.recentActivityName}>{empName}</Text>
                              <Text style={styles.recentActivityTime}>{timeStr}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>
            )}
            <View style={styles.card}>
              {/* Header Bar with Title & Policies Button */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <View style={{ flex: 1, paddingRight: 6 }}>
                  <Text style={styles.cardTitle}>Organization Calendar</Text>
                  <Text style={styles.cardDesc}>Shifts, rosters & company week-off policies for {currentOrg?.name}</Text>
                </View>
                {isPrivileged && (
                  <TouchableOpacity
                    style={[styles.smallAddBtn, { backgroundColor: '#4f46e5' }]}
                    onPress={() => {
                      setCalPolicyOrgWeekOffs(currentOrg?.settings?.weekOffDays || [0]);
                      setCalPolicyEmpWeekOffs(currentOrg?.settings?.employeeWeekOffs || {});
                      setCalPolicySelectedEmp(teamProfiles[0]?.id || '');
                      setOrgShiftStart(currentOrg?.settings?.shiftStart || currentOrg?.settings?.shiftStartTime || '09:30');
                      setOrgShiftEnd(currentOrg?.settings?.shiftEnd || currentOrg?.settings?.shiftEndTime || '18:30');
                      setOrgGracePeriod(String(currentOrg?.settings?.gracePeriodMins || 15));
                      setIsCalendarPoliciesModal(true);
                    }}
                  >
                    <Text style={styles.smallAddBtnText}>⚙️ Policies</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Subtab Toggle: Monthly Tracker vs Team Roster vs Holiday Calendar */}
              <View style={styles.filterRow}>
                <TouchableOpacity
                  style={[styles.filterTab, calSubTab === 'attendance' && styles.filterTabActive, { flex: 1 }]}
                  onPress={() => setCalSubTab('attendance')}
                >
                  <Text style={[styles.filterTabText, calSubTab === 'attendance' && styles.filterTabTextActive, { textAlign: 'center' }]}>
                    📅 Monthly
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterTab, calSubTab === 'roster' && styles.filterTabActive, { flex: 1 }]}
                  onPress={() => setCalSubTab('roster')}
                >
                  <Text style={[styles.filterTabText, calSubTab === 'roster' && styles.filterTabTextActive, { textAlign: 'center' }]}>
                    👥 Daily Roster
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterTab, calSubTab === 'holidays' && styles.filterTabActive, { flex: 1 }]}
                  onPress={() => setCalSubTab('holidays')}
                >
                  <Text style={[styles.filterTabText, calSubTab === 'holidays' && styles.filterTabTextActive, { textAlign: 'center' }]}>
                    🌴 Holidays ({holidays.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Manager & HR/Superadmin Attendance PDF Export Banner */}
              {(isPrivileged || isManager || (teamProfiles && teamProfiles.some((p) => p.manager_id === userProfile?.id))) && (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: isDarkMode ? '#1e293b' : '#f0f9ff',
                    borderWidth: 1,
                    borderColor: '#0284c7',
                    paddingVertical: 9,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    marginBottom: 12,
                    marginTop: 4
                  }}
                  onPress={() => {
                    const defaultDate = calSubTab === 'roster' ? (rosterDate || todayStr) : `${selectedCalYear}-${String(selectedCalMonth).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
                    setAttReportDate(defaultDate);
                    setAttReportType(calSubTab === 'attendance' ? 'monthly' : 'daily');
                    setIsAttReportModal(true);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 16 }}>📄</Text>
                    <View>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? '#f8fafc' : '#0369a1' }}>
                        Export Attendance Report PDF
                      </Text>
                      <Text style={{ fontSize: 9.5, color: '#64748b' }}>
                        Daily, Weekly & Monthly registers with digital stamp
                      </Text>
                    </View>
                  </View>
                  <View style={{ backgroundColor: '#0284c7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}>
                    <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>
                      {isPrivileged ? 'HR Export' : 'Team Export'}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* VIEW A: ATTENDANCE CALENDAR (SELF OR INSPECTED TEAM MEMBER) */}
              {calSubTab === 'attendance' && (() => {
                const inspectedCalendarEmp = teamProfiles.find((p) => p.id === (selectedCalendarEmpId || userProfile?.id)) || userProfile;
                const isViewingSelf = !selectedCalendarEmpId || selectedCalendarEmpId === userProfile?.id;
                const targetEmpId = inspectedCalendarEmp?.id;
                const joiningDateStr = inspectedCalendarEmp?.joining_date || '2026-01-01';

                return (
                  <View style={{ marginTop: 12 }}>
                    {/* Multi-Employee Selector for Superadmin / HR / Managers */}
                    {canApprove && (
                      <View style={{ marginBottom: 10 }}>
                        <Text style={[styles.inputLabel, { marginBottom: 4 }]}>Select Employee to Inspect Attendance:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity
                              style={[
                                styles.calEmpPill,
                                isViewingSelf && styles.calEmpPillActive
                              ]}
                              onPress={() => setSelectedCalendarEmpId(userProfile?.id)}
                            >
                              <View style={styles.calEmpPillAvatar}>
                                <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
                                  {(userProfile?.first_name?.[0] || 'M') + (userProfile?.last_name?.[0] || '')}
                                </Text>
                              </View>
                              <Text
                                style={[
                                  styles.calEmpPillText,
                                  isViewingSelf && styles.calEmpPillTextActive
                                ]}
                              >
                                My Attendance
                              </Text>
                            </TouchableOpacity>

                            {teamProfiles
                              .filter((p) => p.id !== userProfile?.id)
                              .map((emp) => {
                                const isSelected = selectedCalendarEmpId === emp.id;
                                return (
                                  <TouchableOpacity
                                    key={emp.id}
                                    style={[styles.calEmpPill, isSelected && styles.calEmpPillActive]}
                                    onPress={() => setSelectedCalendarEmpId(emp.id)}
                                  >
                                    <View style={[styles.calEmpPillAvatar, { backgroundColor: isSelected ? '#0284c7' : '#475569' }]}>
                                      {emp.avatar_url ? (
                                        <Image source={{ uri: emp.avatar_url }} style={{ width: '100%', height: '100%', borderRadius: 10 }} />
                                      ) : (
                                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
                                          {(emp.first_name?.[0] || 'U') + (emp.last_name?.[0] || '')}
                                        </Text>
                                      )}
                                    </View>
                                    <Text style={[styles.calEmpPillText, isSelected && styles.calEmpPillTextActive]}>
                                      {emp.first_name} {emp.last_name}
                                    </Text>
                                    <View style={{ backgroundColor: isSelected ? '#0369a1' : '#334155', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 }}>
                                      <Text style={{ fontSize: 9, color: '#e2e8f0', fontWeight: 'bold' }}>{emp.role || 'EMP'}</Text>
                                    </View>
                                  </TouchableOpacity>
                                );
                              })}
                          </View>
                        </ScrollView>
                      </View>
                    )}

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.cardTitle}>
                        {isViewingSelf ? 'My Monthly Attendance' : `${inspectedCalendarEmp?.first_name}'s Attendance`}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                          style={styles.calNavBtn}
                          onPress={() => {
                            if (selectedCalMonth === 1) {
                              setSelectedCalMonth(12);
                              setSelectedCalYear((y) => y - 1);
                            } else {
                              setSelectedCalMonth((m) => m - 1);
                            }
                          }}
                        >
                          <Text style={styles.calNavBtnText}>◀</Text>
                        </TouchableOpacity>
                        <Text style={styles.calMonthText}>
                          {new Date(selectedCalYear, selectedCalMonth - 1, 1).toLocaleDateString('en-IN', {
                            month: 'short',
                            year: 'numeric'
                          })}
                        </Text>
                        <TouchableOpacity
                          style={styles.calNavBtn}
                          onPress={() => {
                            if (selectedCalMonth === 12) {
                              setSelectedCalMonth(1);
                              setSelectedCalYear((y) => y + 1);
                            } else {
                              setSelectedCalMonth((m) => m + 1);
                            }
                          }}
                        >
                          <Text style={styles.calNavBtnText}>▶</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                      <Text style={styles.cardDesc}>
                        Joining Date: {formatDisplayDate(inspectedCalendarEmp?.joining_date)}
                      </Text>
                      {!isViewingSelf && inspectedCalendarEmp && (
                        <TouchableOpacity onPress={() => setInspectedUserProfile(inspectedCalendarEmp)}>
                          <Text style={{ color: '#38bdf8', fontSize: 11, fontWeight: 'bold' }}>View Full Profile ↗</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Summary Counters */}
                    {(() => {
                      const monthPrefix = `${selectedCalYear}-${String(selectedCalMonth).padStart(2, '0')}`;
                      const daysInMonth = new Date(selectedCalYear, selectedCalMonth, 0).getDate();

                      let present = 0;
                      let regularized = 0;
                      let absent = 0;

                      for (let d = 1; d <= daysInMonth; d++) {
                        const dStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
                        if (dStr > todayStr) continue;
                        if (dStr < joiningDateStr) continue;

                        const dayOfWeek = new Date(selectedCalYear, selectedCalMonth - 1, d).getDay();

                        // 1. Check Holiday
                        const isHol = holidays.some((h) => h.date === dStr);
                        const customOverride = currentOrg?.settings?.customDayOverrides?.[dStr]
                          || currentOrg?.settings?.customDayOverrides?.[`${dStr}_${targetEmpId}`]
                          || currentOrg?.settings?.customDayOverrides?.[`${targetEmpId}_${dStr}`];
                        const isOverrideWorking = customOverride?.type === 'working';
                        const isOverrideWeekOff = customOverride?.type === 'week_off';
                        const isOverrideHol = customOverride?.type === 'holiday';

                        if ((isHol || isOverrideHol) && !isOverrideWorking) {
                          continue; // Holiday (not counted as working/absent)
                        }

                        // 2. Check Employee-Specific & Org Default Week-Offs
                        const empWeekOffs: number[] = currentOrg?.settings?.employeeWeekOffs?.[targetEmpId]
                          || currentOrg?.settings?.weekOffDays
                          || [0]; // default Sunday
                        const isEmpWeekOff = empWeekOffs.includes(dayOfWeek);

                        if ((isEmpWeekOff || isOverrideWeekOff) && !isOverrideWorking) {
                          continue; // Week-Off
                        }

                        const punch = attendanceRecords.find(
                          (a) => a.employee_id === targetEmpId && a.date === dStr
                        );

                        const isRejected = punch?.regularization_status === 'rejected' || punch?.approval_status === 'rejected';
                        const isPending = !isRejected && (punch?.regularization_status === 'pending' || punch?.approval_status === 'pending_manager_approval' || punch?.status === 'pending');
                        const isApproved = !isRejected && !isPending && (punch?.regularization_status === 'approved' || punch?.approval_status === 'approved');

                        if (isRejected) {
                          absent++;
                        } else if (isPending) {
                          // Unapproved regularization: strictly not counted in present
                          absent++;
                        } else if (isApproved) {
                          if (punch?.status === 'regularized' || !punch?.check_in_time) {
                            regularized++;
                          } else {
                            present++;
                          }
                        } else if (punch?.status === 'present' && punch?.approval_status !== 'pending_manager_approval') {
                          present++;
                        } else if (punch?.check_in_time && punch?.approval_status !== 'pending_manager_approval') {
                          present++;
                        } else if (punch?.status === 'regularized') {
                          regularized++;
                        } else {
                          absent++;
                        }
                      }

                      const totalWorking = present + regularized + absent;
                      const percentage = totalWorking > 0 ? (((present + regularized) / totalWorking) * 100).toFixed(1) : '100.0';

                      return (
                        <View style={styles.calSummaryRow}>
                          <View style={[styles.calSummaryBox, { borderColor: '#10b981' }]}>
                            <Text style={[styles.calSummaryVal, { color: '#10b981' }]}>{present}</Text>
                            <Text style={styles.calSummaryLbl}>Present</Text>
                          </View>
                          <View style={[styles.calSummaryBox, { borderColor: '#06b6d4' }]}>
                            <Text style={[styles.calSummaryVal, { color: '#06b6d4' }]}>{regularized}</Text>
                            <Text style={styles.calSummaryLbl}>Regularized</Text>
                          </View>
                          <View style={[styles.calSummaryBox, { borderColor: '#f43f5e' }]}>
                            <Text style={[styles.calSummaryVal, { color: '#f43f5e' }]}>{absent}</Text>
                            <Text style={styles.calSummaryLbl}>Absent</Text>
                          </View>
                          <View style={[styles.calSummaryBox, { borderColor: '#38bdf8' }]}>
                            <Text style={[styles.calSummaryVal, { color: '#38bdf8' }]}>{percentage}%</Text>
                            <Text style={styles.calSummaryLbl}>Presence</Text>
                          </View>
                        </View>
                      );
                    })()}

                    {/* Day Rows List (Clickable -> Opens Modal) */}
                    <View style={{ marginTop: 12, gap: 8 }}>
                      {(() => {
                        const monthPrefix = `${selectedCalYear}-${String(selectedCalMonth).padStart(2, '0')}`;
                        const daysInMonth = new Date(selectedCalYear, selectedCalMonth, 0).getDate();
                        const dayItems = [];

                        for (let d = 1; d <= daysInMonth; d++) {
                          const dStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
                          const dateObj = new Date(selectedCalYear, selectedCalMonth - 1, d);
                          const dayOfWeek = dateObj.getDay();
                          const dayName = dateObj.toLocaleDateString('en-IN', { weekday: 'short' });
                          const isFuture = dStr > todayStr;
                          const isToday = dStr === todayStr;
                          const isBeforeJoining = dStr < joiningDateStr;
                          const matchingHoliday = holidays.find((h) => h.date === dStr);

                          const customOverride = currentOrg?.settings?.customDayOverrides?.[dStr]
                            || currentOrg?.settings?.customDayOverrides?.[`${dStr}_${targetEmpId}`]
                            || currentOrg?.settings?.customDayOverrides?.[`${targetEmpId}_${dStr}`];
                          const isOverrideWorking = customOverride?.type === 'working';
                          const isOverrideWeekOff = customOverride?.type === 'week_off';
                          const isOverrideHol = customOverride?.type === 'holiday';

                          const empWeekOffs: number[] = currentOrg?.settings?.employeeWeekOffs?.[targetEmpId]
                            || currentOrg?.settings?.weekOffDays
                            || [0]; // default Sunday
                          const isWeeklyOff = empWeekOffs.includes(dayOfWeek);

                          const isEffectiveWeekOff = (isWeeklyOff || isOverrideWeekOff) && !isOverrideWorking;
                          const isEffectiveHoliday = (matchingHoliday || isOverrideHol) && !isOverrideWorking;

                          const punch = attendanceRecords.find(
                            (a) => a.employee_id === targetEmpId && a.date === dStr
                          );

                          let status = 'future';
                          let statusLabel = 'Upcoming';
                          let statusColor = '#64748b';

                          if (isBeforeJoining) {
                            status = 'before_joining';
                            statusLabel = 'Before Joining';
                            statusColor = '#475569';
                          } else if (isEffectiveHoliday) {
                            status = 'holiday';
                            const holName = matchingHoliday?.name || customOverride?.name || 'Declared Holiday';
                            statusLabel = `🎉 Holiday: ${holName}`;
                            statusColor = '#fbbf24';
                          } else if (isEffectiveWeekOff) {
                            status = 'week_off';
                            statusLabel = customOverride?.name ? `🌴 Week Off (${customOverride.name})` : '🌴 Week Off';
                            statusColor = '#64748b';
                          } else if (punch?.regularization_status === 'rejected' || punch?.approval_status === 'rejected') {
                            status = 'absent';
                            statusLabel = '❌ Regularization Rejected';
                            statusColor = '#f43f5e';
                          } else if (punch?.regularization_status === 'pending' || punch?.approval_status === 'pending_manager_approval') {
                            status = 'pending';
                            statusLabel = '⏳ Regularization Pending';
                            statusColor = '#f59e0b';
                          } else if (punch?.regularization_status === 'approved' || punch?.approval_status === 'approved') {
                            if (punch?.status === 'regularized' || !punch?.check_in_time) {
                              status = 'regularized';
                              statusLabel = '★ Regularized Approved';
                              statusColor = '#06b6d4';
                            } else {
                              status = 'present';
                              const checkInFormatted = punch.check_in_time ? new Date(punch.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Logged';
                              statusLabel = `✓ Present (${checkInFormatted})`;
                              statusColor = '#10b981';
                            }
                          } else if (punch?.status === 'present' && punch?.approval_status !== 'pending_manager_approval') {
                            status = 'present';
                            const checkInFormatted = punch.check_in_time ? new Date(punch.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Logged';
                            statusLabel = `✓ Present (${checkInFormatted})`;
                            statusColor = '#10b981';
                          } else if (punch?.check_in_time && punch?.approval_status !== 'pending_manager_approval') {
                            status = 'present';
                            const checkInFormatted = new Date(punch.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            statusLabel = `✓ Present (${checkInFormatted})`;
                            statusColor = '#10b981';
                          } else if (punch?.status === 'regularized') {
                            status = 'regularized';
                            statusLabel = '★ Regularized Approved';
                            statusColor = '#06b6d4';
                          } else if (!isFuture) {
                            status = 'absent';
                            statusLabel = '✗ Unmarked / Absent';
                            statusColor = '#f43f5e';
                          }

                          const dayPayload = {
                            day: d,
                            dStr,
                            dayName,
                            status,
                            statusLabel,
                            statusColor,
                            punch,
                            matchingHoliday,
                            isToday,
                            isFuture,
                            isSunday: dayOfWeek === 0,
                            isEffectiveWeekOff,
                            isBeforeJoining,
                            inspectedCalendarEmp
                          };

                          dayItems.push(
                            <TouchableOpacity
                              key={dStr}
                              activeOpacity={0.7}
                              onPress={() => setSelectedCalendarDayData(dayPayload)}
                              style={[
                                styles.calDayRow,
                                isToday && styles.calDayRowToday,
                                (matchingHoliday || isOverrideHol) && { borderColor: '#f59e0b' },
                                isEffectiveWeekOff && { borderColor: '#475569' },
                                isBeforeJoining && { opacity: 0.5 }
                              ]}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={[styles.calDayBadge, { backgroundColor: isToday ? '#0284c7' : (matchingHoliday || isOverrideHol) ? '#78350f' : isEffectiveWeekOff ? '#334155' : '#1e293b' }]}>
                                  <Text style={styles.calDayNum}>{d}</Text>
                                  <Text style={styles.calDayName}>{dayName}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.calDateStr}>{dStr} {isToday ? '(Today)' : ''}</Text>
                                  <Text style={[styles.calStatusText, { color: statusColor }]}>{statusLabel}</Text>
                                </View>
                              </View>

                              {status === 'absent' && (
                                <TouchableOpacity
                                  style={styles.calRegBtn}
                                  onPress={() => {
                                    if (isViewingSelf) {
                                      setRegTargetDate(dStr);
                                      setIsRegModal(true);
                                    } else if (canApprove) {
                                      handleDirectRegularize(targetEmpId, dStr);
                                    }
                                  }}
                                >
                                  <Text style={styles.calRegBtnText}>
                                    {isViewingSelf ? 'Regularize' : '⚡ Mark Present'}
                                  </Text>
                                </TouchableOpacity>
                              )}

                              {status === 'regularized' && (
                                <View style={styles.calApprovedBadge}>
                                  <Text style={styles.calApprovedBadgeText}>Approved</Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          );
                        }
                        return dayItems;
                      })()}
                    </View>
                  </View>
                );
              })()}

              {/* VIEW B: TEAM DAILY ROSTER (NEW - AS PER WEB) */}
              {calSubTab === 'roster' && (() => {
                const selectedDateObj = new Date(rosterDate);
                const dayOfWeek = selectedDateObj.getDay();
                const dayName = selectedDateObj.toLocaleDateString('en-IN', { weekday: 'short' });
                const isSelectedToday = rosterDate === todayStr;

                const filteredRosterEmps = teamProfiles.filter((p) => {
                  if (!rosterSearch.trim()) return true;
                  const q = rosterSearch.toLowerCase();
                  return (
                    p.first_name?.toLowerCase().includes(q) ||
                    p.last_name?.toLowerCase().includes(q) ||
                    p.designation?.toLowerCase().includes(q) ||
                    p.department?.toLowerCase().includes(q)
                  );
                });

                return (
                  <View style={{ marginTop: 12 }}>
                    {/* Date Switcher Bar */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', padding: 8, borderRadius: 10, marginBottom: 10 }}>
                      <TouchableOpacity
                        style={styles.calNavBtn}
                        onPress={() => {
                          const prev = new Date(rosterDate);
                          prev.setDate(prev.getDate() - 1);
                          setRosterDate(prev.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
                        }}
                      >
                        <Text style={styles.calNavBtnText}>◀</Text>
                      </TouchableOpacity>

                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                          {formatDisplayDate(rosterDate)} ({dayName}) {isSelectedToday ? '• TODAY' : ''}
                        </Text>
                        <Text style={{ fontSize: 10, color: '#38bdf8' }}>
                          Shift: {currentOrg?.settings?.shiftStart || '09:30'} - {currentOrg?.settings?.shiftEnd || '18:30'} IST
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                        {!isSelectedToday && (
                          <TouchableOpacity
                            style={{ backgroundColor: '#0284c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                            onPress={() => setRosterDate(todayStr)}
                          >
                            <Text style={{ fontSize: 10, color: '#fff', fontWeight: 'bold' }}>Today</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.calNavBtn}
                          onPress={() => {
                            const next = new Date(rosterDate);
                            next.setDate(next.getDate() + 1);
                            setRosterDate(next.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
                          }}
                        >
                          <Text style={styles.calNavBtnText}>▶</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Roster Search Bar */}
                    <TextInput
                      style={[styles.textInput, { marginBottom: 10 }]}
                      value={rosterSearch}
                      onChangeText={setRosterSearch}
                      placeholder="Filter roster by employee or department..."
                      placeholderTextColor="#64748b"
                    />

                    {/* Roster Employee Cards */}
                    <View style={{ gap: 8 }}>
                      {filteredRosterEmps.map((emp) => {
                        const punch = attendanceRecords.find(
                          (a) => a.employee_id === emp.id && a.date === rosterDate
                        );

                        const matchingHoliday = holidays.find((h) => h.date === rosterDate);
                        const customOverride = currentOrg?.settings?.customDayOverrides?.[rosterDate]
                          || currentOrg?.settings?.customDayOverrides?.[`${rosterDate}_${emp.id}`]
                          || currentOrg?.settings?.customDayOverrides?.[`${emp.id}_${rosterDate}`];

                        const isOverrideWorking = customOverride?.type === 'working';
                        const isOverrideWeekOff = customOverride?.type === 'week_off';
                        const isOverrideHol = customOverride?.type === 'holiday';

                        const empWeekOffs: number[] = currentOrg?.settings?.employeeWeekOffs?.[emp.id]
                          || currentOrg?.settings?.weekOffDays
                          || [0];
                        const isWeeklyOff = empWeekOffs.includes(dayOfWeek);

                        const isEffectiveWeekOff = (isWeeklyOff || isOverrideWeekOff) && !isOverrideWorking;
                        const isEffectiveHoliday = (matchingHoliday || isOverrideHol) && !isOverrideWorking;

                        const isBeforeJoining = emp.joining_date && rosterDate < emp.joining_date;
                        const isFuture = rosterDate > todayStr;

                        let rStatus = 'future';
                        let rLabel = 'Upcoming';
                        let rColor = '#64748b';

                        if (isBeforeJoining) {
                          rStatus = 'before_joining';
                          rLabel = 'Before Joining';
                          rColor = '#475569';
                        } else if (isEffectiveHoliday) {
                          rStatus = 'holiday';
                          rLabel = `🎉 Holiday: ${matchingHoliday?.name || customOverride?.name || 'Declared Holiday'}`;
                          rColor = '#fbbf24';
                        } else if (isEffectiveWeekOff) {
                          rStatus = 'week_off';
                          rLabel = customOverride?.name ? `🌴 Week Off (${customOverride.name})` : '🌴 Week Off';
                          rColor = '#64748b';
                        } else if (punch?.regularization_status === 'rejected' || punch?.approval_status === 'rejected') {
                          rStatus = 'absent';
                          rLabel = '❌ Reg. Rejected';
                          rColor = '#f43f5e';
                        } else if (punch?.regularization_status === 'pending' || punch?.approval_status === 'pending_manager_approval') {
                          rStatus = 'pending';
                          rLabel = '⏳ Reg. Pending';
                          rColor = '#f59e0b';
                        } else if (punch?.regularization_status === 'approved' || punch?.approval_status === 'approved') {
                          if (punch?.status === 'regularized' || !punch?.check_in_time) {
                            rStatus = 'regularized';
                            rLabel = '★ Regularized';
                            rColor = '#06b6d4';
                          } else {
                            rStatus = 'present';
                            const cin = punch.check_in_time ? new Date(punch.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Logged';
                            rLabel = `✓ Present (${cin})`;
                            rColor = '#10b981';
                          }
                        } else if (punch?.status === 'present' && punch?.approval_status !== 'pending_manager_approval') {
                          rStatus = 'present';
                          const cin = punch.check_in_time ? new Date(punch.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Logged';
                          rLabel = `✓ Present (${cin})`;
                          rColor = '#10b981';
                        } else if (punch?.check_in_time && punch?.approval_status !== 'pending_manager_approval') {
                          rStatus = 'present';
                          const cin = new Date(punch.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          rLabel = `✓ Present (${cin})`;
                          rColor = '#10b981';
                        } else if (punch?.status === 'regularized') {
                          rStatus = 'regularized';
                          rLabel = '★ Regularized';
                          rColor = '#06b6d4';
                        } else if (!isFuture) {
                          rStatus = 'absent';
                          rLabel = '✗ Absent';
                          rColor = '#f43f5e';
                        }

                        const approverUuid = punch?.approved_by || punch?.regularized_by;
                        const approverProfile = approverUuid ? teamProfiles.find((x) => x.id === approverUuid) : null;

                        return (
                          <View
                            key={emp.id}
                            style={[
                              styles.teamCard,
                              { padding: 10 },
                              rStatus === 'present' && { borderColor: '#10b98140' },
                              rStatus === 'absent' && { borderColor: '#f43f5e40' }
                            ]}
                          >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text style={styles.teamName}>
                                  {emp.first_name} {emp.last_name}
                                </Text>
                                <Text style={styles.teamDesig}>
                                  {emp.designation || 'Staff'} • {emp.department || 'Operations'}
                                </Text>
                                {(() => {
                                  if (!approverProfile) return null;
                                  if (punch?.regularization_status === 'rejected' || punch?.approval_status === 'rejected') {
                                    return (
                                      <Text style={{ fontSize: 9.5, color: '#f43f5e', fontWeight: 'bold', marginTop: 2 }}>
                                        ❌ Rejected By: {approverProfile.first_name} {approverProfile.last_name}
                                      </Text>
                                    );
                                  }
                                  if (punch?.regularization_status === 'approved' || punch?.approval_status === 'approved') {
                                    return (
                                      <Text style={{ fontSize: 9.5, color: '#10b981', fontWeight: 'bold', marginTop: 2 }}>
                                        ✓ Approved By: {approverProfile.first_name} {approverProfile.last_name}
                                      </Text>
                                    );
                                  }
                                  return null;
                                })()}
                              </View>

                              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                <View style={[styles.statusBadge, { backgroundColor: rColor + '20', borderColor: rColor, paddingHorizontal: 8, paddingVertical: 3 }]}>
                                  <Text style={{ color: rColor, fontSize: 10, fontWeight: 'bold' }}>{rLabel}</Text>
                                </View>

                                {rStatus === 'absent' && canApprove && !isBeforeJoining && (
                                  <TouchableOpacity
                                    style={{ backgroundColor: '#0284c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 2 }}
                                    onPress={() => handleDirectRegularize(emp.id, rosterDate)}
                                  >
                                    <Text style={{ fontSize: 9.5, color: '#fff', fontWeight: 'bold' }}>⚡ Mark Present</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })()}

              {/* VIEW C: COMPANY HOLIDAY SCHEDULE */}
              {calSubTab === 'holidays' && (
                <View style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.cardTitle}>Official Holiday Calendar</Text>
                    {isPrivileged && (
                      <TouchableOpacity
                        style={styles.smallAddBtn}
                        onPress={() => setIsHolidayModal(true)}
                      >
                        <Text style={styles.smallAddBtnText}>+ Add Holiday</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.cardDesc}>Company-wide declared holidays for {new Date().getFullYear()}</Text>

                  <View style={{ gap: 8, marginTop: 10 }}>
                    {holidays.map((hol) => {
                      const isPast = hol.date < todayStr;
                      const isToday = hol.date === todayStr;

                      return (
                        <View
                          key={hol.id}
                          style={[
                            styles.holidayCard,
                            isToday && { borderColor: '#10b981', backgroundColor: '#064e3b20' },
                            isPast && { opacity: 0.6 }
                          ]}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.holidayName}>{hol.name}</Text>
                                {isToday && (
                                  <View style={styles.todayHolBadge}>
                                    <Text style={styles.todayHolBadgeText}>TODAY</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.holidayDate}>
                                📅 {formatDisplayDate(hol.date)} ({new Date(hol.date).toLocaleDateString('en-IN', { weekday: 'long' })})
                              </Text>
                              {hol.description && (
                                <Text style={styles.holidayDesc}>{hol.description}</Text>
                              )}
                            </View>

                            <View style={{ alignItems: 'flex-end', gap: 6 }}>
                              <View style={styles.holTypeBadge}>
                                <Text style={styles.holTypeBadgeText}>{hol.type?.toUpperCase() || 'OFFICIAL'}</Text>
                              </View>
                              {isPrivileged && (
                                <TouchableOpacity
                                  onPress={() => handleDeleteHoliday(hol.id)}
                                  style={{ padding: 2 }}
                                >
                                  <Text style={{ color: '#f87171', fontSize: 10 }}>🗑️ Delete</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* 3. LEAVES TAB */}
        {/* ========================================================================= */}
        {activeTab === 'leaves' && (
          <View style={{ gap: 14 }}>
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={styles.cardTitle}>My Leave Requests</Text>
                  <Text style={styles.cardDesc}>Casual, sick & privilege balances</Text>
                </View>
                <TouchableOpacity
                  style={styles.smallAddBtn}
                  onPress={() => {
                    setLeaveStartDate(getTodayISTDate());
                    setLeaveEndDate(getTodayISTDate());
                    setIsLeaveModal(true);
                  }}
                >
                  <Text style={styles.smallAddBtnText}>+ Apply Leave</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.leaveBalanceRow}>
                <View style={styles.leaveBalanceBox}>
                  <Text style={styles.leaveBalanceVal}>12</Text>
                  <Text style={styles.leaveBalanceLbl}>Casual</Text>
                </View>
                <View style={styles.leaveBalanceBox}>
                  <Text style={styles.leaveBalanceVal}>10</Text>
                  <Text style={styles.leaveBalanceLbl}>Sick</Text>
                </View>
                <View style={styles.leaveBalanceBox}>
                  <Text style={styles.leaveBalanceVal}>15</Text>
                  <Text style={styles.leaveBalanceLbl}>Privilege</Text>
                </View>
                <View style={styles.leaveBalanceBox}>
                  <Text style={styles.leaveBalanceVal}>
                    {leaveRequests.filter((l) => l.employee_id === userProfile?.id && l.status === 'approved').length}
                  </Text>
                  <Text style={styles.leaveBalanceLbl}>Taken</Text>
                </View>
              </View>

              <View style={{ marginTop: 14, gap: 8 }}>
                {(() => {
                  const myLeaves = leaveRequests.filter((l) => l.employee_id === userProfile?.id);
                  if (myLeaves.length === 0) {
                    return (
                      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                        <Text style={{ fontSize: 24, marginBottom: 4 }}>🌴</Text>
                        <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: 'bold' }}>No Leave Applications</Text>
                        <Text style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>Tap "+ Apply Leave" to request time off.</Text>
                      </View>
                    );
                  }

                  return myLeaves.map((leave) => (
                    <View key={leave.id} style={styles.leaveItemCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={styles.leaveTypeHeader}>
                            {leave.leave_type?.toUpperCase()} LEAVE ({leave.total_days} {leave.total_days === 1 ? 'day' : 'days'})
                          </Text>
                          <Text style={styles.leaveDateRange}>
                            📅 {formatDisplayDate(leave.start_date)} {leave.start_date !== leave.end_date ? `to ${formatDisplayDate(leave.end_date)}` : ''}
                          </Text>
                          <Text style={styles.leaveReasonText}>"{leave.reason}"</Text>
                        </View>
                        <View
                          style={[
                            styles.leaveStatusPill,
                            leave.status === 'approved' ? styles.statusApproved : leave.status === 'rejected' ? styles.statusRejected : styles.statusPending
                          ]}
                        >
                          <Text style={styles.leaveStatusText}>{leave.status?.toUpperCase() || 'PENDING'}</Text>
                        </View>
                      </View>
                    </View>
                  ));
                })()}
              </View>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* 4. APPROVALS HUB TAB (MANAGERS / HR / SUPERADMIN) */}
        {/* ========================================================================= */}
        {activeTab === 'approvals' && (
          <View style={{ gap: 14 }}>
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={styles.cardTitle}>⚡ Approvals Hub ({totalPendingApprovals})</Text>
                  <Text style={styles.cardDesc}>Managerial & HR sign-off requests</Text>
                </View>
                {!canApprove && (
                  <TouchableOpacity
                    style={styles.smallAddBtn}
                    onPress={() => setIsAccessModal(true)}
                  >
                    <Text style={styles.smallAddBtnText}>+ Request Access</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.filterRow}>
                <TouchableOpacity
                  style={[styles.filterTab, approvalsTab === 'regularization' && styles.filterTabActive]}
                  onPress={() => setApprovalsTab('regularization')}
                >
                  <Text style={[styles.filterTabText, approvalsTab === 'regularization' && styles.filterTabTextActive]}>
                    Attendance ({pendingRegularizations.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterTab, approvalsTab === 'leaves' && styles.filterTabActive]}
                  onPress={() => setApprovalsTab('leaves')}
                >
                  <Text style={[styles.filterTabText, approvalsTab === 'leaves' && styles.filterTabTextActive]}>
                    Leaves ({pendingLeaves.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterTab, approvalsTab === 'access' && styles.filterTabActive]}
                  onPress={() => setApprovalsTab('access')}
                >
                  <Text style={[styles.filterTabText, approvalsTab === 'access' && styles.filterTabTextActive]}>
                    Access ({pendingAccess.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Subtab 1: Regularizations */}
              {approvalsTab === 'regularization' && (
                <View style={{ marginTop: 12, gap: 10 }}>
                  {pendingRegularizations.length === 0 ? (
                    <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                      <Text style={{ fontSize: 26, marginBottom: 4 }}>✅</Text>
                      <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: 'bold' }}>All Attendance Regularizations Cleared</Text>
                      <Text style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>No pending attendance requests awaiting your decision.</Text>
                    </View>
                  ) : (
                    pendingRegularizations.map((reg) => {
                      const emp = teamProfiles.find((p) => p.id === reg.employee_id);
                      return (
                        <View key={reg.id} style={styles.approvalItemCard}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={styles.approvalEmpName}>
                              {emp ? `${emp.first_name} ${emp.last_name}` : 'Team Member'}
                            </Text>
                            <Text style={styles.approvalEmpRole}>{emp?.designation || 'Staff'}</Text>
                          </View>
                          <Text style={styles.approvalReason}>
                            "{reg.regularization_reason || (reg.is_remote ? `Outside Office Perimeter (${reg.distance_meters ? `${reg.distance_meters}m away` : 'Remote GPS'}) - Approval Required` : 'Attendance Regularization Request')}"
                          </Text>
                          <Text style={styles.approvalMeta}>📅 Target Date: {formatDisplayDate(reg.date)}</Text>

                          <View style={styles.btnRow}>
                            <TouchableOpacity
                              style={[styles.actionBtn, styles.approveBtn]}
                              onPress={() => handleResolveRegularization(reg.id, 'approved')}
                            >
                              <Text style={styles.btnText}>Approve (Mark Present)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionBtn, styles.rejectBtn]}
                              onPress={() => handleResolveRegularization(reg.id, 'rejected')}
                            >
                              <Text style={styles.btnText}>Reject</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              )}

              {/* Subtab 2: Leaves */}
              {approvalsTab === 'leaves' && (
                <View style={{ marginTop: 12, gap: 10 }}>
                  {pendingLeaves.length === 0 ? (
                    <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                      <Text style={{ fontSize: 26, marginBottom: 4 }}>🌴</Text>
                      <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: 'bold' }}>No Pending Leave Requests</Text>
                      <Text style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>All team leave requests are up to date.</Text>
                    </View>
                  ) : (
                    pendingLeaves.map((leave) => {
                      const emp = teamProfiles.find((p) => p.id === leave.employee_id);
                      return (
                        <View key={leave.id} style={styles.approvalItemCard}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={styles.approvalEmpName}>
                              {emp ? `${emp.first_name} ${emp.last_name}` : 'Team Member'}
                            </Text>
                            <Text style={styles.approvalEmpRole}>{leave.leave_type?.toUpperCase()} LEAVE</Text>
                          </View>
                          <Text style={styles.approvalMeta}>
                            📅 {formatDisplayDate(leave.start_date)} {leave.start_date !== leave.end_date ? `to ${formatDisplayDate(leave.end_date)}` : ''} ({leave.total_days} days)
                          </Text>
                          <Text style={styles.approvalReason}>"{leave.reason}"</Text>

                          <View style={styles.btnRow}>
                            <TouchableOpacity
                              style={[styles.actionBtn, styles.approveBtn]}
                              onPress={() => handleResolveLeave(leave.id, 'approved')}
                            >
                              <Text style={styles.btnText}>Approve Leave</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionBtn, styles.rejectBtn]}
                              onPress={() => handleResolveLeave(leave.id, 'rejected')}
                            >
                              <Text style={styles.btnText}>Reject</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              )}

              {/* Subtab 3: Access */}
              {approvalsTab === 'access' && (
                <View style={{ marginTop: 12, gap: 10 }}>
                  {pendingAccess.length === 0 ? (
                    <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                      <Text style={{ fontSize: 26, marginBottom: 4 }}>🛡️</Text>
                      <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: 'bold' }}>No Pending Access Requests</Text>
                      <Text style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>No module permission requests awaiting your sign-off.</Text>
                    </View>
                  ) : (
                    pendingAccess.map((req) => {
                      const requester = teamProfiles.find((p) => p.id === req.requester_id);
                      return (
                        <View key={req.id} style={styles.approvalItemCard}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={styles.approvalEmpName}>
                              {requester ? `${requester.first_name} ${requester.last_name}` : 'Team Member'}
                            </Text>
                            <Text style={styles.approvalEmpRole}>{req.target_module?.toUpperCase()}</Text>
                          </View>
                          <Text style={styles.approvalReason}>"{req.justification}"</Text>
                          <Text style={styles.approvalMeta}>Submitted: {formatDisplayDate(req.created_at)}</Text>

                          <View style={styles.btnRow}>
                            <TouchableOpacity
                              style={[styles.actionBtn, styles.approveBtn]}
                              onPress={() => handleResolveAccessRequest(req.id, 'approved')}
                            >
                              <Text style={styles.btnText}>Approve</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionBtn, styles.rejectBtn]}
                              onPress={() => handleResolveAccessRequest(req.id, 'rejected')}
                            >
                              <Text style={styles.btnText}>Reject</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* 4. SCREEN 4: MEETINGS & HUB TAB (Aligned with Screenshot 4)                */}
        {/* ========================================================================= */}
        {(activeTab === 'more' || activeTab === 'notices') && (
          <View style={{ gap: 14 }}>
            {/* Top Sub-navigation for More Hub */}
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
              {[
                { key: 'meetings', label: 'Meetings' },
                { key: 'standups', label: 'Standups' },
                { key: 'leaves', label: 'Leaves' },
                { key: 'approvals', label: 'Approvals' },
                { key: 'notices', label: 'Notices' },
                { key: 'profile', label: 'Profile' }
              ].map((sec) => {
                const isActive = moreSection === sec.key;
                return (
                  <TouchableOpacity
                    key={sec.key}
                    style={[
                      styles.attendanceSubTabPill,
                      isActive && styles.attendanceSubTabPillActive
                    ]}
                    onPress={() => {
                      setMoreSection(sec.key as any);
                      if (sec.key === 'standups') {
                        setActiveTab('hub');
                        setHubSubTab('standups');
                      } else if (sec.key === 'leaves') {
                        setActiveTab('leaves');
                      } else if (sec.key === 'approvals') {
                        setActiveTab('approvals');
                      } else if (sec.key === 'profile') {
                        setActiveTab('hub');
                        setHubSubTab('profile');
                      }
                    }}
                  >
                    <Text style={[
                      styles.attendanceSubTabText,
                      isActive && styles.attendanceSubTabTextActive
                    ]}>
                      {sec.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Section: Meetings & Events (Screenshot 4) */}
            {moreSection === 'meetings' && (
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.screenMainTitle}>Meetings and events</Text>
                  {canApprove && (
                    <TouchableOpacity
                      style={styles.smallAddBtn}
                      onPress={() => setIsMeetingModal(true)}
                    >
                      <Text style={styles.smallAddBtnText}>+ Schedule</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Filter Pills */}
                <View style={{ flexDirection: 'row', gap: 8, marginVertical: 4 }}>
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'today', label: 'Today' },
                    { key: 'upcoming', label: 'Upcoming' },
                    { key: 'online', label: 'Online' }
                  ].map((pill) => {
                    const isActive = meetingFilter === pill.key;
                    return (
                      <TouchableOpacity
                        key={pill.key}
                        style={[
                          styles.filterPill,
                          isActive && styles.filterPillActive
                        ]}
                        onPress={() => setMeetingFilter(pill.key as any)}
                      >
                        <Text style={[
                          styles.filterPillText,
                          isActive && styles.filterPillTextActive
                        ]}>
                          {pill.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Meeting Cards List */}
                <View style={{ gap: 10 }}>
                  {filteredMeetingsList.length === 0 ? (
                    <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                      <Text style={{ color: '#94a3b8', fontSize: 13 }}>No meetings scheduled in this filter</Text>
                    </View>
                  ) : (
                    filteredMeetingsList.map((m) => {
                      const meetUrl = m.meeting_url || m.meetingUrl || 'https://meet.google.com/new';
                      const isPast = m.date < todayStr;
                      const statusLabel = isPast ? 'Completed' : m.date === todayStr ? 'Today' : 'Upcoming';

                      return (
                        <View key={m.id} style={styles.meetingReferenceCard}>
                          {/* Top Dept & Status row */}
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <View style={styles.meetingDeptBadge}>
                              <Text style={styles.meetingDeptBadgeText}>
                                {(m.department || 'ALL DEPARTMENTS').toUpperCase()}
                              </Text>
                            </View>
                            <Text style={styles.meetingStatusCompletedText}>{statusLabel}</Text>
                          </View>

                          {/* Meeting Title */}
                          <Text style={styles.meetingReferenceTitle}>{m.title}</Text>

                          {/* Subtitle with date & time */}
                          <Text style={styles.meetingReferenceSubtitle}>
                            {m.description ? `${m.description} · ` : ''}{formatDisplayDate(m.date)} · {m.start_time || '19:30'} to {m.end_time || '20:30'} IST
                          </Text>

                          {/* Organizer */}
                          <Text style={styles.meetingReferenceOrganizer}>
                            Organizer: {m.organizer_name || 'Management'}
                          </Text>

                          {/* Join Meeting Action Button */}
                          <TouchableOpacity
                            style={styles.meetingReferenceJoinBtn}
                            onPress={() => Linking.openURL(meetUrl).catch(() => Alert.alert('Link Error', 'Could not open URL: ' + meetUrl))}
                          >
                            <Text style={styles.meetingReferenceJoinBtnText}>🎥 Join meeting</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            )}
            <View style={styles.card}>
              <View style={styles.filterRow}>
                <TouchableOpacity
                  style={[styles.filterTab, noticesSubTab === 'notices' && styles.filterTabActive]}
                  onPress={() => setNoticesSubTab('notices')}
                >
                  <Text style={[styles.filterTabText, noticesSubTab === 'notices' && styles.filterTabTextActive]}>
                    📢 Notices ({circularNotices.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterTab, noticesSubTab === 'letters' && styles.filterTabActive]}
                  onPress={() => setNoticesSubTab('letters')}
                >
                  <Text style={[styles.filterTabText, noticesSubTab === 'letters' && styles.filterTabTextActive]}>
                    📜 Letters ({letterNotices.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterTab, noticesSubTab === 'meetings' && styles.filterTabActive]}
                  onPress={() => setNoticesSubTab('meetings')}
                >
                  <Text style={[styles.filterTabText, noticesSubTab === 'meetings' && styles.filterTabTextActive]}>
                    🎥 Meetings ({meetings.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* VIEW A: NOTICE BOARD */}
              {noticesSubTab === 'notices' && (
                <View style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.cardTitle}>Company Notice Board</Text>
                    {isPrivileged && (
                      <TouchableOpacity
                        style={styles.smallAddBtn}
                        onPress={() => setIsNoticeModal(true)}
                      >
                        <Text style={styles.smallAddBtnText}>+ Post Notice</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.cardDesc}>Official company policies, announcements & alerts</Text>

                  <View style={{ gap: 10, marginTop: 10 }}>
                    {circularNotices.length === 0 ? (
                      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                        <Text style={{ fontSize: 24, marginBottom: 4 }}>📢</Text>
                        <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: 'bold' }}>No Notices Published</Text>
                      </View>
                    ) : (
                      circularNotices.map((n) => (
                        <TouchableOpacity
                          key={n.id}
                          activeOpacity={0.7}
                          onPress={() => setSelectedNoticeForView(n)}
                          style={[styles.noticeCard, n.is_pinned && { borderColor: '#f59e0b' }]}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View style={{ flex: 1, paddingRight: 6 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                {n.is_pinned && <Text style={{ fontSize: 12 }}>📌</Text>}
                                <Text style={styles.noticeTitle}>{n.title}</Text>
                              </View>
                            </View>
                            <View style={[styles.priorityTag, n.priority === 'critical' ? styles.priorityCritical : styles.priorityHigh]}>
                              <Text style={styles.priorityText}>{n.priority?.toUpperCase() || 'NORMAL'}</Text>
                            </View>
                          </View>
                          <Text style={styles.noticeBody} numberOfLines={3}>{n.content}</Text>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                            <Text style={styles.noticeDate}>
                              📅 {formatNoticeDate(n)} • By: {n.author_name || 'HR'} ({n.author_role?.toUpperCase() || 'ADMIN'})
                            </Text>
                            <Text style={{ fontSize: 11, color: '#38bdf8', fontWeight: 'bold' }}>Read Notice →</Text>
                          </View>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                </View>
              )}

              {/* VIEW B: OFFICIAL NOTIFICATION LETTERS */}
              {noticesSubTab === 'letters' && (
                <View style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={styles.cardTitle}>Official Notification Letters</Text>
                      <Text style={styles.cardDesc}>Corporate letterheads with digital seal & vector PDF</Text>
                    </View>
                    {canCreateLetterMobile && (
                      <TouchableOpacity
                        style={[styles.smallAddBtn, { backgroundColor: '#4f46e5' }]}
                        onPress={handleOpenCreateLetterMobile}
                      >
                        <Text style={styles.smallAddBtnText}>+ Create Letter</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Filter Pills */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {[
                        { id: 'all', label: 'All Letters' },
                        { id: 'warning', label: '⚠️ Warning' },
                        { id: 'appreciation', label: '🌟 Appreciation' },
                        { id: 'experience', label: '🎓 Relieving' },
                        { id: 'directive', label: '📑 Directive' },
                        { id: 'notice', label: '📢 Order' }
                      ].map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            styles.filterTab,
                            letterTypeFilter === item.id && styles.filterTabActive,
                            { paddingHorizontal: 10, paddingVertical: 4 }
                          ]}
                          onPress={() => setLetterTypeFilter(item.id)}
                        >
                          <Text style={[styles.filterTabText, letterTypeFilter === item.id && styles.filterTabTextActive, { fontSize: 10 }]}>
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>

                  {/* Letters Feed */}
                  <View style={{ gap: 10, marginTop: 4 }}>
                    {filteredLetterNotices.length === 0 ? (
                      <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                        <Text style={{ fontSize: 26, marginBottom: 4 }}>📜</Text>
                        <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: 'bold' }}>No Notification Letters Found</Text>
                        <Text style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>
                          {canCreateLetterMobile ? 'Tap "+ Create Letter" to issue formal notices.' : 'No letters issued under this filter.'}
                        </Text>
                      </View>
                    ) : (
                      filteredLetterNotices.map((letter) => {
                        const meta = letter.letterMeta || parseLetterMeta(letter) || {};
                        const refNum = meta.refNumber || `REF: ${currentOrg?.orgCode || 'VDX'}/NL/2026/001`;
                        const isWarning = meta.letterType === 'warning';
                        const isAppreciation = meta.letterType === 'appreciation';
                        const isRelieving = meta.letterType === 'experience';

                        const badgeBorderColor = isWarning ? '#ef4444' : isAppreciation ? '#10b981' : isRelieving ? '#a855f7' : '#3b82f6';
                        const badgeBg = isWarning ? 'rgba(239, 68, 68, 0.12)' : isAppreciation ? 'rgba(16, 185, 129, 0.12)' : isRelieving ? 'rgba(168, 85, 247, 0.12)' : 'rgba(59, 130, 246, 0.12)';
                        const badgeText = isWarning ? 'WARNING' : isAppreciation ? 'APPRECIATION' : isRelieving ? 'RELIEVING' : 'DIRECTIVE';

                        const recipientTitle = meta.recipientType === 'all'
                          ? 'All Employees (Broadcast)'
                          : meta.recipientName ? `${meta.recipientName} (${meta.recipientDesig || 'Staff'})` : 'Employee';

                        return (
                          <View
                            key={letter.id}
                            style={[
                              styles.noticeCard,
                              { borderColor: isDarkMode ? '#334155' : '#cbd5e1', padding: 12 }
                            ]}
                          >
                            {/* Header: Ref No & Badge */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <View style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ color: '#818cf8', fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold' }}>
                                  {refNum}
                                </Text>
                              </View>
                              <View style={{ backgroundColor: badgeBg, borderColor: badgeBorderColor, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                                <Text style={{ color: badgeBorderColor, fontSize: 9, fontWeight: 'bold' }}>
                                  {badgeText}
                                </Text>
                              </View>
                            </View>

                            {/* Recipient */}
                            <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#475569', marginBottom: 4 }}>
                              To: <Text style={{ fontWeight: 'bold', color: isDarkMode ? '#f1f5f9' : '#0f172a' }}>{recipientTitle}</Text>
                            </Text>

                            {/* Title & Preview */}
                            <Text style={[styles.noticeTitle, { fontSize: 13, marginBottom: 4 }]}>
                              {letter.title}
                            </Text>
                            <Text style={[styles.noticeBody, { fontSize: 11, lineHeight: 16 }]} numberOfLines={2}>
                              {letter.content}
                            </Text>

                            {/* Stamping Indicator */}
                            {meta.isDigitallyStamped !== false && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' }}>
                                <Text style={{ color: '#10b981', fontSize: 9, fontWeight: 'bold' }}>
                                  ★ Digitally Stamped & Verified
                                </Text>
                              </View>
                            )}

                            {/* Actions Footer */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: isDarkMode ? '#334155' : '#f1f5f9' }}>
                              <Text style={{ fontSize: 9.5, color: '#94a3b8' }}>
                                📅 {formatDisplayDate(letter.date || letter.created_at)}
                              </Text>

                              <View style={{ flexDirection: 'row', gap: 6 }}>
                                <TouchableOpacity
                                  style={{ backgroundColor: isDarkMode ? '#334155' : '#e2e8f0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                                  onPress={() => setSelectedNoticeForView(letter)}
                                >
                                  <Text style={{ fontSize: 10.5, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#334155' }}>
                                    👁️ View
                                  </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={{ backgroundColor: '#4f46e5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}
                                  disabled={isExportingLetterPdf}
                                  onPress={() => handleExportLetterPDFMobile(letter)}
                                >
                                  <Text style={{ fontSize: 10.5, fontWeight: 'bold', color: '#fff' }}>
                                    📄 PDF Export
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                </View>
              )}

              {/* VIEW C: MEETINGS */}
              {noticesSubTab === 'meetings' && (
                <View style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.cardTitle}>Scheduled Meetings</Text>
                    {canApprove && (
                      <TouchableOpacity
                        style={styles.smallAddBtn}
                        onPress={() => setIsMeetingModal(true)}
                      >
                        <Text style={styles.smallAddBtnText}>+ Schedule</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.cardDesc}>Video calls & sprint syncs</Text>

                  <View style={{ gap: 10, marginTop: 10 }}>
                    {meetings.length === 0 ? (
                      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                        <Text style={{ fontSize: 24, marginBottom: 4 }}>📅</Text>
                        <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: 'bold' }}>No Meetings Scheduled</Text>
                      </View>
                    ) : (
                      meetings.map((m) => {
                        const isToday = m.date === todayStr;
                        const meetUrl = m.meeting_url || m.meetingUrl || 'https://meet.google.com/new';

                        return (
                          <View key={m.id} style={styles.meetingCard}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text style={styles.meetingTitle}>{m.title}</Text>
                                <Text style={styles.meetingMeta}>
                                  📅 {formatDisplayDate(m.date)} {isToday ? '• Today' : ''} • ⏰ {m.start_time || m.startTime} - {m.end_time || m.endTime} IST
                                </Text>
                                <Text style={styles.meetingHost}>
                                  Host: <Text style={{ color: '#38bdf8' }}>{m.organizer_name || 'Organizer'}</Text> • Dept: {m.department || 'All'}
                                </Text>
                              </View>
                              <View style={[styles.meetingStatusBadge, m.status === 'completed' ? styles.statusCompleted : styles.statusScheduled]}>
                                <Text style={styles.meetingStatusText}>{m.status?.toUpperCase() || 'SCHEDULED'}</Text>
                              </View>
                            </View>

                            <View style={styles.meetingActionsRow}>
                              <TouchableOpacity
                                style={styles.joinMeetBtn}
                                onPress={() => Linking.openURL(meetUrl).catch(() => Alert.alert('Link Error', 'Could not open URL: ' + meetUrl))}
                              >
                                <Text style={styles.joinMeetBtnText}>🎥 Join Video Call</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* 6. PROFILE & HUB TAB */}
        {/* ========================================================================= */}
        {activeTab === 'hub' && (
          <View style={{ gap: 14 }}>
            {/* Hub Subtab Selector */}
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterTab, hubSubTab === 'profile' && styles.filterTabActive]}
                onPress={() => setHubSubTab('profile')}
              >
                <Text style={[styles.filterTabText, hubSubTab === 'profile' && styles.filterTabTextActive]}>
                  👤 Profile
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterTab, hubSubTab === 'team' && styles.filterTabActive]}
                onPress={() => setHubSubTab('team')}
              >
                <Text style={[styles.filterTabText, hubSubTab === 'team' && styles.filterTabTextActive]}>
                  👥 Team ({teamProfiles.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterTab, hubSubTab === 'standups' && styles.filterTabActive]}
                onPress={() => setHubSubTab('standups')}
              >
                <Text style={[styles.filterTabText, hubSubTab === 'standups' && styles.filterTabTextActive]}>
                  🚀 Standups
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterTab, hubSubTab === 'offers' && styles.filterTabActive]}
                onPress={() => setHubSubTab('offers')}
              >
                <Text style={[styles.filterTabText, hubSubTab === 'offers' && styles.filterTabTextActive]}>
                  📜 Offers/Pay
                </Text>
              </TouchableOpacity>
            </View>

            {/* SUBTAB 1: USER PROFILE (Executive Multi-Card Layout) */}
            {hubSubTab === 'profile' && (
              <View style={{ gap: 14 }}>
                {/* 1. Executive Banner & Avatar Card */}
                <View style={styles.card}>
                  <View style={styles.profileHeaderBox}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={promptChangeProfilePhoto}
                      style={{ position: 'relative' }}
                    >
                      <View style={styles.profileAvatarLarge}>
                        {userProfile?.avatar_url ? (
                          <Image source={{ uri: userProfile.avatar_url }} style={styles.profileAvatarLargeImg} />
                        ) : (
                          <Text style={styles.profileAvatarLargeText}>
                            {(userProfile?.first_name?.[0] || 'U') + (userProfile?.last_name?.[0] || '')}
                          </Text>
                        )}
                      </View>
                      <View style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        backgroundColor: '#2563eb',
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 2,
                        borderColor: isDarkMode ? '#0d121d' : '#ffffff'
                      }}>
                        <Text style={{ fontSize: 13 }}>📷</Text>
                      </View>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.profileName}>
                        {userProfile?.first_name} {userProfile?.last_name}
                      </Text>
                      <Text style={styles.profileDesig}>{userProfile?.designation || 'Team Member'}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <View style={[
                          styles.profileRoleBadge,
                          {
                            backgroundColor: userProfile?.role === 'superadmin' ? '#4f46e5' :
                                             userProfile?.role === 'hr' ? '#10b981' :
                                             userProfile?.role === 'manager' ? '#0284c7' : '#475569'
                          }
                        ]}>
                          <Text style={styles.profileRoleBadgeText}>{(userProfile?.role || 'EMPLOYEE').toUpperCase()}</Text>
                        </View>
                        <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                            {userProfile?.department || 'Operations'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                    <TouchableOpacity
                      style={[styles.editProfileBtn, { flex: 1, backgroundColor: '#2563eb', borderColor: '#3b82f6' }]}
                      onPress={promptChangeProfilePhoto}
                    >
                      <Text style={[styles.editProfileBtnText, { color: '#ffffff' }]}>📷 Photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.editProfileBtn, { flex: 1 }]}
                      onPress={() => {
                        setEditPhone(userProfile?.phone || '');
                        setEditAvatarUrl(userProfile?.avatar_url || '');
                        setIsEditProfileModal(true);
                      }}
                    >
                      <Text style={styles.editProfileBtnText}>✏️ Edit Contact</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.editProfileBtn, { flex: 1.2, backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', borderColor: '#f59e0b' }]}
                      onPress={() => {
                        setNewPasswordInput('');
                        setConfirmPasswordInput('');
                        setShowPasswordText(false);
                        setIsChangePasswordModal(true);
                      }}
                    >
                      <Text style={[styles.editProfileBtnText, { color: '#f59e0b' }]}>🔐 Password</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 2. Official Employment & Hierarchy Card */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>🏢 Employment & Hierarchy</Text>
                  <Text style={styles.cardDesc}>Official tenant assignment & reporting chain</Text>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Employee ID:</Text>
                    <Text style={[styles.detailVal, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 11 }]}>
                      {userProfile?.id ? userProfile.id.slice(0, 13) + '...' : 'N/A'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date of Joining:</Text>
                    <Text style={[styles.detailVal, { color: '#38bdf8', fontWeight: 'bold' }]}>
                      {formatDisplayDate(userProfile?.joining_date)}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Reporting Manager:</Text>
                    <Text style={[styles.detailVal, { fontWeight: '700' }]}>
                      {(() => {
                        const mgr = teamProfiles.find((p) => p.id === userProfile?.manager_id);
                        return mgr ? (mgr.first_name + ' ' + (mgr.last_name || '') + ' (' + (mgr.designation || 'Lead') + ')') : (userProfile?.role === 'superadmin' ? 'Root Platform Superadmin' : 'Executive Head');
                      })()}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Active Tenant:</Text>
                    <Text style={[styles.detailVal, { fontWeight: 'bold', color: '#10b981' }]}>
                      {currentOrg ? currentOrg.name : 'BNK Digital'} ({currentOrg?.org_code || 'BNK'})
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Employment Status:</Text>
                    <Text style={[styles.detailVal, { color: userProfile?.is_active !== false ? '#10b981' : '#ef4444', fontWeight: 'bold' }]}>
                      {userProfile?.is_active !== false ? '● ACTIVE & VERIFIED' : '○ INACTIVE'}
                    </Text>
                  </View>
                </View>

                {/* 3. Payroll & Compensation Card */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>💰 Compensation & Payroll</Text>
                  <Text style={styles.cardDesc}>Disbursal package & official monthly compensation</Text>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Base Compensation:</Text>
                    <Text style={[styles.detailVal, { color: '#10b981', fontWeight: 'bold', fontSize: 14 }]}>
                      ₹{(Number(userProfile?.base_salary) || 0).toLocaleString('en-IN')} / month
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Payout Schedule:</Text>
                    <Text style={styles.detailVal}>Monthly Disbursal (IST)</Text>
                  </View>
                </View>

                {/* 4. Contact Information Card */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>📞 Contact Information</Text>
                  <Text style={styles.cardDesc}>Primary communication channels</Text>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Work Email:</Text>
                    <Text style={styles.detailVal}>{userProfile?.email}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Contact Phone:</Text>
                    <Text style={styles.detailVal}>{userProfile?.phone || 'Not Provided'}</Text>
                  </View>
                </View>

                {/* 5. 4 Corporate Themes Card */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>🎨 Appearance & Theme Palette</Text>
                  <Text style={styles.cardDesc}>Choose your enterprise executive color palette</Text>

                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                    {[
                      { key: 'dark', label: '🌙 Dark', desc: 'Obsidian' },
                      { key: 'light', label: '☀️ Light', desc: 'Daylight' },
                      { key: 'navy', label: '🌌 Navy', desc: 'Midnight' },
                      { key: 'emerald', label: '🌲 Mint', desc: 'Emerald' }
                    ].map((t) => {
                      const isSelected = themeMode === t.key;
                      return (
                        <TouchableOpacity
                          key={t.key}
                          style={[
                            styles.drawerThemeChip,
                            isSelected && styles.drawerThemeChipSelected,
                            { paddingVertical: 10 }
                          ]}
                          onPress={() => handleSelectTheme(t.key as any)}
                        >
                          <Text style={[
                            styles.drawerThemeChipText,
                            isSelected && styles.drawerThemeChipTextSelected,
                            { fontSize: 11 }
                          ]}>
                            {t.label}
                          </Text>
                          <Text style={{ fontSize: 9, color: isSelected ? '#2563eb' : '#64748b', marginTop: 1 }}>
                            {t.desc}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* 6. EAS Over-The-Air Instant Updates Card */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>🚀 Instant App Updates (EAS OTA)</Text>
                  <Text style={styles.cardDesc}>App automatically updates Over-The-Air without downloading APKs</Text>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Update Channel:</Text>
                    <Text style={[styles.detailVal, { color: '#10b981', fontWeight: 'bold' }]}>production / preview</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Auto Background Sync:</Text>
                    <Text style={[styles.detailVal, { color: '#38bdf8', fontWeight: 'bold' }]}>ENABLED (On Startup)</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.loginBtn, { marginTop: 12, backgroundColor: '#2563eb' }]}
                    onPress={handleManualCheckUpdates}
                    disabled={isCheckingUpdate}
                  >
                    <Text style={styles.loginBtnText}>
                      {isCheckingUpdate ? 'Checking EAS Server...' : '🔄 Check for App Updates Now'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 7. Organization Shift & Geofence (Superadmin / HR) */}
                {isPrivileged && (
                  <View style={[styles.card, { borderColor: '#6366f1' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.cardTitle, { color: '#818cf8' }]}>⚙️ Organization Settings</Text>
                      <TouchableOpacity
                        style={[styles.smallAddBtn, { backgroundColor: '#4f46e5' }]}
                        onPress={() => {
                          setOrgShiftStart(currentOrg?.settings?.shiftStartTime || '09:30');
                          setOrgShiftEnd(currentOrg?.settings?.shiftEndTime || '18:30');
                          setOrgGracePeriod(String(currentOrg?.settings?.gracePeriodMins || 15));
                          setOrgGeofenceRadius(String(currentOrg?.settings?.geofenceRadiusMeters || 200));
                          setIsOrgSettingsModal(true);
                        }}
                      >
                        <Text style={styles.smallAddBtnText}>⚙️ Manage</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.cardDesc}>Configure working hours, grace period, and GPS geofence threshold.</Text>
                  </View>
                )}
              </View>
            )}

            {/* SUBTAB 2: TEAM DIRECTORY (WITH JOINING DATE EDITING FOR HR) */}
            {hubSubTab === 'team' && (
              <View style={{ gap: 14 }}>
                <View style={styles.card}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.cardTitle}>Team Directory ({teamProfiles.length})</Text>
                    {isPrivileged && (
                      <TouchableOpacity
                        style={styles.smallAddBtn}
                        onPress={() => setIsAddEmpModal(true)}
                      >
                        <Text style={styles.smallAddBtnText}>+ Add Member</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.cardDesc}>Company organization hierarchy for {currentOrg?.name}</Text>

                  <TextInput
                    style={[styles.textInput, { marginVertical: 8 }]}
                    value={teamSearchQuery}
                    onChangeText={setTeamSearchQuery}
                    placeholder="Search by name, role or designation..."
                    placeholderTextColor="#64748b"
                  />

                  <View style={{ gap: 8, marginTop: 6 }}>
                    {teamProfiles
                      .filter((p) => {
                        if (!teamSearchQuery.trim()) return true;
                        const q = teamSearchQuery.toLowerCase();
                        return (
                          p.first_name?.toLowerCase().includes(q) ||
                          p.last_name?.toLowerCase().includes(q) ||
                          p.designation?.toLowerCase().includes(q) ||
                          p.role?.toLowerCase().includes(q)
                        );
                      })
                      .map((member) => {
                        const mgr = teamProfiles.find((p) => p.id === member.manager_id);
                        return (
                          <TouchableOpacity
                            key={member.id}
                            style={styles.teamCard}
                            activeOpacity={0.7}
                            onPress={() => setInspectedUserProfile(member)}
                          >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={styles.teamName}>
                                    {member.first_name} {member.last_name}
                                  </Text>
                                  <Text style={{ fontSize: 10, color: '#38bdf8' }}>↗</Text>
                                </View>
                                <Text style={styles.teamDesig}>
                                  {member.designation || 'Staff'} • {member.department || 'Operations'}
                                </Text>
                                <Text style={styles.teamEmail}>{member.email}</Text>
                                <Text style={styles.teamJoining}>
                                  Joined: {formatDisplayDate(member.joining_date)}
                                </Text>
                                {mgr && (
                                  <Text style={styles.teamManager}>
                                    Reports To: {mgr.first_name} {mgr.last_name}
                                  </Text>
                                )}
                              </View>

                              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                <View style={styles.rolePill}>
                                  <Text style={styles.rolePillText}>{member.role?.toUpperCase()}</Text>
                                </View>

                                {/* Joining Date Edit Button for HR / Superadmin */}
                                {isPrivileged && (
                                  <TouchableOpacity
                                    style={styles.editJoiningBtn}
                                    onPress={(e) => {
                                      e.stopPropagation?.();
                                      setTargetEmpForJoining(member);
                                      setUpdatedJoiningDateVal(member.joining_date || getTodayISTDate());
                                      setIsEditJoiningModal(true);
                                    }}
                                  >
                                    <Text style={styles.editJoiningBtnText}>Edit Joining 📅</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                  </View>
                </View>
              </View>
            )}

            {/* SUBTAB 3: EOD STANDUPS */}
            {hubSubTab === 'standups' && (() => {
              const todayStr = getTodayISTDate();
              const yesterdayDate = new Date();
              yesterdayDate.setDate(yesterdayDate.getDate() - 1);
              const yesterdayStr = yesterdayDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

              // Direct reports managed by current user
              const myDirectReports = teamProfiles.filter((p) => p.manager_id === userProfile?.id);
              const isLeadOrManager = !isPrivileged && myDirectReports.length > 0;

              // Filtered standups list
              const filteredList = standups.filter((st) => {
                // If individual contributor: can view all org standups
                // Filter by employee
                if (standupEmpFilter !== 'all' && st.employee_id !== standupEmpFilter) return false;
                // Filter by date
                if (standupDateFilter === 'today' && st.date !== todayStr) return false;
                if (standupDateFilter === 'yesterday' && st.date !== yesterdayStr) return false;
                return true;
              });

              // Metrics
              const todayStandups = standups.filter((s) => s.date === todayStr);
              const totalHoursToday = todayStandups.reduce((acc, s) => acc + (Number(s.hours_logged) || 8), 0);
              const todayBlockersCount = todayStandups.filter((s) => s.blockers && s.blockers.trim()).length;

              // Missing EOD Submissions (punched in today but no standup yet)
              const checkedInEmpIds = new Set(
                attendanceRecords.filter((a) => a.date === todayStr && a.status === 'present').map((a) => a.employee_id)
              );
              const submittedEmpIds = new Set(todayStandups.map((s) => s.employee_id));
              const missingStandupEmps = teamProfiles.filter(
                (p) => checkedInEmpIds.has(p.id) && !submittedEmpIds.has(p.id)
              );

              return (
                <View style={{ gap: 14 }}>
                  {/* Standup Metrics Row */}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={[styles.pulseStatItem, { flex: 1, padding: 10 }]}>
                      <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: 'bold' }}>TODAY'S LOGS</Text>
                      <Text style={[styles.pulseStatValue, { fontSize: 18, marginTop: 2 }]}>
                        {todayStandups.length}/{teamProfiles.length}
                      </Text>
                    </View>
                    <View style={[styles.pulseStatItem, { flex: 1, padding: 10 }]}>
                      <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: 'bold' }}>HOURS TODAY</Text>
                      <Text style={[styles.pulseStatValue, { fontSize: 18, color: '#38bdf8', marginTop: 2 }]}>
                        {totalHoursToday}h
                      </Text>
                    </View>
                    <View style={[styles.pulseStatItem, { flex: 1, padding: 10 }]}>
                      <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: 'bold' }}>BLOCKERS</Text>
                      <Text style={[styles.pulseStatValue, { fontSize: 18, color: todayBlockersCount > 0 ? '#f59e0b' : '#94a3b8', marginTop: 2 }]}>
                        {todayBlockersCount}
                      </Text>
                    </View>
                  </View>

                  {/* Missing Submissions Alert for Managers/HR */}
                  {(isPrivileged || isLeadOrManager) && missingStandupEmps.length > 0 && (
                    <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.3)', borderWidth: 1, borderRadius: 12, padding: 10 }}>
                      <Text style={{ color: '#f87171', fontWeight: 'bold', fontSize: 11 }}>
                        ⚠️ Missing EOD Standup Today ({missingStandupEmps.length}):
                      </Text>
                      <Text style={{ color: '#fca5a5', fontSize: 10, marginTop: 2 }}>
                        {missingStandupEmps.map((e) => `${e.first_name} ${e.last_name}`).join(', ')}
                      </Text>
                    </View>
                  )}

                  <View style={styles.card}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1, paddingRight: 6 }}>
                        <Text style={styles.cardTitle}>Daily EOD Standup</Text>
                        <Text style={styles.cardDesc}>Accountability & PR accomplishment logs</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          style={[styles.smallAddBtn, { backgroundColor: '#4f46e5' }]}
                          disabled={isExportingStandupPdf}
                          onPress={() => handleExportStandupPDFMobile(filteredList)}
                        >
                          <Text style={styles.smallAddBtnText}>
                            {isExportingStandupPdf ? 'Generating...' : '📄 PDF Export'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.smallAddBtn}
                          onPress={() => setIsStandupModal(true)}
                        >
                          <Text style={styles.smallAddBtnText}>+ Submit</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Date Filter Pills */}
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, marginBottom: 8 }}>
                      {(['all', 'today', 'yesterday'] as const).map((filterKey) => (
                        <TouchableOpacity
                          key={filterKey}
                          style={[
                            styles.filterTab,
                            standupDateFilter === filterKey && styles.filterTabActive,
                            { paddingHorizontal: 10, paddingVertical: 4 }
                          ]}
                          onPress={() => setStandupDateFilter(filterKey)}
                        >
                          <Text style={[styles.filterTabText, standupDateFilter === filterKey && styles.filterTabTextActive, { fontSize: 10 }]}>
                            {filterKey === 'all' ? 'All History' : filterKey === 'today' ? "Today's Feed" : 'Yesterday'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Employee Selector for Managers & Superadmin */}
                    {(isPrivileged || isLeadOrManager) && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity
                            style={[
                              styles.filterTab,
                              standupEmpFilter === 'all' && styles.filterTabActive,
                              { paddingHorizontal: 10, paddingVertical: 4 }
                            ]}
                            onPress={() => setStandupEmpFilter('all')}
                          >
                            <Text style={[styles.filterTabText, standupEmpFilter === 'all' && styles.filterTabTextActive, { fontSize: 10 }]}>
                              👥 All Members
                            </Text>
                          </TouchableOpacity>
                          {teamProfiles.map((member) => (
                            <TouchableOpacity
                              key={member.id}
                              style={[
                                styles.filterTab,
                                standupEmpFilter === member.id && styles.filterTabActive,
                                { paddingHorizontal: 10, paddingVertical: 4 }
                              ]}
                              onPress={() => setStandupEmpFilter(member.id)}
                            >
                              <Text style={[styles.filterTabText, standupEmpFilter === member.id && styles.filterTabTextActive, { fontSize: 10 }]}>
                                {member.first_name} {member.last_name?.[0]}.
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    )}

                    <View style={{ gap: 10, marginTop: 4 }}>
                      {filteredList.length === 0 ? (
                        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                          <Text style={{ fontSize: 24, marginBottom: 4 }}>🚀</Text>
                          <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: 'bold' }}>No Standups Found</Text>
                          <Text style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>Tap "+ Submit Today" to log accomplishments.</Text>
                        </View>
                      ) : (
                        filteredList.map((st) => {
                          const emp = teamProfiles.find((p) => p.id === st.employee_id) || (st.employee_id === userProfile?.id ? userProfile : null);
                          const isGithubPR = st.completed_today?.includes('github.com') && st.completed_today?.includes('/pull/');
                          return (
                            <View key={st.id} style={styles.standupFeedItem}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View>
                                  <Text style={styles.standupAuthor}>
                                    {emp ? `${emp.first_name} ${emp.last_name}` : 'Team Member'}
                                  </Text>
                                  <Text style={{ color: '#64748b', fontSize: 9 }}>
                                    {emp?.designation || 'Specialist'} • {emp?.department || 'Operations'}
                                  </Text>
                                </View>
                                <Text style={styles.standupDate}>{formatDisplayDate(st.date)} • {st.hours_logged}h</Text>
                              </View>
                              <Text style={styles.standupText}>
                                <Text style={{ color: '#10b981', fontWeight: 'bold' }}>Done: </Text>
                                {st.completed_today}
                              </Text>
                              <Text style={styles.standupText}>
                                <Text style={{ color: '#38bdf8', fontWeight: 'bold' }}>Next: </Text>
                                {st.planned_tomorrow}
                              </Text>
                              {st.blockers ? (
                                <Text style={[styles.standupText, { color: '#f59e0b' }]}>
                                  ⚠️ Blocker: {st.blockers}
                                </Text>
                              ) : null}
                              {isGithubPR && (
                                <View style={{ marginTop: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(168, 85, 247, 0.15)', borderColor: 'rgba(168, 85, 247, 0.3)', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                                  <Text style={{ color: '#c084fc', fontSize: 9, fontWeight: 'bold' }}>🔗 PR Deliverable Attached</Text>
                                </View>
                              )}
                            </View>
                          );
                        })
                      )}
                    </View>
                  </View>
                </View>
              );
            })()}

            {/* SUBTAB 4: OFFERS & PAYROLL */}
            {hubSubTab === 'offers' && (
              <View style={{ gap: 14 }}>
                {/* Anti-Fraud Offer Verification */}
                <View style={styles.card}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.cardTitle}>Offer Letter Verification</Text>
                    {isPrivileged && (
                      <TouchableOpacity
                        style={styles.smallAddBtn}
                        onPress={() => setIsNewOfferModal(true)}
                      >
                        <Text style={styles.smallAddBtnText}>+ Issue Offer</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.cardDesc}>Cryptographic anti-fraud letterhead verification</Text>

                  <View style={{ flexDirection: 'row', gap: 6, marginVertical: 8 }}>
                    <TextInput
                      style={[styles.textInput, { flex: 1, textTransform: 'uppercase' }]}
                      value={verifyQuery}
                      onChangeText={setVerifyQuery}
                      placeholder="e.g. VDX-BNK-2026-F98A"
                      placeholderTextColor="#64748b"
                    />
                    <TouchableOpacity style={styles.verifyActionBtn} onPress={handleVerifySerial}>
                      <Text style={styles.verifyActionBtnText}>Verify</Text>
                    </TouchableOpacity>
                  </View>

                  {verifyResult && verifyResult !== 'NOT_FOUND' && (
                    <View style={styles.verifySuccess}>
                      <Text style={styles.verifySuccessTitle}>✅ GENUINE & AUTHENTIC OFFER</Text>
                      <Text style={styles.verifySuccessSub}>Candidate: {verifyResult.candidate_name}</Text>
                      <Text style={styles.verifySuccessSub}>Role: {verifyResult.designation} • {verifyResult.department}</Text>
                      <Text style={styles.verifySuccessSerial}>Serial: {verifyResult.serial_number}</Text>
                    </View>
                  )}

                  {verifyResult === 'NOT_FOUND' && (
                    <View style={styles.verifyFail}>
                      <Text style={styles.verifyFailText}>❌ SERIAL RECORD NOT FOUND</Text>
                    </View>
                  )}
                </View>

                {/* My Compensation Card */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>My Compensation Structure</Text>
                  <Text style={styles.cardDesc}>Tax-compliant salary details</Text>

                  <View style={styles.payGrid}>
                    <View style={styles.payItem}>
                      <Text style={styles.payLabel}>Annual Fixed CTC</Text>
                      <Text style={styles.payVal}>₹{(userProfile?.base_salary ? userProfile.base_salary * 12 : 1200000).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.payItem}>
                      <Text style={styles.payLabel}>Monthly Basic (50%)</Text>
                      <Text style={styles.payVal}>₹{(userProfile?.base_salary ? Math.round(userProfile.base_salary * 0.5) : 50000).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.payItem}>
                      <Text style={styles.payLabel}>HRA (25%)</Text>
                      <Text style={styles.payVal}>₹{(userProfile?.base_salary ? Math.round(userProfile.base_salary * 0.25) : 25000).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.payItem}>
                      <Text style={styles.payLabel}>Special Allowance</Text>
                      <Text style={styles.payVal}>₹{(userProfile?.base_salary ? Math.round(userProfile.base_salary * 0.25) : 25000).toLocaleString('en-IN')}</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODERN SLIDE-OUT DRAWER / SIDEBAR (Role-Gated & Dynamic)                  */}
      {/* ========================================================================= */}
      <Modal visible={isDrawerOpen} animationType="fade" transparent onRequestClose={() => setIsDrawerOpen(false)}>
        <View style={styles.drawerBackdrop}>
          <TouchableOpacity style={styles.drawerBackdropDismiss} activeOpacity={1} onPress={() => setIsDrawerOpen(false)} />
          <View style={styles.drawerContent}>
            {/* Drawer Header */}
            <View style={styles.drawerHeader}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <View style={styles.drawerVedotrixPill}>
                      <Text style={styles.drawerVedotrixPillText}>⚡ VEDOTRIX PULSE</Text>
                    </View>
                  </View>
                  <Text style={styles.drawerOrgName} numberOfLines={1}>{currentOrg ? currentOrg.name : 'BNK Digital'}</Text>
                </View>
                <TouchableOpacity onPress={() => setIsDrawerOpen(false)} style={styles.drawerCloseBtn}>
                  <Text style={{ color: '#94a3b8', fontSize: 18, fontWeight: 'bold' }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* User Profile Card in Drawer */}
              <View style={styles.drawerProfileCard}>
                <View style={styles.drawerAvatarCircle}>
                  {userProfile?.avatar_url ? (
                    <Image source={{ uri: userProfile.avatar_url }} style={{ width: '100%', height: '100%', borderRadius: 20 }} />
                  ) : (
                    <Text style={styles.drawerAvatarInitials}>
                      {(userProfile?.first_name?.[0] || 'U') + (userProfile?.last_name?.[0] || '')}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.drawerProfileName} numberOfLines={1}>
                    {userProfile?.first_name} {userProfile?.last_name}
                  </Text>
                  <Text style={styles.drawerProfileEmail} numberOfLines={1}>{userProfile?.email}</Text>
                  <View style={[
                    styles.drawerRoleBadge,
                    isSuperadminRole ? { backgroundColor: 'rgba(168, 85, 247, 0.15)', borderColor: '#a855f7' } :
                    isPrivilegedRole ? { backgroundColor: 'rgba(37, 99, 235, 0.15)', borderColor: '#2563eb' } :
                    isManagerRole ? { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#f59e0b' } :
                    { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10b981' }
                  ]}>
                    <Text style={[
                      styles.drawerRoleBadgeText,
                      isSuperadminRole ? { color: '#c084fc' } :
                      isPrivilegedRole ? { color: '#38bdf8' } :
                      isManagerRole ? { color: '#fbbf24' } : { color: '#34d399' }
                    ]}>
                      {(userProfile?.role || 'Employee').toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Drawer Navigation Menu List (Scrollable) */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 12 }}>
              <Text style={styles.drawerSectionHeading}>CORE WORKSPACE</Text>

              <TouchableOpacity
                style={[styles.drawerItem, (activeTab === 'home' || activeTab === 'punch') && styles.drawerItemActive]}
                onPress={() => {
                  setActiveTab('home');
                  setIsDrawerOpen(false);
                }}
              >
                <Text style={styles.drawerItemIcon}>🏠</Text>
                <Text style={[styles.drawerItemLabel, (activeTab === 'home' || activeTab === 'punch') && styles.drawerItemLabelActive]}>Dashboard</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.drawerItem, activeTab === 'people' && styles.drawerItemActive]}
                onPress={() => {
                  setActiveTab('people');
                  setIsDrawerOpen(false);
                }}
              >
                <Text style={styles.drawerItemIcon}>👥</Text>
                <Text style={[styles.drawerItemLabel, activeTab === 'people' && styles.drawerItemLabelActive]}>People & Directory</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.drawerItem, (activeTab === 'attendance' || activeTab === 'calendar') && styles.drawerItemActive]}
                onPress={() => {
                  setActiveTab('attendance');
                  setAttendanceSubView('today');
                  setIsDrawerOpen(false);
                }}
              >
                <Text style={styles.drawerItemIcon}>📅</Text>
                <Text style={[styles.drawerItemLabel, (activeTab === 'attendance' || activeTab === 'calendar') && styles.drawerItemLabelActive]}>Attendance & Shifts</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.drawerItem, activeTab === 'chat' && styles.drawerItemActive]}
                onPress={() => {
                  setActiveTab('chat');
                  setIsDrawerOpen(false);
                }}
              >
                <Text style={styles.drawerItemIcon}>💬</Text>
                <Text style={[styles.drawerItemLabel, activeTab === 'chat' && styles.drawerItemLabelActive]}>Team Chat</Text>
              </TouchableOpacity>

              <Text style={styles.drawerSectionHeading}>COLLABORATION & LOGS</Text>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => {
                  setActiveTab('more');
                  setMoreSection('meetings');
                  setIsDrawerOpen(false);
                }}
              >
                <Text style={styles.drawerItemIcon}>📹</Text>
                <Text style={styles.drawerItemLabel}>Meetings & Sync</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => {
                  setActiveTab('more');
                  setMoreSection('standups');
                  setHubSubTab('standups');
                  setIsDrawerOpen(false);
                }}
              >
                <Text style={styles.drawerItemIcon}>📝</Text>
                <Text style={styles.drawerItemLabel}>Daily Standups</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => {
                  setActiveTab('more');
                  setMoreSection('leaves');
                  setIsDrawerOpen(false);
                }}
              >
                <Text style={styles.drawerItemIcon}>🌴</Text>
                <Text style={styles.drawerItemLabel}>Leave Requests</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => {
                  setActiveTab('more');
                  setMoreSection('notices');
                  setIsDrawerOpen(false);
                }}
              >
                <Text style={styles.drawerItemIcon}>📢</Text>
                <Text style={styles.drawerItemLabel}>Notices & Circulars</Text>
              </TouchableOpacity>

              {/* PRIVILEGED MANAGEMENT SECTION (Manager / HR / Admin / Superadmin Only) */}
              {(isPrivilegedRole || isManagerRole) && (
                <>
                  <Text style={styles.drawerSectionHeading}>MANAGEMENT</Text>

                  <TouchableOpacity
                    style={styles.drawerItem}
                    onPress={() => {
                      setActiveTab('more');
                      setMoreSection('approvals');
                      setIsDrawerOpen(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Text style={styles.drawerItemIcon}>⚡</Text>
                        <Text style={styles.drawerItemLabel}>Approval Center</Text>
                      </View>
                      {totalPendingApprovals > 0 && (
                        <View style={styles.drawerBadge}>
                          <Text style={styles.drawerBadgeText}>{totalPendingApprovals}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>

                  {isPrivilegedRole && (
                    <TouchableOpacity
                      style={styles.drawerItem}
                      onPress={() => {
                        setIsDrawerOpen(false);
                        setIsCalendarPoliciesModal(true);
                      }}
                    >
                      <Text style={styles.drawerItemIcon}>⚙️</Text>
                      <Text style={styles.drawerItemLabel}>Calendar Policies</Text>
                    </TouchableOpacity>
                  )}

                  {isSuperadminRole && (
                    <TouchableOpacity
                      style={styles.drawerItem}
                      onPress={() => {
                        setIsDrawerOpen(false);
                        setIsOrgModalVisible(true);
                      }}
                    >
                      <Text style={styles.drawerItemIcon}>🏢</Text>
                      <Text style={styles.drawerItemLabel}>Switch Organization</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </ScrollView>

            {/* Drawer Footer */}
            <View style={styles.drawerFooter}>
              <View style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 6 }}>
                  SELECT APP THEME
                </Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[
                    { key: 'dark', label: '🌙 Dark', color: '#07090e' },
                    { key: 'light', label: '☀️ Light', color: '#ffffff' },
                    { key: 'navy', label: '🌌 Navy', color: '#0a1128' },
                    { key: 'emerald', label: '🌲 Mint', color: '#061a14' }
                  ].map((t) => {
                    const isSelected = themeMode === t.key;
                    return (
                      <TouchableOpacity
                        key={t.key}
                        style={[
                          styles.drawerThemeChip,
                          isSelected && styles.drawerThemeChipSelected
                        ]}
                        onPress={() => handleSelectTheme(t.key as any)}
                      >
                        <Text style={[
                          styles.drawerThemeChipText,
                          isSelected && styles.drawerThemeChipTextSelected
                        ]}>
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity
                style={styles.drawerLogoutBtn}
                onPress={() => {
                  setIsDrawerOpen(false);
                  handleLogout();
                }}
              >
                <Text style={styles.drawerLogoutBtnText}>🚪 Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* FLOATING ACTION BUTTON (+) & QUICK ACTIONS BOTTOM SHEET MODAL             */}
      {/* ========================================================================= */}
      <TouchableOpacity
        style={styles.fabButton}
        onPress={() => setIsFabMenuOpen(true)}
        activeOpacity={0.85}
        accessibilityLabel="Quick Actions"
      >
        <Text style={styles.fabButtonText}>+</Text>
      </TouchableOpacity>

      <Modal visible={isFabMenuOpen} animationType="fade" transparent>
        <TouchableOpacity
          style={styles.fabModalOverlay}
          activeOpacity={1}
          onPress={() => setIsFabMenuOpen(false)}
        >
          <View style={styles.fabMenuContainer}>
            <Text style={styles.fabMenuHeader}>⚡ Quick Actions</Text>
            
            <TouchableOpacity
              style={styles.fabMenuItem}
              onPress={() => {
                setIsFabMenuOpen(false);
                setIsStandupModal(true);
              }}
            >
              <Text style={styles.fabMenuIcon}>📝</Text>
              <View>
                <Text style={styles.fabMenuLabel}>Submit Daily Standup</Text>
                <Text style={styles.fabMenuSub}>Log completed tasks, blockers & PR</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.fabMenuItem}
              onPress={() => {
                setIsFabMenuOpen(false);
                setActiveTab('attendance');
                setAttendanceSubView('today');
              }}
            >
              <Text style={styles.fabMenuIcon}>📍</Text>
              <View>
                <Text style={styles.fabMenuLabel}>Mark Attendance</Text>
                <Text style={styles.fabMenuSub}>Verify GPS & log single-punch in</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.fabMenuItem}
              onPress={() => {
                setIsFabMenuOpen(false);
                setRegTargetDate(getTodayISTDate());
                setIsRegModal(true);
              }}
            >
              <Text style={styles.fabMenuIcon}>✍️</Text>
              <View>
                <Text style={styles.fabMenuLabel}>Request Regularization</Text>
                <Text style={styles.fabMenuSub}>Apply to regularize unmarked punch</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.fabMenuItem}
              onPress={() => {
                setIsFabMenuOpen(false);
                setLeaveStartDate(getTodayISTDate());
                setLeaveEndDate(getTodayISTDate());
                setIsLeaveModal(true);
              }}
            >
              <Text style={styles.fabMenuIcon}>🌴</Text>
              <View>
                <Text style={styles.fabMenuLabel}>Apply For Leave</Text>
                <Text style={styles.fabMenuSub}>Vacation, sick or casual absence</Text>
              </View>
            </TouchableOpacity>

            {canApprove && (
              <TouchableOpacity
                style={styles.fabMenuItem}
                onPress={() => {
                  setIsFabMenuOpen(false);
                  setIsMeetingModal(true);
                }}
              >
                <Text style={styles.fabMenuIcon}>📹</Text>
                <View>
                  <Text style={styles.fabMenuLabel}>Schedule Meeting</Text>
                  <Text style={styles.fabMenuSub}>Host video call or sprint sync</Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.fabMenuItem, { borderBottomWidth: 0, marginTop: 4, justifyContent: 'center' }]}
              onPress={() => setIsFabMenuOpen(false)}
            >
              <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 13, textAlign: 'center', width: '100%' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ========================================================================= */}
      {/* 5-TAB BOTTOM NAVIGATION BAR (Home, People, Attendance, Chat, More)        */}
      {/* ========================================================================= */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navItem, (activeTab === 'home' || activeTab === 'punch') && styles.navItemActive]}
          onPress={() => setActiveTab('home')}
        >
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={[styles.navLabel, (activeTab === 'home' || activeTab === 'punch') && styles.navLabelActive]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'people' && styles.navItemActive]}
          onPress={() => setActiveTab('people')}
        >
          <Text style={styles.navIcon}>👥</Text>
          <Text style={[styles.navLabel, activeTab === 'people' && styles.navLabelActive]}>People</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, (activeTab === 'attendance' || activeTab === 'calendar') && styles.navItemActive]}
          onPress={() => {
            setActiveTab('attendance');
            setAttendanceSubView('today');
          }}
        >
          <Text style={styles.navIcon}>📅</Text>
          <Text style={[styles.navLabel, (activeTab === 'attendance' || activeTab === 'calendar') && styles.navLabelActive]}>Attendance</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'chat' && styles.navItemActive]}
          onPress={() => setActiveTab('chat')}
        >
          <Text style={styles.navIcon}>💬</Text>
          <Text style={[styles.navLabel, activeTab === 'chat' && styles.navLabelActive]}>Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, (activeTab === 'more' || activeTab === 'notices' || activeTab === 'hub' || activeTab === 'leaves' || activeTab === 'approvals') && styles.navItemActive]}
          onPress={() => {
            setActiveTab('more');
            setMoreSection('meetings');
          }}
        >
          <View style={{ position: 'relative' }}>
            <Text style={styles.navIcon}>•••</Text>
            {totalPendingApprovals > 0 && canApprove && (
              <View style={styles.navBadge}>
                <Text style={styles.navBadgeText}>{totalPendingApprovals}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.navLabel, (activeTab === 'more' || activeTab === 'notices' || activeTab === 'hub' || activeTab === 'leaves' || activeTab === 'approvals') && styles.navLabelActive]}>More</Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* MODAL 0: CALENDAR POLICIES & CUSTOMIZATION (HR / SUPERADMIN) */}
      {/* ========================================================================= */}
      <Modal visible={isCalendarPoliciesModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%', paddingBottom: 14 }]}>
            {/* Pinned Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 6 }}>
              <View style={{ flex: 1, paddingRight: 6 }}>
                <Text style={styles.modalTitle}>Calendar & Shift Policies</Text>
                <Text style={styles.modalSub}>{currentOrg?.name} &bull; Supabase Live Sync</Text>
              </View>
              <TouchableOpacity onPress={() => setIsCalendarPoliciesModal(false)} style={{ padding: 4 }}>
                <Text style={{ fontSize: 18, color: '#94a3b8', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Sub-tab navigation */}
            <View style={{ flexDirection: 'row', gap: 6, marginVertical: 6, width: '100%' }}>
              <TouchableOpacity
                style={[styles.filterTab, calPolicyTab === 'shift' && styles.filterTabActive, { flex: 1 }]}
                onPress={() => setCalPolicyTab('shift')}
              >
                <Text style={[styles.filterTabText, calPolicyTab === 'shift' && styles.filterTabTextActive, { textAlign: 'center', fontSize: 10 }]}>
                  ⏰ Shift & Offs
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterTab, calPolicyTab === 'emp_weekoffs' && styles.filterTabActive, { flex: 1 }]}
                onPress={() => setCalPolicyTab('emp_weekoffs')}
              >
                <Text style={[styles.filterTabText, calPolicyTab === 'emp_weekoffs' && styles.filterTabTextActive, { textAlign: 'center', fontSize: 10 }]}>
                  👤 Employee Offs
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterTab, calPolicyTab === 'holidays' && styles.filterTabActive, { flex: 1 }]}
                onPress={() => setCalPolicyTab('holidays')}
              >
                <Text style={[styles.filterTabText, calPolicyTab === 'holidays' && styles.filterTabTextActive, { textAlign: 'center', fontSize: 10 }]}>
                  🌴 Holidays
                </Text>
              </TouchableOpacity>
            </View>

            {/* Scrollable Body */}
            <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%', flex: 1, marginVertical: 4 }}>
              {/* TAB 1: SHIFT & GLOBAL WEEK-OFFS */}
              {calPolicyTab === 'shift' && (
                <View style={{ gap: 8 }}>
                  <Text style={styles.inputLabel}>Shift Start Time (HH:MM IST)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={orgShiftStart}
                    onChangeText={setOrgShiftStart}
                    placeholder="09:30"
                    placeholderTextColor="#64748b"
                  />

                  <Text style={styles.inputLabel}>Shift End Time (HH:MM IST)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={orgShiftEnd}
                    onChangeText={setOrgShiftEnd}
                    placeholder="18:30"
                    placeholderTextColor="#64748b"
                  />

                  <Text style={styles.inputLabel}>Late Grace Period (Minutes)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={orgGracePeriod}
                    onChangeText={setOrgGracePeriod}
                    placeholder="15"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                  />

                  <Text style={[styles.inputLabel, { marginTop: 6 }]}>Default Organization Week-Off Days:</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {[
                      { num: 0, label: 'Sun' },
                      { num: 1, label: 'Mon' },
                      { num: 2, label: 'Tue' },
                      { num: 3, label: 'Wed' },
                      { num: 4, label: 'Thu' },
                      { num: 5, label: 'Fri' },
                      { num: 6, label: 'Sat' }
                    ].map((d) => {
                      const isChecked = calPolicyOrgWeekOffs.includes(d.num);
                      return (
                        <TouchableOpacity
                          key={d.num}
                          style={[
                            styles.filterTab,
                            isChecked && styles.filterTabActive,
                            { paddingHorizontal: 12, paddingVertical: 6 }
                          ]}
                          onPress={() => {
                            setCalPolicyOrgWeekOffs((prev) =>
                              isChecked ? prev.filter((x) => x !== d.num) : [...prev, d.num]
                            );
                          }}
                        >
                          <Text style={[styles.filterTabText, isChecked && styles.filterTabTextActive]}>
                            {isChecked ? '✓ ' : ''}{d.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* TAB 2: EMPLOYEE-SPECIFIC WEEK-OFFS */}
              {calPolicyTab === 'emp_weekoffs' && (
                <View style={{ gap: 8 }}>
                  <Text style={styles.inputLabel}>Select Employee to Configure:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {teamProfiles.map((emp) => {
                        const isSelected = calPolicySelectedEmp === emp.id;
                        return (
                          <TouchableOpacity
                            key={emp.id}
                            style={[styles.calEmpPill, isSelected && styles.calEmpPillActive]}
                            onPress={() => setCalPolicySelectedEmp(emp.id)}
                          >
                            <Text style={[styles.calEmpPillText, isSelected && styles.calEmpPillTextActive]}>
                              {emp.first_name} {emp.last_name?.[0]}.
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>

                  {calPolicySelectedEmp ? (() => {
                    const activeEmp = teamProfiles.find((p) => p.id === calPolicySelectedEmp);
                    const currentEmpOffs: number[] = calPolicyEmpWeekOffs[calPolicySelectedEmp] || [0];

                    return (
                      <View style={{ marginTop: 8, padding: 12, backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0' }}>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: isDarkMode ? '#fff' : '#0f172a' }}>
                          Custom Weekly Off Days for {activeEmp?.first_name} {activeEmp?.last_name}:
                        </Text>
                        <Text style={{ fontSize: 10, color: '#94a3b8', marginVertical: 4 }}>
                          Set custom rest days for this employee (overrides organization defaults).
                        </Text>

                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                          {[
                            { num: 0, label: 'Sun' },
                            { num: 1, label: 'Mon' },
                            { num: 2, label: 'Tue' },
                            { num: 3, label: 'Wed' },
                            { num: 4, label: 'Thu' },
                            { num: 5, label: 'Fri' },
                            { num: 6, label: 'Sat' }
                          ].map((d) => {
                            const isChecked = currentEmpOffs.includes(d.num);
                            return (
                              <TouchableOpacity
                                key={d.num}
                                style={[
                                  styles.filterTab,
                                  isChecked && styles.filterTabActive,
                                  { paddingHorizontal: 12, paddingVertical: 6 }
                                ]}
                                onPress={() => {
                                  const updatedOffs = isChecked
                                    ? currentEmpOffs.filter((x) => x !== d.num)
                                    : [...currentEmpOffs, d.num];
                                  setCalPolicyEmpWeekOffs((prev) => ({
                                    ...prev,
                                    [calPolicySelectedEmp]: updatedOffs
                                  }));
                                }}
                              >
                                <Text style={[styles.filterTabText, isChecked && styles.filterTabTextActive]}>
                                  {isChecked ? '✓ ' : ''}{d.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })() : (
                    <Text style={{ color: '#94a3b8', fontSize: 11, textAlign: 'center', marginVertical: 12 }}>
                      Select an employee above to set their personal weekly rest schedule.
                    </Text>
                  )}
                </View>
              )}

              {/* TAB 3: CORPORATE HOLIDAYS */}
              {calPolicyTab === 'holidays' && (
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                      Declared Holidays ({holidays.length})
                    </Text>
                    <TouchableOpacity
                      style={[styles.smallAddBtn, { backgroundColor: '#7c3aed' }]}
                      onPress={() => setIsHolidayModal(true)}
                    >
                      <Text style={styles.smallAddBtnText}>+ Declare Holiday</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ gap: 6, marginTop: 6 }}>
                    {holidays.map((hol) => (
                      <View
                        key={hol.id}
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: 10,
                          backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: isDarkMode ? '#334155' : '#e2e8f0'
                        }}
                      >
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={{ fontSize: 12, fontWeight: 'bold', color: isDarkMode ? '#fff' : '#0f172a' }}>
                            {hol.name}
                          </Text>
                          <Text style={{ fontSize: 10, color: '#38bdf8' }}>
                            {hol.date} &bull; {hol.type?.toUpperCase()}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(239, 68, 68, 0.15)', borderRadius: 6 }}
                          onPress={() => handleDeleteHoliday(hol.id)}
                        >
                          <Text style={{ fontSize: 10, color: '#f87171', fontWeight: 'bold' }}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Pinned Sticky Footer */}
            <View style={{ flexDirection: 'row', gap: 10, width: '100%', paddingTop: 10, borderTopWidth: 1, borderTopColor: isDarkMode ? '#334155' : '#e2e8f0' }}>
              <TouchableOpacity
                style={[styles.modalCloseBtn, { flex: 1, marginTop: 0 }]}
                onPress={() => setIsCalendarPoliciesModal(false)}
              >
                <Text style={styles.modalCloseBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loginBtn, { flex: 2, marginTop: 0, backgroundColor: '#4f46e5' }]}
                disabled={isSavingCalPolicies}
                onPress={async () => {
                  if (!supabaseClient || !currentOrg) return;
                  setIsSavingCalPolicies(true);
                  try {
                    const { data: liveOrg } = await supabaseClient
                      .from('organizations')
                      .select('settings')
                      .eq('id', currentOrg.id)
                      .maybeSingle();

                    const curSettings = liveOrg?.settings || currentOrg.settings || {};
                    const newSettings = {
                      ...curSettings,
                      shiftStart: orgShiftStart.trim() || '09:30',
                      shiftStartTime: orgShiftStart.trim() || '09:30',
                      shiftEnd: orgShiftEnd.trim() || '18:30',
                      shiftEndTime: orgShiftEnd.trim() || '18:30',
                      gracePeriodMins: parseInt(orgGracePeriod) || 15,
                      weekOffDays: calPolicyOrgWeekOffs,
                      employeeWeekOffs: calPolicyEmpWeekOffs
                    };

                    const { data: updatedOrg, error } = await supabaseClient
                      .from('organizations')
                      .update({ settings: newSettings })
                      .eq('id', currentOrg.id)
                      .select()
                      .single();

                    if (!error && updatedOrg) {
                      setCurrentOrg(updatedOrg);
                      Alert.alert('Calendar Policies Saved ✓', 'Shift hours, default week-offs and employee schedules synchronized to cloud.');
                      setIsCalendarPoliciesModal(false);
                      refreshAllData(supabaseClient, currentOrg.id, userProfile?.id);
                    } else {
                      showUserFriendlyError('Policy Update Failed', error, 'Unable to save calendar policies to cloud. Please try again.');
                    }
                  } catch (e: any) {
                    Alert.alert('Error', e?.message);
                  } finally {
                    setIsSavingCalPolicies(false);
                  }
                }}
              >
                <Text style={styles.loginBtnText}>{isSavingCalPolicies ? 'Saving...' : 'Save Policies ✓'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD ORGANIZATION HOLIDAY (HR / SUPERADMIN) */}
      {/* ========================================================================= */}
      <Modal visible={isHolidayModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Organization Holiday</Text>
            <Text style={styles.modalSub}>Declares holiday for all employees in {currentOrg?.name}</Text>

            <Text style={styles.inputLabel}>Holiday Name *</Text>
            <TextInput
              style={styles.textInput}
              value={newHolName}
              onChangeText={setNewHolName}
              placeholder="e.g. Mahashivratri / Foundation Day"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.inputLabel}>Date (YYYY-MM-DD) *</Text>
            <TextInput
              style={styles.textInput}
              value={newHolDate}
              onChangeText={setNewHolDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.inputLabel}>Holiday Type</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginVertical: 4 }}>
              {['national', 'festival', 'gazetted', 'company'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.indPill, newHolType === t && styles.indPillActive]}
                  onPress={() => setNewHolType(t)}
                >
                  <Text style={[styles.indPillText, newHolType === t && styles.indPillTextActive]}>{t.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Description / Notes</Text>
            <TextInput
              style={styles.textInput}
              value={newHolDesc}
              onChangeText={setNewHolDesc}
              placeholder="Optional description..."
              placeholderTextColor="#64748b"
            />

            <TouchableOpacity style={styles.loginBtn} onPress={handleAddHoliday} disabled={isSavingHoliday}>
              <Text style={styles.loginBtnText}>{isSavingHoliday ? 'Saving...' : 'Add to Calendar'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsHolidayModal(false)}>
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT EMPLOYEE JOINING DATE (HR / SUPERADMIN) */}
      {/* ========================================================================= */}
      <Modal visible={isEditJoiningModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set Employee Joining Date</Text>
            <Text style={styles.modalSub}>
              Employee: {targetEmpForJoining?.first_name} {targetEmpForJoining?.last_name} ({targetEmpForJoining?.designation})
            </Text>

            <Text style={styles.inputLabel}>Joining Date (YYYY-MM-DD) *</Text>
            <TextInput
              style={styles.textInput}
              value={updatedJoiningDateVal}
              onChangeText={setUpdatedJoiningDateVal}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#64748b"
            />
            <Text style={{ color: '#64748b', fontSize: 10, marginTop: 4 }}>
              Attendance calculations and absent markings will strictly take effect from this date onwards.
            </Text>

            <TouchableOpacity style={styles.loginBtn} onPress={handleUpdateJoiningDate} disabled={isSavingJoiningDate}>
              <Text style={styles.loginBtnText}>{isSavingJoiningDate ? 'Updating...' : 'Save Joining Date'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsEditJoiningModal(false)}>
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: ADD NEW TEAM MEMBER (HR / SUPERADMIN) */}
      {/* ========================================================================= */}
      <Modal visible={isAddEmpModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Register Team Member</Text>
            <Text style={styles.modalSub}>Assign to {currentOrg?.name}</Text>

            <ScrollView style={{ maxHeight: 380, width: '100%' }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>First Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newEmpFirst}
                    onChangeText={setNewEmpFirst}
                    placeholder="Priya"
                    placeholderTextColor="#64748b"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Last Name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newEmpLast}
                    onChangeText={setNewEmpLast}
                    placeholder="Sharma"
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Work Email *</Text>
              <TextInput
                style={styles.textInput}
                value={newEmpEmail}
                onChangeText={setNewEmpEmail}
                placeholder="priya@company.com"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={styles.inputLabel}>Designation *</Text>
              <TextInput
                style={styles.textInput}
                value={newEmpDesig}
                onChangeText={setNewEmpDesig}
                placeholder="Senior Operations Lead"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>Department</Text>
              <TextInput
                style={styles.textInput}
                value={newEmpDept}
                onChangeText={setNewEmpDept}
                placeholder="Operations / Tech / Marketing"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>Joining Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.textInput}
                value={newEmpJoiningDate}
                onChangeText={setNewEmpJoiningDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>Role</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginVertical: 4 }}>
                {['employee', 'manager', 'hr'].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.indPill, newEmpRole === r && styles.indPillActive]}
                    onPress={() => setNewEmpRole(r)}
                  >
                    <Text style={[styles.indPillText, newEmpRole === r && styles.indPillTextActive]}>{r.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.loginBtn} onPress={handleAddEmployee} disabled={isSavingEmp}>
              <Text style={styles.loginBtnText}>{isSavingEmp ? 'Creating...' : 'Create Employee Profile'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsAddEmpModal(false)}>
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: POST COMPANY NOTICE (HR / SUPERADMIN) */}
      {/* ========================================================================= */}
      <Modal visible={isNoticeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Publish Notice / Announcement</Text>
            <Text style={styles.modalSub}>Broadcasted to all team members</Text>

            <Text style={styles.inputLabel}>Notice Title *</Text>
            <TextInput
              style={styles.textInput}
              value={newNoticeTitle}
              onChangeText={setNewNoticeTitle}
              placeholder="e.g. Diwali Holiday Announcement & Office Closure"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.inputLabel}>Priority</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginVertical: 4 }}>
              {['critical', 'high', 'medium'].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.indPill, newNoticePriority === p && styles.indPillActive]}
                  onPress={() => setNewNoticePriority(p)}
                >
                  <Text style={[styles.indPillText, newNoticePriority === p && styles.indPillTextActive]}>{p.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Message Content *</Text>
            <TextInput
              style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
              value={newNoticeContent}
              onChangeText={setNewNoticeContent}
              placeholder="Announcement text..."
              placeholderTextColor="#64748b"
              multiline
            />

            <TouchableOpacity style={styles.loginBtn} onPress={handlePostNotice} disabled={isSubmittingNotice}>
              <Text style={styles.loginBtnText}>{isSubmittingNotice ? 'Publishing...' : 'Publish Announcement'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsNoticeModal(false)}>
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4B: CREATE NOTIFICATION LETTER (HR / SUPERADMIN / MANAGER) */}
      {/* ========================================================================= */}
      <Modal visible={isCreateLetterModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%', paddingBottom: 14 }]}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Issue Notification Letter</Text>
                <Text style={styles.modalSub}>{currentOrg?.name} &bull; Digital Stamping & PDF</Text>
              </View>
              <TouchableOpacity onPress={() => setIsCreateLetterModal(false)} style={{ padding: 4 }}>
                <Text style={{ fontSize: 18, color: '#94a3b8', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%', marginVertical: 4 }}>
              {/* 1. Letter Type Pills */}
              <Text style={styles.inputLabel}>Letter Category *</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 }}>
                {[
                  { id: 'warning', label: '⚠️ Warning' },
                  { id: 'appreciation', label: '🌟 Appreciation' },
                  { id: 'experience', label: '🎓 Relieving' },
                  { id: 'directive', label: '📑 Directive' },
                  { id: 'notice', label: '📢 Order' }
                ].map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.indPill, letterType === item.id && styles.indPillActive]}
                    onPress={() => {
                      setLetterType(item.id as any);
                      const emp = letterRecipientType === 'individual' ? teamProfiles.find((p) => p.id === letterRecipientId) : undefined;
                      const tpl = getStandardLetterTemplate(item.id, emp);
                      setLetterSubject(tpl.subject);
                      setLetterContent(tpl.body);
                    }}
                  >
                    <Text style={[styles.indPillText, letterType === item.id && styles.indPillTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 2. Official Ref Number */}
              <Text style={[styles.inputLabel, { marginTop: 8 }]}>Official Reference Number *</Text>
              <TextInput
                style={[styles.textInput, { fontFamily: 'monospace', fontWeight: 'bold' }]}
                value={letterRefNumber}
                onChangeText={setLetterRefNumber}
                placeholder="REF: VDX/NL/2026/001"
                placeholderTextColor="#64748b"
              />

              {/* 3. Recipient Scope */}
              <Text style={[styles.inputLabel, { marginTop: 8 }]}>Recipient Scope *</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginVertical: 4 }}>
                <TouchableOpacity
                  style={[styles.indPill, letterRecipientType === 'individual' && styles.indPillActive, { flex: 1 }]}
                  onPress={() => {
                    setLetterRecipientType('individual');
                    const emp = teamProfiles.find((p) => p.id === letterRecipientId) || teamProfiles[0];
                    if (emp) setLetterRecipientId(emp.id);
                    const tpl = getStandardLetterTemplate(letterType, emp);
                    setLetterSubject(tpl.subject);
                    setLetterContent(tpl.body);
                  }}
                >
                  <Text style={[styles.indPillText, letterRecipientType === 'individual' && styles.indPillTextActive, { textAlign: 'center' }]}>
                    👤 Specific Employee
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.indPill, letterRecipientType === 'all' && styles.indPillActive, { flex: 1 }]}
                  onPress={() => {
                    setLetterRecipientType('all');
                    const tpl = getStandardLetterTemplate(letterType, undefined);
                    setLetterSubject(tpl.subject);
                    setLetterContent(tpl.body);
                  }}
                >
                  <Text style={[styles.indPillText, letterRecipientType === 'all' && styles.indPillTextActive, { textAlign: 'center' }]}>
                    👥 All Staff (Broadcast)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* If individual employee */}
              {letterRecipientType === 'individual' && (
                <View style={{ marginVertical: 6 }}>
                  <Text style={styles.inputLabel}>Select Employee Recipient:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {teamProfiles.map((emp) => {
                        const isSelected = letterRecipientId === emp.id;
                        return (
                          <TouchableOpacity
                            key={emp.id}
                            style={[
                              styles.filterTab,
                              isSelected && styles.filterTabActive,
                              { paddingHorizontal: 10, paddingVertical: 5 }
                            ]}
                            onPress={() => {
                              setLetterRecipientId(emp.id);
                              const tpl = getStandardLetterTemplate(letterType, emp);
                              setLetterSubject(tpl.subject);
                              setLetterContent(tpl.body);
                            }}
                          >
                            <Text style={[styles.filterTabText, isSelected && styles.filterTabTextActive, { fontSize: 11 }]}>
                              {emp.first_name} {emp.last_name} ({emp.designation || 'Staff'})
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* 4. Subject */}
              <Text style={[styles.inputLabel, { marginTop: 8 }]}>Letter Subject *</Text>
              <TextInput
                style={styles.textInput}
                value={letterSubject}
                onChangeText={setLetterSubject}
                placeholder="e.g. Formal Notice Regarding Attendance Adherence"
                placeholderTextColor="#64748b"
              />

              {/* 5. Content */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <Text style={styles.inputLabel}>Letter Content *</Text>
                <TouchableOpacity
                  onPress={() => {
                    const emp = letterRecipientType === 'individual' ? teamProfiles.find((p) => p.id === letterRecipientId) : undefined;
                    const tpl = getStandardLetterTemplate(letterType, emp);
                    setLetterSubject(tpl.subject);
                    setLetterContent(tpl.body);
                  }}
                >
                  <Text style={{ color: '#38bdf8', fontSize: 10, fontWeight: 'bold' }}>⚡ Reset to Template</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.textInput, { height: 140, textAlignVertical: 'top', fontSize: 12, lineHeight: 18 }]}
                value={letterContent}
                onChangeText={setLetterContent}
                placeholder="Official letter body..."
                placeholderTextColor="#64748b"
                multiline
              />

              {/* 6. Signatory Details */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Signatory Name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={letterSignatoryName}
                    onChangeText={setLetterSignatoryName}
                    placeholder="Sajal Kumar"
                    placeholderTextColor="#64748b"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Signatory Role</Text>
                  <TextInput
                    style={styles.textInput}
                    value={letterSignatoryRole}
                    onChangeText={setLetterSignatoryRole}
                    placeholder="Director / HR"
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>

              {/* 7. Digital Stamp Toggle */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: letterIsDigitallyStamped ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  borderColor: letterIsDigitallyStamped ? '#10b981' : '#334155',
                  borderWidth: 1,
                  borderRadius: 10,
                  padding: 10,
                  marginTop: 10
                }}
                onPress={() => setLetterIsDigitallyStamped(!letterIsDigitallyStamped)}
              >
                <Text style={{ fontSize: 16 }}>{letterIsDigitallyStamped ? '☑️' : '◻️'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: letterIsDigitallyStamped ? '#10b981' : '#94a3b8' }}>
                    Apply Cryptographic Digital Seal & Stamp
                  </Text>
                  <Text style={{ fontSize: 9.5, color: '#64748b' }}>
                    Embeds official corporate seal verification on PDF exports
                  </Text>
                </View>
              </TouchableOpacity>
            </ScrollView>

            {/* Actions */}
            <TouchableOpacity
              style={[styles.loginBtn, { marginTop: 10, backgroundColor: '#4f46e5' }]}
              onPress={handleCreateLetterMobile}
              disabled={isSubmittingLetter}
            >
              <Text style={styles.loginBtnText}>{isSubmittingLetter ? 'Issuing Letter...' : 'Issue & Publish Letter'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsCreateLetterModal(false)}>
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 5: SUBMIT EOD STANDUP */}
      {/* ========================================================================= */}
      <Modal visible={isStandupModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Submit EOD Standup</Text>
            <Text style={styles.modalSub}>Daily accomplishment log for {currentOrg?.name}</Text>

            <Text style={styles.inputLabel}>1. What did you accomplish today? *</Text>
            <TextInput
              style={[styles.textInput, { height: 50, textAlignVertical: 'top' }]}
              value={standupDone}
              onChangeText={setStandupDone}
              placeholder="e.g. Completed client sprint review & fixed GPS punch"
              placeholderTextColor="#64748b"
              multiline
            />

            <Text style={styles.inputLabel}>2. Key priorities for tomorrow? *</Text>
            <TextInput
              style={[styles.textInput, { height: 50, textAlignVertical: 'top' }]}
              value={standupNext}
              onChangeText={setStandupNext}
              placeholder="e.g. Deploy attendance regularization queue tests"
              placeholderTextColor="#64748b"
              multiline
            />

            <Text style={styles.inputLabel}>3. Blockers / Roadblocks</Text>
            <TextInput
              style={styles.textInput}
              value={standupBlockers}
              onChangeText={setStandupBlockers}
              placeholder="Optional: Any blockers..."
              placeholderTextColor="#64748b"
            />

            <Text style={styles.inputLabel}>4. PR / Deliverable Link (GitHub, Figma, Docs)</Text>
            <TextInput
              style={styles.textInput}
              value={standupPrLink}
              onChangeText={setStandupPrLink}
              placeholder="Optional: https://github.com/.../pull/12"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>5. Hours Logged</Text>
            <TextInput
              style={[styles.textInput, { width: 80 }]}
              value={standupHours}
              onChangeText={setStandupHours}
              keyboardType="numeric"
              placeholder="8"
              placeholderTextColor="#64748b"
            />

            <TouchableOpacity style={styles.loginBtn} onPress={handleSubmitStandup} disabled={isSavingStandup}>
              <Text style={styles.loginBtnText}>{isSavingStandup ? 'Saving...' : 'Submit Standup'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsStandupModal(false)}>
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 6: ISSUE OFFER LETTER (HR / SUPERADMIN) */}
      {/* ========================================================================= */}
      <Modal visible={isNewOfferModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Issue Official Offer Letter</Text>
            <Text style={styles.modalSub}>Auto-generates cryptographic serial</Text>

            <Text style={styles.inputLabel}>Candidate Full Name *</Text>
            <TextInput
              style={styles.textInput}
              value={candName}
              onChangeText={setCandName}
              placeholder="e.g. Rahul Verma"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.inputLabel}>Candidate Email *</Text>
            <TextInput
              style={styles.textInput}
              value={candEmail}
              onChangeText={setCandEmail}
              placeholder="rahul@example.com"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.inputLabel}>Designation *</Text>
            <TextInput
              style={styles.textInput}
              value={candDesig}
              onChangeText={setCandDesig}
              placeholder="e.g. Growth Specialist"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.inputLabel}>Annual Fixed CTC (₹ INR)</Text>
            <TextInput
              style={styles.textInput}
              value={candCtc}
              onChangeText={setCandCtc}
              placeholder="1200000"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
            />

            <TouchableOpacity style={styles.loginBtn} onPress={handleCreateOffer} disabled={isSavingOffer}>
              <Text style={styles.loginBtnText}>{isSavingOffer ? 'Issuing...' : 'Issue Offer Letter'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsNewOfferModal(false)}>
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 7: EDIT USER PROFILE */}
      {/* ========================================================================= */}
      <Modal visible={isEditProfileModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>Edit Profile & Photo</Text>
            <Text style={styles.modalSub}>Update your picture, contact & corporate avatar</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%', marginTop: 8 }}>
              {/* Avatar Preview */}
              <View style={{ alignItems: 'center', marginVertical: 8 }}>
                <View style={{ width: 84, height: 84, borderRadius: 42, overflow: 'hidden', borderWidth: 3, borderColor: '#3b82f6', backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' }}>
                  {editAvatarUrl || userProfile?.avatar_url ? (
                    <Image source={{ uri: editAvatarUrl || userProfile?.avatar_url }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold' }}>
                      {((userProfile?.first_name?.[0] || 'U') + (userProfile?.last_name?.[0] || '')).toUpperCase()}
                    </Text>
                  )}
                </View>

                {/* Camera / Gallery Upload Buttons */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <TouchableOpacity
                    style={[styles.smallAddBtn, { backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 8 }]}
                    onPress={takePhotoWithCamera}
                    disabled={isUploadingPhoto}
                  >
                    <Text style={[styles.smallAddBtnText, { fontSize: 12 }]}>
                      {isUploadingPhoto ? 'Uploading...' : '📸 Take Photo'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.smallAddBtn, { backgroundColor: '#4f46e5', paddingHorizontal: 12, paddingVertical: 8 }]}
                    onPress={pickImageFromGallery}
                    disabled={isUploadingPhoto}
                  >
                    <Text style={[styles.smallAddBtnText, { fontSize: 12 }]}>
                      {isUploadingPhoto ? 'Uploading...' : '🖼️ Gallery'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Preset 3D Corporate Avatars */}
              <View style={{ marginVertical: 10 }}>
                <Text style={[styles.inputLabel, { marginBottom: 6 }]}>Or Choose Corporate Avatar:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                    {PRESET_AVATARS.map((url, idx) => (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => setEditAvatarUrl(url)}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          overflow: 'hidden',
                          borderWidth: editAvatarUrl === url ? 3 : 1,
                          borderColor: editAvatarUrl === url ? '#38bdf8' : '#475569'
                        }}
                      >
                        <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <Text style={styles.inputLabel}>Mobile Phone Number</Text>
              <TextInput
                style={styles.textInput}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="+91 9876543210"
                placeholderTextColor="#64748b"
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Custom Avatar Image URL (Optional)</Text>
              <TextInput
                style={styles.textInput}
                value={editAvatarUrl}
                onChangeText={setEditAvatarUrl}
                placeholder="https://example.com/avatar.jpg"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={[styles.loginBtn, { marginTop: 14 }]}
                onPress={handleSaveProfile}
                disabled={isSavingProfile || isUploadingPhoto}
              >
                <Text style={styles.loginBtnText}>
                  {isSavingProfile ? 'Saving...' : 'Save Profile Changes'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsEditProfileModal(false)}>
                <Text style={styles.modalCloseBtnText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 8: REGULARIZATION REQUEST */}
      {/* ========================================================================= */}
      <Modal visible={isRegModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Attendance Regularization</Text>
            <Text style={styles.modalSub}>Request approval from your reporting manager</Text>

            <ScrollView style={{ maxHeight: 380, width: '100%' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.inputLabel}>Target Date (YYYY-MM-DD) *</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    style={[styles.smallAddBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}
                    onPress={() => setRegTargetDate(getTodayISTDate())}
                  >
                    <Text style={[styles.smallAddBtnText, { color: '#38bdf8' }]}>Today</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.smallAddBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}
                    onPress={() => setRegTargetDate(getYesterdayISTDate())}
                  >
                    <Text style={[styles.smallAddBtnText, { color: '#38bdf8' }]}>Yesterday</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TextInput
                style={styles.textInput}
                value={regTargetDate}
                onChangeText={setRegTargetDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#64748b"
              />

              {/* Shift Presets */}
              <Text style={[styles.inputLabel, { marginTop: 8 }]}>Shift Preset Timing</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 }}>
                {[
                  { label: 'Standard (09:30 - 18:30)', in: '09:30', out: '18:30' },
                  { label: 'Extended (09:30 - 19:00)', in: '09:30', out: '19:00' },
                  { label: 'Morning Half (09:30 - 14:00)', in: '09:30', out: '14:00' },
                  { label: 'Evening Half (14:00 - 18:30)', in: '14:00', out: '18:30' }
                ].map((preset) => {
                  const isActive = regInTime === preset.in && regOutTime === preset.out;
                  return (
                    <TouchableOpacity
                      key={preset.label}
                      style={[styles.indPill, isActive && styles.indPillActive]}
                      onPress={() => {
                        setRegInTime(preset.in);
                        setRegOutTime(preset.out);
                      }}
                    >
                      <Text style={[styles.indPillText, isActive && styles.indPillTextActive]}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Shift In (IST)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={regInTime}
                    onChangeText={setRegInTime}
                    placeholder="09:30"
                    placeholderTextColor="#64748b"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Shift Out (IST)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={regOutTime}
                    onChangeText={setRegOutTime}
                    placeholder="18:30"
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Category</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 }}>
                {[
                  'Missed Punch-In / Punch-Out',
                  'Client On-Site Visit',
                  'Approved WFH',
                  'Official Travel',
                  'Network / System Glitch',
                  'Medical / Emergency'
                ].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.indPill, regCategory === c && styles.indPillActive]}
                    onPress={() => setRegCategory(c)}
                  >
                    <Text style={[styles.indPillText, regCategory === c && styles.indPillTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Detailed Justification *</Text>
              <TextInput
                style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                value={regJustification}
                onChangeText={setRegJustification}
                placeholder="Explain why punch was missed or field visit details..."
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.loginBtn, { marginTop: 10 }]}
              onPress={handleSubmitRegularization}
              disabled={isSubmittingReg}
            >
              <Text style={styles.loginBtnText}>
                {isSubmittingReg ? 'Submitting...' : 'Submit Regularization'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsRegModal(false)}>
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 9: APPLY FOR LEAVE */}
      {/* ========================================================================= */}
      <Modal visible={isLeaveModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Apply for Leave</Text>
            <Text style={styles.modalSub}>Time-off request routed to your manager</Text>

            <ScrollView style={{ maxHeight: 380, width: '100%' }}>
              {/* Balances Strip */}
              <View style={{ flexDirection: 'row', gap: 6, marginVertical: 6 }}>
                <View style={[styles.indPill, { flex: 1, alignItems: 'center' }]}>
                  <Text style={{ fontSize: 9, color: '#64748b' }}>Casual (CL)</Text>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#38bdf8' }}>12 Left</Text>
                </View>
                <View style={[styles.indPill, { flex: 1, alignItems: 'center' }]}>
                  <Text style={{ fontSize: 9, color: '#64748b' }}>Sick (SL)</Text>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#10b981' }}>10 Left</Text>
                </View>
                <View style={[styles.indPill, { flex: 1, alignItems: 'center' }]}>
                  <Text style={{ fontSize: 9, color: '#64748b' }}>Earned (EL)</Text>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#fbbf24' }}>15 Left</Text>
                </View>
              </View>

              <Text style={styles.inputLabel}>Leave Type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 }}>
                {['casual', 'sick', 'privilege', 'unpaid', 'emergency'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.indPill, leaveType === type && styles.indPillActive]}
                    onPress={() => setLeaveType(type)}
                  >
                    <Text style={[styles.indPillText, leaveType === type && styles.indPillTextActive]}>
                      {type.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Start Date *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={leaveStartDate}
                    onChangeText={setLeaveStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#64748b"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>End Date *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={leaveEndDate}
                    onChangeText={setLeaveEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.checkboxRow, { marginVertical: 8 }]}
                onPress={() => setIsHalfDay(!isHalfDay)}
              >
                <Text style={{ fontSize: 14 }}>{isHalfDay ? '☑️' : '⬜'}</Text>
                <Text style={{ color: isDarkMode ? '#cbd5e1' : '#475569', fontSize: 11, marginLeft: 6 }}>This is a half-day leave</Text>
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Reason / Explanation *</Text>
              <TextInput
                style={[styles.textInput, { height: 70, textAlignVertical: 'top' }]}
                value={leaveReason}
                onChangeText={setLeaveReason}
                placeholder="Reason for taking leave..."
                placeholderTextColor="#64748b"
                multiline
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.loginBtn, { marginTop: 10 }]}
              onPress={handleSubmitLeave}
              disabled={isSubmittingLeave}
            >
              <Text style={styles.loginBtnText}>
                {isSubmittingLeave ? 'Submitting...' : 'Submit Leave Application'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsLeaveModal(false)}>
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 10: SCHEDULE MEETING */}
      {/* ========================================================================= */}
      <Modal visible={isMeetingModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Schedule Meeting / Sync</Text>
            <Text style={styles.modalSub}>Video call, 1:1 or team sprint review</Text>

            <ScrollView style={{ maxHeight: 380, width: '100%' }}>
              <Text style={styles.inputLabel}>Meeting Title *</Text>
              <TextInput
                style={styles.textInput}
                value={newMeetingTitle}
                onChangeText={setNewMeetingTitle}
                placeholder="e.g. Weekly Tech Sprint & PR Review"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.textInput}
                value={newMeetingDate}
                onChangeText={setNewMeetingDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#64748b"
              />

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Start Time (IST) *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newMeetingStartTime}
                    onChangeText={setNewMeetingStartTime}
                    placeholder="11:00"
                    placeholderTextColor="#64748b"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>End Time (IST) *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newMeetingEndTime}
                    onChangeText={setNewMeetingEndTime}
                    placeholder="11:45"
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Google Meet / Zoom URL *</Text>
              <TextInput
                style={styles.textInput}
                value={newMeetingUrl}
                onChangeText={setNewMeetingUrl}
                placeholder="https://meet.google.com/xyz-abc"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Department / Audience</Text>
              <TextInput
                style={styles.textInput}
                value={newMeetingDept}
                onChangeText={setNewMeetingDept}
                placeholder="Engineering / Sales / All"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>Agenda / Description</Text>
              <TextInput
                style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                value={newMeetingDesc}
                onChangeText={setNewMeetingDesc}
                placeholder="Key discussion points, sprint targets..."
                placeholderTextColor="#64748b"
                multiline
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.loginBtn, { marginTop: 10 }]}
              onPress={handleCreateMeeting}
              disabled={isSubmittingMeeting}
            >
              <Text style={styles.loginBtnText}>
                {isSubmittingMeeting ? 'Scheduling...' : 'Save & Publish Meeting'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsMeetingModal(false)}>
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 11: SWITCH ORGANIZATION (VEDOTRIX ROOT SUPERADMIN ONLY) */}
      {/* ========================================================================= */}
      <Modal visible={isOrgModalVisible && isVedotrixSuperadmin} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Switch Organization Tenant</Text>
            <Text style={styles.modalSub}>Master root organization controller</Text>

            <ScrollView style={{ maxHeight: 280, width: '100%', marginVertical: 10 }}>
              {organizations.map((org) => (
                <TouchableOpacity
                  key={org.id}
                  style={[
                    styles.orgSelectItem,
                    currentOrg?.id === org.id && styles.orgSelectItemActive
                  ]}
                  onPress={() => {
                    setCurrentOrg(org);
                    setIsOrgModalVisible(false);
                    if (supabaseClient) refreshAllData(supabaseClient, org.id, userProfile?.id);
                  }}
                >
                  <Text style={styles.orgSelectName}>{org.name}</Text>
                  <Text style={styles.orgSelectCode}>{org.org_code} • {org.industry} • {org.subscription_plan || 'Pro'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsOrgModalVisible(false)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 12: DAY ATTENDANCE DETAIL & QUICK REGULARIZE MODAL */}
      {/* ========================================================================= */}
      <Modal visible={selectedCalendarDayData !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selectedCalendarDayData && (() => {
              const d = selectedCalendarDayData;
              const isSelf = !d.inspectedCalendarEmp || d.inspectedCalendarEmp.id === userProfile?.id;
              const empName = d.inspectedCalendarEmp ? `${d.inspectedCalendarEmp.first_name} ${d.inspectedCalendarEmp.last_name}` : 'Self';
              const p = d.punch;
              const checkInStr = p?.check_in_time ? formatISTTimeOnly(p.check_in_time) : '--';
              const checkOutStr = p?.check_out_time ? formatISTTimeOnly(p.check_out_time) : (p?.check_in_time ? 'Shift In Progress' : '--');
              const totalHrs = p?.total_hours || (p?.check_in_time ? 'Active' : 0);
              const isRejected = p?.regularization_status === 'rejected' || p?.approval_status === 'rejected';
              const isPending = !isRejected && (p?.regularization_status === 'pending' || p?.approval_status === 'pending_manager_approval');
              const isApproved = !isRejected && !isPending && (p?.regularization_status === 'approved' || p?.approval_status === 'approved');
              const isAbsent = d.status === 'absent';

              return (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalTitle}>{d.dStr}</Text>
                      <Text style={styles.modalSub}>{d.dayName} • {empName}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: d.statusColor + '20', borderColor: d.statusColor, paddingVertical: 4, paddingHorizontal: 8 }]}>
                      <Text style={{ color: d.statusColor, fontSize: 11, fontWeight: 'bold' }}>{d.statusLabel}</Text>
                    </View>
                  </View>

                  <ScrollView style={{ width: '100%', marginVertical: 8, maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Shift Window:</Text>
                      <Text style={styles.detailVal}>
                        {currentOrg?.settings?.shiftStart || currentOrg?.settings?.shiftStartTime || '09:30'} - {currentOrg?.settings?.shiftEnd || currentOrg?.settings?.shiftEndTime || '18:30'} IST
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Check-In Time:</Text>
                      <Text style={styles.detailVal}>{checkInStr}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Check-Out Time:</Text>
                      <Text style={styles.detailVal}>{checkOutStr}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Logged Hours:</Text>
                      <Text style={[styles.detailVal, { color: '#38bdf8', fontWeight: 'bold' }]}>{totalHrs} hrs</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Location Verification:</Text>
                      <Text style={styles.detailVal}>
                        {p?.is_remote ? 'Remote / Field' : p?.check_in_time ? 'Office HQ' : '--'}
                        {p?.distance_meters ? ` (${p.distance_meters}m)` : ''}
                      </Text>
                    </View>
                    {(() => {
                      const approverUuid = p?.approved_by || p?.regularized_by;
                      const approverProfile = approverUuid ? teamProfiles.find((x) => x.id === approverUuid) : null;
                      if (!approverProfile) return null;

                      if (isRejected) {
                        return (
                          <View style={{ marginTop: 6, padding: 8, backgroundColor: isDarkMode ? '#1e293b' : '#fff1f2', borderRadius: 6, borderWidth: 1, borderColor: '#f43f5e30' }}>
                            <Text style={{ fontSize: 10, color: '#e11d48', fontWeight: 'bold' }}>❌ REGULARIZATION REJECTED BY:</Text>
                            <Text style={{ fontSize: 12, color: isDarkMode ? '#f8fafc' : '#9f1239', fontWeight: '700', marginTop: 1 }}>
                              {approverProfile.first_name} {approverProfile.last_name} ({approverProfile.role?.toUpperCase()})
                            </Text>
                          </View>
                        );
                      }

                      if (isApproved) {
                        return (
                          <View style={{ marginTop: 6, padding: 8, backgroundColor: isDarkMode ? '#1e293b' : '#ecfdf5', borderRadius: 6, borderWidth: 1, borderColor: '#10b98130' }}>
                            <Text style={{ fontSize: 10, color: '#059669', fontWeight: 'bold' }}>✓ ATTENDANCE APPROVED BY:</Text>
                            <Text style={{ fontSize: 12, color: isDarkMode ? '#f8fafc' : '#065f46', fontWeight: '700', marginTop: 1 }}>
                              {approverProfile.first_name} {approverProfile.last_name} ({approverProfile.role?.toUpperCase()})
                            </Text>
                          </View>
                        );
                      }

                      return null;
                    })()}
                    {(p?.regularization_notes || p?.approval_notes || p?.regularization_reason || isRejected || isApproved || isPending) && (
                      <View style={{ marginTop: 8, padding: 10, backgroundColor: isDarkMode ? '#1e293b' : isRejected ? '#fff1f2' : isApproved ? '#f0fdf4' : '#fffbeb', borderRadius: 8, borderWidth: 1, borderColor: isRejected ? '#f43f5e40' : isApproved ? '#10b98140' : '#f59e0b40' }}>
                        <Text style={{ fontSize: 10, color: isRejected ? '#f43f5e' : isApproved ? '#10b981' : '#f59e0b', fontWeight: 'bold' }}>
                          {isRejected ? '❌ REGULARIZATION REJECTED' : isApproved ? '✅ REGULARIZED & APPROVED' : '⏳ REGULARIZATION PENDING'}
                        </Text>
                        {(p?.regularization_notes || p?.approval_notes) && (
                          <View style={{ marginTop: 4 }}>
                            <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: 'bold' }}>{isRejected ? 'REJECTION NOTE:' : 'APPROVAL NOTE:'}</Text>
                            <Text style={{ fontSize: 12, color: isDarkMode ? '#fff' : '#0f172a', marginTop: 1, fontWeight: '600' }}>
                              {p.regularization_notes || p.approval_notes}
                            </Text>
                          </View>
                        )}
                        {p?.regularization_reason && p.regularization_reason !== (p.regularization_notes || p.approval_notes) && (
                          <View style={{ marginTop: 4 }}>
                            <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: 'bold' }}>REQUEST REASON:</Text>
                            <Text style={{ fontSize: 11, color: isDarkMode ? '#cbd5e1' : '#475569', marginTop: 1 }}>
                              {p.regularization_reason}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                    {isPrivileged && (
                      <View style={{ marginTop: 8, padding: 10, backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0' }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#0284c7', textTransform: 'uppercase', marginBottom: 6 }}>
                          ⚙️ Calendar Controls ({d.dStr})
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity
                            style={[styles.smallAddBtn, { flex: 1, backgroundColor: '#0284c7' }]}
                            onPress={() => handleToggleCustomDayWeekOff(d.dStr, d.inspectedCalendarEmp?.id)}
                          >
                            <Text style={[styles.smallAddBtnText, { textAlign: 'center' }]}>
                              {(() => {
                                const targetEmp = d.inspectedCalendarEmp?.id;
                                const cur = currentOrg?.settings?.customDayOverrides?.[d.dStr]
                                  || (targetEmp ? currentOrg?.settings?.customDayOverrides?.[`${d.dStr}_${targetEmp}`] : null)
                                  || (targetEmp ? currentOrg?.settings?.customDayOverrides?.[`${targetEmp}_${d.dStr}`] : null);
                                return cur?.type === 'week_off' ? 'Mark Working Day' : 'Mark Week-Off';
                              })()}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.smallAddBtn, { flex: 1, backgroundColor: '#7c3aed' }]}
                            onPress={() => {
                              setSelectedCalendarDayData(null);
                              setNewHolDate(d.dStr);
                              setIsHolidayModal(true);
                            }}
                          >
                            <Text style={[styles.smallAddBtnText, { textAlign: 'center' }]}>Declare Holiday</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </ScrollView>

                  <View style={{ gap: 8, marginTop: 8, width: '100%' }}>
                    {/* Action 1: Pending Approvals for Manager/HR */}
                    {isPending && canApprove && p && (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          style={[styles.loginBtn, { flex: 1, backgroundColor: '#10b981' }]}
                          onPress={() => {
                            handleResolveRegularization(p.id, 'approved');
                            setSelectedCalendarDayData(null);
                          }}
                        >
                          <Text style={styles.loginBtnText}>✅ Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.loginBtn, { flex: 1, backgroundColor: '#ef4444' }]}
                          onPress={() => {
                            handleResolveRegularization(p.id, 'rejected');
                            setSelectedCalendarDayData(null);
                          }}
                        >
                          <Text style={styles.loginBtnText}>❌ Reject</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Action 2: If Absent and viewing Self */}
                    {isAbsent && isSelf && !d.isBeforeJoining && (
                      <TouchableOpacity
                        style={[styles.loginBtn, { backgroundColor: '#f59e0b' }]}
                        onPress={() => {
                          const date = d.dStr;
                          setSelectedCalendarDayData(null);
                          setRegTargetDate(date);
                          setIsRegModal(true);
                        }}
                      >
                        <Text style={[styles.loginBtnText, { color: '#090d16' }]}>✍️ Request Regularization</Text>
                      </TouchableOpacity>
                    )}

                    {/* Action 3: If Absent and viewing Employee as HR/Superadmin */}
                    {isAbsent && !isSelf && canApprove && !d.isBeforeJoining && (
                      <TouchableOpacity
                        style={[styles.loginBtn, { backgroundColor: '#0284c7' }]}
                        onPress={() => handleDirectRegularize(d.inspectedCalendarEmp.id, d.dStr)}
                      >
                        <Text style={styles.loginBtnText}>⚡ Mark Present (Direct Regularize)</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedCalendarDayData(null)}>
                      <Text style={styles.modalCloseBtnText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: OFFICIAL ATTENDANCE REPORT PDF (DAILY / WEEKLY / MONTHLY) */}
      {/* ========================================================================= */}
      <Modal visible={isAttReportModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 440, padding: 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                  📄 Export Attendance Report PDF
                </Text>
                <Text style={{ fontSize: 11, color: '#0284c7', marginTop: 2, fontWeight: '700' }}>
                  {isPrivileged ? 'Organization Directory Scope' : 'Direct Managed Team Scope'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsAttReportModal(false)} style={{ padding: 4 }}>
                <Text style={{ fontSize: 18, color: '#94a3b8', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Scope badge banner */}
            <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#3b82f630', marginBottom: 14 }}>
              <Text style={{ fontSize: 11, color: isDarkMode ? '#93c5fd' : '#1e40af', fontWeight: '600' }}>
                {isPrivileged
                  ? `🏢 HR/Admin Scope: Generating for all ${teamProfiles.filter((p) => p.is_active !== false).length} active employees.`
                  : `👥 Manager Scope: Strictly generating for your ${teamProfiles.filter((p) => p.is_active !== false && p.manager_id === userProfile?.id).length} direct reportees.`}
              </Text>
            </View>

            {/* Cadence Selection Tabs */}
            <Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? '#cbd5e1' : '#475569', marginBottom: 6, textTransform: 'uppercase' }}>
              Select Report Format
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
              {(['daily', 'weekly', 'monthly'] as const).map((type) => {
                const isActive = attReportType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setAttReportType(type)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 8,
                      backgroundColor: isActive ? '#0284c7' : isDarkMode ? '#1e293b' : '#f1f5f9',
                      borderWidth: 1,
                      borderColor: isActive ? '#0284c7' : isDarkMode ? '#334155' : '#cbd5e1',
                      alignItems: 'center'
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: isActive ? '#ffffff' : isDarkMode ? '#e2e8f0' : '#334155', textTransform: 'capitalize' }}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Date / Month Picker */}
            <Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? '#cbd5e1' : '#475569', marginBottom: 6, textTransform: 'uppercase' }}>
              {attReportType === 'daily' ? 'Target Shift Date (YYYY-MM-DD)' : attReportType === 'weekly' ? 'Week Ending Date (YYYY-MM-DD)' : 'Target Month (YYYY-MM)'}
            </Text>
            <TextInput
              style={[styles.textInput, { marginBottom: 14 }]}
              value={attReportDate}
              onChangeText={setAttReportDate}
              placeholder={attReportType === 'monthly' ? 'YYYY-MM (e.g. 2026-10)' : 'YYYY-MM-DD'}
              placeholderTextColor="#64748b"
            />

            <View style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0', marginBottom: 16 }}>
              <Text style={{ fontSize: 10.5, color: '#64748b', lineHeight: 16 }}>
                {attReportType === 'daily' && '• Includes check-in/out stamps, duration, office/remote location, status, and dynamic manager/HR approval remarks.'}
                {attReportType === 'weekly' && '• Includes 7-day attendance register matrix, daily work hours, presence %, total shifts and grand hours.'}
                {attReportType === 'monthly' && '• Includes full monthly statutory audit register, working days, punch vs regularized days, leaves, LOP, and compliance grade.'}
              </Text>
            </View>

            {/* Buttons */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setIsAttReportModal(false)}
                style={[styles.modalCloseBtn, { flex: 1, marginTop: 0 }]}
              >
                <Text style={styles.modalCloseBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleExportAttendanceReportPDF}
                disabled={isExportingAttReport}
                style={[styles.loginBtn, { flex: 2, marginTop: 0, backgroundColor: '#0284c7', opacity: isExportingAttReport ? 0.6 : 1 }]}
              >
                <Text style={styles.loginBtnText}>
                  {isExportingAttReport ? 'Generating Official PDF...' : 'Download Official PDF'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 13: USER PROFILE DETAILS MODAL */}
      {/* ========================================================================= */}
      <Modal visible={inspectedUserProfile !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {inspectedUserProfile && (() => {
              const mgr = teamProfiles.find((p) => p.id === inspectedUserProfile.manager_id);
              const isSelf = inspectedUserProfile.id === userProfile?.id;
              return (
                <>
                  <View style={styles.userProfileHeader}>
                    <View style={styles.userProfileAvatarLg}>
                      {inspectedUserProfile.avatar_url ? (
                        <Image source={{ uri: inspectedUserProfile.avatar_url }} style={{ width: '100%', height: '100%', borderRadius: 34 }} />
                      ) : (
                        <Text style={{ fontSize: 24, color: '#ffffff', fontWeight: 'bold' }}>
                          {(inspectedUserProfile.first_name?.[0] || 'U') + (inspectedUserProfile.last_name?.[0] || '')}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.userProfileName}>
                      {inspectedUserProfile.first_name} {inspectedUserProfile.last_name}
                    </Text>
                    <Text style={styles.userProfileDesig}>
                      {inspectedUserProfile.designation || 'Staff'} • {inspectedUserProfile.department || 'Operations'}
                    </Text>
                    <View style={styles.userProfileRoleBadge}>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#38bdf8' }}>
                        {inspectedUserProfile.role?.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <ScrollView style={{ maxHeight: 260, width: '100%', marginVertical: 8 }} showsVerticalScrollIndicator={false}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Work Email:</Text>
                      <Text style={styles.detailVal}>{inspectedUserProfile.email}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Contact Phone:</Text>
                      <Text style={styles.detailVal}>{inspectedUserProfile.phone || 'Not Provided'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Date of Joining:</Text>
                      <Text style={[styles.detailVal, { color: '#38bdf8', fontWeight: 'bold' }]}>
                        {formatDisplayDate(inspectedUserProfile.joining_date)}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Reporting Manager:</Text>
                      <Text style={styles.detailVal}>
                        {mgr ? `${mgr.first_name} ${mgr.last_name} (${mgr.designation || 'Lead'})` : 'Executive Leadership'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Active Tenant:</Text>
                      <Text style={styles.detailVal}>{currentOrg?.name}</Text>
                    </View>
                  </ScrollView>

                  <View style={{ gap: 8, marginTop: 10, width: '100%' }}>
                    {!isSelf && (
                      <TouchableOpacity
                        style={[styles.loginBtn, { backgroundColor: '#0284c7' }]}
                        onPress={() => {
                          const target = inspectedUserProfile;
                          setInspectedUserProfile(null);
                          setChatRecipient(target);
                          setActiveTab('chat');
                        }}
                      >
                        <Text style={styles.loginBtnText}>💬 Send Direct Message</Text>
                      </TouchableOpacity>
                    )}

                    {isPrivileged && !isSelf && (
                      <TouchableOpacity
                        style={[styles.loginBtn, { backgroundColor: '#4f46e5' }]}
                        onPress={() => handleOpenEditEmployee(inspectedUserProfile)}
                      >
                        <Text style={styles.loginBtnText}>✏️ Manage Employee Record (HR/Admin)</Text>
                      </TouchableOpacity>
                    )}

                    {isSelf && (
                      <TouchableOpacity
                        style={[styles.loginBtn, { backgroundColor: '#0284c7' }]}
                        onPress={() => {
                          setInspectedUserProfile(null);
                          setEditPhone(userProfile?.phone || '');
                          setEditAvatarUrl(userProfile?.avatar_url || '');
                          setIsEditProfileModal(true);
                        }}
                      >
                        <Text style={styles.loginBtnText}>✏️ Edit Profile</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setInspectedUserProfile(null)}>
                      <Text style={styles.modalCloseBtnText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 14: IN-APP NOTIFICATION CENTER */}
      {/* ========================================================================= */}
      <Modal visible={isNotifModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 18 }}>🔔</Text>
                <Text style={styles.modalTitle}>Notifications</Text>
              </View>
              {unreadNotifCount > 0 && (
                <TouchableOpacity onPress={handleMarkAllNotifsRead}>
                  <Text style={{ color: '#38bdf8', fontSize: 12, fontWeight: 'bold' }}>Mark all read</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
              {inAppNotifications.length === 0 ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>✨</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
                    All caught up! No active notifications or alerts.
                  </Text>
                </View>
              ) : (
                inAppNotifications.map((n) => {
                  const isRead = readNotifIds.includes(n.id);
                  return (
                    <TouchableOpacity
                      key={n.id}
                      style={[
                        styles.notifItem,
                        !isRead && { borderColor: '#38bdf8', backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.08)' : 'rgba(2, 132, 199, 0.05)' }
                      ]}
                      onPress={() => {
                        if (!isRead) {
                          setReadNotifIds((prev) => [...prev, n.id]);
                        }
                        n.action();
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                        <Text style={{ fontSize: 20 }}>{n.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={[styles.notifItemTitle, !isRead && { color: '#38bdf8' }]} numberOfLines={1}>
                              {n.title}
                            </Text>
                            {!isRead && <View style={styles.notifUnreadDot} />}
                          </View>
                          <Text style={styles.notifItemMsg} numberOfLines={2}>{n.message}</Text>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                            <Text style={styles.notifCategory}>{n.category}</Text>
                            <Text style={styles.notifTimestamp}>{n.timestamp}</Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity style={[styles.modalCloseBtn, { marginTop: 10 }]} onPress={() => setIsNotifModal(false)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 15: CREATE CHAT CHANNEL */}
      {/* ========================================================================= */}
      <Modal visible={isNewChannelModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create New Channel</Text>
            <Text style={styles.modalSub}>Add a workspace discussion channel for {currentOrg?.name}</Text>

            <Text style={styles.inputLabel}>Channel Name * (e.g. engineering)</Text>
            <TextInput
              style={styles.textInput}
              value={newChanName}
              onChangeText={(t) => setNewChanName(t.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
              placeholder="e.g. general-talk"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Channel Description</Text>
            <TextInput
              style={styles.textInput}
              value={newChanDesc}
              onChangeText={setNewChanDesc}
              placeholder="What is this channel about?"
              placeholderTextColor="#64748b"
            />

            {/* Private Group Toggle */}
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: isDarkMode ? '#141b2d' : '#f1f5f9',
                marginVertical: 10,
                borderWidth: 1,
                borderColor: newChanIsPrivate ? '#f59e0b' : (isDarkMode ? '#1e293b' : '#cbd5e1')
              }}
              onPress={() => setNewChanIsPrivate(!newChanIsPrivate)}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: newChanIsPrivate ? '#fbbf24' : (isDarkMode ? '#ffffff' : '#0f172a') }}>
                  {newChanIsPrivate ? '🔒 Private Group' : '📢 Public Channel'}
                </Text>
                <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  {newChanIsPrivate
                    ? 'Only selected members can see and send messages in this group'
                    : 'Anyone in the organization can view and join'}
                </Text>
              </View>
              <View style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: newChanIsPrivate ? '#f59e0b' : '#475569',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{newChanIsPrivate ? '✓' : ''}</Text>
              </View>
            </TouchableOpacity>

            {/* If Private Group, show Member Multi-Select List */}
            {newChanIsPrivate && (
              <View style={{ marginVertical: 6 }}>
                <Text style={[styles.inputLabel, { marginBottom: 6 }]}>Select Group Members ({newChanMembers.length} selected):</Text>
                <ScrollView style={{ maxHeight: 150, borderWidth: 1, borderColor: isDarkMode ? '#1e293b' : '#e2e8f0', borderRadius: 8, padding: 6 }}>
                  {teamProfiles.filter((p) => p.id !== userProfile?.id).map((member) => {
                    const isMemberSelected = newChanMembers.includes(member.id);
                    return (
                      <TouchableOpacity
                        key={member.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 6,
                          paddingHorizontal: 8,
                          borderRadius: 6,
                          backgroundColor: isMemberSelected ? (isDarkMode ? '#1e293b' : '#e0f2fe') : 'transparent'
                        }}
                        onPress={() => {
                          setNewChanMembers((prev) =>
                            isMemberSelected ? prev.filter((id) => id !== member.id) : [...prev, member.id]
                          );
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
                              {(member.first_name?.[0] || 'U').toUpperCase()}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 12, color: isDarkMode ? '#fff' : '#0f172a', fontWeight: isMemberSelected ? 'bold' : 'normal' }}>
                            {member.first_name} {member.last_name} ({member.designation || 'Staff'})
                          </Text>
                        </View>
                        <Text style={{ color: isMemberSelected ? '#38bdf8' : '#64748b', fontSize: 13, fontWeight: 'bold' }}>
                          {isMemberSelected ? '✓' : '+'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <TouchableOpacity
              style={[styles.loginBtn, (!newChanName.trim() || isSavingChan) && { opacity: 0.5 }]}
              disabled={!newChanName.trim() || isSavingChan}
              onPress={async () => {
                if (!supabaseClient || !currentOrg || !userProfile || !newChanName.trim()) return;
                setIsSavingChan(true);
                try {
                  const cleanName = newChanName.trim().toLowerCase();
                  const newChanId = generateUUID();
                  const memberIds = newChanIsPrivate
                    ? Array.from(new Set([userProfile.id, ...newChanMembers]))
                    : [];
                  const { error } = await supabaseClient.from('chat_channels').insert({
                    id: newChanId,
                    org_id: currentOrg.id,
                    name: cleanName,
                    description: newChanDesc.trim() || (newChanIsPrivate ? 'Private discussion group' : 'Custom discussion channel'),
                    is_private: newChanIsPrivate,
                    member_ids: memberIds,
                    created_by: userProfile.id,
                    created_by_name: `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim(),
                    created_at: new Date().toISOString()
                  });
                  if (!error) {
                    Alert.alert('Channel Created 🎉', `#${cleanName} is now live.`);
                    setNewChanName('');
                    setNewChanDesc('');
                    setNewChanIsPrivate(false);
                    setNewChanMembers([]);
                    setIsNewChannelModal(false);
                    setActiveChatChannel(cleanName);
                    setChatRecipient(null);
                    refreshAllData(supabaseClient, currentOrg.id, userProfile.id);
                  } else {
                    Alert.alert('Error', error.message);
                  }
                } catch (e: any) {
                  Alert.alert('Error', e?.message);
                } finally {
                  setIsSavingChan(false);
                }
              }}
            >
              <Text style={styles.loginBtnText}>{isSavingChan ? 'Creating...' : (newChanIsPrivate ? 'Create Private Group' : 'Create Channel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsNewChannelModal(false)}>
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 16: READ FULL OFFICIAL NOTICE & EXECUTIVE LETTERHEAD */}
      {/* ========================================================================= */}
      <Modal visible={selectedNoticeForView !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%', paddingBottom: 12 }]}>
            {selectedNoticeForView && (() => {
              const letterMeta = selectedNoticeForView.letterMeta || parseLetterMeta(selectedNoticeForView);
              const isLetterDoc = Boolean(letterMeta);

              if (isLetterDoc) {
                const refNum = letterMeta.refNumber || `REF: ${currentOrg?.orgCode || 'VDX'}/NL/2026/001`;
                const recipientText = letterMeta.recipientType === 'all'
                  ? 'ALL EMPLOYEES & STAFF'
                  : letterMeta.recipientName || 'Employee';
                const signName = letterMeta.signatoryName || selectedNoticeForView.author_name || 'Management';
                const signRole = letterMeta.signatoryRole || selectedNoticeForView.author_role?.toUpperCase() || 'Authorized Signatory';

                return (
                  <>
                    {/* Letterhead Top Banner */}
                    <View style={{ width: '100%', borderBottomWidth: 2, borderBottomColor: isDarkMode ? '#38bdf8' : '#1e293b', paddingBottom: 8, marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, paddingRight: 6 }}>
                          <Text style={{ fontSize: 16, fontWeight: '900', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                            {currentOrg?.name?.toUpperCase() || 'VEDOTRIX TECHNOLOGIES'}
                          </Text>
                          <Text style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 1 }}>
                            Org Code: <Text style={{ fontWeight: 'bold', color: isDarkMode ? '#38bdf8' : '#0284c7' }}>{currentOrg?.orgCode}</Text> &bull; Official Letterhead
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedNoticeForView(null)} style={{ padding: 4 }}>
                          <Text style={{ fontSize: 18, color: '#94a3b8', fontWeight: 'bold' }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Reference & Date Strip */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.6)' : '#f8fafc', borderColor: isDarkMode ? '#334155' : '#e2e8f0', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginVertical: 4 }}>
                      <Text style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold', color: isDarkMode ? '#818cf8' : '#4338ca' }}>
                        {refNum}
                      </Text>
                      <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: '600' }}>
                        {formatDisplayDate(selectedNoticeForView.date || selectedNoticeForView.created_at)}
                      </Text>
                    </View>

                    {/* Scrollable Letter Body */}
                    <ScrollView style={{ width: '100%', maxHeight: 340, marginVertical: 6 }} showsVerticalScrollIndicator={false}>
                      {/* Recipient */}
                      <View style={{ marginVertical: 6 }}>
                        <Text style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' }}>TO:</Text>
                        <Text style={{ fontSize: 12.5, fontWeight: '800', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>{recipientText}</Text>
                        {letterMeta.recipientDesig ? (
                          <Text style={{ fontSize: 10.5, color: '#94a3b8' }}>
                            {letterMeta.recipientDesig} {letterMeta.recipientDept ? `&bull; ${letterMeta.recipientDept}` : ''}
                          </Text>
                        ) : null}
                      </View>

                      {/* Subject */}
                      <View style={{ backgroundColor: isDarkMode ? 'rgba(79, 70, 229, 0.15)' : '#f1f5f9', borderLeftWidth: 3, borderLeftColor: '#4f46e5', padding: 8, borderRadius: 4, marginVertical: 6 }}>
                        <Text style={{ fontSize: 11.5, fontWeight: 'bold', color: isDarkMode ? '#c7d2fe' : '#1e1b4b', textTransform: 'uppercase' }}>
                          SUBJECT: {selectedNoticeForView.title}
                        </Text>
                      </View>

                      {/* Content */}
                      <Text style={{ fontSize: 12, lineHeight: 20, color: isDarkMode ? '#e2e8f0' : '#334155', marginVertical: 6 }}>
                        {selectedNoticeForView.content}
                      </Text>

                      {/* Closing & Digital Stamp */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: isDarkMode ? '#334155' : '#f1f5f9' }}>
                        <View>
                          <Text style={{ fontSize: 10, color: '#94a3b8' }}>Yours faithfully,</Text>
                          <Text style={{ fontSize: 14, fontFamily: 'serif', fontStyle: 'italic', fontWeight: 'bold', color: isDarkMode ? '#38bdf8' : '#1e40af', marginVertical: 2 }}>
                            {signName}
                          </Text>
                          <Text style={{ fontSize: 11, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>{signName}</Text>
                          <Text style={{ fontSize: 9.5, color: '#94a3b8' }}>{signRole} &bull; {currentOrg?.name}</Text>
                        </View>

                        {/* Digital Stamp Seal Graphic */}
                        {letterMeta.isDigitallyStamped !== false && (
                          <View style={{ width: 78, height: 78, borderRadius: 39, borderWidth: 2, borderColor: '#10b981', padding: 2, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }], backgroundColor: 'rgba(16, 185, 129, 0.08)' }}>
                            <View style={{ width: 70, height: 70, borderRadius: 35, borderWidth: 1, borderColor: '#10b981', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', padding: 2 }}>
                              <Text style={{ fontSize: 5, fontWeight: '900', color: '#10b981', textTransform: 'uppercase' }}>★ {currentOrg?.orgCode || 'VDX'} SEAL ★</Text>
                              <Text style={{ fontSize: 6, fontWeight: '900', color: '#10b981', marginVertical: 1 }}>DIGITALLY VERIFIED</Text>
                              <Text style={{ fontSize: 5, fontFamily: 'monospace', fontWeight: 'bold', color: '#10b981' }}>{refNum.slice(-6)}</Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </ScrollView>

                    {/* PDF Export Button */}
                    <TouchableOpacity
                      style={[styles.loginBtn, { marginTop: 8, backgroundColor: '#4f46e5' }]}
                      disabled={isExportingLetterPdf}
                      onPress={() => handleExportLetterPDFMobile(selectedNoticeForView)}
                    >
                      <Text style={styles.loginBtnText}>
                        {isExportingLetterPdf ? 'Generating PDF...' : '📄 Export / Share Official PDF'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.modalCloseBtn, { marginTop: 6 }]} onPress={() => setSelectedNoticeForView(null)}>
                      <Text style={styles.modalCloseBtnText}>Close Letterhead</Text>
                    </TouchableOpacity>
                  </>
                );
              }

              return (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 8 }}>
                    <View style={[
                      styles.noticePriorityBadge,
                      selectedNoticeForView.priority === 'urgent' || selectedNoticeForView.priority === 'critical' ? styles.priorityUrgent :
                      selectedNoticeForView.priority === 'high' ? styles.priorityHigh : styles.priorityNormal
                    ]}>
                      <Text style={styles.noticePriorityText}>{(selectedNoticeForView.priority || 'NORMAL').toUpperCase()}</Text>
                    </View>
                    <Text style={styles.noticeCategoryText}>{selectedNoticeForView.category?.toUpperCase() || 'GENERAL'}</Text>
                  </View>

                  <Text style={[styles.modalTitle, { textAlign: 'left', width: '100%', fontSize: 18, marginBottom: 4 }]}>
                    {selectedNoticeForView.title}
                  </Text>

                  <Text style={{ fontSize: 11, color: '#94a3b8', width: '100%', marginBottom: 12 }}>
                    📅 Published {formatNoticeDate(selectedNoticeForView)} • By {selectedNoticeForView.author_name || 'HR Management'} ({selectedNoticeForView.author_role?.toUpperCase() || 'ADMIN'})
                  </Text>

                  <ScrollView style={{ width: '100%', maxHeight: 320, marginVertical: 6 }} showsVerticalScrollIndicator={false}>
                    <Text style={[styles.noticeFullContent, { fontSize: 13, lineHeight: 22, color: isDarkMode ? '#e2e8f0' : '#1e293b' }]}>
                      {selectedNoticeForView.content}
                    </Text>
                  </ScrollView>

                  {(() => {
                    const urlMatch = selectedNoticeForView.content?.match(/https?:\/\/[^\s]+/);
                    const targetUrl = selectedNoticeForView.action_url || (urlMatch ? urlMatch[0] : null);
                    const isApk = targetUrl && (targetUrl.includes('.apk') || targetUrl.includes('expo.dev/artifacts'));
                    if (!targetUrl) return null;
                    return (
                      <TouchableOpacity
                        style={{
                          backgroundColor: isApk ? '#f59e0b' : '#3b82f6',
                          paddingVertical: 12,
                          paddingHorizontal: 16,
                          borderRadius: 12,
                          marginTop: 10,
                          width: '100%',
                          alignItems: 'center',
                          flexDirection: 'row',
                          justifyContent: 'center',
                          gap: 8,
                          shadowColor: isApk ? '#f59e0b' : '#3b82f6',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.3,
                          shadowRadius: 8,
                          elevation: 4
                        }}
                        onPress={() => {
                          Linking.openURL(targetUrl).catch(() => {
                            Alert.alert('Unable to open link', targetUrl);
                          });
                        }}
                      >
                        <Text style={{ color: '#0f172a', fontWeight: 'bold', fontSize: 13 }}>
                          {isApk ? '🏹 Download & Install Festive Edition APK' : '🔗 Open Link'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })()}

                  <TouchableOpacity
                    style={[styles.loginBtn, { marginTop: 10 }]}
                    onPress={() => setSelectedNoticeForView(null)}
                  >
                    <Text style={styles.loginBtnText}>Close Notice</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 17: CHAT IMAGE LIGHTBOX */}
      {/* ========================================================================= */}
      <Modal visible={chatImageLightboxUrl !== null} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 }}
            onPress={() => setChatImageLightboxUrl(null)}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>✕ Close</Text>
          </TouchableOpacity>
          {chatImageLightboxUrl && (
            <Image
              source={{ uri: chatImageLightboxUrl }}
              style={{ width: '100%', height: '80%', borderRadius: 12 }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 18: MANAGE EMPLOYEE RECORD (HR / SUPERADMIN) */}
      {/* ========================================================================= */}
      <Modal visible={isEditEmployeeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '92%', paddingBottom: 14 }]}>
            {/* Sticky Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#1e293b' : '#e2e8f0' }}>
              <View style={{ flex: 1, paddingRight: 6 }}>
                <Text style={styles.modalTitle}>Edit Employee Record</Text>
                <Text style={styles.modalSub}>
                  {inspectedUserProfile ? (inspectedUserProfile.first_name + ' ' + (inspectedUserProfile.last_name || '')) : 'Edit Profile'} • Live Supabase Sync
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsEditEmployeeModal(false)} style={{ padding: 6, borderRadius: 8, backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }}>
                <Text style={{ fontSize: 16, color: '#94a3b8', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Scrollable Form Body */}
            <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%', flex: 1 }}>
              {/* Names */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>First Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editEmpFirstName}
                    onChangeText={setEditEmpFirstName}
                    placeholder="First Name"
                    placeholderTextColor="#64748b"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Last Name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editEmpLastName}
                    onChangeText={setEditEmpLastName}
                    placeholder="Last Name"
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>

              {/* Role Selection (All 4 Corporate Roles) */}
              <Text style={[styles.inputLabel, { marginTop: 10 }]}>Corporate Role</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginVertical: 4 }}>
                {['employee', 'manager', 'hr', 'superadmin'].map((r) => {
                  const isSelected = editEmpRole === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.filterTab,
                        isSelected && styles.filterTabActive,
                        { flex: 1, paddingVertical: 8, alignItems: 'center' }
                      ]}
                      onPress={() => setEditEmpRole(r)}
                    >
                      <Text style={[
                        styles.filterTabText,
                        isSelected && styles.filterTabTextActive,
                        { fontSize: 10.5, fontWeight: '700' }
                      ]}>
                        {r.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Status Toggle */}
              <Text style={[styles.inputLabel, { marginTop: 8 }]}>Employment Status</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginVertical: 4 }}>
                <TouchableOpacity
                  style={[
                    styles.filterTab,
                    editEmpIsActive && { backgroundColor: '#10b981', borderColor: '#059669' },
                    { flex: 1, paddingVertical: 8, alignItems: 'center' }
                  ]}
                  onPress={() => setEditEmpIsActive(true)}
                >
                  <Text style={[styles.filterTabText, editEmpIsActive && { color: '#ffffff', fontWeight: 'bold' }]}>
                    ✓ ACTIVE
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterTab,
                    !editEmpIsActive && { backgroundColor: '#ef4444', borderColor: '#dc2626' },
                    { flex: 1, paddingVertical: 8, alignItems: 'center' }
                  ]}
                  onPress={() => setEditEmpIsActive(false)}
                >
                  <Text style={[styles.filterTabText, !editEmpIsActive && { color: '#ffffff', fontWeight: 'bold' }]}>
                    ✕ INACTIVE
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Work Email & Phone */}
              <Text style={[styles.inputLabel, { marginTop: 8 }]}>Official Work Email *</Text>
              <TextInput
                style={styles.textInput}
                value={editEmpEmail}
                onChangeText={setEditEmpEmail}
                placeholder="employee@company.com"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={[styles.inputLabel, { marginTop: 8 }]}>Contact Phone</Text>
              <TextInput
                style={styles.textInput}
                value={editEmpPhone}
                onChangeText={setEditEmpPhone}
                placeholder="+91 9876543210"
                placeholderTextColor="#64748b"
                keyboardType="phone-pad"
              />

              {/* Designation & Department */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Designation</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editEmpDesig}
                    onChangeText={setEditEmpDesig}
                    placeholder="e.g. Lead Designer"
                    placeholderTextColor="#64748b"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Department</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editEmpDept}
                    onChangeText={setEditEmpDept}
                    placeholder="Operations"
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>

              {/* Joining Date & Monthly Salary */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Joining Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editEmpJoining}
                    onChangeText={setEditEmpJoining}
                    placeholder="2026-01-01"
                    placeholderTextColor="#64748b"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Base Salary (₹ / mo)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editEmpSalary}
                    onChangeText={setEditEmpSalary}
                    placeholder="50000"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Reporting Manager Selector */}
              <Text style={[styles.inputLabel, { marginTop: 10 }]}>Direct Reporting Manager</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    style={[
                      styles.filterTab,
                      !editEmpManagerId && styles.filterTabActive,
                      { paddingHorizontal: 10, paddingVertical: 6 }
                    ]}
                    onPress={() => setEditEmpManagerId('')}
                  >
                    <Text style={[styles.filterTabText, !editEmpManagerId && styles.filterTabTextActive]}>
                      -- None / Exec Head --
                    </Text>
                  </TouchableOpacity>
                  {teamProfiles
                    .filter((p) => p.id !== inspectedUserProfile?.id)
                    .map((m) => {
                      const isSelected = editEmpManagerId === m.id;
                      return (
                        <TouchableOpacity
                          key={m.id}
                          style={[
                            styles.filterTab,
                            isSelected && styles.filterTabActive,
                            { paddingHorizontal: 10, paddingVertical: 6 }
                          ]}
                          onPress={() => setEditEmpManagerId(m.id)}
                        >
                          <Text style={[styles.filterTabText, isSelected && styles.filterTabTextActive]}>
                            {m.first_name} {m.last_name || ''} ({m.role?.toUpperCase()})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                </View>
              </ScrollView>

              {/* Password Reset */}
              <Text style={[styles.inputLabel, { marginTop: 10 }]}>Reset Security Password (Optional)</Text>
              <TextInput
                style={styles.textInput}
                value={editEmpPasswordReset}
                onChangeText={setEditEmpPasswordReset}
                placeholder="Leave blank to preserve existing password"
                placeholderTextColor="#64748b"
                secureTextEntry
              />
            </ScrollView>

            {/* Pinned Sticky Footer */}
            <View style={{ flexDirection: 'row', gap: 10, width: '100%', paddingTop: 10, borderTopWidth: 1, borderTopColor: isDarkMode ? '#1e293b' : '#e2e8f0' }}>
              <TouchableOpacity
                style={[styles.modalCloseBtn, { flex: 1, marginTop: 0 }]}
                onPress={() => setIsEditEmployeeModal(false)}
              >
                <Text style={styles.modalCloseBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loginBtn, { flex: 2, marginTop: 0 }]}
                disabled={isSavingEmpRecord}
                onPress={async () => {
                  if (!supabaseClient || !inspectedUserProfile) return;
                  if (!editEmpEmail.trim() || !editEmpEmail.includes('@')) {
                    Alert.alert('Invalid Email', 'Please provide a valid work email address.');
                    return;
                  }
                  if (editEmpPasswordReset.trim() && editEmpPasswordReset.trim().length < 6) {
                    Alert.alert('Too Short', 'New password must be at least 6 characters long.');
                    return;
                  }

                  setIsSavingEmpRecord(true);
                  try {
                    const updates: any = {
                      first_name: editEmpFirstName.trim() || inspectedUserProfile.first_name,
                      last_name: editEmpLastName.trim(),
                      role: editEmpRole,
                      email: editEmpEmail.trim().toLowerCase(),
                      phone: editEmpPhone.trim(),
                      designation: editEmpDesig.trim() || 'Staff',
                      department: editEmpDept.trim() || 'Operations',
                      base_salary: Number(editEmpSalary) || 0,
                      manager_id: editEmpManagerId || null,
                      is_active: editEmpIsActive,
                      updated_at: new Date().toISOString()
                    };
                    if (editEmpJoining.trim()) {
                      updates.joining_date = editEmpJoining.trim();
                    }
                    if (editEmpPasswordReset.trim().length >= 6) {
                      let hash = bcrypt.hashSync(editEmpPasswordReset.trim(), 10);
                      if (hash.startsWith('$2b$')) hash = '$2a$' + hash.slice(4);
                      updates.password_hash = hash;
                    }

                    const { error } = await supabaseClient
                      .from('profiles')
                      .update(updates)
                      .eq('id', inspectedUserProfile.id);

                    if (!error) {
                      const updatedEmp = { ...inspectedUserProfile, ...updates };
                      setInspectedUserProfile(updatedEmp);
                      setTeamProfiles((prev) => prev.map((p) => p.id === inspectedUserProfile.id ? { ...p, ...updates } : p));
                      if (userProfile?.id === inspectedUserProfile.id) {
                        setUserProfile((prev: any) => ({ ...prev, ...updates }));
                      }
                      Alert.alert('Record Updated 🚀', updates.first_name + "'s official record has been synced to Supabase.");
                      setIsEditEmployeeModal(false);
                      refreshAllData(supabaseClient, currentOrg?.id, userProfile?.id);
                    } else {
                      showUserFriendlyError('Update Failed', error, 'Could not update employee record.');
                    }
                  } catch (e: any) {
                    showUserFriendlyError('Update Error', e, 'Failed to update employee.');
                  } finally {
                    setIsSavingEmpRecord(false);
                  }
                }}
              >
                <Text style={styles.loginBtnText}>{isSavingEmpRecord ? 'Saving...' : '✓ Save Changes'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 19: ORGANIZATION SETTINGS (HR / SUPERADMIN) */}
      {/* ========================================================================= */}
      <Modal visible={isOrgSettingsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Organization Shift & Geofence</Text>
            <Text style={styles.modalSub}>Update working hours and attendance policies for {currentOrg?.name}</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%', marginTop: 8 }}>
              <Text style={styles.inputLabel}>Shift Start Time (HH:MM IST)</Text>
              <TextInput
                style={styles.textInput}
                value={orgShiftStart}
                onChangeText={setOrgShiftStart}
                placeholder="09:30"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>Shift End Time (HH:MM IST)</Text>
              <TextInput
                style={styles.textInput}
                value={orgShiftEnd}
                onChangeText={setOrgShiftEnd}
                placeholder="18:30"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>Late Grace Period (Minutes)</Text>
              <TextInput
                style={styles.textInput}
                value={orgGracePeriod}
                onChangeText={setOrgGracePeriod}
                placeholder="15"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Geofence Radius (Meters)</Text>
              <TextInput
                style={styles.textInput}
                value={orgGeofenceRadius}
                onChangeText={setOrgGeofenceRadius}
                placeholder="200"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={[styles.loginBtn, { marginTop: 14, backgroundColor: '#4f46e5' }]}
                disabled={isSavingOrgSettings}
                onPress={async () => {
                  if (!supabaseClient || !currentOrg) return;
                  setIsSavingOrgSettings(true);
                  try {
                    const curSettings = currentOrg.settings || {};
                    const newSettings = {
                      ...curSettings,
                      shiftStart: orgShiftStart.trim() || '09:30',
                      shiftStartTime: orgShiftStart.trim() || '09:30',
                      shiftEnd: orgShiftEnd.trim() || '18:30',
                      shiftEndTime: orgShiftEnd.trim() || '18:30',
                      gracePeriodMins: parseInt(orgGracePeriod) || 15
                    };

                    const { error } = await supabaseClient
                      .from('organizations')
                      .update({ settings: newSettings })
                      .eq('id', currentOrg.id);

                    if (!error) {
                      const updatedOrg = { ...currentOrg, settings: newSettings };
                      setCurrentOrg(updatedOrg);
                      Alert.alert('Settings Saved ✓', 'Organization shift and attendance policies updated.');
                      setIsOrgSettingsModal(false);
                      refreshAllData(supabaseClient, currentOrg.id, userProfile?.id);
                    } else {
                      Alert.alert('Database Error', error.message);
                    }
                  } catch (e: any) {
                    Alert.alert('Error', e?.message);
                  } finally {
                    setIsSavingOrgSettings(false);
                  }
                }}
              >
                <Text style={styles.loginBtnText}>{isSavingOrgSettings ? 'Saving...' : 'Save Organization Settings'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsOrgSettingsModal(false)}>
                <Text style={styles.modalCloseBtnText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      {/* ========================================================================= */}
      {/* MODAL 20: INSTANT PROFILE PHOTO & AVATAR PICKER (NO REINSTALL REQUIRED) */}
      {/* ========================================================================= */}
      <Modal visible={isPhotoPickerModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 20 }}>👤</Text>
                <Text style={styles.modalTitle}>Choose Avatar / Photo</Text>
              </View>
              <TouchableOpacity onPress={() => setIsPhotoPickerModalOpen(false)}>
                <Text style={{ fontSize: 18, color: '#94a3b8', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSub, { width: '100%', textAlign: 'left', marginBottom: 10 }]}>
              Instantly synced across Vedotrix Pulse (no APK reinstall needed).
            </Text>

            <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
              {/* SECTION 1: INSTANT CURATED AVATARS */}
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#0284c7', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                  ✨ Instant Executive Avatars (Tap to Set)
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                  {PRESET_AVATARS.map((url, idx) => {
                    const isSelected = userProfile?.avatar_url === url;
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={{
                          width: 60,
                          height: 60,
                          borderRadius: 30,
                          overflow: 'hidden',
                          borderWidth: isSelected ? 3 : 2,
                          borderColor: isSelected ? '#38bdf8' : (isDarkMode ? '#334155' : '#cbd5e1'),
                          backgroundColor: '#1e293b'
                        }}
                        onPress={() => saveAvatarUrl(url)}
                      >
                        <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} />
                        {isSelected && (
                          <View style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            left: 0,
                            backgroundColor: 'rgba(2, 132, 199, 0.85)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: 16
                          }}>
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✓</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* SECTION 2: PASTE PHOTO URL */}
              <View style={{
                backgroundColor: isDarkMode ? '#141b2d' : '#f1f5f9',
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: isDarkMode ? '#1e293b' : '#cbd5e1',
                marginBottom: 14
              }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? '#ffffff' : '#0f172a', marginBottom: 6 }}>
                  🔗 Paste Custom Photo Link (URL)
                </Text>
                <TextInput
                  style={[styles.textInput, { marginBottom: 8 }]}
                  value={customPhotoUrlInput}
                  onChangeText={setCustomPhotoUrlInput}
                  placeholder="https://images.unsplash.com/... or any image URL"
                  placeholderTextColor="#64748b"
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.loginBtn, { paddingVertical: 9, opacity: customPhotoUrlInput.trim() ? 1 : 0.5 }]}
                  disabled={!customPhotoUrlInput.trim()}
                  onPress={() => saveAvatarUrl(customPhotoUrlInput.trim())}
                >
                  <Text style={styles.loginBtnText}>Save Custom Photo URL</Text>
                </TouchableOpacity>
              </View>

              {/* SECTION 3: NATIVE CAMERA & GALLERY */}
              <View style={{
                backgroundColor: isDarkMode ? '#141b2d' : '#f1f5f9',
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: isDarkMode ? '#1e293b' : '#cbd5e1',
                marginBottom: 14
              }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? '#ffffff' : '#0f172a', marginBottom: 6 }}>
                  📸 Device Camera & Gallery
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.loginBtn, { flex: 1, backgroundColor: '#475569', paddingVertical: 8 }]}
                    onPress={takePhotoWithCamera}
                  >
                    <Text style={styles.loginBtnText}>📸 Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.loginBtn, { flex: 1, backgroundColor: '#475569', paddingVertical: 8 }]}
                    onPress={pickImageFromGallery}
                  >
                    <Text style={styles.loginBtnText}>🖼️ Gallery</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setIsPhotoPickerModalOpen(false)}
            >
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 21: ATTACH DOCUMENT / PDF TO CHAT */}
      {/* ========================================================================= */}
      <Modal visible={isAttachingDocModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, width: '100%' }}>
              <Text style={{ fontSize: 22 }}>📄</Text>
              <Text style={styles.modalTitle}>Attach Document / PDF</Text>
            </View>
            <Text style={[styles.modalSub, { width: '100%', textAlign: 'left', marginBottom: 12 }]}>
              Share a document or PDF link with your team in this conversation.
            </Text>

            <Text style={styles.inputLabel}>Document Title / File Name *</Text>
            <TextInput
              style={styles.textInput}
              value={docAttachmentName}
              onChangeText={setDocAttachmentName}
              placeholder="e.g. Q3_Performance_Report.pdf"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.inputLabel}>Document / PDF URL *</Text>
            <TextInput
              style={styles.textInput}
              value={docAttachmentUrl}
              onChangeText={setDocAttachmentUrl}
              placeholder="https://... file link or cloud storage URL"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.loginBtn, { marginTop: 12, opacity: docAttachmentUrl.trim() ? 1 : 0.5 }]}
              disabled={!docAttachmentUrl.trim()}
              onPress={() => sendChatDocument(docAttachmentName, docAttachmentUrl)}
            >
              <Text style={styles.loginBtnText}>Share Document in Chat ↗</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setIsAttachingDocModalOpen(false)}
            >
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 22: CHANNEL SETTINGS & MEMBERS MANAGEMENT                           */}
      {/* ========================================================================= */}
      <Modal visible={isChannelSettingsModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%', paddingBottom: 16 }]}>
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Text style={{ fontSize: 20 }}>{activeChanObj?.is_private ? '🔒' : '⚙️'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { textAlign: 'left' }]} numberOfLines={1}>
                    {activeChanObj?.is_private ? `🔒 ${activeChanObj.name}` : `# ${activeChanObj?.name || 'Channel'}`}
                  </Text>
                  <Text style={[styles.modalSub, { textAlign: 'left', marginBottom: 0 }]}>
                    {activeChanObj?.is_private ? 'Private Group Settings' : 'Channel Settings & Members'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsChannelSettingsModalOpen(false)}
                style={{ padding: 4 }}
              >
                <Text style={{ fontSize: 18, color: '#94a3b8', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Subtab Toggle: Members vs Details */}
            <View style={[styles.filterRow, { marginBottom: 14, width: '100%' }]}>
              <TouchableOpacity
                style={[styles.filterTab, channelSettingsTab === 'members' && styles.filterTabActive]}
                onPress={() => setChannelSettingsTab('members')}
              >
                <Text style={[styles.filterTabText, channelSettingsTab === 'members' && styles.filterTabTextActive]}>
                  👥 Members ({activeChannelMembers.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterTab, channelSettingsTab === 'details' && styles.filterTabActive]}
                onPress={() => setChannelSettingsTab('details')}
              >
                <Text style={[styles.filterTabText, channelSettingsTab === 'details' && styles.filterTabTextActive]}>
                  ⚙️ Details & Access
                </Text>
              </TouchableOpacity>
            </View>

            {/* TAB 1: MEMBERS MANAGEMENT */}
            {channelSettingsTab === 'members' && (
              <ScrollView style={{ width: '100%', maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                {/* Add Member Section (If Admin/Creator or Privileged) */}
                {isChannelAdmin && nonMembersToAdd.length > 0 && (
                  <View style={{
                    backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                    marginBottom: 14
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? '#f8fafc' : '#0f172a', marginBottom: 6 }}>
                      + Add Colleague to Channel
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {nonMembersToAdd.map((colleague) => {
                          const isSelected = candidateMemberToAdd === colleague.id;
                          return (
                            <TouchableOpacity
                              key={colleague.id}
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 8,
                                backgroundColor: isSelected ? '#0284c7' : (isDarkMode ? '#0f172a' : '#ffffff'),
                                borderWidth: 1,
                                borderColor: isSelected ? '#0284c7' : (isDarkMode ? '#334155' : '#cbd5e1')
                              }}
                              onPress={() => setCandidateMemberToAdd(colleague.id)}
                            >
                              <Text style={{ fontSize: 11, fontWeight: 'bold', color: isSelected ? '#ffffff' : (isDarkMode ? '#f8fafc' : '#0f172a') }}>
                                {colleague.first_name} {colleague.last_name || ''}
                              </Text>
                              <Text style={{ fontSize: 9, color: isSelected ? '#e0f2fe' : '#94a3b8' }}>
                                {colleague.designation || 'Staff'}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>

                    <TouchableOpacity
                      style={[styles.loginBtn, { marginTop: 4, paddingVertical: 8, opacity: candidateMemberToAdd ? 1 : 0.5 }]}
                      disabled={!candidateMemberToAdd}
                      onPress={() => activeChanObj && addMemberToChannel(activeChanObj.id || activeChanObj.name, candidateMemberToAdd)}
                    >
                      <Text style={[styles.loginBtnText, { fontSize: 12 }]}>Add Selected Colleague ✓</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Current Members List */}
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                  Current Members ({activeChannelMembers.length})
                </Text>

                <View style={{ gap: 8 }}>
                  {activeChannelMembers.map((member) => {
                    const isSelf = member.id === userProfile?.id;
                    const isOwner = activeChanObj?.created_by === member.id;
                    const hasValidAvatar = member.avatar_url && (member.avatar_url.startsWith('http') || member.avatar_url.startsWith('data:image'));
                    const initials = ((member.first_name?.[0] || 'U') + (member.last_name?.[0] || '')).toUpperCase();

                    return (
                      <View
                        key={member.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 8,
                          paddingHorizontal: 10,
                          borderRadius: 10,
                          backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                          borderWidth: 1,
                          borderColor: isDarkMode ? '#334155' : '#e2e8f0'
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
                          <View style={{ width: 32, height: 32, borderRadius: 16, overflow: 'hidden', backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' }}>
                            {hasValidAvatar ? (
                              <Image source={{ uri: member.avatar_url }} style={{ width: '100%', height: '100%' }} />
                            ) : (
                              <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{initials}</Text>
                            )}
                          </View>

                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                                {member.first_name} {member.last_name || ''} {isSelf && '(You)'}
                              </Text>
                              {isOwner && (
                                <View style={{ backgroundColor: '#0284c7', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                  <Text style={{ color: '#fff', fontSize: 8, fontWeight: 'bold' }}>Owner</Text>
                                </View>
                              )}
                            </View>
                            <Text style={{ fontSize: 10, color: '#94a3b8' }}>
                              {member.designation || member.department || 'Team Member'}
                            </Text>
                          </View>
                        </View>

                        {/* Remove Action (if channel admin and not self) */}
                        {isChannelAdmin && !isSelf && (
                          <TouchableOpacity
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 6,
                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              borderWidth: 1,
                              borderColor: 'rgba(239, 68, 68, 0.3)'
                            }}
                            onPress={() => activeChanObj && removeMemberFromChannel(activeChanObj.id || activeChanObj.name, member.id)}
                          >
                            <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: 'bold' }}>Remove</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {/* TAB 2: CHANNEL DETAILS & ACCESS */}
            {channelSettingsTab === 'details' && (
              <ScrollView style={{ width: '100%', maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>Channel Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={editChannelNameInput}
                  onChangeText={setEditChannelNameInput}
                  placeholder="e.g. general, announcements"
                  placeholderTextColor="#64748b"
                  autoCapitalize="none"
                  editable={isChannelAdmin}
                />

                <Text style={styles.inputLabel}>Channel Description</Text>
                <TextInput
                  style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                  value={editChannelDescInput}
                  onChangeText={setEditChannelDescInput}
                  placeholder="What is this channel for?"
                  placeholderTextColor="#64748b"
                  multiline
                  editable={isChannelAdmin}
                />

                {isChannelAdmin && (
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginVertical: 10,
                    padding: 10,
                    borderRadius: 10,
                    backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
                    borderWidth: 1,
                    borderColor: isDarkMode ? '#334155' : '#cbd5e1'
                  }}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                        Private Channel Access
                      </Text>
                      <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                        {editChannelIsPrivate
                          ? 'Only invited members can view and post messages.'
                          : 'Anyone in the workspace can view and post.'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: editChannelIsPrivate ? '#f59e0b' : (isDarkMode ? '#334155' : '#cbd5e1')
                      }}
                      onPress={() => setEditChannelIsPrivate(!editChannelIsPrivate)}
                    >
                      <Text style={{ color: editChannelIsPrivate ? '#ffffff' : (isDarkMode ? '#94a3b8' : '#475569'), fontSize: 11, fontWeight: 'bold' }}>
                        {editChannelIsPrivate ? '🔒 Private' : '🌐 Public'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {isChannelAdmin && (
                  <TouchableOpacity
                    style={[styles.loginBtn, { marginTop: 10, opacity: isSavingChannelSettings || !editChannelNameInput.trim() ? 0.6 : 1 }]}
                    disabled={isSavingChannelSettings || !editChannelNameInput.trim()}
                    onPress={() => activeChanObj && updateChannelDetails(activeChanObj.id || activeChanObj.name, editChannelNameInput, editChannelDescInput, editChannelIsPrivate)}
                  >
                    <Text style={styles.loginBtnText}>
                      {isSavingChannelSettings ? 'Saving...' : 'Save Channel Changes ✓'}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Delete Channel (Permanent) */}
                {isChannelAdmin && activeChanObj && activeChanObj.id && (
                  <TouchableOpacity
                    style={{
                      marginTop: 14,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      borderWidth: 1,
                      borderColor: '#ef4444',
                      alignItems: 'center'
                    }}
                    onPress={() => deleteChannel(activeChanObj.id)}
                  >
                    <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: 'bold' }}>
                      🗑️ Delete Channel Permanently
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}

            {/* Close Button */}
            <TouchableOpacity
              style={[styles.modalCloseBtn, { marginTop: 12, width: '100%' }]}
              onPress={() => setIsChannelSettingsModalOpen(false)}
            >
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 23: MESSAGE ACTIONS & QUICK REACTIONS SHEET                         */}
      {/* ========================================================================= */}
      <Modal visible={activeMessageActionId !== null} animationType="slide" transparent>
        {(() => {
          const actionTargetMsg = activeConversationMessages.find((m) => m.id === activeMessageActionId);
          if (!actionTargetMsg) return null;

          const msgCreatedTime = new Date(actionTargetMsg.created_at).getTime();
          const diffMinutes = (Date.now() - msgCreatedTime) / (60 * 1000);
          const canEditMsg = isPrivileged || (actionTargetMsg.sender_id === userProfile?.id && diffMinutes <= 15);
          const canDeleteMsg = isPrivileged || (actionTargetMsg.sender_id === userProfile?.id && diffMinutes <= 15);
          const isMsgPinned = Boolean(actionTargetMsg.is_pinned);

          return (
            <View style={styles.modalOverlay}>
              <View style={[styles.modalCard, { paddingBottom: 16 }]}>
                {/* Header Preview */}
                <View style={{ width: '100%', marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#1e293b' : '#e2e8f0' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                      {actionTargetMsg.sender_name}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#94a3b8' }}>
                      {formatISTTimeOnly(actionTargetMsg.created_at)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: isDarkMode ? '#94a3b8' : '#64748b' }} numberOfLines={2}>
                    "{actionTargetMsg.message || 'Attachment'}"
                  </Text>
                </View>

                {/* Quick Emoji Reactions */}
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5, width: '100%' }}>
                  Quick Reactions
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 14, backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', padding: 8, borderRadius: 12 }}>
                  {['👍', '❤️', '🎉', '🔥', '🚀', '👀', '👏', '💯'].map((em) => (
                    <TouchableOpacity
                      key={em}
                      style={{ padding: 4 }}
                      onPress={() => {
                        addChatReaction(actionTargetMsg.id, em);
                        setActiveMessageActionId(null);
                      }}
                    >
                      <Text style={{ fontSize: 20 }}>{em}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Action Buttons List */}
                <View style={{ gap: 8, width: '100%' }}>
                  {/* Pin / Unpin */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#334155' : '#e2e8f0'
                    }}
                    onPress={() => togglePinChatMessage(actionTargetMsg.id)}
                  >
                    <Text style={{ fontSize: 16 }}>{isMsgPinned ? '📌' : '📍'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                        {isMsgPinned ? 'Unpin from Conversation' : 'Pin to Conversation'}
                      </Text>
                      <Text style={{ fontSize: 10, color: '#94a3b8' }}>
                        {isMsgPinned ? 'Remove from top banner' : 'Keep visible for everyone in channel'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Quote & Reply */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#334155' : '#e2e8f0'
                    }}
                    onPress={() => {
                      const quote = `> ${actionTargetMsg.message || 'Attachment'}\n`;
                      setChatInputText((prev) => (prev ? `${quote}${prev}` : quote));
                      setActiveMessageActionId(null);
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>💬</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                        Quote & Reply
                      </Text>
                      <Text style={{ fontSize: 10, color: '#94a3b8' }}>
                        Reference this message in your reply
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Edit Message (if canEdit) */}
                  {canEditMsg && actionTargetMsg.message && actionTargetMsg.message !== '📷 Photo attached' && (
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                        backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#334155' : '#e2e8f0'
                      }}
                      onPress={() => {
                        setEditingMessageId(actionTargetMsg.id);
                        setEditingMessageText(actionTargetMsg.message);
                        setActiveMessageActionId(null);
                      }}
                    >
                      <Text style={{ fontSize: 16 }}>✏️</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#0284c7' }}>
                          Edit Message
                        </Text>
                        <Text style={{ fontSize: 10, color: '#94a3b8' }}>
                          Available within 15 minutes of sending
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Delete Message (if canDelete) */}
                  {canDeleteMsg && (
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderWidth: 1,
                        borderColor: 'rgba(239, 68, 68, 0.3)'
                      }}
                      onPress={() => deleteChatMessage(actionTargetMsg.id)}
                    >
                      <Text style={{ fontSize: 16 }}>🗑️</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#ef4444' }}>
                          Delete Message
                        </Text>
                        <Text style={{ fontSize: 10, color: '#ef4444', opacity: 0.8 }}>
                          Permanently remove this message
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Cancel Button */}
                <TouchableOpacity
                  style={[styles.modalCloseBtn, { marginTop: 14, width: '100%' }]}
                  onPress={() => setActiveMessageActionId(null)}
                >
                  <Text style={styles.modalCloseBtnText}>Close Menu</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 24: PINNED MESSAGES DRAWER / MODAL                                  */}
      {/* ========================================================================= */}
      <Modal visible={showPinnedMessagesModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '85%', paddingBottom: 16 }]}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Text style={{ fontSize: 20 }}>📌</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { textAlign: 'left' }]}>
                    Pinned Messages ({pinnedMessages.length})
                  </Text>
                  <Text style={[styles.modalSub, { textAlign: 'left', marginBottom: 0 }]}>
                    Important messages pinned in this conversation
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowPinnedMessagesModal(false)}
                style={{ padding: 4 }}
              >
                <Text style={{ fontSize: 18, color: '#94a3b8', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Pinned Messages List */}
            {pinnedMessages.length === 0 ? (
              <View style={{ paddingVertical: 35, alignItems: 'center' }}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>📌</Text>
                <Text style={{ color: isDarkMode ? '#f8fafc' : '#0f172a', fontSize: 14, fontWeight: 'bold' }}>
                  No Pinned Messages
                </Text>
                <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 4, textAlign: 'center' }}>
                  Long-press any message in this channel or tap ⋯ to pin it here for quick reference.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ width: '100%', maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: 10 }}>
                  {pinnedMessages.map((msg) => {
                    const senderProfile = teamProfiles.find((p) => p.id === msg.sender_id);
                    const effectiveAvatar = senderProfile?.avatar_url || msg.sender_avatar;
                    const initials = ((senderProfile?.first_name?.[0] || msg.sender_name?.[0] || 'U') + (senderProfile?.last_name?.[0] || '')).toUpperCase();

                    return (
                      <View
                        key={msg.id}
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                          borderWidth: 1,
                          borderColor: isDarkMode ? '#334155' : '#e2e8f0'
                        }}
                      >
                        {/* Top row */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ width: 26, height: 26, borderRadius: 13, overflow: 'hidden', backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' }}>
                              {effectiveAvatar ? (
                                <Image source={{ uri: effectiveAvatar }} style={{ width: '100%', height: '100%' }} />
                              ) : (
                                <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{initials}</Text>
                              )}
                            </View>
                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                              {msg.sender_name}
                            </Text>
                            <Text style={{ fontSize: 10, color: '#94a3b8' }}>
                              {formatISTTimeOnly(msg.created_at)}
                            </Text>
                          </View>

                          <TouchableOpacity
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 6,
                              backgroundColor: 'rgba(245, 158, 11, 0.15)',
                              borderWidth: 1,
                              borderColor: 'rgba(245, 158, 11, 0.3)'
                            }}
                            onPress={() => togglePinChatMessage(msg.id)}
                          >
                            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#f59e0b' }}>Unpin</Text>
                          </TouchableOpacity>
                        </View>

                        {/* Message Content */}
                        {msg.message && (
                          <Text style={{ fontSize: 12, color: isDarkMode ? '#e2e8f0' : '#334155', lineHeight: 17 }}>
                            {msg.message}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {/* Close Button */}
            <TouchableOpacity
              style={[styles.modalCloseBtn, { marginTop: 12, width: '100%' }]}
              onPress={() => setShowPinnedMessagesModal(false)}
            >
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 25: CHANGE ACCOUNT PASSWORD                                         */}
      {/* ========================================================================= */}
      <Modal visible={isChangePasswordModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🔐 Change Password</Text>
            <Text style={styles.modalSub}>Update your login credentials securely with Supabase</Text>

            <View style={{ width: '100%', marginTop: 12, gap: 10 }}>
              <View>
                <Text style={styles.inputLabel}>New Password (min. 6 characters)</Text>
                <TextInput
                  style={styles.textInput}
                  value={newPasswordInput}
                  onChangeText={setNewPasswordInput}
                  placeholder="Enter new password"
                  placeholderTextColor="#64748b"
                  secureTextEntry={!showPasswordText}
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <TextInput
                  style={styles.textInput}
                  value={confirmPasswordInput}
                  onChangeText={setConfirmPasswordInput}
                  placeholder="Re-enter new password"
                  placeholderTextColor="#64748b"
                  secureTextEntry={!showPasswordText}
                />
              </View>

              <TouchableOpacity
                onPress={() => setShowPasswordText(!showPasswordText)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}
              >
                <Text style={{ fontSize: 13, color: '#38bdf8' }}>
                  {showPasswordText ? '🙈 Hide password' : '👁️ Show password'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loginBtn, { marginTop: 8 }]}
                disabled={isUpdatingPassword}
                onPress={async () => {
                  if (!userProfile) return;
                  if (newPasswordInput.trim().length < 6) {
                    Alert.alert('Too Short', 'Password must be at least 6 characters long.');
                    return;
                  }
                  if (newPasswordInput !== confirmPasswordInput) {
                    Alert.alert('Mismatch', 'New passwords do not match.');
                    return;
                  }
                  setIsUpdatingPassword(true);
                  const success = await updateUserPassword(userProfile.id, newPasswordInput.trim());
                  setIsUpdatingPassword(false);
                  if (success) {
                    setIsChangePasswordModal(false);
                    setNewPasswordInput('');
                    setConfirmPasswordInput('');
                  }
                }}
              >
                <Text style={styles.loginBtnText}>
                  {isUpdatingPassword ? 'Updating...' : 'Save New Password'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsChangePasswordModal(false)}
              >
                <Text style={styles.modalCloseBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// =============================================================================
// THEMED STYLESHEET GENERATOR (DARK & LIGHT CORPORATE PALETTES)
// =============================================================================
function createThemedStyles(themeOrIsDark: boolean | 'dark' | 'light' | 'navy' | 'emerald') {
  const theme = typeof themeOrIsDark === 'string' ? themeOrIsDark : (themeOrIsDark ? 'dark' : 'light');
  const isDark = theme !== 'light';

  let bg = '#07090e';
  let cardBg = '#0f172a';
  let cardBorder = '#1e293b';
  let subtleBorder = '#334155';
  let textPrimary = '#ffffff';
  let textSecondary = '#94a3b8';
  let textMuted = '#64748b';
  let inputBg = '#07090e';
  let inputBorder = '#1e293b';
  let subtleBg = '#141b2d';
  let navBg = '#07090e';
  let navBorder = '#1e293b';

  if (theme === 'light') {
    bg = '#f8fafd';
    cardBg = '#ffffff';
    cardBorder = '#e2e8f0';
    subtleBorder = '#cbd5e1';
    textPrimary = '#0f172a';
    textSecondary = '#64748b';
    textMuted = '#94a3b8';
    inputBg = '#ffffff';
    inputBorder = '#cbd5e1';
    subtleBg = '#f1f5f9';
    navBg = '#ffffff';
    navBorder = '#e2e8f0';
  } else if (theme === 'navy') {
    bg = '#060d1f';
    cardBg = '#0c1836';
    cardBorder = '#1a2e5a';
    subtleBorder = '#25407d';
    textPrimary = '#f0f9ff';
    textSecondary = '#93c5fd';
    textMuted = '#60a5fa';
    inputBg = '#060d1f';
    inputBorder = '#1a2e5a';
    subtleBg = '#0f224d';
    navBg = '#060d1f';
    navBorder = '#1a2e5a';
  } else if (theme === 'emerald') {
    bg = '#04140e';
    cardBg = '#09261b';
    cardBorder = '#134e3a';
    subtleBorder = '#1b6b50';
    textPrimary = '#ecfdf5';
    textSecondary = '#6ee7b7';
    textMuted = '#34d399';
    inputBg = '#04140e';
    inputBorder = '#134e3a';
    subtleBg = '#0d3627';
    navBg = '#04140e';
    navBorder = '#134e3a';
  }

  return StyleSheet.create({
    empCardEditBtn: {
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#cbd5e1'
    },
    empCardEditBtnText: {
      fontSize: 10.5,
      fontWeight: '700',
      color: textPrimary
    },

    // 4-Theme Chip Selectors in Drawer
    drawerThemeChip: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: cardBg,
      borderWidth: 1,
      borderColor: cardBorder,
      alignItems: 'center',
      justifyContent: 'center'
    },
    drawerThemeChipSelected: {
      borderColor: '#2563eb',
      backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff'
    },
    drawerThemeChipText: {
      fontSize: 10.5,
      fontWeight: '600',
      color: textSecondary
    },
    drawerThemeChipTextSelected: {
      color: '#2563eb',
      fontWeight: 'bold'
    },

    // Dashboard Cards: Quotes, Meetings, Announcements
    dashboardQuoteCard: {
      backgroundColor: cardBg,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: cardBorder,
      shadowColor: isDark ? '#000000' : 'rgba(0,0,0,0.03)',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 1,
      shadowRadius: 3,
      elevation: 1
    },
    dashboardQuoteHeading: {
      fontSize: 9.5,
      fontWeight: '800',
      color: textMuted,
      letterSpacing: 0.6
    },
    dashboardQuoteText: {
      fontSize: 13,
      fontStyle: 'italic',
      color: textPrimary,
      lineHeight: 18,
      marginVertical: 4
    },
    dashboardQuoteAuthor: {
      fontSize: 11,
      fontWeight: '600',
      color: textSecondary,
      alignSelf: 'flex-end'
    },
    dashboardSectionCard: {
      backgroundColor: cardBg,
      borderRadius: 16,
      padding: 15,
      borderWidth: 1,
      borderColor: cardBorder,
      shadowColor: isDark ? '#000000' : 'rgba(0,0,0,0.04)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: 1
    },
    viewAllLinkText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: '#2563eb'
    },
    emptyCardContainer: {
      paddingVertical: 14,
      alignItems: 'center',
      backgroundColor: isDark ? '#0b1120' : '#f8fafc',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: cardBorder
    },
    emptyCardHeading: {
      color: textSecondary,
      fontSize: 12,
      fontWeight: '600'
    },
    emptyCardSubtext: {
      color: textMuted,
      fontSize: 10.5,
      marginTop: 2
    },
    compactMeetingItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 10,
      borderRadius: 12,
      backgroundColor: isDark ? '#0b1120' : '#f8fafc',
      borderWidth: 1,
      borderColor: cardBorder
    },
    compactMeetingDateText: {
      fontSize: 10.5,
      color: textSecondary
    },
    compactMeetingTitleText: {
      fontSize: 13,
      fontWeight: '700',
      color: textPrimary,
      marginBottom: 2
    },
    compactMeetingTimeText: {
      fontSize: 10.5,
      color: textSecondary
    },
    compactJoinBtn: {
      backgroundColor: '#2563eb',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10
    },
    compactJoinBtnText: {
      color: '#ffffff',
      fontSize: 11.5,
      fontWeight: '700'
    },
    compactNoticeItem: {
      padding: 10,
      borderRadius: 12,
      backgroundColor: isDark ? '#0b1120' : '#f8fafc',
      borderWidth: 1,
      borderColor: cardBorder
    },
    compactNoticeDateText: {
      fontSize: 10,
      color: textMuted
    },
    compactNoticeTitleText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: textPrimary,
      marginBottom: 2
    },
    compactNoticeSnippetText: {
      fontSize: 11,
      color: textSecondary,
      lineHeight: 15
    },
    // Modern Hamburger & App / Org Branding
    hamburgerBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#e2e8f0'
    },
    hamburgerIcon: {
      fontSize: 18,
      color: textPrimary,
      fontWeight: 'bold'
    },
    orgHeaderLogoImg: {
      width: 34,
      height: 34,
      borderRadius: 8
    },
    vedotrixBadge: {
      backgroundColor: '#2563eb',
      paddingHorizontal: 6,
      paddingVertical: 1.5,
      borderRadius: 4
    },
    vedotrixBadgeText: {
      color: '#ffffff',
      fontSize: 8.5,
      fontWeight: '900',
      letterSpacing: 0.6
    },
    vedotrixPulseText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#38bdf8'
    },
    orgHeaderName: {
      fontSize: 13,
      fontWeight: '800',
      color: textPrimary,
      maxWidth: 130
    },

    // Modern Slide-out Drawer Styles
    drawerBackdrop: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: 'rgba(0, 0, 0, 0.6)'
    },
    drawerBackdropDismiss: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0
    },
    drawerContent: {
      width: '82%',
      maxWidth: 320,
      backgroundColor: cardBg,
      height: '100%',
      shadowColor: '#000000',
      shadowOffset: { width: 4, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 16,
      borderRightWidth: 1,
      borderRightColor: cardBorder
    },
    drawerHeader: {
      paddingHorizontal: 16,
      paddingTop: 45,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: cardBorder,
      backgroundColor: isDark ? '#0b1120' : '#f8fafc'
    },
    drawerVedotrixPill: {
      backgroundColor: '#2563eb',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6
    },
    drawerVedotrixPillText: {
      color: '#ffffff',
      fontSize: 9.5,
      fontWeight: '900',
      letterSpacing: 0.5
    },
    drawerOrgName: {
      fontSize: 14,
      fontWeight: '800',
      color: textPrimary,
      marginTop: 2
    },
    drawerCloseBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#1e293b' : '#e2e8f0'
    },
    drawerProfileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 14,
      padding: 10,
      borderRadius: 12,
      backgroundColor: cardBg,
      borderWidth: 1,
      borderColor: cardBorder
    },
    drawerAvatarCircle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: '#2563eb',
      alignItems: 'center',
      justifyContent: 'center'
    },
    drawerAvatarInitials: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '800'
    },
    drawerProfileName: {
      fontSize: 13.5,
      fontWeight: '800',
      color: textPrimary
    },
    drawerProfileEmail: {
      fontSize: 10.5,
      color: textSecondary,
      marginTop: 1
    },
    drawerRoleBadge: {
      alignSelf: 'flex-start',
      marginTop: 4,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1
    },
    drawerRoleBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.4
    },
    drawerSectionHeading: {
      fontSize: 10,
      fontWeight: '800',
      color: textMuted,
      letterSpacing: 0.8,
      marginTop: 14,
      marginBottom: 6,
      paddingHorizontal: 8
    },
    drawerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 10,
      marginVertical: 1
    },
    drawerItemActive: {
      backgroundColor: isDark ? 'rgba(37, 99, 235, 0.18)' : '#eff6ff'
    },
    drawerItemIcon: {
      fontSize: 17
    },
    drawerItemLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: textSecondary
    },
    drawerItemLabelActive: {
      color: '#2563eb',
      fontWeight: '800'
    },
    drawerBadge: {
      backgroundColor: '#f59e0b',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8
    },
    drawerBadgeText: {
      color: '#ffffff',
      fontSize: 10,
      fontWeight: 'bold'
    },
    drawerFooter: {
      padding: 14,
      borderTopWidth: 1,
      borderTopColor: cardBorder,
      gap: 8,
      backgroundColor: isDark ? '#0b1120' : '#f8fafc'
    },
    drawerThemeToggle: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: cardBg,
      borderWidth: 1,
      borderColor: cardBorder
    },
    drawerLogoutBtn: {
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.25)'
    },
    drawerLogoutBtnText: {
      color: '#ef4444',
      fontSize: 12.5,
      fontWeight: '700'
    },

    // Dashboard Quick Punch Non-Repetitive Widget
    dashboardQuickPunchWidget: {
      backgroundColor: cardBg,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: cardBorder,
      shadowColor: isDark ? '#000000' : 'rgba(0,0,0,0.03)',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 1,
      shadowRadius: 3,
      elevation: 1
    },
    geofenceDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5
    },
    geofenceLocationText: {
      fontSize: 10.5,
      fontWeight: '700',
      color: textSecondary
    },
    quickPunchStatusText: {
      fontSize: 12,
      fontWeight: '600',
      color: textPrimary
    },
    quickPunchBtn: {
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center'
    },
    quickPunchBtnActive: {
      backgroundColor: '#2563eb'
    },
    quickPunchBtnDone: {
      backgroundColor: '#16a34a'
    },
    quickPunchBtnText: {
      color: '#ffffff',
      fontSize: 12.5,
      fontWeight: '800'
    },
    // New Corporate Screen 1-4 Styles
    dashboardGreetingText: {
      fontSize: 22,
      fontWeight: '800',
      color: textPrimary,
      letterSpacing: -0.3
    },
    dashboardDateLocationText: {
      fontSize: 12,
      fontWeight: '500',
      color: textSecondary,
      marginTop: 2
    },
    dashboardMetricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10
    },
    dashboardMetricCard: {
      width: '48.5%',
      backgroundColor: cardBg,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: cardBorder,
      shadowColor: isDark ? '#000000' : 'rgba(0,0,0,0.04)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 1,
      shadowRadius: 4,
      elevation: 1
    },
    dashboardMetricSubtitle: {
      fontSize: 11,
      fontWeight: '500',
      color: textSecondary,
      marginBottom: 6
    },
    dashboardMetricValue: {
      fontSize: 26,
      fontWeight: '800',
      color: textPrimary
    },
    dashboardMetricPill: {
      marginTop: 6,
      alignSelf: 'flex-start',
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10
    },
    dashboardMetricPillText: {
      fontSize: 10,
      fontWeight: '600',
      color: textSecondary
    },
    dashboardChartCard: {
      backgroundColor: cardBg,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: cardBorder,
      shadowColor: isDark ? '#000000' : 'rgba(0,0,0,0.04)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 1,
      shadowRadius: 4,
      elevation: 1
    },
    dashboardCardTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: textPrimary
    },
    chartBadgePill: {
      backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? '#3b82f6' : '#bfdbfe'
    },
    chartBadgePillText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#2563eb'
    },
    chartContainer: {
      marginTop: 8,
      position: 'relative'
    },
    chartGuideLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 35,
      height: 1,
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9'
    },
    chartPointDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: isDark ? '#475569' : '#94a3b8',
      marginBottom: 4
    },
    chartPointDotActive: {
      backgroundColor: '#2563eb',
      width: 9,
      height: 9,
      borderRadius: 4.5
    },
    chartVerticalBar: {
      width: 4,
      borderRadius: 2,
      backgroundColor: isDark ? '#334155' : '#cbd5e1'
    },
    chartDayLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: textSecondary,
      marginTop: 6
    },
    recentActivityAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center'
    },
    recentActivityAvatarText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '700'
    },
    recentActivityName: {
      fontSize: 12.5,
      fontWeight: '700',
      color: textPrimary
    },
    recentActivityTime: {
      fontSize: 10.5,
      color: textSecondary,
      marginTop: 1
    },
    screenMainTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: textPrimary
    },
    searchBarContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: cardBorder
    },
    searchBarInput: {
      flex: 1,
      fontSize: 13,
      color: textPrimary,
      padding: 0
    },
    filterPill: {
      paddingHorizontal: 16,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#e2e8f0'
    },
    filterPillActive: {
      backgroundColor: '#2563eb',
      borderColor: '#2563eb'
    },
    filterPillText: {
      fontSize: 12,
      fontWeight: '600',
      color: textSecondary
    },
    filterPillTextActive: {
      color: '#ffffff',
      fontWeight: '700'
    },
    empDirectoryCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: cardBg,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: cardBorder,
      shadowColor: isDark ? '#000000' : 'rgba(0,0,0,0.03)',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 1,
      shadowRadius: 3,
      elevation: 1
    },
    empAvatarCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center'
    },
    empAvatarInitial: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '800'
    },
    empCardName: {
      fontSize: 13.5,
      fontWeight: '700',
      color: textPrimary
    },
    empCardRole: {
      fontSize: 11,
      color: textSecondary,
      marginTop: 2
    },
    empStatusPill: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 12
    },
    empStatusPillText: {
      fontSize: 11,
      fontWeight: '600'
    },
    empStatusPillPresent: {
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7'
    },
    empStatusPillTextPresent: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? '#34d399' : '#15803d'
    },
    empStatusPillLeave: {
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7'
    },
    empStatusPillTextLeave: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? '#fbbf24' : '#b45309'
    },
    empStatusPillAbsent: {
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9'
    },
    empStatusPillTextAbsent: {
      fontSize: 11,
      fontWeight: '600',
      color: textSecondary
    },
    attendanceSubTabPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#e2e8f0'
    },
    attendanceSubTabPillActive: {
      backgroundColor: '#2563eb',
      borderColor: '#2563eb'
    },
    attendanceSubTabText: {
      fontSize: 11.5,
      fontWeight: '600',
      color: textSecondary
    },
    attendanceSubTabTextActive: {
      color: '#ffffff',
      fontWeight: '700'
    },
    weekStripContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 6
    },
    weekDayPill: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: cardBg,
      borderWidth: 1,
      borderColor: cardBorder
    },
    weekDayPillSelected: {
      backgroundColor: '#2563eb',
      borderColor: '#2563eb'
    },
    weekDayLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: textSecondary,
      marginBottom: 4
    },
    weekDayLabelSelected: {
      color: '#ffffff',
      fontWeight: '700'
    },
    weekDayNumber: {
      fontSize: 14,
      fontWeight: '800',
      color: textPrimary
    },
    weekDayNumberSelected: {
      color: '#ffffff'
    },
    attendanceMainCard: {
      backgroundColor: cardBg,
      borderRadius: 18,
      padding: 18,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: cardBorder,
      shadowColor: isDark ? '#000000' : 'rgba(0,0,0,0.05)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 6,
      elevation: 2
    },
    attendanceTimeSubtitle: {
      fontSize: 11,
      fontWeight: '600',
      color: textSecondary,
      marginBottom: 6
    },
    attendanceLargeClockText: {
      fontSize: 32,
      fontWeight: '900',
      color: textPrimary,
      letterSpacing: 1,
      marginBottom: 16
    },
    attendanceActionBtn: {
      width: '100%',
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#2563eb',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 3
    },
    attendanceActionBtnText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '800'
    },
    attendanceKpiBigNumber: {
      fontSize: 28,
      fontWeight: '900',
      color: textPrimary,
      marginTop: 2
    },
    attendanceKpiSubtext: {
      fontSize: 11,
      color: textSecondary,
      marginTop: 2
    },
    meetingReferenceCard: {
      backgroundColor: cardBg,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: cardBorder,
      shadowColor: isDark ? '#000000' : 'rgba(0,0,0,0.04)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: 1
    },
    meetingDeptBadge: {
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6
    },
    meetingDeptBadgeText: {
      fontSize: 9.5,
      fontWeight: '700',
      color: textSecondary,
      letterSpacing: 0.5
    },
    meetingStatusCompletedText: {
      fontSize: 11,
      fontWeight: '600',
      color: textSecondary
    },
    meetingReferenceTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: textPrimary,
      marginBottom: 4
    },
    meetingReferenceSubtitle: {
      fontSize: 11.5,
      color: textSecondary,
      marginBottom: 4
    },
    meetingReferenceOrganizer: {
      fontSize: 11,
      color: textSecondary,
      marginBottom: 12
    },
    meetingReferenceJoinBtn: {
      backgroundColor: '#2563eb',
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center'
    },
    meetingReferenceJoinBtnText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '700'
    },
    brandLogoSquare: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: '#2563eb',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8
    },
    brandLogoSquareText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '900'
    },
    headerIconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9'
    },
    headerNotifDot: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: '#ef4444'
    },
    fabButton: {
      position: 'absolute',
      bottom: 74,
      right: 18,
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: '#2563eb',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#2563eb',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 6
    },
    fabButtonText: {
      color: '#ffffff',
      fontSize: 26,
      fontWeight: '300',
      marginTop: -2
    },
    fabModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
      padding: 16
    },
    fabMenuContainer: {
      backgroundColor: cardBg,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: cardBorder,
      marginBottom: 60
    },
    fabMenuHeader: {
      fontSize: 14,
      fontWeight: '800',
      color: textPrimary,
      marginBottom: 12,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: cardBorder
    },
    fabMenuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#1e293b' : '#f1f5f9'
    },
    fabMenuIcon: {
      fontSize: 20
    },
    fabMenuLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: textPrimary
    },
    fabMenuSub: {
      fontSize: 10.5,
      color: textSecondary,
      marginTop: 1
    },
    themeToggleBtn: {
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#cbd5e1',
      alignItems: 'center',
      justifyContent: 'center'
    },
    themeOptionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: isDark ? '#07090e' : '#f1f5f9',
      borderWidth: 1,
      borderColor: isDark ? '#1e293b' : '#e2e8f0'
    },
    themeOptionBtnActive: {
      borderColor: '#38bdf8',
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.12)'
    },
    themeOptionText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: textSecondary
    },
    themeOptionTextActive: {
      color: '#0284c7'
    },
    clockCard: {
      backgroundColor: cardBg,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: cardBorder,
      shadowColor: isDark ? '#000000' : 'rgba(0,0,0,0.06)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 1,
      shadowRadius: 6,
      elevation: isDark ? 2 : 1
    },
    liveClockText: {
      fontSize: 24,
      fontWeight: '900',
      color: textPrimary,
      letterSpacing: 0.5
    },
    liveClockSub: {
      fontSize: 11,
      color: textSecondary,
      marginTop: 2
    },
    shiftStatusPill: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1
    },
    shiftStatusPillActive: {
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      borderColor: '#10b981'
    },
    shiftStatusPillInactive: {
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      borderColor: isDark ? '#334155' : '#cbd5e1'
    },
    shiftStatusPillText: {
      fontSize: 9,
      fontWeight: 'bold',
      color: textPrimary
    },
    elapsedBox: {
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: cardBorder,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    elapsedLabel: {
      fontSize: 11,
      color: textSecondary
    },
    elapsedValue: {
      fontSize: 13,
      fontWeight: 'bold',
      color: '#38bdf8'
    },
    pulseStatsGrid: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 10
    },
    pulseStatItem: {
      flex: 1,
      backgroundColor: bg,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: cardBorder,
      alignItems: 'center'
    },
    pulseStatValue: {
      fontSize: 16,
      fontWeight: '900',
      color: textPrimary
    },
    pulseStatLabel: {
      fontSize: 9,
      color: textSecondary,
      marginTop: 3,
      fontWeight: '600'
    },
    noticeCardCompact: {
      backgroundColor: bg,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: cardBorder
    },
    noticePriorityBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4
    },
    priorityUrgent: {
      backgroundColor: 'rgba(239, 68, 68, 0.2)',
      borderWidth: 1,
      borderColor: '#ef4444'
    },
    priorityHigh: {
      backgroundColor: 'rgba(245, 158, 11, 0.2)',
      borderWidth: 1,
      borderColor: '#f59e0b'
    },
    priorityNormal: {
      backgroundColor: 'rgba(56, 189, 248, 0.2)',
      borderWidth: 1,
      borderColor: '#38bdf8'
    },
    noticePriorityText: {
      fontSize: 8,
      fontWeight: '900',
      color: textPrimary
    },
    noticeCategoryText: {
      fontSize: 9,
      fontWeight: '700',
      color: textSecondary
    },
    noticeDateText: {
      fontSize: 9,
      color: textSecondary
    },
    noticeTitleCompact: {
      fontSize: 13,
      fontWeight: 'bold',
      color: textPrimary,
      marginTop: 2
    },
    noticeSnippet: {
      fontSize: 11,
      color: textSecondary,
      marginTop: 2,
      lineHeight: 16
    },
    noticeFooterRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: cardBorder
    },
    noticeAuthorText: {
      fontSize: 9,
      color: textSecondary
    },
    noticeTapText: {
      fontSize: 10,
      fontWeight: 'bold',
      color: '#38bdf8'
    },
    noticeFullContent: {
      fontSize: 13,
      color: textPrimary,
      lineHeight: 20
    },
    quickToolsGrid: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8
    },
    quickToolBtn: {
      flex: 1,
      backgroundColor: bg,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: cardBorder,
      alignItems: 'center'
    },
    quickToolIcon: {
      fontSize: 20,
      marginBottom: 4
    },
    quickToolLabel: {
      fontSize: 10,
      fontWeight: 'bold',
      color: textPrimary
    },
    chatChannelPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: bg,
      borderWidth: 1,
      borderColor: cardBorder
    },
    chatChannelPillActive: {
      backgroundColor: '#0284c7',
      borderColor: '#38bdf8'
    },
    chatChannelPillText: {
      fontSize: 11,
      fontWeight: '700',
      color: textSecondary
    },
    chatChannelPillTextActive: {
      color: '#ffffff'
    },
    chatActiveHeaderBox: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: cardBorder
    },
    chatActiveHeaderTitle: {
      fontSize: 13,
      fontWeight: 'bold',
      color: textPrimary
    },
    chatActiveHeaderSub: {
      fontSize: 10,
      color: textSecondary,
      marginTop: 1
    },
    chatMessageRow: {
      flexDirection: 'row',
      gap: 8,
      marginVertical: 2
    },
    chatMessageRowMe: {
      justifyContent: 'flex-end'
    },
    chatAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#0284c7',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    },
    chatAvatarText: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: 'bold'
    },
    chatSenderName: {
      fontSize: 11,
      fontWeight: 'bold',
      color: textPrimary
    },
    chatRolePill: {
      backgroundColor: bg,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: cardBorder
    },
    chatRolePillText: {
      fontSize: 8,
      fontWeight: 'bold',
      color: textSecondary
    },
    chatTimestamp: {
      fontSize: 9,
      color: textSecondary
    },
    chatBubble: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 14,
      maxWidth: '85%'
    },
    chatBubbleMe: {
      backgroundColor: '#0284c7',
      borderTopRightRadius: 2
    },
    chatBubbleOther: {
      backgroundColor: bg,
      borderTopLeftRadius: 2,
      borderWidth: 1,
      borderColor: cardBorder
    },
    chatBubbleText: {
      fontSize: 12,
      color: textPrimary,
      lineHeight: 18
    },
    chatBubbleTextMe: {
      color: '#ffffff'
    },
    chatComposerContainer: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      marginTop: 14,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: cardBorder
    },
    chatComposerInput: {
      flex: 1,
      backgroundColor: bg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: cardBorder,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: textPrimary,
      fontSize: 12,
      maxHeight: 80
    },
    chatSendBtn: {
      backgroundColor: '#0284c7',
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center'
    },
    chatSendBtnText: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: 'bold'
    },
  container: {
    flex: 1,
    backgroundColor: bg
  },
  loginContainer: {
    flex: 1,
    backgroundColor: bg,
    justifyContent: 'center',
    padding: 20
  },
  loginCard: {
    backgroundColor: cardBg,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: cardBorder,
    alignItems: 'center'
  },
  festiveLoginLogoContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  festiveLogoRing: {
    borderWidth: 2,
    borderColor: '#38bdf8',
    borderRadius: 20,
    padding: 3,
    backgroundColor: '#07090e'
  },
  festiveFloatingBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    elevation: 4
  },
  festiveFloatingBadgeEmoji: {
    fontSize: 13
  },
  festiveLoginPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 2
  },
  festiveLoginPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#f59e0b',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  festiveHeaderLogoContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center'
  },
  festiveHeaderLogoRing: {
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    borderRadius: 11,
    padding: 2,
    backgroundColor: '#07090e'
  },
  festiveHeaderBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffffff'
  },
  festiveHeaderBadgeEmoji: {
    fontSize: 9
  },
  festiveCardBanner: {
    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12
  },
  festiveCardBadge: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  festiveCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: textPrimary,
    marginTop: 1
  },
  festiveCardWish: {
    fontSize: 11,
    color: textSecondary,
    marginTop: 6,
    lineHeight: 16
  },
  festiveCloseBtn: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'
  },
  festiveCloseBtnText: {
    fontSize: 12,
    color: textSecondary,
    fontWeight: '700'
  },
  loginLogo: {
    width: 60,
    height: 60,
    borderRadius: 16
  },
  loginTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: textPrimary
  },
  loginSubtitle: {
    fontSize: 12,
    color: textSecondary,
    marginTop: 2,
    textAlign: 'center'
  },
  loginBrand: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38bdf8',
    marginTop: 4,
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: textSecondary,
    alignSelf: 'flex-start',
    marginBottom: 5,
    marginTop: 8
  },
  textInput: {
    width: '100%',
    backgroundColor: bg,
    borderColor: cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: textPrimary,
    fontSize: 12
  },
  loginBtn: {
    width: '100%',
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
    alignItems: 'center'
  },
  secText: {
    color: '#64748b',
    fontSize: 9
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: cardBorder
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  logoImage: {
    width: 32,
    height: 32,
    borderRadius: 8
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: textPrimary
  },
  brandAccent: {
    color: '#38bdf8'
  },
  brandSubtitle: {
    fontSize: 10,
    color: textSecondary,
    maxWidth: 160
  },
  superBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)'
  },
  superBadgeText: {
    fontSize: 8,
    color: '#38bdf8',
    fontWeight: 'bold'
  },
  switchOrgBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  switchOrgBtnText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: 'bold'
  },
  avatarHeaderBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#38bdf8'
  },
  avatarHeaderImg: {
    width: '100%',
    height: '100%'
  },
  avatarHeaderInitials: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold'
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 85
  },
  holidayAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12
  },
  holidayAlertTitle: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: 'bold'
  },
  holidayAlertSub: {
    color: textSecondary,
    fontSize: 10,
    marginTop: 2
  },
  alertBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12
  },
  alertBannerIcon: {
    fontSize: 16
  },
  alertBannerTitle: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: 'bold'
  },
  alertBannerText: {
    color: textSecondary,
    fontSize: 10,
    marginTop: 4,
    lineHeight: 15
  },
  alertActionBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  alertActionBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold'
  },
  card: {
    backgroundColor: cardBg,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: cardBorder,
    shadowColor: isDark ? '#000000' : 'rgba(0,0,0,0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.3 : 1,
    shadowRadius: 6,
    elevation: isDark ? 2 : 1
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: textPrimary
  },
  cardDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 12
  },
  statusBadge: {
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 8
  },
  statusBadgeInside: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)'
  },
  statusBadgeRemote: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)'
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold'
  },
  statusTextInside: {
    color: '#34d399'
  },
  statusTextRemote: {
    color: '#fbbf24'
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 10
  },
  metricBox: {
    flex: 1,
    backgroundColor: bg,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cardBorder
  },
  metricLabel: {
    fontSize: 9,
    color: '#64748b'
  },
  metricValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#38bdf8',
    marginTop: 2
  },
  punchButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginVertical: 6
  },
  punchButtonIn: {
    backgroundColor: '#0284c7'
  },
  punchButtonOut: {
    backgroundColor: '#dc2626'
  },
  punchButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800'
  },
  punchTimeText: {
    color: '#e2e8f0',
    fontSize: 10,
    marginTop: 3
  },
  actionBtnSecondary: {
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  actionBtnSecondaryText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: 'bold'
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: cardBorder
  },
  detailLabel: {
    color: '#64748b',
    fontSize: 11
  },
  detailVal: {
    color: textPrimary,
    fontSize: 11,
    maxWidth: 210,
    textAlign: 'right'
  },
  calNavBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#1e293b',
    borderRadius: 6
  },
  calNavBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: 'bold'
  },
  calMonthText: {
    color: textPrimary,
    fontSize: 12,
    fontWeight: 'bold'
  },
  calSummaryRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10
  },
  calSummaryBox: {
    flex: 1,
    backgroundColor: bg,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center'
  },
  calSummaryVal: {
    fontSize: 13,
    fontWeight: 'bold'
  },
  calSummaryLbl: {
    color: textSecondary,
    fontSize: 9,
    marginTop: 2
  },
  calDayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: bg,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: cardBorder
  },
  calDayRowToday: {
    borderColor: '#0284c7',
    backgroundColor: '#0d1527'
  },
  calDayBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  calDayNum: {
    color: textPrimary,
    fontSize: 11,
    fontWeight: 'bold'
  },
  calDayName: {
    color: textSecondary,
    fontSize: 8
  },
  calDateStr: {
    color: textPrimary,
    fontSize: 11,
    fontWeight: 'bold'
  },
  calStatusText: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600'
  },
  calRegBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8
  },
  calRegBtnText: {
    color: '#fbbf24',
    fontSize: 10,
    fontWeight: 'bold'
  },
  calApprovedBadge: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: '#06b6d4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  calApprovedBadgeText: {
    color: '#06b6d4',
    fontSize: 9,
    fontWeight: 'bold'
  },
  holidayCard: {
    backgroundColor: bg,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cardBorder
  },
  holidayName: {
    color: textPrimary,
    fontSize: 13,
    fontWeight: 'bold'
  },
  holidayDate: {
    color: '#38bdf8',
    fontSize: 10,
    marginTop: 2
  },
  holidayDesc: {
    color: textSecondary,
    fontSize: 10,
    marginTop: 4
  },
  todayHolBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4
  },
  todayHolBadgeText: {
    color: textPrimary,
    fontSize: 8,
    fontWeight: 'bold'
  },
  holTypeBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  holTypeBadgeText: {
    color: '#f59e0b',
    fontSize: 9,
    fontWeight: 'bold'
  },
  leaveBalanceRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 8
  },
  leaveBalanceBox: {
    flex: 1,
    backgroundColor: bg,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: cardBorder,
    alignItems: 'center'
  },
  leaveBalanceVal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#38bdf8'
  },
  leaveBalanceLbl: {
    fontSize: 9,
    color: textSecondary,
    marginTop: 2
  },
  leaveItemCard: {
    backgroundColor: bg,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: cardBorder
  },
  leaveTypeHeader: {
    color: textPrimary,
    fontSize: 11,
    fontWeight: 'bold'
  },
  leaveDateRange: {
    color: textSecondary,
    fontSize: 10,
    marginTop: 2
  },
  leaveReasonText: {
    color: textSecondary,
    fontSize: 10,
    marginTop: 3,
    fontStyle: 'italic'
  },
  leaveStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  leaveStatusText: {
    fontSize: 8,
    fontWeight: 'bold'
  },
  statusApproved: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981'
  },
  statusRejected: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444'
  },
  statusPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b'
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4
  },
  filterTab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: bg,
    borderWidth: 1,
    borderColor: cardBorder,
    alignItems: 'center'
  },
  filterTabActive: {
    borderColor: '#38bdf8',
    backgroundColor: '#0f172a'
  },
  filterTabText: {
    color: textSecondary,
    fontSize: 10
  },
  filterTabTextActive: {
    color: '#38bdf8',
    fontWeight: 'bold'
  },
  approvalItemCard: {
    backgroundColor: bg,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cardBorder
  },
  approvalEmpName: {
    color: textPrimary,
    fontSize: 12,
    fontWeight: 'bold'
  },
  approvalEmpRole: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: 'bold'
  },
  approvalReason: {
    color: textSecondary,
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 4
  },
  approvalMeta: {
    color: '#64748b',
    fontSize: 9,
    marginTop: 4
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center'
  },
  approveBtn: {
    backgroundColor: '#059669'
  },
  rejectBtn: {
    backgroundColor: '#dc2626'
  },
  btnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold'
  },
  noticeCard: {
    backgroundColor: bg,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cardBorder
  },
  noticeTitle: {
    color: textPrimary,
    fontSize: 12,
    fontWeight: 'bold'
  },
  noticeBody: {
    color: textSecondary,
    fontSize: 10,
    marginTop: 4,
    lineHeight: 14
  },
  noticeDate: {
    color: '#64748b',
    fontSize: 9,
    marginTop: 5
  },
  priorityTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  priorityCritical: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)'
  },
  priorityTagHigh: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)'
  },
  priorityText: {
    color: '#f87171',
    fontSize: 8,
    fontWeight: 'bold'
  },
  meetingCard: {
    backgroundColor: bg,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cardBorder
  },
  meetingTitle: {
    color: textPrimary,
    fontSize: 13,
    fontWeight: 'bold'
  },
  meetingMeta: {
    color: textSecondary,
    fontSize: 10,
    marginTop: 4
  },
  meetingHost: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2
  },
  meetingStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  statusScheduled: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38bdf8'
  },
  statusCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981'
  },
  meetingStatusText: {
    color: '#38bdf8',
    fontSize: 8,
    fontWeight: 'bold'
  },
  meetingActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: navBorder
  },
  joinMeetBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center'
  },
  joinMeetBtnText: {
    color: textPrimary,
    fontSize: 11,
    fontWeight: 'bold'
  },
  profileHeaderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10
  },
  profileAvatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#38bdf8'
  },
  profileAvatarLargeImg: {
    width: '100%',
    height: '100%'
  },
  profileAvatarLargeText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold'
  },
  profileName: {
    color: textPrimary,
    fontSize: 16,
    fontWeight: 'bold'
  },
  profileDesig: {
    color: textSecondary,
    fontSize: 11,
    marginTop: 2
  },
  profileRoleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4
  },
  profileRoleBadgeText: {
    color: '#38bdf8',
    fontSize: 9,
    fontWeight: 'bold'
  },
  editProfileBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 6
  },
  editProfileBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: 'bold'
  },
  teamCard: {
    backgroundColor: bg,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: cardBorder
  },
  teamName: {
    color: textPrimary,
    fontSize: 12,
    fontWeight: 'bold'
  },
  teamDesig: {
    color: textSecondary,
    fontSize: 10,
    marginTop: 1
  },
  teamEmail: {
    color: '#64748b',
    fontSize: 9,
    marginTop: 1
  },
  teamJoining: {
    color: '#38bdf8',
    fontSize: 9,
    marginTop: 2
  },
  teamManager: {
    color: '#f59e0b',
    fontSize: 9,
    marginTop: 1
  },
  rolePill: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  rolePillText: {
    color: '#38bdf8',
    fontSize: 8,
    fontWeight: 'bold'
  },
  editJoiningBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38bdf8'
  },
  editJoiningBtnText: {
    color: '#38bdf8',
    fontSize: 8,
    fontWeight: 'bold'
  },
  standupFeedItem: {
    backgroundColor: bg,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: cardBorder
  },
  standupAuthor: {
    color: textPrimary,
    fontSize: 11,
    fontWeight: 'bold'
  },
  standupDate: {
    color: '#64748b',
    fontSize: 9
  },
  standupText: {
    color: textSecondary,
    fontSize: 10,
    marginTop: 3
  },
  verifyActionBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 10
  },
  verifyActionBtnText: {
    color: textPrimary,
    fontSize: 11,
    fontWeight: 'bold'
  },
  verifySuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)'
  },
  verifySuccessTitle: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: 'bold'
  },
  verifySuccessSub: {
    color: '#e2e8f0',
    fontSize: 10,
    marginTop: 2
  },
  verifySuccessSerial: {
    color: '#64748b',
    fontSize: 9,
    marginTop: 2
  },
  verifyFail: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)'
  },
  verifyFailText: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: 'bold'
  },
  payGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 8
  },
  payItem: {
    width: '48%',
    backgroundColor: bg,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: cardBorder
  },
  payLabel: {
    color: '#64748b',
    fontSize: 9
  },
  payVal: {
    color: textPrimary,
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2
  },
  profileLogoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20
  },
  profileLogoutBtnText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: 'bold'
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: bg,
    borderTopWidth: 1,
    borderTopColor: navBorder,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    flex: 1
  },
  navItemActive: {
    borderTopWidth: 2,
    borderTopColor: '#38bdf8'
  },
  navIcon: {
    fontSize: 16
  },
  navLabel: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2
  },
  navLabelActive: {
    color: '#38bdf8',
    fontWeight: 'bold'
  },
  navBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2
  },
  navBadgeText: {
    color: textPrimary,
    fontSize: 8,
    fontWeight: 'bold'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalCard: {
    width: '100%',
    backgroundColor: cardBg,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: cardBorder
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: textPrimary
  },
  modalSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 10
  },
  modalCloseBtn: {
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 6
  },
  modalCloseBtnText: {
    color: textSecondary,
    fontSize: 11
  },
  orgSelectItem: {
    backgroundColor: bg,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: cardBorder,
    marginBottom: 6
  },
  orgSelectItemActive: {
    borderColor: '#38bdf8'
  },
  orgSelectName: {
    color: textPrimary,
    fontSize: 12,
    fontWeight: 'bold'
  },
  orgSelectCode: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 1
  },
  indPill: {
    backgroundColor: bg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: cardBorder
  },
  indPillActive: {
    borderColor: '#38bdf8',
    backgroundColor: '#0f172a'
  },
  indPillText: {
    color: textSecondary,
    fontSize: 10
  },
  indPillTextActive: {
    color: '#38bdf8',
    fontWeight: 'bold'
  },
  smallAddBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  smallAddBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold'
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  notifHeaderBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
    borderWidth: 1,
    borderColor: isDark ? '#334155' : '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3
  },
  notifBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold'
  },
  notifItem: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: subtleBg,
    borderWidth: 1,
    borderColor: cardBorder,
    marginBottom: 8
  },
  notifItemTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: textPrimary,
    flex: 1
  },
  notifItemMsg: {
    fontSize: 11,
    color: textSecondary,
    marginTop: 2,
    lineHeight: 16
  },
  notifUnreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#38bdf8',
    marginLeft: 6
  },
  notifCategory: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: textMuted
  },
  notifTimestamp: {
    fontSize: 10,
    color: textMuted
  },
  calEmpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: cardBg,
    borderWidth: 1,
    borderColor: cardBorder,
    marginRight: 6
  },
  calEmpPillActive: {
    backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.12)',
    borderColor: '#38bdf8'
  },
  calEmpPillAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  calEmpPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: textSecondary
  },
  calEmpPillTextActive: {
    color: isDark ? '#38bdf8' : '#0284c7',
    fontWeight: 'bold'
  },
  userProfileHeader: {
    alignItems: 'center',
    paddingVertical: 14,
    width: '100%'
  },
  userProfileAvatarLg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 3,
    borderColor: '#38bdf8',
    overflow: 'hidden'
  },
  userProfileName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: textPrimary
  },
  userProfileDesig: {
    fontSize: 12,
    color: textSecondary,
    marginTop: 2
  },
  userProfileRoleBadge: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.12)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(2, 132, 199, 0.25)'
  }
});
}
