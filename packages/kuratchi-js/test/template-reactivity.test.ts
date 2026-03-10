import { describe, expect, it } from 'bun:test';
import { compileTemplate } from '../src/compiler/template.js';

describe('template compiler reactive transform', () => {
  it('transforms $: expression into an internal effect', () => {
    const template = `<script>
let users = ['Alice'];
$: console.log(\`Users updated: \${users.length}\`);
</script>`;

    const compiled = compileTemplate(template);
    expect(compiled).toContain("const __k$ = window.__kuratchiReactive;");
    expect(compiled).toContain('let users = __k$.state(["Alice"]);');
    expect(compiled).toContain('__k$.effect(() => {');
    expect(compiled).toContain('console.log(\\`Users updated: \\${users.length}\\`);');
    expect(compiled).toContain('Users updated: \\${users.length}');
  });

  it('rewrites proxy-backed reassignment to preserve reactivity', () => {
    const template = `<script>
let users = ['Alice'];
$: console.log(users.length);
function resetUsers() {
  users = ['Bob'];
}
</script>`;

    const compiled = compileTemplate(template);
    expect(compiled).toContain('users = __k$.replace(users, ["Bob"]);');
  });

  it('transforms $: block syntax into an effect block', () => {
    const template = `<script>
let form = { first: '', last: '' };
$: {
  const fullName = \`\${form.first} \${form.last}\`.trim();
  console.log(fullName);
}
</script>`;

    const compiled = compileTemplate(template);
    expect(compiled).toContain('let form = __k$.state({ first: "", last: "" });');
    expect(compiled).toContain("__k$.effect(() => {");
    expect(compiled).toContain('const fullName = \\`\\${form.first} \\${form.last}\\`.trim();');
    expect(compiled).toContain("});");
  });

  it('injects runtime binding after top-level import statements in module scripts', () => {
    const template = `<script type="module">
import { x } from './x.js';
let users = [];
$: console.log(users.length);
</script>`;

    const compiled = compileTemplate(template);
    const importIdx = compiled.indexOf('import { x } from "./x.js";');
    const runtimeIdx = compiled.indexOf('const __k$ = window.__kuratchiReactive;');
    expect(importIdx).toBeGreaterThan(-1);
    expect(runtimeIdx).toBeGreaterThan(-1);
    expect(runtimeIdx).toBeGreaterThan(importIdx);
  });

  it('does not inject reactive runtime binding when no $: label is present', () => {
    const template = `<script>
const title = 'Hello';
console.log(title);
</script>`;

    const compiled = compileTemplate(template);
    expect(compiled).not.toContain("const __k$ = window.__kuratchiReactive;");
    expect(compiled).toContain('const title = "Hello";');
  });

  it('transpiles TypeScript syntax inside client scripts', () => {
    const template = `<script>
const title: string = 'Hello';
const siteKey = env?.TURNSTILE_SITE_KEY as string | undefined;
</script>`;

    const compiled = compileTemplate(template);
    expect(compiled).toContain('const title = "Hello";');
    expect(compiled).toContain('const siteKey = env?.TURNSTILE_SITE_KEY;');
    expect(compiled).not.toContain(' as string');
    expect(compiled).not.toContain('const title: string');
  });
});
