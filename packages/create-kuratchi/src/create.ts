/**
 * `kuratchi create <project-name>` â€” scaffold a new KuratchiJS project
 *
 * Interactive prompts for feature selection, then generates
 * a ready-to-run project with the selected stack.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import * as crypto from 'node:crypto';
import { execSync } from 'node:child_process';

// Fixed: the runtime/framework package is always `@kuratchi/js`. The
// scaffolder itself ships in `@kuratchi/wrangler`, so we can't read
// the caller's `package.json` name any more — that would emit
// `@kuratchi/wrangler` imports into user code, which is wrong.
const FRAMEWORK_PACKAGE_NAME = '@kuratchi/js';

// â”€â”€ Prompt Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string, defaultVal = ''): Promise<string> {
  const suffix = defaultVal ? ` (${defaultVal})` : '';
  return new Promise((resolve) => {
    rl.question(`  ${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultVal);
    });
  });
}

function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  return new Promise((resolve) => {
    rl.question(`  ${question} (${hint}): `, (answer) => {
      const a = answer.trim().toLowerCase();
      if (!a) return resolve(defaultYes);
      resolve(a === 'y' || a === 'yes');
    });
  });
}

// â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ScaffoldOptions {
  name: string;
  ui: boolean;
  auth: boolean;
  orm: boolean;
  do: boolean;
  monorepo: boolean;
  /** Absolute path to monorepo root (null if not in a monorepo) */
  monorepoRoot: string | null;
  /** Absolute path to the project directory */
  projectDir: string;
  /**
   * When true, scaffold the legacy Wrangler-CLI template (`kuratchi build`
   * emits `.kuratchi/worker.ts`). Default is false — the canonical template
   * is Vite-based (`@kuratchi/vite`) because that's the DX we ship new
   * apps with. The legacy flow stays supported for existing projects that
   * prefer `wrangler`-only tooling.
   */
  legacy: boolean;
}

export async function create(projectName?: string, flags: string[] = []) {
  const autoYes = flags.includes('--yes') || flags.includes('-y');
  const forceDO = flags.includes('--do');
  // `--legacy` opts into the original Wrangler-CLI scaffold. Default is
  // Vite (`@kuratchi/vite`) — see `scaffoldVite()` below.
  const legacy = flags.includes('--legacy');

  console.log('\nâš¡ Create a new KuratchiJS project\n');

  // Project name
  const name = projectName || (autoYes ? 'my-kuratchi-app' : await ask('Project name', 'my-kuratchi-app'));

  // Validate name
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    console.error('  âœ— Project name must be lowercase alphanumeric with hyphens');
    process.exit(1);
  }

  const targetDir = path.resolve(process.cwd(), name);
  if (fs.existsSync(targetDir)) {
    console.error(`  âœ— Directory "${name}" already exists`);
    process.exit(1);
  }

  // Feature selection
  const ui = autoYes ? true : await confirm('Include @kuratchi/ui theme?');
  const orm = autoYes ? true : await confirm('Include @kuratchi/orm with D1?');
  const enableDO = forceDO || (autoYes ? false : await confirm('Include Durable Objects (SQLite-backed DO)?', false));
  const effectiveOrm = orm || enableDO;
  const auth = autoYes ? true : (effectiveOrm ? await confirm('Include @kuratchi/auth (credentials login)?') : false);

  if (enableDO && !orm) {
    console.log('  ℹ DO uses @kuratchi/orm internally — enabling ORM.');
  }
  if (auth && !effectiveOrm) {
    console.log('  â„¹ Auth requires ORM â€” enabling ORM automatically');
  }

  console.log();
  console.log(`  Project:  ${name}`);
  console.log(`  Template: ${legacy ? 'wrangler CLI (legacy)' : 'vite (default)'}`);
  console.log(`  UI:       ${ui ? 'âœ“' : 'â€”'}`);
  console.log(`  D1 ORM:   ${orm ? 'âœ“' : 'â€”'}`);
  console.log(`  DO:       ${enableDO ? 'âœ“' : 'â€”'}`);
  console.log(`  Auth:     ${auth ? 'âœ“' : 'â€”'}`);
  console.log();

  if (!autoYes) {
    const ok = await confirm('Create project?');
    if (!ok) {
      console.log('  Cancelled.');
      rl.close();
      process.exit(0);
    }
  }

  rl.close();

  // Detect monorepo â€” if we're inside a workspace with packages/kuratchi-js, use workspace:*
  const monorepoRoot = detectMonorepo(targetDir);
  const isMonorepo = !!monorepoRoot;

  // Scaffold files
  const opts: ScaffoldOptions = { name, ui, orm, do: enableDO, auth, monorepo: isMonorepo, monorepoRoot, projectDir: targetDir, legacy };
  if (legacy) {
    scaffoldLegacy(targetDir, opts);
  } else {
    scaffoldVite(targetDir, opts);
  }

  // â”€â”€ Post-scaffold setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log();

  // 1. Install dependencies
  step('Installing dependencies...');
  run('bun install', isMonorepo ? monorepoRoot! : targetDir);

  // 2. Create D1 database (local only for now)
  if (orm) {
    step('Creating D1 database...');
    try {
      const output = run(`npx wrangler d1 create ${name}-db`, targetDir);
      // Parse database_id from wrangler output
      const idMatch = output.match(/database_id\s*=\s*"([^"]+)"/);
      if (idMatch) {
        const dbId = idMatch[1];
        patchWranglerDbId(targetDir, dbId);
        step(`D1 database created: ${dbId}`);
      }
    } catch {
      // D1 create may fail if not logged in â€” that's fine for local dev
      step('D1 create skipped (not logged in to Cloudflare â€” local dev still works)');
    }
  }

  // 3. Generate worker types
  step('Generating types...');
  try {
    run('npx wrangler types', targetDir);
  } catch {
    // May fail without D1 â€” not critical
  }

  // 4. Build routes
  if (legacy) {
    // Legacy CLI: emit `.kuratchi/worker.ts` via `kuratchi build` so the
    // first `bun run dev` / deploy has a compiled worker entry on disk.
    step('Building routes...');
    if (isMonorepo && monorepoRoot) {
      const cliPath = path.join(monorepoRoot!, 'packages', 'kuratchi-wrangler', 'dist', 'cli.js');
      if (fs.existsSync(cliPath)) {
        run(`node ${cliPath} build`, targetDir);
      } else {
        run('npx kuratchi build', targetDir);
      }
    } else {
      run('npx kuratchi build', targetDir);
    }
  } else {
    // Vite: no upfront build. `bun run dev` spins up `vite dev`, which
    // compiles routes on demand. `bun run build` runs `vite build` +
    // `wrangler deploy`. Skipping a prebuild keeps `create` fast.
    step('Vite template ready — no prebuild needed.');
  }

  console.log();
  console.log(`  âœ“ Project ready at ./${name}`);
  console.log();
  console.log('  Get started:');
  console.log(`    cd ${name}`);
  console.log('    bun run dev');
  console.log();
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function step(msg: string) {
  console.log(`  â–¸ ${msg}`);
}

