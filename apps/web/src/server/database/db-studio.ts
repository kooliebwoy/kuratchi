import { getLocals, redirect } from '@kuratchi/js';
import { searchParams } from '@kuratchi/js/request';
import { getCurrentUser } from './auth';
import { getDatabase, queryDatabase } from './databases';

const PAGE_SIZE = 50;

type SqlResult = {
  ok: boolean;
  rows?: Record<string, unknown>[];
  columns?: string[];
  changes?: number;
  error?: string;
};

function getDbIdFromParams(): string {
  const params = getLocals().params as Record<string, string> | undefined;
  const id = params?.id ?? '';
  if (!id) throw new Error('Missing database ID');
  return id;
}

async function requireAuthAndDb() {
  const id = getDbIdFromParams();
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  const database = await getDatabase(id);
  if (!database) throw new Error('Database not found');
  if (!database.workerName) throw new Error('No worker deployed for this database');
  return { user, database, id };
}

async function execSql(databaseId: string, sql: string, params: any[] = []): Promise<SqlResult> {
  const result = await queryDatabase({ databaseId, sql, params });
  if (!result.success) {
    return { ok: false, error: result.error ?? 'Query failed' };
  }
  const rows = result.results ?? [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { ok: true, rows, columns };
}

async function loadTableNames(databaseId: string): Promise<string[]> {
  const tablesResult = await execSql(
    databaseId,
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_cf_KV' ORDER BY name",
  );

  if (!tablesResult.ok || !tablesResult.rows) {
    return [];
  }

  return tablesResult.rows.map((row) => String(row.name));
}

export async function getDatabaseStudioData(): Promise<{
  database: any;
  tables: string[];
  activeTable: string | null;
  rows: Record<string, unknown>[];
  columns: string[];
  schema: Record<string, unknown>[];
  totalRows: number;
  page: number;
  totalPages: number;
  sqlQuery: string;
  sqlResult: SqlResult | null;
  dbError: string | null;
}> {
  const { database, id } = await requireAuthAndDb();

  let activeTable = searchParams.get('table') ?? null;
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10));
  const sqlQuery = searchParams.get('sql') ?? '';

  let tables: string[] = [];
  let rows: Record<string, unknown>[] = [];
  let columns: string[] = [];
  let schema: Record<string, unknown>[] = [];
  let totalRows = 0;
  let totalPages = 1;
  let sqlResult: SqlResult | null = null;
  let dbError: string | null = null;

  try {
    tables = await loadTableNames(id);

    if (!activeTable && tables.length > 0) {
      activeTable = tables[0] ?? null;
    }

    if (activeTable && !tables.includes(activeTable)) {
      activeTable = null;
    }

    if (activeTable) {
      const [countResult, dataResult, schemaResult] = await Promise.all([
        execSql(id, `SELECT COUNT(*) as cnt FROM "${activeTable}"`),
        execSql(id, `SELECT rowid, * FROM "${activeTable}" LIMIT ${PAGE_SIZE} OFFSET ${page * PAGE_SIZE}`),
        execSql(id, `PRAGMA table_info('${activeTable}')`),
      ]);

      if (countResult.ok && countResult.rows) {
        totalRows = Number(countResult.rows[0]?.cnt ?? 0);
        totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
      }
      if (dataResult.ok) {
        rows = dataResult.rows ?? [];
        columns = dataResult.columns ?? [];
      }
      if (schemaResult.ok && schemaResult.rows) {
        schema = schemaResult.rows;
      }
    }

    if (sqlQuery) {
      sqlResult = await execSql(id, sqlQuery);
    }
  } catch (err: any) {
    dbError = err?.message ?? 'Database error';
  }

  return {
    database,
    tables,
    activeTable,
    rows,
    columns,
    schema,
    totalRows,
    page,
    totalPages,
    sqlQuery,
    sqlResult,
    dbError,
  };
}

export async function runSqlQuery({ formData }: FormData): Promise<void> {
  const { id } = await requireAuthAndDb();

  const sql = ((formData.get('sql') as string) ?? '').trim();
  if (!sql) throw new Error('SQL query is required');

  const table = ((formData.get('table') as string) ?? '').trim();
  const qs = new URLSearchParams({ sql });
  if (table) qs.set('table', table);
  redirect(`/databases/${id}/studio?${qs.toString()}`);
}

export async function insertTableRow({ formData }: FormData): Promise<void> {
  const { id } = await requireAuthAndDb();

  const table = ((formData.get('table') as string) ?? '').trim();
  if (!table) throw new Error('Missing table name');

  const columnsJson = ((formData.get('_columns') as string) ?? '[]');
  const colNames: string[] = JSON.parse(columnsJson);

  const cols: string[] = [];
  const placeholders: string[] = [];
  const params: any[] = [];

  for (const col of colNames) {
    const val = formData.get(`col_${col}`);
    if (val !== null && val !== '') {
      cols.push(`"${col}"`);
      placeholders.push('?');
      params.push(val);
    }
  }

  if (cols.length === 0) throw new Error('Fill in at least one column');

  const result = await execSql(
    id,
    `INSERT INTO "${table}" (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
    params,
  );
  if (!result.ok) throw new Error(result.error ?? 'Insert failed');

  redirect(`/databases/${id}/studio?table=${encodeURIComponent(table)}`);
}

export async function deleteTableRow({ formData }: FormData): Promise<void> {
  const { id } = await requireAuthAndDb();

  const table = ((formData.get('table') as string) ?? '').trim();
  const rowid = formData.get('rowid');
  const page = ((formData.get('page') as string) ?? '0').trim();
  if (!table || rowid === null) throw new Error('Missing table or rowid');

  const result = await execSql(id, `DELETE FROM "${table}" WHERE rowid = ?`, [rowid]);
  if (!result.ok) throw new Error(result.error ?? 'Delete failed');

  redirect(`/databases/${id}/studio?table=${encodeURIComponent(table)}&page=${page}`);
}

export async function updateTableRow({ formData }: FormData): Promise<void> {
  const { id } = await requireAuthAndDb();

  const table = ((formData.get('table') as string) ?? '').trim();
  const rowid = formData.get('rowid');
  const page = ((formData.get('page') as string) ?? '0').trim();
  if (!table || rowid === null) throw new Error('Missing table or rowid');

  const columnsJson = ((formData.get('_columns') as string) ?? '[]');
  const colNames: string[] = JSON.parse(columnsJson);

  const setClauses: string[] = [];
  const params: any[] = [];

  for (const col of colNames) {
    const val = formData.get(`col_${col}`);
    if (val !== null) {
      setClauses.push(`"${col}" = ?`);
      params.push(val === '' ? null : val);
    }
  }

  if (setClauses.length === 0) throw new Error('No columns to update');

  params.push(rowid);
  const result = await execSql(
    id,
    `UPDATE "${table}" SET ${setClauses.join(', ')} WHERE rowid = ?`,
    params,
  );
  if (!result.ok) throw new Error(result.error ?? 'Update failed');

  redirect(`/databases/${id}/studio?table=${encodeURIComponent(table)}&page=${page}`);
}
