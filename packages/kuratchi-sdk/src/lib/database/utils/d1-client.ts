import type { D1Client } from '../core/types.js';

export function createD1ClientFromExec(exec: (sql: string, params?: any[]) => Promise<any>): D1Client {
  return {
    exec: async (sql: string) => {
      await exec(sql);
      return { success: true };
    },
    query: async (sql: string, params?: any[]) => {
      const result = await exec(sql, params);
      return {
        success: true,
        results: result?.results ?? [],
        data: result?.results ?? [],
        meta: result?.meta
      } as any;
    },
    batch: async (items: { query: string; params?: any[] }[]) => {
      for (const item of items) {
        await exec(item.query, item.params);
      }
      return { success: true } as any;
    },
    raw: async (sql: string, params?: any[]) => {
      const result = await exec(sql, params);
      return { success: true, results: result?.results ?? [] } as any;
    },
    first: async (sql: string, params?: any[]) => {
      const result = await exec(sql, params);
      if (result?.results && result.results.length > 0) {
        return { success: true, data: result.results[0] } as any;
      }
      return { success: true, data: null } as any;
    }
  } as D1Client;
}

export function createD1ClientFromBinding(binding: any): D1Client {
  if (!binding || typeof binding.prepare !== 'function') {
    throw new Error('Invalid D1 binding provided. Expected object with prepare().');
  }

  const exec = async (sql: string, params?: any[]) => {
    let statement = binding.prepare(sql);
    if (params && params.length > 0) {
      statement = statement.bind(...params);
    }
    return statement.all();
  };

  return createD1ClientFromExec(exec);
}
