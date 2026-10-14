# 📱 Vedotrix Pulse Mobile - APK & Client Distribution Guide
### Production Ready • Connected to Live Supabase DB: `cqevzpvyqvckvenutuzz.supabase.co`
**Designed & Managed by Vedotrix Technologies**

---

## 🎯 Production Readiness Confirmation

All modules, screens, and workflows are connected to the live Supabase PostgreSQL database:

1. **Authentication & Security**:
   - Live constant-time bcrypt verification via `verify_user_password` PostgreSQL RPC.
   - All passwords in Supabase are salted bcrypt hashes (`$2a$10$...`).
   - Generic login screen with rate-limiting lockout protection (no credential leaks).
2. **Smart Attendance & Shift Reminders**:
   - High-precision GPS punch with radius geofence (200m).
   - In-Office vs Remote tagging with instant device notifications.
   - **Automatic Shift Attendance Alerts**: If an employee hasn't marked attendance when their shift starts (09:30 AM IST), a native notification and in-app reminder alert them to punch in or regularize.
   - Interactive **"🔔 Alert Test"** button in top bar to test notification channels anytime.
3. **Attendance Calendar & Mobile Regularization**:
   - Monthly attendance calendar with color-coded day badges (Present, Regularized, Absent, Week Off).
   - Monthly statistics counters (Present Days, Regularized, Absent, Attendance Rate %).
   - 1-tap **"Request Regularize"** on any unmarked or absent day with reason, shift timings, and manager routing.
4. **Systematic Meetings & Video Calls**:
   - Real-time Supabase synchronization with `meetings` table.
   - Filter by All, Today, Upcoming, and Past.
   - 1-tap **"🎥 Join Video Call"** (opens Google Meet / Zoom directly on Android).
   - 1-tap **"🔔 Remind Me (10m)"** (schedules a native Android notification alarm 10 minutes prior to meeting start).
   - **"+ Schedule"** modal for HR, Managers, and Superadmins to schedule new team meetings directly from mobile.
5. **Multi-Tenant SaaS Architecture**:
   - Organizations isolated with unique `org_code`, settings, and custom logos.
   - Root Super Controller console for Vedotrix global administration.
6. **Multi-Hierarchy Managers & Access Requests**:
   - Employees belong to designated reporting managers (`manager_id`).
   - Module access requests route strictly to their assigned manager.
   - Manager approval queues with instant status updates in DB.
7. **Task Board & Daily Standups**:
   - Kanban board customized for Tech Sprints (Git PRs, Sprint points) and Digital Marketing (ROAS, Ads).
   - EOD Standup submission with Supabase synchronization.

---

## 📦 Latest Generated APK Build (Production Ready)

* 📥 **Direct .apk Download Link**: [Download Vedotrix Pulse APK](https://expo.dev/artifacts/eas/PEn_Ae2n95-xYceRpmyprLDwgmmTRjx8pllRp60RLdE.apk)
* 🌐 **Expo Cloud Build Dashboard**: [Build bd0a18ef-dd8c-4440-9b85-8b9af9c4393d](https://expo.dev/accounts/sajalandroid/projects/vedotrix-pulse/builds/bd0a18ef-dd8c-4440-9b85-8b9af9c4393d)
* 💾 **Local File**: `mobile/vedotrix-pulse.apk`
* 📱 **Signed Package**: `com.vedotrix.pulse` (v1.0.0)

---

## 🚀 Two Ways to Share the App With Clients

### Method 1: Generate the Standalone Native Android `.apk` (Free Expo Cloud Build)
This generates a downloadable `.apk` file that clients can install directly on any Android phone without Google Play Store.

#### Quick 1-Click Launch:
Double-click **`build-cloud-apk.bat`** in `mobile/`  
*(Located at: `C:\Users\sajal\.gemini\antigravity\scratch\vedotrix-hrms\mobile\build-cloud-apk.bat`)*

#### Or via PowerShell Terminal:
```powershell
cd C:\Users\sajal\.gemini\antigravity\scratch\vedotrix-hrms\mobile
npx.cmd eas-cli login
npx.cmd eas-cli build -p android --profile preview
```

#### What Happens Next:
1. Log in with your free Expo account (if you don't have one, register free in 30 seconds at [expo.dev/signup](https://expo.dev/signup)).
2. EAS builds the `.apk` on remote cloud machines (takes ~3 to 5 minutes).
3. EAS gives you a **direct download URL** (e.g. `https://expo.dev/artifacts/eas/...apk`) and a **QR Code**.
4. Download the `.apk` file to your PC or phone.
5. **Share with clients** via WhatsApp, Google Drive, Telegram, or email.
6. Clients tap the `.apk` on their Android phone and click **Install**!

---

### Method 2: Instant Native Android WebAPK (Zero Waiting / No Download Needed)
Both the Web and Mobile codebases are pre-configured with PWA / WebAPK manifests and service workers:

1. Connect the Android phone to your Wi-Fi or deploy the web app to Vercel/Netlify.
2. Open `http://192.168.2.177:3000` (or your live deployed domain) in Google Chrome on the phone.
3. Chrome will automatically prompt **"Add Vedotrix Pulse to Home Screen"** (or tap `⋮` -> **"Install app"**).
4. Android creates a native **WebAPK** on the home screen with:
   - Official Vedotrix metallic logo.
   - Fullscreen native view (no browser URL bar).
   - GPS Geofenced Smart Punch.
   - Real-time live connection to your Supabase database!

---

## 🔑 Production Credentials for Clients & Superadmins

| Persona | Work Email | Password | Role |
| :--- | :--- | :--- | :--- |
| **Root Superadmin** | `admin@vedotrix.com` | `Vedotrix@2026!Secure` | Global Super Controller |
| **Executive Leadership** | `sajalsaxenagola@gmail.com` | `Vedotrix@2026!Secure` | Super Controller |
| **New Client Staff** | Created via Superadmin / Manager Console | Assigned during onboarding | Role-scoped |

---
*Designed & Managed by Vedotrix Technologies*
