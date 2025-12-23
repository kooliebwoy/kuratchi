import { kuratchiConfig } from '$lib/server/kuratchi.config';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = kuratchiConfig;