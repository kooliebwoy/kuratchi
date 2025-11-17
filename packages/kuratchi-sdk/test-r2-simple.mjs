/**
 * Simple R2 bucket creation test using direct Cloudflare SDK
 * Run with: node test-r2-simple.mjs
 */

import Cloudflare from 'cloudflare';

async function testR2BucketCreation() {
  console.log('=== R2 Bucket Creation Test ===\n');

  // Read credentials from environment
  const apiToken = process.env.CF_API_TOKEN || 
    process.env.CLOUDFLARE_API_TOKEN || 
    process.env.KURATCHI_CF_API_TOKEN;
  
  const accountId = process.env.CF_ACCOUNT_ID || 
    process.env.CLOUDFLARE_ACCOUNT_ID || 
    process.env.KURATCHI_CF_ACCOUNT_ID;

  console.log('1. Credentials check:');
  console.log('   - API Token:', apiToken ? `${apiToken.substring(0, 10)}...` : 'NOT FOUND');
  console.log('   - Account ID:', accountId || 'NOT FOUND');
  console.log('');

  if (!apiToken || !accountId) {
    console.error('❌ Missing credentials. Set CF_API_TOKEN and CF_ACCOUNT_ID environment variables.');
    process.exit(1);
  }

  // Generate test bucket name
  const testBucketName = `test-r2-${Date.now()}`;
  console.log('2. Test bucket name:', testBucketName);
  console.log('');

  try {
    console.log('3. Creating Cloudflare client...');
    const cf = new Cloudflare({ apiToken });
    console.log('   ✓ Client created');
    console.log('');

    console.log('4. Calling r2.buckets.create...');
    const result = await cf.r2.buckets.create({ 
      name: testBucketName, 
      account_id: accountId 
    });
    console.log('   ✓ API call completed');
    console.log('');

    console.log('5. Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');

    console.log('✅ R2 bucket created successfully!');
    console.log('');
    
    console.log('6. Cleaning up - deleting test bucket...');
    try {
      await cf.r2.buckets.delete(testBucketName, { account_id: accountId });
      console.log('   ✓ Test bucket cleaned up');
    } catch (deleteErr) {
      console.warn('   ⚠ Could not delete test bucket:', deleteErr.message);
    }
    
  } catch (error) {
    console.error('');
    console.error('❌ Test failed with exception:');
    console.error('   Message:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

testR2BucketCreation().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
