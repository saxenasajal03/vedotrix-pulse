// ==============================================================================
// ADVANCED SERIAL NUMBER & VERIFICATION UTILITIES
// Designed & Managed by Vedotrix Technologies
// ==============================================================================

/**
 * Generates an enterprise tamper-proof serial number:
 * Format: VDX-[ORG_CODE]-[YEAR]-[6-CHAR-HEX]
 * Example: VDX-NEX-2026-9E41B2
 */
export function generateOfferSerialNumber(orgCode: string): string {
  const year = new Date().getFullYear();
  const hex = Math.random().toString(16).substring(2, 8).toUpperCase();
  const cleanCode = (orgCode || 'CORP').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  return `VDX-${cleanCode}-${year}-${hex}`;
}

/**
 * Generates a verification hash token
 */
export function generateVerificationToken(serial: string, email: string): string {
  const salt = 'vedotrix_tamper_seal_2026';
  const raw = `${serial}:${email}:${Date.now()}:${salt}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `vdx_sec_${Math.abs(hash).toString(16)}${Math.random().toString(36).substring(2, 6)}`;
}

/**
 * Formats Indian Currency or Standard Currency (₹)
 */
export function formatCurrency(amount: number): string {
  const val = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val);
}

/**
 * Formats salary or intern stipend with clear unpaid indication
 */
export function formatSalaryOrStipend(amount: number, isAnnual = false): string {
  if (!amount || amount === 0) {
    return isAnnual ? '₹0 (Unpaid)' : '₹0 / Unpaid Intern';
  }
  return formatCurrency(amount);
}

/**
 * Generates an RFC 4122 v4 compliant UUID for PostgreSQL UUID columns
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Returns today's date in Indian Standard Time (Asia/Kolkata, UTC+5:30) as YYYY-MM-DD
 */
export function getTodayISTDateString(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Formats time in Indian Standard Time (hh:mm a IST)
 */
export function formatISTTime(dateStrOrIso?: string): string {
  if (!dateStrOrIso) return '';
  try {
    const d = new Date(dateStrOrIso);
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return '';
  }
}

/**
 * Formats date in Indian Standard Time (DD MMM YYYY)
 */
export function formatISTDate(dateStrOrIso?: string): string {
  if (!dateStrOrIso) return '';
  try {
    const d = new Date(dateStrOrIso);
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateStrOrIso;
  }
}

/**
 * Formats date and time in Indian Standard Time
 */
export function formatISTDateTime(dateStrOrIso?: string): string {
  if (!dateStrOrIso) return '';
  try {
    const d = new Date(dateStrOrIso);
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  } catch {
    return dateStrOrIso;
  }
}

