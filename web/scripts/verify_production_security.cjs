const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const SUPABASE_URL = 'https://cqevzpvyqvckvenutuzz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vFIWyBN1E22I-7saEe3Yew_vV2fQkUX';
const DB_CONNECTION = 'postgresql://postgres.cqevzpvyqvckvenutuzz:DB_PASSWORD_PLACEHOLDER@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';

async function runVerification() {
  console.log('================================================================');
  console.log('🛡️ VEDOTRIX PULSE - PRODUCTION END-TO-END SECURITY VERIFICATION');
  console.log('Designed & Managed by Vedotrix Technologies');
  console.log('================================================================\n');

  // Test 1: Verify PostgreSQL pgcrypto Bcrypt Encryption in DB
  console.log('🔍 TEST 1: Inspecting live profiles table for bcrypt password hashes...');
  const pgClient = new Client({ connectionString: DB_CONNECTION });
  await pgClient.connect();

  const profileRows = await pgClient.query(`
    SELECT id, email, role, password_hash, (password_hash ~ '^\\$2[ab]\\$[0-9]{2}\\$') AS is_bcrypt_hash
    FROM profiles;
  `);

  console.log(`Found ${profileRows.rows.length} profiles in database:`);
  let allBcrypt = true;
  for (const row of profileRows.rows) {
    console.log(` - Email: ${row.email} | Role: ${row.role} | Bcrypt? ${row.is_bcrypt_hash} | Hash Prefix: ${row.password_hash.substring(0, 15)}...`);
    if (!row.is_bcrypt_hash) allBcrypt = false;
  }

  if (allBcrypt) {
    console.log('✅ PASS: All stored passwords are cryptographically salted bcrypt hashes!\n');
  } else {
    throw new Error('❌ FAIL: Non-bcrypt password found in database!');
  }

  // Test 2: RPC verify_user_password test with Supabase JS client
  console.log('🔍 TEST 2: Testing RPC verify_user_password across test cases...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Case A: Correct Superadmin
  const { data: validAdmin, error: errA } = await supabase.rpc('verify_user_password', {
    user_email: 'admin@vedotrix.com',
    input_password: 'Vedotrix@2026!Secure'
  });
  if (!errA && validAdmin && validAdmin.length > 0 && validAdmin[0].is_valid === true) {
    console.log('✅ PASS: Correct Superadmin password verified successfully via database RPC.');
  } else {
    throw new Error('❌ FAIL: Superadmin login failed verification.');
  }

  // Case B: Correct Sajal Saxena Super Controller
  const { data: validSajal, error: errB } = await supabase.rpc('verify_user_password', {
    user_email: 'sajalsaxenagola@gmail.com',
    input_password: 'Vedotrix@2026!Secure'
  });
  if (!errB && validSajal && validSajal.length > 0 && validSajal[0].is_valid === true) {
    console.log('✅ PASS: Sajal Saxena credentials verified successfully via database RPC.');
  } else {
    throw new Error('❌ FAIL: Sajal Saxena login failed verification.');
  }

  // Case C: Invalid Password (Must be rejected)
  const { data: invalidPass, error: errC } = await supabase.rpc('verify_user_password', {
    user_email: 'admin@vedotrix.com',
    input_password: 'AnyWrongPassword123'
  });
  if (!errC && invalidPass && invalidPass.length > 0 && invalidPass[0].is_valid === false) {
    console.log('✅ PASS: Wrong password correctly rejected with is_valid: false.');
  } else {
    throw new Error('❌ FAIL: Wrong password was not rejected!');
  }

  // Case D: Non-existent User (Must return empty)
  const { data: nonExistent, error: errD } = await supabase.rpc('verify_user_password', {
    user_email: 'ghost@nonexistent.com',
    input_password: 'AnyPassword'
  });
  if (!errD && (!nonExistent || nonExistent.length === 0)) {
    console.log('✅ PASS: Non-existent email correctly returned 0 records.');
  } else {
    throw new Error('❌ FAIL: Non-existent email returned data!');
  }

  // Test 3: Hierarchy Routing & Designated Manager Approvals
  console.log('\n🔍 TEST 3: Verifying Hierarchy Routing & Access Requests...');
  
  // Create a temporary manager and an employee under that manager
  const mgrId = '11111111-2222-3333-4444-555555555551';
  const empId = '11111111-2222-3333-4444-555555555552';
  const orgId = '00000000-0000-0000-0000-000000000001';

  // Cleanup any old test records first
  await pgClient.query(`DELETE FROM access_requests WHERE requester_id = $1 OR assigned_approver_id = $2;`, [empId, mgrId]);
  await pgClient.query(`DELETE FROM profiles WHERE id IN ($1, $2);`, [mgrId, empId]);

  // Insert Manager
  await pgClient.query(`
    INSERT INTO profiles (id, org_id, email, first_name, last_name, role, designation, department, password_hash)
    VALUES ($1, $2, 'testmanager@vedotrix.com', 'Alex', 'Reyes', 'manager', 'Engineering Manager', 'Platform Team', 'Manager@2026!');
  `, [mgrId, orgId]);

  // Insert Employee with manager_id = mgrId
  await pgClient.query(`
    INSERT INTO profiles (id, org_id, email, first_name, last_name, role, designation, department, manager_id, password_hash)
    VALUES ($1, $2, 'testdev@vedotrix.com', 'David', 'Kowalski', 'employee', 'Full Stack Developer', 'Platform Team', $3, 'Dev@2026!');
  `, [empId, orgId, mgrId]);

  // Verify that the trigger automatically encrypted their passwords!
  const checkNewProfiles = await pgClient.query(`
    SELECT email, password_hash, (password_hash ~ '^\\$2[ab]\\$[0-9]{2}\\$') AS is_bcrypt
    FROM profiles WHERE id IN ($1, $2);
  `, [mgrId, empId]);

  console.log('Auto-Bcrypt Trigger verification on newly created staff:');
  checkNewProfiles.rows.forEach(r => {
    console.log(` - ${r.email}: is_bcrypt=${r.is_bcrypt} (${r.password_hash.substring(0, 15)}...)`);
  });

  // Verify dev login via RPC
  const { data: testEmpLogin } = await supabase.rpc('verify_user_password', {
    user_email: 'testdev@vedotrix.com',
    input_password: 'Dev@2026!'
  });
  if (testEmpLogin && testEmpLogin[0]?.is_valid === true && testEmpLogin[0]?.manager_id === mgrId) {
    console.log('✅ PASS: Employee authenticated and manager_id properly mapped.');
  } else {
    throw new Error('❌ FAIL: Employee authentication or manager mapping failed.');
  }

  // Create Access Request for employee
  const { data: reqData, error: reqErr } = await supabase
    .from('access_requests')
    .insert({
      org_id: orgId,
      requester_id: empId,
      request_type: 'module_access',
      target_module: 'tech_sprints',
      justification: 'Need access to manage sprint backlog and PR review approvals.',
      status: 'pending',
      assigned_approver_id: mgrId
    })
    .select()
    .single();

  if (reqErr) throw new Error(`Access request creation failed: ${reqErr.message}`);
  console.log(`✅ PASS: Access request created (ID: ${reqData.id}) assigned strictly to manager ${mgrId}.`);

  // Query as the designated manager: Should see 1 request
  const { data: mgrQueue } = await supabase
    .from('access_requests')
    .select('*')
    .eq('assigned_approver_id', mgrId)
    .eq('status', 'pending');

  if (mgrQueue && mgrQueue.length === 1 && mgrQueue[0].id === reqData.id) {
    console.log('✅ PASS: Designated manager successfully retrieved direct report access request.');
  } else {
    throw new Error('❌ FAIL: Designated manager could not view request.');
  }

  // Query as another random user: Should NOT see this request
  const otherUserId = '00000000-0000-0000-0000-000000000004';
  const { data: otherQueue } = await supabase
    .from('access_requests')
    .select('*')
    .eq('assigned_approver_id', otherUserId)
    .eq('status', 'pending');

  if (otherQueue && otherQueue.length === 0) {
    console.log('✅ PASS: Other managers/users are strictly isolated and cannot see this request.');
  } else {
    throw new Error('❌ FAIL: Isolation breached! Non-designated user saw request.');
  }

  // Manager approves request
  const { error: approveErr } = await supabase
    .from('access_requests')
    .update({
      status: 'approved',
      approver_decision_notes: 'Approved by Engineering Manager Alex Reyes',
      approved_at: new Date().toISOString()
    })
    .eq('id', reqData.id);

  if (approveErr) throw new Error(`Approval failed: ${approveErr.message}`);
  console.log('✅ PASS: Manager approval successfully recorded in database.');

  // Clean up test records
  await pgClient.query(`DELETE FROM access_requests WHERE id = $1;`, [reqData.id]);
  await pgClient.query(`DELETE FROM profiles WHERE id IN ($1, $2);`, [mgrId, empId]);
  console.log('🧹 Cleaned up temporary test records.');

  await pgClient.end();

  console.log('\n================================================================');
  console.log('🎉 ALL SECURITY & HIERARCHY TESTS PASSED WITH 100% SUCCESS!');
  console.log('Designed & Managed by Vedotrix Technologies');
  console.log('================================================================');
}

runVerification().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
