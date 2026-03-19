import { describe, expect, test } from 'bun:test';

import { createGeneratedWorker } from '../src/runtime/generated-worker.ts';

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

  test('runs runtime hooks in order and lets error hooks handle failures', async () => {
    const calls: string[] = [];
    const runtimeDefinition = {
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
      runtimeDefinition,
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

  test('returns compiled fragment html for fragment refresh requests', async () => {
    const worker = createGeneratedWorker({
      routes: [
        {
          pattern: '/poll',
          render: () => ({
            html: '<section data-poll="stats" data-poll-id="__poll_stats"><strong>42</strong></section>',
            head: '<title>Polling</title>',
            fragments: {
              __poll_stats: '<strong>42</strong>',
            },
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
      new Request('https://example.com/poll', {
        headers: { 'x-kuratchi-fragment': '__poll_stats' },
      }),
      {},
      {} as ExecutionContext,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const html = await response.text();
    expect(html).toBe('<strong>42</strong>');
  });
});
