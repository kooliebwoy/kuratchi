/**
 * RPC Configuration Store
 * Shared configuration for RPC service bindings across the SDK
 * 
 * This allows the kuratchi() config to pass RPC binding settings
 * to plugins like organizationPlugin without tight coupling.
 */

export type DatabaseAdapterType = 'auto' | 'rpc' | 'do' | 'd1' | 'http';

export interface RpcConfig {
  /** Service binding name (e.g., 'BACKEND') */
  bindingName?: string;
  /** Preferred adapter type */
  adapter: DatabaseAdapterType;
  /** Whether RPC is enabled */
  enabled: boolean;
}

// Module-level singleton for RPC config
let rpcConfig: RpcConfig = {
  adapter: 'auto',
  enabled: false
};

/**
 * Set the RPC configuration
 * Called by kuratchi() when database.rpcBinding is provided
 */
export function setRpcConfig(config: Partial<RpcConfig>): void {
  const nextBindingName = config.bindingName ?? rpcConfig.bindingName;
  const nextAdapter =
    config.adapter ??
    (config.bindingName ? 'rpc' : rpcConfig.adapter ?? 'auto');

  rpcConfig = {
    bindingName: nextBindingName,
    adapter: nextAdapter,
    enabled: nextAdapter === 'rpc' && !!nextBindingName
  };
}

/**
 * Get the current RPC configuration
 */
export function getRpcConfig(): RpcConfig {
  return rpcConfig;
}

/**
 * Check if RPC is enabled
 */
export function isRpcEnabled(): boolean {
  return rpcConfig.adapter === 'rpc' && !!rpcConfig.bindingName;
}

/**
 * Get the RPC binding name
 */
export function getRpcBindingName(): string | undefined {
  return rpcConfig.bindingName;
}

/**
 * Get the preferred adapter type
 */
export function getAdapterPreference(): DatabaseAdapterType {
  return rpcConfig.adapter ?? 'auto';
}
