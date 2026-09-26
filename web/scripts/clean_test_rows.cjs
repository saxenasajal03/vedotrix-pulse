const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.cqevzpvyqvckvenutuzz:yY1EKXWC8M4OjrPV@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function cleanTestRows() {
  await client.connect();
  console.log('Connected to PostgreSQL.');

  await client.query(`
    DELETE FROM attendance WHERE org_id != '00000000-0000-0000-0000-000000000001';
    DELETE FROM daily_standups WHERE org_id != '00000000-0000-0000-0000-000000000001';
    DELETE FROM tasks WHERE org_id != '00000000-0000-0000-0000-000000000001';
    DELETE FROM access_requests WHERE org_id != '00000000-0000-0000-0000-000000000001';
    DELETE FROM payroll_records WHERE org_id != '00000000-0000-0000-0000-000000000001';
    DELETE FROM offer_letters WHERE org_id != '00000000-0000-0000-0000-000000000001';
    DELETE FROM office_locations WHERE org_id != '00000000-0000-0000-0000-000000000001';
    DELETE FROM profiles WHERE email NOT IN ('admin@vedotrix.com', 'sajalsaxenagola@gmail.com');
    DELETE FROM organizations WHERE id != '00000000-0000-0000-0000-000000000001';
  `);

  console.log('✅ Cleaned up temporary test rows.');
  await client.end();
}

cleanTestRows();
