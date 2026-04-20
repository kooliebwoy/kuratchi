#!/usr/bin/env node
/**
 * `npm create kuratchi@latest [project-name]`
 * `bun create kuratchi [project-name]`
 *
 * Standard npm `create-*` package. Invoked by `npm create kuratchi` /
 * `bun create kuratchi` without a manual install step. Defaults to
 * the Vite template; pass `--legacy` for the Wrangler-CLI template.
 */

import { create } from './create.js';

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('-'));
const positional = args.filter((a) => !a.startsWith('-'));

await create(positional[0], flags);
