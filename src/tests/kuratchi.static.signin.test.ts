import { describe, it, expect, vi } from 'vitest';
import { Kuratchi } from '../lib/kuratchi.js';

describe('Kuratchi.auth.signIn static helpers', () => {
  it('oauth.google.startUrl builds relative /auth/oauth/google/start with params', () => {
    const url = Kuratchi.auth.signIn.oauth.google.startUrl({ organizationId: 'org_1', redirectTo: '/dash' });
    expect(url).toBe('/auth/oauth/google/start?org=org_1&redirectTo=%2Fdash');
  });

  it('magicLink.send posts to /auth/magic/send with JSON body', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: any, init?: any) => {
      expect(input).toBe('/auth/magic/send');
      expect(init?.method).toBe('POST');
      expect(init?.headers['content-type'] || init?.headers?.get?.('content-type')).toContain('application/json');
      const body = JSON.parse(init?.body || '{}');
      expect(body).toEqual({ email: 'a@b.com', redirectTo: '/x', organizationId: 'org_1' });
      return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
    });

    const res = await Kuratchi.auth.signIn.magicLink.send('a@b.com', {
      redirectTo: '/x',
      organizationId: 'org_1',
      fetch: fetchMock as any,
    });

    expect(res).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
