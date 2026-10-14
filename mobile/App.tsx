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
  RefreshControl
} from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

function getTodayISTDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function getISTTimeString(dateObj = new Date()): string {
  return dateObj.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' });
}

function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return 'Not Set';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
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

export default function App() {
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Authentication & Profile State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userProfile, setUserProfile] = useState<any>(null);

  // Login Form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Bottom Navigation Tabs: 'punch' | 'calendar' | 'leaves' | 'approvals' | 'notices' | 'hub'
  const [activeTab, setActiveTab] = useState<'punch' | 'calendar' | 'leaves' | 'approvals' | 'notices' | 'hub'>('punch');

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

  // Dynamic Theme-Dependent Styles
  const styles = useMemo(() => createThemedStyles(isDarkMode), [isDarkMode]);

  // Load saved theme preference on mount
  useEffect(() => {
    AsyncStorage.getItem('@vdx_theme_mode')
      .then((savedTheme) => {
        if (savedTheme === 'light') {
          setIsDarkMode(false);
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

  // Initialize Supabase & Session
  useEffect(() => {
    initSupabase();
  }, []);

  const initSupabase = async () => {
    try {
      const client = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY);
      setSupabaseClient(client);

      const { data: orgData, error } = await client.from('organizations').select('*');
      if (!error && orgData && orgData.length > 0) {
        setSupabaseConnected(true);
        setOrganizations(orgData);
        setCurrentOrg(orgData[0]);
      }
      await checkSession(client);
    } catch (e) {
      console.log('Supabase init error', e);
    }
  };

  const checkSession = async (client: SupabaseClient) => {
    try {
      const token = await AsyncStorage.getItem('@vdx_mobile_token');
      const email = await AsyncStorage.getItem('@vdx_mobile_email');

      if (token && email) {
        const cleanEmail = email.trim().toLowerCase();
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
        } else {
          const savedProfile = await AsyncStorage.getItem('@vdx_user_profile');
          if (savedProfile) {
            const parsed = JSON.parse(savedProfile);
            setUserEmail(cleanEmail);
            setUserProfile(parsed);
            setIsLoggedIn(true);
            setupNotificationsAsync();
            await refreshAllData(client, parsed.org_id, parsed.id);
          }
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
        if (profiles) setTeamProfiles(profiles);
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
          setAttendanceRecords(att);
          fetchedAttendance = att;
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

      // 11. Check Today's Punch Record
      const todayStr = getTodayISTDate();
      const todayRecord = fetchedAttendance.find(
        (a) => a.employee_id === myId && a.date === todayStr
      );
      if (todayRecord) {
        setTodayAttendanceRecord(todayRecord);
        if (todayRecord.check_in_time && !todayRecord.check_out_time) {
          setIsCheckedIn(true);
          const t = new Date(todayRecord.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setCheckInTime(t);
        } else if (todayRecord.check_out_time) {
          setIsCheckedIn(false);
          const t = new Date(todayRecord.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setCheckInTime(`Punched out (${t})`);
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

  const sendDeviceNotification = async (title: string, body: string, channelId = 'attendance-alerts', data: any = {}) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          color: '#2563eb',
          data
        },
        trigger: null
      });
    } catch (err) {
      console.log('Failed to trigger notification:', err);
    }
  };

  const checkAttendanceStatusAndNotify = async (records: any[] = attendanceRecords, myProfileId?: string) => {
    try {
      const now = new Date();
      const todayStr = getTodayISTDate();
      const dayOfWeek = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getDay();

      if (dayOfWeek === 0) {
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

  // Geo-Fenced Smart Punch with Shift Gate Enforcement
  const handlePunchToggle = async () => {
    if (!supabaseClient || !userProfile) return;

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

    // Punch IN
    if (!isCheckedIn) {
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
          `Your shift ended at ${shiftEndTime} IST. Punch-in is closed. Please submit an attendance regularization request for today.`
        );
        return;
      }

      const newAttId = generateUUID();
      const newRecord = {
        id: newAttId,
        org_id: currentOrg?.id || userProfile.org_id,
        employee_id: userProfile.id,
        date: todayStr,
        check_in_time: new Date().toISOString(),
        check_in_lat: location?.coords.latitude || null,
        check_in_long: location?.coords.longitude || null,
        distance_meters: distance,
        status: isInsideFence ? 'present' : 'absent',
        is_remote: !isInsideFence,
        regularization_status: 'none',
        approval_status: isInsideFence ? 'approved' : 'pending_manager_approval',
        total_hours: 0
      };

      try {
        const { error } = await supabaseClient.from('attendance').insert(newRecord);
        if (!error) {
          setIsCheckedIn(true);
          setCheckInTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          setTodayAttendanceRecord(newRecord);
          setAttendanceAlertActive(false);

          sendDeviceNotification(
            '✅ Punch In Recorded | Vedotrix Pulse',
            `Checked in at ${nowTimeStr} IST. Geofence: ${isInsideFence ? `In Office (${targetCoords.name})` : 'Remote'}.`,
            'attendance-alerts'
          );

          Alert.alert(
            'Punch In Recorded 📍',
            `Checked in at ${nowTimeStr} IST.\nLocation: ${isInsideFence ? `In Office (${targetCoords.name})` : `Remote (${distance}m from office)`}`
          );
          refreshAllData(supabaseClient, userProfile.org_id, userProfile.id);
        } else {
          Alert.alert('Database Error', error.message);
        }
      } catch (err: any) {
        Alert.alert('Error', err?.message);
      }
    } else {
      // Punch OUT
      try {
        const checkOutISO = new Date().toISOString();
        let totalHours = 8;
        if (todayAttendanceRecord?.check_in_time) {
          const diffMs = new Date(checkOutISO).getTime() - new Date(todayAttendanceRecord.check_in_time).getTime();
          totalHours = Math.max(0.5, Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10);
        }

        const { error } = await supabaseClient
          .from('attendance')
          .update({
            check_out_time: checkOutISO,
            total_hours: totalHours
          })
          .eq('employee_id', userProfile.id)
          .eq('date', todayStr);

        if (!error) {
          setIsCheckedIn(false);
          setCheckInTime(`Punched out (${nowTimeStr})`);

          sendDeviceNotification(
            '🌙 Punch Out Recorded | Vedotrix Pulse',
            `Checked out at ${nowTimeStr} IST. Total logged: ${totalHours} hrs.`,
            'attendance-alerts'
          );

          Alert.alert(
            'Punch Out Recorded 🏁',
            `Daily attendance completed. Logged: ${totalHours} hours.`
          );
          refreshAllData(supabaseClient, userProfile.org_id, userProfile.id);
        } else {
          Alert.alert('Error', error.message);
        }
      } catch (err: any) {
        Alert.alert('Error', err?.message);
      }
    }
  };

  // Submit Attendance Regularization Request
  const handleSubmitRegularization = async () => {
    if (!regJustification.trim()) {
      Alert.alert('Required', 'Please enter a justification.');
      return;
    }
    if (!supabaseClient || !userProfile) return;

    setIsSubmittingReg(true);
    try {
      const targetDate = regTargetDate || getTodayISTDate();
      const fullReason = `[${regCategory}] Shift: ${regInTime} - ${regOutTime} IST. ${regJustification.trim()}`;

      const existing = attendanceRecords.find(
        (a) => a.employee_id === userProfile.id && a.date === targetDate
      );

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

        const { error } = await supabaseClient.from('attendance').insert(insertPayload);
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
  const handleResolveRegularization = async (id: string, status: 'approved' | 'rejected') => {
    if (!supabaseClient || !userProfile) return;

    try {
      const approverUuid = (userProfile.id && userProfile.id.length === 36) ? userProfile.id : null;
      const updatePayload: any = {
        regularization_status: status,
        approval_status: status === 'approved' ? 'approved' : 'rejected',
        status: status === 'approved' ? 'present' : 'absent',
        approved_by: approverUuid,
        regularized_by: approverUuid,
        total_hours: status === 'approved' ? 8 : 0
      };

      const { error } = await supabaseClient
        .from('attendance')
        .update(updatePayload)
        .eq('id', id);

      if (!error) {
        Alert.alert(
          status === 'approved' ? 'Regularization Approved ✅' : 'Regularization Rejected ❌',
          `Attendance marked as ${status === 'approved' ? 'PRESENT' : 'ABSENT'}.`
        );
        refreshAllData(supabaseClient, userProfile.org_id, userProfile.id);
      } else {
        Alert.alert('Error', error.message);
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
        await AsyncStorage.setItem('@vdx_user_profile', JSON.stringify(updated));
        Alert.alert('Profile Updated ✅', 'Your contact details have been updated.');
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

  // Filter pending approvals
  const pendingRegularizations = useMemo(() => {
    if (!canApprove) return [];
    return attendanceRecords.filter((a) => {
      if (a.regularization_status !== 'pending') return false;
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

  const isInside = distance !== null && distance <= activeOfficeCoords.radiusMeters;
  const todayStr = getTodayISTDate();
  const todayHoliday = holidays.find((h) => h.date === todayStr);

  // 1. LOGIN SCREEN
  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.loginContainer}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={isDarkMode ? '#07090e' : '#f8fafc'} />
        <View style={styles.loginCard}>
          <Image source={require('./assets/icon.png')} style={styles.loginLogo} resizeMode="contain" />
          <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'flex-end', marginBottom: -25, zIndex: 10 }}>
          <TouchableOpacity style={styles.themeToggleBtn} onPress={handleToggleTheme}>
            <Text style={{ fontSize: 15 }}>{isDarkMode ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.loginTitle}>Vedotrix Pulse</Text>
          <Text style={styles.loginSubtitle}>Multi-Tenant Enterprise HRMS & Mobile Suite</Text>
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
          <Image source={require('./assets/icon.png')} style={styles.logoImage} resizeMode="contain" />
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.brandTitle}>
                Vedotrix <Text style={styles.brandAccent}>Pulse</Text>
              </Text>
              {isSuperadmin && (
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
            style={styles.themeToggleBtn}
            onPress={handleToggleTheme}
            accessibilityLabel="Toggle Light/Dark Theme"
          >
            <Text style={{ fontSize: 14 }}>{isDarkMode ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>

          {isSuperadmin && (
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
        {/* Today Holiday Banner */}
        {todayHoliday && (
          <View style={styles.holidayAlertBanner}>
            <Text style={{ fontSize: 18 }}>🎉</Text>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.holidayAlertTitle}>Official Holiday Today: {todayHoliday.name}</Text>
              <Text style={styles.holidayAlertSub}>{todayHoliday.description || 'Enjoy your day off!'}</Text>
            </View>
          </View>
        )}

        {/* Shift Attendance Reminder */}
        {attendanceAlertActive && !isCheckedIn && !todayHoliday && (
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
        {/* 1. PUNCH TAB */}
        {/* ========================================================================= */}
        {activeTab === 'punch' && (
          <View style={{ gap: 14 }}>
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.cardTitle}>Geo-Fenced Smart Punch</Text>
                <TouchableOpacity onPress={requestLocationPermission} style={{ padding: 4 }}>
                  <Text style={{ color: '#38bdf8', fontSize: 11, fontWeight: 'bold' }}>↻ Sync GPS</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.cardDesc}>
                Office: {activeOfficeCoords.name} (Radius: {activeOfficeCoords.radiusMeters}m)
              </Text>

              <View style={[styles.statusBadge, isInside ? styles.statusBadgeInside : styles.statusBadgeRemote]}>
                <Text style={[styles.statusText, isInside ? styles.statusTextInside : styles.statusTextRemote]}>
                  {isInside ? '● INSIDE OFFICE GEOFENCE' : '▲ REMOTE / OFF-SITE LOCATION'}
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
                  <Text style={styles.metricLabel}>Shift Hours (IST)</Text>
                  <Text style={styles.metricValue}>
                    {currentOrg?.settings?.shiftStartTime || '09:30'} - {currentOrg?.settings?.shiftEndTime || '19:00'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.punchButton, isCheckedIn ? styles.punchButtonOut : styles.punchButtonIn]}
                onPress={handlePunchToggle}
              >
                <Text style={styles.punchButtonText}>
                  {isCheckedIn ? 'PUNCH OUT (END SHIFT)' : 'PUNCH IN (CHECK-IN)'}
                </Text>
                {checkInTime && (
                  <Text style={styles.punchTimeText}>{checkInTime}</Text>
                )}
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TouchableOpacity
                  style={[styles.actionBtnSecondary, { flex: 1 }]}
                  onPress={() => {
                    setRegTargetDate(getTodayISTDate());
                    setIsRegModal(true);
                  }}
                >
                  <Text style={styles.actionBtnSecondaryText}>✍️ Regularize Attendance</Text>
                </TouchableOpacity>

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

            {/* Today's Punch Details */}
            {todayAttendanceRecord && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Today's Punch Record</Text>
                <Text style={styles.cardDesc}>Recorded in live cloud database</Text>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Check-In Time:</Text>
                  <Text style={styles.detailVal}>
                    {todayAttendanceRecord.check_in_time
                      ? new Date(todayAttendanceRecord.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' IST'
                      : '--'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Check-Out Time:</Text>
                  <Text style={styles.detailVal}>
                    {todayAttendanceRecord.check_out_time
                      ? new Date(todayAttendanceRecord.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' IST'
                      : 'Shift in progress'}
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
              </View>
            )}

            {/* Upcoming Next Holiday Highlight Card */}
            {(() => {
              const upcoming = holidays.find((h) => h.date >= todayStr);
              if (!upcoming) return null;
              return (
                <View style={[styles.card, { borderColor: '#f59e0b' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.cardTitle, { color: '#fbbf24' }]}>🌴 Next Upcoming Holiday</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setActiveTab('calendar');
                        setCalSubTab('holidays');
                      }}
                    >
                      <Text style={{ color: '#38bdf8', fontSize: 10, fontWeight: 'bold' }}>View All →</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: 'bold', marginTop: 4 }}>
                    {upcoming.name}
                  </Text>
                  <Text style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>
                    📅 {formatDisplayDate(upcoming.date)} • {upcoming.type?.toUpperCase()}
                  </Text>
                </View>
              );
            })()}
          </View>
        )}

        {/* ========================================================================= */}
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

              {/* VIEW A: MY ATTENDANCE CALENDAR */}
              {calSubTab === 'attendance' && (
                <View style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.cardTitle}>Monthly Attendance</Text>
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

                  <Text style={styles.cardDesc}>
                    Synced from joining date: {formatDisplayDate(userProfile?.joining_date)}
                  </Text>

                  {/* Summary Counters */}
                  {(() => {
                    const myId = userProfile?.id;
                    const joiningDateStr = userProfile?.joining_date || '2026-01-01';
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
                        (a) => a.employee_id === myId && a.date === dStr
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

                  {/* Day Rows List */}
                  <View style={{ marginTop: 12, gap: 8 }}>
                    {(() => {
                      const myId = userProfile?.id;
                      const joiningDateStr = userProfile?.joining_date || '2026-01-01';
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
                          (a) => a.employee_id === myId && a.date === dStr
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

                        dayItems.push(
                          <View
                            key={dStr}
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
                                  setRegTargetDate(dStr);
                                  setIsRegModal(true);
                                }}
                              >
                                <Text style={styles.calRegBtnText}>Regularize</Text>
                              </TouchableOpacity>
                            )}

                            {status === 'regularized' && (
                              <View style={styles.calApprovedBadge}>
                                <Text style={styles.calApprovedBadgeText}>Approved</Text>
                              </View>
                            )}
                          </View>
                        );
                      }
                      return dayItems;
                    })()}
                  </View>
                </View>
              )}

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
                          <Text style={styles.approvalReason}>"{reg.regularization_reason}"</Text>
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
                        <View key={n.id} style={[styles.noticeCard, n.is_pinned && { borderColor: '#f59e0b' }]}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View style={{ flex: 1, paddingRight: 6 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                {n.is_pinned && <Text style={{ fontSize: 12 }}>📌</Text>}
                                <Text style={styles.noticeTitle}>{n.title}</Text>
                              </View>
                            </View>
                            <View style={[styles.priorityTag, n.priority === 'critical' ? styles.priorityCritical : styles.priorityHigh]}>
                              <Text style={styles.priorityText}>{n.priority?.toUpperCase()}</Text>
                            </View>
                          </View>
                          <Text style={styles.noticeBody}>{n.content}</Text>
                          <Text style={styles.noticeDate}>
                            📅 {formatDisplayDate(n.date)} • Published by: {n.author_name} ({n.author_role?.toUpperCase()})
                          </Text>
                        </View>
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
                    <View style={styles.profileAvatarLarge}>
                      {userProfile?.avatar_url ? (
                        <Image source={{ uri: userProfile.avatar_url }} style={styles.profileAvatarLargeImg} />
                      ) : (
                        <Text style={styles.profileAvatarLargeText}>
                          {(userProfile?.first_name?.[0] || 'U') + (userProfile?.last_name?.[0] || '')}
                        </Text>
                      )}
                    </View>
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

                  <TouchableOpacity
                    style={styles.editProfileBtn}
                    onPress={() => {
                      setEditPhone(userProfile?.phone || '');
                      setEditAvatarUrl(userProfile?.avatar_url || '');
                      setIsEditProfileModal(true);
                    }}
                  >
                    <Text style={styles.editProfileBtnText}>✏️ Edit Contact / Avatar</Text>
                  </TouchableOpacity>
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
                          <View key={member.id} style={styles.teamCard}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.teamName}>
                                  {member.first_name} {member.last_name}
                                </Text>
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
                                    onPress={() => {
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
                          </View>
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
            {totalPendingApprovals > 0 && (
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
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Profile Information</Text>
            <Text style={styles.modalSub}>Update your phone and avatar</Text>

            <Text style={styles.inputLabel}>Mobile Phone Number</Text>
            <TextInput
              style={styles.textInput}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="+91 9876543210"
              placeholderTextColor="#64748b"
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>Profile Avatar Picture URL</Text>
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
              disabled={isSavingProfile}
            >
              <Text style={styles.loginBtnText}>
                {isSavingProfile ? 'Saving...' : 'Save Profile Changes'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsEditProfileModal(false)}>
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
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
              <Text style={styles.inputLabel}>Target Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.textInput}
                value={regTargetDate}
                onChangeText={setRegTargetDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#64748b"
              />

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
                <Text style={{ color: '#cbd5e1', fontSize: 11, marginLeft: 6 }}>This is a half-day leave</Text>
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
      {/* MODAL 11: SWITCH ORGANIZATION (SUPERADMIN) */}
      {/* ========================================================================= */}
      <Modal visible={isOrgModalVisible} animationType="slide" transparent>
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
  loginLogo: {
    width: 60,
    height: 60,
    borderRadius: 16,
    marginBottom: 10
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
  priorityHigh: {
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
  }
});
}
