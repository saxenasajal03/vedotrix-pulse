const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.cqevzpvyqvckvenutuzz:yY1EKXWC8M4OjrPV@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function testTrigger() {
  await client.connect();
  console.log('Testing password trigger and verify_user_password RPC...');

  // Test RPC with existing Vedotrix accounts
  const rpcRes = await client.query("SELECT * FROM verify_user_password('sajalsaxenagola@gmail.com', 'Vedotrix@2026!Secure');");
  console.log('RPC verify Sajal Saxena:', rpcRes.rows);

  const rpcResAdmin = await client.query("SELECT * FROM verify_user_password('admin@vedotrix.com', 'Vedotrix@2026!Secure');");
  console.log('RPC verify Admin Vedotrix:', rpcResAdmin.rows);

  await client.end();
}

testTrigger().catch(console.error);
