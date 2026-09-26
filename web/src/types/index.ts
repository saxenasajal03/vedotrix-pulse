// ==============================================================================
// VEDOTRIX PULSE - DATA TYPES & INTERFACES
// Designed & Managed by Vedotrix Technologies
// ==============================================================================

export type UserRole = 'superadmin' | 'owner' | 'hr' | 'manager' | 'employee';

export type IndustryType = 'Tech' | 'Digital Marketing' | 'Hybrid';

export type ThemeMode = 'cyber-dark' | 'midnight' | 'corporate-light';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  orgCode: string; // e.g. 'VDX', 'NEX', 'VGL'
  industry: IndustryType;
  website: string;
  address: string;
  phone: string;
  logoUrl?: string;
  subscriptionPlan?: 'Starter' | 'Professional' | 'Enterprise';
  status?: 'active' | 'suspended';
  settings: {
    workHoursPerDay: number;
    gracePeriodMins: number;
    wfhAllowed: boolean;
    halfDayThresholdHours: number;
  };
}

export interface OrganizationAdminCredentials {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  designation?: string;
  department?: string;
  role?: UserRole;
}

export interface Profile {
  id: string;
  orgId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  designation: string;
  department: string;
  joiningDate: string;
  baseSalary: number;
  avatarUrl?: string;
  isActive: boolean;
  managerId?: string; // Designated Reporting Manager
  passwordHash?: string;
  modulesAccess?: string[]; // e.g. ['attendance', 'tasks', 'standups', 'offers', 'payroll']
}

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';
export type AccessRequestType = 'module_access' | 'permission_escalation' | 'org_feature';

export interface AccessRequest {
  id: string;
  orgId: string;
  requesterId: string;
  requestType: AccessRequestType;
  targetModule: string; // 'payroll' | 'offers' | 'tech_sprints' | 'geo_override' | 'admin_console'
  justification: string;
  status: AccessRequestStatus;
  assignedApproverId?: string; // Designated Manager ID or Org Owner
  approverDecisionNotes?: string;
  approvedAt?: string;
  createdAt: string;
}

export interface OfficeLocation {
  id: string;
  orgId: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  address: string;
  isActive: boolean;
}

export type OfferLetterStatus = 'draft' | 'issued' | 'accepted' | 'declined' | 'revoked';

export interface OfferLetter {
  id: string;
  orgId: string;
  serialNumber: string; // Format: VDX-[ORG_CODE]-[YEAR]-[HEX] or manual
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  designation: string;
  department: string;
  joiningDate: string;
  annualCtc: number;
  basicMonthly: number;
  hraMonthly: number;
  specialAllowance: number;
  status: OfferLetterStatus;
  verificationToken: string;
  pdfUrl?: string;
  securityCode?: string; // Optional security PIN / code set by HR
  hrDepartment?: string; // Department of issuing HR / Talent Acquisition
  managerId?: string; // Designated Reporting Manager
  managerName?: string;
  employeeId?: string; // Linked employee profile ID if issued to existing staff
  issuedBy: string; // profile id
  hrVerifiedAt?: string;
  candidateAcceptedAt?: string;
  createdAt: string;
}

export type AttendanceStatus = 'present' | 'half_day' | 'absent' | 'on_leave' | 'regularized';
export type RegularizationStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface AttendanceRecord {
  id: string;
  orgId: string;
  employeeId: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  checkInLat?: number;
  checkInLong?: number;
  checkOutLat?: number;
  checkOutLong?: number;
  locationId?: string;
  officeAddress?: string; // Human-readable office address
  distanceMeters?: number;
  status: AttendanceStatus;
  isRemote: boolean;
  approvalStatus?: 'approved' | 'pending_manager_approval' | 'rejected';
  approvedBy?: string;
  approvalNotes?: string;
  regularizationReason?: string;
  regularizationStatus: RegularizationStatus;
  regularizedBy?: string;
  regularizationNotes?: string;
  totalHours: number;
}

export type TaskCategory = 'tech' | 'marketing';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TaskItem {
  id: string;
  orgId: string;
  title: string;
  description: string;
  assignedTo: string; // profile id
  createdBy: string;
  category: TaskCategory;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  
  // Tech Attributes
  gitBranch?: string;
  prLink?: string;
  sprintName?: string;
  
  // Marketing Attributes
  campaignName?: string;
  clientName?: string;
  adSpendTarget?: number;
  targetKpi?: string;
  
  createdAt: string;
}

export interface DailyStandup {
  id: string;
  orgId: string;
  employeeId: string;
  date: string;
  completedToday: string;
  plannedTomorrow: string;
  blockers?: string;
  hoursLogged: number;
  createdAt: string;
}

export type PayoutStatus = 'pending' | 'processing' | 'paid';
export type PaymentMode = 'NEFT' | 'RTGS' | 'UPI' | 'IMPS';

export interface PayrollRecord {
  id: string;
  orgId: string;
  employeeId: string;
  month: number;
  year: number;
  workingDays: number;
  presentDays: number;
  lossOfPayDays: number;
  basicPay: number;
  hra: number;
  allowances: number;
  deductions: number;
  lopDeduction: number;
  netSalary: number;
  payoutStatus: PayoutStatus;
  payoutDate?: string;
  paymentMode: PaymentMode;
  paymentReference?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  createdAt: string;
}

export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  category: 'offer' | 'attendance' | 'task' | 'payroll' | 'system' | 'broadcast' | 'leave';
  isRead: boolean;
  timestamp: string;
  linkTab?: string;
}

export interface SystemBroadcast {
  id: string;
  title: string;
  message: string;
  priority: 'info' | 'alert' | 'critical';
  issuedBy: string;
  issuedAt: string;
  targetOrgs: 'all' | string[];
}

export type LeaveType = 'casual' | 'sick' | 'privilege' | 'unpaid' | 'emergency' | 'maternity' | 'paternity';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  id: string;
  orgId: string;
  employeeId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  isHalfDay?: boolean;
  halfDaySession?: 'first_half' | 'second_half';
  reason: string;
  status: LeaveStatus;
  assignedApproverId?: string;
  approverDecisionNotes?: string;
  approvedBy?: string;
  decidedAt?: string;
  documentUrl?: string;
  createdAt: string;
}

export interface LeaveBalance {
  casual: { total: number; used: number; remaining: number };
  sick: { total: number; used: number; remaining: number };
  privilege: { total: number; used: number; remaining: number };
  unpaid: { used: number };
}
