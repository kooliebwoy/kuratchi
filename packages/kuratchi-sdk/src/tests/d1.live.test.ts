// D1 storage helper tests
import { describe, it, expect, beforeAll } from 'vitest';
import { d1 } from '../lib/d1/index.js';
import { setFallbackPlatform } from '../lib/utils/platform-context.js';

// Mock D1 database for testing
const mockD1Database = {
  __store__: new Map<string, any[]>(),
  __schemas__: new Map<string, string>(),
  
  prepare: function(query: string) {
    const self = this;
    let boundParams: any[] = [];
    
    return {
      bind: function(...params: any[]) {
        boundParams = params;
        return this;
      },
      
      all: async function<T = any>() {
        try {
          // Simple query parser for testing
          const lowerQuery = query.toLowerCase().trim();
          
          if (lowerQuery.includes('create table')) {
            // Extract table name
            const match = query.match(/create table\s+(?:if not exists\s+)?(\w+)/i);
            if (match) {
              const tableName = match[1];
              if (!self.__store__.has(tableName)) {
                self.__store__.set(tableName, []);
              }
              self.__schemas__.set(tableName, query);
            }
            return { success: true, results: [], meta: {} };
          }
          
          if (lowerQuery.startsWith('insert into')) {
            const match = query.match(/insert into\s+(\w+)/i);
            if (match) {
              const tableName = match[1];
              const table = self.__store__.get(tableName) || [];
              const row: any = { id: table.length + 1 };
              
              // Simple value extraction for bound params
              const valuesMatch = query.match(/values\s*\(([\s\S]+)\)/i);
              if (valuesMatch) {
                const placeholders = valuesMatch[1].split(',').map(p => p.trim());
                placeholders.forEach((p, i) => {
                  if (p === '?') {
                    row[`col${i}`] = boundParams[i];
                  }
                });
              }
              
              table.push(row);
              self.__store__.set(tableName, table);
              
              return {
                success: true,
                results: [],
                meta: { rows_written: 1, last_row_id: row.id }
              };
            }
          }
          
          if (lowerQuery.startsWith('select')) {
            const match = query.match(/from\s+(\w+)/i);
            if (match) {
              const tableName = match[1];
              let results = self.__store__.get(tableName) || [];
              
              // Simple WHERE filtering
              if (lowerQuery.includes('where') && boundParams.length > 0) {
                // Very basic filtering for demo
                results = results.filter((row: any) => {
                  return Object.values(row).some(v => boundParams.includes(v));
                });
              }
              
              return { success: true, results, meta: { rows_read: results.length } };
            }
          }
          
          if (lowerQuery.startsWith('update')) {
            const match = query.match(/update\s+(\w+)/i);
            if (match) {
              const tableName = match[1];
              const table = self.__store__.get(tableName) || [];
              // Simple update logic
              return {
                success: true,
                results: [],
                meta: { rows_written: table.length }
              };
            }
          }
          
          if (lowerQuery.startsWith('delete')) {
            const match = query.match(/from\s+(\w+)/i);
            if (match) {
              const tableName = match[1];
              const table = self.__store__.get(tableName) || [];
              const beforeCount = table.length;
              self.__store__.set(tableName, []);
              
              return {
                success: true,
                results: [],
                meta: { rows_written: beforeCount }
              };
            }
          }
          
          return { success: true, results: [], meta: {} };
        } catch (error: any) {
          return { success: false, results: [], error: error.message };
        }
      },
      
      first: async function<T = any>() {
        const result = await this.all<T>();
        return result.results && result.results.length > 0 ? result.results[0] : null;
      },
      
      run: async function() {
        return await this.all();
      }
    };
  },
  
  batch: async function(statements: any[]) {
    const results = [];
    for (const stmt of statements) {
      const result = await stmt.all();
      results.push(result);
    }
    return results;
  },
  
  exec: async function(query: string) {
    const statements = query.split(';').filter(s => s.trim());
    let count = 0;
    const start = Date.now();
    
    for (const sql of statements) {
      if (sql.trim()) {
        await this.prepare(sql).all();
        count++;
      }
    }
    
    return {
      count,
      duration: Date.now() - start
    };
  }
};

