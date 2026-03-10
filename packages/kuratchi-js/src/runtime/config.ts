/**
 * Configuration helper â€” typed identity function for kuratchi.config.ts
 */

import type { kuratchiConfig, Env } from './types.js';

export function defineConfig<E extends Env = Env>(config: kuratchiConfig<E>): kuratchiConfig<E> {
  return config;
}


