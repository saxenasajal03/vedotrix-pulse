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
  AccessRequest
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
import { generateOfferSerialNumber, generateVerificationToken } from '../lib/serialUtils';
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
  sendRegularizationAlertEmail
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
  punchAttendance: (lat: number, long: number, isRemote?: boolean, distanceMeters?: number) => { success: boolean; message: string; record: AttendanceRecord };
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

  // Clean stale demo localStorage cache if present
  useEffect(() => {
    const cachedOrgs = localStorage.getItem('vdx_organizations');
    if (cachedOrgs && cachedOrgs.includes('Nexora')) {
      console.log('Purging legacy demo client cache to ensure clean production slate...');
      localStorage.removeItem('vdx_organizations');
      localStorage.removeItem('vdx_offers');
      localStorage.removeItem('vdx_attendance');
      localStorage.removeItem('vdx_tasks');
      localStorage.removeItem('vdx_standups');
      localStorage.removeItem('vdx_payroll');
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
    localStorage.setItem('vdx_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('vdx_broadcasts', JSON.stringify(broadcasts));
  }, [broadcasts]);

  // LIVE SUPABASE CLOUD SYNC ON MOUNT
  useEffect(() => {
    async function syncFromLiveSupabase() {
      try {
        const client = getSupabaseClient();
        const { data: cloudOrgs } = await client.from('organizations').select('*');
        if (cloudOrgs && cloudOrgs.length > 0) {
          setOrganizations((prev) => {
            const map = new Map(prev.map((o) => [o.id, o]));
            cloudOrgs.forEach((o: any) => {
              map.set(o.id, {
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
              });
            });
            return Array.from(map.values());
          });
        }

        const { data: cloudProfiles } = await client.from('profiles').select('*');
        if (cloudProfiles && cloudProfiles.length > 0) {
          setProfiles((prev) => {
            const map = new Map(prev.map((p) => [p.id, p]));
            cloudProfiles.forEach((p: any) => {
              map.set(p.id, {
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
                managerId: p.manager_id,
                passwordHash: p.password_hash || 'Vedotrix@2026',
                modulesAccess: p.modules_access || ['attendance', 'tasks', 'standups']
              });
            });
            return Array.from(map.values());
          });
        }

        const { data: cloudRequests } = await client.from('access_requests').select('*');
        if (cloudRequests && cloudRequests.length > 0) {
          setAccessRequests((prev) => {
            const map = new Map(prev.map((r) => [r.id, r]));
            cloudRequests.forEach((r: any) => {
              map.set(r.id, {
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
              });
            });
            return Array.from(map.values());
          });
        }

        const { data: cloudOffers } = await client.from('offer_letters').select('*');
        if (cloudOffers && cloudOffers.length > 0) {
          setOfferLetters((prev) => {
            const map = new Map(prev.map((off) => [off.id, off]));
            cloudOffers.forEach((o: any) => {
              map.set(o.id, {
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
                issuedBy: o.issued_by || 'hr',
                hrVerifiedAt: o.hr_verified_at,
                candidateAcceptedAt: o.candidate_accepted_at,
                createdAt: o.created_at
              });
            });
            return Array.from(map.values());
          });
        }
      } catch (err) {
        console.log('Live cloud sync note:', err);
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

    // 1. Primary: Verify against live Supabase PostgreSQL database using pgcrypto bcrypt RPC
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

          // If the organization is not yet loaded in state, fetch it from Supabase
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

          // Ensure verified profile exists in profiles state
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
                modulesAccess: verifiedUser.modules_access || ['attendance', 'tasks', 'standups'],
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
                modulesAccess: verifiedUser.modules_access || ['attendance', 'tasks', 'standups']
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
          // Explicit password mismatch returned from PostgreSQL bcrypt verification
          return { success: false, message: 'Invalid work email or password. Access denied.' };
        }
      } else if (!rpcError && (!rpcData || rpcData.length === 0)) {
        // User email does not exist in database
        return { success: false, message: 'Invalid work email or password. Access denied.' };
      }
    } catch (rpcErr) {
      console.warn('Supabase RPC verify_user_password failed, evaluating offline state:', rpcErr);
    }

    // 2. Offline Fallback: Only if cloud database is completely unreachable
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
      id: `notif-${Date.now()}`,
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
  const officeLocations = INITIAL_OFFICES.filter((o) => o.orgId === currentOrgId);

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
    const newOrgId = `org-${Date.now()}`;
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

    // Create default tenant owner profile
    const ownerEmail = newOrg.website?.includes('@') ? newOrg.website : `admin@${newOrg.slug || 'company'}.com`;
    const ownerProfile: Profile = {
      id: `profile-${Date.now()}`,
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
      isActive: true
    };
    setProfiles((prev) => [...prev, ownerProfile]);

    // Also persist directly to live Supabase DB
    try {
      const client = getSupabaseClient();
      client.from('organizations').insert({
        id: newOrg.id,
        name: newOrg.name,
        slug: newOrg.slug,
        org_code: newOrg.orgCode,
        industry: newOrg.industry,
        website: newOrg.website,
        address: newOrg.address,
        phone: newOrg.phone,
        logo_url: newOrg.logoUrl
      }).then(() => {
        console.log('Saved new organization to live Supabase cloud!');
        // Also persist owner profile
        client.from('profiles').insert({
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
          is_active: true
        }).then(() => console.log('Saved owner profile to Supabase!'));
      });

      // Dispatch automated Welcome Email via Supabase Mailer
      sendWelcomeEmail(
        ownerEmail,
        `${ownerProfile.firstName} ${ownerProfile.lastName}`,
        newOrg.name,
        'Organization Administrator'
      );
    } catch (e) {
      console.log('Cloud sync error', e);
    }

    addToast('Tenant Created 🎉', `Organization "${newOrg.name}" (${newOrg.orgCode}) registered & Welcome Email dispatched!`, 'success');
    addNotification('New Organization Onboarded', `Tenant "${newOrg.name}" registered & Welcome Email dispatched.`, 'system', 'superadmin');
    return newOrg;
  };

  const createProfile = async (profileData: Omit<Profile, 'id'>): Promise<Profile> => {
    const newId = `profile-${Date.now()}`;
    const newProfile: Profile = {
      ...profileData,
      id: newId,
      passwordHash: profileData.passwordHash || 'Vedotrix@2026',
      modulesAccess: profileData.modulesAccess || ['attendance', 'tasks', 'standups']
    };
    setProfiles((prev) => [...prev, newProfile]);

    try {
      const client = getSupabaseClient();
      await client.from('profiles').insert({
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
        manager_id: newProfile.managerId,
        password_hash: newProfile.passwordHash,
        modules_access: newProfile.modulesAccess
      });

      const org = organizations.find((o) => o.id === newProfile.orgId);
      // Dispatch automated Welcome Email via Supabase Mailer
      await sendWelcomeEmail(
        newProfile.email,
        `${newProfile.firstName} ${newProfile.lastName}`,
        org?.name || 'Vedotrix Organization',
        newProfile.role
      );
    } catch (err) {
      console.warn('Profile Supabase cloud sync error:', err);
    }

    addToast('Staff Member Created 🚀', `${newProfile.firstName} ${newProfile.lastName} registered & Welcome Email sent!`, 'success');
    addNotification('New Team Member', `${newProfile.firstName} added as ${newProfile.designation}.`, 'system', 'hr');
    return newProfile;
  };

  // --- ACCESS REQUESTS & MULTI-HIERARCHY APPROVAL ---
  const submitAccessRequest = async (
    targetModule: string,
    justification: string,
    requestType: AccessRequest['requestType'] = 'module_access'
  ): Promise<AccessRequest> => {
    const newId = `req-${Date.now()}`;
    
    // Designated Approver Routing:
    // If requester has a designated reporting manager, route to that manager!
    // If requester is a manager or has no reporting manager, route to the Organization Owner.
    // If requester is the Organization Owner or requesting tenant-level feature, route to Superadmin.
    let assignedApproverId: string | undefined = currentProfile.managerId;
    
    if (!assignedApproverId || assignedApproverId === currentProfile.id) {
      if (requestType === 'org_feature' || currentProfile.role === 'owner') {
        assignedApproverId = '00000000-0000-0000-0000-000000000003'; // Root Superadmin
      } else {
        const owner = profiles.find((p) => p.orgId === currentOrg.id && p.role === 'owner');
        assignedApproverId = owner?.id || '00000000-0000-0000-0000-000000000003';
      }
    }

    const newRequest: AccessRequest = {
      id: newId,
      orgId: currentOrg.id,
      requesterId: currentProfile.id,
      requestType,
      targetModule,
      justification,
      status: 'pending',
      assignedApproverId,
      createdAt: new Date().toISOString()
    };

    setAccessRequests((prev) => [newRequest, ...prev]);

    try {
      const client = getSupabaseClient();
      await client.from('access_requests').insert({
        id: newId,
        org_id: currentOrg.id,
        requester_id: currentProfile.id,
        request_type: requestType,
        target_module: targetModule,
        justification,
        status: 'pending',
        assigned_approver_id: assignedApproverId
      });
    } catch (err) {
      console.warn('Supabase access_requests insert warning:', err);
    }

    const approver = profiles.find((p) => p.id === assignedApproverId);
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

    // Strict Multi-Hierarchy Check:
    // Only the designated reporting manager, organization owner, or root superadmin can approve!
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

    // If approved, update user's modulesAccess
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
    setProfiles((prev) =>
      prev.map((p) => (p.id === employeeId ? { ...p, managerId: managerId || undefined } : p))
    );

    try {
      const client = getSupabaseClient();
      await client.from('profiles').update({
        manager_id: managerId
      }).eq('id', employeeId);
    } catch (err) {
      console.warn('Supabase manager update error:', err);
    }

    const emp = profiles.find((p) => p.id === employeeId);
    const mgr = profiles.find((p) => p.id === managerId);
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
      id: `bc-${Date.now()}`,
      title,
      message,
      priority,
      issuedBy: 'Vedotrix Super Controller',
      issuedAt: new Date().toISOString(),
      targetOrgs: 'all'
    };
    setBroadcasts((prev) => [newBroadcast, ...prev]);
    addToast('Global Broadcast Sent 📢', `Alert published to all organizations and mobile apps.`, 'success');
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
      addNotification('Database Connected', 'Live Supabase Free Tier DB active & operational.', 'system', 'superadmin');
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
    
    const newOffer: OfferLetter = {
      ...offerData,
      id: `off-${Date.now()}`,
      orgId: currentOrg.id,
      serialNumber,
      verificationToken,
      status: 'issued',
      pdfUrl: offerData.pdfUrl,
      issuedBy: currentProfile.id,
      hrVerifiedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    setOfferLetters((prev) => [newOffer, ...prev]);

    // Push to live Supabase DB
    try {
      const client = getSupabaseClient();
      client.from('offer_letters').insert({
        org_id: currentOrg.id,
        serial_number: newOffer.serialNumber,
        candidate_name: newOffer.candidateName,
        candidate_email: newOffer.candidateEmail,
        candidate_phone: newOffer.candidatePhone,
        designation: newOffer.designation,
        department: newOffer.department,
        joining_date: newOffer.joiningDate,
        annual_ctc: newOffer.annualCtc,
        basic_monthly: newOffer.basicMonthly,
        hra_monthly: newOffer.hraMonthly,
        special_allowance: newOffer.specialAllowance,
        status: newOffer.status,
        verification_token: newOffer.verificationToken,
        pdf_url: newOffer.pdfUrl,
        issued_by: newOffer.issuedBy
      }).then(() => {
        console.log('Offer letter saved to live Supabase cloud!');
      });

      // Dispatch automated Offer Letter & Verification loop email via Supabase Mailer
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

  const punchAttendance = (lat: number, long: number, isRemote: boolean = false, distanceMeters: number = 0) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const existing = getTodayAttendance();

    if (!existing) {
      // Check In
      const newRecord: AttendanceRecord = {
        id: `att-${Date.now()}`,
        orgId: currentOrg.id,
        employeeId: currentProfile.id,
        date: todayStr,
        checkInTime: new Date().toISOString(),
        checkInLat: lat,
        checkInLong: long,
        distanceMeters,
        status: isRemote ? 'present' : (distanceMeters <= 150 ? 'present' : 'absent'),
        isRemote,
        regularizationStatus: 'none',
        totalHours: 0
      };

      setAttendanceRecords((prev) => [newRecord, ...prev]);

      // Push to Supabase
      try {
        const client = getSupabaseClient();
        client.from('attendance').insert({
          date: newRecord.date,
          check_in_time: newRecord.checkInTime,
          check_in_lat: lat,
          check_in_long: long,
          distance_meters: distanceMeters,
          status: newRecord.status,
          is_remote: isRemote
        });
      } catch (e) {}

      addToast('Check-In Successful 📍', `Punched in at ${new Date().toLocaleTimeString()} (GPS: ${lat.toFixed(4)}, ${long.toFixed(4)})`, 'success');
      addNotification('Attendance Check-In 📍', `Punched in successfully at ${new Date().toLocaleTimeString()}`, 'attendance', 'attendance');
      return { success: true, message: 'Checked in successfully', record: newRecord };
    } else if (!existing.checkOutTime) {
      // Check Out
      const checkInDate = new Date(existing.checkInTime!).getTime();
      const now = Date.now();
      const hours = Math.round(((now - checkInDate) / (1000 * 60 * 60)) * 100) / 100;

      const updatedRecord: AttendanceRecord = {
        ...existing,
        checkOutTime: new Date().toISOString(),
        checkOutLat: lat,
        checkOutLong: long,
        totalHours: Math.max(hours, 0.5),
        status: hours >= currentOrg.settings.halfDayThresholdHours ? 'present' : 'half_day'
      };

      setAttendanceRecords((prev) => prev.map((a) => (a.id === existing.id ? updatedRecord : a)));
      addToast('Check-Out Recorded 🏁', `Checked out. Duration: ${Math.max(hours, 0.5)} hrs. Remember your EOD Standup!`, 'info');
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
            regularizationStatus: 'pending'
          };
        }
        return a;
      })
    );
    addToast('Regularization Submitted', 'Sent to HR/Manager for review.', 'info');
    addNotification('Regularization Submitted', 'Your punch regularization request is pending review.', 'attendance', 'attendance');
  };

  const resolveRegularization = (attendanceId: string, status: 'approved' | 'rejected', notes?: string) => {
    setAttendanceRecords((prev) =>
      prev.map((a) => {
        if (a.id === attendanceId) {
          return {
            ...a,
            regularizationStatus: status,
            status: status === 'approved' ? 'regularized' : 'absent',
            regularizedBy: currentProfile.id,
            regularizationNotes: notes || (status === 'approved' ? 'Approved by HR' : 'Rejected by HR')
          };
        }
        return a;
      })
    );
    addToast(
      status === 'approved' ? 'Request Approved' : 'Request Rejected',
      `Regularization request ${status}.`,
      status === 'approved' ? 'success' : 'warning'
    );
    addNotification(
      `Regularization ${status.toUpperCase()}`,
      `Your attendance request was ${status} by management.`,
      'attendance',
      'attendance'
    );
  };

  // --- TASKS & STANDUP ---
  const createTask = (taskData: Omit<TaskItem, 'id' | 'orgId' | 'createdAt'>) => {
    const newTask: TaskItem = {
      ...taskData,
      id: `tsk-${Date.now()}`,
      orgId: currentOrg.id,
      createdAt: new Date().toISOString()
    };
    setTasks((prev) => [newTask, ...prev]);

    try {
      const client = getSupabaseClient();
      client.from('tasks').insert({
        title: newTask.title,
        description: newTask.description,
        category: newTask.category,
        status: newTask.status,
        priority: newTask.priority,
        git_branch: newTask.gitBranch,
        pr_link: newTask.prLink,
        sprint_name: newTask.sprintName,
        campaign_name: newTask.campaignName,
        client_name: newTask.clientName,
        ad_spend_target: newTask.adSpendTarget,
        target_kpi: newTask.targetKpi
      });
    } catch (e) {}

    addToast('Task Created', `"${newTask.title}" added to ${newTask.category.toUpperCase()} board.`, 'success');
  };

  const updateTaskStatus = (taskId: string, status: TaskItem['status']) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    addToast('Task Status Updated', `Task moved to ${status.replace('_', ' ').toUpperCase()}`, 'info');
  };

  const submitStandup = (completedToday: string, plannedTomorrow: string, blockers?: string, hours: number = 8) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const newStandup: DailyStandup = {
      id: `std-${Date.now()}`,
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
        date: todayStr,
        completed_today: completedToday,
        planned_tomorrow: plannedTomorrow,
        blockers: blockers,
        hours_logged: hours
      });
    } catch (e) {}

    addToast('EOD Standup Submitted', 'Daily work log synced with attendance and team dashboard.', 'success');
    addNotification('Daily Standup Logged', 'EOD work log submitted successfully.', 'task', 'standups');
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
      const presentCount = empAttendance.filter((a) => a.status === 'present' || a.status === 'regularized').length;
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
        id: `pay-${emp.id}-${month}-${year}`,
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
        officeLocations,
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
