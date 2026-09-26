import pg from 'pg';

const connectionString = 'postgresql://postgres.cqevzpvyqvckvenutuzz:DB_PASSWORD_PLACEHOLDER@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function updateSchema() {
  await client.connect();
  console.log('🔄 Connected to Supabase DB. Updating schema for hierarchy & access requests...');

  // 1. Add manager_id, password_hash, and modules_access to profiles
  await client.query(`
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT 'Vedotrix@2026';
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS modules_access JSONB DEFAULT '["attendance", "tasks", "standups"]'::jsonb;
  `);

  // Ensure superadmin has full access and correct password
  await client.query(`
    UPDATE profiles 
    SET password_hash = 'Vedotrix@2026!Secure',
        modules_access = '["all", "superadmin", "attendance", "tasks", "standups", "offers", "payroll", "access_requests"]'::jsonb
    WHERE email = 'admin@vedotrix.com' OR role = 'superadmin';
  `);

  // 2. Create access_requests table
  await client.query(`
    CREATE TABLE IF NOT EXISTS access_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      requester_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
      request_type VARCHAR(50) NOT NULL DEFAULT 'module_access', -- 'module_access' | 'permission_escalation' | 'org_feature'
      target_module VARCHAR(100) NOT NULL, -- 'payroll', 'offers', 'tech_sprints', 'geo_override', 'admin_console'
      justification TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
      assigned_approver_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
      approver_decision_notes TEXT,
      approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // 3. Setup RLS policies for access_requests
  await client.query(`
    ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public read access_requests" ON access_requests;
    CREATE POLICY "Public read access_requests" ON access_requests FOR SELECT TO anon, authenticated USING (true);
    DROP POLICY IF EXISTS "Public insert access_requests" ON access_requests;
    CREATE POLICY "Public insert access_requests" ON access_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
    DROP POLICY IF EXISTS "Public update access_requests" ON access_requests;
    CREATE POLICY "Public update access_requests" ON access_requests FOR UPDATE TO anon, authenticated USING (true);
  `);

  console.log('✅ Hierarchy columns & access_requests table successfully created!');
  await client.end();
}

updateSchema().catch(console.error);
