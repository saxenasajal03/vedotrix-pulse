import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase IPv4 Pooler connection (Tokyo / ap-northeast-1)
const connectionString = 'postgresql://postgres.cqevzpvyqvckvenutuzz:DB_PASSWORD_PLACEHOLDER@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';

const client = new pg.Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  console.log('🔄 Connecting to live Supabase PostgreSQL database (ap-northeast-1)...');
  try {
    await client.connect();
    console.log('✅ Connected successfully to Supabase DB!');

    // 1. Read Migration SQL
    const migrationPath = path.resolve(__dirname, '../../supabase/migrations/001_initial_schema.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📦 Applying Schema Migration (Tables, RLS, Functions, Triggers)...');
    await client.query(migrationSql);
    console.log('✅ Schema migration applied successfully!');

    // 2. Insert Master Vedotrix Technologies Global Org and Superadmin
    console.log('👑 Seeding Vedotrix Technologies Global Master Organization...');
    const masterOrgSql = `
      INSERT INTO organizations (id, name, slug, org_code, industry, website, address, phone)
      VALUES 
      ('00000000-0000-0000-0000-000000000001', 'Vedotrix Technologies Global', 'vedotrix', 'VDX', 'Tech', 'https://vedotrix.com', 'Vedotrix Innovation Park, Bengaluru, India', '+91 80 4400 9900')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, org_code = EXCLUDED.org_code;

      INSERT INTO office_locations (id, org_id, name, latitude, longitude, radius_meters, address)
      VALUES
      ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Vedotrix Master HQ', 12.9352, 77.6946, 200, 'Outer Ring Road, Bellandur, Bengaluru')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO profiles (id, org_id, email, first_name, last_name, role, designation, department, joining_date, base_salary)
      VALUES
      ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'superadmin@vedotrix.com', 'Vedotrix', 'Super Controller', 'superadmin', 'Global Platform Architect', 'Platform Engineering', '2022-01-01', 350000)
      ON CONFLICT (id) DO UPDATE SET role = 'superadmin';
    `;
    await client.query(masterOrgSql);
    console.log('✅ Vedotrix Technologies Master Organization and Superadmin configured!');

    // 3. Read Seed SQL
    const seedPath = path.resolve(__dirname, '../../supabase/seed.sql');
    if (fs.existsSync(seedPath)) {
      console.log('🌱 Seeding initial client organizations & data...');
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      await client.query(seedSql);
      console.log('✅ Seed data inserted successfully!');
    }

    // 4. Verify Tables & Counts
    const resOrgs = await client.query('SELECT count(*) FROM organizations;');
    const resOffers = await client.query('SELECT count(*) FROM offer_letters;');
    const resProfiles = await client.query('SELECT count(*) FROM profiles;');
    const resTasks = await client.query('SELECT count(*) FROM tasks;');

    console.log('\n📊 LIVE SUPABASE DATABASE AUDIT:');
    console.log(`- Organizations: ${resOrgs.rows[0].count}`);
    console.log(`- Profiles: ${resProfiles.rows[0].count}`);
    console.log(`- Offer Letters: ${resOffers.rows[0].count}`);
    console.log(`- Tasks: ${resTasks.rows[0].count}`);
    console.log('\n🎉 ALL LIVE DATABASE TABLES ARE ACTIVE & HEALTHY!');

  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await client.end();
  }
}

runMigration();
