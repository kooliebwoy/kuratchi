// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface FormField {
			id: string;
			type: string;
			label: string;
			name: string;
			placeholder?: string;
			required?: boolean;
		}
		interface SiteForm {
			id: string;
			name: string;
			fields: FormField[];
			settings: {
				formName?: string;
				submitButtonText?: string;
				successMessage?: string;
			};
		}
		interface Locals {
			site?: {
				id: string;
				name?: string | null;
				subdomain: string;
				description?: string | null;
				status?: boolean;
				domain?: string | null;
				environment?: string | null;
				theme?: string | null;
				metadata?: Record<string, unknown> | null;
			};
			siteDatabase?: {
				dbuuid?: string | null;
				workerName?: string | null;
				token: string;
			};
			forms?: SiteForm[];
			orgId?: string;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
