import * as path from 'node:path';

import { toSafeIdentifier } from './compiler-shared.js';
import type { GenerateRoutesModuleOptions, RoutesModuleFeatureBlocks } from './routes-module-types.js';

export function buildRoutesModuleFeatureBlocks(opts: GenerateRoutesModuleOptions): RoutesModuleFeatureBlocks {
  const workerImport = `import { env as __env } from 'cloudflare:workers';`;
  const contextImport = `import { __setRequestContext, __esc, __rawHtml, __sanitizeHtml, __setLocal, __getLocals, buildDefaultBreadcrumbs as __buildDefaultBreadcrumbs } from '${opts.runtimeContextImport}';`;
  const runtimeImport = opts.hasRuntime && opts.runtimeImportPath
    ? `import __kuratchiRuntime from '${opts.runtimeImportPath}';`
    : '';

  const authInit = buildAuthSessionInit(opts);
  const { migrationImports, migrationInit } = buildOrmMigrationBlock(opts);
  const { authPluginImports, authPluginInit } = buildAuthPluginBlock(opts);
  const { doImports, doClassCode, doResolverInit } = buildDurableObjectBlock(opts);
  const workflowStatusRpc = buildWorkflowStatusRpc(opts);

  return {
    workerImport,
    contextImport,
    runtimeImport,
    migrationImports,
    migrationInit,
    authInit,
    authPluginImports,
    authPluginInit,
    doImports,
    doClassCode,
    doResolverInit,
    workflowStatusRpc,
  };
}

function buildAuthSessionInit(opts: GenerateRoutesModuleOptions): string {
  if (!opts.authConfig?.sessionEnabled) return '';
  const cookieName = opts.authConfig.cookieName;
  return `
// Auth Session Init

function __parseCookies(header) {
  const map = {};
  if (!header) return map;
  for (const pair of header.split(';')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    map[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return map;
}

function __initAuth(request) {
  const cookies = __parseCookies(request.headers.get('cookie'));
  __setLocal('session', null);
  __setLocal('user', null);
  __setLocal('auth', {
    cookies,
    sessionCookie: cookies['${cookieName}'] || null,
    cookieName: '${cookieName}',
  });
}
`;
}

