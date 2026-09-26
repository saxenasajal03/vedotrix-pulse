import pg from 'pg';

const connectionString = 'postgresql://postgres.cqevzpvyqvckvenutuzz:DB_PASSWORD_PLACEHOLDER@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function setupSuperadmins() {
  await client.connect();
  console.log('Setting up encrypted Superadmin accounts in Supabase PostgreSQL...');

  // 1. Ensure admin@vedotrix.com exists with encrypted password
  await client.query(`
    INSERT INTO profiles (
      id, org_id, email, first_name, last_name, role, designation, department, joining_date, base_salary, avatar_url, password_hash, modules_access
    ) VALUES (
      '00000000-0000-0000-0000-000000000003',
      '00000000-0000-0000-0000-000000000001',
      'admin@vedotrix.com',
      'Vedotrix',
      'Super Controller',
      'superadmin',
      'Global Platform Architect',
      'Platform Engineering',
      '2022-01-01',
      500000,
      '/vedotrix-logo.png',
      crypt('Vedotrix@2026!Secure', gen_salt('bf', 10)),
      '["all", "superadmin", "attendance", "tasks", "standups", "offers", "payroll", "access_requests"]'::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET
      email = 'admin@vedotrix.com',
      password_hash = crypt('Vedotrix@2026!Secure', gen_salt('bf', 10)),
      role = 'superadmin',
      modules_access = '["all", "superadmin", "attendance", "tasks", "standups", "offers", "payroll", "access_requests"]'::jsonb;
  `);

  // 2. Also ensure sajalsaxenagola@gmail.com has its own profile with encrypted password
  await client.query(`
    INSERT INTO profiles (
      id, org_id, email, first_name, last_name, role, designation, department, joining_date, base_salary, avatar_url, password_hash, modules_access
    ) VALUES (
      '00000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-000000000001',
      'sajalsaxenagola@gmail.com',
      'Sajal',
      'Saxena',
      'superadmin',
      'Founder & Super Controller',
      'Executive Leadership',
      '2022-01-01',
      500000,
      '/vedotrix-logo.png',
      crypt('Vedotrix@2026!Secure', gen_salt('bf', 10)),
      '["all", "superadmin", "attendance", "tasks", "standups", "offers", "payroll", "access_requests"]'::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET
      password_hash = crypt('Vedotrix@2026!Secure', gen_salt('bf', 10)),
      role = 'superadmin';
  `);

  // 3. Test verification for both with verify_user_password
  const test1 = await client.query(`SELECT * FROM verify_user_password('admin@vedotrix.com', 'Vedotrix@2026!Secure');`);
  const test2 = await client.query(`SELECT * FROM verify_user_password('sajalsaxenagola@gmail.com', 'Vedotrix@2026!Secure');`);
  const testBad = await client.query(`SELECT * FROM verify_user_password('admin@vedotrix.com', 'WrongPass');`);

  console.log('\n🔐 TEST 1 (admin@vedotrix.com + Correct Pass):', test1.rows[0]?.is_valid ? 'SUCCESS' : 'FAILED', test1.rows[0]);
  console.log('🔐 TEST 2 (sajalsaxenagola@gmail.com + Correct Pass):', test2.rows[0]?.is_valid ? 'SUCCESS' : 'FAILED', test2.rows[0]);
  console.log('🚫 TEST 3 (admin@vedotrix.com + Wrong Pass):', testBad.rows.length === 0 || !testBad.rows[0]?.is_valid ? 'REJECTED AS EXPECTED' : 'FAIL');

  const allProf = await client.query('SELECT id, email, role, password_hash FROM profiles;');
  console.log('\n📋 Stored Profiles in DB:');
  console.log(allProf.rows);

  await client.end();
}

setupSuperadmins().catch(console.error);
