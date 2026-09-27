import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Organization,
  Profile,
  OfficeLocation,
  OfferLetter,
  AttendanceRecord,
  TaskItem,
  DailyStandup,
  PayrollRecord,
  UserRole,
  ThemeMode,
  InAppNotification,
  SystemBroadcast,
  AccessRequest,
  RegularizationStatus,
  LeaveRequest,
  LeaveType,
  LeaveStatus,
  LeaveBalance,
  OrganizationAdminCredentials,
  MeetingEvent,
  NoticeItem,
  ChatMessage,
  ChatChannel
} from '../types';
import {
  INITIAL_ORGS,
  INITIAL_OFFICES,
  INITIAL_PROFILES,
  INITIAL_OFFERS,
  INITIAL_ATTENDANCE,
  INITIAL_TASKS,
  INITIAL_STANDUPS,
  INITIAL_PAYROLL,
  INITIAL_NOTIFICATIONS,
  INITIAL_BROADCASTS
} from '../lib/mockData';
import { generateVerificationToken, generateUUID, getTodayISTDateString, formatISTTime, formatISTDateTime } from '../lib/serialUtils';
import {
  getStoredSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
  getSupabaseClient,
  SupabaseConfig
} from '../lib/supabaseClient';
import {
  sendWelcomeEmail,
  sendOfferLetterEmail,
  sendParentalSuperadminAlert
} from '../lib/mailer';

interface NotificationToast {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
}

interface AppContextType {
  // Authentication & Security
  isAuthenticated: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;

  // Theme & Appearance
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;

  // Tenancy & Active State
  currentOrg: Organization;
  currentProfile: Profile;
  isVedotrixSuperadmin: boolean;
  availableOrgs: Organization[];
  allOrganizations: Organization[];
  orgProfiles: Profile[];
  allProfiles: Profile[];
  createProfile: (profileData: Omit<Profile, 'id'>) => Promise<Profile>;
  updateProfile: (profileId: string, updates: Partial<Profile>) => Promise<void>;
  updateOrganization: (orgId: string, updates: Partial<Organization>) => Promise<void>;
  switchOrganization: (orgId: string) => void;
  switchRole: (role: UserRole) => void;
  
  // SuperAdmin & Super Controller Actions
  createOrganization: (orgData: Omit<Organization, 'id' | 'settings'>, adminCredentials?: OrganizationAdminCredentials) => Promise<Organization>;
  toggleOrganizationStatus: (orgId: string) => void;
  updateSubscriptionPlan: (orgId: string, plan: Organization['subscriptionPlan']) => void;
  broadcasts: SystemBroadcast[];
  createBroadcast: (title: string, message: string, priority: SystemBroadcast['priority']) => void;
  
  // Data State
  officeLocations: OfficeLocation[];
  offerLetters: OfferLetter[];
  allOfferLetters: OfferLetter[];
  attendanceRecords: AttendanceRecord[];
  tasks: TaskItem[];
  standups: DailyStandup[];
  payrollRecords: PayrollRecord[];
  
  // Actions: Offer Letters
  createOfferLetter: (offerData: Omit<OfferLetter, 'id' | 'orgId' | 'verificationToken' | 'status' | 'createdAt'>) => OfferLetter;
  acceptOfferLetter: (serialNumber: string) => boolean;
  verifyOfferLetterByHr: (serialNumber: string) => void;
  getOfferBySerial: (serialNumber: string) => OfferLetter | undefined;
  
  // Actions: Attendance
  punchAttendance: (lat: number, long: number, isRemote?: boolean, distanceMeters?: number, officeAddress?: string) => { success: boolean; message: string; record?: AttendanceRecord };
  requestRegularization: (attendanceId: string, reason: string) => void;
  resolveRegularization: (attendanceId: string, status: 'approved' | 'rejected', notes?: string) => void;
  getTodayAttendance: () => AttendanceRecord | undefined;
  
  // Actions: Tasks & Standup
  createTask: (task: Omit<TaskItem, 'id' | 'orgId' | 'createdAt'>) => void;
  updateTaskStatus: (taskId: string, status: TaskItem['status']) => void;
  submitStandup: (completedToday: string, plannedTomorrow: string, blockers?: string, hours?: number) => void;
  
  // Actions: Payroll
  processMonthlyPayroll: (month: number, year: number) => void;
  markPayrollPaid: (recordId: string, reference: string) => void;
  updatePayrollRecord: (id: string, updates: Partial<PayrollRecord>) => Promise<void>;
  exportBankPayoutCsv: (month: number, year: number) => string;

  // Actions & State: Leave Management
  leaveRequests: LeaveRequest[];
  submitLeaveRequest: (data: {
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    totalDays: number;
    isHalfDay?: boolean;
    halfDaySession?: 'first_half' | 'second_half';
    reason: string;
    documentUrl?: string;
  }) => Promise<LeaveRequest>;
  resolveLeaveRequest: (leaveId: string, status: 'approved' | 'rejected', notes?: string) => Promise<void>;
  cancelLeaveRequest: (leaveId: string) => Promise<void>;
  getLeaveBalance: (employeeId?: string) => LeaveBalance;

  // In-App Notification Center
  notifications: InAppNotification[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addNotification: (
    title: string,
    message: string,
    category: InAppNotification['category'],
    linkTab?: string,
    target?: { recipientId?: string; recipientRole?: UserRole | 'all'; orgId?: string }
  ) => void;
  unreadNotificationCount: number;

  // Supabase Live Config
  supabaseConfig: SupabaseConfig;
  updateSupabaseCredentials: (url: string, key: string) => Promise<{ success: boolean; message: string }>;

  // Toasts / Floating Alerts
  toasts: NotificationToast[];
  addToast: (title: string, message: string, type?: NotificationToast['type']) => void;
  removeToast: (id: string) => void;

  // Access Requests & Multi-Hierarchy Approval
  accessRequests: AccessRequest[];
  submitAccessRequest: (targetModule: string, justification: string, requestType?: AccessRequest['requestType']) => Promise<AccessRequest>;
  resolveAccessRequest: (requestId: string, status: 'approved' | 'rejected', notes?: string) => Promise<void>;
  updateEmployeeManager: (employeeId: string, managerId: string | null) => Promise<void>;

  // Meetings & Events
  meetings: MeetingEvent[];
  createMeeting: (data: Omit<MeetingEvent, 'id' | 'orgId' | 'createdAt' | 'status'>) => Promise<MeetingEvent>;
  updateMeetingStatus: (meetingId: string, status: MeetingEvent['status']) => void;

  // Corporate Notice Board
  notices: NoticeItem[];
  createNotice: (data: Omit<NoticeItem, 'id' | 'orgId' | 'createdAt'>) => Promise<NoticeItem>;
  deleteNotice: (noticeId: string) => void;

  // Organizational Live Chat (Supabase DB)
  chatMessages: ChatMessage[];
  chatChannels: ChatChannel[];
  createChatChannel: (data: { name: string; description: string; isPrivate?: boolean; memberIds?: string[] }) => Promise<ChatChannel>;
  deleteChatChannel: (channelId: string) => Promise<void>;
  sendChatMessage: (message: string, channel: string, recipientId?: string) => Promise<ChatMessage>;
  addChatReaction: (messageId: string, emoji: string) => Promise<void>;
  activeChatChannel: string;
  setActiveChatChannel: (channel: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('vdx_auth_token') !== null;
  });

  // Clean stale local storage caches to make sure live Supabase DB is the absolute single source of truth
  useEffect(() => {
    const keysToClean = [
      'vdx_organizations', 'vdx_profiles', 'vdx_office_locations',
      'vdx_offers', 'vdx_attendance', 'vdx_tasks', 'vdx_standups',
      'vdx_payroll', 'vdx_access_requests', 'vdx_leave_requests'
    ];
    keysToClean.forEach((k) => localStorage.removeItem(k));
  }, []);

