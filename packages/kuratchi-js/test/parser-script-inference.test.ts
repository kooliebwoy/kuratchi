import { describe, expect, it } from 'bun:test';
import { parseFile } from '../src/compiler/parser.js';

describe('parser: top-level script inference', () => {
  it('extracts non-reactive top-level script for server prepass', () => {
    const source = `<script>
import { getUser } from './server/auth';
const user = await getUser();
</script>
<main>{user?.email}</main>`;

    const parsed = parseFile(source);
    expect(parsed.script).toContain('const user = await getUser();');
    expect(parsed.hasLoad).toBe(true);
    expect(parsed.template).toContain('<main>{user?.email}</main>');
  });

  it('keeps reactive top-level script in template as client script', () => {
    const source = `<script>
let count = 0;
$: count = count + 1;
</script>
<main>{count}</main>`;

    const parsed = parseFile(source);
    expect(parsed.script).toBeNull();
    expect(parsed.hasLoad).toBe(false);
    expect(parsed.template).toContain('$: count = count + 1;');
  });

  it('extracts explicit load() return vars for template access', () => {
    const source = `<script>
import { env } from 'cloudflare:workers';

export async function load() {
  return {
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || '',
  };
}
</script>
<main>{turnstileSiteKey}</main>`;

    const parsed = parseFile(source);
    expect(parsed.loadFunction).toContain('export async function load()');
    expect(parsed.loadReturnVars).toContain('turnstileSiteKey');
    expect(parsed.dataVars).toContain('turnstileSiteKey');
  });

  it('rejects client template script bindings used in server-rendered template output', () => {
    const source = `<div>{formatBytes(1024)}</div>

<script>
  function formatBytes(bytes) {
    return String(bytes);
  }
</script>`;

    expect(() => parseFile(source, { filePath: 'src/routes/sites/page.html' })).toThrow(
      'Client template <script> bindings cannot be used in server-rendered template output: formatBytes.',
    );
  });

  // Note: $lib/ imports are now isomorphic and allowed in server templates
  // The old $client/ convention that blocked server template usage has been removed
});
