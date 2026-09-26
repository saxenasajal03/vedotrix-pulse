import {
  Organization,
  Profile,
  OfficeLocation,
  OfferLetter,
  AttendanceRecord,
  TaskItem,
  DailyStandup,
  PayrollRecord,
  InAppNotification,
  SystemBroadcast
} from '../types';

// ==============================================================================
// VEDOTRIX PULSE - PRODUCTION STATE
// Clean baseline: Master Root Organization & Superadmin Account
// Designed & Managed by Vedotrix Technologies
// ==============================================================================

export const INITIAL_ORGS: Organization[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Vedotrix Technologies Global',
    slug: 'vedotrix',
    orgCode: 'VDX',
    industry: 'Tech',
    website: 'https://vedotrix.com',
    address: 'Vedotrix Innovation Park, Cyber Hub, Bengaluru, India',
    phone: '+91 80 4400 9900',
    logoUrl: '/vedotrix-logo.png',
    subscriptionPlan: 'Enterprise',
    status: 'active',
    settings: {
      workHoursPerDay: 8,
      gracePeriodMins: 15,
      wfhAllowed: true,
      halfDayThresholdHours: 4.5
    }
  }
];

export const INITIAL_OFFICES: OfficeLocation[] = [
  {
    id: '00000000-0000-0000-0000-000000000002',
    orgId: '00000000-0000-0000-0000-000000000001',
    name: 'Vedotrix Master HQ (Bengaluru)',
    latitude: 12.9352,
    longitude: 77.6946,
    radiusMeters: 200,
    address: 'Outer Ring Road, Bellandur, Bengaluru',
    isActive: true
  }
];

export const INITIAL_PROFILES: Profile[] = [
  {
    id: '00000000-0000-0000-0000-000000000003',
    orgId: '00000000-0000-0000-0000-000000000001',
    email: 'admin@vedotrix.com',
    firstName: 'Vedotrix',
    lastName: 'Superadmin',
    role: 'superadmin',
    designation: 'Global Platform Architect & Super Controller',
    department: 'Platform Architecture & Cloud Security',
    joiningDate: '2022-01-01',
    baseSalary: 500000,
    avatarUrl: '/vedotrix-logo.png',
    isActive: true
  }
];

export const INITIAL_OFFERS: OfferLetter[] = [];
export const INITIAL_ATTENDANCE: AttendanceRecord[] = [];
export const INITIAL_TASKS: TaskItem[] = [];
export const INITIAL_STANDUPS: DailyStandup[] = [];
export const INITIAL_PAYROLL: PayrollRecord[] = [];

export const INITIAL_NOTIFICATIONS: InAppNotification[] = [
  {
    id: 'notif-vdx-welcome',
    title: 'Welcome to Vedotrix Pulse Production ⚡',
    message: 'System is connected to live Supabase DB. Ready to onboard real organizations and staff.',
    category: 'system',
    isRead: false,
    timestamp: 'Just now',
    linkTab: 'superadmin'
  }
];

export const INITIAL_BROADCASTS: SystemBroadcast[] = [
  {
    id: 'bc-production-live',
    title: 'Vedotrix Pulse Production Environment Active',
    message: 'Live cryptographic serial verification, GPS attendance tracking, and multi-tenant isolation are fully operational.',
    priority: 'info',
    issuedBy: 'Vedotrix Super Controller',
    issuedAt: new Date().toISOString(),
    targetOrgs: 'all'
  }
];
