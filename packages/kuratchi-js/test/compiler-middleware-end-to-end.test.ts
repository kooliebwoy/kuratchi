import { afterEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { compile } from '../src/compiler/index.js';

type CompiledWorker = {
  fetch(request: Request, env: Record<string, unknown>, ctx: unknown): Promise<Response>;
};

const tempDirs: string[] = [];
const testRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '.tmp-projects');
const kuratchiJsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const kuratchiWranglerDir = path.resolve(kuratchiJsDir, '..', 'kuratchi-wrangler');

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) continue;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createTempProject(name: string): string {
  fs.mkdirSync(testRoot, { recursive: true });
  const dir = fs.mkdtempSync(path.join(testRoot, `middleware-e2e-${name}-`));
  tempDirs.push(dir);
  fs.mkdirSync(path.join(dir, 'src', 'routes', 'api'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src', 'server'), { recursive: true });
  const kuratchiNodeModulesDir = path.join(dir, 'node_modules', '@kuratchi');
  fs.mkdirSync(kuratchiNodeModulesDir, { recursive: true });
  fs.symlinkSync(kuratchiJsDir, path.join(kuratchiNodeModulesDir, 'js'), 'dir');
  fs.symlinkSync(kuratchiWranglerDir, path.join(kuratchiNodeModulesDir, 'wrangler'), 'dir');
  return dir;
}

async function compileWorker(projectDir: string): Promise<CompiledWorker> {
  const workerPath = await compile({ projectDir, isDev: true });
  const cacheBust = `${Date.now()}-${Math.random()}`;
  const mod = await import(`${pathToFileURL(workerPath).href}?t=${cacheBust}`);
  return mod.default as CompiledWorker;
}

describe('compiler middleware end-to-end', () => {
  it('discovers src/middleware.ts and applies it across compiled page, api, rpc, action, and 404 flows', async () => {
    const projectDir = createTempProject('all-routes');

    fs.writeFileSync(
      path.join(projectDir, 'src', 'middleware.ts'),
      `import { defineMiddleware } from '@kuratchi/js';

let requestId = 0;

export default defineMiddleware({
  trace: {
    async request(ctx, next) {
      ctx.locals.requestId = ++requestId;
      ctx.locals.userId = 'user-' + ctx.locals.requestId;
      ctx.locals.trace = ['request'];
      ctx.locals.requestPath = ctx.url.pathname;
      return next();
    },
    async route(ctx, next) {
      ctx.locals.trace.push('route');
      return next();
    },
    async response(ctx, response) {
      const out = new Response(response.body, response);
      out.headers.set('x-middleware-trace', ctx.locals.trace.join('>'));
      out.headers.set('x-middleware-request-id', String(ctx.locals.requestId));
      out.headers.set('x-middleware-path', ctx.locals.requestPath);
      return out;
    },
  },
});
`,
      'utf-8',
    );

    fs.writeFileSync(
      path.join(projectDir, 'src', 'server', 'account.ts'),
      `import { getLocals } from 'kuratchi:request';
import { redirect } from 'kuratchi:navigation';

export async function getPageData() {
  const locals = getLocals() as any;
  const leakedBefore = locals.pageMutation ?? 'none';
  locals.pageMutation = 'page-' + locals.requestId;
  return {
    userId: locals.userId,
    requestId: locals.requestId,
    trace: Array.isArray(locals.trace) ? locals.trace.join('>') : '',
    leakedBefore,
  };
}

export async function saveAccount() {
  const locals = getLocals() as any;
  redirect('/done/' + locals.userId);
}

export async function whoami() {
  const locals = getLocals() as any;
  return {
    userId: locals.userId,
    requestId: locals.requestId,
    trace: locals.trace,
    leakedBefore: locals.pageMutation ?? 'none',
  };
}
`,
      'utf-8',
    );

    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'account.html'),
      `<script>
import { getPageData, saveAccount, whoami } from '$server/account';
const page = await getPageData();
</script>

<form action={saveAccount} method="POST">
  <button type="submit">Save</button>
</form>
<button type="button" onclick={whoami()}>Who am I</button>
<p>{page.userId}:{page.requestId}:{page.trace}:{page.leakedBefore}</p>`,
      'utf-8',
    );

    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'api', 'index.ts'),
      `export async function GET(ctx: any) {
  return new Response(JSON.stringify({
    userId: ctx.locals.userId,
    requestId: ctx.locals.requestId,
    trace: ctx.locals.trace,
    requestPath: ctx.locals.requestPath,
  }), {
    headers: { 'content-type': 'application/json' },
  });
}
`,
      'utf-8',
    );

    const worker = await compileWorker(projectDir);

    const page = await worker.fetch(new Request('https://example.com/account'), {}, {});
    expect(page.status).toBe(200);
    expect(page.headers.get('x-middleware-trace')).toBe('request>route');
    expect(page.headers.get('x-middleware-request-id')).toBe('1');
    expect(page.headers.get('x-middleware-path')).toBe('/account');
    expect(await page.text()).toContain('user-1:1:request&gt;route:none');

    const api = await worker.fetch(new Request('https://example.com/api'), {}, {});
    expect(api.status).toBe(200);
    expect(api.headers.get('x-middleware-trace')).toBe('request>route');
    expect(api.headers.get('x-middleware-request-id')).toBe('2');
    expect(await api.json()).toEqual({
      userId: 'user-2',
      requestId: 2,
      trace: ['request', 'route'],
      requestPath: '/api',
    });

    const rpc = await worker.fetch(
      new Request('https://example.com/account?_rpc=rpc_0_server_whoami&_args=%5B%5D', {
        headers: { 'sec-fetch-site': 'same-origin' },
      }),
      {},
      {},
    );
    expect(rpc.status).toBe(200);
    expect(rpc.headers.get('x-middleware-trace')).toBe('request>route');
    expect(rpc.headers.get('x-middleware-request-id')).toBe('3');
    expect(await rpc.json()).toEqual({
      ok: true,
      data: {
        userId: 'user-3',
        requestId: 3,
        trace: ['request', 'route'],
        leakedBefore: 'none',
      },
    });

    const actionBody = new FormData();
    actionBody.append('_action', 'saveAccount');
    const action = await worker.fetch(
      new Request('https://example.com/account', {
        method: 'POST',
        headers: { origin: 'https://example.com' },
        body: actionBody,
      }),
      {},
      {},
    );
    expect(action.status).toBe(303);
    expect(action.headers.get('location')).toBe('/done/user-4');
    expect(action.headers.get('x-middleware-trace')).toBe('request>route');
    expect(action.headers.get('x-middleware-request-id')).toBe('4');

    const missing = await worker.fetch(new Request('https://example.com/missing'), {}, {});
    expect(missing.status).toBe(404);
    expect(missing.headers.get('x-middleware-trace')).toBe('request>route');
    expect(missing.headers.get('x-middleware-request-id')).toBe('5');
    expect(missing.headers.get('x-middleware-path')).toBe('/missing');
  });

  it('keeps compiled middleware locals isolated per request', async () => {
    const projectDir = createTempProject('isolation');

    fs.writeFileSync(
      path.join(projectDir, 'src', 'middleware.ts'),
      `import { defineMiddleware } from '@kuratchi/js';

let requestId = 0;

export default defineMiddleware({
  isolate: {
    async request(ctx, next) {
      ctx.locals.requestId = ++requestId;
      return next();
    },
  },
});
`,
      'utf-8',
    );

    fs.writeFileSync(
      path.join(projectDir, 'src', 'server', 'state.ts'),
      `import { getLocals } from 'kuratchi:request';

export async function readState() {
  const locals = getLocals() as any;
  const leakedBefore = locals.routeMutation ?? 'none';
  locals.routeMutation = 'set-' + locals.requestId;
  return { requestId: locals.requestId, leakedBefore };
}
`,
      'utf-8',
    );

    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'state.html'),
      `<script>
import { readState } from '$server/state';
const state = await readState();
</script>

<p>{state.requestId}:{state.leakedBefore}</p>`,
      'utf-8',
    );

    const worker = await compileWorker(projectDir);

    const first = await worker.fetch(new Request('https://example.com/state'), {}, {});
    expect(first.status).toBe(200);
    expect(await first.text()).toContain('1:none');

    const second = await worker.fetch(new Request('https://example.com/state'), {}, {});
    expect(second.status).toBe(200);
    expect(await second.text()).toContain('2:none');
  });
});
