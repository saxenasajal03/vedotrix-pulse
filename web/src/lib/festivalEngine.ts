// ==============================================================================
// VEDOTRIX PULSE - DYNAMIC FESTIVAL THEME & ICON ENGINE
// Automatically adapts App Icon, Logo, Theme, and Interface based on Festivals
// (Dussehra / Vijayadashami, Diwali / Deepavali, New Year, Holi, Independence Day)
// ==============================================================================

export type FestivalId = 'dussehra' | 'diwali' | 'newyear' | 'holi' | 'national' | 'none';

export interface FestivalConfig {
  id: FestivalId;
  name: string;
  shortLabel: string;
  iconSymbol: string; // Emoji motif
  greetingTitle: string;
  greetingSubtitle: string;
  wishMessage: string;
  badgeText: string;
  primaryColor: string; // Hex
  secondaryColor: string; // Hex
  glowColor: string; // Hex for box-shadow / aura
  gradientBg: string; // Tailwind gradient class
  sparkles: string[];
  bannerBg: string;
}

export const FESTIVALS: Record<FestivalId, FestivalConfig> = {
  dussehra: {
    id: 'dussehra',
    name: 'Dussehra (Vijayadashami)',
    shortLabel: 'Dussehra Utsav',
    iconSymbol: '🏹',
    greetingTitle: 'Happy Dussehra & Vijayadashami! 🏹',
    greetingSubtitle: 'May the triumph of righteousness, courage, and truth illuminate your path with everlasting success.',
    wishMessage: 'Celebrating the victory of good over evil. Wishing you and your team supreme prosperity, triumph in every project, and joy!',
    badgeText: '🏹 VIJAYADASHAMI UTSAV',
    primaryColor: '#f59e0b', // Amber Gold
    secondaryColor: '#dc2626', // Crimson Red
    glowColor: 'rgba(245, 158, 11, 0.45)',
    gradientBg: 'from-amber-600 via-orange-600 to-red-700',
    sparkles: ['🏹', '✨', '🚩', '⚡', '🌟'],
    bannerBg: 'linear-gradient(135deg, rgba(220, 38, 38, 0.15) 0%, rgba(245, 158, 11, 0.2) 50%, rgba(217, 119, 6, 0.12) 100%)'
  },
  diwali: {
    id: 'diwali',
    name: 'Diwali (Deepavali)',
    shortLabel: 'Diwali Utsav',
    iconSymbol: '🪔',
    greetingTitle: 'Shubh Deepavali! 🪔',
    greetingSubtitle: 'May the divine festival of lights illuminate your life with infinite wealth, health, happiness, and peace.',
    wishMessage: 'May Lord Ganesha and Goddess Lakshmi bless your workspace with boundless prosperity and radiant new beginnings.',
    badgeText: '🪔 SHUBH DEEPAVALI',
    primaryColor: '#fbbf24', // Warm Gold
    secondaryColor: '#ea580c', // Marigold Orange
    glowColor: 'rgba(251, 191, 36, 0.5)',
    gradientBg: 'from-amber-500 via-yellow-500 to-orange-600',
    sparkles: ['🪔', '✨', '🎆', '🌟', '🪷'],
    bannerBg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(234, 88, 12, 0.18) 50%, rgba(202, 138, 4, 0.15) 100%)'
  },
  newyear: {
    id: 'newyear',
    name: 'New Year & Holiday Season',
    shortLabel: 'New Year 2027',
    iconSymbol: '🎉',
    greetingTitle: 'Happy New Year & Season Greetings! 🎉',
    greetingSubtitle: 'Wishing you another remarkable year of breakthrough milestones, innovation, and achievements at Vedotrix.',
    wishMessage: 'Here is to new beginnings, audacious goals, and shared triumphs across all our teams.',
    badgeText: '🎉 NEW YEAR SPECIAL',
    primaryColor: '#38bdf8',
    secondaryColor: '#818cf8',
    glowColor: 'rgba(56, 189, 248, 0.45)',
    gradientBg: 'from-sky-500 via-indigo-500 to-purple-600',
    sparkles: ['🎉', '✨', '🍾', '⭐', '🎈'],
    bannerBg: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)'
  },
  holi: {
    id: 'holi',
    name: 'Holi (Festival of Colors)',
    shortLabel: 'Holi Utsav',
    iconSymbol: '🎨',
    greetingTitle: 'Happy Holi! 🎨',
    greetingSubtitle: 'May the vibrant colors of joy, camaraderie, and cheer fill your days with harmony and happiness.',
    wishMessage: 'Wishing you a spirited celebration of colors, unity, and joyful togetherness with your loved ones.',
    badgeText: '🎨 HOLI UTSAV',
    primaryColor: '#ec4899',
    secondaryColor: '#8b5cf6',
    glowColor: 'rgba(236, 72, 153, 0.45)',
    gradientBg: 'from-pink-500 via-purple-500 to-indigo-600',
    sparkles: ['🎨', '🌸', '✨', '🌈', '🌺'],
    bannerBg: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)'
  },
  national: {
    id: 'national',
    name: 'Republic / Independence Celebration',
    shortLabel: 'Tiranga Pride',
    iconSymbol: '🇮🇳',
    greetingTitle: 'Proud Indian Spirit! 🇮🇳',
    greetingSubtitle: 'Saluting the vibrant spirit, unity, and technological advancement of our great nation.',
    wishMessage: 'Honoring our heritage and contributing to India innovation on the global stage.',
    badgeText: '🇮🇳 JAI HIND',
    primaryColor: '#f97316',
    secondaryColor: '#10b981',
    glowColor: 'rgba(249, 115, 22, 0.45)',
    gradientBg: 'from-orange-500 via-white to-emerald-600',
    sparkles: ['🇮🇳', '✨', '⭐', '🕊️', '🌸'],
    bannerBg: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%)'
  },
  none: {
    id: 'none',
    name: 'Vedotrix Pulse Standard',
    shortLabel: 'Standard Theme',
    iconSymbol: '⚡',
    greetingTitle: 'Welcome to Vedotrix Pulse',
    greetingSubtitle: 'Enterprise Multi-Tenant HRMS & Operational Intelligence Suite',
    wishMessage: 'Empowering your enterprise operations with precision and speed.',
    badgeText: '⚡ ENTERPRISE',
    primaryColor: '#2563eb',
    secondaryColor: '#0ea5e9',
    glowColor: 'rgba(37, 99, 235, 0.35)',
    gradientBg: 'from-blue-600 via-indigo-600 to-purple-600',
    sparkles: ['⚡', '✨', '🚀'],
    bannerBg: 'transparent'
  }
};

