// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { KuratchiSDK } from './lib/kuratchi.js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			kuratchi?: KuratchiSDK & {
				getAdminDb?: () => Promise<any>;
				orgDatabaseClient?: (organizationId?: string) => Promise<any>;
			};
			user?: any;
			session?: any;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
