/**
 * Kuratchi Spaces - Public API
 * Real-time chat rooms powered by Durable Objects with SQLite storage
 */

// Core client
export { KuratchiSpaceClient } from './core/space-client.js';

// Types
export type {
  SpaceConfig,
  SpaceClientConfig,
  CreateSpaceOptions,
  SpaceInstanceConfig,
  Message,
  Attachment,
  Participant,
  TypingStatus,
  SendMessageOptions,
  GetMessagesOptions,
  SpaceMetadata,
  SpaceEventHandlers
} from './core/types.js';

// Configuration
export {
  getSpacesEnvironment,
  getDoEnvironment,
  validateSpacesEnvironment,
  validateDoEnvironment
} from './core/config.js';
export type {
  EnvironmentConfig,
  SpacesEnvironmentConfig
} from './core/config.js';

// Token utilities
export {
  generateSpaceToken,
  validateSpaceToken
} from './utils/tokens.js';

// Worker template
export { CHAT_SPACE_WORKER_SCRIPT } from './deployment/worker-template.js';
export { deploySpacesWorker } from './deployment/deploy.js';
export type { DeployOptions, DeployResult } from './deployment/deploy.js';

// Convenience namespace API
import { getSpacesEnvironment, getDoEnvironment } from './core/config.js';
import { KuratchiSpaceClient } from './core/space-client.js';
import { generateSpaceToken } from './utils/tokens.js';
import { CHAT_SPACE_WORKER_SCRIPT } from './deployment/worker-template.js';
import type {
  SpaceClientConfig,
  SpaceEventHandlers,
  Message,
  SendMessageOptions,
  GetMessagesOptions
} from './core/types.js';

/**
 * Create a space client with auto-configuration from environment
 */
export function client(config: {
  spaceId: string;
  spaceToken?: string;
  gatewayKey?: string;
  workerUrl?: string;
  onMessage?: (message: Message) => void;
  onTyping?: (userId: string, isTyping: boolean) => void;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Error) => void;
}): KuratchiSpaceClient {
  const env = getSpacesEnvironment();

  if (!config.workerUrl && !env.workerUrl) {
    throw new Error('workerUrl is required or set KURATCHI_SPACES_WORKER_URL');
  }
  if (!config.gatewayKey && !env.gatewayKey) {
    throw new Error('gatewayKey is required or set KURATCHI_SPACES_GATEWAY_KEY');
  }

  // Generate token if not provided
  const spaceToken = config.spaceToken || '';
  const gatewayKey = config.gatewayKey || env.gatewayKey!;
  const workerUrl = config.workerUrl || env.workerUrl!;

  return new KuratchiSpaceClient({
    spaceId: config.spaceId,
    spaceToken,
    gatewayKey,
    workerUrl,
    onMessage: config.onMessage,
    onTyping: config.onTyping,
    onConnectionChange: config.onConnectionChange,
    onError: config.onError
  });
}

/**
 * Generate a space token
 */
export async function generateToken(spaceId: string, options?: {
  gatewayKey?: string;
  expiryMs?: number;
}): Promise<string> {
  const env = getSpacesEnvironment();
  const gatewayKey = options?.gatewayKey || env.gatewayKey;

  if (!gatewayKey) {
    throw new Error('gatewayKey is required or set KURATCHI_SPACES_GATEWAY_KEY');
  }

  return generateSpaceToken(spaceId, gatewayKey, options?.expiryMs);
}

/**
 * Deploy the Spaces worker to Cloudflare
 */
export async function deploy(options?: {
  accountId?: string;
  apiToken?: string;
  gatewayKey?: string;
  scriptName?: string;
  verbose?: boolean;
}): Promise<any> {
  const { deploySpacesWorker } = await import('./deployment/deploy.js');
  return deploySpacesWorker(options);
}

/**
 * Get the worker template script
 */
export function getWorkerScript(): string {
  return CHAT_SPACE_WORKER_SCRIPT;
}
