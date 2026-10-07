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
  SystemBroadcast,
  Holiday
} from '../types';

// ==============================================================================
// VEDOTRIX PULSE - PRODUCTION DATABASE BASELINE
// Perfectly synced with Supabase Cluster: cqevzpvyqvckvenutuzz.supabase.co
// ==============================================================================

export const INITIAL_HOLIDAYS: Holiday[] = [
  {
    id: 'hol-001',
    orgId: '11111111-2222-3333-4444-555555555555',
    name: 'Republic Day',
    date: '2026-01-26',
    type: 'national',
    description: 'Celebration of the Constitution of India',
    isMandatory: true
  },
  {
    id: 'hol-002',
    orgId: '11111111-2222-3333-4444-555555555555',
    name: 'Holi (Festival of Colors)',
    date: '2026-03-04',
    type: 'festival',
    description: 'Spring festival of colors and harmony',
    isMandatory: true
  },
  {
    id: 'hol-003',
    orgId: '11111111-2222-3333-4444-555555555555',
    name: 'Eid-ul-Fitr',
    date: '2026-03-21',
    type: 'festival',
    description: 'Eid Celebrations',
    isMandatory: true
  },
  {
    id: 'hol-004',
    orgId: '11111111-2222-3333-4444-555555555555',
    name: 'Independence Day',
    date: '2026-08-15',
    type: 'national',
    description: 'National Day commemorating Indian Independence',
    isMandatory: true
  },
  {
    id: 'hol-005',
    orgId: '11111111-2222-3333-4444-555555555555',
    name: 'Gandhi Jayanti',
    date: '2026-10-02',
    type: 'national',
    description: 'Honoring the Father of the Nation, Mahatma Gandhi',
    isMandatory: true
  },
  {
    id: 'hol-006',
    orgId: '11111111-2222-3333-4444-555555555555',
    name: 'Dussehra (Vijayadashami)',
    date: '2026-10-20',
    type: 'festival',
    description: 'Festival commemorating the victory of good over evil',
    isMandatory: true
  },
  {
    id: 'hol-007',
    orgId: '11111111-2222-3333-4444-555555555555',
    name: 'Diwali (Deepavali)',
    date: '2026-11-08',
    type: 'festival',
    description: 'The Great Festival of Lights',
    isMandatory: true
  },
  {
    id: 'hol-008',
    orgId: '11111111-2222-3333-4444-555555555555',
    name: 'Govardhan Puja',
    date: '2026-11-09',
    type: 'festival',
    description: 'Post-Diwali festivity and thanksgiving',
    isMandatory: true
  },
  {
    id: 'hol-009',
    orgId: '11111111-2222-3333-4444-555555555555',
    name: 'Guru Nanak Jayanti',
    date: '2026-11-24',
    type: 'festival',
    description: 'Prakash Utsav celebrating Guru Nanak Dev Ji',
    isMandatory: true
  },
  {
    id: 'hol-010',
    orgId: '11111111-2222-3333-4444-555555555555',
    name: 'Christmas Day',
    date: '2026-12-25',
    type: 'festival',
    description: 'Celebration of Christmas',
    isMandatory: true
  }
];

export const INITIAL_ORGS: Organization[] = [
  {
    id: '11111111-2222-3333-4444-555555555555',
    name: 'BNK Digital',
    slug: 'bnk-digital',
    orgCode: 'BNK',
    industry: 'Digital Marketing',
    website: 'https://bnkdigitalagency.netlify.app',
    address: 'BNK Digital, 5/237, Vipul Khand, Gomtinagar, Lucknow - 226001',
    phone: '+91 6388043581',
    logoUrl: 'https://cqevzpvyqvckvenutuzz.supabase.co/storage/v1/object/public/organization-logos/org_logo_1790444633928_a75b1980-ad73-4aa6-8391-c248a07e1b0d.jpg',
    subscriptionPlan: 'Enterprise',
    status: 'active',
    settings: {
      workHoursPerDay: 8,
      gracePeriodMins: 15,
      wfhAllowed: true,
      halfDayThresholdHours: 4.5,
      shiftStartTime: '09:30',
      shiftEndTime: '18:30',
      weekOffDays: [0], // Sunday is standard week off
      holidays: INITIAL_HOLIDAYS
    }
  },
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Vedotrix Technologies Global',
    slug: 'vedotrix',
    orgCode: 'VDX',
    industry: 'Tech',
    website: 'https://vedotrix.com',
    address: 'Vedotrix Innovation Park, Bengaluru, India',
    phone: '+91 80 4400 9900',
    logoUrl: 'https://cqevzpvyqvckvenutuzz.supabase.co/storage/v1/object/public/organization-logos/vedotrix-master-1790423686695.png',
    subscriptionPlan: 'Enterprise',
    status: 'active',
    settings: {
      workHoursPerDay: 8,
      gracePeriodMins: 15,
      wfhAllowed: true,
      halfDayThresholdHours: 4.5,
      shiftStartTime: '09:30',
      shiftEndTime: '18:30',
      weekOffDays: [0],
      holidays: INITIAL_HOLIDAYS
    }
  }
];

