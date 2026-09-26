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
  LeaveBalance
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
import { generateVerificationToken, generateUUID } from '../lib/serialUtils';
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
  switchOrganization: (orgId: string) => void;
  switchRole: (role: UserRole) => void;
  
  // SuperAdmin & Super Controller Actions
  createOrganization: (orgData: Omit<Organization, 'id' | 'settings'>) => Organization;
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
  punchAttendance: (lat: number, long: number, isRemote?: boolean, distanceMeters?: number, officeAddress?: string) => { success: boolean; message: string; record: AttendanceRecord };
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
  addNotification: (title: string, message: string, category: InAppNotification['category'], linkTab?: string) => void;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('vdx_auth_token') !== null;
  });

  // Clean stale local storage caches to make sure live Supabase DB is the absolute single source of truth
  const DB_CACHE_VERSION = 'vdx_db_v5_leaves_active';
  useEffect(() => {
    if (localStorage.getItem('vdx_db_version') !== DB_CACHE_VERSION) {
      console.log('Upgrading local cache to direct live Supabase DB single source of truth...');
      localStorage.removeItem('vdx_organizations');
      localStorage.removeItem('vdx_profiles');
      localStorage.removeItem('vdx_office_locations');
      localStorage.removeItem('vdx_offers');
      localStorage.removeItem('vdx_attendance');
      localStorage.removeItem('vdx_tasks');
      localStorage.removeItem('vdx_standups');
      localStorage.removeItem('vdx_payroll');
      localStorage.removeItem('vdx_access_requests');
      localStorage.removeItem('vdx_leave_requests');
      localStorage.setItem('vdx_db_version', DB_CACHE_VERSION);
    }
  }, []);

  // Theme state
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('vdx_theme') as ThemeMode) || 'cyber-dark';
  });

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem('vdx_theme', newTheme);
  };

  useEffect(() => {
    const root = document.documentElement;
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

  // Load Orgs (Clean production master)
  const [organizations, setOrganizations] = useState<Organization[]>(() => {
    const saved = localStorage.getItem('vdx_organizations');
    return saved ? JSON.parse(saved) : INITIAL_ORGS;
  });

  const [currentOrgId, setCurrentOrgId] = useState<string>(() => {
    return localStorage.getItem('vdx_current_org_id') || '00000000-0000-0000-0000-000000000001';
  });
  const [currentProfileId, setCurrentProfileId] = useState<string>(() => {
    return localStorage.getItem('vdx_current_profile_id') || '00000000-0000-0000-0000-000000000003';
  });
  
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    const saved = localStorage.getItem('vdx_profiles');
    return saved ? JSON.parse(saved) : INITIAL_PROFILES;
  });

  const [officeLocationsList, setOfficeLocationsList] = useState<OfficeLocation[]>(() => {
    const saved = localStorage.getItem('vdx_office_locations');
    return saved ? JSON.parse(saved) : INITIAL_OFFICES;
  });

  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>(() => {
    const saved = localStorage.getItem('vdx_access_requests');
    return saved ? JSON.parse(saved) : [];
  });

  const [offerLetters, setOfferLetters] = useState<OfferLetter[]>(() => {
    const saved = localStorage.getItem('vdx_offers');
    return saved ? JSON.parse(saved) : INITIAL_OFFERS;
  });

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem('vdx_attendance');
    return saved ? JSON.parse(saved) : INITIAL_ATTENDANCE;
  });

  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    const saved = localStorage.getItem('vdx_tasks');
    return saved ? JSON.parse(saved) : INITIAL_TASKS;
  });

  const [standups, setStandups] = useState<DailyStandup[]>(() => {
    const saved = localStorage.getItem('vdx_standups');
    return saved ? JSON.parse(saved) : INITIAL_STANDUPS;
  });

  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>(() => {
    const saved = localStorage.getItem('vdx_payroll');
    return saved ? JSON.parse(saved) : INITIAL_PAYROLL;
  });

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => {
    const saved = localStorage.getItem('vdx_leave_requests');
    return saved ? JSON.parse(saved) : [];
  });

  const [notifications, setNotifications] = useState<InAppNotification[]>(() => {
    const saved = localStorage.getItem('vdx_notifications');
    return saved ? JSON.parse(saved) : INITIAL_NOTIFICATIONS;
  });

  const [broadcasts, setBroadcasts] = useState<SystemBroadcast[]>(() => {
    const saved = localStorage.getItem('vdx_broadcasts');
    return saved ? JSON.parse(saved) : INITIAL_BROADCASTS;
  });

  const [toasts, setToasts] = useState<NotificationToast[]>([]);

  // Persistent storage sync
  useEffect(() => {
    localStorage.setItem('vdx_organizations', JSON.stringify(organizations));
  }, [organizations]);

  useEffect(() => {
    localStorage.setItem('vdx_profiles', JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem('vdx_office_locations', JSON.stringify(officeLocationsList));
  }, [officeLocationsList]);

  useEffect(() => {
    localStorage.setItem('vdx_current_org_id', currentOrgId);
  }, [currentOrgId]);

  useEffect(() => {
    localStorage.setItem('vdx_current_profile_id', currentProfileId);
  }, [currentProfileId]);

  useEffect(() => {
    localStorage.setItem('vdx_access_requests', JSON.stringify(accessRequests));
  }, [accessRequests]);

  useEffect(() => {
    localStorage.setItem('vdx_offers', JSON.stringify(offerLetters));
  }, [offerLetters]);

  useEffect(() => {
    localStorage.setItem('vdx_attendance', JSON.stringify(attendanceRecords));
  }, [attendanceRecords]);

  useEffect(() => {
    localStorage.setItem('vdx_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('vdx_standups', JSON.stringify(standups));
  }, [standups]);

  useEffect(() => {
    localStorage.setItem('vdx_payroll', JSON.stringify(payrollRecords));
  }, [payrollRecords]);

  useEffect(() => {
    localStorage.setItem('vdx_leave_requests', JSON.stringify(leaveRequests));
  }, [leaveRequests]);

  useEffect(() => {
    localStorage.setItem('vdx_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('vdx_broadcasts', JSON.stringify(broadcasts));
  }, [broadcasts]);

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

        if (cloudProfiles && cloudProfiles.length > 0) {
          const mappedProfiles: Profile[] = cloudProfiles.map((p: any) => ({
            id: p.id,
            orgId: p.org_id,
            email: p.email,
            firstName: p.first_name,
            lastName: p.last_name || '',
            role: p.role,
            designation: p.designation || 'Team Member',
            department: p.department || 'Operations',
            joiningDate: p.joining_date || new Date().toISOString().split('T')[0],
            baseSalary: Number(p.base_salary) || 50000,
            avatarUrl: p.avatar_url || '/vedotrix-logo.png',
            isActive: p.is_active ?? true,
            managerId: p.manager_id || undefined,
            passwordHash: p.password_hash || 'Vedotrix@2026',
            modulesAccess: p.modules_access || ['attendance', 'tasks', 'standups']
          }));
          setProfiles(mappedProfiles);
        }

        if (cloudOffices && cloudOffices.length > 0) {
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

        if (cloudOffers && cloudOffers.length > 0) {
          const mappedOffers: OfferLetter[] = cloudOffers.map((o: any) => ({
            id: o.id,
            orgId: o.org_id,
            serialNumber: o.serial_number,
            candidateName: o.candidate_name,
            candidateEmail: o.candidate_email,
            candidatePhone: o.candidate_phone || '',
            designation: o.designation,
            department: o.department,
            joiningDate: o.joining_date,
            annualCtc: Number(o.annual_ctc) || 1200000,
            basicMonthly: Number(o.basic_monthly) || 50000,
            hraMonthly: Number(o.hra_monthly) || 25000,
            specialAllowance: Number(o.special_allowance) || 25000,
            status: o.status,
            verificationToken: o.verification_token,
            pdfUrl: o.pdf_url,
            securityCode: o.security_code,
            hrDepartment: o.hr_department,
            managerId: o.manager_id || undefined,
            employeeId: o.employee_id || undefined,
            issuedBy: o.issued_by || '00000000-0000-0000-0000-000000000003',
            hrVerifiedAt: o.hr_verified_at,
            candidateAcceptedAt: o.candidate_accepted_at,
            createdAt: o.created_at
          }));
          setOfferLetters(mappedOffers);
        }

        if (cloudAttendance && cloudAttendance.length > 0) {
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

        if (cloudTasks && cloudTasks.length > 0) {
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

        if (cloudStandups && cloudStandups.length > 0) {
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

        if (cloudRequests && cloudRequests.length > 0) {
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

        if (cloudPayroll && cloudPayroll.length > 0) {
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

        if (cloudLeaves && cloudLeaves.length > 0) {
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

  // Notification Dispatcher
  const addNotification = (title: string, message: string, category: InAppNotification['category'], linkTab?: string) => {
    const newNotif: InAppNotification = {
      id: generateUUID(),
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

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const unreadNotificationCount = notifications.filter((n) => !n.isRead).length;

  const currentOrg = organizations.find((o) => o.id === currentOrgId) || organizations[0];
  const orgProfiles = profiles.filter((p) => p.orgId === currentOrgId);
  const currentProfile = orgProfiles.find((p) => p.id === currentProfileId) || profiles.find((p) => p.id === currentProfileId) || orgProfiles[0] || profiles[0];
  
  // Office locations strictly for active tenant with fallback
  const officeLocations = officeLocationsList.filter((o) => o.orgId === currentOrgId);
  const effectiveOfficeLocations: OfficeLocation[] = officeLocations.length > 0 ? officeLocations : [
    {
      id: '00000000-0000-0000-0000-000000000002',
      orgId: currentOrgId,
      name: `${currentOrg.name} Head Office`,
      latitude: 12.9352,
      longitude: 77.6946,
      radiusMeters: 200,
      address: currentOrg.address || 'Corporate Headquarters',
      isActive: true
    }
  ];

  // Strictly identify Vedotrix Root Superadmin
  const isVedotrixSuperadmin =
    currentProfile.role === 'superadmin' &&
    (currentProfile.orgId === '00000000-0000-0000-0000-000000000001' ||
     currentProfile.email.toLowerCase() === 'admin@vedotrix.com' ||
     currentProfile.email.toLowerCase() === 'sajalsaxenagola@gmail.com');

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
  const createOrganization = (orgData: Omit<Organization, 'id' | 'settings'>): Organization => {
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
    setOrganizations((prev) => [...prev, newOrg]);

    const ownerEmail = newOrg.website?.includes('@') ? newOrg.website : `admin@${newOrg.slug || 'company'}.com`;
    const ownerProfile: Profile = {
      id: ownerProfileId,
      orgId: newOrgId,
      email: ownerEmail,
      firstName: newOrg.name.split(' ')[0] || 'Admin',
      lastName: 'Leadership',
      role: 'owner',
      designation: 'Managing Director / Organization Admin',
      department: 'Executive Board',
      joiningDate: new Date().toISOString().split('T')[0],
      baseSalary: 150000,
      avatarUrl: newOrg.logoUrl || '/vedotrix-logo.png',
      isActive: true,
      modulesAccess: ['all', 'attendance', 'tasks', 'standups', 'offers', 'payroll', 'access_requests', 'leaves']
    };
    setProfiles((prev) => [...prev, ownerProfile]);

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
    setOfficeLocationsList((prev) => [...prev, defaultOffice]);

    (async () => {
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
          role: ownerProfile.role,
          designation: ownerProfile.designation,
          department: ownerProfile.department,
          joining_date: ownerProfile.joiningDate,
          base_salary: ownerProfile.baseSalary,
          avatar_url: ownerProfile.avatarUrl,
          is_active: true,
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

        sendWelcomeEmail(
          ownerEmail,
          `${ownerProfile.firstName} ${ownerProfile.lastName}`,
          newOrg.name,
          'Organization Administrator'
        );
        sendParentalSuperadminAlert(
          newOrg.name,
          newOrg.orgCode,
          ownerEmail,
          `${ownerProfile.firstName} ${ownerProfile.lastName}`,
          newOrg.industry || 'Tech',
          newOrg.subscriptionPlan || 'Enterprise'
        );
      } catch (e) {
        console.error('Supabase tenant cloud sync error:', e);
      }
    })();

    addToast('Tenant Created 🎉', `Organization "${newOrg.name}" (${newOrg.orgCode}) registered in Supabase DB!`, 'success');
    addNotification('New Organization Onboarded', `Tenant "${newOrg.name}" registered & Welcome Email dispatched.`, 'system', 'superadmin');
    return newOrg;
  };

  const createProfile = async (profileData: Omit<Profile, 'id'>): Promise<Profile> => {
    const newId = generateUUID();
    const managerIdUuid = profileData.managerId && profileData.managerId.length === 36 ? profileData.managerId : null;
    
    const newProfile: Profile = {
      ...profileData,
      id: newId,
      managerId: managerIdUuid || undefined,
      passwordHash: profileData.passwordHash || 'Vedotrix@2026',
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
        role: newProfile.role,
        designation: newProfile.designation,
        department: newProfile.department,
        joining_date: newProfile.joiningDate,
        base_salary: newProfile.baseSalary,
        avatar_url: newProfile.avatarUrl || '/vedotrix-logo.png',
        is_active: newProfile.isActive,
        manager_id: managerIdUuid,
        password_hash: newProfile.passwordHash,
        modules_access: newProfile.modulesAccess
      });
      if (profErr) {
        console.error('Supabase profile insert error:', profErr);
      }

      const org = organizations.find((o) => o.id === newProfile.orgId);
      sendWelcomeEmail(
        newProfile.email,
        `${newProfile.firstName} ${newProfile.lastName}`,
        org?.name || 'Vedotrix Organization',
        newProfile.role
      );

      if (newProfile.role === 'superadmin' || newProfile.role === 'owner') {
        sendParentalSuperadminAlert(
          org?.name || 'Client Organization',
          org?.orgCode || 'ORG',
          newProfile.email,
          `${newProfile.firstName} ${newProfile.lastName}`,
          org?.industry || 'Tech'
        );
      }
    } catch (err) {
      console.warn('Profile Supabase cloud sync error:', err);
    }

    addToast('Staff Member Created 🚀', `${newProfile.firstName} ${newProfile.lastName} registered in Supabase DB!`, 'success');
    addNotification('New Team Member', `${newProfile.firstName} added as ${newProfile.designation}.`, 'system', 'hr');
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
        }).eq('serial_number', serialNumber);
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
    const todayStr = new Date().toISOString().split('T')[0];
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
    const todayStr = new Date().toISOString().split('T')[0];
    const existing = getTodayAttendance();
    const resolvedAddress = officeAddress || currentOrg.address || 'Corporate Headquarters';

    const requiresApproval = isRemote || distanceMeters > 150;
    const regularizationStatus: RegularizationStatus = requiresApproval ? 'pending' : 'none';
    const approvalStatus: 'approved' | 'pending_manager_approval' | 'rejected' = requiresApproval
      ? 'pending_manager_approval'
      : 'approved';
    const regularizationReason = isRemote
      ? 'Work From Home (WFH) - Presence Approval Required'
      : (distanceMeters > 150 ? `Location Outside Office Geofence (${Math.round(distanceMeters)}m away) - Presence Approval Required` : undefined);

    if (!existing) {
      const newId = generateUUID();
      const newRecord: AttendanceRecord = {
        id: newId,
        orgId: currentOrg.id,
        employeeId: currentProfile.id,
        date: todayStr,
        checkInTime: new Date().toISOString(),
        checkInLat: lat,
        checkInLong: long,
        distanceMeters,
        officeAddress: resolvedAddress,
        status: 'present',
        isRemote,
        approvalStatus,
        regularizationStatus,
        regularizationReason,
        totalHours: 0
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
          regularization_reason: regularizationReason || null
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
          'alert',
          'attendance'
        );
      } else {
        addToast('Office Check-In Verified 📍', `Verified at ${resolvedAddress}`, 'success');
        addNotification('Attendance Check-In 📍', `Punched in successfully at ${resolvedAddress}`, 'attendance', 'attendance');
      }

      return { success: true, message: 'Checked in successfully', record: newRecord };
    } else if (!existing.checkOutTime) {
      const checkInDate = new Date(existing.checkInTime!).getTime();
      const now = Date.now();
      const hours = Math.round(((now - checkInDate) / (1000 * 60 * 60)) * 100) / 100;
      const totalHours = Math.max(hours, 0.5);
      const newStatus = hours >= (currentOrg.settings?.halfDayThresholdHours || 4.5) ? 'present' : 'half_day';

      const updatedRecord: AttendanceRecord = {
        ...existing,
        checkOutTime: new Date().toISOString(),
        checkOutLat: lat,
        checkOutLong: long,
        totalHours,
        status: newStatus
      };

      setAttendanceRecords((prev) => prev.map((a) => (a.id === existing.id ? updatedRecord : a)));

      try {
        const client = getSupabaseClient();
        client.from('attendance').update({
          check_out_time: updatedRecord.checkOutTime,
          check_out_lat: lat,
          check_out_long: long,
          total_hours: totalHours,
          status: newStatus
        }).eq('id', existing.id).then(({ error }) => {
          if (error) console.error('Supabase attendance check-out error:', error);
          else console.log('Attendance check-out updated in Supabase!');
        });
      } catch (e) {
        console.error('Attendance check-out error:', e);
      }

      addToast('Check-Out Recorded 🏁', `Checked out. Duration: ${totalHours} hrs. Remember your EOD Standup!`, 'info');
      addNotification('Attendance Check-Out 🏁', `Checked out. Remember to log your daily standup!`, 'attendance', 'standups');
      return { success: true, message: 'Checked out successfully', record: updatedRecord };
    } else {
      return { success: false, message: 'Already completed attendance for today', record: existing };
    }
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
      assignedTo: assignedToUuid || undefined,
      createdBy: createdByUuid || undefined,
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

    if (target.employeeId !== currentProfile.id && currentProfile.role !== 'owner' && currentProfile.role !== 'superadmin') {
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

    return {
      casual: { total: 12, used: casualUsed, remaining: Math.max(0, 12 - casualUsed) },
      sick: { total: 10, used: sickUsed, remaining: Math.max(0, 10 - sickUsed) },
      privilege: { total: 15, used: privilegeUsed, remaining: Math.max(0, 15 - privilegeUsed) },
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

      const baseSalary = emp.baseSalary || 50000;
      const basicPay = Math.round(baseSalary * 0.5);
      const hra = Math.round(baseSalary * 0.25);
      const allowances = Math.round(baseSalary * 0.25);
      const deductions = 1800;
      const lopDeduction = Math.round((baseSalary / totalDaysInMonth) * lopDays);
      const netSalary = Math.max(0, baseSalary - deductions - lopDeduction);

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
        payoutStatus: 'pending',
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
    addNotification('Salary Disbursed 💰', `Monthly payout processed with reference ${reference}.`, 'payroll', 'payroll');
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
        allOrganizations: isVedotrixSuperadmin ? organizations : organizations.filter((o) => o.id === currentOrg.id),
        orgProfiles,
        allProfiles: isVedotrixSuperadmin ? profiles : orgProfiles,
        createProfile,
        switchOrganization,
        switchRole,
        createOrganization,
        toggleOrganizationStatus,
        updateSubscriptionPlan,
        broadcasts,
        createBroadcast,
        officeLocations: effectiveOfficeLocations,
        offerLetters: offerLetters.filter((o) => o.orgId === currentOrg.id),
        allOfferLetters: isVedotrixSuperadmin ? offerLetters : offerLetters.filter((o) => o.orgId === currentOrg.id),
        attendanceRecords: attendanceRecords.filter((a) => a.orgId === currentOrg.id),
        tasks: tasks.filter((t) => t.orgId === currentOrg.id),
        standups: standups.filter((s) => s.orgId === currentOrg.id),
        payrollRecords: payrollRecords.filter((p) => p.orgId === currentOrg.id),
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
        exportBankPayoutCsv,
        leaveRequests: leaveRequests.filter((l) => l.orgId === currentOrg.id),
        submitLeaveRequest,
        resolveLeaveRequest,
        cancelLeaveRequest,
        getLeaveBalance,
        notifications,
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
        updateEmployeeManager
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