describe('D1 Helper', () => {
  beforeAll(() => {
    // Set up mock platform with TEST_DB binding
    setFallbackPlatform({
      env: {
        TEST_DB: mockD1Database
      }
    } as any);
  });

  describe('query', () => {
    it('should execute a select query', async () => {
      // Create table
      await d1.exec('TEST_DB', 'CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)');
      
      // Insert data
      await d1.run('TEST_DB', 'INSERT INTO users (name) VALUES (?)', ['Alice']);
      await d1.run('TEST_DB', 'INSERT INTO users (name) VALUES (?)', ['Bob']);
      
      // Query
      const result = await d1.query('TEST_DB', 'SELECT * FROM users');
      expect(result).toBeTruthy();
      expect(result?.results?.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle parameterized queries', async () => {
      const result = await d1.query('TEST_DB', 'SELECT * FROM users WHERE name = ?', ['Alice']);
      expect(result).toBeTruthy();
      expect(result?.results?.length).toBeGreaterThan(0);
    });
  });

  describe('first', () => {
    it('should return first row', async () => {
      await d1.exec('TEST_DB', 'CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY, title TEXT)');
      await d1.run('TEST_DB', 'INSERT INTO posts (title) VALUES (?)', ['First Post']);
      
      const row = await d1.first('TEST_DB', 'SELECT * FROM posts');
      expect(row).toBeTruthy();
      expect(row).toHaveProperty('id');
    });

    it('should return null for empty result', async () => {
      await d1.exec('TEST_DB', 'CREATE TABLE IF NOT EXISTS empty_table (id INTEGER)');
      const row = await d1.first('TEST_DB', 'SELECT * FROM empty_table');
      expect(row).toBeNull();
    });
  });

  describe('run', () => {
    it('should execute insert statement', async () => {
      await d1.exec('TEST_DB', 'CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT)');
      
      const result = await d1.run('TEST_DB', 'INSERT INTO products (name) VALUES (?)', ['Product A']);
      expect(result).toBeTruthy();
      expect(result?.success).toBe(true);
      expect(result?.meta?.rows_written).toBe(1);
    });

    it('should execute update statement', async () => {
      const result = await d1.run('TEST_DB', 'UPDATE products SET name = ?', ['Updated Product']);
      expect(result).toBeTruthy();
      expect(result?.success).toBe(true);
    });

    it('should execute delete statement', async () => {
      const result = await d1.run('TEST_DB', 'DELETE FROM products');
      expect(result).toBeTruthy();
      expect(result?.success).toBe(true);
    });
  });

  describe('batch', () => {
    it('should execute multiple statements atomically', async () => {
      await d1.exec('TEST_DB', 'CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, amount REAL)');
      
      const results = await d1.batch('TEST_DB', [
        { query: 'INSERT INTO orders (amount) VALUES (?)', params: [100] },
        { query: 'INSERT INTO orders (amount) VALUES (?)', params: [200] },
        { query: 'INSERT INTO orders (amount) VALUES (?)', params: [300] }
      ]);
      
      expect(results).toBeTruthy();
      expect(results?.length).toBe(3);
      results?.forEach(r => expect(r.success).toBe(true));
    });
  });

  describe('exec', () => {
    it('should execute raw SQL with multiple statements', async () => {
      const result = await d1.exec('TEST_DB', `
        CREATE TABLE IF NOT EXISTS test_table (
          id INTEGER PRIMARY KEY,
          value TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_value ON test_table(value);
      `);
      
      expect(result).toBeTruthy();
      expect(result?.count).toBeGreaterThan(0);
    });
  });

  describe('database helper', () => {
    it('should return database when available', () => {
      const db = d1.database('TEST_DB');
      expect(db).toBe(mockD1Database);
    });

    it('should return null for missing database', () => {
      const db = d1.database('NON_EXISTENT_DB');
      expect(db).toBeNull();
    });
  });

  describe('ORM client', () => {
    it('should create ORM client with schema', async () => {
      const schema = {
        name: 'test-schema',
        tables: [
          {
            name: 'items',
            columns: [
              { name: 'id', type: 'integer' as const, primaryKey: true, autoincrement: true },
              { name: 'name', type: 'text' as const, notNull: true }
            ]
          }
        ]
      };
      
      const orm = await d1.client('TEST_DB', schema);
      expect(orm).toBeTruthy();
      expect(orm).toHaveProperty('items');
    });
  });

  describe('graceful degradation', () => {
    it('should return null when database not found', async () => {
      const result = await d1.query('MISSING_DB', 'SELECT 1');
      expect(result).toBeNull();
    });

    it('should return null when run fails on missing database', async () => {
      const result = await d1.run('MISSING_DB', 'INSERT INTO test VALUES (1)');
      expect(result).toBeNull();
    });

    it('should return null when first fails on missing database', async () => {
      const result = await d1.first('MISSING_DB', 'SELECT 1');
      expect(result).toBeNull();
    });

    it('should return null when batch fails on missing database', async () => {
      const result = await d1.batch('MISSING_DB', [{ query: 'SELECT 1', params: [] }]);
      expect(result).toBeNull();
    });

    it('should return null when exec fails on missing database', async () => {
      const result = await d1.exec('MISSING_DB', 'SELECT 1');
      expect(result).toBeNull();
    });
  });
});
