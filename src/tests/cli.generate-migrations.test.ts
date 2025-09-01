// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';

function mkTmpDir(prefix: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return dir;
}

function execNode(args: string[], opts: { cwd?: string } = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = execFile(process.execPath, args, { cwd: opts.cwd }, (err, stdout, stderr) => {
      const code = (err && (err as any).code != null) ? (err as any).code : 0;
      resolve({ code, stdout: stdout?.toString() || '', stderr: stderr?.toString() || '' });
    });
  });
}

const projectRoot = process.cwd();
const binPath = path.join(projectRoot, 'bin', 'kuratchi-sdk.mjs');
const distRoot = path.join(projectRoot, 'dist');
const distOrm = path.join(distRoot, 'lib', 'orm');

function ensureDir(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

beforeAll(() => {
  // Create stubbed dist modules so CLI can import without a full build
  ensureDir(distOrm);
  const normalizeJs = `export function normalizeSchema(dsl){ return dsl; }`;
  const sqliteGenJs = `export function buildInitialSql(schema){ return '/*init*/ CREATE TABLE __dummy(id INTEGER);'; }`;
  const diffJs = `export function buildDiffSql(a,b){ const changed = JSON.stringify(a) !== JSON.stringify(b); return { sql: changed ? '/*diff*/ ALTER TABLE __dummy ADD COLUMN c INTEGER;' : '', warnings: [] }; }`;
  fs.writeFileSync(path.join(distOrm, 'normalize.js'), normalizeJs, 'utf8');
  fs.writeFileSync(path.join(distOrm, 'sqlite-generator.js'), sqliteGenJs, 'utf8');
  fs.writeFileSync(path.join(distOrm, 'diff.js'), diffJs, 'utf8');
});

afterAll(() => {
  // Best-effort cleanup of dist stubs
  try {
    if (fs.existsSync(distRoot)) fs.rmSync(distRoot, { recursive: true, force: true });
  } catch {}
});

describe('CLI generate-migrations', () => {
  it('generates initial migration and journal for JS schema (happy path)', async () => {
    const tmp = mkTmpDir('kuratchi-cli-');
    const schemaPath = path.join(tmp, 'schema.js');
    fs.writeFileSync(schemaPath, `export const schema = { name: 'happy', version: 1, tables: {} };`, 'utf8');
    const outDir = path.join(tmp, 'out');

    const { code, stdout, stderr } = await execNode([binPath, 'generate-migrations', '--schema', schemaPath, '--outDir', outDir]);
    expect(code).toBe(0);
    expect(stderr).toBe('');
    const out = JSON.parse(stdout);
    expect(out.ok).toBe(true);
    expect(out.outDir).toBe(outDir);
    expect(fs.existsSync(out.sqlFile)).toBe(true);
    expect(fs.existsSync(out.journalPath)).toBe(true);
    expect(fs.existsSync(out.snapshotPath)).toBe(true);
    // journal should include idx 1
    const journal = JSON.parse(fs.readFileSync(out.journalPath, 'utf8'));
    expect(journal.entries?.[0]?.idx).toBe(1);
  });

  it('transpiles TS schema on the fly', async () => {
    const tmp = mkTmpDir('kuratchi-cli-');
    const schemaPath = path.join(tmp, 'schema.ts');
    fs.writeFileSync(schemaPath, `export const schema = { name: 'tscase', version: 1, tables: {} };`, 'utf8');
    const outDir = path.join(tmp, 'out');

    const { code, stdout } = await execNode([binPath, 'generate-migrations', '--schema', schemaPath, '--outDir', outDir]);
    expect(code).toBe(0);
    const out = JSON.parse(stdout);
    expect(out.ok).toBe(true);
    expect(out.outDir).toBe(outDir);
    expect(fs.existsSync(out.sqlFile)).toBe(true);
  });

  it('uses diff when fromSchema is provided', async () => {
    const tmp = mkTmpDir('kuratchi-cli-');
    const fromPath = path.join(tmp, 'from.js');
    const toPath = path.join(tmp, 'to.js');
    fs.writeFileSync(fromPath, `export const schema = { name: 'diffcase', version: 1, tables: {} };`, 'utf8');
    fs.writeFileSync(toPath, `export const schema = { name: 'diffcase', version: 2, tables: { t: {} } };`, 'utf8');
    const outDir = path.join(tmp, 'out');

    const { code, stdout } = await execNode([binPath, 'generate-migrations', '--schema', toPath, '--fromSchema', fromPath, '--outDir', outDir]);
    expect(code).toBe(0);
    const out = JSON.parse(stdout);
    expect(out.ok).toBe(true);
    expect(out.usedSnapshot).toBeFalsy();
    const sql = fs.readFileSync(out.sqlFile, 'utf8');
    expect(sql.includes('/*diff*/')).toBe(true);
  });

  it('fails with code 1 when schema argument is missing', async () => {
    const { code, stderr } = await execNode([binPath, 'generate-migrations']);
    expect(code).toBe(1);
    expect(stderr).toMatch(/Usage: kuratchi-sdk/);
  });
});
