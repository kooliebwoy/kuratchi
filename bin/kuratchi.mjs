#!/usr/bin/env node

// Kuratchi CLI: provision and manage D1 admin databases via Cloudflare
// Commands:
//   kuratchi admin create  [--name <db>] --account-id <id> --api-token <token> --workers-subdomain <sub>
//   kuratchi admin destroy --id <dbuuid> --account-id <id> --api-token <token>
//
// Env fallbacks:
//   CF_ACCOUNT_ID | CLOUDFLARE_ACCOUNT_ID,
//   CF_API_TOKEN | CLOUDFLARE_API_TOKEN,
//   CF_WORKERS_SUBDOMAIN | CLOUDFLARE_WORKERS_SUBDOMAIN
//
// Config discovery (optional):
//   - kuratchi.config.json | kuratchi.config.mjs | kuratchi.config.js
//   - package.json { "kuratchi": { ... } }

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Load environment variables from .env file if it exists
try {
  const { config } = await import('dotenv');
  // Try to load from current working directory first, then from project root
  config({ path: '.env' });
  config({ path: path.join(process.cwd(), '.env') });
} catch (e) {
  // dotenv not installed or .env file doesn't exist, continue without it
}

// Utilities
const ensureDir = (p) => { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); };
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// Try to import Typescript from the project devDependencies (optional)
async function tryImportTypescript() {
  try {
    // typescript is listed in devDependencies; if not installed, this throws
    const ts = await import('typescript');
    return ts;
  } catch {
    return null;
  }
}

