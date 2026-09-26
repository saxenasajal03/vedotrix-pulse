# Vedotrix Pulse - Multi-Tenant HRMS & Work Operations SaaS Platform
### Designed & Managed by Vedotrix Technologies

> **An enterprise-grade, zero-cost, strictly multi-tenant Employee Management Platform built specifically for Technology Houses & Digital Marketing Agencies.**

[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)](https://github.com/saxenasajal03/vedotrix-pulse)
[![Netlify Status](https://img.shields.io/badge/Netlify-Production%20Ready-00C7B7?logo=netlify)](https://app.netlify.com)
[![Supabase Database](https://img.shields.io/badge/Supabase-PostgreSQL%20Live-3ECF8E?logo=supabase)](https://supabase.com)

---

## 🌟 Key Architecture & Production Features

### 1. Strict Multi-Tenant Corporate Isolation
- **Complete Segregation**: Non-Vedotrix organizations can **never** see any other organization, employees, payroll, offers, tasks, or access requests.
- **Tenant Scope Enforcement**: The organization switcher and Super Controller Hub are visible **strictly** to Vedotrix Master Superadmins (`admin@vedotrix.com` / `sajalsaxenagola@gmail.com`).
- Each tenant operates as an independent private workspace with their own custom corporate logo, departments, and branding.

### 2. Manual Offer Letter Serial Numbers & S3 Document Upload
- **Manual Serial Control**: No automatic serial numbers; HR manually enters the exact corporate serial number.
- **Direct Document Upload**: HR can attach the signed or official PDF/Word/Image offer letter document stored directly in Supabase Storage (`documents` bucket).
- **Public Tamper-Proof Verification Portal (`/verify-offer/:serialNumber`)**: Allows candidates and third-party background verifiers to inspect valid credentials, dates, designations, and download the official attached document.

### 3. Hierarchical Access Requests & Department Approvals
- Built-in multi-level hierarchy: Employees request access or permissions -> Routed directly to their designated reporting manager -> Escalated to HR / Superadmin.
- Separate approval sections for both Organization Modules and User Permission Requests.

### 4. Enterprise-Grade Salted Bcrypt Password Encryption
- Zero plaintext passwords in the database.
- Authenticated via PostgreSQL RPC functions (`verify_user_password`) using industry-standard salted bcrypt hashes.

### 5. Smart Geofenced Attendance & Regularization Workflow
- Real-time GPS coordinate capture via the Haversine mathematical distance formula.
- Dynamic validation against office geofences (100m–150m radius).
- Automated Regularization Approval Queue for remote work, client site visits, and missed punches.

### 6. Automated Payroll & Bank Batch Payouts
- Monthly salary auto-computation accounting for attendance, leaves, and Loss of Pay (LOP).
- 1-Click NEFT/RTGS batch CSV generation for corporate bank disbursals.
- Downloadable and printable payslip PDFs with corporate stamps and Vedotrix certification.

---

## 🏢 Onboarded Organizations

| Organization | Domain / Industry | Default HR / Superadmin | Email |
| :--- | :--- | :--- | :--- |
| **Vedotrix Technologies** (Master) | Technology & Software | Root Superadmin | `sajalsaxenagola@gmail.com` / `admin@vedotrix.com` |
| **BNK Digital** | Digital Marketing | Kshitiz Narayan (HR Dept) | `kshitiznarayan543@gmail.com` |
| **Nexora Technologies** | Enterprise IT | HR Department | `hr@nexora.com` |
| **Verve Growth Labs** | Growth Marketing | HR Department | `hr@verve.com` |

---

## 📁 Repository Structure

```
vedotrix-pulse/
├── netlify.toml                   # Root Netlify SPA deployment configuration
├── web/                           # Vite + React 18 + Tailwind CSS SaaS Web Portal
│   ├── public/
│   │   ├── _redirects             # Netlify SPA fallback routing rule
│   │   ├── logos/                 # Corporate logos (BNK Digital, Vedotrix)
│   │   └── manifest.json          # PWA support
│   ├── src/
│   │   ├── components/            # UI Views (Login, Navbar, Sidebar, Offers, Requests)
│   │   ├── context/               # Reactive AppContext with multi-tenant filtering
│   │   ├── lib/                   # Supabase client, storage, geofencing, mailer
│   │   └── types/                 # Strict TypeScript schemas
│   ├── netlify.toml               # Web-scoped deployment settings
│   └── package.json
├── mobile/                        # React Native / Expo Android application
├── supabase/
│   ├── migrations/                # PostgreSQL schema & RLS policies
│   └── seed.sql                   # Initial data & functions
└── README.md
```

---

## 🚀 Deployment Instructions

### Option A: 1-Click Netlify Continuous Deployment (Recommended)
1. Go to [Netlify App](https://app.netlify.com).
2. Click **Add new site** > **Import an existing project**.
3. Select **GitHub** and authorize repository **`saxenasajal03/vedotrix-pulse`**.
4. Netlify will automatically detect `netlify.toml` with:
   - **Base directory**: `web`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Click **Deploy Site** — your live production site will be active within 60 seconds with automatic deploys on every `git push`!

### Option B: Local Development
```bash
# Clone the repository
git clone https://github.com/saxenasajal03/vedotrix-pulse.git
cd vedotrix-pulse/web

# Install dependencies
npm install

# Start Vite live development server
npm run dev
```
Open **`http://localhost:3000`** in your browser.

---

### Designed & Managed by Vedotrix Technologies
All UI footers, official offer letters, verification badges, and payslips carry the official certification:
**"Designed & Managed by Vedotrix Technologies"**
