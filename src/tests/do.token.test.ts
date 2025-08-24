import { describe, it, expect } from 'vitest';
import { createSignedDbToken, validateSignedDbToken } from '../lib/do/token.js';

const GATEWAY_KEY = 'test_master_key_123';

describe('DO token utils', () => {
  it('creates a valid token and validates it', async () => {
    const db = 'org_acme';
    const tok = await createSignedDbToken(db, GATEWAY_KEY, 5 * 60 * 1000);
    const res = await validateSignedDbToken(db, tok, GATEWAY_KEY);
    expect(res.ok).toBe(true);
  });

  it('rejects token with wrong db', async () => {
    const tok = await createSignedDbToken('org_a', GATEWAY_KEY, 5 * 60 * 1000);
    const res = await validateSignedDbToken('org_b', tok, GATEWAY_KEY);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('dbname_mismatch');
  });

  it('rejects expired token', async () => {
    const db = 'org_expired';
    const tok = await createSignedDbToken(db, GATEWAY_KEY, -1000);
    const res = await validateSignedDbToken(db, tok, GATEWAY_KEY);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('expired');
  });

  it('rejects tampered token', async () => {
    const db = 'org_tamper';
    const tok = await createSignedDbToken(db, GATEWAY_KEY, 5 * 60 * 1000);
    const parts = tok.split('.');
    parts[1] = 'ffffffffffffffffffffffffffffffff'; // tamper rnd
    const bad = parts.join('.');
    const res = await validateSignedDbToken(db, bad, GATEWAY_KEY);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('bad_sig');
  });
});
