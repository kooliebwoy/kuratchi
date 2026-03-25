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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `kuratchi-worker-${name}-`));
  tempDirs.push(dir);
  fs.mkdirSync(path.join(dir, 'src', 'routes'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'routes', 'page.html'), '<p>Hello</p>\n', 'utf-8');
  return dir;
}

describe('compiler worker entrypoints', () => {
  it('emits JS shims that forward to the current TS entrypoints', async () => {
    const projectDir = createTempProject('compat-shims');

    const workerPath = await compile({ projectDir, isDev: true });

    expect(workerPath).toBe(path.join(projectDir, '.kuratchi', 'worker.ts'));
    expect(fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.js'), 'utf-8')).toContain(
      "export * from './routes.ts';",
    );
    expect(fs.readFileSync(path.join(projectDir, '.kuratchi', 'worker.js'), 'utf-8')).toContain(
      "export * from './worker.ts';",
    );
  });

  it('does not treat wrangler durable object agent bindings as generated kuratchi DO classes', async () => {
    const projectDir = createTempProject('agent-do-bindings');
    fs.mkdirSync(path.join(projectDir, 'src', 'server', 'ai'), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, 'kuratchi.config.ts'),
      `import { defineConfig } from '@kuratchi/js';

export default defineConfig({});
`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(projectDir, 'wrangler.jsonc'),
      JSON.stringify({
        name: 'test-app',
        main: '.kuratchi/worker.ts',
        durable_objects: {
          bindings: [
            { name: 'KURATCHI_AI_SESSION', class_name: 'KuratchiAiSession' },
          ],
        },
      }, null, 2),
      'utf-8',
    );
    fs.writeFileSync(
      path.join(projectDir, 'src', 'server', 'ai', 'kuratchi-ai-session.agent.ts'),
      `export class KuratchiAiSession {
  async onRequest() {
    return new Response('ok');
  }
}
`,
      'utf-8',
    );

    await compile({ projectDir, isDev: true });
    const workerSource = fs.readFileSync(path.join(projectDir, '.kuratchi', 'worker.ts'), 'utf-8');

    expect(workerSource).toContain("export { KuratchiAiSession } from '../src/server/ai/kuratchi-ai-session.agent';");
    expect(workerSource).not.toContain("export { KuratchiAiSession } from './routes.ts';");
  });

});
