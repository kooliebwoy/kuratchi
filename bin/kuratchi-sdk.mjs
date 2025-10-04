#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

// ESM-compatible __filename/__dirname for module-scope usage (needed by loadEnvFiles)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

// Minimal .env loader (no external deps). Loads if present; later values do not overwrite existing process.env
function parseEnvFile(contents) {
  const out = {};
  const lines = contents.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith('\'') && val.endsWith('\''))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEnvFiles() {
  const cwd = process.cwd();
  const roots = [cwd, path.resolve(__dirname, '..')];
  const files = ['.env', '.env.local'];
  for (const root of roots) {
    for (const f of files) {
      const p = path.join(root, f);
      if (fs.existsSync(p)) {
        try {
          const parsed = parseEnvFile(fs.readFileSync(p, 'utf8'));
          for (const [k, v] of Object.entries(parsed)) {
            if (process.env[k] == null) process.env[k] = String(v);
          }
        } catch {}
      }
    }
  }
}
function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = (i + 1 < argv.length && !argv[i + 1].startsWith('--')) ? argv[++i] : 'true';
      args[key] = val;
    } else {
      args._.push(a);
    }
  }
  return args;
}

async function importFromCandidates(cands) {
  for (const c of cands) {
    try {
      const mod = await import(pathToFileURL(c).href);
      return mod;
    } catch (_) { /* try next */ }
  }
  return null;
}

// Try to import TypeScript from the caller project (optional)
async function tryImportTypescript() {
  try {
    const ts = await import('typescript');
    return ts;
  } catch {
    return null;
  }
}

