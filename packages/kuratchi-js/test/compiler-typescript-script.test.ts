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
  it('emits valid JavaScript for route server scripts that use TypeScript syntax', async () => {
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

    await compile({ projectDir, isDev: true });
    const routesCode = fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.ts'), 'utf-8');

    expect(routesCode).toContain('const turnstileSiteKey = (__env as any).TURNSTILE_SITE_KEY ||');
    expect(routesCode).toContain('turnstileSiteKey');
  });

  it('tracks typed top-level declarations from route scripts as template data vars', async () => {
    const projectDir = createTempProject('typed-vars');
    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'auth', 'signin', 'page.html'),
      `<script>
const title: string = 'Secure Sign In';
</script>

<h1>{title}</h1>`,
      'utf-8',
    );

    await compile({ projectDir, isDev: true });
    const routesCode = fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.ts'), 'utf-8');

    expect(routesCode).toContain('const { params, breadcrumbs } = data;');
    expect(routesCode).toContain("const title: string = 'Secure Sign In';");
    expect(routesCode).toContain('<h1>${__esc(title)}</h1>');
  });

  it('rejects Cloudflare env access from component scripts', async () => {
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

    expect(async () => await compile({ projectDir, isDev: true })).toThrow(
      'Imported env from cloudflare:workers in a component script.',
    );
  });

  it('injects framework dev as a compile-time constant in route scripts', async () => {
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

    await compile({ projectDir, isDev: true });
    let routesCode = fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.ts'), 'utf-8');
    expect(routesCode).toContain('const dev = true;');
    expect(routesCode).toContain("const mode = dev ? 'development' : 'production';");

    await compile({ projectDir, isDev: false });
    routesCode = fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.ts'), 'utf-8');
    expect(routesCode).toContain('const dev = false;');
  });


  it('preserves non-call value imports in route load scripts', async () => {
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

    await compile({ projectDir, isDev: true });
    const routesCode = fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.ts'), 'utf-8');

    expect(routesCode).toContain("const pathname = ");
    expect(routesCode).toContain("const url = ");
    expect(routesCode).toContain("const href = await Promise.resolve(pathname + url.search);");
  });

  it('does not return imported action functions from async route load output', async () => {
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

    await compile({ projectDir, isDev: true });
    const routesCode = fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.ts'), 'utf-8');

    expect(routesCode).toContain("actions: { 'createUser': __m0.createUser }");
    expect(routesCode).not.toContain('return { user, createUser');
    expect(routesCode).not.toContain('return { user, getUser, createUser');
  });

  it('promotes component action props into the route actions map', async () => {
    const projectDir = createTempProject('component-action-prop');
    fs.mkdirSync(path.join(projectDir, 'src', 'lib'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'src', 'server'), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'auth', 'signin', 'page.html'),
      `<script>
import FormShell from '$lib/form-shell.html';
import { submitForm } from '$server/actions';
</script>

<FormShell submitAction={submitForm} />`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(projectDir, 'src', 'lib', 'form-shell.html'),
      `<form action={submitAction} method="POST"></form>`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(projectDir, 'src', 'server', 'actions.ts'),
      `export async function submitForm(formData: FormData) {
  return formData;
}
`,
      'utf-8',
    );

    await compile({ projectDir, isDev: true });
    const routesCode = fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.ts'), 'utf-8');

    expect(routesCode).toContain("actions: { 'submitForm': __m0.submitForm }");
  });

  it('promotes layout component action props into layout actions', async () => {
    const projectDir = createTempProject('layout-action-prop');
    fs.mkdirSync(path.join(projectDir, 'src', 'lib'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'src', 'server'), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'layout.html'),
      `<script>
import Shell from '$lib/shell.html';
import { signOut } from '$server/actions';
</script>

<Shell submitAction={signOut}>
  <slot></slot>
</Shell>`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'auth', 'signin', 'page.html'),
      `<p>Layout action test</p>`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(projectDir, 'src', 'lib', 'shell.html'),
      `<form action={submitAction} method="POST"><slot></slot></form>`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(projectDir, 'src', 'server', 'actions.ts'),
      `export async function signOut(formData: FormData) {
  return formData;
}
`,
      'utf-8',
    );

    await compile({ projectDir, isDev: true });
    const routesCode = fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.ts'), 'utf-8');

    expect(routesCode).toContain("const __layoutActions = { 'signOut':");
  });

  it('rewrites nested project imports inside transformed server modules', async () => {
    const projectDir = createTempProject('server-module-rewrite');
    fs.mkdirSync(path.join(projectDir, 'src', 'server'), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'auth', 'signin', 'page.html'),
      `<script>
import { getTitle } from '$server/loaders';
const title = await getTitle();
</script>

<h1>{title}</h1>`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(projectDir, 'src', 'server', 'loaders.ts'),
      `import { baseTitle } from '$server/helpers';

export async function getTitle() {
  return baseTitle + ' Docs';
}
`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(projectDir, 'src', 'server', 'helpers.ts'),
      `export const baseTitle = 'Kuratchi';
`,
      'utf-8',
    );

    await compile({ projectDir, isDev: true });

    const rewrittenModule = fs.readFileSync(
      path.join(projectDir, '.kuratchi', 'modules', 'src', 'server', 'loaders.ts'),
      'utf-8',
    );
    const routesCode = fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.ts'), 'utf-8');

    expect(rewrittenModule).toContain("from './helpers.ts'");
    expect(routesCode).toContain("import * as __m0 from './modules/src/server/loaders.ts';");
  });

  it('merges nested layout server state into child route compilation', async () => {
    const projectDir = createTempProject('nested-layout-merge');
    fs.mkdirSync(path.join(projectDir, 'src', 'routes', 'dashboard', 'reports'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'src', 'server'), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'dashboard', 'layout.html'),
      `<script>
import { getSection } from '$server/layout-data';
const section = await getSection();
</script>

<main>
  <h1>{section}</h1>
  <slot></slot>
</main>`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'dashboard', 'reports', 'page.html'),
      `<script>
const title = 'Quarterly';
</script>

<p>{title}</p>`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(projectDir, 'src', 'server', 'layout-data.ts'),
      `export async function getSection() {
  return 'Reports';
}
`,
      'utf-8',
    );

    await compile({ projectDir, isDev: true });
    const routesCode = fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.ts'), 'utf-8');

    expect(routesCode).toContain('const section = await __m0.getSection();');
    expect(routesCode).toContain('<h1>${__esc(section)}</h1>');
    expect(routesCode).toContain('<p>${__esc(title)}</p>');
  });

  it('rejects @kuratchi/js/environment imports in client reactive scripts', async () => {
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

    expect(async () => await compile({ projectDir, isDev: true })).toThrow(
      'Client <script> blocks cannot import from @kuratchi/js/environment.',
    );
  });

  it('emits route client assets for top-level $lib event handlers', async () => {
    const projectDir = createTempProject('route-client-handlers');
    fs.mkdirSync(path.join(projectDir, 'src', 'lib'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'src', 'server'), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, 'src', 'lib', 'form.ts'),
      `export function copyText(value: string) {
  return navigator.clipboard.writeText(value);
}

export function validateForm(event?: Event) {
  event?.preventDefault();
}
`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(projectDir, 'src', 'server', 'actions.ts'),
      `export async function submitForm(formData: FormData) {
  return formData;
}
`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'auth', 'signin', 'page.html'),
      `<script>
import { copyText, validateForm } from '$lib/form';
import { submitForm } from '$server/actions';
</script>

<form action={submitForm} onsubmit={validateForm()}>
  <button type="button" onclick={copyText('hello')}>Copy</button>
</form>`,
      'utf-8',
    );

    await compile({ projectDir, isDev: true });
    const routesCode = fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.ts'), 'utf-8');

    expect(routesCode).toContain('__kuratchi/client/routes/route_0.js');
    expect(routesCode).toContain('data-client-route="route_0"');
    expect(routesCode).toContain('data-client-handler="h0"');
    expect(routesCode).toContain('data-client-handler="h1"');
    expect(routesCode).toContain('data-client-event="click"');
    expect(routesCode).toContain('data-client-event="submit"');
    expect(routesCode).toContain('__kuratchi/client/modules/lib/form.js');
    expect(routesCode).toContain('window.__kuratchiClient?.register(');
  });

  it('keeps $lib helpers in render scope without returning them from async load output', async () => {
    const projectDir = createTempProject('async-lib-render-helper');
    fs.mkdirSync(path.join(projectDir, 'src', 'server'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'src', 'lib'), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, 'src', 'server', 'sites.ts'),
      `export async function getSites() {
  return [{ id: '1', totalSize: 2048 }];
}
`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(projectDir, 'src', 'lib', 'format.ts'),
      `export function formatBytes(bytes: number) {
  return bytes + ' B';
}
`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'auth', 'signin', 'page.html'),
      `<script>
import { getSites } from '$server/sites';
import { formatBytes } from '$lib/format';
const sites = await getSites();
</script>

<p>{formatBytes(sites[0].totalSize)}</p>`,
      'utf-8',
    );

    await compile({ projectDir, isDev: true });
    const routesCode = fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.ts'), 'utf-8');

    expect(routesCode).not.toContain('return { sites, getSites, formatBytes');
    expect(routesCode).not.toContain('return { sites, formatBytes');
    expect(routesCode).toContain('return { sites };');
    expect(routesCode).toContain('const formatBytes = __m');
    expect(routesCode).toContain('<p>${__esc(formatBytes(sites[0].totalSize))}</p>');
  });

  it('does not redeclare action imports in non-async render prelude', async () => {
    const projectDir = createTempProject('non-async-action-render');
    fs.mkdirSync(path.join(projectDir, 'src', 'server'), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, 'src', 'server', 'auth.ts'),
      `export async function signIn(formData: FormData) {
  return formData;
}
`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'auth', 'signin', 'page.html'),
      `<script>
import { signIn } from '$server/auth';
</script>

<form action={signIn} method="POST"></form>
<p>{signIn.error}</p>`,
      'utf-8',
    );

    await compile({ projectDir, isDev: true });
    const routesCode = fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.ts'), 'utf-8');

    expect(routesCode).toContain("actions: { 'signIn': __m0.signIn }");
    expect(routesCode).not.toContain('const signIn = __m0.signIn;');
    expect(routesCode).toContain('const { signIn, params, breadcrumbs } = data;');
  });

  it('emits route client assets for nested layout-level $lib event handlers', async () => {
    const projectDir = createTempProject('layout-client-handlers');
    fs.mkdirSync(path.join(projectDir, 'src', 'lib', 'ui'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'src', 'routes', 'dashboard'), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, 'src', 'lib', 'ui', 'dialog.ts'),
      `export function closeNearestDialog(_value?: unknown, _event?: Event, element?: Element | null) {
  const dialog = element?.closest ? element.closest('dialog') : null;
  if (dialog && typeof (dialog as HTMLDialogElement).close === 'function') {
    (dialog as HTMLDialogElement).close();
  }
}
`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'dashboard', 'layout.html'),
      `<script>
import { closeNearestDialog } from '$lib/ui/dialog';
</script>

<dialog open>
  <button type="button" onclick={closeNearestDialog()}>Close</button>
</dialog>
<slot></slot>`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'dashboard', 'page.html'),
      `<p>Hello</p>`,
      'utf-8',
    );

    await compile({ projectDir, isDev: true });
    const routesCode = fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.ts'), 'utf-8');

    expect(routesCode).toContain('__kuratchi/client/modules/lib/ui/dialog.js');
    expect(routesCode).toContain('__kuratchi/client/routes/route_0.js');
    expect(routesCode).toContain('data-client-route="route_0"');
    expect(routesCode).toContain('data-client-event="click"');
  });

  it('emits root layout client assets for top-level $lib event handlers', async () => {
    const projectDir = createTempProject('root-layout-client-handlers');
    fs.mkdirSync(path.join(projectDir, 'src', 'lib', 'ui'), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, 'src', 'lib', 'ui', 'dialog.ts'),
      `export function closeNearestDialog(_value?: unknown, _event?: Event, element?: Element | null) {
  const dialog = element?.closest ? element.closest('dialog') : null;
  if (dialog && typeof (dialog as HTMLDialogElement).close === 'function') {
    (dialog as HTMLDialogElement).close();
  }
}
`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'layout.html'),
      `<script>
import { closeNearestDialog } from '$lib/ui/dialog';
</script>

<!doctype html>
<html>
<head></head>
<body>
  <dialog open>
    <button type="button" onclick={closeNearestDialog()}>Close</button>
  </dialog>
  <slot></slot>
</body>
</html>`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'auth', 'signin', 'page.html'),
      `<p>Hello</p>`,
      'utf-8',
    );

    await compile({ projectDir, isDev: true });
    const routesCode = fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.ts'), 'utf-8');

    expect(routesCode).toContain('__kuratchi/client/modules/lib/ui/dialog.js');
    expect(routesCode).toContain('__kuratchi/client/routes/layout_root.js');
    expect(routesCode).toContain('data-client-route="layout_root"');
    expect(routesCode).toContain('data-client-event="click"');
    expect(routesCode).not.toContain("import { closeNearestDialog } from '$lib/ui/dialog';");
  });

  it('emits companion rpc schemas for imported route rpc functions', async () => {
    const projectDir = createTempProject('route-rpc-schemas');
    fs.mkdirSync(path.join(projectDir, 'src', 'server'), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, 'src', 'server', 'drafts.ts'),
      `import { schema, type InferSchema } from '@kuratchi/js';

export const schemas = {
  saveDraft: schema({
    title: schema.string().min(1),
    content: schema.string().min(1),
  }),
};

export async function saveDraft(data: InferSchema<typeof schemas.saveDraft>) {
  return data.title + ':' + data.content;
}
`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(projectDir, 'src', 'routes', 'auth', 'signin', 'page.html'),
      `<script>
import { saveDraft } from '$server/drafts';
</script>

<div data-poll={saveDraft({ title: 'Hello', content: 'World' })} data-interval="2s">
  waiting
</div>`,
      'utf-8',
    );

    await compile({ projectDir, isDev: true });
    const routesCode = fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.ts'), 'utf-8');

    expect(routesCode).toContain("rpcSchemas: { 'rpc_0_0': __m0.schemas?.[\"saveDraft\"] }");
    expect(routesCode).toContain("rpc: { 'rpc_0_0': __m0.saveDraft }");
  });

  it('validates durable object rpc methods against static schemas in generated proxies', async () => {
    const projectDir = createTempProject('do-rpc-schemas');
    fs.mkdirSync(path.join(projectDir, 'src', 'server'), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, 'kuratchi.config.ts'),
      `import { defineConfig } from '@kuratchi/js';

export default defineConfig({
  durableObjects: {
    PROFILE_DO: {
      className: 'ProfileDO',
    },
  },
});
`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(projectDir, 'src', 'server', 'profile.do.ts'),
      `import { DurableObject } from 'cloudflare:workers';
import { schema } from '@kuratchi/js';

export default class ProfileDO extends DurableObject {
  static schemas = {
    createProfile: schema({
      name: schema.string().min(1),
    }),
  };

  async createProfile(data: { name: string }) {
    return data.name;
  }
}
`,
      'utf-8',
    );

    await compile({ projectDir, isDev: true });
    const proxyCode = fs.readFileSync(path.join(projectDir, '.kuratchi', 'do', 'profile.do.ts'), 'utf-8');
    const routesCode = fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.ts'), 'utf-8');

    expect(proxyCode).toContain("import { validateSchemaInput as __validateSchemaInput } from '@kuratchi/js/runtime/schema.js';");
    expect(proxyCode).toContain("const __schema_createProfile = __handler_profile_do.schemas?.[\"createProfile\"];");
    expect(proxyCode).toContain("const __validated = __validateSchemaInput(__schema_createProfile, a);");
    expect(routesCode).toContain('static schemas = {};');
    expect(routesCode).toContain('Object.assign(ProfileDO.schemas, __handler_profile_do.schemas || {});');
  });
});
