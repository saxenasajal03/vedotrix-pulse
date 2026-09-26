const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.cqevzpvyqvckvenutuzz:yY1EKXWC8M4OjrPV@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  await client.connect();
  const profCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles';");
  console.log('Profiles columns:', profCols.rows);
  const orgCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'organizations';");
  console.log('Organizations columns:', orgCols.rows);
  const orgs = await client.query("SELECT id, name, org_code, industry FROM organizations;");
  console.log('Current organizations in DB:', orgs.rows);
  const profiles = await client.query("SELECT id, email, first_name, last_name, role, org_id FROM profiles;");
  console.log('Current profiles in DB:', profiles.rows);
  await client.end();
}

check().catch(console.error);