function run(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf-8' });
  } catch (err: any) {
    // Return stderr/stdout even on failure for parsing
    if (err.stdout) return err.stdout;
    throw err;
  }
}

function detectMonorepo(targetDir: string): string | null {
  // Walk up from target to find a workspace root with packages/kuratchi-js
  let dir = path.dirname(targetDir);
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, 'packages', 'kuratchi-js', 'package.json'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function patchWranglerDbId(dir: string, dbId: string) {
  const wranglerPath = path.join(dir, 'wrangler.jsonc');
  let content = fs.readFileSync(wranglerPath, 'utf-8');
  content = content.replace('"local-dev-only"', `"${dbId}"`);
  fs.writeFileSync(wranglerPath, content, 'utf-8');
}

// â”€â”€ Scaffold (Legacy CLI) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Legacy scaffold: writes a project that builds with the `kuratchi` CLI
 * (no Vite). Wrangler points at the generated `.kuratchi/worker.ts`.
 * Route files use the legacy `.html` extension because the legacy
 * compiler only discovers those. Opt in with `--legacy`.
 */
function scaffoldLegacy(dir: string, opts: ScaffoldOptions) {
  const { name, ui, orm, auth } = opts;
  const enableDO = opts.do;

  // Create directory structure
  const dirs = [
    '',
    'src',
    'src/routes',
  ];

  if (orm || enableDO) {
    dirs.push('src/schemas');
  }
  if (orm || enableDO || auth) {
    dirs.push('src/server');
  }
  if (enableDO) {
    dirs.push('src/routes/notes');
  }
  if (auth) {
    dirs.push('src/routes/auth', 'src/routes/auth/login', 'src/routes/auth/signup', 'src/routes/admin');
  }

  for (const d of dirs) {
    fs.mkdirSync(path.join(dir, d), { recursive: true });
  }

  // Generate files
  write(dir, 'package.json', genPackageJson(opts));
  write(dir, 'wrangler.jsonc', genWrangler(opts));
  write(dir, 'kuratchi.config.ts', genConfig(opts));
  write(dir, 'tsconfig.json', genTsConfig());
  write(dir, '.gitignore', genGitIgnore());
  write(dir, 'src/routes/layout.html', genLayout(opts));
  write(dir, 'src/routes/index.html', genLandingPage(opts));

  if (orm) {
    write(dir, 'src/schemas/app.ts', genSchema(opts));
    write(dir, 'src/server/items.ts', genItemsCrud());
    write(dir, 'src/routes/items/index.html', genItemsPage());
  }

  if (enableDO) {
    write(dir, 'src/schemas/notes.ts', genNotesSchema());
    write(dir, 'src/server/notes.do.ts', genNotesDoHandler());
    write(dir, 'src/server/notes.ts', genNotesDb());
    write(dir, 'src/routes/notes/index.html', genNotesPage());
  }

  if (auth) {
    write(dir, '.dev.vars', genDevVars());
    write(dir, 'src/server/auth.ts', genAuthFunctions());
    write(dir, 'src/server/admin.ts', genAdminLoader());
    write(dir, 'src/routes/auth/login/index.html', genLoginPage());
    write(dir, 'src/routes/auth/signup/index.html', genSignupPage());
    write(dir, 'src/routes/admin/index.html', genAdminPage());
  }
}

function write(dir: string, filePath: string, content: string) {
  const full = path.join(dir, filePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf-8');
  console.log(`  + ${filePath}`);
}

// â”€â”€ Template Generators â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function genPackageJson(opts: ScaffoldOptions): string {
  const ver = opts.monorepo ? 'workspace:*' : 'latest';
  const deps: Record<string, string> = {
    [FRAMEWORK_PACKAGE_NAME]: ver,
  };
  if (opts.ui) deps['@kuratchi/ui'] = ver;
  if (opts.orm) deps['@kuratchi/orm'] = ver;
  if (opts.auth) deps['@kuratchi/auth'] = ver;

  // In monorepo, scripts call the local CLI via bun with correct relative path
  let devScript = 'kuratchi dev';
  let buildScript = 'kuratchi build';
  if (opts.monorepo && opts.monorepoRoot) {
    const cliAbs = path.join(opts.monorepoRoot!, 'packages', 'kuratchi-js', 'src', 'cli.ts');
    const relCli = path.relative(opts.projectDir, cliAbs).replace(/\\/g, '/');
    devScript = `bun run --bun ${relCli} dev`;
    buildScript = `bun run --bun ${relCli} build`;
  }

  return JSON.stringify({
    name: opts.monorepo ? `@kuratchi/${opts.name}` : opts.name,
    version: '0.0.1',
    private: true,
    type: 'module',
    scripts: {
      dev: devScript,
      build: buildScript,
    },
    dependencies: deps,
    devDependencies: {
      '@cloudflare/workers-types': '^4.20250214.0',
      'wrangler': '^4.14.0',
    },
  }, null, 2) + '\n';
}

function genWrangler(opts: ScaffoldOptions): string {
  const config: any = {
    name: opts.name,
    main: '.kuratchi/worker.ts',
    compatibility_date: new Date().toISOString().split('T')[0],
    compatibility_flags: ['nodejs_compat'],
  };

  if (opts.orm) {
    config.d1_databases = [
      {
        binding: 'DB',
        database_name: `${opts.name}-db`,
        database_id: 'local-dev-only',
      },
    ];
  }

  if (opts.do) {
    config.durable_objects = {
      bindings: [{ name: 'NOTES_DO', class_name: 'NotesDO' }],
    };
    config.migrations = [
      { tag: 'v1', new_sqlite_classes: ['NotesDO'] },
    ];
  }

  return JSON.stringify(config, null, 2) + '\n';
}

function genConfig(opts: ScaffoldOptions): string {
  const lines: string[] = [];

  lines.push(`import { defineConfig } from '${FRAMEWORK_PACKAGE_NAME}';`);
  if (opts.ui) {
    lines.push(`import { kuratchiUiConfig } from '@kuratchi/ui/adapter';`);
  }
  if (opts.orm || opts.do) {
    lines.push(`import { kuratchiOrmConfig } from '@kuratchi/orm/adapter';`);
  }
  if (opts.auth) {
    lines.push(`import { kuratchiAuthConfig } from '@kuratchi/auth/adapter';`);
  }
  if (opts.orm) {
    lines.push(`import { appSchema } from './src/schemas/app';`);
  }
  if (opts.do) {
    lines.push(`import { notesSchema } from './src/schemas/notes';`);
  }
  lines.push('');
  lines.push('export default defineConfig({');

  // UI
  if (opts.ui) {
    lines.push('  ui: kuratchiUiConfig({');
    lines.push("    theme: 'default',");
    lines.push('  }),');
  }

  // ORM (D1 + DO databases combined into a single kuratchiOrmConfig call)
  if (opts.orm || opts.do) {
    lines.push('  orm: kuratchiOrmConfig({');
    lines.push('    databases: {');
    if (opts.orm) lines.push("      DB: { schema: appSchema },");
    if (opts.do)  lines.push("      NOTES_DO: { schema: notesSchema, type: 'do' },");
    lines.push('    }');
    lines.push('  }),');
  }

  // Durable Objects
  if (opts.do) {
    lines.push('  durableObjects: {');
    lines.push("    NOTES_DO: { className: 'NotesDO' },");
    lines.push('  },');
  }

  // Auth
  if (opts.auth) {
    lines.push('  auth: kuratchiAuthConfig({');
    lines.push("    cookieName: 'kuratchi_session',");
    lines.push('    sessionEnabled: true,');
    lines.push('  }),');
  }

  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

function genTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: 'ESNext',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      types: ['./worker-configuration.d.ts'],
    },
    include: ['src/**/*.ts', 'kuratchi.config.ts'],
    exclude: ['node_modules'],
  }, null, 2) + '\n';
}

