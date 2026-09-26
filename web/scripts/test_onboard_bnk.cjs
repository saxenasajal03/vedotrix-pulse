const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.cqevzpvyqvckvenutuzz:yY1EKXWC8M4OjrPV@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function testOnboard() {
  await client.connect();
  console.log('Testing organization onboarding with superadmin credentials in DB...');

  const orgId = '11111111-2222-3333-4444-555555555555';
  const profId = '22222222-3333-4444-5555-666666666666';
  const officeId = '33333333-4444-5555-6666-777777777777';

  // 1. Insert BNK Digital
  await client.query(`
    INSERT INTO organizations (id, name, slug, org_code, industry, website, address, phone, logo_url, settings)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, logo_url = EXCLUDED.logo_url;
  `, [
    orgId,
    'BNK Digital',
    'bnk-digital',
    'BNK',
    'Digital Marketing',
    'https://bnkdigital.com',
    'BNK Tower, Digital Media Park, New Delhi',
    '+91 98765 43210',
    'https://cqevzpvyqvckvenutuzz.supabase.co/storage/v1/object/public/organization-logos/bnk-digital-logo.png',
    JSON.stringify({ workHoursPerDay: 8, gracePeriodMins: 15, wfhAllowed: true, halfDayThresholdHours: 4.5 })
  ]);
  console.log('✅ BNK Digital organization record created / updated!');

  // 2. Insert Superadmin Kshitiz Narayan
  await client.query(`
    INSERT INTO profiles (
      id, org_id, email, first_name, last_name, role, designation, department,
      joining_date, base_salary, avatar_url, is_active, password_hash, modules_access
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      password_hash = EXCLUDED.password_hash,
      role = EXCLUDED.role;
  `, [
    profId,
    orgId,
    'kshitiznarayan543@gmail.com',
    'Kshitiz',
    'Narayan',
    'superadmin',
    'Superadmin / HR Head',
    'HR Department',
    new Date().toISOString().split('T')[0],
    120000,
    'https://cqevzpvyqvckvenutuzz.supabase.co/storage/v1/object/public/organization-logos/bnk-digital-logo.png',
    true,
    'Kshitiz@2006', // Triggers auto-hashing!
    JSON.stringify(['all', 'attendance', 'tasks', 'standups', 'offers', 'payroll', 'access_requests', 'leaves'])
  ]);
  console.log('✅ Superadmin Kshitiz Narayan profile created / updated!');

  // 3. Insert Office Location
  await client.query(`
    INSERT INTO office_locations (id, org_id, name, latitude, longitude, radius_meters, address, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (id) DO NOTHING;
  `, [
    officeId,
    orgId,
    'BNK Digital Head Office',
    28.6139,
    77.2090,
    250,
    'BNK Tower, Digital Media Park, New Delhi',
    true
  ]);
  console.log('✅ Office location created!');

  // 4. Test RPC login verification for Kshitiz Narayan
  const verifyRes = await client.query("SELECT * FROM verify_user_password('kshitiznarayan543@gmail.com', 'Kshitiz@2006');");
  console.log('🔍 RPC login verification result for Kshitiz@2006:', verifyRes.rows);

  // 5. Insert Email Log with CC to sajalsaxenagola@gmail.com
  await client.query(`
    INSERT INTO email_logs (org_id, recipient_email, recipient_name, subject, template_type, status, metadata)
    VALUES
      ($1, $2, $3, $4, 'welcome', 'sent', $5),
      ($1, $6, $7, $8, 'security', 'sent', $9),
      ($1, $10, $11, $12, 'security', 'sent', $13);
  `, [
    orgId,
    'kshitiznarayan543@gmail.com',
    'Kshitiz Narayan',
    'Welcome to BNK Digital on Vedotrix Pulse HRMS',
    JSON.stringify({ orgName: 'BNK Digital', role: 'superadmin', initialPassword: 'provided', cc: ['sajalsaxenagola@gmail.com', 'chiefhead.interndesire@gmail.com'] }),
    'sajalsaxenagola@gmail.com',
    'Sajal Saxena (Parental Root Controller)',
    '[Parental Super Controller Alert] New Organization Added: BNK Digital (BNK)',
    JSON.stringify({ event: 'ORGANIZATION_ONBOARDED', orgName: 'BNK Digital', superadminEmail: 'kshitiznarayan543@gmail.com', superadminName: 'Kshitiz Narayan' }),
    'chiefhead.interndesire@gmail.com',
    'Chief Head (Vedotrix Master)',
    '[Parental Super Controller Alert] New Organization Added: BNK Digital (BNK)',
    JSON.stringify({ event: 'ORGANIZATION_ONBOARDED', orgName: 'BNK Digital', superadminEmail: 'kshitiznarayan543@gmail.com', superadminName: 'Kshitiz Narayan' })
  ]);
  console.log('✅ Automated welcome email and CC alerts to sajalsaxenagola@gmail.com and chiefhead.interndesire@gmail.com recorded in Supabase email_logs!');

  await client.end();
}

testOnboard().catch(console.error);
