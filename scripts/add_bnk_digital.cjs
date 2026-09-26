const { Client } = require('../web/node_modules/pg');

const client = new Client({
  connectionString: 'postgresql://postgres.cqevzpvyqvckvenutuzz:DB_PASSWORD_PLACEHOLDER@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function setup() {
  await client.connect();
  console.log('Connected to PostgreSQL successfully.');

  const logoUrl = 'https://cqevzpvyqvckvenutuzz.supabase.co/storage/v1/object/public/organization-logos/bnk-digital-logo.png';
  
  // 1. Insert or update BNK Digital Organization
  const orgCheck = await client.query('SELECT * FROM organizations WHERE slug = $1 OR name = $2', ['bnk-digital', 'BNK Digital']);
  let orgId;
  if (orgCheck.rows.length > 0) {
    orgId = orgCheck.rows[0].id;
    console.log('Updating existing BNK Digital Org ID:', orgId);
    await client.query(`
      UPDATE organizations 
      SET name = 'BNK Digital',
          org_code = 'BNK',
          logo_url = $1,
          industry = 'Digital Marketing',
          website = 'https://bnkdigital.com',
          settings = '{"subscription_plan": "Enterprise", "wfh_allowed": true, "work_hours_per_day": 8}',
          updated_at = NOW()
      WHERE id = $2
    `, [logoUrl, orgId]);
  } else {
    const orgRes = await client.query(`
      INSERT INTO organizations (name, slug, org_code, logo_url, industry, website, address, phone, settings)
      VALUES ('BNK Digital', 'bnk-digital', 'BNK', $1, 'Digital Marketing', 'https://bnkdigital.com', 'BNK Digital Corporate HQ', '+91 98765 43210', '{"subscription_plan": "Enterprise", "wfh_allowed": true, "work_hours_per_day": 8}')
      RETURNING id
    `, [logoUrl]);
    orgId = orgRes.rows[0].id;
    console.log('Created BNK Digital Org ID:', orgId);
  }

  // 2. Insert or update Kshitiz Narayan profile
  const email = 'kshitiznarayan543@gmail.com';
  const pass = 'Kshitiz@2006';

  const userCheck = await client.query('SELECT * FROM profiles WHERE email = $1', [email]);
  if (userCheck.rows.length > 0) {
    console.log('Updating existing profile for:', email);
    await client.query(`
      UPDATE profiles
      SET org_id = $1,
          first_name = 'Kshitiz',
          last_name = 'Narayan',
          role = 'superadmin',
          designation = 'Chief People Officer & HR Superadmin',
          department = 'HR Department',
          avatar_url = $2,
          is_active = true,
          password_hash = crypt($3, gen_salt('bf', 10)),
          modules_access = '["all", "superadmin", "attendance", "tasks", "standups", "offers", "payroll", "access_requests"]'::jsonb,
          updated_at = NOW()
      WHERE email = $4
    `, [orgId, logoUrl, pass, email]);
  } else {
    console.log('Creating new profile for:', email);
    await client.query(`
      INSERT INTO profiles (org_id, email, first_name, last_name, role, designation, department, base_salary, is_active, avatar_url, password_hash, modules_access)
      VALUES ($1, $2, 'Kshitiz', 'Narayan', 'superadmin', 'Chief People Officer & HR Superadmin', 'HR Department', 350000, true, $3, crypt($4, gen_salt('bf', 10)), '["all", "superadmin", "attendance", "tasks", "standups", "offers", "payroll", "access_requests"]'::jsonb)
    `, [orgId, email, logoUrl, pass]);
  }

  // 3. Test verification RPC
  const testRpc = await client.query('SELECT * FROM verify_user_password($1, $2)', [email, pass]);
  console.log('Verification test with valid password:');
  console.log(JSON.stringify(testRpc.rows[0], null, 2));

  const testBad = await client.query('SELECT * FROM verify_user_password($1, $2)', [email, 'WrongPass123']);
  console.log('Verification test with invalid password:', testBad.rows);

  await client.end();
}

setup().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
