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
    shiftStartTime?: string; // e.g. '09:30' (IST)
    shiftEndTime?: string; // e.g. '18:30' (IST)
    weekOffDays?: number[]; // e.g. [0] for Sunday (0=Sun, 1=Mon, ..., 6=Sat)
    holidays?: Holiday[];
    employeeStatutory?: Record<string, { bankName?: string; accountNumber?: string; ifscCode?: string; pfNumber?: string }>;
    leavePolicy?: {
      casualTotal: number;
      sickTotal: number;
      privilegeTotal: number;
    };
  };
}

export type HolidayType = 'national' | 'festival' | 'company' | 'restricted' | 'gazetted' | 'optional';

export interface Holiday {
  id: string;
  orgId: string;
  name: string;
  date: string; // YYYY-MM-DD (in IST)
  type: HolidayType;
  description?: string;
  isMandatory?: boolean;
  createdBy?: string;
  createdAt?: string;
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
  
  // Banking & Statutory info (managed by HR/Superadmin)
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  pfNumber?: string; // Provident Fund / UAN number
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
  deductionNotes?: string;
  customDeductions?: number;
  bonus?: number;
  createdAt: string;
}

export interface InAppNotification {
  id: string;
  orgId?: string;
  recipientId?: string; // target user ID (optional)
  recipientRole?: UserRole | 'all'; // target role (optional, e.g. 'hr', 'superadmin', 'manager', 'employee', 'all')
  title: string;
  message: string;
  category: 'offer' | 'attendance' | 'task' | 'payroll' | 'system' | 'broadcast' | 'leave' | 'announcement';
  isRead: boolean;
  timestamp: string;
  createdAt?: string;
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

export type MeetingStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface MeetingEvent {
  id: string;
  orgId: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime?: string; // HH:mm
  isOnline: boolean;
  meetingUrl?: string; // e.g. Google Meet, Zoom, Teams
  location?: string; // e.g. Conference Room A
  organizerId: string;
  organizerName: string;
  organizerRole: string; // 'manager' | 'superadmin' | 'hr' | 'owner'
  attendeeIds: string[]; // List of employee IDs or ['all']
  department?: string; // 'All' or specific
  status: MeetingStatus;
  createdAt: string;
}

export type NoticeCategory = 'announcement' | 'policy' | 'holiday' | 'urgent' | 'event';
export type NoticePriority = 'critical' | 'high' | 'medium' | 'low';

export interface NoticeItem {
  id: string;
  orgId: string;
  title: string;
  content: string;
  category: NoticeCategory;
  priority: NoticePriority;
  authorId: string;
  authorName: string;
  authorRole: string;
  date: string; // IST ISO string
  attachmentUrl?: string;
  isPinned?: boolean;
  createdAt: string;
}

export interface ChatAttachment {
  id: string;
  name: string;
  size: number; // in bytes
  type: string; // MIME type e.g. image/png, video/mp4, application/pdf
  url: string; // Base64 data URL or hosted URL
  category: 'image' | 'video' | 'audio' | 'document' | 'other';
}

export interface ChatMessage {
  id: string;
  orgId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  senderAvatar?: string;
  channel: string; // e.g. 'support', custom channel name, or 'dm:<id1>:<id2>'
  recipientId?: string;
  message: string;
  attachments?: ChatAttachment[];
  reactions?: Array<{ emoji: string; count: number; userIds: string[] }>;
  replyToMessageId?: string;
  replyToSnippet?: string;
  isPinned?: boolean;
  isEdited?: boolean;
  editedAt?: string;
  isDeleted?: boolean;
  createdAt: string;
}

export interface ChatChannel {
  id: string;
  orgId: string;
  name: string;
  description: string;
  isPrivate?: boolean;
  memberIds?: string[];
  createdBy?: string;
  createdByName?: string;
  type: 'channel' | 'group' | 'dm';
  unreadCount?: number;
  createdAt?: string;
}
