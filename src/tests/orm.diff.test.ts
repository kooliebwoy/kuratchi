import { describe, it, expect } from 'vitest';
import { buildDiffSql } from '../lib/orm/diff.js';
import type { DatabaseSchema } from '../lib/orm/json-schema.js';

describe('orm diff', () => {
  it('generates additive ALTER TABLE/CREATE statements and warnings', () => {
    const fromSchema: DatabaseSchema = {
      name: 'test',
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'text', primaryKey: true, notNull: true },
            { name: 'email', type: 'text', unique: true },
          ],
          indexes: [{ name: 'email_idx', columns: ['email'], unique: true }],
        },
      ],
    };

    const toSchema: DatabaseSchema = {
      name: 'test',
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'text', primaryKey: true, notNull: true },
            { name: 'email', type: 'text', unique: true },
            { name: 'status', type: 'integer', notNull: true }, // no default -> warning
            { name: 'created_at', type: 'text', notNull: true, default: { kind: 'raw', sql: 'CURRENT_TIMESTAMP' } },
          ],
          indexes: [
            { name: 'email_idx', columns: ['email'], unique: true },
            { name: 'users_status_idx', columns: ['status'] },
          ],
        },
        {
          name: 'orgs',
          columns: [
            { name: 'id', type: 'text', primaryKey: true, notNull: true },
          ],
        },
      ],
    };

    const { sql, warnings } = buildDiffSql(fromSchema, toSchema);

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS orgs');
    expect(sql).toContain('ALTER TABLE users ADD COLUMN status INTEGER');
    expect(sql).toContain('ALTER TABLE users ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS users_status_idx ON users(status)');

    expect(warnings.find((w) => w.includes('NOT NULL column users.status'))).toBeTruthy();
  });
});
