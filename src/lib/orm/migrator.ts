import type { DatabaseSchema } from './json-schema.js';
import { buildInitialSql } from './sqlite-generator.js';

export type MigrationJournal = { entries: { idx: number; tag: string }[] };

export function generateInitialMigrationBundle(schema: DatabaseSchema, opts?: { tag?: string }) {
  const tag = opts?.tag || 'initial';
  const sql = buildInitialSql(schema);
  const journal: MigrationJournal = { entries: [{ idx: 1, tag }] };
  const migrations: Record<string, () => Promise<string>> = {
    m0001: async () => sql,
  };
  return { journal, migrations };
}