function genGitIgnore(): string {
  return `node_modules/
.wrangler/
.dev.vars
.kuratchi/
worker-configuration.d.ts
dist/
`;
}

// ── Durable Object templates ──────────────────────────────────────────────────

function genNotesSchema(): string {
  return `import type { SchemaDsl } from '@kuratchi/orm';

export const notesSchema: SchemaDsl = {
  name: 'notes',
  version: 1,
  tables: {
    notes: {
      id: 'integer primary key',
      title: 'text not null',
      created_at: 'text not null default now',
    },
  },
};

export interface Note {
  id: number;
  title: string;
  created_at: string;
}
`;
}

function genNotesDoHandler(): string {
  return `import { kuratchiDO } from '${FRAMEWORK_PACKAGE_NAME}';
import type { Note } from '../schemas/notes';

export default class NotesDO extends kuratchiDO {
  static binding = 'NOTES_DO';

  async getNotes(): Promise<Note[]> {
    return (await this.db.notes.orderBy({ created_at: 'desc' }).many()).data ?? [];
  }

  async addNote(title: string): Promise<void> {
    await this.db.notes.insert({ title });
  }

  async deleteNote(id: number): Promise<void> {
    await this.db.notes.delete({ id });
  }
}
`;
}

function genNotesDb(): string {
  return `import { env } from 'cloudflare:workers';
import type { Note } from '../schemas/notes';

function getStub() {
  return (env as any).NOTES_DO.get((env as any).NOTES_DO.idFromName('global'));
}

export async function getNotes(): Promise<Note[]> {
  return getStub().getNotes();
}

export async function addNote({ formData }: FormData): Promise<void> {
  const title = String(formData.get('title') || '').trim();
  if (!title) throw new Error('Note is required');
  await getStub().addNote(title);
}

export async function deleteNote(id: number): Promise<void> {
  await getStub().deleteNote(Number(id));
}
`;
}

