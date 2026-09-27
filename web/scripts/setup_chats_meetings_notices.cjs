const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.cqevzpvyqvckvenutuzz:yY1EKXWC8M4OjrPV@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function setup() {
  await client.connect();
  console.log('Connected to PostgreSQL for Chats, Meetings, & Notices setup.');

  // 1. Create chat_channels table
  await client.query(`
    CREATE TABLE IF NOT EXISTS chat_channels (
      id text PRIMARY KEY,
      org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
      name varchar(100) NOT NULL,
      description text DEFAULT '',
      is_private boolean DEFAULT false,
      member_ids jsonb DEFAULT '[]'::jsonb,
      created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
      created_by_name text DEFAULT '',
      type varchar(20) DEFAULT 'channel',
      created_at timestamptz DEFAULT now()
    );
  `);
  console.log('✅ Created chat_channels table.');

  // 2. Create chat_messages table
  await client.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id text PRIMARY KEY,
      org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
      sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
      sender_name text NOT NULL,
      sender_role varchar(50) DEFAULT 'employee',
      sender_avatar text DEFAULT '/vedotrix-logo.png',
      channel varchar(100) NOT NULL,
      recipient_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
      message text DEFAULT '',
      attachments jsonb DEFAULT '[]'::jsonb,
      reactions jsonb DEFAULT '[]'::jsonb,
      reply_to_message_id text,
      reply_to_snippet text,
      is_pinned boolean DEFAULT false,
      created_at timestamptz DEFAULT now()
    );
  `);
  console.log('✅ Created chat_messages table.');

  // 3. Create meetings table
  await client.query(`
    CREATE TABLE IF NOT EXISTS meetings (
      id text PRIMARY KEY,
      org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
      title varchar(255) NOT NULL,
      description text DEFAULT '',
      date date NOT NULL,
      start_time varchar(20) NOT NULL,
      end_time varchar(20),
      is_online boolean DEFAULT true,
      meeting_url text,
      location text,
      organizer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
      organizer_name varchar(150) NOT NULL,
      organizer_role varchar(50) DEFAULT 'manager',
      attendee_ids jsonb DEFAULT '["all"]'::jsonb,
      department varchar(100) DEFAULT 'All',
      status varchar(30) DEFAULT 'scheduled',
      created_at timestamptz DEFAULT now()
    );
  `);
  console.log('✅ Created meetings table.');

  // 4. Create notices table
  await client.query(`
    CREATE TABLE IF NOT EXISTS notices (
      id text PRIMARY KEY,
      org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
      title varchar(255) NOT NULL,
      content text NOT NULL,
      category varchar(50) DEFAULT 'announcement',
      priority varchar(20) DEFAULT 'medium',
      author_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
      author_name varchar(150) NOT NULL,
      author_role varchar(50) DEFAULT 'superadmin',
      date timestamptz DEFAULT now(),
      attachment_url text,
      is_pinned boolean DEFAULT false,
      created_at timestamptz DEFAULT now()
    );
  `);
  console.log('✅ Created notices table.');

  // 5. Setup RLS policies for all 4 tables (Allow anon & authenticated read/write/update/delete)
  const tables = ['chat_channels', 'chat_messages', 'meetings', 'notices'];
  for (const table of tables) {
    await client.query(`
      ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Public read ${table}" ON ${table};
      CREATE POLICY "Public read ${table}" ON ${table}
        FOR SELECT TO anon, authenticated USING (true);

      DROP POLICY IF EXISTS "Public insert ${table}" ON ${table};
      CREATE POLICY "Public insert ${table}" ON ${table}
        FOR INSERT TO anon, authenticated WITH CHECK (true);

      DROP POLICY IF EXISTS "Public update ${table}" ON ${table};
      CREATE POLICY "Public update ${table}" ON ${table}
        FOR UPDATE TO anon, authenticated USING (true);

      DROP POLICY IF EXISTS "Public delete ${table}" ON ${table};
      CREATE POLICY "Public delete ${table}" ON ${table}
        FOR DELETE TO anon, authenticated USING (true);
    `);
    console.log(`✅ Configured open RLS policies for ${table}.`);
  }

  // 6. Seed initial default rows if empty
  // Check organizations
  const orgsRes = await client.query('SELECT id, name FROM organizations LIMIT 5;');
  const orgs = orgsRes.rows;

  if (orgs.length > 0) {
    const defaultOrgId = orgs[0].id;
    const profilesRes = await client.query('SELECT id, first_name, last_name, role FROM profiles WHERE org_id = $1 LIMIT 5;', [defaultOrgId]);
    const profiles = profilesRes.rows;
    const adminUser = profiles[0] || { id: null, first_name: 'Admin', last_name: 'User', role: 'superadmin' };

    // Seed chat_channels
    const chanCount = await client.query('SELECT count(*) FROM chat_channels;');
    if (parseInt(chanCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO chat_channels (id, org_id, name, description, is_private, member_ids, created_by, created_by_name, type)
        VALUES ('support', $1, 'support', 'Common Support: Internal helpdesk, HR questions & IT ticket assistance', false, '[]'::jsonb, $2, $3, 'channel');
      `, [defaultOrgId, adminUser.id, `${adminUser.first_name} ${adminUser.last_name}`]);
      console.log('✅ Seeded default #support channel.');
    }

    // Seed chat_messages
    const msgCount = await client.query('SELECT count(*) FROM chat_messages;');
    if (parseInt(msgCount.rows[0].count) === 0 && adminUser.id) {
      await client.query(`
        INSERT INTO chat_messages (id, org_id, sender_id, sender_name, sender_role, channel, message, reactions, created_at)
        VALUES (
          'msg-welcome',
          $1,
          $2,
          $3,
          $4,
          'support',
          'Welcome to the live Vedotrix Pulse Support & Helpdesk! Ask HR questions, payroll inquiries, or IT ticket assistance here.',
          '[{"emoji":"🚀","count":2,"userIds":[]}]'::jsonb,
          now()
        );
      `, [defaultOrgId, adminUser.id, `${adminUser.first_name} ${adminUser.last_name}`, adminUser.role]);
      console.log('✅ Seeded default welcome message in #support.');
    }

    // Seed notices
    const notifCount = await client.query('SELECT count(*) FROM notices;');
    if (parseInt(notifCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO notices (id, org_id, title, content, category, priority, author_id, author_name, author_role, is_pinned, date)
        VALUES 
        (
          'notice-1',
          $1,
          'Annual Corporate Performance & Q4 Sprint Goals',
          'All team leads and managers are advised to schedule sprint reviews and align on deliverables before the upcoming quarter review cycle.',
          'announcement',
          'high',
          $2,
          $3,
          'superadmin',
          true,
          now()
        ),
        (
          'notice-2',
          $1,
          'Workplace Geofence Attendance & Regularization Policy',
          'Please ensure that your daily attendance is marked through the Vedotrix Pulse dashboard within the designated 150m office radius. Leaves covering today will automatically lock attendance punching.',
          'policy',
          'medium',
          $2,
          $3,
          'hr',
          false,
          now()
        );
      `, [defaultOrgId, adminUser.id, `${adminUser.first_name} ${adminUser.last_name}`]);
      console.log('✅ Seeded initial corporate notices.');
    }

    // Seed meetings
    const meetCount = await client.query('SELECT count(*) FROM meetings;');
    if (parseInt(meetCount.rows[0].count) === 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      await client.query(`
        INSERT INTO meetings (id, org_id, title, description, date, start_time, end_time, is_online, meeting_url, location, organizer_id, organizer_name, organizer_role, attendee_ids, department, status)
        VALUES 
        (
          'meeting-1',
          $1,
          'All-Hands Weekly Sync & Sprint Alignment',
          'Weekly all-hands meeting covering departmental milestones, sprint blockers, and project deliverables.',
          $2,
          '10:30',
          '11:15',
          true,
          'https://meet.google.com/vdx-pulse-sync',
          'Main Conference Room',
          $3,
          $4,
          'superadmin',
          '["all"]'::jsonb,
          'All',
          'scheduled'
        );
      `, [defaultOrgId, todayStr, adminUser.id, `${adminUser.first_name} ${adminUser.last_name}`]);
      console.log('✅ Seeded initial corporate meeting.');
    }
  }

  await client.end();
  console.log('\n🎉 ALL LIVE TABLES (CHATS, MEETINGS, NOTICES) CREATED & ACTIVE IN SUPABASE POSTGRESQL!');
}

setup().catch((err) => {
  console.error('Setup error:', err);
  process.exit(1);
});
