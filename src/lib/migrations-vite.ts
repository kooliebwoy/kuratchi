// Vite-only migration loader using absolute root globs.
// This expects the app to have directories like:
//   /migrations-<dirName>/meta/_journal.json
//   /migrations-<dirName>/<tag>.sql
//
// Example usage in app code (SvelteKit on Cloudflare Workers):
//   await sdk.db({ databaseName, apiToken }).migrateAuto('client')
//
// Note: This file relies on import.meta.glob which is provided by Vite.

export type MigrationJournal = { entries: { idx: number; tag: string }[] };

const allSqlMigrationModules = import.meta.glob('/migrations-*/*.sql', {
  query: '?raw',
  eager: false,
});

const allJournalModules = import.meta.glob('/migrations-*/meta/_journal.json', {
  eager: true,
});

export async function loadMigrations(dirName: string): Promise<{
  journal: MigrationJournal;
  migrations: Record<string, () => Promise<string>>;
}> {
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
