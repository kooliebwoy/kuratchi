// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			site?: {
				id: string;
				name: string;
				subdomain: string;
				description?: string;
				status: boolean;
				domain: string;
				environment: string;
				theme: string;
				metadata?: any;
			};
			siteDatabase?: {
				dbuuid: string;
				workerName: string;
				token: string;
			};
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
