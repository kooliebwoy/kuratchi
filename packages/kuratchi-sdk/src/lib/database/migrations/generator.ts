/**
 * SQL Generation and Schema Diffing
 * Combines SQL generation from schemas and schema diffing functionality
 */

import type { Column, DatabaseSchema, Index, Table } from './schema.js';

// === SQL Generation Functions ===

function q(str: string): string {
  // Quote identifiers to handle reserved keywords (e.g., 'to', 'from', 'order', etc.)
  return `"${str.replace(/"/g, '""')}"`;
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
  return `CREATE TABLE IF NOT EXISTS ${q(t.name)} (
${lines.join(',\n')}
)`;
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

// === Schema Diffing Functions ===

export type DiffResult = {
  statements: string[];
  warnings: string[];
};

function byName<T extends { name: string }>(arr: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const x of arr) m.set(x.name, x);
  return m;
}

function safeAddColumnSql(table: Table, col: Column): { sql: string; warning?: string } {
  const type = (() => {
    switch (col.type) {
      case 'text': return 'TEXT';
      case 'integer': return 'INTEGER';
      case 'real': return 'REAL';
      case 'blob': return 'BLOB';
      case 'json': return 'TEXT';
      default: return 'TEXT';
    }
  })();

  const parts: string[] = [`ALTER TABLE ${table.name} ADD COLUMN ${col.name} ${type}`];

  // DEFAULT is safe; NOT NULL is only safe when DEFAULT provided
  if (col.default) {
    // Reuse default rendering logic inline
    if (col.default.kind === 'raw') {
      parts.push(`DEFAULT ${col.default.sql}`);
    } else {
      const v = col.default.value;
      if (v === null) {
        parts.push('DEFAULT NULL');
      } else if (typeof v === 'number') {
        parts.push(`DEFAULT ${v}`);
      } else if (typeof v === 'boolean') {
        parts.push(`DEFAULT ${v ? 1 : 0}`);
      } else {
        const escaped = String(v).replace(/'/g, "''");
        parts.push(`DEFAULT '${escaped}'`);
      }
    }
  }

  let warning: string | undefined;
  if (col.notNull) {
    if (col.default) {
      parts.push('NOT NULL');
    } else {
      warning = `Cannot safely add NOT NULL column ${table.name}.${col.name} without DEFAULT in SQLite; adding as nullable.`;
    }
  }

  // Constraints like UNIQUE/PRIMARY KEY/REFERENCES/CHECK cannot be added safely via ALTER TABLE ADD COLUMN
  if (col.unique || col.primaryKey || col.references || (col.enum && col.enum.length)) {
    const w = `Constraints for ${table.name}.${col.name} (unique/pk/fk/check) require table rebuild; not applied in ADD COLUMN.`;
    warning = warning ? `${warning} ${w}` : w;
  }

  return { sql: parts.join(' '), warning };
}

export function diffSchemas(from: DatabaseSchema, to: DatabaseSchema): DiffResult {
  const statements: string[] = [];
  const warnings: string[] = [];

  const fromTables = byName(from.tables);
  const toTables = byName(to.tables);

  // New tables (in 'to' but not in 'from')
  for (const [tname, t] of toTables) {
    if (!fromTables.has(tname)) {
      statements.push(renderCreateTableSql(t) + ';');
      if (t.indexes) {
        for (const idx of t.indexes) statements.push(renderCreateIndexSql(t, idx) + ';');
      }
    }
  }

  // Existing tables: detect additive columns and new indexes
  for (const [tname, tTo] of toTables) {
    const tFrom = fromTables.get(tname);
    if (!tFrom) continue;

    const fromCols = byName(tFrom.columns);
    const toCols = byName(tTo.columns);
    for (const col of tTo.columns) {
      if (!fromCols.has(col.name)) {
        const { sql, warning } = safeAddColumnSql(tTo, col);
        statements.push(sql + ';');
        if (warning) warnings.push(warning);
      }
    }

    for (const [colName, colFrom] of fromCols) {
      if (!toCols.has(colName)) {
        statements.push(`ALTER TABLE ${tname} DROP COLUMN ${colName};`);
        warnings.push(`Dropping column ${tname}.${colName} removes existing data. Verify SQLite version (>=3.35) supports DROP COLUMN${colFrom.primaryKey ? ' and ensure a new primary key is defined' : ''}.`);
      }
    }

    const toIdx = new Map<string, Index>();
    if (tTo.indexes) for (const i of tTo.indexes) toIdx.set(i.name, i);
    const fromIdx = new Map<string, Index>();
    if (tFrom.indexes) for (const i of tFrom.indexes) fromIdx.set(i.name, i);

    for (const [iname, idx] of toIdx) {
      const existing = fromIdx.get(iname);
      const same = existing && existing.unique === idx.unique &&
        JSON.stringify(existing.columns) === JSON.stringify(idx.columns);
      if (!existing || !same) {
        statements.push(renderCreateIndexSql(tTo, idx) + ';');
      }
    }

    // Optional: dropping indexes not present in 'to'
    for (const [iname, idxFrom] of fromIdx) {
      if (!toIdx.has(iname)) {
        statements.push(`DROP INDEX IF EXISTS ${iname};`);
        const droppedCols = idxFrom.columns.join(', ');
        warnings.push(`Index ${iname} on ${tname} referencing columns (${droppedCols}) removed to match target schema.`);
      }
    }

    // Checks/table-level constraints changes are not handled
    if (tTo.checks && JSON.stringify(tTo.checks) !== JSON.stringify(tFrom.checks || [])) {
      warnings.push(`CHECK constraints changed for table ${tname}; full table rebuild required.`);
    }
  }

  // Tables present in 'from' but not in 'to'
  for (const [tname] of fromTables) {
    if (!toTables.has(tname)) {
      warnings.push(`Table ${tname} removed in target schema; dropping tables is not performed automatically.`);
    }
  }

  return { statements, warnings };
}

export function buildDiffSql(from: DatabaseSchema, to: DatabaseSchema): { sql: string; warnings: string[] } {
  const { statements, warnings } = diffSchemas(from, to);
  const sql = statements.join('\n\n');
  return { sql, warnings };
}