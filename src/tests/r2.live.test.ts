// R2 storage helper tests
import { describe, it, expect, beforeAll } from 'vitest';
import { r2 } from '../lib/r2/index.js';
import { setFallbackPlatform } from '../lib/utils/platform-context.js';

// Mock R2 bucket for testing
const mockR2Bucket = {
  __store__: new Map<string, { data: ArrayBuffer | string; metadata?: any }>(),
  
  get: async (key: string) => {
    const item = (mockR2Bucket.__store__ as Map<string, any>).get(key);
    if (!item) return null;
    
    return {
      key,
      body: item.data,
      arrayBuffer: async () => {
        if (typeof item.data === 'string') {
          return new TextEncoder().encode(item.data).buffer;
        }
        return item.data;
      },
      text: async () => {
        if (typeof item.data === 'string') return item.data;
        return new TextDecoder().decode(item.data);
      },
      httpMetadata: item.metadata?.httpMetadata || {},
      customMetadata: item.metadata?.customMetadata || {}
    };
  },
  
  put: async (key: string, value: string | ArrayBuffer | ReadableStream, options?: any) => {
    let data: ArrayBuffer | string;
    if (value instanceof ReadableStream) {
      // For streams, just store a placeholder
      data = '[stream]';
    } else {
      data = value;
    }
    
    (mockR2Bucket.__store__ as Map<string, any>).set(key, {
      data,
      metadata: {
        httpMetadata: options?.httpMetadata,
        customMetadata: options?.customMetadata
      }
    });
    
    return { key };
  },
  
  delete: async (key: string | string[]) => {
    if (Array.isArray(key)) {
      key.forEach(k => (mockR2Bucket.__store__ as Map<string, any>).delete(k));
    } else {
      (mockR2Bucket.__store__ as Map<string, any>).delete(key);
    }
  },
  
  head: async (key: string) => {
    const item = (mockR2Bucket.__store__ as Map<string, any>).get(key);
    if (!item) return null;
    
    return {
      key,
      size: typeof item.data === 'string' ? item.data.length : item.data.byteLength,
      httpMetadata: item.metadata?.httpMetadata || {},
      customMetadata: item.metadata?.customMetadata || {}
    };
  },
  
  list: async (options?: any) => {
    const keys = Array.from((mockR2Bucket.__store__ as Map<string, any>).keys())
      .filter(k => !options?.prefix || k.startsWith(options.prefix))
      .map(name => ({ key: name }));
    
    return {
      objects: options?.limit ? keys.slice(0, options.limit) : keys,
      truncated: false,
      cursor: null
    };
  }
};

