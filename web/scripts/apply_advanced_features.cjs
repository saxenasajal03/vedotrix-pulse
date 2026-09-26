const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.cqevzpvyqvckvenutuzz:DB_PASSWORD_PLACEHOLDER@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL database.');

  // 1. Add columns to offer_letters
  await client.query(`
    ALTER TABLE offer_letters 
    ADD COLUMN IF NOT EXISTS security_code VARCHAR(100),
    ADD COLUMN IF NOT EXISTS hr_department VARCHAR(100),
    ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
  `);
  console.log('✓ Updated offer_letters schema: security_code, hr_department, manager_id');

  // 2. Add columns to attendance
  await client.query(`
    ALTER TABLE attendance
    ADD COLUMN IF NOT EXISTS office_address TEXT,
    ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'approved',
    ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS approval_notes TEXT;
  `);
  console.log('✓ Updated attendance schema: office_address, approval_status, approved_by, approval_notes');

  // 3. Ensure profiles has manager_id
  await client.query(`
    ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
  `);
  console.log('✓ Updated profiles schema: manager_id');

  // 4. Clear all non-Vedotrix data as requested
  const delRes = await client.query(`
    DELETE FROM organizations 
    WHERE id != '00000000-0000-0000-0000-000000000001'
    RETURNING name, id;
  `);
  console.log('✓ Cleared non-Vedotrix organizations:', delRes.rows);

  // 5. Verify remaining organizations and profiles
  const orgs = await client.query('SELECT id, name, slug FROM organizations;');
  console.log('Remaining Organizations:', orgs.rows);

  const profs = await client.query('SELECT id, email, role, org_id FROM profiles;');
  console.log('Remaining Profiles in Vedotrix:', profs.rows);

  await client.end();
  console.log('Database schema update and cleanup complete!');
}

run().catch(console.error);
