const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.cqevzpvyqvckvenutuzz:yY1EKXWC8M4OjrPV@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function fixPolicies() {
  await client.connect();
  console.log('Connected to PostgreSQL.');

  await client.query(`
    DROP POLICY IF EXISTS "Public read office_locations" ON office_locations;
    CREATE POLICY "Public read office_locations" ON office_locations FOR SELECT TO anon, authenticated USING (true);
    
    DROP POLICY IF EXISTS "Public insert office_locations" ON office_locations;
    CREATE POLICY "Public insert office_locations" ON office_locations FOR INSERT TO anon, authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "Public update office_locations" ON office_locations;
    CREATE POLICY "Public update office_locations" ON office_locations FOR UPDATE TO anon, authenticated USING (true);

    DROP POLICY IF EXISTS "Public insert organizations" ON organizations;
    CREATE POLICY "Public insert organizations" ON organizations FOR INSERT TO anon, authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "Public update organizations" ON organizations;
    CREATE POLICY "Public update organizations" ON organizations FOR UPDATE TO anon, authenticated USING (true);
  `);

  console.log('✅ Added missing RLS policies for office_locations and organizations.');
  await client.end();
}

fixPolicies();
