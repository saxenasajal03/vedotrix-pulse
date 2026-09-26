const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.cqevzpvyqvckvenutuzz:yY1EKXWC8M4OjrPV@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected to PostgreSQL database...');

  const updateRes = await client.query(`
    UPDATE auth.users
    SET 
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      raw_user_meta_data = raw_user_meta_data || '{"email_verified": true}'::jsonb
    WHERE email_confirmed_at IS NULL;
  `);

  console.log(`Updated unconfirmed auth users count: ${updateRes.rowCount}`);

  const users = await client.query("SELECT id, email, confirmed_at, email_confirmed_at FROM auth.users;");
  console.log('Current Auth users status:', users.rows);

  await client.end();
}

run().catch(console.error);
