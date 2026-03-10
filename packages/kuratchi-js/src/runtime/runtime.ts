/**
 * Runtime extension system
 */

import type { Env, RuntimeDefinition } from './types.js';

export function defineRuntime<E extends Env = Env>(runtime: RuntimeDefinition<E>): RuntimeDefinition<E> {
  return runtime;
}
