-- ==============================================================================
-- VEDOTRIX PULSE - MULTI-TENANT ENTERPRISE HRMS & WORKSUITE
-- Designed & Managed by Vedotrix Technologies
-- Database: Supabase PostgreSQL (Compatible with Free Tier)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ORGANIZATIONS (MULTI-TENANT ROOTS)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    org_code VARCHAR(10) UNIQUE NOT NULL, -- Short code e.g., 'NEX', 'VGL'
    logo_url TEXT,
    industry VARCHAR(50) DEFAULT 'Tech', -- 'Tech' | 'Digital Marketing' | 'Hybrid'
    website VARCHAR(255),
    address TEXT,
    phone VARCHAR(50),
    settings JSONB DEFAULT '{
        "work_hours_per_day": 8,
        "grace_period_mins": 15,
        "wfh_allowed": true,
        "half_day_threshold_hours": 4.5
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PROFILES / USERS
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) DEFAULT 'employee', -- 'superadmin' | 'owner' | 'hr' | 'manager' | 'employee'
    designation VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    joining_date DATE DEFAULT CURRENT_DATE,
    base_salary DECIMAL(12, 2) DEFAULT 0.00,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. GEO-FENCE OFFICE LOCATIONS
CREATE TABLE IF NOT EXISTS office_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g., 'HQ - Cyber Tower' or 'Client Site A'
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    radius_meters INT DEFAULT 100, -- Maximum allowable punch distance in meters
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. OFFER LETTERS (WITH SERIAL NUMBER & VERIFICATION MECHANISM)
CREATE TABLE IF NOT EXISTS offer_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    serial_number VARCHAR(100) UNIQUE NOT NULL, -- e.g. VDX-NEX-2026-A109F2
    candidate_name VARCHAR(255) NOT NULL,
    candidate_email VARCHAR(255) NOT NULL,
    candidate_phone VARCHAR(20),
    designation VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    joining_date DATE NOT NULL,
    annual_ctc DECIMAL(12, 2) NOT NULL,
    basic_monthly DECIMAL(10, 2) NOT NULL,
    hra_monthly DECIMAL(10, 2) NOT NULL,
    special_allowance DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'issued', -- 'draft' | 'issued' | 'accepted' | 'declined' | 'revoked'
    verification_token VARCHAR(255) UNIQUE NOT NULL,
    pdf_url TEXT,
    issued_by UUID REFERENCES profiles(id),
    hr_verified_at TIMESTAMPTZ,
    candidate_accepted_at TIMESTAMPTZ,
    terms_accepted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ATTENDANCE & GEO-LOCATION RECORDS
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    check_in_lat DECIMAL(10, 8),
    check_in_long DECIMAL(11, 8),
    check_out_lat DECIMAL(10, 8),
    check_out_long DECIMAL(11, 8),
    location_id UUID REFERENCES office_locations(id),
    distance_meters DECIMAL(8, 2),
    status VARCHAR(50) DEFAULT 'present', -- 'present' | 'half_day' | 'absent' | 'on_leave' | 'regularized'
    is_remote BOOLEAN DEFAULT FALSE,
    regularization_reason TEXT,
    regularization_status VARCHAR(50) DEFAULT 'none', -- 'none' | 'pending' | 'approved' | 'rejected'
    regularized_by UUID REFERENCES profiles(id),
    regularization_notes TEXT,
    total_hours DECIMAL(4, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, date)
);

