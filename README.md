# Vedotrix Pulse - Multi-Tenant HRMS & Work Operations SaaS
### Designed & Managed by Vedotrix Technologies

> **An all-in-one, zero-cost, multi-tenant Employee Management Platform built specifically for Technology Houses & Digital Marketing Agencies.**

---

## 🌟 Key Architecture & Advanced Capabilities

1. **Multi-Tenant SaaS Foundation (Zero-Cost Supabase Tier)**
   - Isolated corporate tenants via PostgreSQL **Row Level Security (RLS)** mapped to `org_id`.
   - Role-Based Access Control (RBAC): SuperAdmin, Owner/MD, HR Manager, Team Lead/Manager, and Employee/Contractor.
   - Tenant switcher pre-configured with **Nexora Technologies** (Tech) and **Verve Growth Labs** (Digital Marketing).

2. **Advanced Offer Letter & Anti-Fraud Verification System**
   - **Tamper-Proof Serial Generation**: Unique serial numbers formatted as `VDX-[ORG_CODE]-[YEAR]-[HEX]` (e.g. `VDX-NEX-2026-A109F2`).
   - **Instant Verification Email Loop**: Triggered to HR and candidate with one-click verification tokens.
   - **Public Verification Portal (`/verify-offer/:serialNumber`)**: Publicly accessible or QR-code scannable badge showing verified candidate credentials, designation, and issue date without exposing private PII or salary figures.
   - **Digital Acceptance**: Candidates can review and digitally sign their offer letter directly.

3. **Geo-Fenced Smart Attendance & Regularization Workflow**
   - GPS coordinate capture using the **Haversine mathematical distance formula**.
   - Dynamic validation against office geofences (default: 100m–150m radius).
   - In-office vs. Remote/WFH automatic status flagging.
   - **Regularization Workflow**: Submit regularization requests with categories (Client On-Site Visit, WFH, Missed Punch) and 1-click HR/Manager approval queue.

4. **Tech & Digital Marketing Task & Standup Engine**
   - **Tech Mode**: Sprints, Git branch references (`feature/redis-cache`), PR links, bug severity tiers.
   - **Digital Marketing Mode**: Client campaign tracking (Meta/Google Ads, SEO, Content deliverables, budget & target ROAS).
   - **Daily EOD Standup Log**: Check-out prompt logging accomplishments, tomorrow's plan, and blockers.

5. **Payroll, Payslip Generator & Batch Payouts**
   - Automated monthly calculations based on attendance, half-days, and approved leaves.
   - Loss of Pay (LOP) formula: $\text{Base Salary} / \text{Working Days} \times \text{Absent Days}$.
   - Exportable bank batch payment file (**NEFT/RTGS CSV format**) for bulk corporate banking disbursals.
   - Downloadable/printable automated payslip PDFs with company seal and Vedotrix branding.

6. **Free Android Mobile Application (React Native / Expo)**
   - Standalone native Android app with GPS check-in/out, offline sync, active task view, and EOD standup logger.
   - Build standalone release `.apk` files 100% free using local Gradle or free EAS tiers without Google Play developer fees.

---

## 📁 Project Directory Structure

```
vedotrix-hrms/
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql  # Complete DDL, RLS, Haversine function, triggers
│   └── seed.sql                   # Demo organizations, profiles, verified offers, tasks
├── web/                           # Next.js / Vite React SaaS Web Portal
│   ├── src/
│   │   ├── components/            # UI components (Navbar, Sidebar, GeoCard, Modals)
│   │   ├── context/               # Reactive AppContext with multi-tenancy & LocalStorage
│   │   ├── lib/                   # GeoUtils, SerialUtils, MockData
│   │   ├── types/                 # TypeScript interfaces
│   │   ├── App.tsx                # Main application layout
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   └── tailwind.config.js
├── mobile/                        # React Native / Expo Android Application
│   ├── App.tsx                    # Native GPS punch card & tasks screen
│   ├── app.json                   # Android permissions & config
│   ├── package.json
│   └── BUILD_FREE_APK.md          # 100% free APK build manual
└── README.md
```

---

## 🚀 Quick Start Guide

### 1. Run the Web SaaS Portal Locally
```bash
cd web
npm.cmd install
npm.cmd run dev
```
Open **`http://localhost:3000`** in your browser.

### 2. Run the Free Android Mobile App
```bash
cd mobile
npm.cmd install
npx.cmd expo start
```
Scan the QR code with **Expo Go** on any Android phone for instant live testing.

To generate a standalone `.apk` directly on your PC:
```bash
npx.cmd expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

---

## 🔒 Free Database Setup (Supabase)

1. Create a free account at [Supabase](https://supabase.com).
2. Create a new free project.
3. Open the **SQL Editor** in Supabase and paste the contents of:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/seed.sql`
4. All tables, functions, RLS policies, and demo data will be configured instantly.

---

### Designed & Managed by Vedotrix Technologies
All UI footers, official offer letters, verification badges, and payslips carry the official certification:
**"Designed & Managed by Vedotrix Technologies"**
