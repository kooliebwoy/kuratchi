/**
 * KuratchiJS - Public API
 *
 * A thin, Cloudflare Workers-native web framework with Svelte-inspired syntax.
 */

// Runtime
export { createApp } from './runtime/app.js';
export { defineConfig } from './runtime/config.js';
export { defineRuntime } from './runtime/runtime.js';
export {  getCtx,
  getEnv,
  getRequest,
  getLocals,
  getParams,
  getParam,
  RedirectError,
  redirect,
  goto,
  setBreadcrumbs,
  getBreadcrumbs,
  breadcrumbsHome,
  breadcrumbsPrev,
  breadcrumbsNext,
  breadcrumbsCurrent,
  buildDefaultBreadcrumbs,
} from './runtime/context.js';
export { kuratchiDO, doRpc, getDb } from './runtime/do.js';
export {
  SchemaValidationError,
  schema,
} from './runtime/schema.js';
export { ActionError } from './runtime/action.js';
export { PageError } from './runtime/page-error.js';
export {
  extractSubdomainSlug,
  extractSlugFromPrefix,
  matchContainerViewPath,
  rewriteProxyLocationHeader,
  buildContainerRequest,
  createContainerEnvVars,
  startContainer,
  proxyToContainer,
  handleContainerRouting,
  forwardJsonPostToContainerDO,
  // Compatibility aliases
  matchSiteViewPath,
  buildSiteContainerRequest,
  createWpContainerEnvVars,
  startSiteContainer,
  proxyToSiteContainer,
} from './runtime/containers.js';
export type {
  AppConfig,
  kuratchiConfig,
  DatabaseConfig,
  AuthConfig,
  RouteContext,
  RouteModule,
  RuntimeContext,
  RuntimeDefinition,
  RuntimeStep,
  RuntimeNext,
  RuntimeErrorResult,
} from './runtime/types.js';
export type { RpcOf } from './runtime/do.js';
export type { SchemaType, InferSchema } from './runtime/schema.js';


export { url, pathname, searchParams, headers, method, params, slug } from './runtime/request.js';
