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

function usage() {
  console.log(`Kuratchi CLI\n\nUsage:\n  kuratchi admin create   [--name <db>] [--no-spinner] --account-id <id> --api-token <token> --workers-subdomain <sub>\n  kuratchi admin migrate  [--name <db>] [--token <admin_db_token>] [--workers-subdomain <sub>] [--migrations-dir <name>] [--migrations-path <path>] [--no-spinner]\n  kuratchi admin destroy  --id <dbuuid> [--no-spinner] --account-id <id> --api-token <token>\n\nZero-config:\n  Reads defaults from kuratchi.config.json|.mjs|.js or package.json { kuratchi: { accountId, apiToken, workersSubdomain } }\n\nEnv vars (either set works):\n  CF_ACCOUNT_ID | CLOUDFLARE_ACCOUNT_ID\n  CF_API_TOKEN | CLOUDFLARE_API_TOKEN\n  CF_WORKERS_SUBDOMAIN | CLOUDFLARE_WORKERS_SUBDOMAIN\n  KURATCHI_ADMIN_DB_TOKEN (for admin migrate)\n\nNotes:\n  - If --name is omitted, create/migrate uses 'kuratchi-admin'.\n  - admin migrate tries, in order: filesystem loader (./migrations-<dir> or --migrations-path), then Vite-based migrations (migrations-<dir>/), then inline SQL.\n  - --migrations-dir defaults to 'admin' (expects /migrations-admin/...).\n  - --migrations-path defaults to ./migrations-<dir> if not provided.\n  - Shows a progress spinner on TTY by default; pass --no-spinner to disable.\n`);
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

// Vite-only migration loader (optional). If missing, we'll fall back to inline SQL.
async function importMigrationsVite() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.join(here, '..', 'dist', 'd1', 'migrations-handler.js');
  if (fs.existsSync(distPath)) return import(pathToFileURL(distPath).href);
  // If the file isn't present in dist, treat as unavailable (no throw here; caller handles fallback)
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
    // Ignore and fall back to inline SQL
  }

  // Secondary path: attempt to run user-provided migrations via Vite loader
  try {
    const mv = await importMigrationsVite();
    if (mv && typeof mv.loadMigrations === 'function') {
      const bundle = await mv.loadMigrations(migrationsDir);
      const ok = await client.migrate(bundle);
      if (ok) {
        return { ok: true, databaseName: name, workersSubdomain, strategy: 'vite-migrations', dir: migrationsDir };
      }
      // If migrate returned falsy, proceed to fallback
    }
  } catch (e) {
    // Ignore and fall back to inline SQL
  }

  const stmts = [
    // users
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT NOT NULL PRIMARY KEY,
      name TEXT,
      firstName TEXT,
      lastName TEXT,
      phone TEXT,
      email TEXT NOT NULL UNIQUE,
      emailVerified INTEGER,
      image TEXT,
      status INTEGER,
      role TEXT,
      password_hash TEXT,
      accessAttempts INTEGER,
      updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      deleted_at TEXT
    );`,

    // passwordResetTokens
    `CREATE TABLE IF NOT EXISTS passwordResetTokens (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      email TEXT NOT NULL,
      expires INTEGER NOT NULL,
      updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      deleted_at TEXT
    );`,

    // magicLinkTokens
    `CREATE TABLE IF NOT EXISTS magicLinkTokens (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      redirectTo TEXT,
      consumed_at INTEGER,
      expires INTEGER NOT NULL,
      updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      deleted_at TEXT
    );`,

    // emailVerificationToken
    `CREATE TABLE IF NOT EXISTS emailVerificationToken (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      email TEXT NOT NULL,
      userId TEXT NOT NULL,
      expires INTEGER NOT NULL,
      updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      deleted_at TEXT
    );`,

    // organizationUsers
    `CREATE TABLE IF NOT EXISTS organizationUsers (
      id TEXT NOT NULL PRIMARY KEY,
      email TEXT,
      organizationId TEXT,
      organizationSlug TEXT,
      updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      deleted_at TEXT
    );`,

    // organizations
    `CREATE TABLE IF NOT EXISTS organizations (
      id TEXT NOT NULL PRIMARY KEY,
      organizationName TEXT,
      email TEXT UNIQUE,
      organizationSlug TEXT UNIQUE,
      notes TEXT,
      stripeCustomerId TEXT,
      stripeSubscriptionId TEXT,
      status TEXT,
      updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      deleted_at TEXT
    );`,

    // activity
    `CREATE TABLE IF NOT EXISTS activity (
      id TEXT PRIMARY KEY,
      userId TEXT,
      action TEXT NOT NULL,
      data TEXT DEFAULT (json_object()),
      status INTEGER,
      ip TEXT,
      userAgent TEXT,
      updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      deleted_at TEXT
    );`,

    // session
    `CREATE TABLE IF NOT EXISTS session (
      sessionToken TEXT NOT NULL PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires INTEGER NOT NULL,
      updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      deleted_at TEXT
    );`,

    // oauthAccounts
    `CREATE TABLE IF NOT EXISTS oauthAccounts (
      id TEXT PRIMARY KEY,
      userId TEXT REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      providerAccountId TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      expires_at INTEGER,
      scope TEXT,
      token_type TEXT,
      id_token TEXT,
      updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      deleted_at TEXT
    );`,

    // databases
    `CREATE TABLE IF NOT EXISTS databases (
      id TEXT NOT NULL PRIMARY KEY,
      name TEXT,
      dbuuid TEXT UNIQUE,
      isArchived INTEGER,
      isActive INTEGER,
      lastBackup INTEGER,
      schemaVersion INTEGER DEFAULT 1,
      needsSchemaUpdate INTEGER DEFAULT 0,
      lastSchemaSync INTEGER,
      organizationId TEXT REFERENCES organizations(id),
      updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      deleted_at TEXT
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS dbuuid_idx ON databases(dbuuid);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS name_idx ON databases(name);`,

    // dbApiTokens
    `CREATE TABLE IF NOT EXISTS dbApiTokens (
      id TEXT NOT NULL PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      name TEXT,
      databaseId TEXT REFERENCES databases(id),
      expires INTEGER,
      revoked INTEGER,
      updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      deleted_at TEXT
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS token_idx ON dbApiTokens(token);`
  ];

  const batch = stmts.map((query) => ({ query, params: [] }));
  const result = await client.batch(batch);
  if (!result || result.success === false) {
    throw new Error(result?.error || 'Migration batch failed');
  }
  return { ok: true, databaseName: name, workersSubdomain, executed: stmts.length, strategy: 'inline-sql' };
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
