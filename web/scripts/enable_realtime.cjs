const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.cqevzpvyqvckvenutuzz:yY1EKXWC8M4OjrPV@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL.');

    const res = await client.query("SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime'");
    console.log('Current Realtime tables:', res.rows.map(r => r.tablename));

    const tables = ['chat_channels', 'chat_messages', 'meetings', 'notices'];
    for (const t of tables) {
      try {
        await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE ${t}`);
        console.log(`Added ${t} to supabase_realtime publication.`);
      } catch (e) {
        console.log(`Note for ${t}: ${e.message}`);
      }
    }

    const updated = await client.query("SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime'");
    console.log('Updated Realtime tables:', updated.rows.map(r => r.tablename));
  } catch (err) {
    console.error('Error enabling realtime:', err);
  } finally {
    await client.end();
  }
}

main();
