#!/usr/bin/env node
import { CloudflareManager } from 'kuratchi-sdk';
import { CHAT_SPACE_WORKER_SCRIPT } from '../src/lib/workers/chat-space-worker.js';

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const SPACES_API_KEY = process.env.CHAT_SPACES_API_KEY;

if (!ACCOUNT_ID || !API_TOKEN || !SPACES_API_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   - CLOUDFLARE_ACCOUNT_ID');
  console.error('   - CLOUDFLARE_API_TOKEN');
  console.error('   - CHAT_SPACES_API_KEY');
  process.exit(1);
}

async function deploySpacesWorker() {
  const manager = new CloudflareManager(ACCOUNT_ID, API_TOKEN);

  console.log('🚀 Deploying Kuratchi Spaces worker...\n');

  try {
    // Upload the worker with Durable Object binding
    const result = await manager.uploadWorkerModule(
      'chat-spaces-worker',
      CHAT_SPACE_WORKER_SCRIPT,
      [
        // Durable Object namespace binding
        {
          type: 'durable_object_namespace',
          name: 'CHAT_SPACES',
          class_name: 'KuratchiChatSpace',
          script_name: 'chat-spaces-worker'
        },
        // API key for authentication
        {
          type: 'plain_text',
          name: 'API_KEY',
          text: SPACES_API_KEY
        }
      ],
      {
        // This enables SQLite storage for the Durable Object
        skipDoMigrations: false
      }
    );

    console.log('✅ Worker deployed successfully!\n');
    console.log('📋 Deployment Details:');
    console.log('   Worker name: chat-spaces-worker');
    console.log('   Durable Object class: KuratchiChatSpace');
    console.log('   SQLite storage: Enabled');
    console.log('   Binding name: CHAT_SPACES\n');

    console.log('📝 Next steps:');
    console.log('   1. Add a custom domain route in Cloudflare dashboard:');
    console.log('      https://dash.cloudflare.com/' + ACCOUNT_ID + '/workers/services/view/chat-spaces-worker/production/settings/triggers');
    console.log('   2. Recommended domain: chat-spaces.kuratchi.dev');
    console.log('   3. Update CHAT_SPACES_WORKER_URL in your app environment');
    console.log('   4. Test the deployment:\n');
    console.log('      pnpm tsx scripts/test-spaces.ts\n');

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    if (error instanceof Error) {
      console.error('\n   Error details:', error.message);
    }
    process.exit(1);
  }
}

deploySpacesWorker();
