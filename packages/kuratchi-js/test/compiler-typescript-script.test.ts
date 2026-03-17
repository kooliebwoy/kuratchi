import { afterEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { compile } from '../src/compiler/index.js';

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) continue;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createTempProject(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `kuratchi-ts-${name}-`));
  tempDirs.push(dir);
  fs.mkdirSync(path.join(dir, 'src', 'routes', 'auth', 'signin'), { recursive: true });
  return dir;
}

describe('compiler TypeScript transpilation', () => {
  it('emits valid JavaScript for route server scripts that use TypeScript syntax', () => {
    const projectDir = createTempProject('template-script');
    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'auth', 'signin', 'page.html'),
      `<script>
  import { env } from 'cloudflare:workers';
  const turnstileSiteKey = (env as any).TURNSTILE_SITE_KEY || '';
</script>

<form><div>{turnstileSiteKey}</div></form>`,
      'utf-8',
    );

    compile({ projectDir, isDev: true });
    const routesCode = fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.js'), 'utf-8');

    expect(routesCode).toContain('const turnstileSiteKey = __env.TURNSTILE_SITE_KEY || "";');
    expect(routesCode).not.toContain('(env as any)');
  });

  it('tracks typed top-level declarations from route scripts as template data vars', () => {
    const projectDir = createTempProject('typed-vars');
    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'auth', 'signin', 'page.html'),
      `<script>
const title: string = 'Secure Sign In';
</script>

<h1>{title}</h1>`,
      'utf-8',
    );

    compile({ projectDir, isDev: true });
    const routesCode = fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.js'), 'utf-8');

    expect(routesCode).toContain('const { params, breadcrumbs } = data;');
    expect(routesCode).toContain('const title = "Secure Sign In";');
    expect(routesCode).toContain('<h1>${__esc(title)}</h1>');
  });

  it('rejects Cloudflare env access from component scripts', () => {
    const projectDir = createTempProject('component-env');
    fs.mkdirSync(path.join(projectDir, 'src', 'lib'), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'auth', 'signin', 'page.html'),
      `<script>
import Card from '$lib/card.html';
</script>

<Card />`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(projectDir, 'src', 'lib', 'card.html'),
      `<script>
import { env } from 'cloudflare:workers';
const secret = env.AUTH_SECRET;
</script>

<div>{secret}</div>`,
      'utf-8',
    );

    expect(() => compile({ projectDir, isDev: true })).toThrow(
      'Imported env from cloudflare:workers in a component script.',
    );
  });

  it('injects framework dev as a compile-time constant in route scripts', () => {
    const projectDir = createTempProject('framework-dev');
    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'auth', 'signin', 'page.html'),
        `<script>
import { dev } from '@kuratchi/js/environment';
const mode = dev ? 'development' : 'production';
</script>

<div>{mode}</div>`,
      'utf-8',
    );

    compile({ projectDir, isDev: true });
    let routesCode = fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.js'), 'utf-8');
    expect(routesCode).toContain('const dev = true;');
    expect(routesCode).toContain('const mode = dev ? "development" : "production";');

    compile({ projectDir, isDev: false });
    routesCode = fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.js'), 'utf-8');
    expect(routesCode).toContain('const dev = false;');
  });


  it('preserves non-call value imports in route load scripts', () => {
    const projectDir = createTempProject('request-values');
    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'auth', 'signin', 'page.html'),
      `<script>
import { pathname, url } from '@kuratchi/js/request';
const href = await Promise.resolve(pathname + url.search);
</script>

<div>{href}</div>`,
      'utf-8',
    );

    compile({ projectDir, isDev: true });
    const routesCode = fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.js'), 'utf-8');

    expect(routesCode).toContain("const pathname = ");
    expect(routesCode).toContain("const url = ");
    expect(routesCode).toContain("const href = await Promise.resolve(pathname + url.search);");
  });

  it('does not return imported action functions from async route load output', () => {
    const projectDir = createTempProject('async-action-load');
    fs.mkdirSync(path.join(projectDir, 'src', 'server'), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'auth', 'signin', 'page.html'),
      `<script>
import { getUser, createUser } from '$server/actions';
const user = await getUser();
</script>

<form action={createUser} method="POST"></form>
<div>{user.name}</div>`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(projectDir, 'src', 'server', 'actions.ts'),
      `export async function getUser() {
  return { name: 'Ada' };
}

export async function createUser(formData: FormData) {
  return formData;
}
`,
      'utf-8',
    );

    compile({ projectDir, isDev: true });
    const routesCode = fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.js'), 'utf-8');

    expect(routesCode).toContain("actions: { 'createUser': __m0.createUser }");
    expect(routesCode).not.toContain('return { user, createUser');
    expect(routesCode).not.toContain('return { user, getUser, createUser');
  });

  it('rejects @kuratchi/js/environment imports in client reactive scripts', () => {
    const projectDir = createTempProject('framework-dev-client');
    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'auth', 'signin', 'page.html'),
        `<script>
import { dev } from '@kuratchi/js/environment';
let count = 0;
$: if (dev) console.log(count);
</script>

<div>{count}</div>`,
      'utf-8',
    );

    expect(() => compile({ projectDir, isDev: true })).toThrow(
      'Client <script> blocks cannot import from @kuratchi/js/environment.',
    );
  });
});
