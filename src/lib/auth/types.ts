import type { RequestEvent } from '@sveltejs/kit';

// Utility to allow sync or async returns
export type MaybePromise<T> = T | Promise<T>;

// Session cookie name
export const KURATCHI_SESSION_COOKIE = 'kuratchi_session';

// Session mutator context and type
export type SessionMutatorContext = {
  event: RequestEvent;
  locals: any;
  session: any;
};

export type SessionMutator = (context: SessionMutatorContext) => MaybePromise<void>;

// Route guard context and type
export type RouteGuardContext = {
  event: RequestEvent;
  locals: any;
  session: any;
};

export type RouteGuard = (context: RouteGuardContext) => MaybePromise<Response | void>;

// Env shape consumed by the auth handle
export type AuthHandleEnv = {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  ORIGIN?: string;
  RESEND_CLUTCHCMS_AUDIENCE?: string;
  KURATCHI_AUTH_SECRET: string;
  CLOUDFLARE_WORKERS_SUBDOMAIN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  KURATCHI_ADMIN_DB_NAME?: string;
  KURATCHI_ADMIN_DB_TOKEN?: string;
  KURATCHI_ADMIN_DB_ID?: string;
  KURATCHI_GATEWAY_KEY?: string;
  KURATCHI_DO_SCRIPT_NAME?: string;
};

// Options for creating auth handle
export interface CreateAuthHandleOptions {
  cookieName?: string;
  // Optional override to provide an admin DB client. Can be async.
  getAdminDb?: (event: RequestEvent) => MaybePromise<any>;
  // Optional override to provide env. Can be async. Defaults to $env/dynamic/private values.
  getEnv?: (event: RequestEvent) => MaybePromise<AuthHandleEnv>;
  // Optional: allow host app to provide its organization schema directly
  // Return either a DSL ({ name, tables: {...} }) or a normalized schema
  getOrganizationSchema?: (event: RequestEvent) => MaybePromise<any>;
  // Optional: allow host app to provide its admin schema directly
  // Return either a DSL ({ name, tables: {...} }) or a normalized schema
  getAdminSchema?: (event: RequestEvent) => MaybePromise<any>;
  // Optional hooks that run after session resolution and before guards
  sessionMutators?: SessionMutator[];
  // Optional guards that can short-circuit the response (redirect, error, etc.)
  guards?: RouteGuard[];
  // Optional KV namespace bindings from wrangler.toml
  // Maps friendly names to actual binding names
  // Example: { default: 'MY_KV', cache: 'CACHE_KV' }
  kvNamespaces?: Record<string, string>;
  // Optional R2 bucket bindings from wrangler.toml
  // Maps friendly names to actual binding names
  // Example: { default: 'MY_BUCKET', uploads: 'UPLOADS_BUCKET' }
  r2Buckets?: Record<string, string>;
  // Optional D1 database bindings from wrangler.toml
  // Maps friendly names to actual binding names
  // Example: { default: 'MY_DB', analytics: 'ANALYTICS_DB' }
  d1Databases?: Record<string, string>;
}

// Auth config for KuratchiAuth class
export interface AuthConfig {
  resendApiKey: string;
  emailFrom: string;
  origin: string;
  resendAudience?: string;
  authSecret: string;
  workersSubdomain: string;
  accountId: string;
  apiToken: string;
  // Admin DB credentials - will auto-create HTTP client
  adminDbName: string;
  adminDbToken: string;
  adminDbId: string;
  // Optional master gateway key for DO-backed org databases (required if using DO)
  gatewayKey?: string;
  // Optional: allow consumers to provide their own JSON schema DSLs
  // These should match the structure used by the runtime ORM (tables/columns)
  organizationSchema?: any;
  adminSchema?: any;
}
