/**
 * Core plugin system for Kuratchi Auth
 * Enables modular, composable authentication middleware
 */

import type { RequestEvent } from '@sveltejs/kit';
import type { AuthHandleEnv } from '../types.js';

export type MaybePromise<T> = T | Promise<T>;

/**
 * Base context available to all plugins
 */
export interface PluginContext {
  event: RequestEvent;
  locals: any;
  env: AuthHandleEnv;
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
   * - 0-20: Infrastructure (env, platform)
   * - 20-40: Session management
   * - 40-60: Storage bindings
   * - 60-80: Auth flows (OAuth, magic links)
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
  
  /**
   * Register a plugin
   */
  register(plugin: AuthPlugin): void {
    // Check for duplicate names
    if (this.plugins.some(p => p.name === plugin.name)) {
      console.warn(`[Kuratchi Auth] Plugin "${plugin.name}" already registered, skipping`);
      return;
    }
    
    this.plugins.push(plugin);
    // Sort by priority
    this.plugins.sort((a, b) => (a.priority || 100) - (b.priority || 100));
  }
  
  /**
   * Register multiple plugins
   */
  registerMany(plugins: AuthPlugin[]): void {
    plugins.forEach(p => this.register(p));
  }
  
  /**
   * Get all registered plugins
   */
  getPlugins(): AuthPlugin[] {
    return [...this.plugins];
  }
  
  /**
   * Get a specific plugin by name
   */
  getPlugin(name: string): AuthPlugin | undefined {
    return this.plugins.find(p => p.name === name);
  }
  
  /**
   * Execute onRequest hooks
   * Returns Response if any plugin short-circuits
   */
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
  
  /**
   * Execute onSession hooks
   */
  async executeOnSession(context: SessionContext): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.onSession) {
        await plugin.onSession(context);
      }
    }
  }
  
  /**
   * Execute onResponse hooks
   * Returns modified Response if any plugin returns one
   */
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