// Transpile a .ts file to a temporary ESM module using the project's TypeScript
async function transpileTsFileToEsmTemp(tsPath, tempRootOverride) {
  const ts = await tryImportTypescript();
  if (!ts) return null;
  const src = fs.readFileSync(tsPath, 'utf8');
  const transpiled = ts.transpileModule(src, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.Preserve,
      sourceMap: false,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
    },
    fileName: tsPath,
    reportDiagnostics: false,
  });
  const tmpRoot = tempRootOverride || path.join(process.cwd(), '.kuratchi-tmp');
  ensureDir(tmpRoot);
  const outFile = path.join(tmpRoot, `schema-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(outFile, transpiled.outputText, 'utf8');
  return outFile;
}

// Resolve a schema path to an importable module path, handling .ts neighbors or transpilation
async function resolveImportableSchemaPath(schemaPath, tempRootOverride) {
  if (!schemaPath) return null;
  // If TS, prefer adjacent compiled outputs
  if (schemaPath.endsWith('.ts')) {
    const tsNeighbors = [
      schemaPath.replace(/\.ts$/, '.mjs'),
      schemaPath.replace(/\.ts$/, '.js'),
      schemaPath.replace(path.join('src', path.sep), path.join('dist', path.sep)).replace(/\.ts$/, '.js'),
    ];
    for (const c of tsNeighbors) { if (fs.existsSync(c)) return c; }
    // As a last resort, transpile using project's typescript
    const temp = await transpileTsFileToEsmTemp(schemaPath, tempRootOverride);
    if (temp) return temp;
    return null;
  }
  return schemaPath;
}

// Load and normalize the schema DSL. Optionally caches normalized JSON under kuratchi-schema/<kind>.json
async function loadNormalizedSchema({ schemaPath, kind, cacheDir }) {
  const importable = await resolveImportableSchemaPath(schemaPath, cacheDir && path.join(cacheDir, '.tmp'));
  if (!importable || !fs.existsSync(importable)) throw new Error(`Schema file not found or not importable: ${schemaPath}`);
  const mod = await import(pathToFileURL(importable).href);
  // Find the first export that looks like a valid schema DSL (has name, version, tables)
  let dsl = null;
  const candidates = [mod.default, ...Object.values(mod)];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && candidate.tables && candidate.name) {
      dsl = candidate;
      break;
    }
  }
  if (!dsl || typeof dsl !== 'object' || !dsl.tables) throw new Error('Schema module must export a DSL with { name, version, tables }');
  // normalizeSchema is exported from the package root (dist/index.js)
  const root = await importRootLib();
  if (!root || typeof root.normalizeSchema !== 'function') throw new Error('normalizeSchema not available. Build the package (npm run build).');
  const toSchema = root.normalizeSchema(dsl);
  let cacheFile = null;
  if (cacheDir) {
    ensureDir(cacheDir);
    cacheFile = path.join(cacheDir, `${kind}.json`);
    try {
      fs.writeFileSync(cacheFile, JSON.stringify(toSchema, null, 2), 'utf8');
    } catch {}
  }
  return { toSchema, cacheFile };
}

// Generate migration SQL and journal from a Schema DSL ESM module, with automatic schema snapshotting.
// If --from-schema-file is not provided, we will diff from <out-dir>/meta/_schema.json when present;
// otherwise we will generate an initial bundle. After generation, we update the snapshot to the new schema.
async function adminGenerateMigrations(opts) {
  const outDir = opts.outDir || path.join(process.cwd(), 'migrations-admin');
  const tag = opts.tag || `m_${Date.now()}`;
  const cfg = await loadConfig();
  let schemaPath = opts.schemaFile || cfg.adminSchemaFile;
  if (!schemaPath) {
    // try default locations for built schema modules
    const candidates = [
      // Check migration builder output first
      path.join(process.cwd(), 'migrations-admin', 'schema', 'admin.json'),
      // Then check traditional schema locations
      path.join(process.cwd(), 'schema', 'admin.mjs'),
      path.join(process.cwd(), 'schema', 'admin.js'),
      path.join(process.cwd(), 'dist', 'lib', 'schema', 'admin.js'),
      path.join(process.cwd(), 'dist', 'schema', 'admin.js'),
      path.join(process.cwd(), 'src', 'lib', 'schema', 'admin.js'),
      path.join(process.cwd(), 'src', 'lib', 'schema', 'admin.mjs'),
    ];
    for (const c of candidates) { if (fs.existsSync(c)) { schemaPath = c; break; } }
  }
  const orm = await importOrm();
  if (!orm) throw new Error('Kuratchi dist files not found. Build the package first (npm run build).');
  const { toSchema } = await loadNormalizedSchema({ schemaPath, kind: 'admin', cacheDir: path.join(outDir, 'schema') });
  let sql = '';
  let warnings = [];

  // Ensure paths early so we can safely write snapshot even on no-op
  ensureDir(outDir);
  const metaDir = path.join(outDir, 'meta');
  ensureDir(metaDir);
  const snapshotPath = path.join(metaDir, '_schema.json');

  // Decide initial vs diff
  let usedSnapshot = false;
  if (opts.fromSchemaFile) {
    const fromMod = await import(pathToFileURL(opts.fromSchemaFile).href);
    const fromDsl = fromMod.schema || fromMod.default || fromMod;
    const root = await importRootLib();
    if (!root || typeof root.normalizeSchema !== 'function') throw new Error('normalizeSchema not available. Build the package (npm run build).');
    const fromSchema = root.normalizeSchema(fromDsl);
    const diff = orm.buildDiffSql(fromSchema, toSchema);
    sql = diff.sql;
    warnings = diff.warnings || [];
  } else if (fs.existsSync(snapshotPath)) {
    const fromSchema = readJson(snapshotPath);
    const diff = orm.buildDiffSql(fromSchema, toSchema);
    sql = diff.sql;
    warnings = diff.warnings || [];
    usedSnapshot = true;
  } else {
    sql = orm.buildInitialSql(toSchema);
  }

  // Always update snapshot to latest schema
  fs.writeFileSync(snapshotPath, JSON.stringify(toSchema, null, 2), 'utf8');

  if (!sql || !sql.trim()) {
    return { ok: true, outDir, tag, skipped: true, reason: 'No statements generated', warnings, snapshotPath, usedSnapshot };
  }

  // Write SQL file
  const sqlFile = path.join(outDir, `${tag}.sql`);
  fs.writeFileSync(sqlFile, sql, 'utf8');

  // Update or create journal
  const journalPath = path.join(outDir, 'meta', '_journal.json');
  let journal = { entries: [] };
  if (fs.existsSync(journalPath)) {
    try { journal = readJson(journalPath); } catch { journal = { entries: [] }; }
  }
  const nextIdx = (journal.entries?.[journal.entries.length - 1]?.idx || 0) + 1;
  const next = { idx: nextIdx, tag };
  journal.entries = [...(journal.entries || []), next];
  fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2), 'utf8');

  return { ok: true, outDir, tag, sqlFile, journalPath, warnings, snapshotPath, usedSnapshot };
}

// Org alias: same behavior as adminGenerateMigrations but defaults to organization schema and migrations-org
async function orgGenerateMigrations(opts) {
  const outDir = opts.outDir || path.join(process.cwd(), 'migrations-org');
  const tag = opts.tag || `m_${Date.now()}`;
  const cfg = await loadConfig();
  let schemaPath = opts.schemaFile || cfg.organizationSchemaFile;
  if (!schemaPath) {
    const candidates = [
      path.join(process.cwd(), 'schema', 'organization.mjs'),
      path.join(process.cwd(), 'schema', 'organization.js'),
      path.join(process.cwd(), 'dist', 'lib', 'schema', 'organization.js'),
      path.join(process.cwd(), 'dist', 'schema', 'organization.js'),
      path.join(process.cwd(), 'src', 'lib', 'schema', 'organization.js'),
      path.join(process.cwd(), 'src', 'lib', 'schema', 'organization.mjs'),
    ];
    for (const c of candidates) { if (fs.existsSync(c)) { schemaPath = c; break; } }
  }
  const orm = await importOrm();
  if (!orm) throw new Error('Kuratchi dist files not found. Build the package first (npm run build).');
  const { toSchema } = await loadNormalizedSchema({ schemaPath, kind: 'organization', cacheDir: path.join(outDir, 'schema') });
  let sql = '';
  let warnings = [];

  // Ensure paths early
  ensureDir(outDir);
  const metaDir = path.join(outDir, 'meta');
  ensureDir(metaDir);
  const snapshotPath = path.join(metaDir, '_schema.json');

  // Decide initial vs diff
  let usedSnapshot = false;
  if (opts.fromSchemaFile) {
    const fromMod = await import(pathToFileURL(opts.fromSchemaFile).href);
    const fromDsl = fromMod.schema || fromMod.default || fromMod;
    const root = await importRootLib();
    if (!root || typeof root.normalizeSchema !== 'function') throw new Error('normalizeSchema not available. Build the package (npm run build).');
    const fromSchema = root.normalizeSchema(fromDsl);
    const diff = orm.buildDiffSql(fromSchema, toSchema);
    sql = diff.sql;
    warnings = diff.warnings || [];
  } else if (fs.existsSync(snapshotPath)) {
    const fromSchema = readJson(snapshotPath);
    const diff = orm.buildDiffSql(fromSchema, toSchema);
    sql = diff.sql;
    warnings = diff.warnings || [];
    usedSnapshot = true;
  } else {
    sql = orm.buildInitialSql(toSchema);
  }

  // Always update snapshot
  fs.writeFileSync(snapshotPath, JSON.stringify(toSchema, null, 2), 'utf8');

  if (!sql || !sql.trim()) {
    return { ok: true, outDir, tag, skipped: true, reason: 'No statements generated', warnings, snapshotPath, usedSnapshot };
  }

  // Write SQL file
  const sqlFile = path.join(outDir, `${tag}.sql`);
  fs.writeFileSync(sqlFile, sql, 'utf8');

  // Update or create journal
  const journalPath = path.join(outDir, 'meta', '_journal.json');
  let journal = { entries: [] };
  if (fs.existsSync(journalPath)) {
    try { journal = readJson(journalPath); } catch { journal = { entries: [] }; }
  }
  const nextIdx = (journal.entries?.[journal.entries.length - 1]?.idx || 0) + 1;
  const next = { idx: nextIdx, tag };
  journal.entries = [...(journal.entries || []), next];
  fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2), 'utf8');

  return { ok: true, outDir, tag, sqlFile, journalPath, warnings, snapshotPath, usedSnapshot };
}

function usage() {
  return `Kuratchi CLI

Usage:
  # Admin database operations
  kuratchi admin create  [--name <db>] --account-id <id> --api-token <token> --workers-subdomain <sub>
  kuratchi admin destroy --id <dbuuid> --account-id <id> --api-token <token>
  kuratchi admin migrate [--name <db>] --token <admin-db-token> [--workers-subdomain <sub>] [--migrations-dir <dir>]
  kuratchi admin generate-migrations --schema <path> --out-dir <dir> [--from-schema-file <path>] [--workers-subdomain <sub>] [--migrations-dir <dir>]
  
  # Organization database operations
  kuratchi migrate all [--migrations-dir <dir>] [--workers-subdomain <sub>]
  kuratchi migrate admin [--migrations-dir <dir>] [--workers-subdomain <sub>]
  kuratchi migrate orgs [--migrations-dir <dir>] [--workers-subdomain <sub>]
  kuratchi migrate org --id <orgId> [--migrations-dir <dir>] [--workers-subdomain <sub>]
  kuratchi org generate-migrations --schema <path> --out-dir <dir> [--from-schema-file <path>] [--workers-subdomain <sub>] [--migrations-dir <dir>]
  
  # Version
  kuratchi --version | -v

Environment variables:
  CF_ACCOUNT_ID | CLOUDFLARE_ACCOUNT_ID
  CF_API_TOKEN | CLOUDFLARE_API_TOKEN
  CF_WORKERS_SUBDOMAIN | CLOUDFLARE_WORKERS_SUBDOMAIN
  KURATCHI_ADMIN_DB_TOKEN (for admin operations)
  KURATCHI_GATEWAY_KEY (for database access)

Examples:
  # Migrate all databases (admin + all orgs)
  kuratchi migrate all
  
  # Migrate only admin database
  kuratchi migrate admin
  
  # Migrate all organization databases
  kuratchi migrate orgs
  
  # Migrate a specific organization
  kuratchi migrate org --id org-123
  
  # Specify custom migrations directory
  kuratchi migrate all --migrations-dir my-migrations`;
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('-')) { out._.push(a); continue; }
    const next = argv[i + 1];
    const take = (k) => { out[k] = next; i++; };
    switch (a) {
      case '-h': case '--help': out.help = true; break;
      case '--name': case '-n': take('name'); break;
      case '--id': case '-i': take('id'); break;
      case '--account-id': case '-A': take('accountId'); break;
      case '--api-token': case '-T': take('apiToken'); break;
      case '--token': take('token'); break;
      case '--workers-subdomain': case '-S': take('workersSubdomain'); break;
      case '--migrations-dir': take('migrationsDir'); break;
      case '--migrations-path': take('migrationsPath'); break;
      case '--schema-file': take('schemaFile'); break;
      case '--from-schema-file': take('fromSchemaFile'); break;
      case '--out-dir': take('outDir'); break;
      case '--tag': take('tag'); break;
      case '--no-spinner': out.noSpinner = true; break;
      // no location/format options in the simplified CLI
      default:
        if (a.startsWith('--')) {
          const [k, v] = a.slice(2).split('=');
          out[k] = v ?? true;
        } else {
          out._.push(a);
        }
    }
  }
  return out;
}

function createSpinner(label, enabled = true) {
  if (!enabled) return { stop: () => {} };
  const frames = ['-', '\\', '|', '/'];
  let i = 0;
  const write = (s) => { try { process.stderr.write(s); } catch {} };
  let timer;
  write(`${label} ${frames[0]}`);
  timer = setInterval(() => {
    i = (i + 1) % frames.length;
    write(`\r${label} ${frames[i]}`);
  }, 100);
  return {
    stop: () => {
      try { clearInterval(timer); } catch {}
      write(`\r${label} done\n`);
    }
  };
}

async function loadConfig(cwd = process.cwd()) {
  const pkgPath = path.join(cwd, 'package.json');
  let pkgCfg = {};
  try {
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg && typeof pkg.kuratchi === 'object' && pkg.kuratchi) {
        pkgCfg = pkg.kuratchi;
      }
    }
  } catch {}
  const candidates = ['kuratchi.config.json', 'kuratchi.config.mjs', 'kuratchi.config.js'];
  let fileCfg = {};
  for (const fname of candidates) {
    const p = path.join(cwd, fname);
    if (!fs.existsSync(p)) continue;
    try {
      if (fname.endsWith('.json')) {
        fileCfg = JSON.parse(fs.readFileSync(p, 'utf8')) || {};
      } else {
        const mod = await import(pathToFileURL(p).href);
        fileCfg = (mod && (mod.default || mod.config)) || {};
      }
      break;
    } catch {}
  }
  return { ...pkgCfg, ...fileCfg };
}

async function importKuratchiD1() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.join(here, '..', 'dist', 'd1', 'kuratchi-d1.js');
  if (fs.existsSync(distPath)) return import(pathToFileURL(distPath).href);
  // Fallback error with hint
  throw new Error('Kuratchi dist files not found. Build the package first (npm run build).');
}

// Internal: import the low-level HTTP client directly from dist to avoid requiring CF account credentials for migrate
async function importInternalHttpClient() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.join(here, '..', 'dist', 'd1', 'internal-http-client.js');
  if (fs.existsSync(distPath)) return import(pathToFileURL(distPath).href);
  throw new Error('Kuratchi dist files not found. Build the package first (npm run build).');
}

// Load admin schema for database creation
async function loadAdminSchema() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, '..', 'dist', 'schema', 'admin.js'),
    path.join(here, '..', 'src', 'lib', 'schema', 'admin.js')
  ];
  
  for (const schemaPath of candidates) {
    if (fs.existsSync(schemaPath)) {
      const mod = await import(pathToFileURL(schemaPath).href);
      const adminSchemaDsl = mod.adminSchemaDsl || mod.default;
      if (adminSchemaDsl) return adminSchemaDsl;
    }
  }
  // Fallback to basic admin schema if not found
  return {
    tables: {
      organizations: {
        columns: {
          id: { type: 'text', primaryKey: true },
          organizationName: { type: 'text', unique: true },
          organizationSlug: { type: 'text' },
          email: { type: 'text' },
          status: { type: 'text', default: 'active' },
          created_at: { type: 'text' },
          updated_at: { type: 'text' },
          deleted_at: { type: 'text' }
        }
      },
      databases: {
        columns: {
          id: { type: 'text', primaryKey: true },
          name: { type: 'text' },
          dbuuid: { type: 'text' },
          organizationId: { type: 'text' },
          created_at: { type: 'text' },
          updated_at: { type: 'text' },
          deleted_at: { type: 'text' }
        }
      },
      dbApiTokens: {
        columns: {
          id: { type: 'text', primaryKey: true },
          token: { type: 'text' },
          name: { type: 'text' },
          databaseId: { type: 'text' },
          created_at: { type: 'text' },
          updated_at: { type: 'text' },
          deleted_at: { type: 'text' },
          revoked: { type: 'integer', default: 0 },
          expires: { type: 'text' }
        }
      },
      organizationUsers: {
        columns: {
          id: { type: 'text', primaryKey: true },
          email: { type: 'text' },
          organizationId: { type: 'text' },
          organizationSlug: { type: 'text' },
          created_at: { type: 'text' },
          updated_at: { type: 'text' },
          deleted_at: { type: 'text' }
        }
      }
    }
  };
}


// Optional: import the JSON-schema migrator utilities from dist
async function importOrmMigrator() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.join(here, '..', 'dist', 'orm', 'migrator.js');
  if (fs.existsSync(distPath)) return import(pathToFileURL(distPath).href);
  return null;
}

// Optional: import full ORM index (includes diff utilities)
async function importOrm() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, '..', 'dist', 'orm', 'index.js'),
    path.join(here, '..', 'dist', 'orm', 'kuratchi-orm.js')
  ];
  
  for (const distPath of candidates) {
    if (fs.existsSync(distPath)) {
      return import(pathToFileURL(distPath).href);
    }
  }
  return null;
}

// Import package root for shared exports like normalizeSchema
async function importRootLib() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.join(here, '..', 'dist', 'index.js');
  if (fs.existsSync(distPath)) return import(pathToFileURL(distPath).href);
  return null;
}

// Load migrations using the proper ORM migration loader
async function loadMigrationsFromFs(dirName, basePath) {
  const root = basePath || path.join(process.cwd(), `migrations-${dirName}`);
  const journalPath = path.join(root, 'meta', '_journal.json');
  if (!fs.existsSync(journalPath)) return null;
  
  try {
    // Use the ORM's createFsMigrationLoader
    const orm = await importOrm();
    if (!orm || typeof orm.createFsMigrationLoader !== 'function') {
      throw new Error('ORM createFsMigrationLoader not available. Build the package first (npm run build).');
    }
    
    const loader = await orm.createFsMigrationLoader(root);
    const journal = await loader.loadJournal(dirName);
    const migrations = {};
    
    for (const entry of journal.entries) {
      const key = `m${String(entry.idx).padStart(4, '0')}`;
      migrations[key] = async () => await loader.loadSql(dirName, entry.tag);
    }
    
    return { journal, migrations };
  } catch (e) {
    throw new Error(`Failed to load migrations: ${e.message}`);
  }
}

function randSuffix(len = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function adminCreate(opts) {
  const cfg = await loadConfig();
  const accountId = opts.accountId || process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || cfg.accountId;
  const apiToken = opts.apiToken || process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || cfg.apiToken;
  const workersSubdomain = opts.workersSubdomain || process.env.CF_WORKERS_SUBDOMAIN || process.env.CLOUDFLARE_WORKERS_SUBDOMAIN || cfg.workersSubdomain;
  if (!accountId || !apiToken || !workersSubdomain) {
    throw new Error('Missing credentials. Provide --account-id, --api-token, --workers-subdomain or set CF_* or CLOUDFLARE_* equivalents.');
  }
  const name = opts.name || 'kuratchi-admin';

  const { KuratchiD1 } = await importKuratchiD1();
  const d1 = new KuratchiD1({ accountId, apiToken, workersSubdomain });
  
  // Create admin database and ensure internal worker is deployed
  const { database, token: dbToken, worker } = await d1.createDatabase({
    databaseName: name,
    gatewayKey: process.env.KURATCHI_GATEWAY_KEY || process.env.GATEWAY_KEY || 'default-gateway-key',
    deployWorker: true  // This deploys the shared kuratchi-d1-internal worker
  });
  
  // Run admin migrations using the proper migration system
  await adminMigrate({
    name,
    workersSubdomain,
    token: dbToken
  });
  
  const dbName = database?.name || name;
  const dbId = database?.uuid || database?.id || null;
  const internalWorkerEndpoint = `https://kuratchi-d1-internal.${workersSubdomain}`;
  
  return {
    ok: true,
    databaseId: dbId,
    databaseName: dbName,
    apiToken: dbToken,
    workersSubdomain,
    internalWorker: {
      endpoint: internalWorkerEndpoint,
      deployed: !!worker
    }
  };
}

