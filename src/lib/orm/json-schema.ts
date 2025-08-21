// JSON-based schema format for SQLite (Kuratchi thin ORM)
// Defines tables, columns, indexes in a serializable format that can be
// converted into SQL and migration bundles.

export type SqlDefault =
  | { kind: 'raw'; sql: string }
  | { kind: 'value'; value: string | number | boolean | null };

export type Reference = {
  table: string;
  column: string;
  onDelete?: 'cascade' | 'restrict' | 'set null' | 'no action' | 'set default';
};

export type Column = {
  name: string;
  type: 'text' | 'integer' | 'real' | 'blob' | 'json';
  // For integer columns, a semantic mode helps generate helpful defaults/checks
  mode?: 'boolean' | 'timestamp_ms';
  notNull?: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  // Optional enum constraint (CHECK col IN (...))
  enum?: string[];
  default?: SqlDefault;
  references?: Reference;
};

export type Index = {
  name: string;
  columns: string[];
  unique?: boolean;
};

export type Table = {
  name: string;
  columns: Column[];
  indexes?: Index[];
  // Optional raw CHECK constraints at table level
  checks?: string[];
  comment?: string;
};

export type DatabaseSchema = {
  name: string; // e.g. 'admin' | 'organization'
  version?: number;
  tables: Table[];
};

export function isDatabaseSchema(v: any): v is DatabaseSchema {
  return (
    v &&
    typeof v === 'object' &&
    typeof v.name === 'string' &&
    Array.isArray(v.tables)
  );
}
