const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.cqevzpvyqvckvenutuzz:yY1EKXWC8M4OjrPV@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  await client.connect();
  const payrollCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'payroll_records';");
  console.log('Payroll columns:', payrollCols.rows);
  const offerCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'offer_letters';");
  console.log('Offer columns:', offerCols.rows);
  await client.end();
}

check().catch(console.error);
