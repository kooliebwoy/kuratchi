// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				CHAT_DB: import('@cloudflare/workers-types').D1Database;
				KV: import('@cloudflare/workers-types').KVNamespace;
				BUCKET: import('@cloudflare/workers-types').R2Bucket;
				AI: import('@cloudflare/workers-types').Ai;
			};
			context: {
				waitUntil(promise: Promise<unknown>): void;
			};
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};
