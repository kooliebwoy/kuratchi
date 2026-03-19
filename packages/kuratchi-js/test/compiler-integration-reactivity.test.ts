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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `kuratchi-${name}-`));
  tempDirs.push(dir);
  fs.mkdirSync(path.join(dir, 'src', 'routes'), { recursive: true });
  return dir;
}

function writeRoute(projectDir: string, source: string): void {
  const routeFile = path.join(projectDir, 'src', 'routes', 'page.html');
  fs.writeFileSync(routeFile, source, 'utf-8');
}

function readCompiledRoutes(projectDir: string): string {
  return fs.readFileSync(path.join(projectDir, '.kuratchi', 'routes.ts'), 'utf-8');
}

describe('compiler integration: reactive client scripts', () => {
  it('emits reactive transforms for $: route scripts in compiled output', async () => {
    const projectDir = createTempProject('reactive-route');
    writeRoute(
      projectDir,
      `<main>Reactive page</main>
<script>
let users = ['Alice'];
$: console.log(users.length);
function reset() {
  users = ['Bob'];
}
</script>

<button onClick="reset()">Reset</button>`,
    );

    const workerPath = await compile({ projectDir, isDev: true });
    expect(workerPath).toBe(path.join(projectDir, '.kuratchi', 'worker.ts'));

    const routesCode = readCompiledRoutes(projectDir);
    expect(routesCode).toContain('window.__kuratchiReactive');
    expect(routesCode).toContain("let users = __k$.state(['Alice']);");
    expect(routesCode).toContain('__k$.effect(() => {');
    expect(routesCode).toContain('console.log(users.length);');
    expect(routesCode).toContain("users = __k$.replace(users, ['Bob']);");
  });

  it('keeps module imports before reactive runtime binding in compiled scripts', async () => {
    const projectDir = createTempProject('reactive-module-order');
    writeRoute(
      projectDir,
      `<main>Module script</main>
<script type="module">
import { greet } from './client.js';
let users = [];
$: console.log(users.length);
</script>
<div>Hi</div>`,
    );

    await compile({ projectDir, isDev: true });
    const routesCode = readCompiledRoutes(projectDir);

    const importNeedle = "import { greet } from './client.js';";
    const runtimeNeedle = 'const __k$ = window.__kuratchiReactive;';
    const importIdx = routesCode.indexOf(importNeedle);
    const runtimeIdx = routesCode.indexOf(runtimeNeedle);

    expect(importIdx).toBeGreaterThan(-1);
    expect(runtimeIdx).toBeGreaterThan(-1);
    expect(runtimeIdx).toBeGreaterThan(importIdx);
  });
});