// Transpile a .ts file into a temporary ESM module; returns path to .mjs
async function transpileTsFileToEsmTemp(tsPath, tempRootOverride) {
  const ts = await tryImportTypescript();
  if (!ts) return null;
  const src = fs.readFileSync(tsPath, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.Preserve,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      sourceMap: false,
      esModuleInterop: true,
    },
    fileName: tsPath,
    reportDiagnostics: false,
  });
  const tmpRoot = tempRootOverride || path.join(process.cwd(), '.kuratchi-tmp');
  ensureDir(tmpRoot);
  const file = path.join(tmpRoot, `schema-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(file, out.outputText, 'utf8');
  return file;
}

// Given a schema path, return an importable .js/.mjs path, transpiling TS if necessary
async function resolveImportableSchemaPath(schemaPath, tempRootOverride) {
  if (!schemaPath) return null;
  if (schemaPath.endsWith('.ts')) {
    const neighbors = [
      schemaPath.replace(/\.ts$/, '.mjs'),
      schemaPath.replace(/\.ts$/, '.js'),
      schemaPath.includes(path.sep + 'src' + path.sep)
        ? schemaPath.replace(path.sep + 'src' + path.sep, path.sep + 'dist' + path.sep).replace(/\.ts$/, '.js')
        : null,
    ].filter(Boolean);
    for (const m of neighbors) { if (m && fs.existsSync(m)) return m; }
    const t = await transpileTsFileToEsmTemp(schemaPath, tempRootOverride);
    if (t) return t;
    return null;
  }
  return schemaPath;
}

async function loadNormalizeAndSqlGenerators() {
  // Resolve relative to the installed CLI package directory
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const pkgRoot = path.resolve(__dirname, '..');
  const cands = [
    path.join(pkgRoot, 'dist', 'lib', 'orm', 'normalize.js'),
    path.join(pkgRoot, 'dist', 'orm', 'normalize.js'),
    path.join(pkgRoot, 'dist', 'index.js'),
  ];
  const normMod = await importFromCandidates(cands);
  if (!normMod) throw new Error('normalizeSchema not available. Build the package first (npm run build).');
  const normalizeSchema = normMod.normalizeSchema || normMod.default?.normalizeSchema || normMod.normalize?.normalizeSchema;
  if (typeof normalizeSchema !== 'function') throw new Error('normalizeSchema not found in dist. Build the package (npm run build).');

  const sqlCands = [
    path.join(pkgRoot, 'dist', 'lib', 'orm', 'sqlite-generator.js'),
    path.join(pkgRoot, 'dist', 'orm', 'sqlite-generator.js'),
    path.join(pkgRoot, 'dist', 'index.js'),
  ];
  const sqlMod = await importFromCandidates(sqlCands);
  const buildInitialSql = sqlMod?.buildInitialSql || sqlMod?.default?.buildInitialSql;
  if (typeof buildInitialSql !== 'function') throw new Error('buildInitialSql not found in dist. Build the package (npm run build).');
  
  const diffCands = [
    path.join(pkgRoot, 'dist', 'lib', 'orm', 'diff.js'),
    path.join(pkgRoot, 'dist', 'orm', 'diff.js'),
    path.join(pkgRoot, 'dist', 'index.js'),
  ];
  const diffMod = await importFromCandidates(diffCands);
  const buildDiffSql = diffMod?.buildDiffSql || diffMod?.default?.buildDiffSql;
  if (typeof buildDiffSql !== 'function') throw new Error('buildDiffSql not found in dist. Build the package (npm run build).');

  return { normalizeSchema, buildInitialSql, buildDiffSql };
}

async function loadSchemaModule(schemaFile, tempRootOverride) {
  const given = path.isAbsolute(schemaFile) ? schemaFile : path.join(process.cwd(), schemaFile);
  const importable = await resolveImportableSchemaPath(given, tempRootOverride);
  if (!importable || !fs.existsSync(importable)) throw new Error(`Schema file not found or not importable: ${schemaFile}`);
  const mod = await import(pathToFileURL(importable).href);
  // Direct hits first
  const direct = mod.schema || mod.default;
  if (direct && typeof direct === 'object' && direct.tables && typeof direct.tables === 'object') return direct;
  // Heuristic: any named export that looks like a schema (has tables object)
  for (const [k, v] of Object.entries(mod)) {
    if (v && typeof v === 'object' && v.tables && typeof v.tables === 'object') return v;
  }
  const keys = Object.keys(mod);
  throw new Error(`Could not find a schema-like export in ${schemaFile}. Export a constant like 'export const schema = { name: "...", tables: { ... } }'. Found exports: ${keys.join(', ') || '(none)'}`);
}

async function cmdGenerateMigrations(args) {
  const schemaFile = args.schema || args.schemaFile;
  if (!schemaFile) {
    console.error('Usage: kuratchi-sdk generate-migrations --schema <path/to/schema.(js|mjs)> [--outDir <dir>] [--tag <tag>] [--fromSchema <path>]');
    process.exit(1);
  }

  const { normalizeSchema, buildInitialSql, buildDiffSql } = await loadNormalizeAndSqlGenerators();
  // Determine schema name first to compute outDir
  const prelimDsl = await loadSchemaModule(schemaFile, undefined);
  const prelimSchema = normalizeSchema(prelimDsl);
  const schemaName = prelimSchema.name || 'schema';
  const outDir = args.outDir || path.join(process.cwd(), `migrations-${schemaName}`);
  // Use outDir/schema/.tmp for transient transpiled modules
  const tempRoot = path.join(outDir, 'schema', '.tmp');
  const dsl = await loadSchemaModule(schemaFile, tempRoot);
  const schema = normalizeSchema(dsl);
  const tag = args.tag || `m_${Date.now()}`;

  ensureDir(outDir);
  const metaDir = path.join(outDir, 'meta');
  ensureDir(metaDir);

  const snapshotPath = path.join(metaDir, '_schema.json');
  const journalPath = path.join(metaDir, '_journal.json');

  // Determine index
  let journal = { entries: [] };
  if (fs.existsSync(journalPath)) {
    try { journal = readJson(journalPath); } catch { journal = { entries: [] }; }
  }
  const nextIdx = (journal.entries?.[journal.entries.length - 1]?.idx || 0) + 1;

  // Build SQL: diff if fromSchema provided or snapshot exists; otherwise initial
  let sql = '';
  let warnings = [];
  let usedSnapshot = false;
  if (args.fromSchema) {
    const fromDsl = await loadSchemaModule(args.fromSchema, tempRoot);
    const fromSchema = normalizeSchema(fromDsl);
    const diff = buildDiffSql(fromSchema, schema);
    sql = diff.sql;
    warnings = diff.warnings || [];
  } else if (fs.existsSync(snapshotPath)) {
    const fromSchema = readJson(snapshotPath);
    const diff = buildDiffSql(fromSchema, schema);
    sql = diff.sql;
    warnings = diff.warnings || [];
    usedSnapshot = true;
  } else {
    sql = buildInitialSql(schema);
  }

  if (!sql || !sql.trim()) {
    fs.writeFileSync(snapshotPath, JSON.stringify(schema, null, 2), 'utf8');
    console.log(JSON.stringify({ ok: true, outDir, tag, skipped: true, reason: 'No statements generated', warnings, snapshotPath, usedSnapshot }, null, 2));
    return;
  }

  const sqlFile = path.join(outDir, `${tag}.sql`);
  fs.writeFileSync(sqlFile, sql, 'utf8');

  // Update journal and snapshot
  const next = { idx: nextIdx, tag };
  journal.entries = [...(journal.entries || []), next];
  fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2), 'utf8');
  fs.writeFileSync(snapshotPath, JSON.stringify(schema, null, 2), 'utf8');

  console.log(JSON.stringify({ ok: true, outDir, tag, sqlFile, journalPath, snapshotPath, idx: nextIdx, warnings, usedSnapshot }, null, 2));
}

async function loadKuratchiDatabase() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const pkgRoot = path.resolve(__dirname, '..');
  const cands = [
    path.join(pkgRoot, 'dist', 'lib', 'database', 'kuratchi-database.js'),
    path.join(pkgRoot, 'dist', 'database', 'kuratchi-database.js'),
    path.join(pkgRoot, 'dist', 'index.js'),
  ];
  const mod = await importFromCandidates(cands);
  if (!mod) throw new Error('KuratchiDatabase not available. Build the package first (npm run build).');
  const KuratchiDatabase = mod.KuratchiDatabase || mod.default?.KuratchiDatabase;
  if (typeof KuratchiDatabase !== 'function') throw new Error('KuratchiDatabase not found in dist. Build the package (npm run build).');
  return { KuratchiDatabase };
}

async function loadAdminSchemaDsl() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const pkgRoot = path.resolve(__dirname, '..');
  const cands = [
    path.join(pkgRoot, 'dist', 'lib', 'schema', 'admin.js'),
    path.join(pkgRoot, 'dist', 'schema', 'admin.js'),
    path.join(pkgRoot, 'dist', 'index.js'),
  ];
  const mod = await importFromCandidates(cands);
  if (!mod) throw new Error('admin schema not available. Build the package first (npm run build).');
  const adminSchemaDsl = mod.adminSchemaDsl || mod.default?.adminSchemaDsl || mod.schema?.adminSchemaDsl || mod.admin?.adminSchemaDsl;
  if (!adminSchemaDsl || typeof adminSchemaDsl !== 'object') throw new Error('adminSchemaDsl not found in dist. Build the package (npm run build).');
  return { adminSchemaDsl };
}

async function cmdInitAdminDb(args) {
  const name = args.name || args.databaseName || args.dbName || process.env.KURATCHI_ADMIN_DB_NAME || 'kuratchi-admin';
  const gatewayKey = args.gatewayKey || args.apiKey || process.env.KURATCHI_GATEWAY_KEY || process.env.GATEWAY_KEY;
  const workersSubdomain = args.workersSubdomain || process.env.KURATCHI_CLOUDFLARE_WORKERS_SUBDOMAIN || process.env.CLOUDFLARE_WORKERS_SUBDOMAIN || process.env.WORKERS_SUBDOMAIN;
  const accountId = args.accountId || process.env.KURATCHI_CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
  const apiToken = args.apiToken || process.env.KURATCHI_CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
  const scriptName = args.scriptName || 'kuratchi-do-internal';
  const migrate = args.migrate === 'false' ? false : true;
  const debug = args.debug === 'true' || args.debug === true;

  if (debug) {
    const mask = (v) => (v ? (String(v).length <= 6 ? '******' : `${String(v).slice(0, 3)}***${String(v).slice(-3)}`) : undefined);
    console.log(JSON.stringify({
      debug: true,
      resolved: {
        name,
        workersSubdomain,
        accountId,
        scriptName,
        migrate,
        gatewayKey: mask(gatewayKey),
        apiToken: mask(apiToken),
      }
    }, null, 2));
  }

  const missing = [];
  if (!gatewayKey) missing.push('KURATCHI_GATEWAY_KEY/GATEWAY_KEY or --gatewayKey');
  if (!workersSubdomain) missing.push('(KURATCHI_)CLOUDFLARE_WORKERS_SUBDOMAIN/WORKERS_SUBDOMAIN or --workersSubdomain');
  if (!accountId) missing.push('(KURATCHI_)CLOUDFLARE_ACCOUNT_ID/CF_ACCOUNT_ID or --accountId');
  if (!apiToken) missing.push('(KURATCHI_)CLOUDFLARE_API_TOKEN/CF_API_TOKEN or --apiToken');
  if (missing.length) {
    console.error(`Missing required config: ${missing.join(', ')}`);
    console.error('Usage: kuratchi-sdk init-admin-db [--name <dbName>] [--gatewayKey <key>] [--workersSubdomain <subdomain>] [--accountId <id>] [--apiToken <token>] [--scriptName <name>] [--migrate <true|false>]');
    process.exit(1);
  }

  const { KuratchiDatabase } = await loadKuratchiDatabase();
  const { adminSchemaDsl } = await loadAdminSchemaDsl();

  const doClient = new KuratchiDatabase({
    accountId,
    apiToken,
    workersSubdomain,
    scriptName,
  });

  let res;
  try {
    res = await doClient.createDatabase({ databaseName: name, gatewayKey, migrate, schema: adminSchemaDsl });
  } catch (err) {
    if (args.migrate !== 'false') {
      console.warn(`[kuratchi-sdk] Migration failed on init-admin-db, retrying without migration...\n  Reason: ${err?.message || err}`);
      res = await doClient.createDatabase({ databaseName: name, gatewayKey, migrate: false, schema: adminSchemaDsl });
    } else {
      throw err;
    }
  }
  console.log(JSON.stringify({ ok: true, databaseName: res.databaseName, token: res.token }, null, 2));
}

async function cmdRefreshAdminToken(args) {
  const mask = (s) => s ? s.slice(0, 8) + '***' : undefined;
  const name = args.name || process.env.KURATCHI_ADMIN_DB_NAME || 'kuratchi-admin';
  const gatewayKey = args.gatewayKey || process.env.KURATCHI_GATEWAY_KEY || process.env.GATEWAY_KEY;
  const debug = args.debug === 'true';

  if (debug) {
    console.log('[kuratchi-sdk refresh-admin-token] Config:', JSON.stringify({
      name,
      gatewayKey: mask(gatewayKey),
    }, null, 2));
  }

  if (!gatewayKey) {
    console.error('Missing required config: KURATCHI_GATEWAY_KEY/GATEWAY_KEY or --gatewayKey');
    console.error('Usage: kuratchi-sdk refresh-admin-token [--name <dbName>] [--gatewayKey <key>]');
    process.exit(1);
  }

  const { createSignedDbToken } = await import('../dist/utils/token.js');
  
  // Generate new admin token with 100-year TTL (essentially permanent)
  const newToken = await createSignedDbToken(
    name, 
    gatewayKey,
    100 * 365 * 24 * 60 * 60 * 1000 // 100 years
  );

  console.log(JSON.stringify({ 
    ok: true, 
    databaseName: name, 
    token: newToken,
    message: 'Update KURATCHI_ADMIN_DB_TOKEN in your environment with this new token'
  }, null, 2));
}

async function main() {
  // Auto-load .env unless explicitly disabled
  if (process.env.KURATCHI_SKIP_DOTENV !== 'true') {
    try { loadEnvFiles(); } catch {}
  }
  const args = parseArgs(process.argv);
  const cmd = args._[0];
  if (!cmd || cmd === 'help' || args.help) {
    console.log(`kuratchi-sdk

Usage:
  kuratchi-sdk generate-migrations --schema <path> [--outDir <dir>] [--tag <tag>] [--fromSchema <path>]
  kuratchi-sdk init-admin-db [--name <dbName>] [--gatewayKey <key>] [--workersSubdomain <subdomain>] [--accountId <id>] [--apiToken <token>] [--scriptName <name>] [--migrate <true|false>] [--debug]
    Defaults: --name kuratchi-admin, --scriptName kuratchi-do-internal, --migrate true
    Env fallbacks: KURATCHI_GATEWAY_KEY/GATEWAY_KEY, (KURATCHI_)CLOUDFLARE_WORKERS_SUBDOMAIN/WORKERS_SUBDOMAIN, (KURATCHI_)CLOUDFLARE_ACCOUNT_ID/CF_ACCOUNT_ID, (KURATCHI_)CLOUDFLARE_API_TOKEN/CF_API_TOKEN, KURATCHI_ADMIN_DB_NAME
    Behavior: tries migrate=true; if migration fails and migrate is not explicitly false, retries without migration
  
  kuratchi-sdk refresh-admin-token [--name <dbName>] [--gatewayKey <key>] [--debug]
    Regenerate admin database token (if expired or compromised)
    Defaults: --name kuratchi-admin
    Env fallbacks: KURATCHI_GATEWAY_KEY/GATEWAY_KEY, KURATCHI_ADMIN_DB_NAME
    Important: Update KURATCHI_ADMIN_DB_TOKEN with the new token after running this command
`);
    return;
  }
  try {
    if (cmd === 'generate-migrations' || cmd === 'gen-migrations' || cmd === 'migrations') {
      await cmdGenerateMigrations(args);
    } else if (cmd === 'init-admin-db' || cmd === 'create-admin-db' || cmd === 'admin-init') {
      await cmdInitAdminDb(args);
    } else if (cmd === 'refresh-admin-token' || cmd === 'refresh-token') {
      await cmdRefreshAdminToken(args);
    } else {
      console.error(`Unknown command: ${cmd}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(err?.message || err);
    process.exit(1);
  }
}

main();