export const INITIAL_OFFICES: OfficeLocation[] = [
  {
    id: 'office-bnk-hq-001',
    orgId: '11111111-2222-3333-4444-555555555555',
    name: 'BNK Digital Main Office (Lucknow)',
    latitude: 26.8524,
    longitude: 80.9998,
    radiusMeters: 200,
    address: 'BNK Digital, 5/237, Vipul Khand, Gomtinagar, Lucknow - 226001',
    isActive: true
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    orgId: '00000000-0000-0000-0000-000000000001',
    name: 'Vedotrix Master HQ (Bengaluru)',
    latitude: 12.9352,
    longitude: 77.6946,
    radiusMeters: 200,
    address: 'Vedotrix Innovation Park, Bengaluru, India',
    isActive: true
  }
];

export const INITIAL_PROFILES: Profile[] = [
  {
    id: '723d4f27-051a-4f30-93b3-1e1312b0c520',
    orgId: '11111111-2222-3333-4444-555555555555',
    email: 'chiefhead.interndesire@gmail.com',
    firstName: 'Sajal',
    lastName: 'Saxena',
    phone: '+91 8840810386',
    role: 'superadmin',
    designation: 'Founder & Director',
    department: 'Executive Leadership',
    joiningDate: '2026-10-01',
    baseSalary: 150000,
    avatarUrl: '/vedotrix-logo.png',
    isActive: true,
    managerId: 'f45f25ec-6430-421f-8553-f8e92c4ff6ef',
    modulesAccess: ['all', 'attendance', 'tasks', 'standups', 'offers', 'payroll', 'access_requests', 'leaves'],
    bankName: 'HDFC Bank',
    accountNumber: '50100492817291',
    ifscCode: 'HDFC0001042',
    pfNumber: 'UP/LKO/0049281/000/0001092'
  },
  {
    id: 'f45f25ec-6430-421f-8553-f8e92c4ff6ef',
    orgId: '11111111-2222-3333-4444-555555555555',
    email: 'media.sparshsinha@gmail.com',
    firstName: 'Sparsh',
    lastName: 'Sinha',
    phone: '+91 9129482910',
    role: 'owner',
    designation: 'Managing Director',
    department: 'Management',
    joiningDate: '2026-09-01',
    baseSalary: 200000,
    avatarUrl: '/vedotrix-logo.png',
    isActive: true,
    modulesAccess: ['all', 'attendance', 'tasks', 'standups', 'offers', 'payroll', 'access_requests', 'leaves'],
    bankName: 'ICICI Bank',
    accountNumber: '001205019284',
    ifscCode: 'ICIC0000012',
    pfNumber: 'UP/LKO/0049281/000/0001093'
  },
  {
    id: '22222222-3333-4444-5555-666666666666',
    orgId: '11111111-2222-3333-4444-555555555555',
    email: 'kshitiznarayan543@gmail.com',
    firstName: 'Kshitiz',
    lastName: 'Narayan',
    phone: '+91 7905102941',
    role: 'superadmin',
    designation: 'HR Head',
    department: 'Human Resources',
    joiningDate: '2026-09-26',
    baseSalary: 120000,
    avatarUrl: '/vedotrix-logo.png',
    isActive: true,
    managerId: '723d4f27-051a-4f30-93b3-1e1312b0c520',
    modulesAccess: ['all', 'attendance', 'tasks', 'standups', 'offers', 'payroll', 'access_requests', 'leaves'],
    bankName: 'State Bank of India',
    accountNumber: '38192847192',
    ifscCode: 'SBIN0004021',
    pfNumber: 'UP/LKO/0049281/000/0001094'
  },
  {
    id: '7a12b3e7-b434-4971-b281-ac045e0c5804',
    orgId: '11111111-2222-3333-4444-555555555555',
    email: 'akashsharma66619@gmail.com',
    firstName: 'Aakash',
    lastName: 'Kaushik',
    phone: '+91 9410293819',
    role: 'manager',
    designation: 'Growth Marketing Manager',
    department: 'Growth Marketing',
    joiningDate: '2026-10-01',
    baseSalary: 90000,
    avatarUrl: '/vedotrix-logo.png',
    isActive: true,
    managerId: '723d4f27-051a-4f30-93b3-1e1312b0c520',
    modulesAccess: ['attendance', 'tasks', 'standups', 'leaves'],
    bankName: 'Canara Bank',
    accountNumber: '1928101029481',
    ifscCode: 'CNRB0001928',
    pfNumber: 'UP/LKO/0049281/000/0001099'
  },
  {
    id: '2b294c7e-ab50-414a-9542-ba2e6702a0fb',
    orgId: '11111111-2222-3333-4444-555555555555',
    email: 'dakshkavyansh12@gmail.com',
    firstName: 'Kavyansh',
    lastName: 'Daksh',
    phone: '+91 9412357586',
    role: 'employee',
    designation: 'Social Media Intern',
    department: 'Growth Marketing',
    joiningDate: '2026-09-09',
    baseSalary: 0,
    avatarUrl: '/vedotrix-logo.png',
    isActive: true,
    managerId: '22222222-3333-4444-5555-666666666666',
    modulesAccess: ['attendance', 'tasks', 'standups', 'leaves', 'offers'],
    bankName: 'Bank of Baroda',
    accountNumber: '28190100019284',
    ifscCode: 'BARB0VKLUCK',
    pfNumber: 'UP/LKO/0049281/000/0001097'
  },
  {
    id: 'e8e01a75-17df-474d-a35c-3ae65e412508',
    orgId: '11111111-2222-3333-4444-555555555555',
    email: 'antrakumari265@gmail.com',
    firstName: 'Antra',
    lastName: 'Thakur',
    phone: '+91 6009722769',
    role: 'employee',
    designation: 'Digital Marketing Intern',
    department: 'Growth Marketing',
    joiningDate: '2026-09-09',
    baseSalary: 0,
    avatarUrl: '/vedotrix-logo.png',
    isActive: true,
    managerId: '22222222-3333-4444-5555-666666666666',
    modulesAccess: ['attendance', 'tasks', 'standups', 'leaves', 'offers'],
    bankName: 'Axis Bank',
    accountNumber: '921010048192831',
    ifscCode: 'UTIB0000281',
    pfNumber: 'UP/LKO/0049281/000/0001096'
  },
  {
    id: 'bd0c0b28-c544-4c1c-86aa-ff3746fe4829',
    orgId: '11111111-2222-3333-4444-555555555555',
    email: 'rahulsaini967297@gmail.com',
    firstName: 'Rahul',
    lastName: 'Saini',
    phone: '+91 9672978894',
    role: 'employee',
    designation: 'Graphic Design & Video Editing Intern',
    department: 'Growth Marketing',
    joiningDate: '2026-09-09',
    baseSalary: 0,
    avatarUrl: '/vedotrix-logo.png',
    isActive: true,
    managerId: '22222222-3333-4444-5555-666666666666',
    modulesAccess: ['attendance', 'tasks', 'standups', 'leaves', 'offers'],
    bankName: 'Punjab National Bank',
    accountNumber: '19280001928371',
    ifscCode: 'PUNB0192800',
    pfNumber: 'UP/LKO/0049281/000/0001095'
  },
  {
    id: '7e8fe28a-7011-4df0-b2c4-b3e14295444d',
    orgId: '11111111-2222-3333-4444-555555555555',
    email: 'tistamaity5@gmail.com',
    firstName: 'Tista',
    lastName: 'Maity',
    phone: '+91 9830192847',
    role: 'employee',
    designation: 'Video Editing Intern',
    department: 'Growth Marketing',
    joiningDate: '2026-09-09',
    baseSalary: 0,
    avatarUrl: '/vedotrix-logo.png',
    isActive: true,
    managerId: '22222222-3333-4444-5555-666666666666',
    modulesAccess: ['attendance', 'tasks', 'standups', 'leaves', 'offers'],
    bankName: 'Kotak Mahindra Bank',
    accountNumber: '4819284719',
    ifscCode: 'KKBK0000192',
    pfNumber: 'UP/LKO/0049281/000/0001098'
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    orgId: '00000000-0000-0000-0000-000000000001',
    email: 'admin@vedotrix.com',
    firstName: 'Vedotrix',
    lastName: 'Superadmin',
    phone: '+91 80 4400 9900',
    role: 'superadmin',
    designation: 'Chief Executive Officer',
    department: 'Platform Engineering',
    joiningDate: '2022-01-01',
    baseSalary: 500000,
    avatarUrl: '/vedotrix-logo.png',
    isActive: true,
    modulesAccess: ['all'],
    bankName: 'HDFC Bank',
    accountNumber: '50100998811223',
    ifscCode: 'HDFC0000501',
    pfNumber: 'KN/BNG/0019284/000/0000001'
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    orgId: '00000000-0000-0000-0000-000000000001',
    email: 'sajalsaxenagola@gmail.com',
    firstName: 'Sajal',
    lastName: 'Saxena',
    phone: '+91 8840810386',
    role: 'superadmin',
    designation: 'Founder & Super Controller',
    department: 'Executive Leadership',
    joiningDate: '2022-01-01',
    baseSalary: 500000,
    avatarUrl: '/vedotrix-logo.png',
    isActive: true,
    modulesAccess: ['all'],
    bankName: 'HDFC Bank',
    accountNumber: '50100492817291',
    ifscCode: 'HDFC0001042',
    pfNumber: 'KN/BNG/0019284/000/0000002'
  }
];

