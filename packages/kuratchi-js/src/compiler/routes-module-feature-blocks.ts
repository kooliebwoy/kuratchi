import * as path from 'node:path';

import { toSafeIdentifier } from './compiler-shared.js';
import type { GenerateRoutesModuleOptions, RoutesModuleFeatureBlocks } from './routes-module-types.js';

export function buildRoutesModuleFeatureBlocks(opts: GenerateRoutesModuleOptions): RoutesModuleFeatureBlocks {
  const workerImport = `import { env as __env } from 'cloudflare:workers';`;
  const contextImport = `import { __setRequestContext, __pushRequestContext, __esc, __rawHtml, __sanitizeHtml, __setLocal, __getLocals, __getCsrfToken, __signFragment, buildDefaultBreadcrumbs as __buildDefaultBreadcrumbs } from '${opts.runtimeContextImport}';`;
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
  doImportLines.push(`import { validateSchemaInput as __validateSchemaInput } from '${opts.runtimeSchemaImport}';`);
  doImportLines.push(`const __DO_FD_TAG = '__kuratchi_form_data__';`);
  doImportLines.push(`const __DO_RPC_CTX_TAG = '__kuratchi_rpc_context__';`);
  doImportLines.push(`const __DO_RPC_RESULT_TAG = '__kuratchi_rpc_result__';`);
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
  doImportLines.push(`function __extractDoRpcContext(__args) {`);
  doImportLines.push(`  if (!Array.isArray(__args) || __args.length === 0) return { args: __args, context: null };`);
  doImportLines.push(`  const __tail = __args[__args.length - 1];`);
  doImportLines.push(`  if (!__isDoPlainObject(__tail) || !(__DO_RPC_CTX_TAG in __tail)) return { args: __args, context: null };`);
  doImportLines.push(`  return { args: __args.slice(0, -1), context: __tail[__DO_RPC_CTX_TAG] || null };`);
  doImportLines.push(`}`);
  doImportLines.push(`function __wrapDoRpcResult(__value) {`);
  doImportLines.push(`  const __locals = __getLocals();`);
  doImportLines.push(`  return { [__DO_RPC_RESULT_TAG]: { value: __value, effects: { redirectTo: __locals.__redirectTo ?? null, redirectStatus: __locals.__redirectStatus ?? null, setCookieHeaders: Array.isArray(__locals.__setCookieHeaders) ? __locals.__setCookieHeaders : [] } } };`);
  doImportLines.push(`}`);
  doImportLines.push(`function __invokeDoRpc(__self, __methodName, __fn, __args) {`);
  doImportLines.push(`  __setDoContext(__self);`);
  doImportLines.push(`  const { args: __callArgs, context: __rpcContext } = __extractDoRpcContext(__args);`);
  doImportLines.push(`  const __decoded = (__callArgs ?? []).map(__decodeDoArg);`);
  doImportLines.push(`  const __schema = __self?.constructor?.schemas?.[__methodName];`);
  doImportLines.push(`  const __validated = __validateSchemaInput(__schema, __decoded);`);
  doImportLines.push(`  if (!__rpcContext) return __fn.apply(__self, __validated);`);
  doImportLines.push(`  const __restore = __pushRequestContext(__rpcContext, __self.ctx, __self.env);`);
  doImportLines.push(`  const __finish = (__value) => __wrapDoRpcResult(__value);`);
  doImportLines.push(`  const __fail = (__err) => { if (__err && __err.isRedirectError) return __wrapDoRpcResult(undefined); throw __err; };`);
  doImportLines.push(`  try {`);
  doImportLines.push(`    const __result = __fn.apply(__self, __validated);`);
  doImportLines.push(`    if (__result && typeof __result.then === 'function') {`);
  doImportLines.push(`      return __result.then(__finish, __fail).finally(__restore);`);
  doImportLines.push(`    }`);
  doImportLines.push(`    const __wrapped = __finish(__result);`);
  doImportLines.push(`    __restore();`);
  doImportLines.push(`    return __wrapped;`);
  doImportLines.push(`  } catch (__err) {`);
  doImportLines.push(`    try { return __fail(__err); } finally { __restore(); }`);
  doImportLines.push(`  }`);
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
    const fnHandlers = handlers.filter((h) => h.mode === 'function');
    const initHandlers = fnHandlers.filter((h) => h.exportedFunctions.includes('onInit'));
    const alarmHandlers = fnHandlers.filter((h) => h.exportedFunctions.includes('onAlarm'));
    const messageHandlers = fnHandlers.filter((h) => h.exportedFunctions.includes('onMessage'));

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
      if (handler.mode === 'class') {
        if (handler.exportKind === 'named' && handler.className) {
          doImportLines.push(`import { ${handler.className} as ${handlerVar} } from '${handlerImportPath}';`);
        } else {
          doImportLines.push(`import ${handlerVar} from '${handlerImportPath}';`);
        }
        for (const [index, contributor] of (handler.classContributors ?? []).entries()) {
          let contributorImportPath = path
            .relative(path.join(opts.projectDir, '.kuratchi'), contributor.absPath)
            .replace(/\\/g, '/')
            .replace(/\.ts$/, '.js');
          if (!contributorImportPath.startsWith('.')) contributorImportPath = './' + contributorImportPath;
          const contributorVar = `__handler_${toSafeIdentifier(`${handler.fileName}__${contributor.className}_${index}`)}`;
          if (contributor.exportKind === 'named') {
            doImportLines.push(`import { ${contributor.className} as ${contributorVar} } from '${contributorImportPath}';`);
          } else {
            doImportLines.push(`import ${contributorVar} from '${contributorImportPath}';`);
          }
        }
      } else {
        doImportLines.push(`import * as ${handlerVar} from '${handlerImportPath}';`);
      }
    }

    // Generate the DO class
    doClassLines.push(`export class ${doEntry.className} extends __DO {`);
    doClassLines.push(`  constructor(ctx, env) {`);
    doClassLines.push(`    super(ctx, env);`);
    if (ormDb) {
      doClassLines.push(`    this.db = __initDO(ctx.storage.sql, __doSchema_${doEntry.binding});`);
    }
    for (const handler of handlers.filter((h) => h.mode === 'class')) {
      const handlerVar = `__handler_${toSafeIdentifier(handler.fileName)}`;
      const handlerInstanceVar = `__instance_${toSafeIdentifier(handler.fileName)}`;
      doClassLines.push(`    const ${handlerInstanceVar} = new ${handlerVar}(ctx, env);`);
      doClassLines.push(`    Object.assign(this, ${handlerInstanceVar});`);
    }
    for (const handler of initHandlers) {
      const handlerVar = `__handler_${toSafeIdentifier(handler.fileName)}`;
      doClassLines.push(`    __setDoContext(this);`);
      doClassLines.push(`    Promise.resolve(${handlerVar}.onInit.call(this)).catch((err) => console.error('[KuratchiJS] DO onInit failed:', err?.message || err));`);
    }
    doClassLines.push(`  }`);
    if (ormDb) {
      doClassLines.push(...buildOrmDoActivityLogLines(doEntry.binding));
    }
    if (alarmHandlers.length > 0) {
      doClassLines.push(`  async alarm(...args) {`);
      doClassLines.push(`    __setDoContext(this);`);
      for (const handler of alarmHandlers) {
        const handlerVar = `__handler_${toSafeIdentifier(handler.fileName)}`;
        doClassLines.push(`    await ${handlerVar}.onAlarm.call(this, ...args);`);
      }
      doClassLines.push(`  }`);
    }
    if (messageHandlers.length > 0) {
      doClassLines.push(`  webSocketMessage(...args) {`);
      doClassLines.push(`    __setDoContext(this);`);
      for (const handler of messageHandlers) {
        const handlerVar = `__handler_${toSafeIdentifier(handler.fileName)}`;
        doClassLines.push(`    ${handlerVar}.onMessage.call(this, ...args);`);
      }
      doClassLines.push(`  }`);
    }
    doClassLines.push(`  static schemas = {};`);
    doClassLines.push(`}`);

    // Apply prototype methods from each class handler (and its contributors) onto the generated class
    for (const handler of handlers) {
      const handlerVar = `__handler_${toSafeIdentifier(handler.fileName)}`;
      if (handler.mode === 'class') {
        const classSourceVars = [
          handlerVar,
          ...(handler.classContributors ?? []).map((c, i) => `__handler_${toSafeIdentifier(`${handler.fileName}__${c.className}_${i}`)}`),
        ];
        doClassLines.push(`{`);
        doClassLines.push(`  for (const __source of [${classSourceVars.join(', ')}]) {`);
        doClassLines.push(`    const __seen = new Set();`);
        doClassLines.push(`    for (let __p = __source.prototype; __p && __p !== __DO.prototype && __p !== Object.prototype; __p = Object.getPrototypeOf(__p)) {`);
        doClassLines.push(`      for (const __k of Object.getOwnPropertyNames(__p)) {`);
        doClassLines.push(`        if (__k === 'constructor' || __seen.has(__k)) continue;`);
        doClassLines.push(`        const __desc = Object.getOwnPropertyDescriptor(__p, __k);`);
        doClassLines.push(`        const __fn = __desc?.value;`);
        doClassLines.push(`        if (typeof __fn !== 'function') continue;`);
        doClassLines.push(`        __seen.add(__k);`);
        doClassLines.push(`        ${doEntry.className}.prototype[__k] = function(...__a){ return __invokeDoRpc(this, __k, __fn, __a); };`);
        doClassLines.push(`      }`);
        doClassLines.push(`    }`);
        doClassLines.push(`  }`);
        doClassLines.push(`}`);
        doClassLines.push(`Object.assign(${doEntry.className}.schemas, ${handlerVar}.schemas || {});`);
        for (const [index] of (handler.classContributors ?? []).entries()) {
          const contributorVar = `__handler_${toSafeIdentifier(`${handler.fileName}__${handler.classContributors[index].className}_${index}`)}`;
          doClassLines.push(`Object.assign(${doEntry.className}.schemas, ${contributorVar}.schemas || {});`);
        }
        doResolverLines.push(`  __registerDoClassBinding(${handlerVar}, '${doEntry.binding}');`);
      } else {
        const lifecycle = new Set(['onInit', 'onAlarm', 'onMessage']);
        for (const fn of handler.exportedFunctions) {
          if (lifecycle.has(fn)) continue;
          doClassLines.push(`${doEntry.className}.prototype[${JSON.stringify(fn)}] = function(...__a){ return __invokeDoRpc(this, ${JSON.stringify(fn)}, ${handlerVar}.${fn}, __a); };`);
        }
        doClassLines.push(`Object.assign(${doEntry.className}.schemas, ${handlerVar}.schemas || {});`);
      }
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
      doResolverLines.push(`  __registerDoResolver('${doEntry.binding}', async () => {`);
      doResolverLines.push(`    const __ns = __env['${doEntry.binding}'];`);
      doResolverLines.push(`    if (!__ns?.idFromName || !__ns?.get) return null;`);
      doResolverLines.push(`    return __ns.get(__ns.idFromName('global'));`);
      doResolverLines.push(`  });`);
    }
  }

  return {
    doImports: doImportLines.join('\n'),
    doClassCode: `\n// Durable Object Classes (generated)\n\n${doClassLines.join('\n')}\n`,
    doResolverInit: `\nfunction __initDoResolvers() {\n${doResolverLines.join('\n')}\n}\n`,
  };
}

