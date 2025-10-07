// KV storage helper tests
import { describe, it, expect, beforeAll } from 'vitest';
import { kv } from '../lib/kv/index.js';
import { setFallbackPlatform } from '../lib/utils/platform-context.js';

// Mock platform with KV namespace for testing
const mockKVNamespace = {
  get: async (key: string, options?: any) => {
    // Simple in-memory mock
    const store = (mockKVNamespace as any).__store__ || {};
    const value = store[key];
    if (!value) return null;
    
    if (options?.type === 'json') return JSON.parse(value);
    if (options?.type === 'arrayBuffer') return new TextEncoder().encode(value).buffer;
    return value;
  },
  put: async (key: string, value: string | ArrayBuffer, options?: any) => {
    const store = (mockKVNamespace as any).__store__ || {};
    (mockKVNamespace as any).__store__ = store;
    store[key] = typeof value === 'string' ? value : new TextDecoder().decode(value);
  },
  delete: async (key: string) => {
    const store = (mockKVNamespace as any).__store__ || {};
    delete store[key];
  },
  list: async (options?: any) => {
    const store = (mockKVNamespace as any).__store__ || {};
    const keys = Object.keys(store)
      .filter(k => !options?.prefix || k.startsWith(options.prefix))
      .map(name => ({ name, expiration: null, metadata: null }));
    
    return {
      keys,
      list_complete: true,
      cursor: null
    };
  }
};

describe('KV Helper', () => {
  beforeAll(() => {
    // Set up mock platform with TEST_KV binding
    setFallbackPlatform({
      env: {
        TEST_KV: mockKVNamespace
      }
    } as any);
  });

  describe('put and get', () => {
    it('should store and retrieve a text value', async () => {
      await kv.put('TEST_KV', 'test-key', 'test-value');
      const value = await kv.get('TEST_KV', 'test-key');
      expect(value).toBe('test-value');
    });

    it('should store and retrieve JSON', async () => {
      const obj = { name: 'John', age: 30 };
      await kv.put('TEST_KV', 'test-json', JSON.stringify(obj));
      const value = await kv.get('TEST_KV', 'test-json', { type: 'json' });
      expect(value).toEqual(obj);
    });

    it('should handle TTL option', async () => {
      await kv.put('TEST_KV', 'test-ttl', 'expires', { expirationTtl: 60 });
      const value = await kv.get('TEST_KV', 'test-ttl');
      expect(value).toBe('expires');
    });

    it('should return null for non-existent key', async () => {
      const value = await kv.get('TEST_KV', 'non-existent');
      expect(value).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a key', async () => {
      await kv.put('TEST_KV', 'to-delete', 'value');
      await kv.delete('TEST_KV', 'to-delete');
      const value = await kv.get('TEST_KV', 'to-delete');
      expect(value).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all keys', async () => {
      await kv.put('TEST_KV', 'list-1', 'value1');
      await kv.put('TEST_KV', 'list-2', 'value2');
      await kv.put('TEST_KV', 'list-3', 'value3');
      
      const result = await kv.list('TEST_KV');
      expect(result).toBeTruthy();
      expect(result?.keys.length).toBeGreaterThanOrEqual(3);
      
      const keyNames = result?.keys.map(k => k.name) || [];
      expect(keyNames).toContain('list-1');
      expect(keyNames).toContain('list-2');
      expect(keyNames).toContain('list-3');
    });

    it('should list keys with prefix', async () => {
      await kv.put('TEST_KV', 'prefix:a', 'valueA');
      await kv.put('TEST_KV', 'prefix:b', 'valueB');
      await kv.put('TEST_KV', 'other:c', 'valueC');
      
      const result = await kv.list('TEST_KV', { prefix: 'prefix:' });
      expect(result).toBeTruthy();
      
      const keyNames = result?.keys.map(k => k.name) || [];
      expect(keyNames).toContain('prefix:a');
      expect(keyNames).toContain('prefix:b');
      expect(keyNames).not.toContain('other:c');
    });
  });

  describe('namespace helper', () => {
    it('should return namespace when available', () => {
      const ns = kv.namespace('TEST_KV');
      expect(ns).toBe(mockKVNamespace);
    });

    it('should return null for missing namespace', () => {
      const ns = kv.namespace('NON_EXISTENT_KV');
      expect(ns).toBeNull();
    });
  });

  describe('graceful degradation', () => {
    it('should return null when namespace not found', async () => {
      const value = await kv.get('MISSING_KV', 'key');
      expect(value).toBeNull();
    });

    it('should return false when put fails on missing namespace', async () => {
      const result = await kv.put('MISSING_KV', 'key', 'value');
      expect(result).toBe(false);
    });

    it('should return false when delete fails on missing namespace', async () => {
      const result = await kv.delete('MISSING_KV', 'key');
      expect(result).toBe(false);
    });

    it('should return null when list fails on missing namespace', async () => {
      const result = await kv.list('MISSING_KV');
      expect(result).toBeNull();
    });
  });
});
