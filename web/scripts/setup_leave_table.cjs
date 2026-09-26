const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.cqevzpvyqvckvenutuzz:yY1EKXWC8M4OjrPV@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function setup() {
  await client.connect();
  console.log('Connected to PostgreSQL.');

  // 1. Add employee_id to offer_letters if not exists
  await client.query(`
    ALTER TABLE offer_letters 
    ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  `);
  console.log('✅ Added employee_id to offer_letters table.');

  // 2. Create leave_requests table
  await client.query(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
      employee_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
      leave_type varchar(50) NOT NULL DEFAULT 'casual',
      start_date date NOT NULL,
      end_date date NOT NULL,
      total_days numeric NOT NULL DEFAULT 1,
      is_half_day boolean DEFAULT false,
      half_day_session varchar(20),
      reason text NOT NULL,
      status varchar(20) DEFAULT 'pending',
      assigned_approver_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
      approver_decision_notes text,
      approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
      decided_at timestamptz,
      document_url text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
  `);
  console.log('✅ Created leave_requests table.');

  // 3. Enable RLS and setup permissive policies for anon & authenticated
  await client.query(`
    ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Public read leave_requests" ON leave_requests;
    CREATE POLICY "Public read leave_requests" ON leave_requests 
      FOR SELECT TO anon, authenticated USING (true);

    DROP POLICY IF EXISTS "Public insert leave_requests" ON leave_requests;
    CREATE POLICY "Public insert leave_requests" ON leave_requests 
      FOR INSERT TO anon, authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "Public update leave_requests" ON leave_requests;
    CREATE POLICY "Public update leave_requests" ON leave_requests 
      FOR UPDATE TO anon, authenticated USING (true);

    DROP POLICY IF EXISTS "Public delete leave_requests" ON leave_requests;
    CREATE POLICY "Public delete leave_requests" ON leave_requests 
      FOR DELETE TO anon, authenticated USING (true);
  `);
  console.log('✅ Configured RLS policies for leave_requests.');

  await client.end();
}

setup().catch(console.error);
