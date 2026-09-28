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
export async function requestDeviceNotificationPermission(): Promise<boolean> {
  if (!isDeviceNotificationSupported()) {
    console.warn('Device notifications are not supported on this browser/platform.');
    return false;
  }

  // iOS Safari 15.4+ requires permission to be requested in response to a user gesture
  try {
    let permission: NotificationPermission;
    // Some older browsers use callback-only API
    if (typeof Notification.requestPermission === 'function') {
      permission = await Notification.requestPermission();
    } else {
      permission = 'denied';
    }
    try { localStorage.setItem('vdx_device_notifications', permission); } catch {}
    return permission === 'granted';
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return false;
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

    // Smooth dual-tone frequency
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const now = ctx.currentTime;

    // Arpeggiated soft notification tone (Slack / Pulse style)
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);

    // Auto-close AudioContext to free resources
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
 * 1. Tries Service Worker (background delivery — works even when tab is hidden)
 * 2. Falls back to Window Notification API
 * 3. Falls back to in-page audio chime only
 */
export async function sendDeviceNotification(payload: DeviceNotificationPayload): Promise<void> {
  if (!isDeviceNotificationSupported()) return;

  // Always play the chime if tab has focus or at least as audio fallback
  playNotificationChime();

  if (Notification.permission !== 'granted') return;

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
      // Use getRegistration instead of .ready to avoid hanging if SW not registered
      const registration = await navigator.serviceWorker.getRegistration('/');
      if (registration && registration.showNotification) {
        await registration.showNotification(payload.title, notifOptions);
        return;
      }
    } catch (swErr) {
      // SW dispatch failed — fall through to Window API
    }
  }

  // Fallback: Window Notification API (only visible when tab is open)
  try {
    const notif = new Notification(payload.title, notifOptions);
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
    // Auto close after 6 seconds
    setTimeout(() => { try { notif.close(); } catch {} }, 6000);
  } catch (err) {
    // Some browsers (Firefox private mode, iOS < 16.4) block Notification constructor silently
    console.warn('Notification API unavailable:', err);
  }
}