async function adminDestroy(opts) {
  const cfg = await loadConfig();
  const accountId = opts.accountId || process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || cfg.accountId;
  const apiToken = opts.apiToken || process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || cfg.apiToken;
  if (!accountId || !apiToken) {
    throw new Error('Missing credentials. Provide --account-id and --api-token or set CF_* or CLOUDFLARE_* equivalents.');
  }
  const id = opts.id;
  if (!id) throw new Error('Provide --id <database uuid>');
  const workersSubdomain = opts.workersSubdomain || process.env.CF_WORKERS_SUBDOMAIN || process.env.CLOUDFLARE_WORKERS_SUBDOMAIN || cfg.workersSubdomain || 'workers.dev';
  const { KuratchiD1 } = await importKuratchiD1();
  const d1 = new KuratchiD1({ accountId, apiToken, workersSubdomain });
  await d1.deleteDatabase(id);
  return { ok: true, deletedId: id };
}

// Create admin tables/indexes if they do not exist
async function migrateOrgDatabase(opts) {
  const cfg = await loadConfig();
  const workersSubdomain = opts.workersSubdomain || process.env.CF_WORKERS_SUBDOMAIN || process.env.CLOUDFLARE_WORKERS_SUBDOMAIN || cfg.workersSubdomain;
  const adminDBToken = opts.token || process.env.KURATCHI_ADMIN_DB_TOKEN || cfg.adminToken || cfg.adminDBToken;
  const migrationsDir = opts.migrationsDir || 'org';
  const orgId = opts.orgId;
  const adminDBName = process.env.KURATCHI_ADMIN_DB_NAME || cfg.adminDBName || 'kuratchi-admin';
  
  if (!workersSubdomain) throw new Error('Missing workers subdomain');
  if (!adminDBToken) throw new Error('Missing admin DB token. Set KURATCHI_ADMIN_DB_TOKEN or use --token');
  if (!orgId) throw new Error('Organization ID is required');

  // Get database info from admin - use KuratchiD1 client like the main function
  const { KuratchiD1 } = await importKuratchiD1();
  const gatewayKey = process.env.KURATCHI_GATEWAY_KEY || process.env.GATEWAY_KEY || cfg.gatewayKey || 'default-gateway-key';
  
  const kuratchiD1 = new KuratchiD1({
    apiToken: cfg.apiToken,
    accountId: cfg.accountId,
    workersSubdomain,
    listDbsForBindings: async () => {
      const adminDbUuid = cfg.adminDbId || cfg.adminDBId;
      if (adminDBName && adminDbUuid) {
        return [{ name: adminDBName, uuid: adminDbUuid }];
      }
      return [];
    }
  });
  
  const adminClient = kuratchiD1.getClient({
    databaseName: adminDBName,
    dbToken: adminDBToken,
    gatewayKey
  });

  // Get database details - query by organizationId
  const dbQueryResult = await adminClient.query(
    'SELECT id, name, dbuuid, organizationId FROM databases WHERE organizationId = ? AND deleted_at IS NULL',
    [orgId]
  );
  console.log('Database query result:', dbQueryResult);
  
  const dbResult = dbQueryResult?.data || [];
  if (!dbResult || !dbResult.length) {
    throw new Error(`No active database found for organization ${orgId}`);
  }

  const db = dbResult[0];
  if (!db.dbuuid) {
    throw new Error(`Database ${db.name} has no dbuuid`);
  }

  // Get API token for this database
  const tokenQueryResult = await adminClient.query(
    'SELECT token FROM dbApiTokens WHERE databaseId = ? AND revoked = 0 AND deleted_at IS NULL',
    [db.id]
  );
  console.log('Token query result:', tokenQueryResult);
  
  const tokenResult = tokenQueryResult?.data || [];
  if (!tokenResult || !tokenResult.length) {
    throw new Error(`No active API token found for database ${db.name}`);
  }

  const dbToken = tokenResult[0].token;

  // Deploy router with ALL database bindings to ensure they're accessible
  console.log('Deploying KuratchiD1 router with all database bindings...');
  const adminDbUuid = cfg.adminDbId || cfg.adminDBId;
  const bindings = [];
  
  // Add admin database binding
  if (adminDBName && adminDbUuid) {
    bindings.push({ name: adminDBName, uuid: adminDbUuid });
  }
  
  // Get ALL active databases and bind them
  const allDbsResult = await adminClient.query(
    'SELECT name, dbuuid FROM databases WHERE deleted_at IS NULL AND dbuuid IS NOT NULL'
  );
  const allDbs = allDbsResult?.data || [];
  
  for (const database of allDbs) {
    bindings.push({ name: database.name, uuid: database.dbuuid });
  }
  
  console.log(`Binding ${bindings.length} databases:`, bindings.map(b => b.name));
  await kuratchiD1.deployRouterWithBindings(gatewayKey, bindings);
  console.log('Router deployed successfully with all database bindings');

  // Apply migrations - use direct HTTP client for org database
  const { KuratchiHttpClient } = await importInternalHttpClient();
  const orgClient = new KuratchiHttpClient({
    databaseName: db.name,
    workersSubdomain,
    dbToken,
    gatewayKey: process.env.KURATCHI_GATEWAY_KEY || process.env.GATEWAY_KEY || cfg.gatewayKey || 'default-gateway-key'
  });

  const fsBundle = await loadMigrationsFromFs(migrationsDir, opts.migrationsPath);
  if (!fsBundle) {
    throw new Error(`No migrations found in ${migrationsDir}`);
  }

  console.log(`Applying ${Object.keys(fsBundle.migrations).length} migrations to ${db.name}...`);
  const ok = await orgClient.migrate(fsBundle);
  if (!ok) {
    throw new Error('Migration failed');
  }

  return { 
    ok: true, 
    databaseName: db.name,
    databaseId: db.id,
    dbuuid: db.dbuuid,
    orgId,
    migrationsApplied: Object.keys(fsBundle.migrations).length
  };
}