function genNotesPage(): string {
  return `<script>
  import { getNotes, addNote, deleteNote } from '$server/notes';

  const notes = await getNotes();
</script>

<header>
  <div>
    <h1>Notes</h1>
    <p>Backed by a Cloudflare Durable Object with SQLite storage</p>
  </div>
</header>

<form action={addNote} method="POST">
  <input type="text" name="title" placeholder="New note..." required />
  <button type="submit">Add</button>
</form>

if (notes.length === 0) {
  <p style="opacity: 0.6">No notes yet.</p>
} else {
  <section>
    for (const note of notes) {
      <article>
        <span>{note.title}</span>
        <form action={deleteNote} method="POST" style="display: inline">
          <input type="hidden" name="id" value={note.id} />
          <button type="submit">Remove</button>
        </form>
      </article>
    }
  </section>
}
`;
}

function genLayout(opts: ScaffoldOptions): string {
  const navLinks: string[] = ['      <a href="/">Home</a>'];
  if (opts.orm) navLinks.push('      <a href="/items">Items</a>');
  if (opts.do)  navLinks.push('      <a href="/notes">Notes (DO)</a>');
  if (opts.auth) navLinks.push('      <a href="/admin">Admin</a>');

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${opts.name} â€” KuratchiJS</title>
</head>
<body>
  <header>
    <a href="/">âš¡ ${opts.name}</a>
    <nav>
${navLinks.join('\n')}
    </nav>
  </header>
  <main>
    <slot></slot>
  </main>
</body>
</html>
`;
}

function genLandingPage(opts: ScaffoldOptions): string {
  const imports: string[] = [];
  const cards: string[] = [];

  if (opts.ui) {
    imports.push("  import Badge from '@kuratchi/ui/badge.html';");
    imports.push("  import Card from '@kuratchi/ui/card.html';");
    imports.push("  import DataList from '@kuratchi/ui/data-list.html';");
    imports.push("  import DataItem from '@kuratchi/ui/data-item.html';");
  }

  let body = '';

  body += '<header>\n';
  body += '  <div>\n';
  body += `    <h1>${opts.name}</h1>\n`;
  body += '    <p>Built with KuratchiJS â€” a Cloudflare Workers-native framework</p>\n';
  body += '  </div>\n';
  body += '</header>\n\n';

  if (opts.orm) {
    body += '<div>\n';
    body += '  <a href="/items">\n';
    if (opts.ui) body += '    <Badge variant="success">D1 Database</Badge>\n';
    body += '    <h2>Items</h2>\n';
    body += '    <p>Full CRUD backed by Cloudflare D1. Schema auto-migrated on first request.</p>\n';
    body += '  </a>\n';
    if (opts.auth) {
      body += '  <a href="/admin">\n';
      if (opts.ui) body += '    <Badge variant="warning">Protected</Badge>\n';
      body += '    <h2>Admin</h2>\n';
      body += '    <p>Protected dashboard â€” sign in with credentials to access.</p>\n';
      body += '  </a>\n';
    }
    body += '</div>\n';
  }

  if (opts.ui) {
    body += '\n<Card title="Stack">\n';
    body += '  <DataList>\n';
    body += `    <DataItem label="Framework" value="${FRAMEWORK_PACKAGE_NAME}" />\n`;
    if (opts.orm) body += '    <DataItem label="ORM" value="@kuratchi/orm" />\n';
    if (opts.auth) body += '    <DataItem label="Auth" value="@kuratchi/auth" />\n';
    body += '    <DataItem label="UI" value="@kuratchi/ui" />\n';
    body += '  </DataList>\n';
    body += '</Card>\n';
  }

  if (imports.length > 0) {
    return `<script>\n${imports.join('\n')}\n</script>\n\n${body}`;
  }
  return body;
}

// â”€â”€ ORM Templates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function genSchema(opts: ScaffoldOptions): string {
  const tables: string[] = [];

  tables.push(`    items: {
      id: 'integer primary key',
      title: 'text not null',
      done: 'integer not null default 0',
      created_at: 'text not null default now',
    },`);

  if (opts.auth) {
    tables.push(`    users: {
      id: 'integer primary key',
      email: 'text not null unique',
      name: 'text',
      password_hash: 'text not null',
      created_at: 'text not null default now',
      updated_at: 'text not null default now',
    },
    session: {
      id: 'integer primary key',
      sessionToken: 'text not null unique',
      userId: 'integer not null',
      expires: 'integer not null',
      created_at: 'text not null default now',
      updated_at: 'text not null default now',
      deleted_at: 'text',
    },`);
  }

  const version = opts.auth ? 1 : 1;

  let types = `
export interface Item {
  id: number;
  title: string;
  done: number;
  created_at: string;
}`;

  if (opts.auth) {
    types += `

export interface User {
  id: number;
  email: string;
  name: string | null;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: number;
  sessionToken: string;
  userId: number;
  expires: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}`;
  }

  return `import type { SchemaDsl } from '@kuratchi/orm';

export const appSchema: SchemaDsl = {
  name: '${opts.name}',
  version: ${version},
  tables: {
${tables.join('\n')}
  }
};
${types}
`;
}

function genItemsCrud(): string {
  return `import { env } from 'cloudflare:workers';
import { kuratchiORM } from '@kuratchi/orm';
import { redirect } from '${FRAMEWORK_PACKAGE_NAME}';
import type { Item } from '../schemas/app';

const db = kuratchiORM(() => (env as any).DB);

export async function getItems() {
  const result = await db.items.orderBy({ created_at: 'desc' }).many();
  return (result.data ?? []) as Item[];
}

export async function addItem({ formData }: FormData): Promise<void> {
  const title = (formData.get('title') as string)?.trim();
  if (!title) throw new Error('Title is required');
  await db.items.insert({ title });
}

export async function deleteItem(id: number): Promise<void> {
  await db.items.delete({ id });
}

export async function toggleItem(id: number): Promise<void> {
  const result = await db.items.where({ id }).first();
  const item = result.data as Item | null;
  if (item) {
    await db.items.where({ id }).update({ done: item.done ? 0 : 1 });
  }
}
`;
}

function genItemsPage(): string {
  return `<script>
  import { getItems, addItem, deleteItem, toggleItem } from '$server/items';
  import EmptyState from '@kuratchi/ui/empty-state.html';

  const items = await getItems();
</script>

<header>
  <div>
    <h1>Items</h1>
    <p>Full CRUD backed by Cloudflare D1</p>
  </div>
</header>

<form action={addItem} method="POST">
  <input type="text" name="title" placeholder="What needs to be done?" required />
  <button type="submit">Add</button>
</form>

if (items.length === 0) {
  <EmptyState message="No items yet â€” add one above" />
} else {
  <section>
    for (const item of items) {
      <article>
        <span style={item.done ? 'text-decoration: line-through; opacity: 0.5' : ''}>{item.title}</span>
        <div>
          <form action={toggleItem} method="POST" style="display: inline">
            <input type="hidden" name="id" value={item.id} />
            <button type="submit">{item.done ? 'â†©' : 'âœ“'}</button>
          </form>
          <form action={deleteItem} method="POST" style="display: inline">
            <input type="hidden" name="id" value={item.id} />
            <button type="submit">âœ•</button>
          </form>
        </div>
      </article>
    }
  </section>
}
`;
}

// â”€â”€ Auth Templates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function genDevVars(): string {
  const secret = crypto.randomBytes(32).toString('hex');
  return `AUTH_SECRET=${secret}\n`;
}

function genAuthFunctions(): string {
  return `import { env } from 'cloudflare:workers';
import { kuratchiORM } from '@kuratchi/orm';
import {
  hashPassword,
  comparePassword,
  generateSessionToken,
  hashToken,
  buildSessionCookie,
  parseSessionCookie,
} from '@kuratchi/auth';
import { getAuth } from '@kuratchi/auth';
import { redirect } from '${FRAMEWORK_PACKAGE_NAME}';
import type { User } from '../schemas/app';

const db = kuratchiORM(() => (env as any).DB);

// â”€â”€ Sign Up â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function signUp({ formData }: FormData): Promise<void> {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const name = (formData.get('name') as string)?.trim() || null;

  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  // Check if user already exists
  const existing = await db.users.where({ email }).first();
  if (existing.data && existing.data.id) {
    throw new Error('An account with this email already exists');
  }

  // Hash password with AUTH_SECRET as pepper
  const secret = (env as any).AUTH_SECRET || '';
  const hashedPassword = await hashPassword(password, undefined, secret);

  // Create user
  const insertResult = await db.users.insert({
    email,
    name,
    password_hash: hashedPassword,
  });
  if (!insertResult.success) {
    throw new Error('Failed to create account');
  }

  // Redirect to login after successful signup
  redirect('/auth/login');
}

