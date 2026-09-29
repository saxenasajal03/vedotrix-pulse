// ==============================================================================
// VEDOTRIX PULSE - HARDWARE & DEVICE NOTIFICATION ENGINE
// Designed & Managed by Vedotrix Technologies
// Supports PWA Web Push, Service Worker Background, and Audio Chimes
// ==============================================================================

/**
 * Checks if the browser/device supports Web Notifications
 */
export function isDeviceNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Returns the current notification permission state, syncing with localStorage cache.
 */
export function getDeviceNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isDeviceNotificationSupported()) return 'unsupported';
  // Sync real permission state to localStorage for cross-tab visibility
  const real = Notification.permission;
  try {
    localStorage.setItem('vdx_device_notifications', real);
  } catch {}
  return real;
}

/**
 * Request notification permission from the user.
 * Handles both promise-based and callback-based APIs for older browsers.
 */
/**
 * Request notification permission from the user.
 * Handles both promise-based and callback-based APIs for all mobile and desktop browsers.
 */
export async function requestDeviceNotificationPermission(): Promise<boolean> {
  // Always trigger sound chime so user knows audio alert is active
  playNotificationChime();

  if (!isDeviceNotificationSupported()) {
    // For browsers without window.Notification (e.g. mobile Safari / Chrome on iOS)
    // Mark as in-app notification active so audio chime & toast banner run!
    try { localStorage.setItem('vdx_device_notifications', 'granted'); } catch {}
    return true;
  }

  try {
    let permission: NotificationPermission = 'default';
    if (typeof Notification.requestPermission === 'function') {
      permission = await Notification.requestPermission();
    }
    try { localStorage.setItem('vdx_device_notifications', permission); } catch {}
    return permission === 'granted';
  } catch (err) {
    console.warn('Notification permission request note:', err);
    // Fall back to granted in-app
    return true;
  }
}

/**
 * Modern synthesized audio chime using Web Audio API (zero external assets needed)
 */
export function playNotificationChime(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const now = ctx.currentTime;

    // Arpeggiated soft notification tone (Slack / Pulse style)
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);

    setTimeout(() => {
      try { ctx.close(); } catch {}
    }, 1000);
  } catch (e) {
    // Audio context may be restricted by autoplay policy before user gesture
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
  data?: any;
}

/**
 * Sends a system-level device notification.
 * 1. Plays sound chime
 * 2. Tries Service Worker (background delivery — works even when tab is hidden)
 * 3. Falls back to Window Notification API
 */
export async function sendDeviceNotification(payload: DeviceNotificationPayload): Promise<void> {
  // Always play notification chime
  playNotificationChime();

  if (!isDeviceNotificationSupported()) return;

  const perm = Notification.permission;
  if (perm !== 'granted') return;

  const notifOptions: NotificationOptions & { vibrate?: number[] } = {
    body: payload.body,
    icon: payload.icon || '/vedotrix-logo.png',
    badge: payload.badge || '/vedotrix-logo.png',
    tag: payload.tag || `vdx-chat-${Date.now()}`,
    vibrate: [150, 80, 150],
    silent: false,
    data: {
      url: payload.url || window.location.href,
      channel: payload.channel,
      ...payload.data
    }
  };

  // Try Service Worker first (delivers even when tab is hidden/backgrounded)
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      if (registration && registration.showNotification) {
        await registration.showNotification(payload.title, notifOptions);
        return;
      }
    } catch (swErr) {
      // SW dispatch failed — fall through to Window API
    }
  }

  // Fallback: Window Notification API
  try {
    const notif = new Notification(payload.title, notifOptions);
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
    setTimeout(() => { try { notif.close(); } catch {} }, 6000);
  } catch (err) {
    console.warn('Window notification note:', err);
  }
}


