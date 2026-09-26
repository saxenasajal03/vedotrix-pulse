import pg from 'pg';

const connectionString = 'postgresql://postgres.cqevzpvyqvckvenutuzz:DB_PASSWORD_PLACEHOLDER@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function cleanDatabase() {
  console.log('🧹 Connecting to Supabase to purge demo data and setup clean Production state...');
  try {
    await client.connect();
    console.log('✅ Connected to database.');

    // 1. Delete demo attendance, tasks, standups, payroll, offer letters
    console.log('Purging dummy data...');
    await client.query(`
      DELETE FROM attendance WHERE org_id != '00000000-0000-0000-0000-000000000001';
      DELETE FROM tasks WHERE org_id != '00000000-0000-0000-0000-000000000001';
      DELETE FROM daily_standups WHERE org_id != '00000000-0000-0000-0000-000000000001';
      DELETE FROM payroll_records WHERE org_id != '00000000-0000-0000-0000-000000000001';
      DELETE FROM offer_letters WHERE org_id != '00000000-0000-0000-0000-000000000001';
      DELETE FROM office_locations WHERE org_id != '00000000-0000-0000-0000-000000000001';
      DELETE FROM profiles WHERE org_id != '00000000-0000-0000-0000-000000000001';
      DELETE FROM organizations WHERE id != '00000000-0000-0000-0000-000000000001';
    `);

    // 2. Ensure Vedotrix Master Org & Superadmin are pristine
    console.log('Ensuring Vedotrix Technologies Global Master Organization is pristine...');
    await client.query(`
      INSERT INTO organizations (id, name, slug, org_code, industry, website, address, phone, logo_url)
      VALUES (
        '00000000-0000-0000-0000-000000000001',
        'Vedotrix Technologies Global',
        'vedotrix',
        'VDX',
        'Tech',
        'https://vedotrix.com',
        'Vedotrix Innovation Park, Cyber Hub, Bengaluru, India',
        '+91 80 4400 9900',
        '/vedotrix-logo.png'
      )
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        org_code = EXCLUDED.org_code,
        logo_url = EXCLUDED.logo_url;

      INSERT INTO office_locations (id, org_id, name, latitude, longitude, radius_meters, address)
      VALUES (
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001',
        'Vedotrix Innovation Park (HQ)',
        12.9352,
        77.6946,
        200,
        'Outer Ring Road, Bellandur, Bengaluru'
      )
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO profiles (id, org_id, email, first_name, last_name, role, designation, department, joining_date, base_salary, avatar_url)
      VALUES (
        '00000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000001',
        'admin@vedotrix.com',
        'Vedotrix',
        'Superadmin',
        'superadmin',
        'Chief Technology Officer & Super Controller',
        'Platform Architecture',
        '2022-01-01',
        500000,
        '/vedotrix-logo.png'
      )
      ON CONFLICT (id) DO UPDATE SET 
        email = EXCLUDED.email,
        role = 'superadmin',
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name;
    `);

    // 3. Verify Counts
    const resOrgs = await client.query('SELECT count(*), name FROM organizations GROUP BY name;');
    const resProfiles = await client.query('SELECT count(*), email, role FROM profiles GROUP BY email, role;');
    const resOffers = await client.query('SELECT count(*) FROM offer_letters;');

    console.log('\n📊 CLEAN PRODUCTION AUDIT:');
    console.log('Active Organizations:', resOrgs.rows);
    console.log('Active Superadmin Profile:', resProfiles.rows);
    console.log(`Remaining Offer Letters: ${resOffers.rows[0].count}`);
    console.log('\n✨ ALL DEMO ENTRIES PURGED. DATABASE IS 100% PRODUCTION READY!');

  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await client.end();
  }
}

cleanDatabase();
