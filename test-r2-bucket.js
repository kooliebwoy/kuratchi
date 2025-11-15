/**
 * Test script for R2 bucket creation
 * Run with: node --loader tsx test-r2-bucket.js
 * Or: tsx test-r2-bucket.js
 */

import { CloudflareClient } from './packages/kuratchi-sdk/src/lib/utils/cloudflare.ts';

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
    console.log('3. Creating CloudflareClient...');
    const client = new CloudflareClient({ apiToken, accountId });
    console.log('   ✓ Client created');
    console.log('');

    console.log('4. Calling createR2Bucket...');
    const result = await client.createR2Bucket(testBucketName);
    console.log('   ✓ API call completed');
    console.log('');

    console.log('5. Result:');
    console.log('   - Success:', result?.success);
    console.log('   - Has errors:', !!(result?.errors && result.errors.length > 0));
    console.log('   - Full result:', JSON.stringify(result, null, 2));
    console.log('');

    if (result?.success) {
      console.log('✅ R2 bucket created successfully!');
      console.log('');
      console.log('6. Cleaning up - deleting test bucket...');
      const deleteResult = await client.deleteR2Bucket(testBucketName);
      console.log('   - Delete success:', deleteResult?.success);
      console.log('   ✓ Test bucket cleaned up');
    } else {
      console.error('❌ R2 bucket creation failed');
      if (result?.errors) {
        console.error('   Errors:', JSON.stringify(result.errors, null, 2));
      }
    }
  } catch (error) {
    console.error('');
    console.error('❌ Test failed with exception:');
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

testR2BucketCreation().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
