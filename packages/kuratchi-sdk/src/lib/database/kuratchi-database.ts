/**
 * LEGACY WRAPPER - For backward compatibility
 * 
 * @deprecated This file is kept for backward compatibility only.
 * New code should use: import { KuratchiDatabase, database } from 'kuratchi-sdk/database';
 * 
 * This file is now a thin wrapper over the new modular structure.
 * All logic has been extracted to separate modules for better maintainability.
 */

// Re-export main exports from new modular structure
export { KuratchiDatabase, database } from './index.js';

// Re-export all types
export type {
  QueryResult,
  DoKvClient,
  DoHttpClient,
  KvGetOptions,
  KvGetResult,
  KvPutOptions,
  KvPutResult,
  KvDeleteOptions,
  KvDeleteResult,
  KvListOptions,
  KvListResult,
  KvListKey,
  KvEncoding,
  DatabaseInstanceConfig as DOOptions
} from './index.js';
