export interface OrmDatabaseEntry {
  binding: string;
  schemaImportPath: string;
  schemaExportName: string;
  skipMigrations: boolean;
  type: 'd1' | 'do';
  remote: boolean;
}

export interface AuthConfigEntry {
  cookieName: string;
  secretEnvKey: string;
  sessionEnabled: boolean;
  hasCredentials: boolean;
  hasActivity: boolean;
  hasRoles: boolean;
  hasOAuth: boolean;
  hasGuards: boolean;
  hasRateLimit: boolean;
  hasTurnstile: boolean;
  hasOrganization: boolean;
}

export interface SecurityConfigEntry {
  /**
   * Content Security Policy directive string (default: null). Use the literal `{NONCE}`
   * placeholder to opt into per-request nonces on framework-injected inline scripts.
   */
  contentSecurityPolicy: string | null;
  /** Strict-Transport-Security header (default: null - no HSTS) */
  strictTransportSecurity: string | null;
  /** Permissions-Policy header (default: null) */
  permissionsPolicy: string | null;
}

export interface DoConfigEntry {
  binding: string;
  className: string;
  stubId?: string;
  files?: string[];
}

export interface WorkerClassConfigEntry {
  binding: string;
  className: string;
  file: string;
  exportKind: 'named' | 'default';
}

/**
 * Tuning declared via `static` fields on a container/sandbox class.
 * All fields are optional; missing fields fall through to framework defaults
 * (or raise a compile-time error when no default is possible — e.g. a container
 * with no `image` declared).
 */
export interface ClassStaticTuning {
  /** Path to a Dockerfile (e.g. './docker/wordpress.Dockerfile') OR a registry image reference (e.g. 'docker.io/cloudflare/sandbox:0.8.11'). */
  image?: string;
  /** Cloudflare Containers instance size. */
  instanceType?: 'lite' | 'standard';
  /** Concurrent container cap. */
  maxInstances?: number;
  /** Opt container into SQLite-backed Durable Object storage (adds `new_sqlite_classes` migration). Sandbox classes are always SQLite-backed. */
  sqlite?: boolean;
}

export interface ContainerConfigEntry extends WorkerClassConfigEntry, ClassStaticTuning {
  /** Discriminator so wrangler-sync can apply primitive-specific defaults. */
  kind: 'container' | 'sandbox';
  /** Required once discovery has resolved author-declared field → sibling Dockerfile → per-kind default. */
  image: string;
  /** Resolved absolute path to a local Dockerfile if one was detected, else `null`. Used for change-tracking / validation. */
  resolvedDockerfile?: string | null;
}

export interface ConventionClassEntry {
  className: string;
  file: string;
  exportKind: 'named' | 'default';
}

export interface QueueConsumerEntry {
  /** Queue binding name derived from filename (e.g., NOTIFICATIONS from notifications.queue.ts) */
  binding: string;
  /** Queue name for Cloudflare (lowercase with hyphens, e.g., notifications from notifications.queue.ts) */
  queueName: string;
  /** Relative file path from project root */
  file: string;
  /** Whether the handler is exported as default or named */
  exportKind: 'named' | 'default';
}

export interface DoClassMethodEntry {
  name: string;
  visibility: 'public' | 'private' | 'protected';
  isStatic: boolean;
  isAsync: boolean;
  hasWorkerContextCalls: boolean;
  callsThisMethods: string[];
}

export interface DoClassContributorEntry {
  /** Absolute path to the contributor source file */
  absPath: string;
  /** Exported class name */
  className: string;
  /** Whether the class is exported as named or default */
  exportKind: 'named' | 'default';
  /** Own methods declared on this contributor */
  classMethods: DoClassMethodEntry[];
  /** Inheritance depth from the base DO class (1 = direct child) */
  depth: number;
}

export interface ExportedClassEntry {
  className: string;
  exportKind: 'named' | 'default';
}

export interface RelativeImportClassEntry {
  source: string;
  importedName: string | 'default';
}

export interface DoHandlerEntry {
  fileName: string;
  absPath: string;
  binding: string;
  mode: 'class' | 'function';
  className?: string;
  exportKind?: 'named' | 'default';
  classMethods: DoClassMethodEntry[];
  /** Additional exported classes in the same DO folder that extend this base DO class */
  classContributors: DoClassContributorEntry[];
  exportedFunctions: string[];
}

export function toSafeIdentifier(input: string): string {
  const normalized = input.replace(/[^A-Za-z0-9_$]/g, '_');
  return /^[A-Za-z_$]/.test(normalized) ? normalized : `_${normalized}`;
}
