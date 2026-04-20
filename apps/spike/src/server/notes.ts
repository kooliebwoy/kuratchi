/**
 * Verifies `@kuratchi/orm` works inside the Vite+Worker setup:
 *   - imports `kuratchiORM` (ESM, zero deps)
 *   - wraps the `env.DB` D1 binding resolved by Miniflare
 *   - exercises insert + findMany
 *
 * `getEnv()` from `kuratchi:environment` works inside a Worker because
 * the kuratchi runtime stashes `env` in AsyncLocalStorage during the
 * request phase. Using a lazy getter rather than passing `env` around
 * keeps `$server/*` modules free of per-call plumbing.
 */

import { kuratchiORM } from '@kuratchi/orm';
import { getEnv } from '@kuratchi/js';

interface Env {
	DB: D1Database;
}

// Lazy getter — D1 binding is resolved per request via AsyncLocalStorage.
const db = kuratchiORM(() => getEnv<Env>().DB);

export async function listNotes(): Promise<Array<{ id: number; body: string; created_at: number }>> {
	// `many()` returns `{ success, data }` — unwrap to a plain array
	// so templates can iterate directly.
	const res = await db.notes.many();
	return res?.success ? (res.data ?? []) : [];
}

/**
 * Action handler. Form POST args arrive as `{ formData, request, ... }`
 * per the Kuratchi action contract. We extract `body` from the form and
 * insert a row. The dispatcher will 303-redirect back to the page.
 */
export async function addNote(ctx: { formData?: FormData } = {}) {
	const body = String(ctx.formData?.get('body') ?? '').trim();
	if (!body) return;
	await db.notes.insert({ body, created_at: Date.now() });
}
