import pg from 'pg';

const connectionString = 'postgresql://postgres.cqevzpvyqvckvenutuzz:DB_PASSWORD_PLACEHOLDER@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function configurePolicies() {
  await client.connect();
  console.log('Configuring public/anon access policies on live Supabase tables...');

  await client.query(`
    -- Profiles policy
    DROP POLICY IF EXISTS "Public read for profiles" ON profiles;
    CREATE POLICY "Public read for profiles" ON profiles FOR SELECT TO anon, authenticated USING (true);
    DROP POLICY IF EXISTS "Public insert profiles" ON profiles;
    CREATE POLICY "Public insert profiles" ON profiles FOR INSERT TO anon, authenticated WITH CHECK (true);
    DROP POLICY IF EXISTS "Public update profiles" ON profiles;
    CREATE POLICY "Public update profiles" ON profiles FOR UPDATE TO anon, authenticated USING (true);

    -- Offer Letters policy
    DROP POLICY IF EXISTS "Public offer verification by serial" ON offer_letters;
    CREATE POLICY "Public offer verification by serial" ON offer_letters FOR SELECT TO anon, authenticated USING (true);
    DROP POLICY IF EXISTS "Public insert offer letters" ON offer_letters;
    CREATE POLICY "Public insert offer letters" ON offer_letters FOR INSERT TO anon, authenticated WITH CHECK (true);
    DROP POLICY IF EXISTS "Public update offer letters" ON offer_letters;
    CREATE POLICY "Public update offer letters" ON offer_letters FOR UPDATE TO anon, authenticated USING (true);

    -- Attendance policy
    DROP POLICY IF EXISTS "Public read attendance" ON attendance;
    CREATE POLICY "Public read attendance" ON attendance FOR SELECT TO anon, authenticated USING (true);
    DROP POLICY IF EXISTS "Public insert attendance" ON attendance;
    CREATE POLICY "Public insert attendance" ON attendance FOR INSERT TO anon, authenticated WITH CHECK (true);
    DROP POLICY IF EXISTS "Public update attendance" ON attendance;
    CREATE POLICY "Public update attendance" ON attendance FOR UPDATE TO anon, authenticated USING (true);

    -- Tasks policy
    DROP POLICY IF EXISTS "Public read tasks" ON tasks;
    CREATE POLICY "Public read tasks" ON tasks FOR SELECT TO anon, authenticated USING (true);
    DROP POLICY IF EXISTS "Public insert tasks" ON tasks;
    CREATE POLICY "Public insert tasks" ON tasks FOR INSERT TO anon, authenticated WITH CHECK (true);
    DROP POLICY IF EXISTS "Public update tasks" ON tasks;
    CREATE POLICY "Public update tasks" ON tasks FOR UPDATE TO anon, authenticated USING (true);

    -- Daily Standups policy
    DROP POLICY IF EXISTS "Public read standups" ON daily_standups;
    CREATE POLICY "Public read standups" ON daily_standups FOR SELECT TO anon, authenticated USING (true);
    DROP POLICY IF EXISTS "Public insert standups" ON daily_standups;
    CREATE POLICY "Public insert standups" ON daily_standups FOR INSERT TO anon, authenticated WITH CHECK (true);

    -- Payroll policy
    DROP POLICY IF EXISTS "Public read payroll" ON payroll_records;
    CREATE POLICY "Public read payroll" ON payroll_records FOR SELECT TO anon, authenticated USING (true);
    DROP POLICY IF EXISTS "Public insert payroll" ON payroll_records;
    CREATE POLICY "Public insert payroll" ON payroll_records FOR INSERT TO anon, authenticated WITH CHECK (true);
    DROP POLICY IF EXISTS "Public update payroll" ON payroll_records;
    CREATE POLICY "Public update payroll" ON payroll_records FOR UPDATE TO anon, authenticated USING (true);
  `);

  console.log('✅ All policies configured for live database interaction!');
  await client.end();
}

configurePolicies();