// â”€â”€ Sign In â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function signIn({ formData }: FormData): Promise<void> {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;

  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  // Look up user
  const result = await db.users.where({ email }).first();
  const user = (result.data ?? null) as User | null;

  if (!user || !user.password_hash) {
    throw new Error('Invalid email or password');
  }

  // Verify password
  const secret = (env as any).AUTH_SECRET || '';
  const isValid = await comparePassword(password, user.password_hash, secret);

  if (!isValid) {
    throw new Error('Invalid email or password');
  }

  // Create session token
  const sessionToken = generateSessionToken();
  const sessionTokenHash = await hashToken(sessionToken);

  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // Store session in DB
  await db.session.insert({
    sessionToken: sessionTokenHash,
    userId: user.id,
    expires: expires.getTime(),
  });

  // Build encrypted session cookie
  const sessionCookie = await buildSessionCookie(
    secret,
    'default',
    sessionTokenHash
  );

  // Set cookie on response
  const auth = getAuth();
  const setCookieHeader = auth.buildSetCookie('kuratchi_session', sessionCookie, {
    expires,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  });

  const locals = auth.getLocals();
  if (!locals.__setCookieHeaders) locals.__setCookieHeaders = [];
  locals.__setCookieHeaders.push(setCookieHeader);

  // Redirect to admin after successful login
  redirect('/admin');
}

