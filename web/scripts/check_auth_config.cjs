const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.cqevzpvyqvckvenutuzz:yY1EKXWC8M4OjrPV@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'auth';");
  console.log('Auth tables:', res.rows.map(r => r.table_name));

  const users = await client.query("SELECT id, email, created_at, confirmation_sent_at, confirmed_at FROM auth.users;");
  console.log('Auth users in Supabase:', users.rows);

  await client.end();
}
run().catch(console.error);
