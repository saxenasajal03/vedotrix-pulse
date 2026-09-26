import pg from 'pg';

const connectionString = 'postgresql://postgres.cqevzpvyqvckvenutuzz:DB_PASSWORD_PLACEHOLDER@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function setupEmailLogs() {
  console.log('🔄 Creating email_logs table on Supabase PostgreSQL...');
  try {
    await client.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
        recipient_email VARCHAR(255) NOT NULL,
        recipient_name VARCHAR(255),
        subject VARCHAR(255) NOT NULL,
        template_type VARCHAR(50) NOT NULL, -- 'welcome' | 'offer_letter' | 'attendance' | 'payroll' | 'security'
        status VARCHAR(50) DEFAULT 'sent',  -- 'sent' | 'pending' | 'failed'
        metadata JSONB,
        sent_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Public read email_logs" ON email_logs;
      CREATE POLICY "Public read email_logs" ON email_logs FOR SELECT TO anon, authenticated USING (true);

      DROP POLICY IF EXISTS "Public insert email_logs" ON email_logs;
      CREATE POLICY "Public insert email_logs" ON email_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
    `);

    console.log('✅ Created email_logs table with RLS policies!');
    const res = await client.query('SELECT count(*) FROM email_logs;');
    console.log('Email logs count:', res.rows[0].count);

  } catch (err) {
    console.error('Error creating email_logs table:', err);
  } finally {
    await client.end();
  }
}

setupEmailLogs();
