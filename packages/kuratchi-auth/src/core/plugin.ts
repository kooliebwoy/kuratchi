/**
 * @kuratchi/auth â€” Core plugin system
 * Enables modular, composable authentication middleware
 */

export type MaybePromise<T> = T | Promise<T>;

/**
 * Base context available to all plugins
 * Maps to KuratchiJS RouteContext â€” direct env access, no SvelteKit indirection
 */
export interface PluginContext {
  /** The incoming Request (standard Web API) */
  request: Request;
  /** Cloudflare Worker env â€” D1, KV, R2, DO, etc. */
  env: Record<string, any>;
  /** Parsed URL */
  url: URL;
  /** Request-scoped state (shared across middleware/plugins) */
  locals: Record<string, any>;
  /** Auth-specific env values resolved from env bindings */
  authEnv: AuthEnv;
}

/**
 * Context available after session is resolved
 */
export interface SessionContext extends PluginContext {
  session: any;
  user: any;
}

/**
 * Context available when handling response
 */
export interface ResponseContext extends SessionContext {
  response: Response;
}

/**
 * Auth environment â€” resolved from Cloudflare Worker env bindings
 */
export interface AuthEnv {
  AUTH_SECRET: string;
  ORIGIN?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  TURNSTILE_SECRET?: string;
  TURNSTILE_SITE_KEY?: string;
  [key: string]: string | undefined;
}

/**
 * Auth plugin interface
 * Plugins can hook into different lifecycle stages
 */
export interface AuthPlugin {
  /** Unique plugin name */
  name: string;

  /**
   * Priority for execution order (lower runs first)
   * Default: 100
   * Recommended ranges:
   * - 0-20: Infrastructure (rate limiting)
   * - 20-40: Session management
   * - 40-60: Storage bindings
   * - 60-80: Auth flows (OAuth, credentials, magic links)
   * - 80-100: Route guards
   * - 100+: Custom/analytics
   */
  priority?: number;

  /**
   * Called early in request lifecycle
   * Can short-circuit by returning a Response
   * Use for: setup, route handling, redirects
   */
  onRequest?: (context: PluginContext) => MaybePromise<Response | void>;

  /**
   * Called after session is resolved
   * Use for: session enrichment, user data loading
   */
  onSession?: (context: SessionContext) => MaybePromise<void>;

  /**
   * Called before response is sent
   * Can modify or replace the response
   * Use for: response headers, logging, analytics
   */
  onResponse?: (context: ResponseContext) => MaybePromise<Response | void>;
}

/**
 * Plugin registry and execution engine
 */
export class PluginRegistry {
  private plugins: AuthPlugin[] = [];

  register(plugin: AuthPlugin): void {
    if (this.plugins.some(p => p.name === plugin.name)) {
      console.warn(`[kuratchi/auth] Plugin "${plugin.name}" already registered, skipping`);
      return;
    }

    this.plugins.push(plugin);
    this.plugins.sort((a, b) => (a.priority || 100) - (b.priority || 100));
  }

  registerMany(plugins: AuthPlugin[]): void {
    plugins.forEach(p => this.register(p));
  }

  getPlugins(): AuthPlugin[] {
    return [...this.plugins];
  }

  getPlugin(name: string): AuthPlugin | undefined {
    return this.plugins.find(p => p.name === name);
  }

  async executeOnRequest(context: PluginContext): Promise<Response | void> {
    for (const plugin of this.plugins) {
      if (plugin.onRequest) {
        const result = await plugin.onRequest(context);
        if (result instanceof Response) {
          return result;
        }
      }
    }
  }

  async executeOnSession(context: SessionContext): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.onSession) {
        await plugin.onSession(context);
      }
    }
  }

  async executeOnResponse(context: ResponseContext): Promise<Response> {
    let response = context.response;

    for (const plugin of this.plugins) {
      if (plugin.onResponse) {
        const result = await plugin.onResponse({ ...context, response });
        if (result instanceof Response) {
          response = result;
        }
      }
    }

    return response;
  }
}

/**
 * Helper to create a simple plugin
 */
export function createPlugin(
  name: string,
  hooks: Partial<Pick<AuthPlugin, 'onRequest' | 'onSession' | 'onResponse'>>,
  priority?: number
): AuthPlugin {
  return {
    name,
    priority,
    ...hooks
  };
}



