import { describe, expect, test } from 'bun:test';
import { parseFile } from '../src/compiler/parser.ts';

describe('parser kuratchi:environment handling', () => {
  // kuratchi:environment works in all scripts (client-side).
  // The dev flag is serialized for client access.

  test('extracts dev alias from kuratchi:environment import', () => {
    const source = `
<script>
  import { dev } from 'kuratchi:environment';
  
  if (dev) console.log('dev mode');
</script>
<div>Hello</div>
`;
    const result = parseFile(source, { kind: 'route', filePath: 'test.html' });
    
    expect(result.devAliases).toContain('dev');
  });

  test('extracts dev alias from legacy @kuratchi/js/environment import', () => {
    const source = `
<script>
  import { dev } from '@kuratchi/js/environment';
  
  if (dev) console.log('dev mode');
</script>
<div>Hello</div>
`;
    const result = parseFile(source, { kind: 'route', filePath: 'test.html' });
    
    expect(result.devAliases).toContain('dev');
  });

  test('extracts renamed dev alias', () => {
    const source = `
<script>
  import { dev as isDevelopment } from 'kuratchi:environment';
  
  const check = isDevelopment;
</script>
<div>Hello</div>
`;
    const result = parseFile(source, { kind: 'route', filePath: 'test.html' });
    
    expect(result.devAliases).toContain('isDevelopment');
  });

  test('extracts dev alias from reactive script', () => {
    const source = `
<script>
  import { dev } from 'kuratchi:environment';
  
  $: if (dev) console.log('reactive dev check');
</script>
<div>Hello</div>
`;
    const result = parseFile(source, { kind: 'route', filePath: 'test.html' });
    
    expect(result.devAliases).toContain('dev');
  });

  test('throws error for non-dev exports from kuratchi:environment', () => {
    const source = `
<script>
  import { prod } from 'kuratchi:environment';
</script>
<div>Hello</div>
`;
    
    expect(() => parseFile(source, { kind: 'route', filePath: 'test.html' }))
      .toThrow(/kuratchi:environment currently only exports `dev`/);
  });

  test('devAliases is empty when no kuratchi:environment import', () => {
    const source = `
<script>
  console.log('no env import');
</script>
<div>Hello</div>
`;
    const result = parseFile(source, { kind: 'route', filePath: 'test.html' });
    
    expect(result.devAliases).toEqual([]);
  });
});
