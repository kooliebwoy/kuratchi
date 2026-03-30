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

function createDesktopProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kuratchi-desktop-'));
  tempDirs.push(dir);
  fs.mkdirSync(path.join(dir, 'src', 'routes'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'routes', 'page.html'), '<p>Hello desktop</p>\n', 'utf-8');
  fs.writeFileSync(
    path.join(dir, 'kuratchi.config.ts'),
    `import { defineConfig } from '@kuratchi/js';
import { kuratchiOrmConfig } from '@kuratchi/orm/adapter';
import { todoSchema } from './src/schema';

export default defineConfig({
  orm: kuratchiOrmConfig({
    databases: {
      DB: { schema: todoSchema, remote: true },
    },
  }),
  desktop: {
    appName: 'Desktop Todo',
    appId: 'dev.kuratchi.desktop-todo',
    initialPath: '/todos',
    window: {
      title: 'Desktop Todo',
      width: 1280,
      height: 820,
    },
    bindings: {
      notifications: true,
    },
  },
});
`,
    'utf-8',
  );
  fs.writeFileSync(
    path.join(dir, 'src', 'schema.ts'),
    `export const todoSchema = {
  name: 'desktop-todo',
  version: 1,
  tables: {
    todos: {
      id: 'integer primary key',
      title: 'text not null',
    },
  },
};
`,
    'utf-8',
  );
  return dir;
}

describe('desktop manifest generation', () => {
  it('emits a desktop manifest when desktop config is present', async () => {
    const projectDir = createDesktopProject();

    await compile({ projectDir, isDev: true });

    const manifestPath = path.join(projectDir, '.kuratchi', 'desktop.manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.app.name).toBe('Desktop Todo');
    expect(manifest.app.id).toBe('dev.kuratchi.desktop-todo');
    expect(manifest.app.initialPath).toBe('/todos');
    expect(manifest.app.window.width).toBe(1280);
    expect(manifest.bindings.desktop.notifications).toBe(true);
    expect(manifest.bindings.remote).toEqual([
      { binding: 'DB', type: 'd1', remote: true },
    ]);
    expect(manifest.runtime.workerEntrypoint.endsWith(path.join('.kuratchi', 'worker.ts'))).toBe(true);
  });
});
