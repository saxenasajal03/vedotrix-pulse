import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const url = 'https://cqevzpvyqvckvenutuzz.supabase.co';
const key = 'sb_publishable_vFIWyBN1E22I-7saEe3Yew_vV2fQkUX';

async function testUpload() {
  console.log('Testing upload to Supabase storage bucket "organization-logos"...');
  const supabase = createClient(url, key);

  const logoPath = path.resolve(__dirname, '../public/vedotrix-logo.png');
  const fileBuffer = fs.readFileSync(logoPath);

  const fileName = `vedotrix-master-${Date.now()}.png`;

  const { data, error } = await supabase.storage
    .from('organization-logos')
    .upload(fileName, fileBuffer, {
      contentType: 'image/png',
      upsert: true
    });

  if (error) {
    console.error('❌ Upload error:', error);
  } else {
    console.log('✅ Upload SUCCESS! File stored at:', data.path);
    const { data: publicUrlData } = supabase.storage
      .from('organization-logos')
      .getPublicUrl(fileName);
    console.log('🔗 Public CDN URL:', publicUrlData.publicUrl);
  }
}

testUpload();
