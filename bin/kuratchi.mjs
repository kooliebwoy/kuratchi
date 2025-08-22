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

// Generate migration SQL and journal from a JSON schema, with automatic schema snapshotting.
// If --from-schema-json-file is not provided, we will diff from <out-dir>/meta/_schema.json when present;
// otherwise we will generate an initial bundle. After generation, we update the snapshot to the new schema.
async function adminGenerateMigrations(opts) {
  const outDir = opts.outDir || path.join(process.cwd(), 'migrations-admin');
  const tag = opts.tag || `m_${Date.now()}`;
  let schemaPath = opts.schemaJsonFile || path.join(process.cwd(), 'schema-json', 'admin.json');
  if (!fs.existsSync(schemaPath)) {
    const alt = path.join(process.cwd(), 'src', 'lib', 'schema-json', 'admin.json');
    if (fs.existsSync(alt)) schemaPath = alt;
  }
  if (!fs.existsSync(schemaPath)) throw new Error('Provide --schema-json-file or place admin.json under ./schema-json/ or ./src/lib/schema-json/.');

  const orm = await importOrm();
  if (!orm) throw new Error('Kuratchi dist files not found. Build the package first (npm run build).');

  const ensureDir = (p) => { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); };
  const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

  const toSchema = readJson(schemaPath);
  let sql = '';
  let warnings = [];

  // Ensure paths early so we can safely write snapshot even on no-op
  ensureDir(outDir);
  const metaDir = path.join(outDir, 'meta');
  ensureDir(metaDir);
  const snapshotPath = path.join(metaDir, '_schema.json');

  // Decide initial vs diff
  let usedSnapshot = false;
  if (opts.fromSchemaJsonFile) {
    const fromSchema = readJson(opts.fromSchemaJsonFile);
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
  let schemaPath = opts.schemaJsonFile || path.join(process.cwd(), 'schema-json', 'organization.json');
  if (!fs.existsSync(schemaPath)) {
    const alt = path.join(process.cwd(), 'src', 'lib', 'schema-json', 'organization.json');
    if (fs.existsSync(alt)) schemaPath = alt;
  }
  if (!fs.existsSync(schemaPath)) throw new Error('Provide --schema-json-file or place organization.json under ./schema-json/ or ./src/lib/schema-json/.');

  const orm = await importOrm();
  if (!orm) throw new Error('Kuratchi dist files not found. Build the package first (npm run build).');

  const ensureDir = (p) => { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); };
  const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

  const toSchema = readJson(schemaPath);
  let sql = '';
  let warnings = [];

  // Ensure paths early
  ensureDir(outDir);
  const metaDir = path.join(outDir, 'meta');
  ensureDir(metaDir);
  const snapshotPath = path.join(metaDir, '_schema.json');

  // Decide initial vs diff
  let usedSnapshot = false;
  if (opts.fromSchemaJsonFile) {
    const fromSchema = readJson(opts.fromSchemaJsonFile);
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
  console.log(`Kuratchi CLI\n\nUsage:\n  kuratchi admin create   [--name <db>] [--no-spinner] --account-id <id> --api-token <token> --workers-subdomain <sub>\n  kuratchi admin migrate  [--name <db>] [--token <admin_db_token>] [--workers-subdomain <sub>] [--migrations-dir <name>] [--migrations-path <path>] [--schema-json-file <path>] [--no-spinner]\n  kuratchi admin destroy  --id <dbuuid> [--no-spinner] --account-id <id> --api-token <token>\n  kuratchi admin generate-migrations [--out-dir <path>] [--schema-json-file <path>] [--from-schema-json-file <path>] [--tag <string>]\n  kuratchi org   generate-migrations [--out-dir <path>] [--schema-json-file <path>] [--from-schema-json-file <path>] [--tag <string>]\n\nZero-config:\n   Reads defaults from kuratchi.config.json|.mjs|.js or package.json { kuratchi: { accountId, apiToken, workersSubdomain } }\n\nEnv vars (either set works):\n   CF_ACCOUNT_ID | CLOUDFLARE_ACCOUNT_ID\n   CF_API_TOKEN | CLOUDFLARE_API_TOKEN\n   CF_WORKERS_SUBDOMAIN | CLOUDFLARE_WORKERS_SUBDOMAIN\n   KURATCHI_ADMIN_DB_TOKEN (for admin migrate)\n\nNotes:\n   - If --name is omitted, create/migrate uses 'kuratchi-admin'.\n   - admin migrate tries, in order: filesystem loader (./migrations-<dir> or --migrations-path), then JSON schema (via --schema-json-file or ./schema-json/admin.json or ./src/lib/schema-json/admin.json).\n   - --migrations-dir defaults to 'admin' (expects /migrations-admin/...).\n   - --migrations-path defaults to ./migrations-<dir> if not provided.\n   - admin/org generate-migrations writes SQL to <out-dir>/<tag>.sql and updates <out-dir>/meta/_journal.json.\n   - Snapshotting: we auto-snapshot the latest schema to <out-dir>/meta/_schema.json and diff from it next time. Pass --from-schema-json-file to override the baseline.\n   - Defaults: admin uses admin.json -> migrations-admin; org uses organization.json -> migrations-org.\n   - Shows a progress spinner on TTY by default; pass --no-spinner to disable.\n`);
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
      case '--schema-json-file': take('schemaJsonFile'); break;
      case '--from-schema-json-file': take('fromSchemaJsonFile'); break;
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
  const distPath = path.join(here, '..', 'dist', 'd1', 'index.js');
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
  const distPath = path.join(here, '..', 'dist', 'orm', 'index.js');
  if (fs.existsSync(distPath)) return import(pathToFileURL(distPath).href);
  return null;
}