  // Theme state
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      return (localStorage.getItem('vdx_theme') as ThemeMode) || 'corporate-light';
    } catch {
      return 'corporate-light';
    }
  });

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('vdx_theme', newTheme);
    } catch {}
  };

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.remove('theme-cyber-dark', 'theme-midnight', 'theme-corporate-light', 'dark', 'light');
    if (theme === 'cyber-dark') {
      root.classList.add('dark', 'theme-cyber-dark');
    } else if (theme === 'midnight') {
      root.classList.add('dark', 'theme-midnight');
    } else {
      root.classList.add('light', 'theme-corporate-light');
    }
  }, [theme]);

  // Supabase Config State
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>(getStoredSupabaseConfig());

  // Direct Supabase-synced state (clean zero-mock baseline)
  const [organizations, setOrganizations] = useState<Organization[]>(INITIAL_ORGS);
  const [currentOrgId, setCurrentOrgId] = useState<string>(() => {
    return localStorage.getItem('vdx_current_org_id') || '00000000-0000-0000-0000-000000000001';
  });
  const [currentProfileId, setCurrentProfileId] = useState<string>(() => {
    return localStorage.getItem('vdx_current_profile_id') || '00000000-0000-0000-0000-000000000003';
  });
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [officeLocationsList, setOfficeLocationsList] = useState<OfficeLocation[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [offerLetters, setOfferLetters] = useState<OfferLetter[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [standups, setStandups] = useState<DailyStandup[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [broadcasts, setBroadcasts] = useState<SystemBroadcast[]>([]);
  const [toasts, setToasts] = useState<NotificationToast[]>([]);

  // Meetings & Events State
  const [meetings, setMeetings] = useState<MeetingEvent[]>(() => {
    try {
      const stored = localStorage.getItem('vdx_meetings');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [
      {
        id: 'meet-1',
        orgId: '00000000-0000-0000-0000-000000000001',
        title: 'Daily Technical Sprints & Standup',
        description: 'Review active feature branches, sprint blockers, and production deployments.',
        date: getTodayISTDateString(),
        startTime: '10:30',
        endTime: '11:15',
        isOnline: true,
        meetingUrl: 'https://meet.google.com/vdx-pulse-tech',
        location: 'Google Meet',
        organizerId: '00000000-0000-0000-0000-000000000003',
        organizerName: 'Sajal Saxena',
        organizerRole: 'superadmin',
        attendeeIds: ['all'],
        department: 'Engineering',
        status: 'scheduled',
        createdAt: new Date().toISOString()
      },
      {
        id: 'meet-2',
        orgId: '00000000-0000-0000-0000-000000000001',
        title: 'Monthly Performance & OKR Review',
        description: 'Review key department metrics and quarterly goals with direct managers.',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        startTime: '15:00',
        endTime: '16:00',
        isOnline: true,
        meetingUrl: 'https://meet.google.com/vdx-okr-sync',
        location: 'Google Meet',
        organizerId: '00000000-0000-0000-0000-000000000003',
        organizerName: 'HR Administration',
        organizerRole: 'hr',
        attendeeIds: ['all'],
        department: 'Operations',
        status: 'scheduled',
        createdAt: new Date().toISOString()
      }
    ];
  });

  // Corporate Notice Board State
  const [notices, setNotices] = useState<NoticeItem[]>(() => {
    try {
      const stored = localStorage.getItem('vdx_notices');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [
      {
        id: 'notice-1',
        orgId: '00000000-0000-0000-0000-000000000001',
        title: 'Official Holiday Schedule: Festive Season 2026',
        content: 'Please find the official company holiday schedule for Q4 2026. All managers are advised to ensure sprint deadlines are aligned and on-call rotations are established.',
        category: 'holiday',
        priority: 'high',
        authorId: '00000000-0000-0000-0000-000000000003',
        authorName: 'Corporate HR',
        authorRole: 'hr',
        date: new Date().toISOString(),
        isPinned: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'notice-2',
        orgId: '00000000-0000-0000-0000-000000000001',
        title: 'Workplace Attendance & Regularization Guidelines',
        content: 'All team members must punch in via the Vedotrix Pulse portal within the designated 150m office radius. In case of field client visits or WFH, please submit an attendance regularization request with notes.',
        category: 'policy',
        priority: 'medium',
        authorId: '00000000-0000-0000-0000-000000000003',
        authorName: 'Operations Lead',
        authorRole: 'superadmin',
        date: new Date().toISOString(),
        isPinned: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 'notice-3',
        orgId: '00000000-0000-0000-0000-000000000001',
        title: 'Platform Upgrade: Security & Multi-Tenant Isolation Active',
        content: 'Our HR and technical team have rolled out enhanced multi-tenant security, IST time synchronization, digital offer acceptance verification, and direct reporting manager hierarchies.',
        category: 'announcement',
        priority: 'high',
        authorId: '00000000-0000-0000-0000-000000000003',
        authorName: 'Root Administrator',
        authorRole: 'superadmin',
        date: new Date().toISOString(),
        isPinned: true,
        createdAt: new Date().toISOString()
      }
    ];
  });

  // Organizational Live Chat State (Supabase DB synced)
  const [activeChatChannel, setActiveChatChannel] = useState<string>('general');
  const [customChannels, setCustomChannels] = useState<ChatChannel[]>(() => {
    try {
      const stored = localStorage.getItem('vdx_custom_channels');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem('vdx_chat_messages');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [
      {
        id: 'msg-1',
        orgId: '00000000-0000-0000-0000-000000000001',
        senderId: '00000000-0000-0000-0000-000000000003',
        senderName: 'Sajal Saxena',
        senderRole: 'superadmin',
        senderAvatar: '/vedotrix-logo.png',
        channel: 'general',
        message: 'Welcome everyone to Vedotrix Pulse! Multi-tenant security, IST time synchronization, and our live corporate chat are now active. 🚀',
        reactions: [{ emoji: '🚀', count: 3, userIds: ['00000000-0000-0000-0000-000000000003'] }],
        createdAt: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 'msg-2',
        orgId: '00000000-0000-0000-0000-000000000001',
        senderId: '00000000-0000-0000-0000-000000000003',
        senderName: 'HR Administration',
        senderRole: 'hr',
        senderAvatar: '/vedotrix-logo.png',
        channel: 'general',
        message: 'Please review the updated holiday calendar on the Corporate Notice Board. Attendance regularizations can be raised directly from the dashboard.',
        reactions: [{ emoji: '👍', count: 2, userIds: [] }],
        createdAt: new Date(Date.now() - 1800000).toISOString()
      }
    ];
  });

  // Only sync session pointers to local storage
  useEffect(() => {
    localStorage.setItem('vdx_current_org_id', currentOrgId);
  }, [currentOrgId]);

  useEffect(() => {
    localStorage.setItem('vdx_current_profile_id', currentProfileId);
  }, [currentProfileId]);

  // LIVE SUPABASE CLOUD SYNC ON MOUNT - Loads directly from connected Supabase PostgreSQL
  useEffect(() => {
    async function syncFromLiveSupabase() {
      try {
        const client = getSupabaseClient();
        const [
          { data: cloudOrgs, error: errOrgs },
          { data: cloudProfiles, error: errProf },
          { data: cloudOffices, error: errOff },
          { data: cloudOffers, error: errOffers },
          { data: cloudAttendance, error: errAtt },
          { data: cloudTasks, error: errTasks },
          { data: cloudStandups, error: errStandups },
          { data: cloudRequests, error: errReqs },
          { data: cloudPayroll, error: errPay },
          { data: cloudLeaves, error: errLeaves }
        ] = await Promise.all([
          client.from('organizations').select('*'),
          client.from('profiles').select('*'),
          client.from('office_locations').select('*'),
          client.from('offer_letters').select('*'),
          client.from('attendance').select('*'),
          client.from('tasks').select('*'),
          client.from('daily_standups').select('*'),
          client.from('access_requests').select('*'),
          client.from('payroll_records').select('*'),
          client.from('leave_requests').select('*')
        ]);

        if (errOrgs) console.warn('Supabase orgs fetch error:', errOrgs);
        if (errProf) console.warn('Supabase profiles fetch error:', errProf);
        if (errOff) console.warn('Supabase offices fetch error:', errOff);
        if (errOffers) console.warn('Supabase offers fetch error:', errOffers);
        if (errAtt) console.warn('Supabase attendance fetch error:', errAtt);
        if (errTasks) console.warn('Supabase tasks fetch error:', errTasks);
        if (errStandups) console.warn('Supabase standups fetch error:', errStandups);
        if (errReqs) console.warn('Supabase requests fetch error:', errReqs);
        if (errPay) console.warn('Supabase payroll fetch error:', errPay);
        if (errLeaves) console.warn('Supabase leaves fetch error:', errLeaves);

        if (cloudOrgs && cloudOrgs.length > 0) {
          const mappedOrgs: Organization[] = cloudOrgs.map((o: any) => ({
            id: o.id,
            name: o.name,
            slug: o.slug,
            orgCode: o.org_code,
            industry: o.industry || 'Tech',
            website: o.website || 'https://vedotrix.com',
            address: o.address || '',
            phone: o.phone || '',
            logoUrl: o.logo_url || '/vedotrix-logo.png',
            settings: o.settings || {
              workHoursPerDay: 8,
              gracePeriodMins: 15,
              wfhAllowed: true,
              halfDayThresholdHours: 4.5
            }
          }));
          setOrganizations(mappedOrgs);
        }

        if (!errProf && cloudProfiles) {
          const mappedProfiles: Profile[] = cloudProfiles.map((p: any) => ({
            id: p.id,
            orgId: p.org_id,
            email: p.email,
            firstName: p.first_name,
            lastName: p.last_name || '',
            phone: p.phone || '',
            role: p.role,
            designation: p.designation || 'Team Member',
            department: p.department || 'Operations',
            joiningDate: p.joining_date || new Date().toISOString().split('T')[0],
            baseSalary: p.base_salary !== null && p.base_salary !== undefined ? Number(p.base_salary) : 0,
            avatarUrl: p.avatar_url || '/vedotrix-logo.png',
            isActive: p.is_active ?? true,
            managerId: p.manager_id || undefined,
            passwordHash: p.password_hash || 'Vedotrix@2026',
            modulesAccess: p.modules_access || ['attendance', 'tasks', 'standups']
          }));
          setProfiles(mappedProfiles);
        }

        if (!errOff && cloudOffices) {
          const mappedOffices: OfficeLocation[] = cloudOffices.map((l: any) => ({
            id: l.id,
            orgId: l.org_id,
            name: l.name,
            latitude: Number(l.latitude),
            longitude: Number(l.longitude),
            radiusMeters: Number(l.radius_meters) || 150,
            address: l.address || '',
            isActive: l.is_active ?? true
          }));
          setOfficeLocationsList(mappedOffices);
        }

        if (!errOffers && cloudOffers) {
          const mappedOffers: OfferLetter[] = cloudOffers.map((o: any) => {
            let isLocalAccepted = false;
            try {
              isLocalAccepted = localStorage.getItem(`vdx_offer_accepted_${o.serial_number}`) === 'true';
            } catch {}
            const effectiveStatus = (o.status === 'accepted' || isLocalAccepted) ? 'accepted' : o.status;
            return {
              id: o.id,
              orgId: o.org_id,
              serialNumber: o.serial_number,
              candidateName: o.candidate_name,
              candidateEmail: o.candidate_email,
              candidatePhone: o.candidate_phone || '',
              designation: o.designation,
              department: o.department,
              joiningDate: o.joining_date,
              annualCtc: o.annual_ctc !== null && o.annual_ctc !== undefined ? Number(o.annual_ctc) : 0,
              basicMonthly: o.basic_monthly !== null && o.basic_monthly !== undefined ? Number(o.basic_monthly) : 0,
              hraMonthly: o.hra_monthly !== null && o.hra_monthly !== undefined ? Number(o.hra_monthly) : 0,
              specialAllowance: o.special_allowance !== null && o.special_allowance !== undefined ? Number(o.special_allowance) : 0,
              status: effectiveStatus,
              verificationToken: o.verification_token,
              pdfUrl: o.pdf_url,
              securityCode: o.security_code,
              hrDepartment: o.hr_department,
              managerId: o.manager_id || undefined,
              employeeId: o.employee_id || undefined,
              issuedBy: o.issued_by || '00000000-0000-0000-0000-000000000003',
              hrVerifiedAt: o.hr_verified_at,
              candidateAcceptedAt: o.candidate_accepted_at || (effectiveStatus === 'accepted' ? (o.created_at || new Date().toISOString()) : undefined),
              createdAt: o.created_at
            };
          });
          setOfferLetters(mappedOffers);
        }

        if (!errAtt && cloudAttendance) {
          const mappedAtt: AttendanceRecord[] = cloudAttendance.map((a: any) => ({
            id: a.id,
            orgId: a.org_id,
            employeeId: a.employee_id,
            date: a.date,
            checkInTime: a.check_in_time,
            checkOutTime: a.check_out_time,
            checkInLat: a.check_in_lat ? Number(a.check_in_lat) : undefined,
            checkInLong: a.check_in_long ? Number(a.check_in_long) : undefined,
            checkOutLat: a.check_out_lat ? Number(a.check_out_lat) : undefined,
            checkOutLong: a.check_out_long ? Number(a.check_out_long) : undefined,
            distanceMeters: a.distance_meters ? Number(a.distance_meters) : 0,
            officeAddress: a.office_address || '',
            status: a.status || 'present',
            isRemote: a.is_remote ?? false,
            approvalStatus: a.approval_status || 'approved',
            regularizationStatus: a.regularization_status || 'none',
            regularizationReason: a.regularization_reason,
            regularizedBy: a.regularized_by,
            regularizationNotes: a.regularization_notes,
            totalHours: a.total_hours ? Number(a.total_hours) : 0
          }));
          setAttendanceRecords(mappedAtt);
        }

        if (!errTasks && cloudTasks) {
          const mappedTasks: TaskItem[] = cloudTasks.map((t: any) => ({
            id: t.id,
            orgId: t.org_id,
            title: t.title,
            description: t.description || '',
            assignedTo: t.assigned_to,
            createdBy: t.created_by,
            category: t.category || 'tech',
            status: t.status || 'todo',
            priority: t.priority || 'medium',
            dueDate: t.due_date,
            gitBranch: t.git_branch,
            prLink: t.pr_link,
            sprintName: t.sprint_name,
            campaignName: t.campaign_name,
            clientName: t.client_name,
            adSpendTarget: t.ad_spend_target ? Number(t.ad_spend_target) : undefined,
            targetKpi: t.target_kpi,
            createdAt: t.created_at
          }));
          setTasks(mappedTasks);
        }

        if (!errStandups && cloudStandups) {
          const mappedStandups: DailyStandup[] = cloudStandups.map((s: any) => ({
            id: s.id,
            orgId: s.org_id,
            employeeId: s.employee_id,
            date: s.date,
            completedToday: s.completed_today,
            plannedTomorrow: s.planned_tomorrow,
            blockers: s.blockers,
            hoursLogged: s.hours_logged ? Number(s.hours_logged) : 8,
            createdAt: s.created_at
          }));
          setStandups(mappedStandups);
        }

        if (!errReqs && cloudRequests) {
          const mappedRequests: AccessRequest[] = cloudRequests.map((r: any) => ({
            id: r.id,
            orgId: r.org_id,
            requesterId: r.requester_id,
            requestType: r.request_type,
            targetModule: r.target_module,
            justification: r.justification,
            status: r.status,
            assignedApproverId: r.assigned_approver_id,
            approverDecisionNotes: r.approver_decision_notes,
            approvedAt: r.approved_at,
            createdAt: r.created_at
          }));
          setAccessRequests(mappedRequests);
        }

        if (!errPay && cloudPayroll) {
          const mappedPayroll: PayrollRecord[] = cloudPayroll.map((p: any) => ({
            id: p.id,
            orgId: p.org_id,
            employeeId: p.employee_id,
            month: p.month,
            year: p.year,
            workingDays: p.working_days,
            presentDays: Number(p.present_days),
            lossOfPayDays: Number(p.loss_of_pay_days || 0),
            basicPay: Number(p.basic_pay),
            hra: Number(p.hra),
            allowances: Number(p.allowances || 0),
            deductions: Number(p.deductions || 0),
            lopDeduction: Number(p.lop_deduction || 0),
            netSalary: Number(p.net_salary),
            payoutStatus: p.payout_status || 'pending',
            payoutDate: p.payout_date,
            paymentMode: p.payment_mode || 'NEFT',
            paymentReference: p.payment_reference,
            createdAt: p.created_at
          }));
          setPayrollRecords(mappedPayroll);
        }

        if (!errLeaves && cloudLeaves) {
          const mappedLeaves: LeaveRequest[] = cloudLeaves.map((l: any) => ({
            id: l.id,
            orgId: l.org_id,
            employeeId: l.employee_id,
            leaveType: l.leave_type || 'casual',
            startDate: l.start_date,
            endDate: l.end_date,
            totalDays: Number(l.total_days) || 1,
            isHalfDay: l.is_half_day ?? false,
            halfDaySession: l.half_day_session,
            reason: l.reason,
            status: l.status || 'pending',
            assignedApproverId: l.assigned_approver_id,
            approverDecisionNotes: l.approver_decision_notes,
            approvedBy: l.approved_by,
            decidedAt: l.decided_at,
            documentUrl: l.document_url,
            createdAt: l.created_at
          }));
          setLeaveRequests(mappedLeaves);
        }
      } catch (err) {
        console.warn('Live cloud sync note:', err);
      }
    }
    syncFromLiveSupabase();
  }, []);

  // Live Supabase Polling for Chat Messages
  useEffect(() => {
    let isMounted = true;
    const syncChatFromSupabase = async () => {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client
          .from('chat_messages')
          .select('*')
          .eq('org_id', currentOrgId)
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0 && isMounted) {
          const mapped: ChatMessage[] = data.map((m: any) => ({
            id: m.id,
            orgId: m.org_id,
            senderId: m.sender_id,
            senderName: m.sender_name,
            senderRole: m.sender_role,
            senderAvatar: m.sender_avatar,
            channel: m.channel,
            recipientId: m.recipient_id || undefined,
            message: m.message,
            reactions: Array.isArray(m.reactions) ? m.reactions : [],
            isPinned: m.is_pinned ?? false,
            createdAt: m.created_at
          }));

          setChatMessages((prev) => {
            const map = new Map(prev.map((msg) => [msg.id, msg]));
            mapped.forEach((msg) => map.set(msg.id, msg));
            return Array.from(map.values()).sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          });
        }
      } catch (err) {}
    };

    syncChatFromSupabase();
    const interval = setInterval(syncChatFromSupabase, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentOrgId]);

  // Secure Authentication Logic with Supabase pgcrypto Bcrypt RPC
  const login = async (email: string, pass: string): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (!cleanEmail || !cleanPass) {
      return { success: false, message: 'Please enter both email and password.' };
    }

    try {
      const client = getSupabaseClient();
      const { data: rpcData, error: rpcError } = await client.rpc('verify_user_password', {
        user_email: cleanEmail,
        input_password: cleanPass
      });

      if (!rpcError && rpcData && rpcData.length > 0) {
        const verifiedUser = rpcData[0];
        if (verifiedUser.is_valid === true) {
          const token = `vdx_auth_token_${Date.now()}`;
          localStorage.setItem('vdx_auth_token', token);
          localStorage.setItem('vdx_auth_email', cleanEmail);
          localStorage.setItem('vdx_current_org_id', verifiedUser.org_id);
          localStorage.setItem('vdx_current_profile_id', verifiedUser.user_id);

          setCurrentOrgId(verifiedUser.org_id);
          setCurrentProfileId(verifiedUser.user_id);
          setIsAuthenticated(true);

          if (!organizations.some((o) => o.id === verifiedUser.org_id)) {
            client.from('organizations').select('*').eq('id', verifiedUser.org_id).maybeSingle()
              .then(({ data: orgData }) => {
                if (orgData) {
                  setOrganizations((prev) => [
                    ...prev.filter((o) => o.id !== orgData.id),
                    {
                      id: orgData.id,
                      name: orgData.name,
                      slug: orgData.slug,
                      orgCode: orgData.org_code,
                      industry: orgData.industry || 'Tech',
                      website: orgData.website || 'https://vedotrix.com',
                      address: orgData.address || '',
                      phone: orgData.phone || '',
                      logoUrl: orgData.logo_url || '/vedotrix-logo.png',
                      settings: orgData.settings || {
                        workHoursPerDay: 8,
                        gracePeriodMins: 15,
                        wfhAllowed: true,
                        halfDayThresholdHours: 4.5
                      }
                    }
                  ]);
                }
              });
          }

          setProfiles((prev) => {
            const index = prev.findIndex((p) => p.id === verifiedUser.user_id);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = {
                ...updated[index],
                orgId: verifiedUser.org_id,
                email: cleanEmail,
                role: verifiedUser.role,
                firstName: verifiedUser.first_name,
                lastName: verifiedUser.last_name || '',
                designation: verifiedUser.designation || 'Team Member',
                department: verifiedUser.department || 'Operations',
                modulesAccess: verifiedUser.modules_access || ['attendance', 'tasks', 'standups', 'leaves'],
                managerId: verifiedUser.manager_id
              };
              return updated;
            }
            return [
              ...prev,
              {
                id: verifiedUser.user_id,
                orgId: verifiedUser.org_id,
                email: cleanEmail,
                firstName: verifiedUser.first_name,
                lastName: verifiedUser.last_name || '',
                role: verifiedUser.role,
                designation: verifiedUser.designation || 'Team Member',
                department: verifiedUser.department || 'Operations',
                joiningDate: new Date().toISOString().split('T')[0],
                baseSalary: 50000,
                avatarUrl: verifiedUser.avatar_url || '/vedotrix-logo.png',
                isActive: true,
                managerId: verifiedUser.manager_id,
                passwordHash: '[ENCRYPTED_BCRYPT]',
                modulesAccess: verifiedUser.modules_access || ['attendance', 'tasks', 'standups', 'leaves']
              }
            ];
          });

          if (verifiedUser.role === 'superadmin') {
            addToast('Welcome Super Controller 👑', 'Authenticated as Vedotrix Root Administrator.', 'success');
          } else {
            addToast('Welcome Back', `Logged in as ${verifiedUser.first_name} ${verifiedUser.last_name} (${verifiedUser.role.toUpperCase()})`, 'success');
          }
          return { success: true, message: 'Authenticated successfully.' };
        } else {
          return { success: false, message: 'Invalid work email or password. Access denied.' };
        }
      } else if (!rpcError && (!rpcData || rpcData.length === 0)) {
        return { success: false, message: 'Invalid work email or password. Access denied.' };
      }
    } catch (rpcErr) {
      console.warn('Supabase RPC verify_user_password failed, evaluating offline state:', rpcErr);
    }

    // 2. Offline Fallback
    const user = profiles.find((p) => p.email.toLowerCase() === cleanEmail && p.isActive);
    if (user && user.passwordHash) {
      if (cleanPass === user.passwordHash) {
        const token = `vdx_auth_token_${Date.now()}`;
        localStorage.setItem('vdx_auth_token', token);
        localStorage.setItem('vdx_auth_email', cleanEmail);
        localStorage.setItem('vdx_current_org_id', user.orgId);
        localStorage.setItem('vdx_current_profile_id', user.id);

        setCurrentOrgId(user.orgId);
        setCurrentProfileId(user.id);
        setIsAuthenticated(true);

        addToast('Welcome Back', `Logged in as ${user.firstName} ${user.lastName} (${user.role.toUpperCase()})`, 'success');
        return { success: true, message: 'Logged in successfully.' };
      }
    }

    return { success: false, message: 'Invalid work email or password. Access denied.' };
  };

  const logout = () => {
    localStorage.removeItem('vdx_auth_token');
    localStorage.removeItem('vdx_auth_email');
    localStorage.removeItem('vdx_current_org_id');
    localStorage.removeItem('vdx_current_profile_id');
    setIsAuthenticated(false);
    setCurrentOrgId('00000000-0000-0000-0000-000000000001');
    setCurrentProfileId('00000000-0000-0000-0000-000000000003');
    addToast('Logged Out', 'Session terminated securely.', 'info');
  };

  // Toast Dispatcher
  const addToast = (title: string, message: string, type: NotificationToast['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type, timestamp: new Date().toLocaleTimeString() }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Notification Dispatcher with Recipient & Role Scoping
  const addNotification = (
    title: string,
    message: string,
    category: InAppNotification['category'],
    linkTab?: string,
    target?: { recipientId?: string; recipientRole?: UserRole | 'all'; orgId?: string }
  ) => {
    const newNotif: InAppNotification = {
      id: generateUUID(),
      orgId: target?.orgId || currentOrgId,
      recipientId: target?.recipientId,
      recipientRole: target?.recipientRole,
      title,
      message,
      category,
      isRead: false,
      timestamp: 'Just now',
      linkTab
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const fallbackOrg: Organization = {
    id: currentOrgId || '00000000-0000-0000-0000-000000000001',
    name: 'Vedotrix Technologies Global',
    slug: 'vedotrix',
    orgCode: 'VDX',
    industry: 'Tech',
    website: 'https://vedotrix.com',
    address: 'Vedotrix Corporate Tower, Bangalore, India',
    phone: '+91 80 4400 9900',
    logoUrl: '/vedotrix-logo.png',
    status: 'active',
    settings: {
      workHoursPerDay: 8,
      gracePeriodMins: 15,
      wfhAllowed: true,
      halfDayThresholdHours: 4.5,
      leavePolicy: {
        casualTotal: 12,
        sickTotal: 10,
        privilegeTotal: 15
      }
    }
  };

  const defaultFallbackProfile: Profile = {
    id: currentProfileId || '00000000-0000-0000-0000-000000000003',
    orgId: currentOrgId || '00000000-0000-0000-0000-000000000001',
    email: 'user@vedotrix.com',
    firstName: 'User',
    lastName: '',
    role: 'employee',
    designation: 'Staff',
    department: 'General',
    joiningDate: '2026-01-01',
    baseSalary: 0,
    avatarUrl: '/vedotrix-logo.png',
    isActive: true,
    modulesAccess: ['attendance', 'tasks', 'standups', 'offers', 'leaves']
  };

  const currentOrg = organizations.find((o) => o.id === currentOrgId) || organizations[0] || fallbackOrg;
  const orgProfiles = profiles.filter((p) => p.orgId === currentOrg?.id);
  const currentProfile: Profile =
    orgProfiles.find((p) => p.id === currentProfileId) ||
    profiles.find((p) => p.id === currentProfileId) ||
    orgProfiles[0] ||
    profiles[0] ||
    defaultFallbackProfile;
  
  // Office locations strictly for active tenant with fallback
  const officeLocations = officeLocationsList.filter((o) => o.orgId === currentOrg?.id);
  const effectiveOfficeLocations: OfficeLocation[] = officeLocations.length > 0 ? officeLocations : [
    {
      id: '00000000-0000-0000-0000-000000000002',
      orgId: currentOrg?.id || '00000000-0000-0000-0000-000000000001',
      name: `${currentOrg?.name || 'Corporate'} Head Office`,
      latitude: 12.9352,
      longitude: 77.6946,
      radiusMeters: 200,
      address: currentOrg?.address || 'Corporate Headquarters',
      isActive: true
    }
  ];

  // Strictly identify Vedotrix Root Superadmin
  const isVedotrixSuperadmin = Boolean(
    isAuthenticated &&
    currentProfile?.role === 'superadmin' &&
    (currentProfile?.orgId === '00000000-0000-0000-0000-000000000001' ||
     currentProfile?.email?.toLowerCase() === 'admin@vedotrix.com' ||
     currentProfile?.email?.toLowerCase() === 'sajalsaxenagola@gmail.com')
  );

  // Filter notifications strictly to current user / role / tenant
  const userNotifications = notifications.filter((n) => {
    // 1. Organization isolation
    if (n.orgId && n.orgId !== currentOrg?.id && !isVedotrixSuperadmin) {
      return false;
    }

    // 2. Direct user targeting
    if (n.recipientId) {
      return n.recipientId === currentProfile?.id;
    }

    // 3. Role targeting
    if (n.recipientRole && n.recipientRole !== 'all') {
      if (currentProfile?.role === n.recipientRole) return true;
      if (n.recipientRole === 'hr' && (currentProfile?.role === 'superadmin' || currentProfile?.role === 'owner' || isVedotrixSuperadmin)) {
        return true;
      }
      return false;
    }

    // 4. Category defaults
    if (n.category === 'payroll') {
      return currentProfile?.role === 'hr' || currentProfile?.role === 'superadmin' || currentProfile?.role === 'owner' || isVedotrixSuperadmin;
    }

    if (n.category === 'offer') {
      return currentProfile?.role === 'hr' || currentProfile?.role === 'superadmin' || currentProfile?.role === 'owner' || isVedotrixSuperadmin;
    }

    return true;
  });

  const unreadNotificationCount = userNotifications.filter((n) => !n.isRead).length;

  const markAllNotificationsRead = () => {
    const userIds = new Set(userNotifications.map((n) => n.id));
    setNotifications((prev) => prev.map((n) => (userIds.has(n.id) ? { ...n, isRead: true } : n)));
  };

  const switchOrganization = (orgId: string) => {
    if (!isVedotrixSuperadmin && orgId !== currentOrgId) {
      addToast('Access Denied', 'Organizations can only access their own organization workspace.', 'warning');
      return;
    }
    setCurrentOrgId(orgId);
    const targetProfiles = profiles.filter((p) => p.orgId === orgId);
    if (targetProfiles.length > 0) {
      const defaultUser = targetProfiles.find((p) => p.role === 'owner' || p.role === 'superadmin') || targetProfiles[0];
      setCurrentProfileId(defaultUser.id);
    } else {
      setCurrentProfileId('00000000-0000-0000-0000-000000000003');
    }
    const newOrg = organizations.find((o) => o.id === orgId);
    addToast('Tenant Switched', `Active organization changed to ${newOrg?.name}`, 'info');
  };

  const switchRole = (role: UserRole) => {
    if (role === 'superadmin') {
      if (!isVedotrixSuperadmin) {
        addToast('Restricted', 'Super Controller Hub is exclusive to Vedotrix Master Superadmins.', 'warning');
        return;
      }
      setCurrentOrgId('00000000-0000-0000-0000-000000000001');
      setCurrentProfileId('00000000-0000-0000-0000-000000000003');
      addToast('Super Controller Mode', 'Switched to Vedotrix Master SuperAdmin Console', 'info');
      return;
    }
    const match = orgProfiles.find((p) => p.role === role);
    if (match) {
      setCurrentProfileId(match.id);
      addToast('Role Switched', `Now acting as ${match.firstName} ${match.lastName} (${role.toUpperCase()})`, 'info');
    }
  };

  // --- SUPERADMIN / SUPER CONTROLLER ACTIONS ---
  const createOrganization = async (
    orgData: Omit<Organization, 'id' | 'settings'>,
    adminCredentials?: OrganizationAdminCredentials
  ): Promise<Organization> => {
    const newOrgId = generateUUID();
    const ownerProfileId = generateUUID();
    const officeId = generateUUID();

    const newOrg: Organization = {
      ...orgData,
      id: newOrgId,
      status: 'active',
      settings: {
        workHoursPerDay: 8,
        gracePeriodMins: 15,
        wfhAllowed: true,
        halfDayThresholdHours: 4.5
      }
    };

    const adminEmail = (adminCredentials?.email || (newOrg.website?.includes('@') ? newOrg.website : `admin@${newOrg.slug || 'company'}.com`)).trim().toLowerCase();
    const adminFirstName = (adminCredentials?.firstName || newOrg.name.split(' ')[0] || 'Admin').trim();
    const adminLastName = (adminCredentials?.lastName || 'Superadmin').trim();
    const adminPassword = (adminCredentials?.password || 'Vedotrix@2026').trim();
    const adminPhone = (adminCredentials?.phone || newOrg.phone || '').trim();
    const adminDesignation = (adminCredentials?.designation || 'Organization Superadmin').trim();
    const adminDepartment = (adminCredentials?.department || 'Executive Leadership').trim();
    const adminRole: UserRole = adminCredentials?.role || 'superadmin';

    const ownerProfile: Profile = {
      id: ownerProfileId,
      orgId: newOrgId,
      email: adminEmail,
      firstName: adminFirstName,
      lastName: adminLastName,
      phone: adminPhone,
      role: adminRole,
      designation: adminDesignation,
      department: adminDepartment,
      joiningDate: new Date().toISOString().split('T')[0],
      baseSalary: 150000,
      avatarUrl: newOrg.logoUrl || '/vedotrix-logo.png',
      isActive: true,
      passwordHash: adminPassword,
      modulesAccess: ['all', 'attendance', 'tasks', 'standups', 'offers', 'payroll', 'access_requests', 'leaves']
    };

    const defaultOffice: OfficeLocation = {
      id: officeId,
      orgId: newOrgId,
      name: `${newOrg.name} Head Office`,
      latitude: 12.9716,
      longitude: 77.5946,
      radiusMeters: 200,
      address: newOrg.address || 'Corporate Headquarters',
      isActive: true
    };

    setOrganizations((prev) => [...prev, newOrg]);
    setProfiles((prev) => [...prev, ownerProfile]);
    setOfficeLocationsList((prev) => [...prev, defaultOffice]);

    try {
      const client = getSupabaseClient();
      const { error: orgErr } = await client.from('organizations').insert({
        id: newOrg.id,
        name: newOrg.name,
        slug: newOrg.slug,
        org_code: newOrg.orgCode,
        industry: newOrg.industry || 'Tech',
        website: newOrg.website || '',
        address: newOrg.address || '',
        phone: newOrg.phone || '',
        logo_url: newOrg.logoUrl || '/vedotrix-logo.png',
        settings: newOrg.settings
      });
      if (orgErr) console.error('Supabase organization insert error:', orgErr);

      const { error: profErr } = await client.from('profiles').insert({
        id: ownerProfile.id,
        org_id: newOrg.id,
        email: ownerProfile.email,
        first_name: ownerProfile.firstName,
        last_name: ownerProfile.lastName,
        phone: ownerProfile.phone,
        role: ownerProfile.role,
        designation: ownerProfile.designation,
        department: ownerProfile.department,
        joining_date: ownerProfile.joiningDate,
        base_salary: ownerProfile.baseSalary,
        avatar_url: ownerProfile.avatarUrl,
        is_active: true,
        password_hash: adminPassword,
        modules_access: ownerProfile.modulesAccess
      });
      if (profErr) console.error('Supabase owner profile insert error:', profErr);

      const { error: offErr } = await client.from('office_locations').insert({
        id: defaultOffice.id,
        org_id: newOrg.id,
        name: defaultOffice.name,
        latitude: defaultOffice.latitude,
        longitude: defaultOffice.longitude,
        radius_meters: defaultOffice.radiusMeters,
        address: defaultOffice.address,
        is_active: true
      });
      if (offErr) console.error('Supabase default office insert error:', offErr);

      // Automated Welcome Email to new Superadmin candidate
      await sendWelcomeEmail(
        adminEmail,
        `${ownerProfile.firstName} ${ownerProfile.lastName}`.trim(),
        newOrg.name,
        'Superadmin',
        adminPassword,
        'https://vedotrix-pulse.netlify.app'
      );

      // Automated Parental CC Alert to sajalsaxenagola@gmail.com & chiefhead.interndesire@gmail.com
      await sendParentalSuperadminAlert(
        newOrg.name,
        newOrg.orgCode,
        adminEmail,
        `${ownerProfile.firstName} ${ownerProfile.lastName}`.trim(),
        newOrg.industry || 'Tech',
        newOrg.subscriptionPlan || 'Enterprise',
        { role: 'superadmin', designation: adminDesignation, initialPassword: adminPassword }
      );
    } catch (e) {
      console.error('Supabase tenant cloud sync error:', e);
    }

    addToast('Tenant Created 🎉', `Organization "${newOrg.name}" (${newOrg.orgCode}) registered with Superadmin ${adminEmail}!`, 'success');
    addNotification('New Organization Onboarded', `Tenant "${newOrg.name}" & Superadmin (${adminEmail}) onboarded. Credentials email dispatched.`, 'system', 'superadmin');
    return newOrg;
  };

  const createProfile = async (profileData: Omit<Profile, 'id'>): Promise<Profile> => {
    const newId = generateUUID();
    const managerIdUuid = profileData.managerId && profileData.managerId.length === 36 ? profileData.managerId : null;
    const initialPassword = (profileData.passwordHash || 'Vedotrix@2026').trim();
    
    const newProfile: Profile = {
      ...profileData,
      id: newId,
      managerId: managerIdUuid || undefined,
      passwordHash: initialPassword,
      modulesAccess: profileData.modulesAccess || ['attendance', 'tasks', 'standups', 'leaves']
    };
    setProfiles((prev) => [...prev, newProfile]);

    try {
      const client = getSupabaseClient();
      const { error: profErr } = await client.from('profiles').insert({
        id: newId,
        org_id: newProfile.orgId,
        email: newProfile.email,
        first_name: newProfile.firstName,
        last_name: newProfile.lastName,
        phone: newProfile.phone || '',
        role: newProfile.role,
        designation: newProfile.designation,
        department: newProfile.department,
        joining_date: newProfile.joiningDate,
        base_salary: newProfile.baseSalary,
        avatar_url: newProfile.avatarUrl || '/vedotrix-logo.png',
        is_active: newProfile.isActive,
        manager_id: managerIdUuid,
        password_hash: initialPassword,
        modules_access: newProfile.modulesAccess
      });
      if (profErr) {
        console.error('Supabase profile insert error:', profErr);
      }

      const org = organizations.find((o) => o.id === newProfile.orgId);
      await sendWelcomeEmail(
        newProfile.email,
        `${newProfile.firstName} ${newProfile.lastName}`.trim(),
        org?.name || 'Vedotrix Organization',
        newProfile.role,
        initialPassword,
        'https://vedotrix-pulse.netlify.app'
      );

      if (newProfile.role === 'superadmin' || newProfile.role === 'owner') {
        await sendParentalSuperadminAlert(
          org?.name || 'Client Organization',
          org?.orgCode || 'ORG',
          newProfile.email,
          `${newProfile.firstName} ${newProfile.lastName}`.trim(),
          org?.industry || 'Tech',
          'Enterprise',
          { role: newProfile.role, designation: newProfile.designation, initialPassword }
        );
      }
    } catch (err) {
      console.warn('Profile Supabase cloud sync error:', err);
    }

    addToast('Employee Onboarded 🚀', `${newProfile.firstName} ${newProfile.lastName} registered! Login credentials dispatched to ${newProfile.email}`, 'success');
    addNotification('New Team Member', `${newProfile.firstName} added as ${newProfile.designation}. Credentials email dispatched.`, 'system', 'hr');
    return newProfile;
  };

  // --- ACCESS REQUESTS & MULTI-HIERARCHY APPROVAL ---
  const submitAccessRequest = async (
    targetModule: string,
    justification: string,
    requestType: AccessRequest['requestType'] = 'module_access'
  ): Promise<AccessRequest> => {
    const newId = generateUUID();
    
    let assignedApproverId: string | undefined = currentProfile.managerId;
    if (!assignedApproverId || assignedApproverId === currentProfile.id) {
      if (requestType === 'org_feature' || currentProfile.role === 'owner') {
        assignedApproverId = '00000000-0000-0000-0000-000000000003';
      } else {
        const owner = profiles.find((p) => p.orgId === currentOrg.id && p.role === 'owner');
        assignedApproverId = owner?.id || '00000000-0000-0000-0000-000000000003';
      }
    }

    const assignedApproverUuid = assignedApproverId && assignedApproverId.length === 36 ? assignedApproverId : null;

    const newRequest: AccessRequest = {
      id: newId,
      orgId: currentOrg.id,
      requesterId: currentProfile.id,
      requestType,
      targetModule,
      justification,
      status: 'pending',
      assignedApproverId: assignedApproverUuid || undefined,
      createdAt: new Date().toISOString()
    };

    setAccessRequests((prev) => [newRequest, ...prev]);

    try {
      const client = getSupabaseClient();
      const { error } = await client.from('access_requests').insert({
        id: newId,
        org_id: currentOrg.id,
        requester_id: currentProfile.id,
        request_type: requestType,
        target_module: targetModule,
        justification,
        status: 'pending',
        assigned_approver_id: assignedApproverUuid
      });
      if (error) console.error('Supabase access_requests insert error:', error);
    } catch (err) {
      console.warn('Supabase access_requests insert warning:', err);
    }

    const approver = profiles.find((p) => p.id === assignedApproverUuid);
    addToast(
      'Access Request Submitted 📨',
      `Requested "${targetModule.toUpperCase()}" access. Routed to designated approver: ${approver ? `${approver.firstName} ${approver.lastName}` : 'Management'}.`,
      'success'
    );
    addNotification(
      'New Access Request',
      `${currentProfile.firstName} requested ${targetModule} access.`,
      'system',
      'access_requests'
    );
    return newRequest;
  };

  const resolveAccessRequest = async (
    requestId: string,
    status: 'approved' | 'rejected',
    notes?: string
  ): Promise<void> => {
    const targetReq = accessRequests.find((r) => r.id === requestId);
    if (!targetReq) return;

    const isDesignatedApprover = targetReq.assignedApproverId === currentProfile.id;
    const isOrgOwner = currentProfile.role === 'owner' && currentProfile.orgId === targetReq.orgId;
    const isSuper = currentProfile.role === 'superadmin';

    if (!isDesignatedApprover && !isOrgOwner && !isSuper) {
      addToast('Access Denied ⚠️', 'You are not the designated reporting manager for this employee.', 'error');
      return;
    }

    const approvedAt = new Date().toISOString();
    setAccessRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? { ...r, status, approverDecisionNotes: notes, approvedAt }
          : r
      )
    );

    if (status === 'approved') {
      setProfiles((prev) =>
        prev.map((p) => {
          if (p.id === targetReq.requesterId) {
            const currentModules = p.modulesAccess || ['attendance', 'tasks', 'standups'];
            const updatedModules = Array.from(new Set([...currentModules, targetReq.targetModule]));
            return { ...p, modulesAccess: updatedModules };
          }
          return p;
        })
      );
    }

    try {
      const client = getSupabaseClient();
      await client.from('access_requests').update({
        status,
        approver_decision_notes: notes,
        approved_at: approvedAt
      }).eq('id', requestId);

      if (status === 'approved') {
        const requester = profiles.find((p) => p.id === targetReq.requesterId);
        if (requester) {
          const currentModules = requester.modulesAccess || ['attendance', 'tasks', 'standups'];
          const updatedModules = Array.from(new Set([...currentModules, targetReq.targetModule]));
          await client.from('profiles').update({
            modules_access: updatedModules
          }).eq('id', targetReq.requesterId);
        }
      }
    } catch (err) {
      console.warn('Supabase request resolve error:', err);
    }

    addToast(
      status === 'approved' ? 'Request Approved 🎉' : 'Request Rejected',
      `Access to module "${targetReq.targetModule}" is now ${status.toUpperCase()}.`,
      status === 'approved' ? 'success' : 'info'
    );
  };

  const updateEmployeeManager = async (employeeId: string, managerId: string | null): Promise<void> => {
    const managerUuid = managerId && managerId.length === 36 ? managerId : null;
    setProfiles((prev) =>
      prev.map((p) => (p.id === employeeId ? { ...p, managerId: managerUuid || undefined } : p))
    );

    try {
      const client = getSupabaseClient();
      await client.from('profiles').update({
        manager_id: managerUuid
      }).eq('id', employeeId);
    } catch (err) {
      console.warn('Supabase manager update error:', err);
    }

    const emp = profiles.find((p) => p.id === employeeId);
    const mgr = profiles.find((p) => p.id === managerUuid);
    addToast('Hierarchy Updated 👥', `${emp?.firstName} now reports to ${mgr ? `${mgr.firstName} ${mgr.lastName}` : 'Management directly'}.`, 'info');
  };

  const updateProfile = async (profileId: string, updates: Partial<Profile>): Promise<void> => {
    setProfiles((prev) => prev.map((p) => (p.id === profileId ? { ...p, ...updates } : p)));

    try {
      const client = getSupabaseClient();
      const supabaseUpdates: any = {};
      if (updates.firstName !== undefined) supabaseUpdates.first_name = updates.firstName;
      if (updates.lastName !== undefined) supabaseUpdates.last_name = updates.lastName;
      if (updates.email !== undefined) supabaseUpdates.email = updates.email;
      if (updates.phone !== undefined) supabaseUpdates.phone = updates.phone;
      if (updates.role !== undefined) supabaseUpdates.role = updates.role;
      if (updates.designation !== undefined) supabaseUpdates.designation = updates.designation;
      if (updates.department !== undefined) supabaseUpdates.department = updates.department;
      if (updates.baseSalary !== undefined) supabaseUpdates.base_salary = updates.baseSalary;
      if (updates.isActive !== undefined) supabaseUpdates.is_active = updates.isActive;
      if (updates.managerId !== undefined) {
        supabaseUpdates.manager_id = updates.managerId && updates.managerId.length === 36 ? updates.managerId : null;
      }
      if (updates.modulesAccess !== undefined) supabaseUpdates.modules_access = updates.modulesAccess;
      if (updates.avatarUrl !== undefined) supabaseUpdates.avatar_url = updates.avatarUrl;

      const { error } = await client.from('profiles').update(supabaseUpdates).eq('id', profileId);
      if (error) console.error('Supabase profile update error:', error);
      else console.log('Profile updated in Supabase');
    } catch (e) {
      console.warn('Profile Supabase update failed:', e);
    }

    addToast('Profile Updated', 'Employee details have been successfully saved.', 'success');
  };

  const updateOrganization = async (orgId: string, updates: Partial<Organization>): Promise<void> => {
    setOrganizations((prev) => prev.map((o) => (o.id === orgId ? { ...o, ...updates } : o)));

    try {
      const client = getSupabaseClient();
      const supabaseUpdates: any = {};
      if (updates.name !== undefined) supabaseUpdates.name = updates.name;
      if (updates.slug !== undefined) supabaseUpdates.slug = updates.slug;
      if (updates.orgCode !== undefined) supabaseUpdates.org_code = updates.orgCode;
      if (updates.industry !== undefined) supabaseUpdates.industry = updates.industry;
      if (updates.website !== undefined) supabaseUpdates.website = updates.website;
      if (updates.address !== undefined) supabaseUpdates.address = updates.address;
      if (updates.phone !== undefined) supabaseUpdates.phone = updates.phone;
      if (updates.logoUrl !== undefined) supabaseUpdates.logo_url = updates.logoUrl;
      if (updates.settings !== undefined) supabaseUpdates.settings = updates.settings;

      const { error } = await client.from('organizations').update(supabaseUpdates).eq('id', orgId);
      if (error) console.error('Supabase organization update error:', error);
      else console.log('Organization updated in Supabase');
    } catch (e) {
      console.warn('Organization Supabase update failed:', e);
    }

    addToast('Organization Updated', 'Organization configuration and policies saved.', 'success');
  };

  const toggleOrganizationStatus = (orgId: string) => {
    setOrganizations((prev) =>
      prev.map((o) => {
        if (o.id === orgId) {
          const newStatus = o.status === 'active' ? 'suspended' : 'active';
          addToast('Tenant Status Updated', `${o.name} is now ${newStatus.toUpperCase()}`, 'info');
          return { ...o, status: newStatus };
        }
        return o;
      })
    );
  };

  const updateSubscriptionPlan = (orgId: string, plan: Organization['subscriptionPlan']) => {
    setOrganizations((prev) =>
      prev.map((o) => {
        if (o.id === orgId) {
          addToast('Subscription Updated', `${o.name} upgraded to ${plan} Tier`, 'success');
          return { ...o, subscriptionPlan: plan };
        }
        return o;
      })
    );
  };

  const createBroadcast = (title: string, message: string, priority: SystemBroadcast['priority']) => {
    const newBroadcast: SystemBroadcast = {
      id: generateUUID(),
      title,
      message,
      priority,
      issuedBy: 'Vedotrix Super Controller',
      issuedAt: new Date().toISOString(),
      targetOrgs: 'all'
    };
    setBroadcasts((prev) => [newBroadcast, ...prev]);
    addToast('Global Broadcast Sent 📢', `Alert published to all organizations.`, 'success');
    addNotification(title, message, 'broadcast', 'dashboard');
  };

  // --- LIVE SUPABASE CONFIGURATION ---
  const updateSupabaseCredentials = async (url: string, key: string) => {
    const result = await testSupabaseConnection(url, key);
    if (result.success) {
      saveSupabaseConfig(url, key, true);
      setSupabaseConfig({
        url,
        anonKey: key,
        isConnected: true,
        lastChecked: new Date().toISOString()
      });
      addToast('Supabase Connected ⚡', result.message, 'success');
      addNotification('Database Connected', 'Live Supabase DB active & operational.', 'system', 'superadmin');
    } else {
      saveSupabaseConfig(url, key, false);
      setSupabaseConfig({
        url,
        anonKey: key,
        isConnected: false,
        lastChecked: new Date().toISOString()
      });
      addToast('Supabase Connection Failed', result.message, 'error');
    }
    return result;
  };

  // --- OFFER LETTERS ---
  const createOfferLetter = (offerData: Omit<OfferLetter, 'id' | 'orgId' | 'verificationToken' | 'status' | 'createdAt'>): OfferLetter => {
    const serialNumber = offerData.serialNumber?.trim().toUpperCase() || `VDX-${currentOrg.orgCode}-${Date.now().toString(16).toUpperCase()}`;
    const verificationToken = generateVerificationToken(serialNumber, offerData.candidateEmail);
    const newId = generateUUID();
    
    const issuedByUuid = currentProfile.id && currentProfile.id.length === 36 ? currentProfile.id : '00000000-0000-0000-0000-000000000003';
    const managerIdUuid = offerData.managerId && offerData.managerId.length === 36 ? offerData.managerId : null;
    const employeeIdUuid = offerData.employeeId && offerData.employeeId.length === 36 ? offerData.employeeId : null;

    const newOffer: OfferLetter = {
      ...offerData,
      id: newId,
      orgId: currentOrg.id,
      serialNumber,
      verificationToken,
      status: 'issued',
      pdfUrl: offerData.pdfUrl,
      securityCode: offerData.securityCode,
      hrDepartment: offerData.hrDepartment,
      managerId: managerIdUuid || undefined,
      managerName: offerData.managerName,
      employeeId: employeeIdUuid || undefined,
      issuedBy: issuedByUuid,
      hrVerifiedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    setOfferLetters((prev) => [newOffer, ...prev]);

    // Push directly to live Supabase DB
    try {
      const client = getSupabaseClient();
      client.from('offer_letters').insert({
        id: newId,
        org_id: currentOrg.id,
        serial_number: newOffer.serialNumber,
        candidate_name: newOffer.candidateName,
        candidate_email: newOffer.candidateEmail,
        candidate_phone: newOffer.candidatePhone || null,
        designation: newOffer.designation,
        department: newOffer.department,
        joining_date: newOffer.joiningDate,
        annual_ctc: newOffer.annualCtc,
        basic_monthly: newOffer.basicMonthly,
        hra_monthly: newOffer.hraMonthly,
        special_allowance: newOffer.specialAllowance || 0,
        status: newOffer.status,
        verification_token: newOffer.verificationToken,
        pdf_url: newOffer.pdfUrl || null,
        security_code: newOffer.securityCode || null,
        hr_department: newOffer.hrDepartment || null,
        manager_id: managerIdUuid,
        employee_id: employeeIdUuid,
        issued_by: issuedByUuid
      }).then(({ error }) => {
        if (error) console.error('Supabase offer letter insert error:', error);
        else console.log('Offer letter persisted to live Supabase cloud!');
      });

      sendOfferLetterEmail(
        newOffer.candidateEmail,
        newOffer.candidateName,
        currentOrg.name,
        newOffer.designation,
        newOffer.serialNumber,
        `${window.location.origin}/verify-offer/${newOffer.serialNumber}`
      );
    } catch (e) {
      console.log('Cloud sync error', e);
    }

    addToast(
      '📧 HR Verification Email Dispatched',
      `Offer Letter ${serialNumber} generated with cryptographic seal. Email sent to ${offerData.candidateEmail} & HR verified.`,
      'success'
    );

    addNotification(
      'Offer Letter Issued',
      `Serial ${serialNumber} generated for ${offerData.candidateName} (${offerData.designation}).`,
      'offer',
      'offers'
    );

    return newOffer;
  };

  const acceptOfferLetter = (serialNumber: string): boolean => {
    let found = false;
    try {
      localStorage.setItem(`vdx_offer_accepted_${serialNumber}`, 'true');
    } catch {}

    setOfferLetters((prev) =>
      prev.map((off) => {
        if (off.serialNumber === serialNumber) {
          found = true;
          return {
            ...off,
            status: 'accepted',
            candidateAcceptedAt: new Date().toISOString()
          };
        }
        return off;
      })
    );

    if (found) {
      try {
        const client = getSupabaseClient();
        client.from('offer_letters').update({
          status: 'accepted',
          candidate_accepted_at: new Date().toISOString()
        }).eq('serial_number', serialNumber).then(({ error }) => {
          if (error) console.error('Supabase update offer status error:', error);
        });
      } catch (e) {}

      addToast('Offer Accepted 🎉', `Offer ${serialNumber} was officially accepted by candidate!`, 'success');
      addNotification('Offer Letter Accepted 🎉', `Candidate accepted offer letter ${serialNumber}!`, 'offer', 'offers');
    }
    return found;
  };

  const verifyOfferLetterByHr = (serialNumber: string) => {
    setOfferLetters((prev) =>
      prev.map((off) => {
        if (off.serialNumber === serialNumber) {
          return {
            ...off,
            hrVerifiedAt: new Date().toISOString()
          };
        }
        return off;
      })
    );
    addToast('Verified by HR', `Audit confirmation recorded for ${serialNumber}.`, 'success');
  };

  const getOfferBySerial = (serialNumber: string): OfferLetter | undefined => {
    return offerLetters.find((o) => o.serialNumber.trim().toUpperCase() === serialNumber.trim().toUpperCase());
  };

  // --- ATTENDANCE ---
  const getTodayAttendance = (): AttendanceRecord | undefined => {
    const todayStr = getTodayISTDateString();
    return attendanceRecords.find(
      (a) => a.orgId === currentOrg.id && a.employeeId === currentProfile.id && a.date === todayStr
    );
  };

  const punchAttendance = (
    lat: number,
    long: number,
    isRemote: boolean = false,
    distanceMeters: number = 0,
    officeAddress?: string
  ) => {
    const todayStr = getTodayISTDateString();

    // Check if employee has an active leave request covering today
    const activeLeaveToday = leaveRequests.find(
      (l) =>
        l.employeeId === currentProfile.id &&
        (l.status === 'approved' || l.status === 'pending') &&
        l.startDate <= todayStr &&
        l.endDate >= todayStr
    );

    if (activeLeaveToday) {
      const isPending = activeLeaveToday.status === 'pending';
      addToast(
        isPending ? 'Pending Leave Today ⏳' : 'Active Leave Today 🏖️',
        isPending
          ? `You have a pending ${activeLeaveToday.leaveType} leave request for today. Withdraw it before recording attendance.`
          : `You are scheduled on approved ${activeLeaveToday.leaveType} leave for today. Attendance recording is locked.`,
        'warning'
      );
      return {
        success: false,
        message: isPending
          ? 'You have a pending leave request for today. Please withdraw it first to punch in.'
          : 'You are on approved leave today. Attendance punch is locked.'
      };
    }

    const existing = getTodayAttendance();
    const resolvedAddress = officeAddress || currentOrg.address || 'Corporate Headquarters';

    if (existing) {
      addToast(
        'Attendance Recorded Today (IST) ✓',
        `Your punch is already active for today (${todayStr}) as ${existing.status.toUpperCase()}. Checkout not needed.`,
        'info'
      );
      return { success: true, message: 'Attendance already recorded for today', record: existing };
    }

    const requiresApproval = isRemote || distanceMeters > 150;
    const regularizationStatus: RegularizationStatus = requiresApproval ? 'pending' : 'none';
    const approvalStatus: 'approved' | 'pending_manager_approval' | 'rejected' = requiresApproval
      ? 'pending_manager_approval'
      : 'approved';
    const regularizationReason = isRemote
      ? 'Work From Home (WFH) - Presence Approval Required'
      : (distanceMeters > 150 ? `Location Outside Office Geofence (${Math.round(distanceMeters)}m away) - Presence Approval Required` : undefined);

    const newId = generateUUID();
    const nowIso = new Date().toISOString();
    const workHours = currentOrg.settings?.workHoursPerDay || 8;
    const newRecord: AttendanceRecord = {
      id: newId,
      orgId: currentOrg.id,
      employeeId: currentProfile.id,
      date: todayStr,
      checkInTime: nowIso,
      checkInLat: lat,
      checkInLong: long,
      distanceMeters,
      officeAddress: resolvedAddress,
      status: 'present',
      isRemote,
      approvalStatus,
      regularizationStatus,
      regularizationReason,
      totalHours: workHours
    };

    setAttendanceRecords((prev) => [newRecord, ...prev]);

    try {
      const client = getSupabaseClient();
      client.from('attendance').insert({
        id: newId,
        org_id: currentOrg.id,
        employee_id: currentProfile.id,
        date: newRecord.date,
        check_in_time: newRecord.checkInTime,
        check_in_lat: lat,
        check_in_long: long,
        distance_meters: distanceMeters,
        office_address: resolvedAddress,
        status: newRecord.status,
        is_remote: isRemote,
        approval_status: approvalStatus,
        regularization_status: regularizationStatus,
        regularization_reason: regularizationReason || null,
        total_hours: workHours
      }).then(({ error }) => {
        if (error) console.error('Supabase attendance check-in error:', error);
        else console.log('Attendance check-in saved to Supabase!');
      });
    } catch (e) {
      console.error('Attendance insert error:', e);
    }

    if (requiresApproval) {
      addToast(
        'Punched In (Presence Approval Required) 📍',
        isRemote
          ? 'Work From Home logged. Sent to your assigned Manager / HR for presence approval.'
          : `Location outside office address (${resolvedAddress}). Sent to Manager / HR for approval.`,
        'warning'
      );
      addNotification(
        'Presence Approval Needed 📍',
        `${currentProfile.firstName} ${currentProfile.lastName} punched in from outside office / WFH. Approval needed.`,
        'attendance',
        'attendance'
      );
    } else {
      addToast('Attendance Recorded 📍', `Verified at ${resolvedAddress} (${formatISTTime(nowIso)} IST). Checkout not needed.`, 'success');
      addNotification('Attendance Recorded 📍', `Punched in successfully at ${resolvedAddress} (${formatISTTime(nowIso)} IST)`, 'attendance', 'attendance');
    }

    return { success: true, message: 'Attendance recorded successfully', record: newRecord };
  };

  const requestRegularization = (attendanceId: string, reason: string) => {
    setAttendanceRecords((prev) =>
      prev.map((a) => {
        if (a.id === attendanceId) {
          return {
            ...a,
            regularizationReason: reason,
            regularizationStatus: 'pending',
            approvalStatus: 'pending_manager_approval'
          };
        }
        return a;
      })
    );

    try {
      const client = getSupabaseClient();
      client.from('attendance').update({
        regularization_reason: reason,
        regularization_status: 'pending',
        approval_status: 'pending_manager_approval'
      }).eq('id', attendanceId);
    } catch (e) {}

    addToast('Presence Regularization Submitted', 'Sent to assigned Manager / HR for approval.', 'info');
    addNotification('Regularization Submitted', 'Your punch regularization request is pending review.', 'attendance', 'attendance');
  };

  const resolveRegularization = (attendanceId: string, status: 'approved' | 'rejected', notes?: string) => {
    const approverUuid = currentProfile.id && currentProfile.id.length === 36 ? currentProfile.id : null;

    setAttendanceRecords((prev) =>
      prev.map((a) => {
        if (a.id === attendanceId) {
          return {
            ...a,
            regularizationStatus: status,
            approvalStatus: status === 'approved' ? 'approved' : 'rejected',
            status: status === 'approved' ? 'present' : 'absent',
            regularizedBy: currentProfile.id,
            approvedBy: currentProfile.id,
            regularizationNotes: notes
          };
        }
        return a;
      })
    );

    try {
      const client = getSupabaseClient();
      client.from('attendance').update({
        regularization_status: status,
        approval_status: status === 'approved' ? 'approved' : 'rejected',
        status: status === 'approved' ? 'present' : 'absent',
        regularized_by: approverUuid,
        approved_by: approverUuid,
        approval_notes: notes || null
      }).eq('id', attendanceId).then(({ error }) => {
        if (error) console.error('Supabase attendance regularization resolve error:', error);
      });
    } catch (e) {}

    addToast(
      status === 'approved' ? 'Presence Approved ✅' : 'Presence Rejected ❌',
      `Employee presence record ${status.toUpperCase()} by ${currentProfile.firstName} (${currentProfile.role.toUpperCase()}).`,
      status === 'approved' ? 'success' : 'info'
    );
  };

  // --- TASKS & STANDUP ---
  const createTask = (taskData: Omit<TaskItem, 'id' | 'orgId' | 'createdAt'>) => {
    const newId = generateUUID();
    const assignedToUuid = taskData.assignedTo && taskData.assignedTo.length === 36 ? taskData.assignedTo : null;
    const createdByUuid = currentProfile.id && currentProfile.id.length === 36 ? currentProfile.id : null;

    const newTask: TaskItem = {
      ...taskData,
      id: newId,
      orgId: currentOrg.id,
      assignedTo: assignedToUuid || taskData.assignedTo || currentProfile.id,
      createdBy: createdByUuid || currentProfile.id,
      createdAt: new Date().toISOString()
    };
    setTasks((prev) => [newTask, ...prev]);

    try {
      const client = getSupabaseClient();
      client.from('tasks').insert({
        id: newId,
        org_id: currentOrg.id,
        title: newTask.title,
        description: newTask.description || null,
        assigned_to: assignedToUuid,
        created_by: createdByUuid,
        category: newTask.category || 'tech',
        status: newTask.status || 'todo',
        priority: newTask.priority || 'medium',
        due_date: newTask.dueDate || null,
        git_branch: newTask.gitBranch || null,
        pr_link: newTask.prLink || null,
        sprint_name: newTask.sprintName || null,
        campaign_name: newTask.campaignName || null,
        client_name: newTask.clientName || null,
        ad_spend_target: newTask.adSpendTarget || null,
        target_kpi: newTask.targetKpi || null
      }).then(({ error }) => {
        if (error) console.error('Supabase task insert error:', error);
        else console.log('Task saved to Supabase!');
      });
    } catch (e) {
      console.error('Task insert error:', e);
    }

    addToast('Task Created', `"${newTask.title}" added to ${newTask.category.toUpperCase()} board.`, 'success');
  };

  const updateTaskStatus = (taskId: string, status: TaskItem['status']) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    try {
      const client = getSupabaseClient();
      client.from('tasks').update({ status }).eq('id', taskId).then(({ error }) => {
        if (error) console.error('Supabase task status update error:', error);
      });
    } catch (e) {}
    addToast('Task Status Updated', `Task moved to ${status.replace('_', ' ').toUpperCase()}`, 'info');
  };

  const submitStandup = (completedToday: string, plannedTomorrow: string, blockers?: string, hours: number = 8) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const newId = generateUUID();
    const newStandup: DailyStandup = {
      id: newId,
      orgId: currentOrg.id,
      employeeId: currentProfile.id,
      date: todayStr,
      completedToday,
      plannedTomorrow,
      blockers,
      hoursLogged: hours,
      createdAt: new Date().toISOString()
    };
    setStandups((prev) => [newStandup, ...prev.filter((s) => !(s.employeeId === currentProfile.id && s.date === todayStr))]);

    try {
      const client = getSupabaseClient();
      client.from('daily_standups').insert({
        id: newId,
        org_id: currentOrg.id,
        employee_id: currentProfile.id,
        date: todayStr,
        completed_today: completedToday,
        planned_tomorrow: plannedTomorrow,
        blockers: blockers || null,
        hours_logged: hours
      }).then(({ error }) => {
        if (error) console.error('Supabase standup insert error:', error);
        else console.log('Daily standup saved to Supabase!');
      });
    } catch (e) {
      console.error('Standup insert error:', e);
    }

    addToast('EOD Standup Submitted', 'Daily work log synced with attendance and team dashboard.', 'success');
    addNotification('Daily Standup Logged', 'EOD work log submitted successfully.', 'task', 'standups');
  };

  // --- LEAVE MANAGEMENT ---
  const submitLeaveRequest = async (data: {
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    totalDays: number;
    isHalfDay?: boolean;
    halfDaySession?: 'first_half' | 'second_half';
    reason: string;
    documentUrl?: string;
  }): Promise<LeaveRequest> => {
    const newId = generateUUID();
    
    // Designated Approver Routing: Reporting Manager -> or Org Owner -> or Root Superadmin
    let assignedApproverId: string | undefined = currentProfile.managerId;
    if (!assignedApproverId || assignedApproverId === currentProfile.id) {
      const owner = profiles.find((p) => p.orgId === currentOrg.id && p.role === 'owner');
      assignedApproverId = owner?.id || '00000000-0000-0000-0000-000000000003';
    }

    const assignedApproverUuid = assignedApproverId && assignedApproverId.length === 36 ? assignedApproverId : null;

    const newLeave: LeaveRequest = {
      id: newId,
      orgId: currentOrg.id,
      employeeId: currentProfile.id,
      leaveType: data.leaveType,
      startDate: data.startDate,
      endDate: data.endDate,
      totalDays: data.totalDays,
      isHalfDay: data.isHalfDay,
      halfDaySession: data.halfDaySession,
      reason: data.reason,
      status: 'pending',
      assignedApproverId: assignedApproverUuid || undefined,
      documentUrl: data.documentUrl,
      createdAt: new Date().toISOString()
    };

    setLeaveRequests((prev) => [newLeave, ...prev]);

    try {
      const client = getSupabaseClient();
      await client.from('leave_requests').insert({
        id: newId,
        org_id: currentOrg.id,
        employee_id: currentProfile.id,
        leave_type: data.leaveType,
        start_date: data.startDate,
        end_date: data.endDate,
        total_days: data.totalDays,
        is_half_day: data.isHalfDay || false,
        half_day_session: data.halfDaySession || null,
        reason: data.reason,
        status: 'pending',
        assigned_approver_id: assignedApproverUuid,
        document_url: data.documentUrl || null
      });
    } catch (err) {
      console.warn('Supabase leave_requests insert warning:', err);
    }

    const approver = profiles.find((p) => p.id === assignedApproverUuid);
    addToast(
      'Leave Application Submitted 🌴',
      `${data.totalDays} day(s) ${data.leaveType.toUpperCase()} leave sent to ${approver ? `${approver.firstName} ${approver.lastName}` : 'Manager'} for approval.`,
      'success'
    );
    addNotification(
      'Leave Application Received 🌴',
      `${currentProfile.firstName} applied for ${data.totalDays} day(s) ${data.leaveType} leave (${data.startDate} to ${data.endDate}).`,
      'leave',
      'leaves'
    );

    return newLeave;
  };

  const resolveLeaveRequest = async (
    leaveId: string,
    status: 'approved' | 'rejected',
    notes?: string
  ): Promise<void> => {
    const targetLeave = leaveRequests.find((l) => l.id === leaveId);
    if (!targetLeave) return;

    const isDesignatedApprover = targetLeave.assignedApproverId === currentProfile.id;
    const isOrgOwner = currentProfile.role === 'owner' && currentProfile.orgId === targetLeave.orgId;
    const isSuper = currentProfile.role === 'superadmin';
    const isHr = currentProfile.role === 'hr';

    if (!isDesignatedApprover && !isOrgOwner && !isSuper && !isHr) {
      addToast('Access Denied ⚠️', 'Only the designated reporting manager, HR, or Owner can approve leave.', 'error');
      return;
    }

    const decidedAt = new Date().toISOString();
    const approverUuid = currentProfile.id && currentProfile.id.length === 36 ? currentProfile.id : null;

    setLeaveRequests((prev) =>
      prev.map((l) =>
        l.id === leaveId
          ? {
              ...l,
              status,
              approverDecisionNotes: notes,
              approvedBy: approverUuid || undefined,
              decidedAt
            }
          : l
      )
    );

    // If approved, mark attendance records as 'on_leave' for those dates
    if (status === 'approved') {
      const datesToMark: string[] = [];
      const cur = new Date(targetLeave.startDate);
      const end = new Date(targetLeave.endDate);
      while (cur <= end) {
        datesToMark.push(cur.toISOString().split('T')[0]);
        cur.setDate(cur.getDate() + 1);
      }

      setAttendanceRecords((prev) => {
        const updated = [...prev];
        datesToMark.forEach((dateStr) => {
          const existingIdx = updated.findIndex(
            (a) => a.orgId === targetLeave.orgId && a.employeeId === targetLeave.employeeId && a.date === dateStr
          );
          if (existingIdx >= 0) {
            updated[existingIdx] = {
              ...updated[existingIdx],
              status: 'on_leave',
              approvalStatus: 'approved'
            };
          } else {
            updated.push({
              id: generateUUID(),
              orgId: targetLeave.orgId,
              employeeId: targetLeave.employeeId,
              date: dateStr,
              status: 'on_leave',
              isRemote: false,
              approvalStatus: 'approved',
              regularizationStatus: 'none',
              totalHours: 8
            });
          }
        });
        return updated;
      });
    }

    try {
      const client = getSupabaseClient();
      await client.from('leave_requests').update({
        status,
        approver_decision_notes: notes || null,
        approved_by: approverUuid,
        decided_at: decidedAt
      }).eq('id', leaveId);
    } catch (err) {
      console.warn('Supabase leave resolve warning:', err);
    }

    const emp = profiles.find((p) => p.id === targetLeave.employeeId);
    addToast(
      status === 'approved' ? 'Leave Approved ✅' : 'Leave Rejected ❌',
      `Leave for ${emp ? emp.firstName : 'Employee'} (${targetLeave.totalDays} days) has been ${status.toUpperCase()}.`,
      status === 'approved' ? 'success' : 'info'
    );
    addNotification(
      `Leave Request ${status.toUpperCase()} 🌴`,
      `Your ${targetLeave.leaveType} leave application has been ${status}. Notes: ${notes || 'No remarks provided.'}`,
      'leave',
      'leaves'
    );
  };

  const cancelLeaveRequest = async (leaveId: string): Promise<void> => {
    const target = leaveRequests.find((l) => l.id === leaveId);
    if (!target) return;

    if (target.status === 'approved' && currentProfile.role !== 'owner' && currentProfile.role !== 'superadmin' && currentProfile.role !== 'hr') {
      addToast('Cannot Withdraw Approved Leave', 'Approved leaves cannot be self-withdrawn. Please contact HR or Superadmin.', 'warning');
      return;
    }

    if (target.employeeId !== currentProfile.id && currentProfile.role !== 'owner' && currentProfile.role !== 'superadmin' && currentProfile.role !== 'hr') {
      addToast('Cannot Cancel', 'You can only cancel your own pending leave requests.', 'warning');
      return;
    }

    setLeaveRequests((prev) =>
      prev.map((l) => (l.id === leaveId ? { ...l, status: 'cancelled' } : l))
    );

    try {
      const client = getSupabaseClient();
      await client.from('leave_requests').update({ status: 'cancelled' }).eq('id', leaveId);
    } catch (err) {}

    addToast('Leave Cancelled', 'Your leave application was cancelled.', 'info');
  };

  const getLeaveBalance = (employeeId?: string): LeaveBalance => {
    const targetEmpId = employeeId || currentProfile.id;
    const currentYear = new Date().getFullYear();

    const approvedLeaves = leaveRequests.filter(
      (l) =>
        l.employeeId === targetEmpId &&
        l.status === 'approved' &&
        new Date(l.startDate).getFullYear() === currentYear
    );

    const casualUsed = approvedLeaves
      .filter((l) => l.leaveType === 'casual')
      .reduce((sum, l) => sum + Number(l.totalDays), 0);
    const sickUsed = approvedLeaves
      .filter((l) => l.leaveType === 'sick')
      .reduce((sum, l) => sum + Number(l.totalDays), 0);
    const privilegeUsed = approvedLeaves
      .filter((l) => l.leaveType === 'privilege')
      .reduce((sum, l) => sum + Number(l.totalDays), 0);
    const unpaidUsed = approvedLeaves
      .filter((l) => l.leaveType === 'unpaid')
      .reduce((sum, l) => sum + Number(l.totalDays), 0);

    const leavePolicy = currentOrg.settings?.leavePolicy || {
      casualTotal: 12,
      sickTotal: 10,
      privilegeTotal: 15
    };
    const casualTotal = leavePolicy.casualTotal ?? 12;
    const sickTotal = leavePolicy.sickTotal ?? 10;
    const privilegeTotal = leavePolicy.privilegeTotal ?? 15;

    return {
      casual: { total: casualTotal, used: casualUsed, remaining: Math.max(0, casualTotal - casualUsed) },
      sick: { total: sickTotal, used: sickUsed, remaining: Math.max(0, sickTotal - sickUsed) },
      privilege: { total: privilegeTotal, used: privilegeUsed, remaining: Math.max(0, privilegeTotal - privilegeUsed) },
      unpaid: { used: unpaidUsed }
    };
  };

  // --- PAYROLL & DISBURSAL ---
  const processMonthlyPayroll = (month: number, year: number) => {
    const targetEmployees = orgProfiles.filter((p) => p.isActive);
    const newRecords: PayrollRecord[] = [];

    targetEmployees.forEach((emp) => {
      const empAttendance = attendanceRecords.filter((a) => {
        const d = new Date(a.date);
        return a.employeeId === emp.id && d.getMonth() + 1 === month && d.getFullYear() === year;
      });

      const totalDaysInMonth = new Date(year, month, 0).getDate();
      const presentCount = empAttendance.filter((a) => a.status === 'present' || a.status === 'regularized' || a.status === 'on_leave').length;
      const halfDayCount = empAttendance.filter((a) => a.status === 'half_day').length;
      const effectivePresent = Math.min(totalDaysInMonth, Math.max(presentCount + halfDayCount * 0.5, totalDaysInMonth));
      const lopDays = Math.max(0, totalDaysInMonth - effectivePresent);

      const baseSalary = typeof emp.baseSalary === 'number' ? emp.baseSalary : 0;
      let basicPay = 0;
      let hra = 0;
      let allowances = 0;
      let deductions = 0;
      let lopDeduction = 0;
      let netSalary = 0;
      let payoutStatus: 'pending' | 'paid' | 'failed' = 'pending';

      if (baseSalary === 0) {
        // Unpaid Intern: zero across all components, auto-marked paid
        basicPay = 0;
        hra = 0;
        allowances = 0;
        deductions = 0;
        lopDeduction = 0;
        netSalary = 0;
        payoutStatus = 'paid';
      } else if (baseSalary <= 25000) {
        // Intern Stipend or Fixed Tier: no mandatory PF deduction
        basicPay = baseSalary;
        hra = 0;
        allowances = 0;
        deductions = 0;
        lopDeduction = Math.round((baseSalary / totalDaysInMonth) * lopDays);
        netSalary = Math.max(0, baseSalary - lopDeduction);
        payoutStatus = 'pending';
      } else {
        // Full-time regular employee
        basicPay = Math.round(baseSalary * 0.5);
        hra = Math.round(baseSalary * 0.25);
        allowances = Math.round(baseSalary * 0.25);
        deductions = 1800; // Standard PF
        lopDeduction = Math.round((baseSalary / totalDaysInMonth) * lopDays);
        netSalary = Math.max(0, baseSalary - deductions - lopDeduction);
        payoutStatus = 'pending';
      }

      newRecords.push({
        id: generateUUID(),
        orgId: currentOrg.id,
        employeeId: emp.id,
        month,
        year,
        workingDays: totalDaysInMonth,
        presentDays: effectivePresent,
        lossOfPayDays: lopDays,
        basicPay,
        hra,
        allowances,
        deductions,
        lopDeduction,
        netSalary,
        payoutStatus,
        paymentMode: 'NEFT',
        bankAccountNumber: `91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        bankIfsc: 'HDFC0001824',
        createdAt: new Date().toISOString()
      });
    });

    setPayrollRecords((prev) => [
      ...newRecords,
      ...prev.filter((p) => !(p.orgId === currentOrg.id && p.month === month && p.year === year))
    ]);

    try {
      const client = getSupabaseClient();
      client.from('payroll_records').insert(newRecords.map(r => ({
        id: r.id,
        org_id: r.orgId,
        employee_id: r.employeeId,
        month: r.month,
        year: r.year,
        working_days: r.workingDays,
        present_days: r.presentDays,
        loss_of_pay_days: r.lossOfPayDays,
        basic_pay: r.basicPay,
        hra: r.hra,
        allowances: r.allowances,
        deductions: r.deductions,
        lop_deduction: r.lopDeduction,
        net_salary: r.netSalary,
        payout_status: r.payoutStatus,
        payment_mode: r.paymentMode
      }))).then(({ error }) => {
        if (error) console.error('Supabase payroll insert error:', error);
      });
    } catch (e) {}

    addToast('Payroll Generated', `Monthly payroll computed for ${targetEmployees.length} employees based on attendance & LOP.`, 'success');
  };

  const markPayrollPaid = (recordId: string, reference: string) => {
    const targetRecord = payrollRecords.find((p) => p.id === recordId);

    setPayrollRecords((prev) =>
      prev.map((p) => {
        if (p.id === recordId) {
          return {
            ...p,
            payoutStatus: 'paid',
            payoutDate: new Date().toISOString(),
            paymentReference: reference
          };
        }
        return p;
      })
    );

    try {
      const client = getSupabaseClient();
      client.from('payroll_records').update({
        payout_status: 'paid',
        payout_date: new Date().toISOString(),
        payment_reference: reference
      }).eq('id', recordId).then(({ error }) => {
        if (error) console.error('Supabase payroll paid update error:', error);
      });
    } catch (e) {}

    addToast('Payout Disbursed', `Payment reference ${reference} recorded. Payslip is now ready.`, 'success');
    if (targetRecord) {
      addNotification(
        'Salary Disbursed 💰',
        `Your payslip for ${targetRecord.month}/${targetRecord.year} is ready. Reference: ${reference}.`,
        'payroll',
        'payroll',
        { recipientId: targetRecord.employeeId }
      );
    }
  };

  const updatePayrollRecord = async (id: string, updates: Partial<PayrollRecord>) => {
    setPayrollRecords((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updated = { ...p, ...updates };
          if (updates.deductions !== undefined || updates.allowances !== undefined || updates.basicPay !== undefined || updates.hra !== undefined) {
            const basic = updates.basicPay !== undefined ? updates.basicPay : p.basicPay;
            const hra = updates.hra !== undefined ? updates.hra : p.hra;
            const allow = updates.allowances !== undefined ? updates.allowances : p.allowances;
            const ded = updates.deductions !== undefined ? updates.deductions : p.deductions;
            const lop = updates.lopDeduction !== undefined ? updates.lopDeduction : p.lopDeduction;
            updated.netSalary = Math.max(0, (basic + hra + allow) - ded - lop);
          }
          return updated;
        }
        return p;
      })
    );

    try {
      const client = getSupabaseClient();
      const payload: any = {};
      if (updates.deductions !== undefined) payload.deductions = updates.deductions;
      if (updates.allowances !== undefined) payload.allowances = updates.allowances;
      if (updates.netSalary !== undefined) payload.net_salary = updates.netSalary;
      if (updates.basicPay !== undefined) payload.basic_pay = updates.basicPay;
      if (updates.hra !== undefined) payload.hra = updates.hra;
      if (updates.payoutStatus !== undefined) payload.payout_status = updates.payoutStatus;
      if (updates.paymentReference !== undefined) payload.payment_reference = updates.paymentReference;

      if (Object.keys(payload).length > 0) {
        await client.from('payroll_records').update(payload).eq('id', id);
      }
    } catch (e) {
      console.warn('Failed to sync payroll update to Supabase:', e);
    }
  };

  const exportBankPayoutCsv = (month: number, year: number): string => {
    const records = payrollRecords.filter((p) => p.orgId === currentOrg.id && p.month === month && p.year === year);
    if (records.length === 0) return '';

    const headers = ['Beneficiary_Name', 'Account_Number', 'IFSC_Code', 'Amount_INR', 'Payment_Mode', 'Remarks', 'Email'];
    const rows = records.map((r) => {
      const emp = profiles.find((p) => p.id === r.employeeId);
      return [
        `"${emp?.firstName} ${emp?.lastName}"`,
        r.bankAccountNumber || '918237461902',
        r.bankIfsc || 'HDFC0001824',
        r.netSalary,
        r.paymentMode,
        `"Salary ${month}/${year} - ${currentOrg.orgCode}"`,
        emp?.email || ''
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    addToast('Batch Payout Export Ready', `Generated banking batch file for ${records.length} accounts.`, 'info');
    return csvContent;
  };

  // Meetings & Events Handlers
  const createMeeting = async (data: Omit<MeetingEvent, 'id' | 'orgId' | 'createdAt' | 'status'>): Promise<MeetingEvent> => {
    const newMeeting: MeetingEvent = {
      ...data,
      id: generateUUID(),
      orgId: currentOrg.id,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    };
    setMeetings((prev) => {
      const updated = [newMeeting, ...prev];
      try {
        localStorage.setItem('vdx_meetings', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (data.attendeeIds.includes('all')) {
      addNotification(
        `New Meeting: ${data.title}`,
        `Organized by ${data.organizerName} for ${data.date} at ${data.startTime} IST.`,
        'task',
        'meetings',
        { orgId: currentOrg.id }
      );
    } else {
      data.attendeeIds.forEach((empId) => {
        addNotification(
          `Meeting Invitation: ${data.title}`,
          `Organized by ${data.organizerName} for ${data.date} at ${data.startTime} IST.`,
          'task',
          'meetings',
          { recipientId: empId, orgId: currentOrg.id }
        );
      });
    }

    addToast('Meeting Scheduled', `Meeting "${data.title}" scheduled successfully.`, 'success');
    return newMeeting;
  };

  const updateMeetingStatus = (meetingId: string, status: MeetingEvent['status']) => {
    setMeetings((prev) => {
      const updated = prev.map((m) => (m.id === meetingId ? { ...m, status } : m));
      try {
        localStorage.setItem('vdx_meetings', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    addToast('Meeting Status Updated', `Status changed to ${status}.`, 'info');
  };

  // Corporate Notice Handlers
  const createNotice = async (data: Omit<NoticeItem, 'id' | 'orgId' | 'createdAt'>): Promise<NoticeItem> => {
    const newNotice: NoticeItem = {
      ...data,
      id: generateUUID(),
      orgId: currentOrg.id,
      createdAt: new Date().toISOString()
    };
    setNotices((prev) => {
      const updated = [newNotice, ...prev];
      try {
        localStorage.setItem('vdx_notices', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    addNotification(
      `Notice: ${data.title}`,
      `Published by ${data.authorName} (${data.category.toUpperCase()}).`,
      'announcement',
      'notices',
      { orgId: currentOrg.id }
    );

    addToast('Notice Published', `"${data.title}" posted to the Notice Board.`, 'success');
    return newNotice;
  };

  const deleteNotice = (noticeId: string) => {
    setNotices((prev) => {
      const updated = prev.filter((n) => n.id !== noticeId);
      try {
        localStorage.setItem('vdx_notices', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    addToast('Notice Removed', 'The notice has been removed.', 'info');
  };

  // Organizational Live Chat Handlers (Supabase DB synced)
  const sendChatMessage = async (
    messageText: string,
    channelName: string,
    recipientId?: string
  ): Promise<ChatMessage> => {
    const newMsg: ChatMessage = {
      id: generateUUID(),
      orgId: currentOrg.id,
      senderId: currentProfile.id,
      senderName: `${currentProfile.firstName} ${currentProfile.lastName}`.trim(),
      senderRole: currentProfile.role,
      senderAvatar: currentProfile.avatarUrl || '/vedotrix-logo.png',
      channel: channelName,
      recipientId: recipientId || undefined,
      message: messageText.trim(),
      reactions: [],
      createdAt: new Date().toISOString()
    };

    setChatMessages((prev) => {
      const updated = [...prev, newMsg];
      try {
        localStorage.setItem('vdx_chat_messages', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    try {
      const client = getSupabaseClient();
      await client.from('chat_messages').insert([{
        id: newMsg.id,
        org_id: newMsg.orgId,
        sender_id: newMsg.senderId,
        sender_name: newMsg.senderName,
        sender_role: newMsg.senderRole,
        sender_avatar: newMsg.senderAvatar,
        channel: newMsg.channel,
        recipient_id: newMsg.recipientId || null,
        message: newMsg.message,
        reactions: newMsg.reactions || [],
        created_at: newMsg.createdAt
      }]);
    } catch (e) {
      console.warn('Supabase chat insert warning (using local store):', e);
    }

    if (recipientId) {
      addNotification(
        `New Message from ${newMsg.senderName}`,
        newMsg.message.length > 50 ? `${newMsg.message.slice(0, 50)}...` : newMsg.message,
        'system',
        'chat',
        { recipientId }
      );
    }

    return newMsg;
  };

  const addChatReaction = async (messageId: string, emoji: string) => {
    let targetReactions: any[] = [];
    setChatMessages((prev) => {
      const updated = prev.map((msg) => {
        if (msg.id !== messageId) return msg;
        const currentReactions = msg.reactions || [];
        const existing = currentReactions.find((r) => r.emoji === emoji);
        let nextReactions;
        if (existing) {
          if (existing.userIds.includes(currentProfile.id)) {
            nextReactions = currentReactions
              .map((r) =>
                r.emoji === emoji
                  ? { ...r, count: r.count - 1, userIds: r.userIds.filter((u) => u !== currentProfile.id) }
                  : r
              )
              .filter((r) => r.count > 0);
          } else {
            nextReactions = currentReactions.map((r) =>
              r.emoji === emoji
                ? { ...r, count: r.count + 1, userIds: [...r.userIds, currentProfile.id] }
                : r
            );
          }
        } else {
          nextReactions = [...currentReactions, { emoji, count: 1, userIds: [currentProfile.id] }];
        }
        targetReactions = nextReactions;
        return { ...msg, reactions: nextReactions };
      });
      try {
        localStorage.setItem('vdx_chat_messages', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    try {
      const client = getSupabaseClient();
      await client.from('chat_messages').update({ reactions: targetReactions }).eq('id', messageId);
    } catch (e) {}
  };

  const createChatChannel = async (data: {
    name: string;
    description: string;
    isPrivate?: boolean;
    memberIds?: string[];
  }): Promise<ChatChannel> => {
    const cleanName = data.name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const newChan: ChatChannel = {
      id: cleanName,
      orgId: currentOrg.id,
      name: cleanName,
      description: data.description.trim(),
      isPrivate: Boolean(data.isPrivate),
      memberIds: data.isPrivate && data.memberIds ? data.memberIds : undefined,
      createdBy: currentProfile.id,
      createdByName: `${currentProfile.firstName} ${currentProfile.lastName}`.trim(),
      type: data.isPrivate ? 'group' : 'channel',
      createdAt: new Date().toISOString()
    };

    setCustomChannels((prev) => {
      const updated = [...prev.filter((c) => !(c.id === cleanName && c.orgId === currentOrg.id)), newChan];
      try {
        localStorage.setItem('vdx_custom_channels', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    addToast(
      data.isPrivate ? 'Private Group Created 🔒' : 'Channel Created 📢',
      `#${cleanName} is now active for ${currentOrg.name}.`,
      'success'
    );
    return newChan;
  };

  const deleteChatChannel = async (channelId: string): Promise<void> => {
    setCustomChannels((prev) => {
      const updated = prev.filter((c) => !(c.id === channelId && c.orgId === currentOrg.id));
      try {
        localStorage.setItem('vdx_custom_channels', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    if (activeChatChannel === channelId) {
      setActiveChatChannel('general');
    }
    addToast('Channel Removed', `Channel #${channelId} was removed.`, 'info');
  };

  const isSuperOrHr = isVedotrixSuperadmin || currentProfile?.role === 'superadmin' || currentProfile?.role === 'owner' || currentProfile?.role === 'hr';
  const directReportIds = new Set(profiles.filter((p) => p.orgId === currentOrg.id && p.managerId === currentProfile?.id).map((p) => p.id));

  // Standard Base Channels for the current organization
  const standardChannels: ChatChannel[] = [
    {
      id: 'general',
      orgId: currentOrg.id,
      name: 'general',
      description: 'Company-wide updates & general team discussion',
      type: 'channel',
      isPrivate: false
    },
    {
      id: 'support',
      orgId: currentOrg.id,
      name: 'support',
      description: 'Common Support: Internal helpdesk, HR questions & IT ticket assistance',
      type: 'channel',
      isPrivate: false
    },
    {
      id: 'engineering',
      orgId: currentOrg.id,
      name: 'engineering',
      description: 'Technical sprints, PR reviews, bug reports, and deployments',
      type: 'channel',
      isPrivate: false
    },
    {
      id: 'operations',
      orgId: currentOrg.id,
      name: 'operations',
      description: 'Daily client workflows, workplace facilities, and operations',
      type: 'channel',
      isPrivate: false
    },
    {
      id: 'announcements',
      orgId: currentOrg.id,
      name: 'announcements',
      description: 'Official corporate releases, townhalls, and broadcasts',
      type: 'channel',
      isPrivate: false
    }
  ];

  // Scoped Channels: standard channels + custom channels of this org visible to this user
  const scopedChatChannels = [
    ...standardChannels,
    ...customChannels.filter((c) => {
      if (c.orgId !== currentOrg.id && !isVedotrixSuperadmin) return false;
      if (!c.isPrivate) return true;
      if (isSuperOrHr) return true;
      if (c.createdBy === currentProfile.id) return true;
      if (c.memberIds && c.memberIds.includes(currentProfile.id)) return true;
      return false;
    })
  ];

  // Scoped Meetings: elevated roles see all in org; employees/managers see meetings assigned to them, organized by them, organized by their manager, or attended by their direct reports
  const scopedMeetings = meetings.filter((m) => {
    if (m.orgId !== currentOrg.id && !isVedotrixSuperadmin) return false;
    if (isSuperOrHr) return true;
    if (m.organizerId === currentProfile?.id) return true;
    if (m.attendeeIds.includes('all')) return true;
    if (currentProfile?.id && m.attendeeIds.includes(currentProfile.id)) return true;
    if (currentProfile?.managerId && m.organizerId === currentProfile.managerId) return true;
    if (m.attendeeIds.some((id) => directReportIds.has(id))) return true;
    return false;
  });

  const scopedNotices = notices.filter((n) => isVedotrixSuperadmin || n.orgId === currentOrg.id);

  // Scoped Chat Messages
  const scopedChatMessages = chatMessages.filter((m) => {
    if (m.orgId !== currentOrg.id && !isVedotrixSuperadmin) return false;
    if (m.recipientId) {
      if (isSuperOrHr) return true;
      return m.senderId === currentProfile.id || m.recipientId === currentProfile.id;
    }
    return true;
  });

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        login,
        logout,
        theme,
        setTheme,
        currentOrg,
        currentProfile,
        isVedotrixSuperadmin,
        availableOrgs: isVedotrixSuperadmin ? organizations : organizations.filter((o) => o.id === currentOrg.id),
        allOrganizations: organizations,
        orgProfiles,
        allProfiles: profiles,
        createProfile,
        updateProfile,
        updateOrganization,
        switchOrganization,
        switchRole,
        createOrganization,
        toggleOrganizationStatus,
        updateSubscriptionPlan,
        broadcasts,
        createBroadcast,
        officeLocations: effectiveOfficeLocations,
        offerLetters: isVedotrixSuperadmin
          ? offerLetters
          : (currentProfile?.role === 'hr' || currentProfile?.role === 'owner' || currentProfile?.role === 'superadmin')
          ? offerLetters.filter((o) => o.orgId === currentOrg?.id)
          : offerLetters.filter(
              (o) =>
                o.orgId === currentOrg?.id &&
                ((o.employeeId && o.employeeId === currentProfile?.id) ||
                  o.candidateEmail?.toLowerCase() === currentProfile?.email?.toLowerCase())
            ),
        allOfferLetters: (isVedotrixSuperadmin || currentProfile?.role === 'hr' || currentProfile?.role === 'owner' || currentProfile?.role === 'superadmin')
          ? (isVedotrixSuperadmin ? offerLetters : offerLetters.filter((o) => o.orgId === currentOrg?.id))
          : offerLetters.filter(
              (o) =>
                o.orgId === currentOrg?.id &&
                ((o.employeeId && o.employeeId === currentProfile?.id) ||
                  o.candidateEmail?.toLowerCase() === currentProfile?.email?.toLowerCase())
            ),
        attendanceRecords: attendanceRecords.filter((a) => a.orgId === currentOrg?.id),
        tasks: tasks.filter((t) => t.orgId === currentOrg?.id),
        standups: standups.filter((s) => s.orgId === currentOrg?.id),
        payrollRecords: (isVedotrixSuperadmin || currentProfile?.role === 'hr' || currentProfile?.role === 'owner' || currentProfile?.role === 'superadmin')
          ? payrollRecords.filter((p) => p.orgId === currentOrg?.id)
          : payrollRecords.filter((p) => p.orgId === currentOrg?.id && p.employeeId === currentProfile?.id),
        createOfferLetter,
        acceptOfferLetter,
        verifyOfferLetterByHr,
        getOfferBySerial,
        punchAttendance,
        requestRegularization,
        resolveRegularization,
        getTodayAttendance,
        createTask,
        updateTaskStatus,
        submitStandup,
        processMonthlyPayroll,
        markPayrollPaid,
        updatePayrollRecord,
        exportBankPayoutCsv,
        leaveRequests: leaveRequests.filter((l) => l.orgId === currentOrg.id),
        submitLeaveRequest,
        resolveLeaveRequest,
        cancelLeaveRequest,
        getLeaveBalance,
        notifications: userNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        addNotification,
        unreadNotificationCount,
        supabaseConfig,
        updateSupabaseCredentials,
        toasts,
        addToast,
        removeToast,
        accessRequests: accessRequests.filter((r) => r.orgId === currentOrg.id),
        submitAccessRequest,
        resolveAccessRequest,
        updateEmployeeManager,
        meetings: scopedMeetings,
        createMeeting,
        updateMeetingStatus,
        notices: scopedNotices,
        createNotice,
        deleteNotice,
        chatMessages: scopedChatMessages,
        chatChannels: scopedChatChannels,
        createChatChannel,
        deleteChatChannel,
        sendChatMessage,
        addChatReaction,
        activeChatChannel,
        setActiveChatChannel
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
