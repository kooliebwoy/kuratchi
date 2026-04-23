import { describe, expect, test } from 'bun:test';

import { getLocals } from '@kuratchi/js/runtime/context.js';
import { createGeneratedWorker } from '../../kuratchi-wrangler/src/runtime/generated-worker.ts';
import { schema } from '../src/runtime/schema.ts';

describe('generated worker runtime', () => {
  test('renders custom 404 pages through the layout wrapper', async () => {
    const worker = createGeneratedWorker({
      routes: [],
      layout: (content) => `<html><body>${content}</body></html>`,
      layoutActions: {},
      assetsPrefix: '/assets/',
      assets: {},
      errorPages: {
        404: () => '<section>Custom 404</section>',
      },
    });

    const response = await worker.fetch(
      new Request('https://example.com/missing'),
      {},
      {} as ExecutionContext,
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toContain('Custom 404');
  });

  test('serves static assets with etag revalidation', async () => {
    const worker = createGeneratedWorker({
      routes: [],
      layout: (content) => content,
      layoutActions: {},
      assetsPrefix: '/assets/',
      assets: {
        'app.js': {
          content: 'console.log("ok")',
          mime: 'application/javascript',
          etag: '"v1"',
        },
      },
      errorPages: {},
    });

    const first = await worker.fetch(
      new Request('https://example.com/assets/app.js'),
      {},
      {} as ExecutionContext,
    );
    expect(first.status).toBe(200);
    expect(first.headers.get('etag')).toBe('"v1"');

    const second = await worker.fetch(
      new Request('https://example.com/assets/app.js', {
        headers: { 'if-none-match': '"v1"' },
      }),
      {},
      {} as ExecutionContext,
    );
    expect(second.status).toBe(304);
  });

  test('runs middleware in order and lets error middleware handle failures', async () => {
    const calls: string[] = [];
    const middlewareDefinition = {
      trace: {
        request: async (_ctx: any, next: () => Promise<Response>) => {
          calls.push('request');
          return next();
        },
        route: async (_ctx: any, next: () => Promise<Response>) => {
          calls.push('route');
          return next();
        },
        response: async (_ctx: any, response: Response) => {
          calls.push('response');
          const out = new Response(response.body, response);
          out.headers.set('x-runtime', 'yes');
          return out;
        },
        error: async (_ctx: any, error: unknown) => {
          calls.push('error');
          return new Response(`handled:${(error as Error).message}`, { status: 418 });
        },
      },
    };

    const worker = createGeneratedWorker({
      routes: [
        {
          pattern: '/ok',
          load: () => ({ message: 'ok' }),
          render: (data) => `<p>${data.message}</p>`,
        },
        {
          pattern: '/boom',
          load: () => {
            throw new Error('boom');
          },
          render: () => '<p>never</p>',
        },
      ],
      layout: (content) => content,
      layoutActions: {},
      assetsPrefix: '/assets/',
      assets: {},
      errorPages: {},
      middlewareDefinition,
    });

    const ok = await worker.fetch(
      new Request('https://example.com/ok'),
      {},
      {} as ExecutionContext,
    );
    expect(ok.status).toBe(200);
    expect(ok.headers.get('x-runtime')).toBe('yes');
    expect(calls).toEqual(['request', 'route', 'response']);

    calls.length = 0;

    const boom = await worker.fetch(
      new Request('https://example.com/boom'),
      {},
      {} as ExecutionContext,
    );
    expect(boom.status).toBe(418);
    expect(await boom.text()).toBe('handled:boom');
    expect(calls).toEqual(['request', 'route', 'error', 'response']);
  });

  test('runs middleware consistently for page, api, rpc, and action routes', async () => {
    const calls: string[] = [];
    const worker = createGeneratedWorker({
      routes: [
        {
          pattern: '/page/:slug',
          load: (params) => {
            const locals = getLocals<any>();
            return {
              slug: params.slug,
              userId: locals.userId,
              requestPath: locals.requestPath,
              trace: Array.isArray(locals.trace) ? locals.trace.join('>') : '',
            };
          },
          render: (data) => `<p>${data.userId}:${data.requestPath}:${data.slug}:${data.trace}</p>`,
        },
        {
          pattern: '/api',
          __api: true,
          GET: async (ctx: any) => new Response(JSON.stringify({
            userId: ctx.locals.userId,
            requestPath: ctx.locals.requestPath,
            trace: ctx.locals.trace,
          }), {
            headers: { 'content-type': 'application/json' },
          }),
        },
        {
          pattern: '/rpc',
          rpc: {
            whoami: async () => {
              const locals = getLocals<any>();
              return {
                userId: locals.userId,
                requestPath: locals.requestPath,
                trace: locals.trace,
              };
            },
          },
          render: () => '<p>rpc</p>',
        },
        {
          pattern: '/action',
          actions: {
            save: async () => {
              const locals = getLocals<any>();
              locals.__redirectTo = `/done/${locals.userId}`;
            },
          },
          render: () => '<form method="POST"></form>',
        },
      ],
      layout: (content) => content,
      layoutActions: {},
      assetsPrefix: '/assets/',
      assets: {},
      errorPages: {},
      middlewareDefinition: {
        trace: {
          request: async (ctx: any, next: () => Promise<Response>) => {
            calls.push(`request:${ctx.url.pathname}`);
            ctx.locals.userId = 123;
            ctx.locals.requestPath = ctx.url.pathname;
            ctx.locals.trace = [`request:${ctx.url.pathname}`];
            return next();
          },
          route: async (ctx: any, next: () => Promise<Response>) => {
            calls.push(`route:${ctx.url.pathname}`);
            ctx.locals.trace.push(`route:${ctx.url.pathname}`);
            return next();
          },
          response: async (ctx: any, response: Response) => {
            calls.push(`response:${ctx.url.pathname}`);
            const out = new Response(response.body, response);
            out.headers.set('x-middleware-path', ctx.locals.requestPath);
            return out;
          },
        },
      },
    });

    const page = await worker.fetch(
      new Request('https://example.com/page/hello'),
      {},
      {} as ExecutionContext,
    );
    expect(page.status).toBe(200);
    expect(page.headers.get('x-middleware-path')).toBe('/page/hello');
    expect(await page.text()).toContain('123:/page/hello:hello:request:/page/hello>route:/page/hello');

    const api = await worker.fetch(
      new Request('https://example.com/api'),
      {},
      {} as ExecutionContext,
    );
    expect(api.status).toBe(200);
    expect(api.headers.get('x-middleware-path')).toBe('/api');
    expect(await api.json()).toEqual({
      userId: 123,
      requestPath: '/api',
      trace: ['request:/api', 'route:/api'],
    });

    const rpc = await worker.fetch(
      new Request('https://example.com/rpc?_rpc=whoami', {
        headers: { 'sec-fetch-site': 'same-origin' },
      }),
      {},
      {} as ExecutionContext,
    );
    expect(rpc.status).toBe(200);
    expect(rpc.headers.get('x-middleware-path')).toBe('/rpc');
    expect(await rpc.json()).toEqual({
      ok: true,
      data: {
        userId: 123,
        requestPath: '/rpc',
        trace: ['request:/rpc', 'route:/rpc'],
      },
    });

    const actionBody = new FormData();
    actionBody.append('_action', 'save');
    const action = await worker.fetch(
      new Request('https://example.com/action', {
        method: 'POST',
        headers: { origin: 'https://example.com' },
        body: actionBody,
      }),
      {},
      {} as ExecutionContext,
    );
    expect(action.status).toBe(303);
    expect(action.headers.get('location')).toBe('/done/123');
    expect(action.headers.get('x-middleware-path')).toBe('/action');

    expect(calls).toEqual([
      'request:/page/hello',
      'route:/page/hello',
      'response:/page/hello',
      'request:/api',
      'route:/api',
      'response:/api',
      'request:/rpc',
      'route:/rpc',
      'response:/rpc',
      'request:/action',
      'route:/action',
      'response:/action',
    ]);
  });

  test('resets middleware locals between requests so state does not leak', async () => {
    let requestId = 0;
    const leakedAtRequestStart: boolean[] = [];
    const worker = createGeneratedWorker({
      routes: [
        {
          pattern: '/state',
          load: () => {
            const locals = getLocals<any>();
            const leakedValue = locals.routeMutation ?? 'none';
            locals.routeMutation = `set-${locals.requestId}`;
            return { requestId: locals.requestId, leakedValue };
          },
          render: (data) => `<p>${data.requestId}:${data.leakedValue}</p>`,
        },
      ],
      layout: (content) => content,
      layoutActions: {},
      assetsPrefix: '/assets/',
      assets: {},
      errorPages: {},
      middlewareDefinition: {
        isolate: {
          request: async (ctx: any, next: () => Promise<Response>) => {
            leakedAtRequestStart.push('routeMutation' in ctx.locals);
            ctx.locals.requestId = ++requestId;
            return next();
          },
        },
      },
    });

    const first = await worker.fetch(
      new Request('https://example.com/state'),
      {},
      {} as ExecutionContext,
    );
    expect(first.status).toBe(200);
    expect(await first.text()).toContain('1:none');

    const second = await worker.fetch(
      new Request('https://example.com/state'),
      {},
      {} as ExecutionContext,
    );
    expect(second.status).toBe(200);
    expect(await second.text()).toContain('2:none');
    expect(leakedAtRequestStart).toEqual([false, false]);
  });

  test('passes structured head content into the layout', async () => {
    const worker = createGeneratedWorker({
      routes: [
        {
          pattern: '/head',
          load: () => ({ title: 'Structured Head' }),
          render: (data) => ({
            html: `<main>${data.title}</main>`,
            head: `<title>${data.title}</title>`,
          }),
        },
      ],
      layout: (content, head = '') => `<html><head>${head}</head><body>${content}</body></html>`,
      layoutActions: {},
      assetsPrefix: '/assets/',
      assets: {},
      errorPages: {},
    });

    const response = await worker.fetch(
      new Request('https://example.com/head'),
      {},
      {} as ExecutionContext,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<head><title>Structured Head</title></head>');
  });

  test('does not emit a framework-owned CSRF cookie on any response', async () => {
    // Kuratchi no longer mints its own CSRF cookie — origin integrity is provided
    // by the strict same-origin gate, and session cookies (if any) are set by the
    // user's auth library, not the framework.
    const worker = createGeneratedWorker({
      routes: [
        {
          pattern: '/',
          render: () => '<form method="POST"></form>',
        },
      ],
      layout: (content) => content,
      layoutActions: {},
      assetsPrefix: '/assets/',
      assets: {},
      errorPages: {},
    });

    for (const url of ['http://127.0.0.1:8787/', 'https://example.com/']) {
      const response = await worker.fetch(new Request(url), {}, {} as ExecutionContext);
      expect(response.status).toBe(200);
      const setCookie = response.headers.get('set-cookie') || '';
      expect(setCookie).not.toMatch(/__kuratchi_csrf/);
    }
  });

  test('validates route RPC arguments with companion schemas', async () => {
    const worker = createGeneratedWorker({
      routes: [
        {
          pattern: '/rpc',
          rpc: {
            saveDraft: async ({ title, content }) => `${title}:${content}`,
          },
          rpcSchemas: {
            saveDraft: schema({
              title: schema.string().min(1),
              content: schema.string().min(1),
            }),
          },
          render: () => '<p>rpc</p>',
        },
      ],
      layout: (content) => content,
      layoutActions: {},
      assetsPrefix: '/assets/',
      assets: {},
      errorPages: {},
    });

    const ok = await worker.fetch(
      new Request('https://example.com/rpc?_rpc=saveDraft&_args=%5B%7B%22title%22%3A%22hello%22%2C%22content%22%3A%22world%22%7D%5D', {
        headers: { 'sec-fetch-site': 'same-origin' },
      }),
      {},
      {} as ExecutionContext,
    );

    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true, data: 'hello:world' });

    const bad = await worker.fetch(
      new Request('https://example.com/rpc?_rpc=saveDraft&_args=%5B%7B%22title%22%3A%22%22%2C%22content%22%3A%22world%22%7D%5D', {
        headers: { 'sec-fetch-site': 'same-origin' },
      }),
      {},
      {} as ExecutionContext,
    );

    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ ok: false, error: 'data.title must be at least 1 character(s)' });
  });

  test('rejects multi-argument payloads for schema-backed RPCs', async () => {
    const worker = createGeneratedWorker({
      routes: [
        {
          pattern: '/rpc',
          rpc: {
            saveDraft: async ({ title }) => title,
          },
          rpcSchemas: {
            saveDraft: schema({
              title: schema.string(),
            }),
          },
          render: () => '<p>rpc</p>',
        },
      ],
      layout: (content) => content,
      layoutActions: {},
      assetsPrefix: '/assets/',
      assets: {},
      errorPages: {},
    });

    const response = await worker.fetch(
      new Request('https://example.com/rpc?_rpc=saveDraft&_args=%5B%22hello%22%2C%22world%22%5D', {
        headers: { 'sec-fetch-site': 'same-origin' },
      }),
      {},
      {} as ExecutionContext,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: 'validated RPCs must receive exactly one argument object, got 2' });
  });

  test('rejects malformed RPC argument payloads with 400', async () => {
    const worker = createGeneratedWorker({
      routes: [
        {
          pattern: '/rpc',
          rpc: {
            ping: async () => 'pong',
          },
          render: () => '<p>rpc</p>',
        },
      ],
      layout: (content) => content,
      layoutActions: {},
      assetsPrefix: '/assets/',
      assets: {},
      errorPages: {},
    });

    const response = await worker.fetch(
      new Request('https://example.com/rpc?_rpc=ping&_args=%7B%22not%22%3A%22an-array%22%7D', {
        headers: { 'sec-fetch-site': 'same-origin' },
      }),
      {},
      {} as ExecutionContext,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: 'args must be a JSON array' });
  });
});
