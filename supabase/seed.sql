-- ==============================================================================
-- VEDOTRIX PULSE - DEMO SEED DATA
-- Organizations: 
-- 1. Nexora Technologies (Tech Software House)
-- 2. Verve Growth Labs (Performance & Digital Marketing Agency)
-- Designed & Managed by Vedotrix Technologies
-- ==============================================================================

-- 1. SEED ORGANIZATIONS
INSERT INTO organizations (id, name, slug, org_code, industry, website, address, phone)
VALUES 
('a0000000-0000-0000-0000-000000000001', 'Nexora Technologies', 'nexora', 'NEX', 'Tech', 'https://nexora.tech', 'Plot 42, Hitech City, Hyderabad, India', '+91 98765 43210'),
('b0000000-0000-0000-0000-000000000002', 'Verve Growth Labs', 'verve', 'VGL', 'Digital Marketing', 'https://vervegrowth.io', '8th Floor, Indiranagar, Bangalore, India', '+91 91234 56789')
ON CONFLICT (id) DO NOTHING;

-- 2. SEED OFFICE GEO-FENCE LOCATIONS
INSERT INTO office_locations (id, org_id, name, latitude, longitude, radius_meters, address)
VALUES
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Nexora Innovation Hub (HQ)', 17.4435, 78.3772, 150, 'Cyber Towers, Hitech City, Hyderabad'),
('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'Verve Creative Studio', 12.9716, 77.6412, 100, '100ft Road, Indiranagar, Bangalore')
ON CONFLICT (id) DO NOTHING;

-- 3. SEED USER PROFILES
INSERT INTO profiles (id, org_id, email, first_name, last_name, role, designation, department, joining_date, base_salary)
VALUES
-- Nexora Team
('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'admin@nexora.tech', 'Vikram', 'Malhotra', 'owner', 'Chief Technology Officer', 'Leadership', '2024-01-15', 250000),
('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'hr@nexora.tech', 'Ananya', 'Sharma', 'hr', 'Head of People & Culture', 'Human Resources', '2024-03-01', 120000),
('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'dev@nexora.tech', 'Rohan', 'Verma', 'employee', 'Senior Full Stack Engineer', 'Engineering', '2024-06-10', 95000),

-- Verve Growth Labs Team
('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'director@vervegrowth.io', 'Priya', 'Nair', 'owner', 'Managing Director', 'Leadership', '2023-11-01', 220000),
('d0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'hr@vervegrowth.io', 'Sneha', 'Kapoor', 'hr', 'Talent Acquisition Lead', 'Human Resources', '2024-02-15', 105000),
('d0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000002', 'marketer@vervegrowth.io', 'Arjun', 'Mehta', 'employee', 'Performance Marketing Specialist', 'Growth Marketing', '2024-05-20', 80000)
ON CONFLICT (id) DO NOTHING;

-- 4. SEED SAMPLE OFFER LETTERS WITH TAMPER-PROOF SERIAL NUMBERS
INSERT INTO offer_letters (
    id, org_id, serial_number, candidate_name, candidate_email, candidate_phone, 
    designation, department, joining_date, annual_ctc, basic_monthly, hra_monthly, special_allowance, 
    status, verification_token, terms_accepted
) VALUES
(
    'e0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'VDX-NEX-2026-A109F2',
    'Sameer Joshi',
    'sameer.joshi@example.com',
    '+91 99887 76655',
    'Lead DevOps Engineer',
    'Cloud Infrastructure',
    '2026-10-15',
    1800000.00,
    60000.00,
    30000.00,
    60000.00,
    'issued',
    'token_nex_sameer_verified_9941a',
    false
),
(
    'e0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000002',
    'VDX-VGL-2026-B882C4',
    'Tanvi Deshmukh',
    'tanvi.d@example.com',
    '+91 98112 23344',
    'Senior Paid Ads Strategist',
    'Performance Marketing',
    '2026-10-01',
    1200000.00,
    40000.00,
    20000.00,
    40000.00,
    'accepted',
    'token_vgl_tanvi_verified_8820c',
    true
)
ON CONFLICT (id) DO NOTHING;

-- 5. SEED TECH & MARKETING TASKS
INSERT INTO tasks (
    id, org_id, title, description, assigned_to, category, status, priority, due_date,
    git_branch, pr_link, sprint_name, campaign_name, client_name, ad_spend_target, target_kpi
) VALUES
-- Tech Task
(
    'f0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Implement Redis caching layer for GraphQL API',
    'Cache product catalog queries to reduce DB load under peak traffic',
    'd0000000-0000-0000-0000-000000000003',
    'tech',
    'in_progress',
    'high',
    NOW() + INTERVAL '2 days',
    'feature/graphql-redis-cache',
    'https://github.com/nexora/core-api/pull/248',
    'Sprint 24 - Scaling',
    NULL, NULL, NULL, NULL
),
-- Marketing Task
(
    'f0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000002',
    'Scale Meta Advantage+ Shopping Campaigns for Q4',
    'Optimize ROAS target to 4.2x with refreshed video UGC creative sets',
    'd0000000-0000-0000-0000-000000000006',
    'marketing',
    'in_progress',
    'critical',
    NOW() + INTERVAL '1 day',
    NULL, NULL, NULL,
    'Festive E-Commerce Scaling 2026',
    'Zenith Apparel Brands',
    500000.00,
    '4.2x ROAS'
)
ON CONFLICT (id) DO NOTHING;

-- 6. SEED ATTENDANCE RECORDS (With Regularization Request)
INSERT INTO attendance (
    id, org_id, employee_id, date, check_in_time, check_out_time, 
    check_in_lat, check_in_long, distance_meters, status, is_remote, 
    regularization_reason, regularization_status, total_hours
) VALUES
(
    '10000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000003',
    CURRENT_DATE,
    NOW() - INTERVAL '6 hours',
    NULL,
    17.4436, 78.3773, 24.50,
    'present',
    false,
    NULL, 'none', 6.0
),
(
    '10000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000006',
    CURRENT_DATE - INTERVAL '1 day',
    (CURRENT_DATE - INTERVAL '1 day' + TIME '10:15:00')::timestamptz,
    (CURRENT_DATE - INTERVAL '1 day' + TIME '19:00:00')::timestamptz,
    12.9800, 77.6500, 850.00,
    'regularized',
    true,
    'On-site client meeting at Zenith Apparel HQ for creative video shoot',
    'approved',
    8.75
)
ON CONFLICT (id) DO NOTHING;

-- 7. SEED DAILY STANDUP / EOD
INSERT INTO daily_standups (
    id, org_id, employee_id, date, completed_today, planned_tomorrow, blockers, hours_logged
) VALUES
(
    '20000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000003',
    CURRENT_DATE - INTERVAL '1 day',
    'Completed benchmark testing for Redis caching cluster on staging environment.',
    'Create automated unit tests and open PR for team review.',
    'Need staging VPC peering credentials from DevOps lead.',
    8.0
)
ON CONFLICT (id) DO NOTHING;

-- 8. SEED PAYROLL RECORD
INSERT INTO payroll_records (
    id, org_id, employee_id, month, year, working_days, present_days, loss_of_pay_days,
    basic_pay, hra, allowances, deductions, lop_deduction, net_salary, payout_status,
    payment_mode, payment_reference
) VALUES
(
    '30000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000003',
    8, 2026, 31, 31, 0,
    47500.00, 23750.00, 23750.00, 2000.00, 0.00, 93000.00,
    'paid', 'NEFT', 'NEFT-NEX-20260831-99882'
)
ON CONFLICT (id) DO NOTHING;
