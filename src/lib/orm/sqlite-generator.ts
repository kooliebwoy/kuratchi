import type { Column, DatabaseSchema, Index, Table } from './json-schema.js';

function q(str: string): string {
  // For SQLite in our controlled schema names we avoid quoting by default
  // to match existing SQL. This can be upgraded if needed.
  return str;
}

function sqlType(col: Column): string {
  switch (col.type) {
    case 'text': return 'TEXT';
    case 'integer': return 'INTEGER';
    case 'real': return 'REAL';
    case 'blob': return 'BLOB';
    case 'json': return 'TEXT'; // store JSON as TEXT; callers can enforce checks
    default: return 'TEXT';
  }
}

function defaultSql(d?: Column['default']): string | undefined {
  if (!d) return undefined;
  if (d.kind === 'raw') return `DEFAULT ${d.sql}`;
  const v = d.value;
  if (v === null) return 'DEFAULT NULL';
  if (typeof v === 'number') return `DEFAULT ${v}`;
  if (typeof v === 'boolean') return `DEFAULT ${v ? 1 : 0}`;
  // string
  const escaped = String(v).replace(/'/g, "''");
  return `DEFAULT '${escaped}'`;
}

function enumCheck(col: Column): string | undefined {
  if (!col.enum || !col.enum.length) return undefined;
  const values = col.enum.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(', ');
  return `CHECK (${q(col.name)} IN (${values}))`;
}

function columnDef(col: Column): string {
  const parts: string[] = [q(col.name), sqlType(col)];
  if (col.notNull) parts.push('NOT NULL');
  if (col.unique) parts.push('UNIQUE');
  if (col.primaryKey) parts.push('PRIMARY KEY');
  const dsql = defaultSql(col.default);
  if (dsql) parts.push(dsql);
  if (col.references) {
    const ref = col.references;
    let r = `REFERENCES ${q(ref.table)}(${q(ref.column)})`;
    if (ref.onDelete) r += ` ON DELETE ${ref.onDelete.toUpperCase()}`;
    parts.push(r);
  }
  const chk = enumCheck(col);
  if (chk) parts.push(chk);
  return parts.join(' ');
}

function createTableSql(t: Table): string {
  const lines: string[] = t.columns.map((c) => `  ${columnDef(c)}`);
  if (t.checks && t.checks.length) {
    for (const c of t.checks) lines.push(`  CHECK (${c})`);
  }
  return `CREATE TABLE IF NOT EXISTS ${q(t.name)} (\n${lines.join(',\n')}\n)`;
}

function createIndexSql(table: Table, idx: Index): string {
  const cols = idx.columns.map((c) => q(c)).join(', ');
  const uniq = idx.unique ? 'UNIQUE ' : '';
  return `CREATE ${uniq}INDEX IF NOT EXISTS ${q(idx.name)} ON ${q(table.name)}(${cols})`;
}

export function schemaToSqlStatements(schema: DatabaseSchema): { tables: string[]; indexes: string[] } {
  const tables: string[] = [];
  const indexes: string[] = [];
  for (const t of schema.tables) {
    tables.push(createTableSql(t));
    if (t.indexes) {
      for (const idx of t.indexes) indexes.push(createIndexSql(t, idx));
    }
  }
  return { tables, indexes };
}

export function buildInitialSql(schema: DatabaseSchema): string {
  const { tables, indexes } = schemaToSqlStatements(schema);
  const stmts = [...tables, ...indexes];
  return stmts.map((s) => `${s};`).join('\n\n');
}

// --- Render helper exports for diff generator ---
export function renderColumnDef(col: Column): string {
  return columnDef(col);
}

export function renderCreateTableSql(t: Table): string {
  return createTableSql(t);
}

export function renderCreateIndexSql(table: Table, idx: Index): string {
  return createIndexSql(table, idx);
}