// â”€â”€ Sign Out â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function signOut({ formData }: FormData): Promise<void> {
  const auth = getAuth();
  const sessionCookie = auth.getSessionCookie();

  if (sessionCookie) {
    const secret = (env as any).AUTH_SECRET || '';
    const parsed = await parseSessionCookie(secret, sessionCookie);
    if (parsed) {
      await db.session.delete({ sessionToken: parsed.tokenHash });
    }
  }

  // Clear cookie
  const clearHeader = auth.buildClearCookie('kuratchi_session');
  const locals = auth.getLocals();
  if (!locals.__setCookieHeaders) locals.__setCookieHeaders = [];
  locals.__setCookieHeaders.push(clearHeader);

  // Redirect to login after sign out
  redirect('/auth/login');
}

// â”€â”€ Get Current User â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getCurrentUser() {
  const auth = getAuth();
  const sessionCookie = auth.getSessionCookie();

  if (!sessionCookie) return null;

  const secret = (env as any).AUTH_SECRET || '';
  const parsed = await parseSessionCookie(secret, sessionCookie);
  if (!parsed) return null;

  // Look up session in DB
  const sessionResult = await db.session
    .where({ sessionToken: parsed.tokenHash })
    .first();
  const session = (sessionResult.data ?? null) as any;

  if (!session) return null;

  // Check expiry
  if (session.expires < Date.now()) {
    await db.session.delete({ sessionToken: parsed.tokenHash });
    return null;
  }

  // Look up user
  const userResult = await db.users.where({ id: session.userId }).first();
  const user = (userResult.data ?? null) as User | null;

  if (!user) return null;

  // Return safe user (no password_hash)
  const { password_hash, ...safeUser } = user;
  return safeUser;
}
`;
}

function genAdminLoader(): string {
  return `import { getCurrentUser } from './auth';

export { signOut } from './auth';

export async function getAdminData() {
  const user = await getCurrentUser();
  return {
    isAuthenticated: !!user,
    user,
    timestamp: new Date().toISOString(),
  };
}
`;
}

function genLoginPage(): string {
  return `<script>
  import { signIn } from '$server/auth';
  import AuthCard from '@kuratchi/ui/auth-card.html';
</script>

<AuthCard
  title="Sign In"
  subtitle="Welcome back â€” sign in to your account"
  footerText="Don't have an account?"
  footerLink="Sign up"
  footerHref="/auth/signup"
  error={signIn.error}
>
  <form action={signIn} method="POST" class="kui-auth-form">
    <div class="kui-field">
      <label for="email">Email</label>
      <input type="email" id="email" name="email" placeholder="you@example.com" required autocomplete="email" />
    </div>
    <div class="kui-field">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" required autocomplete="current-password" minlength="8" />
    </div>
    <button type="submit" class="kui-button kui-button--primary kui-button--block kui-auth-submit">Sign In</button>
  </form>
</AuthCard>
`;
}

function genSignupPage(): string {
  return `<script>
  import { signUp } from '$server/auth';
  import AuthCard from '@kuratchi/ui/auth-card.html';
</script>

<AuthCard
  title="Create Account"
  subtitle="Sign up to get started"
  footerText="Already have an account?"
  footerLink="Sign in"
  footerHref="/auth/login"
  error={signUp.error}
>
  <form action={signUp} method="POST" class="kui-auth-form">
    <div class="kui-field">
      <label for="name">Name</label>
      <input type="text" id="name" name="name" placeholder="Your name" autocomplete="name" />
    </div>
    <div class="kui-field">
      <label for="email">Email</label>
      <input type="email" id="email" name="email" placeholder="you@example.com" required autocomplete="email" />
    </div>
    <div class="kui-field">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" required autocomplete="new-password" minlength="8" />
    </div>
    <button type="submit" class="kui-button kui-button--primary kui-button--block kui-auth-submit">Create Account</button>
  </form>