/**
 * Determines which festival is currently active based on Date in Asia/Kolkata timezone.
 * Supports manual override saved in localStorage for user testing / previewing!
 */
export function getActiveFestival(dateObj?: Date): FestivalConfig {
  try {
    const override = localStorage.getItem('vdx_festival_override') as FestivalId | null;
    if (override && FESTIVALS[override]) {
      return FESTIVALS[override];
    }
  } catch {}

  const d = dateObj || new Date();
  // Get date in IST
  const istDateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
  const [, monthStr, dayStr] = istDateStr.split('-');
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  // 1. Dussehra Season: Concluded for 2026 (ended Oct 20)
  // (Past season - Dussehra theme removed)

  // 2. Diwali Season: Late October to Mid November (Oct 28 - Nov 15)
  if ((month === 10 && day >= 28) || (month === 11 && day <= 15)) {
    return FESTIVALS.diwali;
  }

  // 3. New Year & Christmas Season: Dec 20 to Jan 3
  if ((month === 12 && day >= 20) || (month === 1 && day <= 3)) {
    return FESTIVALS.newyear;
  }

  // 4. Republic Day: Jan 24 - Jan 27
  if (month === 1 && day >= 24 && day <= 27) {
    return FESTIVALS.national;
  }

  // 5. Holi Season: March 1 - March 10
  if (month === 3 && day >= 1 && day <= 10) {
    return FESTIVALS.holi;
  }

  // 6. Independence Day: Aug 12 - Aug 17
  if (month === 8 && day >= 12 && day <= 17) {
    return FESTIVALS.national;
  }

  // Default fallback (or if user requests festive preview)
  return FESTIVALS.none;
}

/**
 * Sets manual festival override for previewing (e.g. testing Dussehra or Diwali)
 */
export function setFestivalOverride(festivalId: FestivalId | 'auto') {
  try {
    if (festivalId === 'auto') {
      localStorage.removeItem('vdx_festival_override');
    } else {
      localStorage.setItem('vdx_festival_override', festivalId);
    }
    // Dispatch custom event to notify all components
    window.dispatchEvent(new Event('vdx_festival_change'));
  } catch {}
}

/**
 * Generates an SVG Data URL favicon for the browser tab dynamically
 */
export function updateBrowserFavicon(festival: FestivalConfig) {
  if (typeof document === 'undefined') return;

  const existingFavicon = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!existingFavicon) return;

  if (festival.id === 'none') {
    existingFavicon.href = '/vedotrix-logo.png';
    return;
  }

  // Create high-res SVG favicon with festival motif + glowing ring
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
      <defs>
        <radialGradient id="festiveGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${festival.primaryColor}" stop-opacity="0.9"/>
          <stop offset="85%" stop-color="${festival.secondaryColor}" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${festival.primaryColor}"/>
          <stop offset="100%" stop-color="${festival.secondaryColor}"/>
        </linearGradient>
      </defs>
      <!-- Base circular shield -->
      <circle cx="32" cy="32" r="30" fill="#07090e" stroke="url(#ringGrad)" stroke-width="2.5"/>
      <circle cx="32" cy="32" r="28" fill="url(#festiveGlow)"/>
      
      <!-- Central V/Shield branding -->
      <path d="M20 22 L32 44 L44 22 L38 22 L32 35 L26 22 Z" fill="#ffffff" opacity="0.95"/>
      
      <!-- Festive Motif Badge at Top-Right -->
      <circle cx="48" cy="16" r="14" fill="#0b1120" stroke="url(#ringGrad)" stroke-width="1.5"/>
      <text x="48" y="21" font-size="14" text-anchor="middle" dominant-baseline="middle">${festival.iconSymbol}</text>
    </svg>
  `.trim();

  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  existingFavicon.href = dataUrl;
}