describe('R2 Helper', () => {
  beforeAll(() => {
    // Set up mock platform with TEST_BUCKET binding
    setFallbackPlatform({
      env: {
        TEST_BUCKET: mockR2Bucket
      }
    } as any);
  });

  describe('put and get', () => {
    it('should store and retrieve text content', async () => {
      const content = 'Hello, R2!';
      await r2.put('TEST_BUCKET', 'test.txt', content);
      
      const obj = await r2.get('TEST_BUCKET', 'test.txt');
      expect(obj).toBeTruthy();
      
      const text = await obj?.text();
      expect(text).toBe(content);
    });

    it('should store and retrieve binary data', async () => {
      const data = new TextEncoder().encode('Binary content');
      await r2.put('TEST_BUCKET', 'test.bin', data.buffer as ArrayBuffer);
      
      const obj = await r2.get('TEST_BUCKET', 'test.bin');
      expect(obj).toBeTruthy();
      
      const retrieved = await obj?.arrayBuffer();
      expect(retrieved).toEqual(data.buffer);
    });

    it('should store with custom metadata', async () => {
      await r2.put('TEST_BUCKET', 'with-meta.txt', 'content', {
        httpMetadata: {
          contentType: 'text/plain',
          contentLanguage: 'en-US'
        },
        customMetadata: {
          author: 'test',
          version: '1.0'
        }
      });
      
      const obj = await r2.get('TEST_BUCKET', 'with-meta.txt');
      expect(obj?.httpMetadata?.contentType).toBe('text/plain');
      expect(obj?.customMetadata?.author).toBe('test');
    });

    it('should return null for non-existent key', async () => {
      const obj = await r2.get('TEST_BUCKET', 'non-existent.txt');
      expect(obj).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a single object', async () => {
      await r2.put('TEST_BUCKET', 'to-delete.txt', 'content');
      await r2.delete('TEST_BUCKET', 'to-delete.txt');
      
      const obj = await r2.get('TEST_BUCKET', 'to-delete.txt');
      expect(obj).toBeNull();
    });

    it('should delete multiple objects', async () => {
      await r2.put('TEST_BUCKET', 'delete1.txt', 'content1');
      await r2.put('TEST_BUCKET', 'delete2.txt', 'content2');
      
      await r2.delete('TEST_BUCKET', ['delete1.txt', 'delete2.txt']);
      
      const obj1 = await r2.get('TEST_BUCKET', 'delete1.txt');
      const obj2 = await r2.get('TEST_BUCKET', 'delete2.txt');
      expect(obj1).toBeNull();
      expect(obj2).toBeNull();
    });
  });

  describe('head', () => {
    it('should retrieve object metadata without body', async () => {
      const content = 'Head test content';
      await r2.put('TEST_BUCKET', 'head-test.txt', content, {
        httpMetadata: { contentType: 'text/plain' },
        customMetadata: { key: 'value' }
      });
      
      const head = await r2.head('TEST_BUCKET', 'head-test.txt');
      expect(head).toBeTruthy();
      expect(head?.key).toBe('head-test.txt');
      expect(head?.size).toBe(content.length);
      expect(head?.httpMetadata?.contentType).toBe('text/plain');
      expect(head?.customMetadata?.key).toBe('value');
    });

    it('should return null for non-existent key', async () => {
      const head = await r2.head('TEST_BUCKET', 'non-existent.txt');
      expect(head).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all objects', async () => {
      await r2.put('TEST_BUCKET', 'list-1.txt', 'content1');
      await r2.put('TEST_BUCKET', 'list-2.txt', 'content2');
      await r2.put('TEST_BUCKET', 'list-3.txt', 'content3');
      
      const result = await r2.list('TEST_BUCKET');
      expect(result).toBeTruthy();
      expect(result?.objects.length).toBeGreaterThanOrEqual(3);
      
      const keys = result?.objects.map(o => o.key) || [];
      expect(keys).toContain('list-1.txt');
      expect(keys).toContain('list-2.txt');
      expect(keys).toContain('list-3.txt');
    });

    it('should list objects with prefix', async () => {
      await r2.put('TEST_BUCKET', 'uploads/a.txt', 'contentA');
      await r2.put('TEST_BUCKET', 'uploads/b.txt', 'contentB');
      await r2.put('TEST_BUCKET', 'other/c.txt', 'contentC');
      
      const result = await r2.list('TEST_BUCKET', { prefix: 'uploads/' });
      expect(result).toBeTruthy();
      
      const keys = result?.objects.map(o => o.key) || [];
      expect(keys).toContain('uploads/a.txt');
      expect(keys).toContain('uploads/b.txt');
      expect(keys).not.toContain('other/c.txt');
    });

    it('should respect limit option', async () => {
      const result = await r2.list('TEST_BUCKET', { limit: 2 });
      expect(result).toBeTruthy();
      expect(result?.objects.length).toBeLessThanOrEqual(2);
    });
  });

  describe('bucket helper', () => {
    it('should return bucket when available', () => {
      const bucket = r2.bucket('TEST_BUCKET');
      expect(bucket).toBe(mockR2Bucket);
    });

    it('should return null for missing bucket', () => {
      const bucket = r2.bucket('NON_EXISTENT_BUCKET');
      expect(bucket).toBeNull();
    });
  });

  describe('graceful degradation', () => {
    it('should return null when bucket not found', async () => {
      const obj = await r2.get('MISSING_BUCKET', 'key.txt');
      expect(obj).toBeNull();
    });

    it('should return null when put fails on missing bucket', async () => {
      const result = await r2.put('MISSING_BUCKET', 'key.txt', 'content');
      expect(result).toBeNull();
    });

    it('should return false when delete fails on missing bucket', async () => {
      const result = await r2.delete('MISSING_BUCKET', 'key.txt');
      expect(result).toBe(false);
    });

    it('should return null when head fails on missing bucket', async () => {
      const result = await r2.head('MISSING_BUCKET', 'key.txt');
      expect(result).toBeNull();
    });

    it('should return null when list fails on missing bucket', async () => {
      const result = await r2.list('MISSING_BUCKET');
      expect(result).toBeNull();
    });
  });
});