</AuthCard>
`;
}

function genAdminPage(): string {
  return `<script>
  import { getAdminData, signOut } from '$server/admin';
  import Badge from '@kuratchi/ui/badge.html';
  import Card from '@kuratchi/ui/card.html';
  import DataList from '@kuratchi/ui/data-list.html';
  import DataItem from '@kuratchi/ui/data-item.html';

  const admin = await getAdminData();
</script>

if (!admin.isAuthenticated) {
  <head>
    <meta http-equiv="refresh" content="0;url=/auth/login" />
  </head>
  <p>Redirecting to login...</p>
} else {
  <header>
    <div>
      <h1>Admin Dashboard</h1>
      <p>Welcome back, {admin.user.name || admin.user.email}</p>
    </div>
    <Badge variant="success">Authenticated</Badge>
  </header>

  <Card title="User Info">
    <DataList>
      <DataItem label="Email" value={admin.user.email} />
      <DataItem label="Name" value={admin.user.name || 'â€”'} />
      <DataItem label="User ID" value={String(admin.user.id)} />
      <DataItem label="Created" value={admin.user.created_at} />
    </DataList>
  </Card>

  <Card title="Session">
    <DataList>
      <DataItem label="Timestamp" value={admin.timestamp} />
    </DataList>
  </Card>

  <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
    <a href="/" class="kui-button kui-button--outline">&larr; Back to Home</a>
    <form action={signOut} method="POST" style="margin: 0;">
      <button type="submit" class="kui-button kui-button--danger">Sign Out</button>
    </form>
  </div>
}
`;
}

// ── Scaffold (Vite — default) ──────────────────────────────────────
//
// Vite is the canonical KuratchiJS build pipeline. This scaffolder
// emits a minimal project wired for `@kuratchi/vite`:
//
//   - `vite.config.ts` with the `kuratchiVite()` plugin (auto-syncs
//     `wrangler.jsonc`, discovers routes / containers / sandboxes /
//     durable objects, provides `kuratchi:*` virtual modules).
//   - `src/worker.ts` — one-liner re-export of `kuratchi:worker`.
//   - `src/middleware.ts` — empty runtime definition the user extends
//     (auth, logging, feature flags) with full type support.
//   - `src/routes/*.kuratchi` — route files with the canonical
//     extension. `.html` files in `src/routes/` are ignored by the
//     compiler.
//   - `src/assets/styles.css` — static asset served from the root path
//     via Wrangler's assets binding + Vite's publicDir (auto-wired).
//
// We re-use every `gen*Page` / `gen*CRUD` / `gen*Schema` helper from
// the legacy scaffolder because their bodies are identical between
// templates — only the file extension and surrounding project files
// differ.
function scaffoldVite(dir: string, opts: ScaffoldOptions) {
  const { orm, auth } = opts;
  const enableDO = opts.do;

  const dirs = [
    '',
    'src',
    'src/routes',
    'src/assets',
  ];
  if (orm || enableDO) dirs.push('src/schemas');
  if (orm || enableDO || auth) dirs.push('src/server');
  if (enableDO) dirs.push('src/routes/notes');
  if (auth) dirs.push('src/routes/auth', 'src/routes/auth/login', 'src/routes/auth/signup', 'src/routes/admin');
  if (orm) dirs.push('src/routes/items');

  for (const d of dirs) {
    fs.mkdirSync(path.join(dir, d), { recursive: true });
  }

  write(dir, 'package.json', genVitePackageJson(opts));
  write(dir, 'vite.config.ts', genViteConfig());
  write(dir, 'wrangler.jsonc', genViteWrangler(opts));
  write(dir, 'kuratchi.config.ts', genConfig(opts));
  write(dir, 'tsconfig.json', genViteTsConfig());
  write(dir, '.gitignore', genViteGitIgnore());
  write(dir, 'src/worker.ts', genViteWorker());
  write(dir, 'src/middleware.ts', genViteMiddleware());
  write(dir, 'src/assets/styles.css', genViteAssetsCss());
  write(dir, 'src/routes/layout.kuratchi', genLayout(opts));
  write(dir, 'src/routes/index.kuratchi', genLandingPage(opts));

  if (orm) {
    write(dir, 'src/schemas/app.ts', genSchema(opts));
    write(dir, 'src/server/items.ts', genItemsCrud());
    write(dir, 'src/routes/items/index.kuratchi', genItemsPage());
  }

  if (enableDO) {
    write(dir, 'src/schemas/notes.ts', genNotesSchema());
    write(dir, 'src/server/notes.do.ts', genNotesDoHandler());
    write(dir, 'src/server/notes.ts', genNotesDb());
    write(dir, 'src/routes/notes/index.kuratchi', genNotesPage());
  }

  if (auth) {
    write(dir, '.dev.vars', genDevVars());
    write(dir, 'src/server/auth.ts', genAuthFunctions());
    write(dir, 'src/server/admin.ts', genAdminLoader());
    write(dir, 'src/routes/auth/login/index.kuratchi', genLoginPage());
    write(dir, 'src/routes/auth/signup/index.kuratchi', genSignupPage());
    write(dir, 'src/routes/admin/index.kuratchi', genAdminPage());
  }
}

function genVitePackageJson(opts: ScaffoldOptions): string {
  const ver = opts.monorepo ? 'workspace:*' : 'latest';
  const deps: Record<string, string> = {
    [FRAMEWORK_PACKAGE_NAME]: ver,
  };
  if (opts.ui) deps['@kuratchi/ui'] = ver;
  if (opts.orm) deps['@kuratchi/orm'] = ver;
  if (opts.auth) deps['@kuratchi/auth'] = ver;

  return JSON.stringify({
    name: opts.monorepo ? `@kuratchi/${opts.name}` : opts.name,
    version: '0.0.1',
    private: true,
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'wrangler dev',
      deploy: 'vite build && wrangler deploy',
    },
    dependencies: deps,
    devDependencies: {
      '@cloudflare/workers-types': '^4.20250214.0',
      '@kuratchi/vite': ver,
      'vite': '^7.0.0',
      'wrangler': '^4.14.0',
    },
  }, null, 2) + '\n';
}

function genViteConfig(): string {
  return `import { defineConfig } from 'vite';
import { kuratchiVite } from '@kuratchi/vite';

// The \`kuratchiVite()\` plugin owns:
//   - Route discovery (\`src/routes/**/*.kuratchi\`)
//   - Virtual modules (\`kuratchi:worker\`, \`kuratchi:request\`, etc.)
//   - Auto-sync of \`wrangler.jsonc\` (containers, sandboxes, DOs, queues, assets)
//   - ORM migrations on first request
// No extra config is needed for the common case — drop it in and run \`vite dev\`.
export default defineConfig({
  plugins: [kuratchiVite()],
});
`;
}

