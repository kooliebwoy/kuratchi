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

function setupProject(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `kuratchi-do-vis-${name}-`));
  tempDirs.push(dir);
  fs.mkdirSync(path.join(dir, 'src', 'routes'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src', 'server'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'routes', 'page.html'), '<p>page</p>\n', 'utf-8');
  fs.writeFileSync(
    path.join(dir, 'kuratchi.config.ts'),
    `import { defineConfig } from '@kuratchi/js';\nexport default defineConfig({});\n`,
    'utf-8',
  );
  fs.writeFileSync(
    path.join(dir, 'wrangler.jsonc'),
    JSON.stringify(
      {
        name: 'test-do-vis',
        main: '.kuratchi/worker.ts',
        durable_objects: {
          bindings: [{ name: 'SITES_DO', class_name: 'SitesDO' }],
        },
      },
      null,
      2,
    ),
    'utf-8',
  );
  return dir;
}

describe('DO RPC visibility', () => {
  it('does not expose private, protected or underscore-prefixed methods on the generated DO class prototype', async () => {
    const projectDir = setupProject('class');
    fs.writeFileSync(
      path.join(projectDir, 'src', 'server', 'sites.do.ts'),
      `import { kuratchiDO } from '@kuratchi/js/runtime';

export default class Sites extends kuratchiDO {
  static binding = 'SITES_DO';

  async publicMethod() { return 'ok'; }
  private async privateMethod() { return 'nope'; }
  protected async protectedMethod() { return 'nope'; }
  async _underscoreMethod() { return 'nope'; }
}
`,
      'utf-8',
    );

    await compile({ projectDir, isDev: true });
    const routesSrc = fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.ts'), 'utf-8');

    // The generated allow-list Set literal must contain only the public method.
    const allowSetMatch = routesSrc.match(/const __doPublic_[A-Za-z0-9_]+ = new Set\((\[.*?\])\)/);
    expect(allowSetMatch).not.toBeNull();
    const allowed = JSON.parse(allowSetMatch![1]);
    expect(allowed).toContain('publicMethod');
    expect(allowed).not.toContain('privateMethod');
    expect(allowed).not.toContain('protectedMethod');
    expect(allowed).not.toContain('_underscoreMethod');
  });

  it('proxy module imported by routes only exports public methods', async () => {
    const projectDir = setupProject('proxy');
    fs.writeFileSync(
      path.join(projectDir, 'src', 'server', 'sites.do.ts'),
      `import { kuratchiDO } from '@kuratchi/js/runtime';

export default class Sites extends kuratchiDO {
  static binding = 'SITES_DO';

  async listSites() { return []; }
  private async _internalQuery() { return null; }
  async _skipMe() { return null; }
}
`,
      'utf-8',
    );

    await compile({ projectDir, isDev: true });
    const proxyPath = path.join(projectDir, '.kuratchi', 'do', 'sites.do.ts');
    expect(fs.existsSync(proxyPath)).toBe(true);
    const proxySrc = fs.readFileSync(proxyPath, 'utf-8');
    expect(proxySrc).toMatch(/export async function listSites\b/);
    expect(proxySrc).not.toMatch(/export async function _internalQuery\b/);
    expect(proxySrc).not.toMatch(/export async function _skipMe\b/);
  });
});
