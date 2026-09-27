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
 * Returns the current notification permission state
 */
export function getDeviceNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isDeviceNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Request notification permission from the user
 */
export async function requestDeviceNotificationPermission(): Promise<boolean> {
  if (!isDeviceNotificationSupported()) {
    console.warn('Device notifications are not supported on this browser/platform.');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    localStorage.setItem('vdx_device_notifications', permission);
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
 * Dispatches via Service Worker if available (even when tab is hidden/backgrounded),
 * with a fallback to standard Notification API.
 */
export async function sendDeviceNotification(payload: DeviceNotificationPayload): Promise<void> {
  if (!isDeviceNotificationSupported() || Notification.permission !== 'granted') {
    return;
  }

  // Play subtle audio alert
  playNotificationChime();

  const options: NotificationOptions & { vibrate?: number[] } = {
    body: payload.body,
    icon: payload.icon || '/vedotrix-logo.png',
    badge: payload.badge || '/vedotrix-logo.png',
    tag: payload.tag || `vdx-chat-${Date.now()}`,
    vibrate: [200, 100, 200],
    data: {
      url: payload.url || window.location.href,
      channel: payload.channel,
      ...payload.data
    }
  };

  // Try dispatching via Service Worker first for true background delivery
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && registration.showNotification) {
        await registration.showNotification(payload.title, options);
        return;
      }
    } catch (swErr) {
      console.warn('Service Worker notification dispatch note:', swErr);
    }
  }

  // Fallback to Window Notification API
  try {
    const notif = new Notification(payload.title, options);
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
  } catch (err) {
    console.error('Window Notification error:', err);
  }
}