function genViteWrangler(opts: ScaffoldOptions): string {
  // Vite emits the final worker entry into \`dist/\`, but the
  // \`kuratchiVite\` plugin rewrites \`main\` if necessary at build time.
  // We keep the config minimal here and point at the source entry so
  // \`wrangler dev\` (used for preview of the prod-shaped bundle) works.
  const config: any = {
    name: opts.name,
    main: 'src/worker.ts',
    compatibility_date: new Date().toISOString().split('T')[0],
    compatibility_flags: ['nodejs_compat'],
    assets: { directory: 'src/assets' },
  };

  if (opts.orm) {
    config.d1_databases = [
      { binding: 'DB', database_name: `${opts.name}-db`, database_id: 'local-dev-only' },
    ];
  }

  if (opts.do) {
    config.durable_objects = { bindings: [{ name: 'NOTES_DO', class_name: 'NotesDO' }] };
    config.migrations = [{ tag: 'v1', new_sqlite_classes: ['NotesDO'] }];
  }

  return JSON.stringify(config, null, 2) + '\n';
}

function genViteWorker(): string {
  // `kuratchi:worker` is the virtual module synthesized by the
  // `kuratchiVite` plugin. It wires the dispatcher + middleware +
  // route registry into the Workers `fetch` + `queue` exports, so the
  // user never has to hand-write them.
  return `export { default } from 'kuratchi:worker';
`;
}

function genViteMiddleware(): string {
  // Every Vite project gets a middleware file. Empty by default —
  // the user extends it with auth, logging, etc. Kuratchi's dispatcher
  // reads this via the `kuratchi:middleware` virtual module.
  return `import { defineMiddleware } from '@kuratchi/js';

/**
 * Request middleware. Each step can hook into:
 *   - \`request(ctx, next)\` — before routing
 *   - \`route(ctx, next)\`   — after routing, before render
 *   - \`response(ctx, res)\` — after render
 *   - \`error(ctx, err)\`    — on thrown errors
 *
 * Steps run in the order defined here. Mutate \`ctx.locals\` to share
 * data with \`$server/*\` modules and route actions.
 */
export default defineMiddleware({
  // Example:
  // auth: {
  //   async request(ctx, next) {
  //     ctx.locals.user = await getUser(ctx.request);
  //     return next();
  //   },
  // },
});
`;
}

function genViteTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: 'ESNext',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      types: ['./worker-configuration.d.ts'],
    },
    include: ['src/**/*.ts', 'kuratchi.config.ts', 'vite.config.ts'],
    exclude: ['node_modules', 'dist'],
  }, null, 2) + '\n';
}

function genViteGitIgnore(): string {
  return `node_modules/
.wrangler/
.dev.vars
dist/
worker-configuration.d.ts
`;
}

function genViteAssetsCss(): string {
  // Minimal reset so the landing page doesn't ship naked HTML. Users
  // are expected to replace this with their own stylesheet or opt
  // into Tailwind via the \`css.tailwind\` Kuratchi config option.
  return `:root {
  color-scheme: light dark;
  font-family: system-ui, -apple-system, sans-serif;
}
body { margin: 0; padding: 2rem; max-width: 48rem; margin-inline: auto; }
header { margin-bottom: 2rem; }
nav { display: flex; gap: 1rem; }
`;
}
