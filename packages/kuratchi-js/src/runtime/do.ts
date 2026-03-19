/**
 * KuratchiJS â€” Durable Object helpers
 *
 * kuratchiDO
 *   Base class for DO handler modules. Extend it, write your methods,
 *   declare `static binding = 'BINDING_NAME'` â€” the compiler does the rest.
 *
 *   - Methods are copied onto the generated DO class prototype
 *   - RPC proxy exports are auto-generated for pages
 *   - Stub resolvers are registered from config
 *
 * The compiler uses __registerDoResolver / __getDoStub internally.
 * User code never touches these â€” they're wired up from kuratchi.config.ts.
 */

// â”€â”€ Internal: stub resolver registry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let __doSelf: any = null;

/** @internal — called by compiler-generated method wrappers */
export function __setDoContext(self: any): void {
  __doSelf = self;
}

/** Get the DO's ORM database instance */
export function getDb<T = Record<string, any>>(): T {
  if (!__doSelf) throw new Error('getDb() called outside of a DO context');
  return __doSelf.db;
}

/** @internal — read by context.ts getCtx()/getEnv() */
export function __getDoSelf(): any {
  return __doSelf;
}

const _resolvers = new Map<string, () => Promise<any>>();
const _classBindings = new WeakMap<Function, string>();
const _rpcProxyCache = new WeakMap<Function, any>();

function __isDevMode(): boolean {
  return !!(globalThis as Record<string, any>).__kuratchi_DEV__;
}

/** @internal â€” called by compiler-generated init code */
export function __registerDoResolver(binding: string, resolver: () => Promise<any>): void {
  _resolvers.set(binding, resolver);
}

/** @internal â€” called by compiler-generated init code */
export function __registerDoClassBinding(klass: Function, binding: string): void {
  if (!klass || !binding) return;
  _classBindings.set(klass, binding);
}

/** @internal â€” called by compiler-generated RPC proxy modules */
export async function __getDoStub(binding: string): Promise<any> {
  const resolver = _resolvers.get(binding);
  if (!resolver) {
    throw new Error(`[KuratchiJS] No DO resolver registered for binding '${binding}'. Check your durableObjects config.`);
  }
  return resolver();
}

// â”€â”€ kuratchiDO base class â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Base class for Durable Object handler modules.
 *
 * ```ts
 * // sites.ts â€” extend, write methods, done.
 * export default class Sites extends kuratchiDO {
 *   static binding = 'ORG_DB';
 *
 *   async getSites(userId: number) {
 *     return (await this.db.sites.where({ userId }).many()).data ?? [];
 *   }
 * }
 * ```
 *
 * `this.db` is the ORM instance â€” set by the generated DO class at runtime.
 *
 * Call `Sites.rpc()` in the same file if you need to call DO methods
 * from worker-side helper functions:
 *
 * ```ts
 * const remote = Sites.rpc();
 *
 * export async function createSite(formData: FormData) {
 *   await remote.createSiteRecord({ name, slug, userId });
 * }
 * ```
 */
export class kuratchiDO {
  declare db: Record<string, any>;

  /** The DO namespace binding this handler belongs to (e.g. 'ORG_DB'). */
  static binding: string;

  /**
   * Implicit RPC proxy getter.
   *
   * Lets handler modules call `MyDO.remote.someMethod()` without declaring
   * `const remote = MyDO.rpc();` boilerplate.
   */
  static get remote(): any {
    return (this as any).rpc();
  }

  /**
   * Create a typed RPC proxy for calling DO methods from worker-side code.
   * The actual stub resolution is lazy â€” happens at call time, not import time.
   */
  static rpc<T extends typeof kuratchiDO>(this: T): RpcOf<InstanceType<T>> {
    const klass = this as unknown as Function;
    // Cache proxy per class to avoid repeated Proxy creation
    let cached = _rpcProxyCache.get(klass);
    if (cached) return cached;

    const proxy = new Proxy({} as any, {
      get(_, method: string) {
        return async (...args: any[]) => {
          const binding = (this as any).binding || _classBindings.get(klass);
          if (!binding) {
            throw new Error(`[KuratchiJS] Missing DO binding for class '${(this as any)?.name || 'UnknownDO'}'. Add static binding or ensure compiler binding registration is active.`);
          }
          if (__isDevMode()) console.log(`[rpc] ${binding}.${method}() — resolving stub...`);
          const stub = await __getDoStub(binding);
          if (!stub) {
            throw new Error(`[KuratchiJS] Not authenticated — cannot call '${method}' on ${binding}`);
          }
          if (__isDevMode()) {
            console.log(`[rpc] ${binding}.${method}() — stub type: ${stub?.constructor?.name ?? typeof stub}`);
            console.log(`[rpc] ${binding}.${method}() — calling with ${args.length} arg(s)...`);
          }
          try {
            // Call method directly on the stub — DO NOT detach with stub[method]
            // then .apply(). Workers RPC stubs are Proxy-based; detaching breaks
            // the runtime's interception and causes DataCloneError trying to
            // serialize the DurableObject as `this`.
            const result = await stub[method](...args);
            if (__isDevMode()) console.log(`[rpc] ${binding}.${method}() — returned, result type: ${typeof result}`);
            return result;
          } catch (err: any) {
            if (__isDevMode()) console.error(`[rpc] ${binding}.${method}() — THREW: ${err.message}`);
            throw err;
          }
        };
      },
    });
    _rpcProxyCache.set(klass, proxy);
    return proxy;
  }
}

/**
 * DX helper for worker-side code in DO handler modules.
 *
 * Usage:
 * `const doSites = doRpc(Sites);`
 * `await doSites.getSiteBySlug(slug);`
 */
export function doRpc<T extends typeof kuratchiDO>(klass: T): RpcOf<InstanceType<T>> {
  return klass.rpc();
}

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Extract only the method keys from a class instance (excludes 'db'). */
type MethodKeys<T> = {
  [K in keyof T]: K extends 'db' ? never : T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

/** Map class methods â†’ RPC callers (same args, Promise-wrapped return). */
export type RpcOf<T> = {
  [K in MethodKeys<T>]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : never;
};






