import { describe, it, expect } from 'vitest';
import { buildInitialSql } from '../lib/orm/sqlite-generator.js';
import type { DatabaseSchema } from '../lib/orm/json-schema.js';

describe('sqlite-generator', () => {
  it('builds create table and index SQL', () => {
    const schema: DatabaseSchema = {
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

    const sql = buildInitialSql(schema);
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(sql).toContain('id TEXT NOT NULL PRIMARY KEY');
    expect(sql).toContain('email TEXT UNIQUE');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS email_idx ON users(email)');
  });
});