function buildOrmMigrationBlock(opts: GenerateRoutesModuleOptions): { migrationImports: string; migrationInit: string } {
  if (opts.ormDatabases.length === 0) {
    return { migrationImports: '', migrationInit: '' };
  }

  const schemaImports: string[] = [];
  const migrateEntries: string[] = [];

  for (const db of opts.ormDatabases) {
    const resolvedPath = db.schemaImportPath.replace(/^\.\//, '../');
    if (!db.skipMigrations && db.type === 'd1') {
      schemaImports.push(`import { ${db.schemaExportName} } from '${resolvedPath}';`);
      migrateEntries.push(`    { binding: '${db.binding}', schema: ${db.schemaExportName} }`);
    }
  }

  if (migrateEntries.length === 0) {
    return { migrationImports: '', migrationInit: '' };
  }

  return {
    migrationImports: [
      `import { runMigrations } from '@kuratchi/orm/migrations';`,
      `import { kuratchiORM } from '@kuratchi/orm';`,
      ...schemaImports,
    ].join('\n'),
    migrationInit: `
// ORM Auto-Migration

let __migrated = false;
const __ormDatabases = [
${migrateEntries.join(',\n')}
];

async function __runMigrations() {
  if (__migrated) return;
  __migrated = true;
  for (const db of __ormDatabases) {
    const binding = __env[db.binding];
    if (!binding) continue;
    try {
      const executor = (sql, params) => {
        let stmt = binding.prepare(sql);
        if (params?.length) stmt = stmt.bind(...params);
        return stmt.all().then(r => ({ success: r.success ?? true, data: r.results, results: r.results }));
      };
      const result = await runMigrations({ execute: executor, schema: db.schema });
      if (result.applied) {
        console.log('[kuratchi] ' + db.binding + ': migrated (' + result.statementsRun + ' statements)');
      }
      if (result.warnings.length) {
        result.warnings.forEach(w => console.warn('[kuratchi] ' + db.binding + ': ' + w));
      }
    } catch (err) {
      console.error('[kuratchi] ' + db.binding + ' migration failed:', err.message);
    }
  }
}
`,
  };
}

function buildAuthPluginBlock(opts: GenerateRoutesModuleOptions): { authPluginImports: string; authPluginInit: string } {
  const ac = opts.authConfig;
  if (!ac || !(ac.hasCredentials || ac.hasActivity || ac.hasRoles || ac.hasOAuth || ac.hasGuards || ac.hasRateLimit || ac.hasTurnstile || ac.hasOrganization)) {
    return { authPluginImports: '', authPluginInit: '' };
  }

  const imports: string[] = [`import __kuratchiConfig from '../kuratchi.config';`];
  const initLines: string[] = [];

  if (ac.hasCredentials) {
    imports.push(`import { configureCredentials as __configCreds } from '@kuratchi/auth';`);
    initLines.push(`  if (__kuratchiConfig.auth?.credentials) __configCreds(__kuratchiConfig.auth.credentials);`);
  }
  if (ac.hasActivity) {
    imports.push(`import { defineActivities as __defActivities } from '@kuratchi/auth';`);
    initLines.push(`  if (__kuratchiConfig.auth?.activity) __defActivities(__kuratchiConfig.auth.activity);`);
  }
  if (ac.hasRoles) {
    imports.push(`import { defineRoles as __defRoles } from '@kuratchi/auth';`);
    initLines.push(`  if (__kuratchiConfig.auth?.roles) __defRoles(__kuratchiConfig.auth.roles);`);
  }
  if (ac.hasOAuth) {
    imports.push(`import { configureOAuth as __configOAuth } from '@kuratchi/auth';`);
    initLines.push(`  if (__kuratchiConfig.auth?.oauth) {`);
    initLines.push(`    const oc = __kuratchiConfig.auth.oauth;`);
    initLines.push(`    const providers = {};`);
    initLines.push(`    if (oc.providers) {`);
    initLines.push(`      for (const [name, cfg] of Object.entries(oc.providers)) {`);
    initLines.push(`        providers[name] = { clientId: __env[cfg.clientIdEnv] || '', clientSecret: __env[cfg.clientSecretEnv] || '', scopes: cfg.scopes };`);
    initLines.push(`      }`);
    initLines.push(`    }`);
    initLines.push(`    __configOAuth({ providers, loginRedirect: oc.loginRedirect });`);
    initLines.push(`  }`);
  }
  if (ac.hasGuards) {
    imports.push(`import { configureGuards as __configGuards, checkGuard as __checkGuard } from '@kuratchi/auth';`);
    initLines.push(`  if (__kuratchiConfig.auth?.guards) __configGuards(__kuratchiConfig.auth.guards);`);
  }
  if (ac.hasRateLimit) {
    imports.push(`import { configureRateLimit as __configRL, checkRateLimit as __checkRL } from '@kuratchi/auth';`);
    initLines.push(`  if (__kuratchiConfig.auth?.rateLimit) __configRL(__kuratchiConfig.auth.rateLimit);`);
  }
  if (ac.hasTurnstile) {
    imports.push(`import { configureTurnstile as __configTS, checkTurnstile as __checkTS } from '@kuratchi/auth';`);
    initLines.push(`  if (__kuratchiConfig.auth?.turnstile) __configTS(__kuratchiConfig.auth.turnstile);`);
  }
  if (ac.hasOrganization) {
    imports.push(`import { configureOrganization as __configOrg } from '@kuratchi/auth';`);
    initLines.push(`  if (__kuratchiConfig.auth?.organizations) __configOrg(__kuratchiConfig.auth.organizations);`);
  }

  return {
    authPluginImports: imports.join('\n'),
    authPluginInit: `
// Auth Plugin Init

function __initAuthPlugins() {
${initLines.join('\n')}
}
`,
  };
}

function buildDurableObjectBlock(opts: GenerateRoutesModuleOptions): Pick<RoutesModuleFeatureBlocks, 'doImports' | 'doClassCode' | 'doResolverInit'> {
  if (opts.doConfig.length === 0 || opts.doHandlers.length === 0) {
    return { doImports: '', doClassCode: '', doResolverInit: '' };
  }

  const doImportLines: string[] = [];
  const doClassLines: string[] = [];
  const doResolverLines: string[] = [];

  doImportLines.push(`import { DurableObject as __DO } from 'cloudflare:workers';`);
  doImportLines.push(`import { initDO as __initDO } from '@kuratchi/orm';`);
  doImportLines.push(`import { __registerDoResolver, __registerDoClassBinding, __setDoContext } from '${opts.runtimeDoImport}';`);
  doImportLines.push(`const __DO_FD_TAG = '__kuratchi_form_data__';`);
  doImportLines.push(`function __isDoPlainObject(__v) {`);
  doImportLines.push(`  if (!__v || typeof __v !== 'object') return false;`);
  doImportLines.push(`  const __proto = Object.getPrototypeOf(__v);`);
  doImportLines.push(`  return __proto === Object.prototype || __proto === null;`);
  doImportLines.push(`}`);
  doImportLines.push(`function __decodeDoArg(__v) {`);
  doImportLines.push(`  if (Array.isArray(__v)) return __v.map(__decodeDoArg);`);
  doImportLines.push(`  if (__isDoPlainObject(__v)) {`);
  doImportLines.push(`    if (__DO_FD_TAG in __v) {`);
  doImportLines.push(`      const __fd = new FormData();`);
  doImportLines.push(`      const __entries = Array.isArray(__v[__DO_FD_TAG]) ? __v[__DO_FD_TAG] : [];`);
  doImportLines.push(`      for (const __pair of __entries) { if (Array.isArray(__pair) && __pair.length >= 2) __fd.append(String(__pair[0]), __pair[1]); }`);
  doImportLines.push(`      return __fd;`);
  doImportLines.push(`    }`);
  doImportLines.push(`    const __out = {};`);
  doImportLines.push(`    for (const [__k, __val] of Object.entries(__v)) __out[__k] = __decodeDoArg(__val);`);
  doImportLines.push(`    return __out;`);
  doImportLines.push(`  }`);
  doImportLines.push(`  return __v;`);
  doImportLines.push(`}`);
  doImportLines.push(`import { getCurrentUser as __getCU, getOrgStubByName as __getOSBN } from '@kuratchi/auth';`);

  const handlersByBinding = new Map<string, typeof opts.doHandlers>();
  for (const handler of opts.doHandlers) {
    const list = handlersByBinding.get(handler.binding) ?? [];
    list.push(handler);
    handlersByBinding.set(handler.binding, list);
  }

  for (const doEntry of opts.doConfig) {
    const handlers = handlersByBinding.get(doEntry.binding) ?? [];
    const ormDb = opts.ormDatabases.find((db) => db.binding === doEntry.binding);

    if (ormDb) {
      const schemaPath = ormDb.schemaImportPath.replace(/^\.\//, '../');
      doImportLines.push(`import { ${ormDb.schemaExportName} as __doSchema_${doEntry.binding} } from '${schemaPath}';`);
    }

    for (const handler of handlers) {
      let handlerImportPath = path
        .relative(path.join(opts.projectDir, '.kuratchi'), handler.absPath)
        .replace(/\\/g, '/')
        .replace(/\.ts$/, '.js');
      if (!handlerImportPath.startsWith('.')) handlerImportPath = './' + handlerImportPath;
      const handlerVar = `__handler_${toSafeIdentifier(handler.fileName)}`;
      doImportLines.push(`import ${handlerVar} from '${handlerImportPath}';`);
    }

    if (ormDb) {
      const handler = handlers[0];
      const handlerVar = handler ? `__handler_${toSafeIdentifier(handler.fileName)}` : '__DO';
      const baseClass = handler ? handlerVar : '__DO';
      doClassLines.push(...buildOrmDurableObjectClassLines(doEntry.className, doEntry.binding, baseClass));
    } else if (handlers.length > 0) {
      const handler = handlers[0];
      const handlerVar = `__handler_${toSafeIdentifier(handler.fileName)}`;
      doClassLines.push(`export { ${handlerVar} as ${doEntry.className} };`);
    }

    for (const handler of handlers) {
      const handlerVar = `__handler_${toSafeIdentifier(handler.fileName)}`;
      doResolverLines.push(`  __registerDoClassBinding(${handlerVar}, '${doEntry.binding}');`);
    }

    if (doEntry.stubId) {
      const fieldPath = doEntry.stubId.startsWith('user.') ? `__u.${doEntry.stubId.slice(5)}` : doEntry.stubId;
      const checkField = doEntry.stubId.startsWith('user.') ? doEntry.stubId.slice(5) : doEntry.stubId;
      doResolverLines.push(`  __registerDoResolver('${doEntry.binding}', async () => {`);
      doResolverLines.push(`    const __u = await __getCU();`);
      doResolverLines.push(`    if (!__u?.${checkField}) return null;`);
      doResolverLines.push(`    return __getOSBN(${fieldPath});`);
      doResolverLines.push(`  });`);
    } else {
      doResolverLines.push(`  // No 'stubId' config for ${doEntry.binding} - stub must be obtained manually`);
    }
  }

  return {
    doImports: doImportLines.join('\n'),
    doClassCode: `\n// Durable Object Classes (generated)\n\n${doClassLines.join('\n')}\n`,
    doResolverInit: `\nfunction __initDoResolvers() {\n${doResolverLines.join('\n')}\n}\n`,
  };
}

function buildOrmDurableObjectClassLines(className: string, binding: string, baseClass: string): string[] {
  return [
    `export class ${className} extends ${baseClass} {`,
    `  constructor(ctx, env) {`,
    `    super(ctx, env);`,
    `    this.db = __initDO(ctx.storage.sql, __doSchema_${binding});`,
    `  }`,
    `  async __kuratchiLogActivity(payload) {`,
    `    const now = new Date().toISOString();`,
    `    try {`,
    `      await this.db.activityLog.insert({`,
    `        userId: payload?.userId ?? null,`,
    `        action: payload?.action,`,
    `        detail: payload?.detail ?? null,`,
    `        ip: payload?.ip ?? null,`,
    `        userAgent: payload?.userAgent ?? null,`,
    `        createdAt: now,`,
    `        updatedAt: now,`,
    `      });`,
    `    } catch (err) {`,
    `      const msg = String((err && err.message) || err || '');`,
    `      if (!msg.includes('userId')) throw err;`,
    `      await this.db.activityLog.insert({`,
    `        action: payload?.action,`,
    `        detail: payload?.detail ?? null,`,
    `        ip: payload?.ip ?? null,`,
    `        userAgent: payload?.userAgent ?? null,`,
    `        createdAt: now,`,
    `        updatedAt: now,`,
    `      });`,
    `    }`,
    `  }`,
    `  async __kuratchiGetActivity(options = {}) {`,
    `    let query = this.db.activityLog;`,
    `    if (options?.action) query = query.where({ action: options.action });`,
    `    const result = await query.orderBy({ createdAt: 'desc' }).many();`,
    `    const rows = Array.isArray(result?.data) ? result.data : [];`,
    `    const limit = Number(options?.limit);`,
    `    if (Number.isFinite(limit) && limit > 0) return rows.slice(0, Math.floor(limit));`,
    `    return rows;`,
    `  }`,
    `}`,
  ];
}

function buildWorkflowStatusRpc(opts: GenerateRoutesModuleOptions): string {
  if (opts.workflowConfig.length === 0) return '';
  const rpcLines: string[] = [];
  rpcLines.push(`\n// Workflow Status RPCs (auto-generated)`);
  rpcLines.push(`const __workflowStatusRpc = {`);
  for (const workflow of opts.workflowConfig) {
    const baseName = workflow.file.split('/').pop()?.replace(/\.workflow\.ts$/, '') || '';
    const camelName = baseName.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const rpcName = `${camelName}WorkflowStatus`;
    rpcLines.push(`  '${rpcName}': async (instanceId) => {`);
    rpcLines.push(`    if (!instanceId) return { status: 'unknown', error: { name: 'Error', message: 'Missing instanceId' } };`);
    rpcLines.push(`    try {`);
    rpcLines.push(`      const instance = await __env.${workflow.binding}.get(instanceId);`);
    rpcLines.push(`      return await instance.status();`);
    rpcLines.push(`    } catch (err) {`);
    rpcLines.push(`      return { status: 'errored', error: { name: err?.name || 'Error', message: err?.message || 'Unknown error' } };`);
    rpcLines.push(`    }`);
    rpcLines.push(`  },`);
  }
  rpcLines.push(`};`);
  return rpcLines.join('\n');
}
