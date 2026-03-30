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
  /** Enable CSRF protection for actions and RPC (default: true) */
  csrfEnabled: boolean;
  /** CSRF cookie name (default: '__kuratchi_csrf') */
  csrfCookieName: string;
  /** CSRF header name for fetch requests (default: 'x-kuratchi-csrf') */
  csrfHeaderName: string;
  /** Require authentication for RPC calls (default: false) */
  rpcRequireAuth: boolean;
  /** Require authentication for form actions (default: false) */
  actionRequireAuth: boolean;
  /** Content Security Policy directive string (default: null - no CSP) */
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

export interface ConventionClassEntry {
  className: string;
  file: string;
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
