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
2. **Multi-Tenant SaaS Architecture**:
   - Organizations isolated with unique `org_code`, settings, and custom logos.
   - Root Super Controller console for Vedotrix global administration.
3. **Offer Letter Engine**:
   - Cryptographic serial generation (`VDX-TECH-2026-XXXX`).
   - Public HR verification portal and automated email notifications.
4. **Attendance & Geo-Fencing**:
   - High-precision GPS punch with radius geofence (200m).
   - In-Office vs Remote tagging with regularization approval queues.
5. **Multi-Hierarchy Managers & Access Requests**:
   - Employees belong to designated reporting managers (`manager_id`).
   - Module access requests route strictly to their assigned manager.
   - Manager approval queues with instant status updates in DB.
6. **Task Board & Daily Standups**:
   - Kanban board customized for Tech Sprints (Git PRs, Sprint points) and Digital Marketing (ROAS, Ads).
   - EOD Standup submission with Supabase synchronization.

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