-- 7. TASKS & WORK MANAGEMENT (TECH & DIGITAL MARKETING)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES profiles(id),
    created_by UUID REFERENCES profiles(id),
    category VARCHAR(50) DEFAULT 'tech', -- 'tech' | 'marketing'
    status VARCHAR(50) DEFAULT 'todo', -- 'todo' | 'in_progress' | 'review' | 'done'
    priority VARCHAR(50) DEFAULT 'medium', -- 'low' | 'medium' | 'high' | 'critical'
    due_date TIMESTAMPTZ,
    
    -- Tech Organization Attributes
    git_branch VARCHAR(255),
    pr_link TEXT,
    sprint_name VARCHAR(100),
    
    -- Digital Marketing Attributes
    campaign_name VARCHAR(255),
    client_name VARCHAR(255),
    ad_spend_target DECIMAL(10, 2),
    target_kpi VARCHAR(255), -- e.g. "5.0 ROAS" or "10k Organic Traffic"
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. DAILY STANDUPS / EOD LOGS (CONNECTED TO PUNCH-OUT)
CREATE TABLE IF NOT EXISTS daily_standups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    completed_today TEXT NOT NULL,
    planned_tomorrow TEXT NOT NULL,
    blockers TEXT,
    hours_logged DECIMAL(4, 2) DEFAULT 8.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, date)
);

-- 9. PAYROLL & PAYSLIPS
CREATE TABLE IF NOT EXISTS payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    month INT NOT NULL, -- 1 - 12
    year INT NOT NULL,  -- e.g. 2026
    working_days INT NOT NULL DEFAULT 30,
    present_days DECIMAL(4, 1) NOT NULL DEFAULT 30,
    loss_of_pay_days DECIMAL(4, 1) DEFAULT 0,
    basic_pay DECIMAL(10, 2) NOT NULL,
    hra DECIMAL(10, 2) NOT NULL,
    allowances DECIMAL(10, 2) DEFAULT 0,
    deductions DECIMAL(10, 2) DEFAULT 0,
    lop_deduction DECIMAL(10, 2) DEFAULT 0,
    net_salary DECIMAL(10, 2) NOT NULL,
    payout_status VARCHAR(50) DEFAULT 'pending', -- 'pending' | 'processing' | 'paid'
    payout_date TIMESTAMPTZ,
    payment_mode VARCHAR(50) DEFAULT 'NEFT', -- 'NEFT' | 'RTGS' | 'UPI' | 'IMPS'
    payment_reference VARCHAR(100),
    payslip_pdf_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, month, year)
);

-- ==============================================================================
-- STORED FUNCTIONS & PROCEDURES
-- ==============================================================================

-- 10. HAVERSINE DISTANCE CALCULATOR (Calculates distance in meters between 2 coordinates)
CREATE OR REPLACE FUNCTION calculate_haversine_distance(
    lat1 NUMERIC, lon1 NUMERIC, 
    lat2 NUMERIC, lon2 NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
    r NUMERIC := 6371000; -- Earth radius in meters
    dlat NUMERIC;
    dlon NUMERIC;
    a NUMERIC;
    c NUMERIC;
BEGIN
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);
    a := sin(dlat/2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)^2;
    c := 2 * atan2(sqrt(a), sqrt(1 - a));
    RETURN ROUND(r * c, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 11. OFFER LETTER SERIAL GENERATOR
-- Format: VDX-[ORG_CODE]-[YEAR]-[6_CHAR_HEX]
CREATE OR REPLACE FUNCTION generate_offer_serial(p_org_code TEXT)
RETURNS TEXT AS $$
DECLARE
    v_year TEXT := TO_CHAR(CURRENT_DATE, 'YYYY');
    v_hex TEXT := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 6));
BEGIN
    RETURN 'VDX-' || UPPER(p_org_code) || '-' || v_year || '-' || v_hex;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_standups ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;

-- Allow public read access to verify offer letters by serial number (anti-fraud verification portal)
CREATE POLICY "Public offer verification by serial"
ON offer_letters FOR SELECT
TO anon, authenticated
USING (status IN ('issued', 'accepted'));

-- Base access policy for internal users
CREATE POLICY "Tenant isolation for profiles"
ON profiles FOR ALL
TO authenticated
USING (org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation for attendance"
ON attendance FOR ALL
TO authenticated
USING (org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation for tasks"
ON tasks FOR ALL
TO authenticated
USING (org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation for daily_standups"
ON daily_standups FOR ALL
TO authenticated
USING (org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation for payroll"
ON payroll_records FOR ALL
TO authenticated
USING (org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()));
