// ==============================================================================
// VEDOTRIX PULSE - HARDWARE & DEVICE NOTIFICATION ENGINE v3.0
// Supports: Service Worker background push, Web Audio chimes, iOS fallback
// Notifications fire even when tab is closed if SW is registered + permission granted
// ==============================================================================

const SW_SCOPE = '/';
const STORAGE_KEY = 'vdx_device_notifications';
const APP_ICON = '/vedotrix-logo.png';

/** Returns true if Web Notification API is available in this browser */
export function isDeviceNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Returns current permission state, also checks localStorage cache for iOS */
export function getDeviceNotificationPermission(): NotificationPermission | 'unsupported' {
  // iOS Safari doesn't support Notification — check localStorage cache
  if (!isDeviceNotificationSupported()) {
    try {
      const cached = localStorage.getItem(STORAGE_KEY) as NotificationPermission | null;
      if (cached === 'granted') return 'granted';
    } catch {}
    return 'unsupported';
  }
  const real = Notification.permission;
  try { localStorage.setItem(STORAGE_KEY, real); } catch {}
  return real;
}

/** Ensures the Service Worker is registered for background notification delivery */
async function ensureServiceWorkerRegistered(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    // Check for existing registration first
    const existing = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    if (existing) return existing;
    // Register if not already done
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: SW_SCOPE });
    return reg;
  } catch (err) {
    console.warn('[VDX Notifications] SW registration note:', err);
    return null;
  }
}

/**
 * Request notification permission from the user.
 * - Also registers the Service Worker for background notification delivery.
 * - Handles iOS/Safari where Notification API is absent.
 */
export async function requestDeviceNotificationPermission(): Promise<boolean> {
  // Play chime immediately on tap to confirm audio works
  playNotificationChime();

  // Register SW in the background (non-blocking)
  ensureServiceWorkerRegistered().catch(() => {});

  if (!isDeviceNotificationSupported()) {
    // iOS Safari / in-app browser: no Notification API
    // Mark as granted so in-app toasts + audio chimes are used
    try { localStorage.setItem(STORAGE_KEY, 'granted'); } catch {}
    return true;
  }

  try {
    const permission = await Notification.requestPermission();
    try { localStorage.setItem(STORAGE_KEY, permission); } catch {}
    return permission === 'granted';
  } catch {
    // Some older browsers use callback form
    try { localStorage.setItem(STORAGE_KEY, 'granted'); } catch {}
    return true;
  }
}

/**
 * Synthesized soft notification chime using Web Audio API.
 * Works without any audio file — zero external assets.
 */
export function playNotificationChime(): void {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    // Slack-style ascending soft two-tone chime: D5 → A5
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now);        // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);

    setTimeout(() => { try { ctx.close(); } catch {} }, 1200);
  } catch {
    // Audio context restricted by autoplay policy before user gesture — silent fail
  }
}

export interface DeviceNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  channel?: string;
  data?: Record<string, any>;
}

/**
 * Sends a device/browser notification.
 * Delivery chain:
 *   1. Audio chime (always, regardless of permission)
 *   2. Service Worker showNotification (works even when tab is hidden/closed)
 *   3. Window Notification API (tab must be open)
 *
 * For iOS Safari: plays chime only (Notification API not available).
 */
export async function sendDeviceNotification(payload: DeviceNotificationPayload): Promise<void> {
  // 1. Always play chime sound
  playNotificationChime();

  // Check localStorage cache first (covers iOS and granted-before-reload state)
  const cachedPerm = (() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  })();

  const isGranted = isDeviceNotificationSupported()
    ? Notification.permission === 'granted'
    : cachedPerm === 'granted';

  if (!isGranted) return;
  if (!isDeviceNotificationSupported()) return; // iOS: chime done, no visual notification

  const options = {
    body: payload.body,
    icon: payload.icon || APP_ICON,
    badge: payload.badge || APP_ICON,
    tag: payload.tag || `vdx-${Date.now()}`,
    renotify: true,
    silent: false,
    vibrate: [200, 100, 200],
    data: {
      url: payload.url || window.location.href,
      channel: payload.channel,
      ...(payload.data || {}),
    },
  } as NotificationOptions;


  // 2. Service Worker delivery — works when tab is in background or not visible
  try {
    let reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    if (!reg) reg = await ensureServiceWorkerRegistered() ?? undefined;
    if (reg?.showNotification) {
      await reg.showNotification(payload.title, options);
      return; // Success via SW
    }
  } catch {
    // SW path failed — fall through to Window API
  }

  // 3. Fallback: Window Notification API (tab must be open/focused)
  try {
    const notif = new Notification(payload.title, options);
    notif.onclick = () => { window.focus(); notif.close(); };
    setTimeout(() => { try { notif.close(); } catch {} }, 7000);
  } catch (err) {
    console.warn('[VDX Notifications] Window notification note:', err);
  }
}

/**
 * Initialize notifications on app startup.
 * Registers SW silently, re-checks permissions, plays no sound.
 */
export async function initNotificationsOnStartup(): Promise<void> {
  // Always register SW for future background delivery
  ensureServiceWorkerRegistered().catch(() => {});

  // Sync real permission state to localStorage if supported
  if (isDeviceNotificationSupported()) {
    try { localStorage.setItem(STORAGE_KEY, Notification.permission); } catch {}
  }
}
