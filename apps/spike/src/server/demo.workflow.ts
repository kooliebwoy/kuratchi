/**
 * Convention test: a `.workflow.ts` file at `src/server/<name>.workflow.ts`
 * gets auto-synced into wrangler.jsonc AND re-exported from the worker
 * entry by the Vite plugin. The user adds ONLY this file — no manual
 * wrangler edits, no manual worker.ts edits.
 */

import { WorkflowEntrypoint, type WorkflowStep, type WorkflowEvent } from 'cloudflare:workers';

export class DemoWorkflow extends WorkflowEntrypoint<unknown, unknown> {
	async run(_event: WorkflowEvent<unknown>, _step: WorkflowStep) {
		return 'ok';
	}
}