async function migrateAllOrgs(opts) {
  const cfg = await loadConfig();
  console.log('Config loaded:', { adminToken: cfg.adminToken ? 'present' : 'missing', adminDBToken: cfg.adminDBToken ? 'present' : 'missing' });
  console.log('Environment vars:', { 
    KURATCHI_ADMIN_DB_TOKEN: process.env.KURATCHI_ADMIN_DB_TOKEN ? 'present' : 'missing',
    KURATCHI_ADMIN_DB_NAME: process.env.KURATCHI_ADMIN_DB_NAME || 'not set'
  });
  
  const workersSubdomain = opts.workersSubdomain || process.env.CF_WORKERS_SUBDOMAIN || process.env.CLOUDFLARE_WORKERS_SUBDOMAIN || cfg.workersSubdomain;
  const adminDBToken = opts.token || process.env.KURATCHI_ADMIN_DB_TOKEN || cfg.adminToken || cfg.adminDBToken;
  const adminDBName = process.env.KURATCHI_ADMIN_DB_NAME || cfg.adminDBName || 'kuratchi-admin';
  
  if (!workersSubdomain) throw new Error('Missing workers subdomain');
  if (!adminDBToken) throw new Error('Missing admin DB token. Set KURATCHI_ADMIN_DB_TOKEN or use --token');

  // Get all organizations - use KuratchiD1 with proper admin DB setup like KuratchiAuth
  const { KuratchiD1 } = await importKuratchiD1();
  const gatewayKey = process.env.KURATCHI_GATEWAY_KEY || process.env.GATEWAY_KEY || cfg.gatewayKey || 'default-gateway-key';
  
  console.log('Gateway key being used:', gatewayKey === 'default-gateway-key' ? 'default-gateway-key' : `${gatewayKey.slice(0, 20)}...`);
  
  console.log('KuratchiD1 config:', {
    apiToken: cfg.apiToken ? 'present' : 'missing',
    accountId: cfg.accountId ? 'present' : 'missing',
    workersSubdomain,
    adminDbName: adminDBName,
    adminDbId: cfg.adminDbId || cfg.adminDBId || 'missing',
    gatewayKey: gatewayKey ? 'present' : 'missing'
  });
  
  console.log('Full config keys:', Object.keys(cfg));
  
  // Create KuratchiD1 instance with admin DB bindings like KuratchiAuth does
  const kuratchiD1 = new KuratchiD1({
    apiToken: cfg.apiToken,
    accountId: cfg.accountId,
    workersSubdomain,
    listDbsForBindings: async () => {
      // Include admin database in bindings
      const adminDbName = adminDBName;
      const adminDbUuid = cfg.adminDbId || cfg.adminDBId;
      if (adminDbName && adminDbUuid) {
        return [{ name: adminDbName, uuid: adminDbUuid }];
      }
      return [];
    }
  });
  
  // Deploy router with admin database binding to ensure authentication works
  console.log('Deploying KuratchiD1 router with admin database binding...');
  const adminDbUuid = cfg.adminDbId || cfg.adminDBId;
  if (adminDbUuid) {
    await kuratchiD1.deployRouterWithBindings(gatewayKey, [
      { name: adminDBName, uuid: adminDbUuid }
    ]);
    console.log('Router deployed successfully');
  }
  
  const adminClient = kuratchiD1.getClient({
    databaseName: adminDBName,
    dbToken: adminDBToken,
    gatewayKey
  });

  console.log(`Connecting to admin database: ${adminDBName} with token ending in ...${adminDBToken.slice(-8)}`);
  console.log(`Workers subdomain: ${workersSubdomain}`);
  
  // Let's see all tables in the database
  const allTables = await adminClient.query("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('All tables query result:', allTables);
  const tableNames = allTables?.data ? allTables.data.map(t => t.name) : [];
  console.log('All tables in database:', tableNames);
  
  // First, let's check if the organizations table exists
  const tableCheck = await adminClient.query("SELECT name FROM sqlite_master WHERE type='table' AND name='organizations'");
  console.log('Organizations table exists:', tableCheck?.data?.length > 0);
  
  let orgs = [];
  if (tableCheck?.data?.length > 0) {
    const orgsResult = await adminClient.query('SELECT id, organizationName as name FROM organizations');
    console.log('Organizations query result:', orgsResult);
    orgs = orgsResult?.data || [];
    console.log(`Found ${orgs?.length || 0} organizations in admin database`);
    
    if (orgs?.length > 0) {
      console.log('Organizations:', orgs.map(o => `${o.name} (${o.id})`));
    }
  } else {
    console.log('Organizations table does not exist - this suggests wrong database connection');
  }
  
  if (!orgs || !orgs.length) {
    console.log('No organizations found');
    return { ok: true, migrated: [] };
  }

  console.log(`Found ${orgs.length} organizations to migrate`);
  
  const results = [];
  for (const org of orgs) {
    try {
      console.log(`Migrating organization: ${org.name} (${org.id})`);
      const result = await migrateOrgDatabase({
        ...opts,
        orgId: org.id,
        orgName: org.name,
        token: adminDBToken // Pass the admin token through
      });
      results.push({ orgId: org.id, orgName: org.name, ...result });
    } catch (error) {
      console.error(`Error migrating organization ${org.name} (${org.id}):`, error.message);
      results.push({ orgId: org.id, orgName: org.name, error: error.message });
    }
  }

  return { ok: true, results };
}

async function adminMigrate(opts) {
  const cfg = await loadConfig();
  const name = opts.name || cfg.adminDBName || 'kuratchi-admin';
  const workersSubdomain = opts.workersSubdomain || process.env.CF_WORKERS_SUBDOMAIN || process.env.CLOUDFLARE_WORKERS_SUBDOMAIN || cfg.workersSubdomain;
  const token = opts.token || process.env.KURATCHI_ADMIN_DB_TOKEN || cfg.adminToken || cfg.adminDBToken;
  const migrationsDir = opts.migrationsDir || 'admin';
  const migrationsPath = opts.migrationsPath; // optional override
  if (!workersSubdomain) throw new Error('Missing workers subdomain. Provide --workers-subdomain or set CF_WORKERS_SUBDOMAIN | CLOUDFLARE_WORKERS_SUBDOMAIN or config file.');
  if (!token) throw new Error('Missing admin DB token. Provide --token or set KURATCHI_ADMIN_DB_TOKEN.');

  const { KuratchiHttpClient } = await importInternalHttpClient();
  const client = new KuratchiHttpClient({ 
    databaseName: name, 
    workersSubdomain, 
    dbToken: token,
    gatewayKey: process.env.KURATCHI_GATEWAY_KEY || process.env.GATEWAY_KEY || 'default-gateway-key'
  });

  // Preferred path: attempt to load migrations from filesystem (local CLI)
  try {
    const fsBundle = await loadMigrationsFromFs(migrationsDir, migrationsPath);
    if (fsBundle) {
      console.log(`[kuratchi] Found ${Object.keys(fsBundle.migrations).length} migrations in filesystem bundle`);
      const ok = await client.migrate(fsBundle);
      if (ok) {
        return { ok: true, databaseName: name, workersSubdomain, strategy: 'fs-migrations', dir: migrationsDir, path: migrationsPath || path.join(process.cwd(), `migrations-${migrationsDir}`) };
      }
    } else {
      console.log('[kuratchi] No filesystem bundle found, trying schema-based migration');
    }
  } catch (e) {
    console.error('[kuratchi] Filesystem migration loading failed:', e.message);
    // Continue to next strategy
  }

  // Tertiary path: attempt Schema-DSL-based migration (single initial bundle)
  try {
    const om = await importOrm();
    if (om && typeof om.generateInitialMigrationBundle === 'function') {
      let schemaFile = null;
      const candidates = [];
      if (opts.schemaFile) candidates.push(opts.schemaFile);
      const cfg = await loadConfig();
      if (cfg.adminSchemaFile) candidates.push(cfg.adminSchemaFile);
      // Check migration builder output first
      candidates.push(path.join(process.cwd(), 'migrations-admin', 'schema', 'admin.json'));
      // Then check traditional schema locations
      candidates.push(path.join(process.cwd(), 'schema', 'admin.mjs'));
      candidates.push(path.join(process.cwd(), 'schema', 'admin.js'));
      candidates.push(path.join(process.cwd(), 'dist', 'lib', 'schema', 'admin.js'));
      candidates.push(path.join(process.cwd(), 'dist', 'schema', 'admin.js'));
      for (const cand of candidates) { if (cand && fs.existsSync(cand)) { schemaFile = cand; break; } }
      if (schemaFile) {
        // Load normalized schema using TS-aware path, kind: admin
        const cacheDir = path.join(process.cwd(), `migrations-${migrationsDir}`, 'schema');
        const { toSchema: schema } = await loadNormalizedSchema({ schemaPath: schemaFile, kind: 'admin', cacheDir });
        const bundle = om.generateInitialMigrationBundle(schema, { tag: 'initial' });
        
        // Execute migration bundle using client
        const ok = await client.migrate(bundle);
        if (ok) {
          return { ok: true, databaseName: name, workersSubdomain, strategy: 'schema-dsl', schemaFile };
        }
      }
    }
  } catch (e) {
    // Ignore and continue
  }
  throw new Error('No migrations found. Provide a local filesystem bundle or a schema module (--schema-file) to generate an initial bundle.');
}

async function main() {
  const argv = parseArgs(process.argv.slice(2));
  if (argv.help || argv._.length === 0) {
    usage();
    return;
  }
  const [scope, cmd] = argv._;
  try {
    const spinnerEnabled = !argv.noSpinner && process.stderr.isTTY && !process.env.CI;
    if (scope === 'admin' && cmd === 'create') {
      const sp = createSpinner('Creating admin database', spinnerEnabled);
      let res;
      try {
        res = await adminCreate(argv);
      } finally {
        sp.stop();
      }
      console.log(JSON.stringify(res, null, 2));
    } else if (scope === 'admin' && cmd === 'migrate') {
      const sp = createSpinner('Migrating admin schema', spinnerEnabled);
      let res;
      try {
        res = await adminMigrate(argv);
      } finally {
        sp.stop();
      }
      console.log(JSON.stringify(res, null, 2));
    } else if (scope === 'admin' && cmd === 'destroy') {
      const sp = createSpinner('Destroying admin database', spinnerEnabled);
      let res;
      try {
        res = await adminDestroy(argv);
      } finally {
        sp.stop();
      }
      console.log(JSON.stringify(res, null, 2));
    } else if (scope === 'admin' && cmd === 'generate-migrations') {
      // No spinner for generation; it's instant and local
      const res = await adminGenerateMigrations(argv);
      console.log(JSON.stringify(res, null, 2));
    } else if (scope === 'org' && cmd === 'generate-migrations') {
      // Org alias for generating org bundles
      const res = await orgGenerateMigrations(argv);
      console.log(JSON.stringify(res, null, 2));
    } else if (scope === 'migrate') {
      const sp = createSpinner('Running migrations', spinnerEnabled);
      let res;
      try {
        if (cmd === 'all') {
          // Migrate admin first
          console.log('Migrating admin database...');
          await adminMigrate({ ...argv, migrationsDir: 'admin' });
          
          // Then migrate all orgs
          console.log('\nMigrating all organization databases...');
          res = await migrateAllOrgs({ ...argv, migrationsDir: 'org' });
        } else if (cmd === 'admin') {
          res = await adminMigrate({ ...argv, migrationsDir: 'admin' });
        } else if (cmd === 'orgs' || cmd === 'organizations') {
          res = await migrateAllOrgs({ ...argv, migrationsDir: 'org' });
        } else if (cmd === 'org' && argv.id) {
          res = await migrateOrgDatabase({
            ...argv,
            orgId: argv.id,
            migrationsDir: 'org'
          });
        } else {
          throw new Error(`Unknown migration target: ${cmd}. Use 'all', 'admin', 'orgs', or 'org --id <orgId>'`);
        }
      } finally {
        sp.stop();
      }
      console.log(JSON.stringify(res, null, 2));
    } else {
      usage();
      process.exitCode = 2;
    }
  } catch (err) {
    console.error('[kuratchi] Error:', err?.message || err);
    process.exitCode = 1;
  }
}

main();