// Filesystem migration loader: reads ./migrations-<dir>/meta/_journal.json and <tag>.sql files
async function loadMigrationsFromFs(dirName, basePath) {
  const root = basePath || path.join(process.cwd(), `migrations-${dirName}`);
  const journalPath = path.join(root, 'meta', '_journal.json');
  if (!fs.existsSync(journalPath)) return null;
  let journal;
  try {
    journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  } catch {
    throw new Error(`Invalid journal JSON at ${journalPath}`);
  }
  if (!journal || !Array.isArray(journal.entries)) {
    throw new Error(`Invalid journal format at ${journalPath}`);
  }
  const migrations = {};
  for (const entry of journal.entries) {
    const key = `m${String(entry.idx).padStart(4, '0')}`;
    const sqlFile = path.join(root, `${entry.tag}.sql`);
    if (!fs.existsSync(sqlFile)) {
      throw new Error(`SQL file not found for migration tag ${entry.tag} at ${sqlFile}`);
    }
    const sqlText = fs.readFileSync(sqlFile, 'utf8');
    migrations[key] = async () => sqlText;
  }
  return { journal, migrations };
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
  const { database, apiToken: dbToken } = await d1.createDatabase(name);
  const dbName = database?.name || name;
  const dbId = database?.uuid || database?.id || null;
  const endpoint = `https://${dbName}.${workersSubdomain}`;
  return {
    ok: true,
    databaseId: dbId,
    databaseName: dbName,
    apiToken: dbToken,
    workersSubdomain,
    endpoint,
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
async function adminMigrate(opts) {
  const cfg = await loadConfig();
  const name = opts.name || 'kuratchi-admin';
  const workersSubdomain = opts.workersSubdomain || process.env.CF_WORKERS_SUBDOMAIN || process.env.CLOUDFLARE_WORKERS_SUBDOMAIN || cfg.workersSubdomain;
  const token = opts.token || process.env.KURATCHI_ADMIN_DB_TOKEN;
  const migrationsDir = opts.migrationsDir || 'admin';
  const migrationsPath = opts.migrationsPath; // optional override
  if (!workersSubdomain) throw new Error('Missing workers subdomain. Provide --workers-subdomain or set CF_WORKERS_SUBDOMAIN | CLOUDFLARE_WORKERS_SUBDOMAIN or config file.');
  if (!token) throw new Error('Missing admin DB token. Provide --token or set KURATCHI_ADMIN_DB_TOKEN.');

  const { KuratchiHttpClient } = await importInternalHttpClient();
  const client = new KuratchiHttpClient({ databaseName: name, workersSubdomain, apiToken: token });

  // Preferred path: attempt to load migrations from filesystem (local CLI)
  try {
    const fsBundle = await loadMigrationsFromFs(migrationsDir, migrationsPath);
    if (fsBundle) {
      const ok = await client.migrate(fsBundle);
      if (ok) {
        return { ok: true, databaseName: name, workersSubdomain, strategy: 'fs-migrations', dir: migrationsDir, path: migrationsPath || path.join(process.cwd(), `migrations-${migrationsDir}`) };
      }
    }
  } catch (e) {
    // Ignore and continue to next strategy
  }

  // Tertiary path: attempt JSON-schema-based migration (single initial bundle)
  try {
    const om = await importOrmMigrator();
    if (om && typeof om.generateInitialMigrationBundle === 'function') {
      let schemaFile = null;
      const candidates = [];
      if (opts.schemaJsonFile) candidates.push(opts.schemaJsonFile);
      candidates.push(path.join(process.cwd(), 'schema-json', 'admin.json'));
      candidates.push(path.join(process.cwd(), 'src', 'lib', 'schema-json', 'admin.json'));
      for (const cand of candidates) {
        if (cand && fs.existsSync(cand)) { schemaFile = cand; break; }
      }
      if (schemaFile) {
        const raw = fs.readFileSync(schemaFile, 'utf8');
        const schema = JSON.parse(raw);
        const bundle = om.generateInitialMigrationBundle(schema, { tag: 'initial' });
        const ok = await client.migrate(bundle);
        if (ok) {
          return { ok: true, databaseName: name, workersSubdomain, strategy: 'json-schema', schemaFile };
        }
      }
    }
  } catch (e) {
    // Ignore and continue
  }
  throw new Error('No migrations found. Provide a local filesystem bundle or a JSON schema file to generate an initial bundle.');
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