export const INITIAL_OFFERS: OfferLetter[] = [
  {
    id: '92fa2388-6451-43b8-99a9-eda996768344',
    orgId: '11111111-2222-3333-4444-555555555555',
    serialNumber: 'BNK/OL/GV-INT/0003/2026',
    candidateName: 'Rahul Saini',
    candidateEmail: 'rahulsaini967297@gmail.com',
    candidatePhone: '+91 9672978894',
    designation: 'Graphic Design & Video Editing Intern',
    department: 'Growth Marketing',
    joiningDate: '2026-09-09',
    annualCtc: 0,
    basicMonthly: 0,
    hraMonthly: 0,
    specialAllowance: 0,
    status: 'issued',
    verificationToken: 'vdx_sec_2cb80d78pdhs',
    pdfUrl: 'https://cqevzpvyqvckvenutuzz.supabase.co/storage/v1/object/public/documents/offer_doc_1790448950631_BNK_Internship_Offer_Letter_RahulSaini_BNK-GV_INT_0003.pdf',
    securityCode: 'RS3B-INTN-GV26K',
    hrDepartment: 'HR & Talent Acquisition',
    managerId: '22222222-3333-4444-5555-666666666666',
    employeeId: 'bd0c0b28-c544-4c1c-86aa-ff3746fe4829',
    issuedBy: '22222222-3333-4444-5555-666666666666',
    createdAt: '2026-09-26T18:57:34.792907+00:00'
  },
  {
    id: '838909f8-75b2-41d0-97ec-891f4d8b418c',
    orgId: '11111111-2222-3333-4444-555555555555',
    serialNumber: 'BNK/OL/DM-INT/0002/2026',
    candidateName: 'Antra Thakur',
    candidateEmail: 'antrakumari265@gmail.com',
    candidatePhone: '+91 6009722769',
    designation: 'Digital Marketing Intern',
    department: 'Growth Marketing',
    joiningDate: '2026-09-09',
    annualCtc: 0,
    basicMonthly: 0,
    hraMonthly: 0,
    specialAllowance: 0,
    status: 'issued',
    verificationToken: 'vdx_sec_5f909fa35pdq',
    pdfUrl: 'https://cqevzpvyqvckvenutuzz.supabase.co/storage/v1/object/public/documents/offer_doc_1790448829089_BNK_Internship_Offer_Letter_AntraThakur_BNK-DM_INT_0002.pdf',
    securityCode: 'AT2B-INTN-DM26K',
    hrDepartment: 'HR & Talent Acquisition',
    managerId: '22222222-3333-4444-5555-666666666666',
    employeeId: 'e8e01a75-17df-474d-a35c-3ae65e412508',
    issuedBy: '22222222-3333-4444-5555-666666666666',
    createdAt: '2026-09-26T18:54:59.550049+00:00'
  },
  {
    id: '49264d84-19e9-4851-ac07-594dbce0601d',
    orgId: '11111111-2222-3333-4444-555555555555',
    serialNumber: 'BNK/OL/SM-INT/0001/2026',
    candidateName: 'Kavyansh Daksh',
    candidateEmail: 'dakshkavyansh12@gmail.com',
    candidatePhone: '+91 9412357586',
    designation: 'Social Media Intern',
    department: 'Growth Marketing',
    joiningDate: '2026-09-09',
    annualCtc: 0,
    basicMonthly: 0,
    hraMonthly: 0,
    specialAllowance: 0,
    status: 'issued',
    verificationToken: 'vdx_sec_47b3feff463o',
    pdfUrl: 'https://cqevzpvyqvckvenutuzz.supabase.co/storage/v1/object/public/documents/offer_doc_1790447069068_BNK_Internship_Offer_Letter_KavyanshDaksh_BNK-SM_INT_0001.pdf',
    securityCode: 'KD1B-INTN-SM26K',
    hrDepartment: 'HR & Talent Acquisition',
    managerId: '22222222-3333-4444-5555-666666666666',
    employeeId: '2b294c7e-ab50-414a-9542-ba2e6702a0fb',
    issuedBy: '22222222-3333-4444-5555-666666666666',
    createdAt: '2026-09-26T18:24:44.142567+00:00'
  },
  {
    id: 'ab31630b-52d3-485d-b6c8-52a784fc4871',
    orgId: '11111111-2222-3333-4444-555555555555',
    serialNumber: 'BNK/OL/VE-INT/0004/2026',
    candidateName: 'Tista Maity',
    candidateEmail: 'tistamaity5@gmail.com',
    candidatePhone: '+91 8100660225',
    designation: 'Video Editing Intern',
    department: 'Growth Marketing',
    joiningDate: '2026-09-09',
    annualCtc: 0,
    basicMonthly: 0,
    hraMonthly: 0,
    specialAllowance: 0,
    status: 'accepted',
    verificationToken: 'vdx_sec_55b4f7edygz2',
    pdfUrl: 'https://cqevzpvyqvckvenutuzz.supabase.co/storage/v1/object/public/documents/offer_doc_1790449075223_BNK_Internship_Offer_Letter_TistaMaity_BNK-INT_0004.pdf',
    securityCode: 'TM4B-INTN-VE26K',
    hrDepartment: 'HR & Talent Acquisition',
    managerId: '22222222-3333-4444-5555-666666666666',
    employeeId: '7e8fe28a-7011-4df0-b2c4-b3e14295444d',
    issuedBy: '22222222-3333-4444-5555-666666666666',
    createdAt: '2026-09-26T18:59:07.219398+00:00'
  },
  {
    id: 'c106300b-f622-48aa-bc28-5a55584e889f',
    orgId: '00000000-0000-0000-0000-000000000001',
    serialNumber: 'VDX-TEST-LINK-001',
    candidateName: 'Vedotrix Superadmin',
    candidateEmail: 'admin@vedotrix.com',
    candidatePhone: '+91 80 4400 9900',
    designation: 'Chief Technology Officer',
    department: 'Platform Engineering',
    joiningDate: '2026-10-01',
    annualCtc: 2400000,
    basicMonthly: 100000,
    hraMonthly: 50000,
    specialAllowance: 50000,
    status: 'issued',
    verificationToken: 'tok-verify-link',
    securityCode: 'VDX1-CTO-2026',
    hrDepartment: 'Executive Talent Unit',
    employeeId: '00000000-0000-0000-0000-000000000003',
    issuedBy: '00000000-0000-0000-0000-000000000003',
    createdAt: '2026-09-26T17:24:03.118555+00:00'
  }
];

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
    createdAt: new Date().toISOString(),
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
