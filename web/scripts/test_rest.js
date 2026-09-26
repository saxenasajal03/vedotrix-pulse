import { createClient } from '@supabase/supabase-js';

const url = 'https://cqevzpvyqvckvenutuzz.supabase.co';
const key = 'sb_publishable_vFIWyBN1E22I-7saEe3Yew_vV2fQkUX';

async function testRest() {
  console.log('Testing Supabase REST Client...');
  const supabase = createClient(url, key);
  const { data, error } = await supabase.from('organizations').select('id, name, org_code, industry');

  if (error) {
    console.error('REST API Error:', error);
  } else {
    console.log('✅ Supabase REST Client SUCCESS!');
    console.log('Organizations from Live Supabase Cloud:', data);
  }
}

testRest();
