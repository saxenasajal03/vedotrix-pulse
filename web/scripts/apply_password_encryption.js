import pg from 'pg';

const connectionString = 'postgresql://postgres.cqevzpvyqvckvenutuzz:DB_PASSWORD_PLACEHOLDER@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function applyPasswordEncryption() {
  await client.connect();
  console.log('🔄 Connected to Supabase DB. Setting up automatic password encryption...');

  // 1. Ensure pgcrypto extension is installed
  await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

  // 2. Create the auto-hashing trigger function
  await client.query(`
    CREATE OR REPLACE FUNCTION hash_profile_password()
    RETURNS TRIGGER AS $$
    BEGIN
      -- If password_hash is provided and is NOT already a bcrypt hash (starts with $2a$ or $2b$), encrypt it
      IF NEW.password_hash IS NOT NULL AND NEW.password_hash !~ '^\\$2[ab]\\$[0-9]{2}\\$' THEN
        NEW.password_hash := crypt(NEW.password_hash, gen_salt('bf', 10));
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_hash_profile_password ON profiles;
    CREATE TRIGGER trg_hash_profile_password
    BEFORE INSERT OR UPDATE OF password_hash ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION hash_profile_password();
  `);
  console.log('✅ Auto-hashing trigger created on profiles table!');

  // 3. Encrypt all existing plain text passwords in profiles table
  console.log('🔒 Encrypting all existing plain-text passwords in profiles...');
  await client.query(`
    UPDATE profiles
    SET password_hash = crypt(password_hash, gen_salt('bf', 10))
    WHERE password_hash IS NOT NULL AND password_hash !~ '^\\$2[ab]\\$[0-9]{2}\\$';
  `);
  console.log('✅ Existing passwords encrypted successfully!');

  // 4. Create secure RPC function verify_user_password for authenticating without exposing hashes
  await client.query(`
    CREATE OR REPLACE FUNCTION verify_user_password(user_email TEXT, input_password TEXT)
    RETURNS TABLE (
      is_valid BOOLEAN,
      user_id UUID,
      org_id UUID,
      role VARCHAR,
      first_name VARCHAR,
      last_name VARCHAR,
      designation VARCHAR,
      department VARCHAR,
      modules_access JSONB,
      manager_id UUID,
      avatar_url TEXT
    ) AS $$
    BEGIN
      RETURN QUERY
      SELECT 
        (p.password_hash = crypt(input_password, p.password_hash)) AS is_valid,
        p.id AS user_id,
        p.org_id,
        p.role,
        p.first_name,
        p.last_name,
        p.designation,
        p.department,
        p.modules_access,
        p.manager_id,
        p.avatar_url
      FROM profiles p
      WHERE LOWER(p.email) = LOWER(user_email) AND p.is_active = TRUE;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    GRANT EXECUTE ON FUNCTION verify_user_password(TEXT, TEXT) TO anon, authenticated;
  `);
  console.log('✅ RPC function verify_user_password created and granted to anon & authenticated!');

  // 5. Test verification of Superadmin
  const testSuperadmin = await client.query(`
    SELECT * FROM verify_user_password('admin@vedotrix.com', 'Vedotrix@2026!Secure');
  `);
  console.log('\n🔍 Superadmin Password Verification Result:');
  console.log(testSuperadmin.rows);

  // Test wrong password
  const testWrongPass = await client.query(`
    SELECT * FROM verify_user_password('admin@vedotrix.com', 'WrongPassword123');
  `);
  console.log('\n🔍 Wrong Password Verification Result:');
  console.log(testWrongPass.rows);

  // 6. Inspect profiles table to confirm password_hash is encrypted
  const inspectProfiles = await client.query(`
    SELECT id, email, role, password_hash FROM profiles;
  `);
  console.log('\n🔐 Stored Profiles in DB (Notice encrypted bcrypt hashes):');
  console.log(inspectProfiles.rows);

  await client.end();
}

applyPasswordEncryption().catch(console.error);
