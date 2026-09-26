import pg from 'pg';

const connectionString = 'postgresql://postgres.cqevzpvyqvckvenutuzz:DB_PASSWORD_PLACEHOLDER@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function initStorageBuckets() {
  console.log('🔄 Initializing Supabase Storage Buckets via PostgreSQL...');
  try {
    await client.connect();
    console.log('Connected to DB.');

    // 1. Create storage buckets if not present
    await client.query(`
      INSERT INTO storage.buckets (id, name, public) 
      VALUES 
        ('organization-logos', 'organization-logos', true),
        ('avatars', 'avatars', true),
        ('documents', 'documents', true)
      ON CONFLICT (id) DO UPDATE SET public = true;
    `);

    console.log('✅ Created/verified storage buckets: organization-logos, avatars, documents');

    // 2. Set storage RLS policies for uploads and public reads
    await client.query(`
      DROP POLICY IF EXISTS "Public Access to Logos" ON storage.objects;
      CREATE POLICY "Public Access to Logos" ON storage.objects
      FOR SELECT TO anon, authenticated
      USING (bucket_id IN ('organization-logos', 'avatars', 'documents'));

      DROP POLICY IF EXISTS "Allow Uploads to Storage" ON storage.objects;
      CREATE POLICY "Allow Uploads to Storage" ON storage.objects
      FOR INSERT TO anon, authenticated
      WITH CHECK (bucket_id IN ('organization-logos', 'avatars', 'documents'));

      DROP POLICY IF EXISTS "Allow Updates to Storage" ON storage.objects;
      CREATE POLICY "Allow Updates to Storage" ON storage.objects
      FOR UPDATE TO anon, authenticated
      USING (bucket_id IN ('organization-logos', 'avatars', 'documents'));
    `);

    console.log('✅ Configured storage security policies for public reads and uploads!');

    // 3. Verify buckets
    const res = await client.query('SELECT id, name, public FROM storage.buckets;');
    console.log('\n📦 Active Storage Buckets:');
    console.table(res.rows);

  } catch (err) {
    console.error('Storage bucket setup error:', err);
  } finally {
    await client.end();
  }
}

initStorageBuckets();
