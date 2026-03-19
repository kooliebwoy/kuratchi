export interface OrmDatabaseEntry {
  binding: string;
  schemaImportPath: string;
  schemaExportName: string;
  skipMigrations: boolean;
  type: 'd1' | 'do';
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

export interface DoHandlerEntry {
  fileName: string;
  absPath: string;
  binding: string;
  mode: 'class' | 'function';
  className?: string;
  classMethods: DoClassMethodEntry[];
  exportedFunctions: string[];
}

export function toSafeIdentifier(input: string): string {
  const normalized = input.replace(/[^A-Za-z0-9_$]/g, '_');
  return /^[A-Za-z_$]/.test(normalized) ? normalized : `_${normalized}`;
}