function buildOrmDoActivityLogLines(binding: string): string[] {
  return [
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
  ];
  void binding;
}

function buildWorkflowStatusRpc(opts: GenerateRoutesModuleOptions): string {
  if (opts.workflowConfig.length === 0) return '';
  const rpcLines: string[] = [];
  rpcLines.push(`\n// Workflow Status RPCs (auto-generated)`);
  rpcLines.push(`// AsyncValue helper for workflow status with polling support`);
  rpcLines.push(`function __createAsyncValue(value, state) {`);
  rpcLines.push(`  if (value && typeof value === 'object') {`);
  rpcLines.push(`    value.pending = state.pending;`);
  rpcLines.push(`    value.error = state.error;`);
  rpcLines.push(`    value.success = state.success;`);
  rpcLines.push(`    return value;`);
  rpcLines.push(`  }`);
  rpcLines.push(`  return { ...state, value };`);
  rpcLines.push(`}`);
  rpcLines.push(``);
  rpcLines.push(`const __workflowStatusRpc = {`);
  const rpcNames: string[] = [];
  for (const workflow of opts.workflowConfig) {
    const baseName = workflow.file.split('/').pop()?.replace(/\.workflow\.ts$/, '') || '';
    const camelName = baseName.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const rpcName = `${camelName}WorkflowStatus`;
    rpcNames.push(rpcName);
    rpcLines.push(`  '${rpcName}': async (instanceId) => {`);
    rpcLines.push(`    if (!instanceId) return __createAsyncValue({ status: 'unknown' }, { pending: false, error: 'Missing instanceId', success: false });`);
    rpcLines.push(`    try {`);
    rpcLines.push(`      const instance = await __env.${workflow.binding}.get(instanceId);`);
    rpcLines.push(`      const result = await instance.status();`);
    rpcLines.push(`      return __createAsyncValue(result, { pending: false, error: null, success: true });`);
    rpcLines.push(`    } catch (err) {`);
    rpcLines.push(`      return __createAsyncValue({ status: 'errored' }, { pending: false, error: err?.message || 'Unknown error', success: false });`);
    rpcLines.push(`    }`);
    rpcLines.push(`  },`);
  }
  rpcLines.push(`};`);
  rpcLines.push(``);
  // Export individual functions that support polling options
  for (const rpcName of rpcNames) {
    rpcLines.push(`function ${rpcName}(instanceId, options) {`);
    rpcLines.push(`  const fetchStatus = () => __workflowStatusRpc['${rpcName}'](instanceId);`);
    rpcLines.push(`  if (options && options.poll) {`);
    rpcLines.push(`    // Return a polling AsyncValue - the template compiler handles the polling`);
    rpcLines.push(`    const result = { pending: true, error: null, success: false, __polling: true, __pollInterval: options.poll, __pollUntil: options.until, __fetchFn: fetchStatus };`);
    rpcLines.push(`    return result;`);
    rpcLines.push(`  }`);
    rpcLines.push(`  // Non-polling: return a promise that resolves to AsyncValue`);
    rpcLines.push(`  return fetchStatus();`);
    rpcLines.push(`}`);
  }
  return rpcLines.join('\n');
}
