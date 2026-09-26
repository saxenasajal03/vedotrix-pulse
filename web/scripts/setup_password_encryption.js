import pg from 'pg';

const connectionString = 'postgresql://postgres.cqevzpvyqvckvenutuzz:DB_PASSWORD_PLACEHOLDER@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkPgcrypto() {
  await client.connect();
  console.log('🔄 Checking pgcrypto extension on live Supabase PostgreSQL...');
  await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
  
  const testHash = await client.query("SELECT crypt('Vedotrix@2026!Secure', gen_salt('bf', 10)) as hash;");
  console.log('✅ pgcrypto is fully available! Generated bcrypt hash:', testHash.rows[0].hash);
  
  // Test password verification function in SQL:
  const matchQuery = await client.query(
    "SELECT (crypt('Vedotrix@2026!Secure', $1) = $1) as is_match;",
    [testHash.rows[0].hash]
  );
  console.log('✅ Password verification test:', matchQuery.rows[0].is_match);

  await client.end();
}

checkPgcrypto().catch(console.error);
