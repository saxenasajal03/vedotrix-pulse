import pg from 'pg';

const regions = [
  'ap-southeast-1',
  'us-east-1',
  'us-west-1',
  'eu-central-1',
  'eu-west-1',
  'ap-northeast-1',
  'ap-southeast-2',
  'sa-east-1'
];

async function findRegion() {
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const conn = `postgresql://postgres.cqevzpvyqvckvenutuzz:DB_PASSWORD_PLACEHOLDER@${host}:5432/postgres`;
    const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
    try {
      console.log(`Checking region: ${region}...`);
      await client.connect();
      console.log(`🎯 FOUND REGION! ${region}`);
      const res = await client.query('SELECT version();');
      console.log('Version:', res.rows[0].version);
      await client.end();
      return region;
    } catch (err) {
      if (err.message && err.message.includes('tenant/user')) {
        // Not this region
      } else {
        console.log(`Region ${region} result:`, err.message);
      }
      try { await client.end(); } catch (e) {}
    }
  }
  console.log('None of the common poolers matched.');
}

findRegion();
