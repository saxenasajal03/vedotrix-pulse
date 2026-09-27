const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.cqevzpvyqvckvenutuzz:yY1EKXWC8M4OjrPV@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  await client.connect();
  for (const t of ['chat_channels', 'chat_messages', 'meetings', 'notices']) {
    const c = await client.query(`SELECT count(*) FROM ${t}`);
    const rows = await client.query(`SELECT * FROM ${t} LIMIT 2`);
    console.log(`Table ${t}: ${c.rows[0].count} rows. Samples:`, rows.rows);
  }
  await client.end();
}

check().catch(console.error);
