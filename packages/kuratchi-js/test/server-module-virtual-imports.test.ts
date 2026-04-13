import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createServerModuleCompiler } from '../src/compiler/server-module-pipeline.ts';

describe('server-module-pipeline virtual imports', () => {
  let tempDir: string;
  let srcDir: string;
  let serverDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kuratchi-test-'));
    srcDir = path.join(tempDir, 'src');
    serverDir = path.join(srcDir, 'server');
    fs.mkdirSync(serverDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function createCompiler() {
    return createServerModuleCompiler({
      projectDir: tempDir,
      srcDir,
      doHandlerProxyPaths: new Map(),
      isDev: true,
      writeFile: (filePath, content) => {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, content);
      },
    });
  }

  test('injects compile-time dev aliases for kuratchi:environment imports', () => {
    const moduleFile = path.join(serverDir, 'test.ts');
    fs.writeFileSync(moduleFile, `
import { dev } from 'kuratchi:environment';

export function checkDev() {
  return dev;
}
`);

    const compiler = createCompiler();
    const outputPath = compiler.transformModule(moduleFile);
    const output = fs.readFileSync(outputPath, 'utf-8');

    expect(output).toContain('const dev = true;');
    expect(output).not.toContain("from 'kuratchi:environment'");
  });

  test('rewrites kuratchi:request to @kuratchi/js/runtime/request.js', () => {
    const moduleFile = path.join(serverDir, 'test.ts');
    fs.writeFileSync(moduleFile, `
import { url, params, locals } from 'kuratchi:request';

export function getRequestInfo() {
  return { url: url.href, params, locals };
}
`);

    const compiler = createCompiler();
    const outputPath = compiler.transformModule(moduleFile);
    const output = fs.readFileSync(outputPath, 'utf-8');

    expect(output).toContain("from '@kuratchi/js/runtime/request.js'");
    expect(output).not.toContain("from 'kuratchi:request'");
  });

  test('rewrites kuratchi:navigation to @kuratchi/js/runtime/navigation.js', () => {
    const moduleFile = path.join(serverDir, 'test.ts');
    fs.writeFileSync(moduleFile, `
import { redirect } from 'kuratchi:navigation';

export function requireAuth(isLoggedIn: boolean) {
  if (!isLoggedIn) redirect('/login');
}
`);

    const compiler = createCompiler();
    const outputPath = compiler.transformModule(moduleFile);
    const output = fs.readFileSync(outputPath, 'utf-8');

    expect(output).toContain("from '@kuratchi/js/runtime/navigation.js'");
    expect(output).not.toContain("from 'kuratchi:navigation'");
  });

  test('handles multiple kuratchi:* imports in same file', () => {
    const moduleFile = path.join(serverDir, 'test.ts');
    fs.writeFileSync(moduleFile, `
import { dev } from 'kuratchi:environment';
import { url, params } from 'kuratchi:request';
import { redirect } from 'kuratchi:navigation';

export function handler() {
  if (dev) console.log('dev mode');
  if (!params.id) redirect('/404');
  return url.pathname;
}
`);

    const compiler = createCompiler();
    const outputPath = compiler.transformModule(moduleFile);
    const output = fs.readFileSync(outputPath, 'utf-8');

    expect(output).toContain('const dev = true;');
    expect(output).toContain("from '@kuratchi/js/runtime/request.js'");
    expect(output).toContain("from '@kuratchi/js/runtime/navigation.js'");
    expect(output).not.toContain("from 'kuratchi:");
  });

  test('preserves non-kuratchi imports unchanged', () => {
    const moduleFile = path.join(serverDir, 'test.ts');
    fs.writeFileSync(moduleFile, `
import { dev } from 'kuratchi:environment';
import { env } from 'cloudflare:workers';
import lodash from 'lodash';

export function test() {
  return { dev, env, lodash };
}
`);

    const compiler = createCompiler();
    const outputPath = compiler.transformModule(moduleFile);
    const output = fs.readFileSync(outputPath, 'utf-8');

    expect(output).toContain('const dev = true;');
    expect(output).toContain("from 'cloudflare:workers'");
    expect(output).toContain("from 'lodash'");
  });

  test('resolveCompiledImportPath handles kuratchi:* modules', () => {
    const compiler = createCompiler();

    expect(compiler.resolveCompiledImportPath('kuratchi:environment', serverDir, tempDir))
      .toBe('@kuratchi/js/runtime/environment.js');
    expect(compiler.resolveCompiledImportPath('kuratchi:request', serverDir, tempDir))
      .toBe('@kuratchi/js/runtime/request.js');
    expect(compiler.resolveCompiledImportPath('kuratchi:navigation', serverDir, tempDir))
      .toBe('@kuratchi/js/runtime/navigation.js');
  });

  test('leaves unknown kuratchi:* modules unchanged', () => {
    const moduleFile = path.join(serverDir, 'test.ts');
    fs.writeFileSync(moduleFile, `
import { foo } from 'kuratchi:unknown';

export const bar = foo;
`);

    const compiler = createCompiler();
    const outputPath = compiler.transformModule(moduleFile);
    const output = fs.readFileSync(outputPath, 'utf-8');

    // Unknown modules are left as-is (will fail at runtime, but that's expected)
    expect(output).toContain("from 'kuratchi:unknown'");
  });
});
