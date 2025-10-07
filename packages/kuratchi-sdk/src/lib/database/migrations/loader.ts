import type { MigrationJournal } from './migration-utils.js';

// ----- Vite-only migration loader -----
// These globs are only available when bundled under Vite. Safe to define at top-level.
// Consumers outside Vite should not call loadMigrations().
const allSqlMigrationModules: Record<string, any> = (import.meta as any).glob
  ? (import.meta as any).glob('/migrations-*/*.sql', { query: '?raw', eager: false })
  : {};

const allJournalModules: Record<string, any> = (import.meta as any).glob
  ? (import.meta as any).glob('/migrations-*/meta/_journal.json', { eager: true })
  : {};

export async function loadMigrations(dirName: string): Promise<{
  journal: MigrationJournal;
  migrations: Record<string, () => Promise<string>>;
}> {
  // Note: In Vite-built bundles (including SvelteKit on Cloudflare Workers), import.meta.glob
  // calls are compiled away at build time into static objects. That means at runtime
  // `(import.meta as any).glob` may be undefined, but the pre-generated glob maps above
  // (allJournalModules, allSqlMigrationModules) will contain the resolved modules.
  // Therefore, do NOT gate on the presence of import.meta.glob at runtime. Instead, verify
  // that the glob maps have entries. If they are empty, it means we weren't bundled by Vite
  // and the loader cannot function in this environment.
  if (Object.keys(allJournalModules).length === 0 || Object.keys(allSqlMigrationModules).length === 0) {
    throw new Error('loadMigrations() requires a Vite-bundled environment with preloaded migration assets. In Node/CLI, load migrations from the filesystem bundle.');
  }

  const migrations: Record<string, () => Promise<string>> = {};
  const baseMigrationPath = `/migrations-${dirName}`;

  // 1) Load the journal for the requested directory
  const journalPathKey = `${baseMigrationPath}/meta/_journal.json`;
  const journalModule: any = (allJournalModules as any)[journalPathKey];

  if (!journalModule) {
    console.error(`Journal module not found for key: ${journalPathKey}`);
    console.error('Available journal keys:', Object.keys(allJournalModules));
    throw new Error(`Could not find pre-loaded journal file for ${dirName}`);
  }

  const journal: MigrationJournal =
    journalModule?.default?.journal ?? journalModule?.journal ?? journalModule?.default ?? journalModule;

  if (!journal || !Array.isArray((journal as any).entries)) {
    console.error('Invalid journal format in module:', journalModule);
    throw new Error(`Invalid journal format for ${dirName}`);
  }

  // 2) Build migrations map using the journal entries
  for (const entry of journal.entries) {
    const migrationKey = `m${String(entry.idx).padStart(4, '0')}`;
    const sqlFileName = `${entry.tag}.sql`;
    const fullSqlPath = `${baseMigrationPath}/${sqlFileName}`;

    const importFn = (allSqlMigrationModules as any)[fullSqlPath] as undefined | (() => Promise<any>);
    if (importFn) {
      migrations[migrationKey] = async () => {
        const mod = await importFn();
        const content = (mod as any).default ?? mod;
        if (typeof content !== 'string') {
          throw new Error(`Unexpected SQL module shape for ${fullSqlPath}`);
        }
        return content;
      };
    } else {
      console.warn(`Could not find SQL migration module for tag: ${entry.tag} at expected path: ${fullSqlPath}`);
      console.warn('Available SQL glob paths:', Object.keys(allSqlMigrationModules));
      migrations[migrationKey] = async () => {
        throw new Error(`SQL content for migration ${entry.tag} (${fullSqlPath}) not found.`);
      };
    }
  }

  return { journal, migrations };
}

// ----- FS-based migration loader -----
// Creates a loader compatible with the migration bundle shape expected by the HTTP client/CLI.
export async function createFsMigrationLoader(root: string): Promise<{
  loadJournal: (dir: string) => Promise<MigrationJournal>;
  loadSql: (dir: string, tag: string) => Promise<string>;
}> {
  // Dynamic imports to avoid bundling fs/path in non-Node environments
  // @ts-ignore optional Node import
  const path: any = await import('path');
  // @ts-ignore optional Node import
  const fs: any = await import('fs');

  const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
  const readText = (p: string) => fs.readFileSync(p, 'utf8');

  const loadJournal = async (_dir: string) => {
    const journalPath = path.join(root, 'meta', '_journal.json');
    if (!fs.existsSync(journalPath)) throw new Error(`Journal not found at ${journalPath}`);
    const j = readJson(journalPath);
    if (!j || !Array.isArray(j.entries)) throw new Error('Invalid journal format');
    return j as MigrationJournal;
  };

  const loadSql = async (_dir: string, tag: string) => {
    const sqlPath = path.join(root, `${tag}.sql`);
    if (!fs.existsSync(sqlPath)) throw new Error(`SQL not found for tag ${tag} at ${sqlPath}`);
    return readText(sqlPath);
  };

  return { loadJournal, loadSql };
}
