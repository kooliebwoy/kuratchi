export interface kuratchiAuthAdapterConfig {
  cookieName?: string;
  secretEnvKey?: string;
  sessionEnabled?: boolean;
  credentials?: Record<string, any>;
  activity?: Record<string, any>;
  roles?: Record<string, string[]>;
  oauth?: Record<string, any>;
  guards?: Record<string, any>;
  rateLimit?: Record<string, any>;
  turnstile?: Record<string, any>;
  organizations?: Record<string, any>;
}

export function kuratchiAuthConfig(config: kuratchiAuthAdapterConfig = {}): kuratchiAuthAdapterConfig {
  return {
    cookieName: 'kuratchi_session',
    secretEnvKey: 'AUTH_SECRET',
    sessionEnabled: true,
    ...config,
  };
}


