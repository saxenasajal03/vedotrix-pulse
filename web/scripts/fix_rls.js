import pg from 'pg';

const connectionString = 'postgresql://postgres.cqevzpvyqvckvenutuzz:DB_PASSWORD_PLACEHOLDER@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function fixRls() {
  await client.connect();
  console.log('Connected to DB. Adding public read policy for organizations...');
  await client.query(`
    DROP POLICY IF EXISTS "Public read for organizations" ON organizations;
    CREATE POLICY "Public read for organizations" ON organizations FOR SELECT TO anon, authenticated USING (true);
  `);
  console.log('✅ Organization RLS policy applied!');
  await client.end();
}

fixRls();
