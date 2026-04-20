import { describe, expect, it } from 'bun:test';

import { compileTemplate, splitTemplateRenderSections } from '../src/compiler/template.js';

describe('template render sections', () => {
  it('separates conditional head content from body content', () => {
    const template = `if (!user) {
  <head>
    <meta http-equiv="refresh" content="0;url=/auth/signin" />
  </head>
  <p>Redirecting to sign in...</p>
} else {
  <section>Dashboard</section>
}`;

    const sections = splitTemplateRenderSections(template);

    expect(sections.headTemplate).toContain('<meta http-equiv="refresh" content="0;url=/auth/signin" />');
    expect(sections.headTemplate).not.toContain('<p>Redirecting to sign in...</p>');
    expect(sections.bodyTemplate).toContain('<p>Redirecting to sign in...</p>');
    expect(sections.bodyTemplate).not.toContain('<meta http-equiv="refresh" content="0;url=/auth/signin" />');
    expect(sections.headTemplate).toContain('if (!user) {');
    expect(sections.bodyTemplate).toContain('if (!user) {');
  });

  it('does not treat css braces inside style blocks as head control flow', () => {
    const template = `<style>
  .box {
    color: red;
  }
</style>

if (!user) {
  <head>
    <meta http-equiv="refresh" content="0;url=/auth/signin" />
  </head>
  <p>Redirecting to sign in...</p>
} else {
  <section>Dashboard</section>
}`;

    const sections = splitTemplateRenderSections(template);

    expect(sections.bodyTemplate).toContain('<style>');
    expect(sections.bodyTemplate).toContain('  }');
    expect(sections.headTemplate).toContain('if (!user) {');
    expect(sections.headTemplate).not.toContain('.box {');
    expect(sections.headTemplate).not.toContain('color: red;');
    expect(sections.headTemplate).not.toContain('  }');
  });

  it('leaves unknown data- attributes as-is (no fragment instrumentation)', () => {
    // `data-poll` / `data-interval` were removed along with the fragment manifest
    // infrastructure. Live workflow status now lives in the `kuratchi:workflow`
    // virtual module. This test guards against the compiler reintroducing any
    // implicit data-* attribute handling.
    const compiled = compileTemplate(
      `<section data-poll={getStatus(job.id)}>
  <strong>{job.status}</strong>
</section>`,
      undefined,
      undefined,
      new Map([['getStatus', 'rpc_status']]),
      { emitCall: '__emit' },
    );

    expect(compiled).not.toContain('__pushFragment(');
    expect(compiled).not.toContain('__popFragment(');
    expect(compiled).not.toContain('__signFragment(');
    expect(compiled).not.toContain('data-poll-id');
    // The attribute is passed through to the output unchanged.
    expect(compiled).toContain('data-poll=');
  });
});
