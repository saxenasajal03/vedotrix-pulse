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

  // Bottom Navigation Tabs: 'punch' | 'chat' | 'calendar' | 'leaves' | 'approvals' | 'notices' | 'hub'
  const [activeTab, setActiveTab] = useState<'punch' | 'chat' | 'calendar' | 'leaves' | 'approvals' | 'notices' | 'hub'>('punch');

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

  // Theme & Auto-Update States
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);

  // Subtabs within views
  const [calSubTab, setCalSubTab] = useState<'attendance' | 'holidays'>('attendance');
  const [noticesSubTab, setNoticesSubTab] = useState<'notices' | 'meetings'>('notices');
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
  const todayHoliday = useMemo(() => holidays.find((h) => h.date === todayStr), [holidays, todayStr]);
  const isWeekOffToday = useMemo(() => {
    const nowISTDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const todayDayOfWeek = nowISTDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const weekOffDays: number[] = currentOrg?.settings?.weekOffDays || [0];
    return weekOffDays.includes(todayDayOfWeek);
  }, [currentOrg]);

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
  const [standupHours, setStandupHours] = useState('8');
  const [isSavingStandup, setIsSavingStandup] = useState(false);

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
  const [editEmpRole, setEditEmpRole] = useState('employee');
  const [editEmpDesig, setEditEmpDesig] = useState('');
  const [editEmpDept, setEditEmpDept] = useState('');
  const [editEmpJoining, setEditEmpJoining] = useState('');
  const [editEmpPasswordReset, setEditEmpPasswordReset] = useState('');
  const [isSavingEmpRecord, setIsSavingEmpRecord] = useState(false);

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

  // Dynamic Theme-Dependent Styles
  const styles = useMemo(() => createThemedStyles(isDarkMode), [isDarkMode]);

  // Load saved theme & notification read states on mount
  useEffect(() => {
    AsyncStorage.getItem('@vdx_theme_mode')
      .then((savedTheme) => {
        if (savedTheme === 'light') {
          setIsDarkMode(false);
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
          await Updates.fetchUpdateAsync();
          Alert.alert(
            'App Update Ready 🚀',
            'A new version of Vedotrix Pulse was downloaded in the background. Apply update now?',
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Update Now', onPress: () => Updates.reloadAsync() }
            ]
          );
        }
      } catch {}
    }
    checkAutoUpdates();
  }, []);

  const handleToggleTheme = async () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    try {
      await AsyncStorage.setItem('@vdx_theme_mode', next ? 'dark' : 'light');
    } catch {}
  };

  const handleSetTheme = async (dark: boolean) => {
    setIsDarkMode(dark);
    try {
      await AsyncStorage.setItem('@vdx_theme_mode', dark ? 'dark' : 'light');
    } catch {}
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
          const isVedotrixOrg = targetOrgId === '00000000-0000-0000-0000-000000000001';
          const filteredProfiles = profiles.filter((p) => {
            const email = p.email?.toLowerCase();
            const isSajalRootSuperadmin =
              p.id === '00000000-0000-0000-0000-000000000003' ||
              p.id === '00000000-0000-0000-0000-000000000004' ||
              email === 'admin@vedotrix.com' ||
              email === 'sajalsaxenagola@gmail.com';

            // In Vedotrix organization ONLY: Do NOT count Sajal who is superadmin / root platform controller
            if (isVedotrixOrg && isSajalRootSuperadmin) {
              return false;
            }

            // In ALL OTHER organizations: ANY superadmin (even named Sajal) belonging to that organization IS SHOWN & COUNTED!
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
          const isVedotrixOrg = targetOrgId === '00000000-0000-0000-0000-000000000001';
          const filteredAtt = att.filter((a) => {
            // In Vedotrix organization ONLY: do not count root superadmin attendance
            if (isVedotrixOrg && (a.employee_id === '00000000-0000-0000-0000-000000000003' || a.employee_id === '00000000-0000-0000-0000-000000000004')) {
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

      // 9. Daily Standups
      if (targetOrgId) {
        const { data: st } = await client
          .from('standups')
          .select('*')
          .eq('org_id', targetOrgId)
          .order('date', { ascending: false });
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
          (a.check_in_time || a.status === 'present' || a.status === 'regularized' || a.regularization_status === 'approved')
      ) || isCheckedIn;

      if (!hasMarked) {
        setAttendanceAlertActive(true);
        const timeStr = getISTTimeString(now);
        const [h, m] = timeStr.split(':').map(Number);
        const currentTotalMins = (h || 0) * 60 + (m || 0);

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
        Alert.alert('Database Error', error.message);
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
        const { error } = await supabaseClient
          .from('attendance')
          .update({
            regularization_reason: fullReason,
            regularization_status: 'pending',
            approval_status: 'pending_manager_approval'
          })
          .eq('id', existing.id);

        if (error) throw error;
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
      const { error } = await supabaseClient.from('standups').insert({
        id: newId,
        employee_id: userProfile.id,
        org_id: currentOrg?.id || userProfile.org_id,
        date: getTodayISTDate(),
        completed_today: standupDone.trim(),
        planned_tomorrow: standupNext.trim(),
        blockers: standupBlockers.trim() || null,
        hours_logged: Number(standupHours) || 8
      });

      if (!error) {
        Alert.alert('EOD Standup Logged 🚀', 'Your daily accomplishment is saved to cloud.');
        setIsStandupModal(false);
        setStandupDone('');
        setStandupNext('');
        setStandupBlockers('');
        refreshAllData(supabaseClient, currentOrg?.id, userProfile.id);
      } else {
        Alert.alert('Error', error.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    } finally {
      setIsSavingStandup(false);
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

  // Today Team Presence Counts
  const todayPresentCount = useMemo(() => {
    const today = getTodayISTDate();
    return attendanceRecords.filter((a) => a.date === today && a.status === 'present').length;
  }, [attendanceRecords]);

  const todayOnLeaveCount = useMemo(() => {
    const today = getTodayISTDate();
    return leaveRequests.filter(
      (l) => l.status === 'approved' && l.start_date <= today && l.end_date >= today
    ).length;
  }, [leaveRequests]);


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

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.festiveHeaderLogoContainer}>
            <View
              style={[
                styles.festiveHeaderLogoRing,
                activeFestival.id !== 'none' && { borderColor: activeFestival.primaryColor }
              ]}
            >
              <Image source={activeAppIcon} style={styles.logoImage} resizeMode="cover" />
            </View>
            {activeFestival.id !== 'none' && (
              <View style={[styles.festiveHeaderBadge, { backgroundColor: activeFestival.primaryColor }]}>
                <Text style={styles.festiveHeaderBadgeEmoji}>{activeFestival.iconSymbol}</Text>
              </View>
            )}
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.brandTitle}>
                Vedotrix <Text style={styles.brandAccent}>Pulse</Text>
              </Text>
              {activeFestival.id !== 'none' ? (
                <View style={[styles.superBadge, { backgroundColor: `${activeFestival.primaryColor}25`, borderColor: activeFestival.primaryColor }]}>
                  <Text style={[styles.superBadgeText, { color: activeFestival.primaryColor }]}>
                    {activeFestival.iconSymbol} {activeFestival.shortLabel.toUpperCase()}
                  </Text>
                </View>
              ) : isVedotrixSuperadmin && (
                <View style={styles.superBadge}>
                  <Text style={styles.superBadgeText}>SUPER</Text>
                </View>
              )}
            </View>
            <Text style={styles.brandSubtitle} numberOfLines={1}>
              {currentOrg ? currentOrg.name : 'Organization'} • {userProfile?.role?.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity
            style={styles.notifHeaderBtn}
            onPress={() => setIsNotifModal(true)}
            accessibilityLabel="In-app Notifications"
          >
            <Text style={{ fontSize: 15 }}>🔔</Text>
            {unreadNotifCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.themeToggleBtn}
            onPress={handleToggleTheme}
            accessibilityLabel="Toggle Light/Dark Theme"
          >
            <Text style={{ fontSize: 14 }}>{isDarkMode ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>

          {isVedotrixSuperadmin && (
            <TouchableOpacity style={styles.switchOrgBtn} onPress={() => setIsOrgModalVisible(true)}>
              <Text style={styles.switchOrgBtnText}>🏢 Switch</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.avatarHeaderBtn}
            onPress={() => {
              setActiveTab('hub');
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
        {/* 1. DASHBOARD & SMART PUNCH TAB (OVERHAULED FIRST PAGE) */}
        {/* ========================================================================= */}
        {activeTab === 'punch' && (
          <View style={{ gap: 14 }}>
            {/* Realtime Live Clock & Shift Tracker Card */}
            <View style={styles.clockCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                  <Text style={styles.liveClockText}>{liveClockTime}</Text>
                  <Text style={styles.liveClockSub}>
                    {new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })} IST
                  </Text>
                </View>
                <View style={[
                  styles.shiftStatusPill,
                  (todayHoliday || isWeekOffToday)
                    ? { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#f59e0b' }
                    : (isCheckedIn || todayAttendanceRecord)
                    ? styles.shiftStatusPillActive
                    : styles.shiftStatusPillInactive
                ]}>
                  <Text style={[
                    styles.shiftStatusPillText,
                    (todayHoliday || isWeekOffToday) && { color: '#f59e0b' }
                  ]}>
                    {todayHoliday
                      ? '🌴 HOLIDAY (LOCKED)'
                      : isWeekOffToday
                      ? '☕ WEEK OFF (LOCKED)'
                      : (isCheckedIn || todayAttendanceRecord)
                      ? '✓ PRESENT (LOGGED)'
                      : '⚪ READY TO PUNCH'}
                  </Text>
                </View>
              </View>

              {/* Verified Single Punch-In Display (NO ticking running stopwatch) */}
              {(isCheckedIn || todayAttendanceRecord) && (
                <View style={[styles.elapsedBox, { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                  <Text style={[styles.elapsedLabel, { color: '#10b981' }]}>Single Punch Verified:</Text>
                  <Text style={[styles.elapsedValue, { color: '#10b981' }]}>
                    ✓ Punched in at {todayAttendanceRecord?.check_in_time ? formatISTTimeOnly(todayAttendanceRecord.check_in_time) : (checkInTime || 'Recorded')} IST
                  </Text>
                </View>
              )}
            </View>

            {/* Geo-Fenced Smart Punch Card */}
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.cardTitle}>Geo-Fenced Smart Punch</Text>
                <TouchableOpacity onPress={requestLocationPermission} style={{ padding: 4 }}>
                  <Text style={{ color: '#38bdf8', fontSize: 11, fontWeight: 'bold' }}>↻ Sync GPS</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.cardDesc}>
                Office: {activeOfficeCoords.name} • Shift: {currentOrg?.settings?.shiftStartTime || '09:30'} - {currentOrg?.settings?.shiftEndTime || '19:00'} IST
              </Text>

              <View style={[styles.statusBadge, isInside ? styles.statusBadgeInside : styles.statusBadgeRemote]}>
                <Text style={[styles.statusText, isInside ? styles.statusTextInside : styles.statusTextRemote]}>
                  {isInside ? '● INSIDE OFFICE GEOFENCE' : '▲ REMOTE / FIELD LOCATION'}
                </Text>
              </View>

              <View style={styles.metricRow}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Distance to Office</Text>
                  <Text style={styles.metricValue}>
                    {distance !== null ? `${distance} m` : '--'}
                  </Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Geofence Radius</Text>
                  <Text style={styles.metricValue}>
                    {activeOfficeCoords.radiusMeters} m
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.punchButton,
                  (todayHoliday || isWeekOffToday)
                    ? { backgroundColor: '#1e293b', borderColor: '#475569', opacity: 0.85 }
                    : todayAttendanceRecord?.approval_status === 'pending_manager_approval'
                    ? { backgroundColor: '#d97706', borderColor: '#f59e0b' }
                    : (isCheckedIn || todayAttendanceRecord)
                    ? { backgroundColor: '#059669', borderColor: '#10b981' }
                    : styles.punchButtonIn
                ]}
                onPress={handlePunchToggle}
                disabled={Boolean(todayHoliday || isWeekOffToday)}
              >
                <Text style={styles.punchButtonText}>
                  {todayHoliday
                    ? `🔒 ATTENDANCE LOCKED: ${todayHoliday.name.toUpperCase()}`
                    : isWeekOffToday
                    ? '🔒 ATTENDANCE LOCKED: WEEKLY OFF'
                    : todayAttendanceRecord?.approval_status === 'pending_manager_approval'
                    ? '⏳ ATTENDANCE PENDING APPROVAL'
                    : (isCheckedIn || todayAttendanceRecord)
                    ? '✓ ATTENDANCE RECORDED (PRESENT)'
                    : 'PUNCH IN (MARK PRESENT)'}
                </Text>
                {todayHoliday ? (
                  <Text style={styles.punchTimeText}>Official Holiday • Attendance is locked</Text>
                ) : isWeekOffToday ? (
                  <Text style={styles.punchTimeText}>Weekly Rest Day • Attendance is locked</Text>
                ) : todayAttendanceRecord?.approval_status === 'pending_manager_approval' ? (
                  <Text style={styles.punchTimeText}>
                    Punched in at {todayAttendanceRecord?.check_in_time ? formatISTTimeOnly(todayAttendanceRecord.check_in_time) : (checkInTime || 'Recorded')} (Remote) • Awaiting Manager/HR Approval
                  </Text>
                ) : (isCheckedIn || todayAttendanceRecord) ? (
                  <Text style={styles.punchTimeText}>
                    Punched in at {todayAttendanceRecord?.check_in_time ? formatISTTimeOnly(todayAttendanceRecord.check_in_time) : (checkInTime || 'Recorded')} • Single Punch Active
                  </Text>
                ) : checkInTime ? (
                  <Text style={styles.punchTimeText}>{checkInTime}</Text>
                ) : null}
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                {/* Don't show regularize when attendance already marked for today or on holidays/weekoffs */}
                {!(isCheckedIn || todayAttendanceRecord || todayHoliday || isWeekOffToday) && (
                  <TouchableOpacity
                    style={[styles.actionBtnSecondary, { flex: 1 }]}
                    onPress={() => {
                      setRegTargetDate(getTodayISTDate());
                      setIsRegModal(true);
                    }}
                  >
                    <Text style={styles.actionBtnSecondaryText}>✍️ Regularize Attendance</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionBtnSecondary, { flex: 1 }]}
                  onPress={() => {
                    setLeaveStartDate(getTodayISTDate());
                    setLeaveEndDate(getTodayISTDate());
                    setIsLeaveModal(true);
                  }}
                >
                  <Text style={styles.actionBtnSecondaryText}>🌴 Apply For Leave</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Today's Punch Details if available */}
            {todayAttendanceRecord && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Today's Attendance Punch</Text>
                <Text style={styles.cardDesc}>Cloud attendance log for {todayStr}</Text>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Check-In Time:</Text>
                  <Text style={styles.detailVal}>
                    {todayAttendanceRecord.check_in_time
                      ? formatISTTimeOnly(todayAttendanceRecord.check_in_time)
                      : '--'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Punch Model:</Text>
                  <Text style={[styles.detailVal, { color: '#10b981', fontWeight: 'bold' }]}>
                    Single Punch-In (No checkout required)
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Attendance Status:</Text>
                  <Text style={[styles.detailVal, { color: todayAttendanceRecord.status === 'present' ? '#10b981' : '#f59e0b', fontWeight: 'bold' }]}>
                    {todayAttendanceRecord.status?.toUpperCase() || 'LOGGED'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Geofence Verification:</Text>
                  <Text style={styles.detailVal}>
                    {todayAttendanceRecord.is_remote ? 'Remote / Field' : 'In-Office HQ'} ({todayAttendanceRecord.distance_meters || 0}m)
                  </Text>
                </View>

                {(todayAttendanceRecord.regularization_notes || todayAttendanceRecord.approval_notes || todayAttendanceRecord.regularization_reason || todayAttendanceRecord.regularization_status === 'approved' || todayAttendanceRecord.approval_status === 'approved') && (
                  <View style={{ marginTop: 10, padding: 10, backgroundColor: isDarkMode ? '#1e293b' : '#f0fdf4', borderRadius: 8, borderWidth: 1, borderColor: (todayAttendanceRecord.regularization_status === 'approved' || todayAttendanceRecord.approval_status === 'approved') ? '#10b98140' : '#f59e0b40' }}>
                    <Text style={{ fontSize: 10, color: (todayAttendanceRecord.regularization_status === 'approved' || todayAttendanceRecord.approval_status === 'approved') ? '#10b981' : '#f59e0b', fontWeight: 'bold' }}>
                      {(todayAttendanceRecord.regularization_status === 'approved' || todayAttendanceRecord.approval_status === 'approved') ? '✅ REGULARIZATION APPROVED' : '⏳ REGULARIZATION PENDING'}
                    </Text>
                    {(todayAttendanceRecord.regularization_notes || todayAttendanceRecord.approval_notes) && (
                      <View style={{ marginTop: 4 }}>
                        <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: 'bold' }}>APPROVAL NOTE:</Text>
                        <Text style={{ fontSize: 12, color: isDarkMode ? '#f8fafc' : '#0f172a', marginTop: 1, fontWeight: '600' }}>
                          {todayAttendanceRecord.regularization_notes || todayAttendanceRecord.approval_notes}
                        </Text>
                      </View>
                    )}
                    {todayAttendanceRecord.regularization_reason && todayAttendanceRecord.regularization_reason !== (todayAttendanceRecord.regularization_notes || todayAttendanceRecord.approval_notes) && (
                      <View style={{ marginTop: 4 }}>
                        <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: 'bold' }}>REQUEST REASON:</Text>
                        <Text style={{ fontSize: 11, color: isDarkMode ? '#cbd5e1' : '#475569', marginTop: 1 }}>
                          {todayAttendanceRecord.regularization_reason}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Today's Organization Pulse Overview */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Today's Organization Pulse</Text>
              <Text style={styles.cardDesc}>Real-time presence metrics across {currentOrg?.name || 'Company'}</Text>

              <View style={styles.pulseStatsGrid}>
                <View style={styles.pulseStatItem}>
                  <Text style={styles.pulseStatValue}>{teamProfiles.length}</Text>
                  <Text style={styles.pulseStatLabel}>👥 Total Team</Text>
                </View>
                <View style={styles.pulseStatItem}>
                  <Text style={[styles.pulseStatValue, { color: '#10b981' }]}>{todayPresentCount}</Text>
                  <Text style={styles.pulseStatLabel}>✅ Present</Text>
                </View>
                <View style={styles.pulseStatItem}>
                  <Text style={[styles.pulseStatValue, { color: '#f59e0b' }]}>{todayOnLeaveCount}</Text>
                  <Text style={styles.pulseStatLabel}>🌴 On Leave</Text>
                </View>
                <View style={styles.pulseStatItem}>
                  <Text style={[styles.pulseStatValue, { color: '#38bdf8' }]}>{totalPendingApprovals}</Text>
                  <Text style={styles.pulseStatLabel}>⏳ Approvals</Text>
                </View>
              </View>
            </View>

            {/* 📹 TODAY'S SCHEDULED MEETINGS (DASHBOARD FIRST PAGE) */}
            {(() => {
              const todayMeetings = meetings.filter((m) => m.date === todayStr);
              return (
                <View style={styles.card}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 16 }}>📹</Text>
                      <Text style={styles.cardTitle}>Today's Meetings ({todayMeetings.length})</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {canApprove && (
                        <TouchableOpacity
                          style={styles.smallAddBtn}
                          onPress={() => setIsMeetingModal(true)}
                        >
                          <Text style={styles.smallAddBtnText}>+ Schedule</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => {
                          setActiveTab('notices');
                          setNoticesSubTab('meetings');
                        }}
                      >
                        <Text style={{ color: '#38bdf8', fontSize: 11, fontWeight: 'bold' }}>All Meetings →</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.cardDesc}>Video calls, syncs & daily standups scheduled for today</Text>

                  {todayMeetings.length === 0 ? (
                    <View style={{ paddingVertical: 14, alignItems: 'center', backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderRadius: 12, marginTop: 6, borderWidth: 1, borderColor: isDarkMode ? '#1e293b' : '#e2e8f0' }}>
                      <Text style={{ fontSize: 20, marginBottom: 4 }}>🗓️</Text>
                      <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600' }}>No meetings scheduled for today</Text>
                      <Text style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>Your calendar is clear to focus on work</Text>
                    </View>
                  ) : (
                    <View style={{ gap: 8, marginTop: 6 }}>
                      {todayMeetings.map((m) => {
                        const meetUrl = m.meeting_url || m.meetingUrl || 'https://meet.google.com/new';
                        return (
                          <View key={m.id} style={[styles.meetingCard, { marginVertical: 0 }]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text style={styles.meetingTitle}>{m.title}</Text>
                                <Text style={styles.meetingMeta}>
                                  ⏰ {m.start_time || m.startTime} - {m.end_time || m.endTime || '1 hr'} IST
                                </Text>
                                <Text style={styles.meetingHost}>
                                  Host: <Text style={{ color: '#38bdf8' }}>{m.organizer_name || 'Organizer'}</Text> • Dept: {m.department || 'All'}
                                </Text>
                              </View>
                              <View style={[styles.meetingStatusBadge, m.status === 'completed' ? styles.statusCompleted : styles.statusScheduled]}>
                                <Text style={styles.meetingStatusText}>{m.status?.toUpperCase() || 'TODAY'}</Text>
                              </View>
                            </View>

                            <View style={[styles.meetingActionsRow, { marginTop: 8 }]}>
                              <TouchableOpacity
                                style={styles.joinMeetBtn}
                                onPress={() => Linking.openURL(meetUrl).catch(() => Alert.alert('Link Error', 'Could not open URL: ' + meetUrl))}
                              >
                                <Text style={styles.joinMeetBtnText}>🎥 Join Video Call</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })()}

            {/* 📢 FEATURED COMPANY NOTICES & BROADCASTS DIRECTLY ON FIRST PAGE */}
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16 }}>📢</Text>
                  <Text style={styles.cardTitle}>Company Announcements</Text>
                </View>
                {isPrivileged && (
                  <TouchableOpacity
                    style={styles.smallAddBtn}
                    onPress={() => setIsNoticeModal(true)}
                  >
                    <Text style={styles.smallAddBtnText}>+ Post</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.cardDesc}>Official circulars and announcements from management</Text>

              {notices.length === 0 ? (
                <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ color: '#94a3b8', fontSize: 12 }}>No company announcements published yet.</Text>
                </View>
              ) : (
                <View style={{ gap: 8, marginTop: 4 }}>
                  {notices.slice(0, 3).map((notice) => (
                    <TouchableOpacity
                      key={notice.id}
                      style={styles.noticeCardCompact}
                      onPress={() => setSelectedNoticeForView(notice)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                          <View style={[
                            styles.noticePriorityBadge,
                            notice.priority === 'urgent' ? styles.priorityUrgent :
                            notice.priority === 'high' ? styles.priorityHigh : styles.priorityNormal
                          ]}>
                            <Text style={styles.noticePriorityText}>{(notice.priority || 'NORMAL').toUpperCase()}</Text>
                          </View>
                          <Text style={styles.noticeCategoryText}>• {notice.category?.toUpperCase() || 'GENERAL'}</Text>
                        </View>
                        <Text style={styles.noticeDateText}>{formatNoticeDate(notice)}</Text>
                      </View>

                      <Text style={styles.noticeTitleCompact} numberOfLines={1}>
                        {notice.title}
                      </Text>
                      <Text style={styles.noticeSnippet} numberOfLines={2}>
                        {notice.content}
                      </Text>

                      <View style={styles.noticeFooterRow}>
                        <Text style={styles.noticeAuthorText}>By {notice.author_name || 'HR Team'} ({notice.author_role || 'Management'})</Text>
                        <Text style={styles.noticeTapText}>Read Full Notice →</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Upcoming Next Holiday Highlight Card */}
            {(() => {
              const upcoming = holidays.find((h) => h.date >= todayStr);
              if (!upcoming) return null;
              return (
                <View style={[styles.card, { borderColor: '#f59e0b' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.cardTitle, { color: '#fbbf24' }]}>🌴 Next Official Holiday</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setActiveTab('calendar');
                        setCalSubTab('holidays');
                      }}
                    >
                      <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: 'bold' }}>All Holidays →</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: 'bold', marginTop: 6 }}>
                    {upcoming.name}
                  </Text>
                  <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
                    📅 {formatDisplayDate(upcoming.date)} • {upcoming.description}
                  </Text>
                </View>
              );
            })()}

            {/* Quick Tools & Shortcuts Grid */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Quick Navigation & Shortcuts</Text>
              <Text style={styles.cardDesc}>Instant access to core company modules</Text>

              <View style={styles.quickToolsGrid}>
                <TouchableOpacity
                  style={styles.quickToolBtn}
                  onPress={() => setActiveTab('chat')}
                >
                  <Text style={styles.quickToolIcon}>💬</Text>
                  <Text style={styles.quickToolLabel}>Team Chat</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickToolBtn}
                  onPress={() => {
                    setActiveTab('hub');
                    setHubSubTab('team');
                  }}
                >
                  <Text style={styles.quickToolIcon}>👥</Text>
                  <Text style={styles.quickToolLabel}>Directory</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickToolBtn}
                  onPress={() => {
                    setActiveTab('calendar');
                    setCalSubTab('attendance');
                  }}
                >
                  <Text style={styles.quickToolIcon}>📅</Text>
                  <Text style={styles.quickToolLabel}>Calendar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickToolBtn}
                  onPress={() => setIsStandupModal(true)}
                >
                  <Text style={styles.quickToolIcon}>📝</Text>
                  <Text style={styles.quickToolLabel}>Standup</Text>
                </TouchableOpacity>
              </View>
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

        {/* 2. CALENDAR & HOLIDAYS TAB */}
        {/* ========================================================================= */}
        {activeTab === 'calendar' && (
          <View style={{ gap: 14 }}>
            <View style={styles.card}>
              {/* Subtab Toggle: Attendance vs Holiday Calendar */}
              <View style={styles.filterRow}>
                <TouchableOpacity
                  style={[styles.filterTab, calSubTab === 'attendance' && styles.filterTabActive]}
                  onPress={() => setCalSubTab('attendance')}
                >
                  <Text style={[styles.filterTabText, calSubTab === 'attendance' && styles.filterTabTextActive]}>
                    📅 My Attendance
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterTab, calSubTab === 'holidays' && styles.filterTabActive]}
                  onPress={() => setCalSubTab('holidays')}
                >
                  <Text style={[styles.filterTabText, calSubTab === 'holidays' && styles.filterTabTextActive]}>
                    🌴 Holiday Calendar ({holidays.length})
                  </Text>
                </TouchableOpacity>
              </View>

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
                      let holidayCount = 0;

                      for (let d = 1; d <= daysInMonth; d++) {
                        const dStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
                        if (dStr > todayStr) continue;
                        if (dStr < joiningDateStr) continue;

                        const isHol = holidays.some((h) => h.date === dStr);
                        if (isHol) {
                          holidayCount++;
                          continue;
                        }

                        const dayOfWeek = new Date(selectedCalYear, selectedCalMonth - 1, d).getDay();
                        if (dayOfWeek === 0) continue; // Sunday

                        const punch = attendanceRecords.find(
                          (a) => a.employee_id === targetEmpId && a.date === dStr
                        );

                        if (punch?.status === 'present' || punch?.check_in_time) {
                          present++;
                        } else if (punch?.status === 'regularized' || punch?.regularization_status === 'approved') {
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
                          const isSunday = dayOfWeek === 0;
                          const isFuture = dStr > todayStr;
                          const isToday = dStr === todayStr;
                          const isBeforeJoining = dStr < joiningDateStr;
                          const matchingHoliday = holidays.find((h) => h.date === dStr);

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
                          } else if (matchingHoliday) {
                            status = 'holiday';
                            statusLabel = `🌴 Holiday: ${matchingHoliday.name}`;
                            statusColor = '#fbbf24';
                          } else if (isSunday) {
                            status = 'week_off';
                            statusLabel = 'Week Off';
                            statusColor = '#475569';
                          } else if (punch?.status === 'present' || punch?.check_in_time) {
                            status = 'present';
                            const checkInFormatted = punch.check_in_time ? new Date(punch.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Logged';
                            statusLabel = `✓ Present (${checkInFormatted})`;
                            statusColor = '#10b981';
                          } else if (punch?.status === 'regularized' || punch?.regularization_status === 'approved') {
                            status = 'regularized';
                            statusLabel = '★ Regularized Approved';
                            statusColor = '#06b6d4';
                          } else if (punch?.regularization_status === 'pending') {
                            status = 'pending';
                            statusLabel = '⏳ Regularization Pending';
                            statusColor = '#f59e0b';
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
                            isSunday,
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
                                matchingHoliday && { borderColor: '#f59e0b' },
                                isBeforeJoining && { opacity: 0.5 }
                              ]}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={[styles.calDayBadge, { backgroundColor: isToday ? '#0284c7' : matchingHoliday ? '#78350f' : '#1e293b' }]}>
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

              {/* VIEW B: COMPANY HOLIDAY SCHEDULE */}
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
        {/* 5. NOTICES & MEETINGS TAB */}
        {/* ========================================================================= */}
        {activeTab === 'notices' && (
          <View style={{ gap: 14 }}>
            <View style={styles.card}>
              <View style={styles.filterRow}>
                <TouchableOpacity
                  style={[styles.filterTab, noticesSubTab === 'notices' && styles.filterTabActive]}
                  onPress={() => setNoticesSubTab('notices')}
                >
                  <Text style={[styles.filterTabText, noticesSubTab === 'notices' && styles.filterTabTextActive]}>
                    📢 Notice Board ({notices.length})
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
                    {notices.length === 0 ? (
                      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                        <Text style={{ fontSize: 24, marginBottom: 4 }}>📢</Text>
                        <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: 'bold' }}>No Notices Published</Text>
                      </View>
                    ) : (
                      notices.map((n) => (
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

              {/* VIEW B: MEETINGS */}
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

            {/* SUBTAB 1: USER PROFILE */}
            {hubSubTab === 'profile' && (
              <View style={{ gap: 14 }}>
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
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 2,
                        borderColor: isDarkMode ? '#0d121d' : '#ffffff'
                      }}>
                        <Text style={{ fontSize: 12 }}>📷</Text>
                      </View>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.profileName}>
                        {userProfile?.first_name} {userProfile?.last_name}
                      </Text>
                      <Text style={styles.profileDesig}>{userProfile?.designation || 'Team Member'}</Text>
                      <View style={styles.profileRoleBadge}>
                        <Text style={styles.profileRoleBadgeText}>{userProfile?.role?.toUpperCase() || 'EMPLOYEE'}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
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
                      <Text style={styles.editProfileBtnText}>✏️ Edit</Text>
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

                {/* Details Card */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Work Profile & Organization</Text>
                  <Text style={styles.cardDesc}>Verified employee record in Supabase cluster</Text>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Work Email:</Text>
                    <Text style={styles.detailVal}>{userProfile?.email}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Contact Phone:</Text>
                    <Text style={styles.detailVal}>{userProfile?.phone || 'Not Provided'}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Department:</Text>
                    <Text style={styles.detailVal}>{userProfile?.department || 'Operations'}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date of Joining:</Text>
                    <Text style={[styles.detailVal, { color: '#38bdf8', fontWeight: 'bold' }]}>
                      {formatDisplayDate(userProfile?.joining_date)}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Reporting Manager:</Text>
                    <Text style={styles.detailVal}>
                      {(() => {
                        const mgr = teamProfiles.find((p) => p.id === userProfile?.manager_id);
                        return mgr ? `${mgr.first_name} ${mgr.last_name} (${mgr.designation || 'Lead'})` : isSuperadmin ? 'Superadmin Master' : 'Executive Head';
                      })()}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Active Tenant:</Text>
                    <Text style={styles.detailVal}>{currentOrg?.name} ({currentOrg?.org_code})</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Push Channel Status:</Text>
                    <Text style={[styles.detailVal, { color: notifPermission ? '#10b981' : '#f59e0b', fontWeight: 'bold' }]}>
                      {notifPermission ? 'CONNECTED (MAX)' : 'ACTIVE'}
                    </Text>
                  </View>
                </View>

                {/* Appearance & Theme Setting Card */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Appearance & Theme</Text>
                  <Text style={styles.cardDesc}>Switch between deep dark cyber theme and clean corporate light theme</Text>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                    <TouchableOpacity
                      style={[styles.themeOptionBtn, isDarkMode && styles.themeOptionBtnActive]}
                      onPress={() => handleSetTheme(true)}
                    >
                      <Text style={{ fontSize: 16 }}>🌙</Text>
                      <Text style={[styles.themeOptionText, isDarkMode && styles.themeOptionTextActive]}>
                        Dark Mode
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.themeOptionBtn, !isDarkMode && styles.themeOptionBtnActive]}
                      onPress={() => handleSetTheme(false)}
                    >
                      <Text style={{ fontSize: 16 }}>☀️</Text>
                      <Text style={[styles.themeOptionText, !isDarkMode && styles.themeOptionTextActive]}>
                        Light Mode
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Over-The-Air Automatic App Updates Card */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Instant App Updates (EAS OTA)</Text>
                  <Text style={styles.cardDesc}>Employees receive new features automatically without re-downloading APKs</Text>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Update Channel:</Text>
                    <Text style={[styles.detailVal, { color: '#10b981', fontWeight: 'bold' }]}>preview (Live OTA)</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Auto Background Check:</Text>
                    <Text style={[styles.detailVal, { color: '#38bdf8', fontWeight: 'bold' }]}>ENABLED (On Launch)</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.loginBtn, { marginTop: 12, backgroundColor: isDarkMode ? '#0284c7' : '#2563eb' }]}
                    onPress={handleManualCheckUpdates}
                    disabled={isCheckingUpdate}
                  >
                    <Text style={styles.loginBtnText}>
                      {isCheckingUpdate ? 'Checking EAS Server...' : '🔄 Check for App Updates Now'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Organization Settings Card (HR / Superadmin / Owner) */}
                {isPrivileged && (
                  <View style={[styles.card, { borderColor: '#6366f1' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.cardTitle, { color: '#818cf8' }]}>⚙️ Organization Settings</Text>
                      <TouchableOpacity
                        style={[styles.smallAddBtn, { backgroundColor: '#4f46e5' }]}
                        onPress={() => {
                          setOrgShiftStart(currentOrg?.settings?.shiftStartTime || '09:30');
                          setOrgShiftEnd(currentOrg?.settings?.shiftEndTime || '19:00');
                          setOrgGracePeriod(String(currentOrg?.settings?.gracePeriodMins ?? 15));
                          setOrgGeofenceRadius(String(activeOfficeCoords.radiusMeters || 200));
                          setIsOrgSettingsModal(true);
                        }}
                      >
                        <Text style={styles.smallAddBtnText}>⚙️ Configure</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.cardDesc}>Configure shifts, grace period & GPS geofence for {currentOrg?.name}</Text>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Shift Timing:</Text>
                      <Text style={styles.detailVal}>
                        {currentOrg?.settings?.shiftStartTime || '09:30'} - {currentOrg?.settings?.shiftEndTime || '19:00'} IST
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Grace Period:</Text>
                      <Text style={styles.detailVal}>{currentOrg?.settings?.gracePeriodMins ?? 15} minutes</Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Office Geofence:</Text>
                      <Text style={styles.detailVal}>{activeOfficeCoords.radiusMeters}m radius ({activeOfficeCoords.name})</Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity style={styles.profileLogoutBtn} onPress={handleLogout}>
                  <Text style={styles.profileLogoutBtnText}>Log Out from Device</Text>
                </TouchableOpacity>
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
            {hubSubTab === 'standups' && (
              <View style={{ gap: 14 }}>
                <View style={styles.card}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.cardTitle}>Daily EOD Standup</Text>
                    <TouchableOpacity
                      style={styles.smallAddBtn}
                      onPress={() => setIsStandupModal(true)}
                    >
                      <Text style={styles.smallAddBtnText}>+ Submit Today</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.cardDesc}>Accountability & daily accomplishment logs</Text>

                  <View style={{ gap: 10, marginTop: 10 }}>
                    {standups.length === 0 ? (
                      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                        <Text style={{ fontSize: 24, marginBottom: 4 }}>🚀</Text>
                        <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: 'bold' }}>No Standups Logged Today</Text>
                        <Text style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>Tap "+ Submit Today" to log accomplishments.</Text>
                      </View>
                    ) : (
                      standups.map((st) => {
                        const emp = teamProfiles.find((p) => p.id === st.employee_id);
                        return (
                          <View key={st.id} style={styles.standupFeedItem}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={styles.standupAuthor}>
                                {emp ? `${emp.first_name} ${emp.last_name}` : 'Team Member'}
                              </Text>
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
                          </View>
                        );
                      })
                    )}
                  </View>
                </View>
              </View>
            )}

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
      {/* BOTTOM NAVIGATION (6 TABS) */}
      {/* ========================================================================= */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'punch' && styles.navItemActive]}
          onPress={() => setActiveTab('punch')}
        >
          <Text style={styles.navIcon}>📍</Text>
          <Text style={[styles.navLabel, activeTab === 'punch' && styles.navLabelActive]}>Punch</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'calendar' && styles.navItemActive]}
          onPress={() => setActiveTab('calendar')}
        >
          <Text style={styles.navIcon}>📅</Text>
          <Text style={[styles.navLabel, activeTab === 'calendar' && styles.navLabelActive]}>Calendar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'leaves' && styles.navItemActive]}
          onPress={() => setActiveTab('leaves')}
        >
          <Text style={styles.navIcon}>🌴</Text>
          <Text style={[styles.navLabel, activeTab === 'leaves' && styles.navLabelActive]}>Leaves</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'approvals' && styles.navItemActive]}
          onPress={() => setActiveTab('approvals')}
        >
          <View style={{ position: 'relative' }}>
            <Text style={styles.navIcon}>⚡</Text>
            {totalPendingApprovals > 0 && canApprove && (
              <View style={styles.navBadge}>
                <Text style={styles.navBadgeText}>{totalPendingApprovals}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.navLabel, activeTab === 'approvals' && styles.navLabelActive]}>Approvals</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'notices' && styles.navItemActive]}
          onPress={() => setActiveTab('notices')}
        >
          <Text style={styles.navIcon}>📢</Text>
          <Text style={[styles.navLabel, activeTab === 'notices' && styles.navLabelActive]}>Notices</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'hub' && styles.navItemActive]}
          onPress={() => setActiveTab('hub')}
        >
          <Text style={styles.navIcon}>👤</Text>
          <Text style={[styles.navLabel, activeTab === 'hub' && styles.navLabelActive]}>Hub/Profile</Text>
        </TouchableOpacity>
      </View>

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
              const isPending = p?.regularization_status === 'pending';
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
                        {currentOrg?.settings?.shiftStartTime || '09:30'} - {currentOrg?.settings?.shiftEndTime || '19:00'} IST
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
                    {(p?.regularization_notes || p?.approval_notes || p?.regularization_reason || p?.regularization_status === 'approved' || p?.approval_status === 'approved') && (
                      <View style={{ marginTop: 8, padding: 10, backgroundColor: isDarkMode ? '#1e293b' : '#f0fdf4', borderRadius: 8, borderWidth: 1, borderColor: (p?.regularization_status === 'approved' || p?.approval_status === 'approved') ? '#10b98140' : '#f59e0b40' }}>
                        <Text style={{ fontSize: 10, color: (p?.regularization_status === 'approved' || p?.approval_status === 'approved') ? '#10b981' : '#f59e0b', fontWeight: 'bold' }}>
                          {(p?.regularization_status === 'approved' || p?.approval_status === 'approved') ? '✅ REGULARIZED & APPROVED' : '⏳ REGULARIZATION PENDING'}
                        </Text>
                        {(p?.regularization_notes || p?.approval_notes) && (
                          <View style={{ marginTop: 4 }}>
                            <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: 'bold' }}>APPROVAL NOTE:</Text>
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
                        onPress={() => {
                          setEditEmpRole(inspectedUserProfile.role || 'employee');
                          setEditEmpDesig(inspectedUserProfile.designation || '');
                          setEditEmpDept(inspectedUserProfile.department || '');
                          setEditEmpJoining(inspectedUserProfile.joining_date || '');
                          setEditEmpPasswordReset('');
                          setIsEditEmployeeModal(true);
                        }}
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
      {/* MODAL 16: READ FULL OFFICIAL NOTICE */}
      {/* ========================================================================= */}
      <Modal visible={selectedNoticeForView !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            {selectedNoticeForView && (
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
            )}
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
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Manage Employee Record</Text>
            <Text style={styles.modalSub}>Update employee details in corporate Supabase database</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%', marginTop: 8 }}>
              <Text style={styles.inputLabel}>Corporate Role</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginVertical: 6 }}>
                {['employee', 'manager', 'hr'].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.filterTab,
                      editEmpRole === r && styles.filterTabActive,
                      { flex: 1, paddingVertical: 8 }
                    ]}
                    onPress={() => setEditEmpRole(r)}
                  >
                    <Text style={[styles.filterTabText, editEmpRole === r && styles.filterTabTextActive, { textAlign: 'center' }]}>
                      {r.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Official Designation</Text>
              <TextInput
                style={styles.textInput}
                value={editEmpDesig}
                onChangeText={setEditEmpDesig}
                placeholder="e.g. Senior Software Engineer"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>Department</Text>
              <TextInput
                style={styles.textInput}
                value={editEmpDept}
                onChangeText={setEditEmpDept}
                placeholder="e.g. Engineering, Sales, Operations"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>Date of Joining (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.textInput}
                value={editEmpJoining}
                onChangeText={setEditEmpJoining}
                placeholder="e.g. 2026-01-15"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>Reset Password (Superadmin / HR)</Text>
              <TextInput
                style={styles.textInput}
                value={editEmpPasswordReset}
                onChangeText={setEditEmpPasswordReset}
                placeholder="Leave blank to keep existing password"
                placeholderTextColor="#64748b"
                secureTextEntry
              />

              <TouchableOpacity
                style={[styles.loginBtn, { marginTop: 14 }]}
                disabled={isSavingEmpRecord}
                onPress={async () => {
                  if (!supabaseClient || !inspectedUserProfile) return;
                  if (editEmpPasswordReset.trim() && editEmpPasswordReset.trim().length < 6) {
                    Alert.alert('Too Short', 'New password must be at least 6 characters long.');
                    return;
                  }
                  setIsSavingEmpRecord(true);
                  try {
                    const updates: any = {
                      role: editEmpRole,
                      designation: editEmpDesig.trim() || 'Staff',
                      department: editEmpDept.trim() || 'Operations'
                    };
                    if (editEmpJoining.trim()) {
                      updates.joining_date = editEmpJoining.trim();
                    }
                    if (editEmpPasswordReset.trim()) {
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
                      Alert.alert('Employee Updated ✓', `${inspectedUserProfile.first_name}'s record has been updated.`);
                      setIsEditEmployeeModal(false);
                    } else {
                      Alert.alert('Database Error', error.message);
                    }
                  } catch (e: any) {
                    Alert.alert('Error', e?.message);
                  } finally {
                    setIsSavingEmpRecord(false);
                  }
                }}
              >
                <Text style={styles.loginBtnText}>{isSavingEmpRecord ? 'Saving...' : 'Save Employee Changes'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsEditEmployeeModal(false)}>
                <Text style={styles.modalCloseBtnText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
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
                placeholder="19:00"
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
                      shiftStartTime: orgShiftStart.trim() || '09:30',
                      shiftEndTime: orgShiftEnd.trim() || '19:00',
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
function createThemedStyles(isDark: boolean) {
  const bg = isDark ? '#07090e' : '#f8fafc';
  const cardBg = isDark ? '#0d121d' : '#ffffff';
  const cardBorder = isDark ? '#1e293b' : '#e2e8f0';
  const subtleBorder = isDark ? '#334155' : '#cbd5e1';
  const textPrimary = isDark ? '#ffffff' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#475569';
  const textMuted = isDark ? '#64748b' : '#94a3b8';
  const inputBg = isDark ? '#07090e' : '#f8fafc';
  const inputBorder = isDark ? '#1e293b' : '#cbd5e1';
  const subtleBg = isDark ? '#141b2d' : '#f1f5f9';
  const navBg = isDark ? '#07090e' : '#ffffff';
  const navBorder = isDark ? '#1e293b' : '#e2e8f0';

  return StyleSheet.create({
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
