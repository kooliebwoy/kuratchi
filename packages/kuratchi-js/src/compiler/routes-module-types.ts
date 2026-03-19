import type {
  AuthConfigEntry,
  DoConfigEntry,
  DoHandlerEntry,
  OrmDatabaseEntry,
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
  doConfig: DoConfigEntry[];
  doHandlers: DoHandlerEntry[];
  workflowConfig: WorkerClassConfigEntry[];
  isLayoutAsync: boolean;
  compiledLayoutActions: string | null;
  hasRuntime: boolean;
  runtimeImportPath?: string;
  assetsPrefix: string;
  runtimeContextImport: string;
  runtimeDoImport: string;
  runtimeWorkerImport: string;
}

export interface RoutesModuleFeatureBlocks {
  workerImport: string;
  contextImport: string;
  runtimeImport: string;
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
