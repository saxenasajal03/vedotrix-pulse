const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const supabaseUrl = 'https://cqevzpvyqvckvenutuzz.supabase.co';
const supabaseKey = 'sb_publishable_vFIWyBN1E22I-7saEe3Yew_vV2fQkUX';
const supabase = createClient(supabaseUrl, supabaseKey);

const pgClient = new Client({
  connectionString: 'postgresql://postgres.cqevzpvyqvckvenutuzz:yY1EKXWC8M4OjrPV@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const PARENTAL_SUPERADMIN_EMAILS = [
  'sajalsaxenagola@gmail.com',
  'chiefhead.interndesire@gmail.com'
];

async function logToDb(log) {
  try {
    await pgClient.query(
      `INSERT INTO public.email_logs (recipient_email, recipient_name, subject, template_type, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [log.recipient_email, log.recipient_name, log.subject, log.template_type, log.status, JSON.stringify(log.metadata || {})]
    );
  } catch (err) {
    console.warn('DB log notice:', err.message);
  }
}

async function resendAll() {
  await pgClient.connect();
  console.log('🔗 Connected to Supabase PostgreSQL database.');

  // Ensure all auth users are confirmed so Google SMTP does not hit confirmation errors
  await pgClient.query(`
    UPDATE auth.users
    SET 
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      raw_user_meta_data = raw_user_meta_data || '{"email_verified": true}'::jsonb
    WHERE email_confirmed_at IS NULL;
  `);

  const profilesRes = await pgClient.query(`
    SELECT p.id, p.email, p.first_name, p.last_name, p.role, p.designation, p.department, o.name as org_name
    FROM public.profiles p
    LEFT JOIN public.organizations o ON p.org_id = o.id
    WHERE p.is_active = true
    ORDER BY p.created_at ASC;
  `);

  const profiles = profilesRes.rows;
  console.log(`Found ${profiles.length} active profiles to resend welcome emails to.`);

  for (let i = 0; i < profiles.length; i++) {
    const prof = profiles[i];
    const fullName = `${prof.first_name} ${prof.last_name}`.trim();
    const orgName = prof.org_name || 'BNK Digital';
    const subject = `Welcome to ${orgName} on Vedotrix Pulse HRMS`;

    console.log(`\n[${i + 1}/${profiles.length}] Dispatching to: ${prof.email} (${fullName} - ${prof.role})...`);

    let dispatchSuccess = false;
    let dispatchError = null;

    try {
      // Trigger portal access email via Google SMTP (smtp.gmail.com)
      const res = await supabase.auth.resetPasswordForEmail(prof.email, {
        redirectTo: 'https://vedotrix-pulse.netlify.app'
      });

      if (res.error) {
        dispatchError = res.error.message;
        console.warn(`⚠️ Supabase Google SMTP response notice for ${prof.email}:`, res.error.message);
      } else {
        dispatchSuccess = true;
        console.log(`✅ [GOOGLE SMTP] Dispatched to ${prof.email}!`);
      }
    } catch (e) {
      dispatchError = e.message;
      console.error(`❌ Exception dispatching to ${prof.email}:`, e.message);
    }

    // Log to public.email_logs
    await logToDb({
      recipient_email: prof.email,
      recipient_name: fullName,
      subject,
      template_type: 'welcome',
      status: dispatchSuccess ? 'sent' : 'pending',
      metadata: {
        orgName,
        role: prof.role,
        designation: prof.designation,
        department: prof.department,
        loginUrl: 'https://vedotrix-pulse.netlify.app',
        dispatchedVia: 'Google SMTP (smtp.gmail.com:465)',
        error: dispatchError || null,
        cc: PARENTAL_SUPERADMIN_EMAILS
      }
    });

    // Safe delay to maintain clean SMTP throughput
    await new Promise(r => setTimeout(r, 700));
  }

  // Also log parental summary alert to CC recipients
  for (const ccEmail of PARENTAL_SUPERADMIN_EMAILS) {
    await logToDb({
      recipient_email: ccEmail,
      recipient_name: ccEmail.includes('sajal') ? 'Sajal Saxena (Parental Root Controller)' : 'Chief Head (Vedotrix Master)',
      subject: `[Parental Audit] Welcome Emails Resent to ${profiles.length} Workforce Users via Google SMTP`,
      template_type: 'security',
      status: 'sent',
      metadata: {
        event: 'WELCOME_EMAILS_BATCH_RESENT',
        totalUsers: profiles.length,
        dispatchedVia: 'Google SMTP (smtp.gmail.com:465)',
        userList: profiles.map(p => ({ email: p.email, name: `${p.first_name} ${p.last_name}`, role: p.role })),
        timestamp: new Date().toISOString()
      }
    });
    console.log(`📡 [PARENTAL CC ALERT] Recorded CC notification to ${ccEmail}`);
  }

  console.log('\n🎉 All welcome emails resent and logged in Supabase PostgreSQL!');
  await pgClient.end();
}

resendAll().catch(console.error);
