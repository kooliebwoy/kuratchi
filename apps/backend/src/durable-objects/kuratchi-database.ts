import { DurableObject } from "cloudflare:workers";

type RunPayload = { query: string; params?: any[] };
type ExecPayload = { query: string };
type BatchPayload = { batch: Array<{ query: string; params?: any[] }> };
type RawPayload = { query: string; params?: any[] };
type FirstPayload = { query: string; params?: any[]; columnName?: string };

/**
 * KuratchiDatabase Durable Object
 * Provides SQLite storage with D1-compatible return format for RPC calls
 * 
 * Returns plain objects (not Response) for RPC compatibility
 * Format matches D1Result: { success, results, meta }
 */
export class KuratchiDatabase extends DurableObject<Env> {
	private readonly sql: any;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.sql = ctx.storage.sql;
	}

	/**
	 * Execute a query and return all results
	 * Matches D1's stmt.all() return format
	 */
	async run(payload: RunPayload) {
		const { query, params } = payload;
		const cursor = this.sql.exec(query, ...(params || []));
		const results = cursor.toArray();
		
		// Return D1-compatible format (plain object for RPC)
		return {
			success: true,
			results,
			meta: {
				rowsRead: cursor.rowsRead,
				rowsWritten: cursor.rowsWritten
			}
		};
	}

	/**
	 * Execute raw SQL (typically DDL statements)
	 * Matches D1's db.exec() return format
	 */
	async exec(payload: ExecPayload) {
		const { query } = payload;
		const cursor = this.sql.exec(query);
		const results = cursor.toArray();
		
		return {
			success: true,
			results,
			meta: {
				rowsRead: cursor.rowsRead,
				rowsWritten: cursor.rowsWritten
			}
		};
	}

	/**
	 * Execute multiple queries in a transaction
	 * Matches D1's db.batch() return format
	 */
	async batch(payload: BatchPayload) {
		const { batch } = payload;
		const results: any[] = [];
		
		// Execute atomically in transaction
		await this.ctx.storage.transaction(async () => {
			for (const item of batch || []) {
				const { query, params } = item || {};
				const cursor = this.sql.exec(query, ...(params || []));
				results.push({
					success: true,
					results: cursor.toArray(),
					meta: {
						rowsRead: cursor.rowsRead,
						rowsWritten: cursor.rowsWritten
					}
				});
			}
		});
		
		await this.ctx.storage.sync();
		return results; // Array of D1Result objects
	}

	/**
	 * Execute and return raw array results (no column names)
	 * Matches D1's stmt.raw() return format
	 */
	async raw(payload: RawPayload) {
		const { query, params } = payload;
		const cursor = this.sql.exec(query, ...(params || []));
		const results = cursor.raw().toArray();
		
		return {
			success: true,
			results,
			meta: {
				rowsRead: cursor.rowsRead,
				rowsWritten: cursor.rowsWritten
			}
		};
	}

	/**
	 * Execute and return first row only
	 * Matches D1's stmt.first() return format
	 */
	async first(payload: FirstPayload) {
		const { query, params, columnName } = payload;
		const cursor = this.sql.exec(query, ...(params || []));
		
		// Use cursor.one() - returns first row or null if no rows, throws if > 1 row
		let row: Record<string, any> | null = null;
		try {
			row = cursor.one();
		} catch {
			// one() throws if no rows - that's fine, return null
			row = null;
		}
		
		// If columnName specified, return just that value (like D1's first(columnName))
		const result = columnName && row ? row[columnName] : row;
		
		return {
			success: true,
			results: result,
			meta: {
				rowsRead: cursor.rowsRead,
				rowsWritten: cursor.rowsWritten
			}
		};
	}
}


