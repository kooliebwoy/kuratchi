/**
 * Kuratchi Spaces - Deployment Script
 * 
 * Deploy the Spaces Durable Object worker to Cloudflare
 */

import { CHAT_SPACE_WORKER_SCRIPT } from './worker-template.js';
import { getDoEnvironment } from '../core/config.js';

export interface DeployOptions {
  accountId?: string;
  apiToken?: string;
  gatewayKey?: string;
  scriptName?: string;
  verbose?: boolean;
}

export interface DeployResult {
  success: boolean;
  workerUrl?: string;
  scriptName?: string;
  error?: string;
}

/**
 * Deploy the Kuratchi Spaces worker to Cloudflare
 */
export async function deploySpacesWorker(options: DeployOptions = {}): Promise<DeployResult> {
  const env = getDoEnvironment();
  
  const accountId = options.accountId || env.accountId;
  const apiToken = options.apiToken || env.apiToken;
  const gatewayKey = options.gatewayKey || env.gatewayKey;
  const scriptName = options.scriptName || env.scriptName || 'kuratchi-spaces';
  const verbose = options.verbose ?? true;

  // Validate required configs
  if (!accountId) {
    return { success: false, error: 'CLOUDFLARE_ACCOUNT_ID is required' };
  }
  if (!apiToken) {
    return { success: false, error: 'CLOUDFLARE_API_TOKEN is required' };
  }
  if (!gatewayKey) {
    return { success: false, error: 'KURATCHI_GATEWAY_KEY is required' };
  }

  if (verbose) {
    console.log('🚀 Deploying Kuratchi Spaces worker...');
    console.log(`   Account ID: ${accountId.substring(0, 8)}...`);
    console.log(`   Script Name: ${scriptName}`);
  }

  try {
    // Step 1: Upload the worker script with metadata
    if (verbose) console.log('\n📤 Uploading worker script...');
    
    // Create form data for worker upload
    const formData = new FormData();
    
    // Add the worker script as a file
    const scriptBlob = new Blob([CHAT_SPACE_WORKER_SCRIPT], { type: 'application/javascript+module' });
    formData.append('worker.js', scriptBlob, 'worker.js');
    
    // Add metadata specifying ES module format and Durable Object binding
    const metadata = {
      main_module: 'worker.js',
      compatibility_date: '2025-01-01',
      bindings: [
        {
          type: 'durable_object_namespace',
          name: 'CHAT_SPACE',
          class_name: 'KuratchiChatSpace',
          script_name: scriptName
        }
      ],
      migrations: [
        {
          tag: 'v1',
          new_classes: ['KuratchiChatSpace']
        }
      ]
    };
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');
    
    const uploadResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
        },
        body: formData
      }
    );

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      return { success: false, error: `Failed to upload script: ${error}` };
    }

    if (verbose) console.log('✅ Worker script uploaded');

    // Step 2: Set environment variables
    if (verbose) console.log('\n🔐 Setting environment variables...');

    const envResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}/settings`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bindings: [
            {
              type: 'plain_text',
              name: 'KURATCHI_GATEWAY_KEY',
              text: gatewayKey
            }
          ]
        })
      }
    );

    if (!envResponse.ok) {
      const error = await envResponse.text();
      return { success: false, error: `Failed to set environment variables: ${error}` };
    }

    if (verbose) console.log('✅ Environment variables set');

    // Generate worker URL
    const workerUrl = `https://${scriptName}.workers.dev`;

    if (verbose) {
      console.log('\n✨ Deployment successful!');
      console.log(`\n📍 Worker URL: ${workerUrl}`);
      console.log(`\n💡 Next steps:`);
      console.log(`   1. Set KURATCHI_SPACES_WORKER_URL=${workerUrl}`);
      console.log(`   2. Use spaces.client() in your app`);
      console.log(`   3. Generate tokens with spaces.generateToken()`);
    }

    return {
      success: true,
      workerUrl,
      scriptName
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * CLI deployment script
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  deploySpacesWorker()
    .then((result) => {
      if (!result.success) {
        console.error('❌ Deployment failed:', result.error);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Deployment error:', error);
      process.exit(1);
    });
}
