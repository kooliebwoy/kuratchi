import type {
  AuthConfigEntry,
  DoConfigEntry,
  DoHandlerEntry,
  OrmDatabaseEntry,
  SecurityConfigEntry,
  WorkerClassConfigEntry,
} from './compiler-shared.js';

export interface CompiledAssetEntry {
  name: string;
  content: string;
  mime: string;
  etag: string;
}

export interface GenerateRoutesModuleOptions {
  projectDir: string;
  serverImports: string[];
  compiledRoutes: string[];
  compiledLayout: string | null;
  compiledComponents: string[];
  isDev: boolean;
  compiledAssets: CompiledAssetEntry[];
  compiledErrorPages: Map<number, string>;
  ormDatabases: OrmDatabaseEntry[];
  authConfig: AuthConfigEntry | null;
  securityConfig: SecurityConfigEntry;
  doConfig: DoConfigEntry[];
  doHandlers: DoHandlerEntry[];
  workflowConfig: WorkerClassConfigEntry[];
  isLayoutAsync: boolean;
  compiledLayoutActions: string | null;
  hasMiddleware: boolean;
  middlewareImportPath?: string;
  assetsPrefix: string;
  runtimeContextImport: string;
  runtimeDoImport: string;
  runtimeSchemaImport: string;
  runtimeWorkerImport: string;
}

export interface RoutesModuleFeatureBlocks {
  workerImport: string;
  contextImport: string;
  middlewareImport: string;
  migrationImports: string;
  migrationInit: string;
  authInit: string;
  authPluginImports: string;
  authPluginInit: string;
  doImports: string;
  doClassCode: string;
  doResolverInit: string;
  workflowStatusRpc: string;
}
