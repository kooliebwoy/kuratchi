// Shared token helpers for DO gateway auth
// Uses WebCrypto (SubtleCrypto) available in modern Node and CF Workers

function base64urlFromBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  // btoa is available in Workers and in many Node environments via undici; fallback if missing
  // @ts-ignore
  const b64 = typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return b64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function decodeBase64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 2 ? '==' : b64.length % 4 === 3 ? '=' : '';
  const b64p = b64 + pad;
  // @ts-ignore
  const bin = typeof atob !== 'undefined' ? atob(b64p) : Buffer.from(b64p, 'base64').toString('binary');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await (crypto as any).subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await (crypto as any).subtle.sign('HMAC', key, enc.encode(data));
  return new Uint8Array(sig);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) res |= a[i] ^ b[i];
  return res === 0;
}

export async function createSignedDbToken(dbName: string, secret: string, ttlMs: number = 30 * 24 * 60 * 60 * 1000): Promise<string> {
  const rndBytes = crypto.getRandomValues(new Uint8Array(16));
  const rnd = Array.from(rndBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const exp = Date.now() + ttlMs;
  const payload = `${dbName}.${rnd}.${exp}`;
  const sig = await hmacSha256(secret, payload);
  return `${dbName}.${rnd}.${exp}.${base64urlFromBytes(sig)}`;
}

export async function validateSignedDbToken(dbName: string, token: string, secret: string): Promise<{ ok: boolean; reason?: string }>
{
  const parts = token.split('.');
  if (parts.length !== 4) return { ok: false, reason: 'malformed' };
  const [tDb, rnd, expStr, sigB64] = parts;
  if (!tDb || !rnd || !expStr || !sigB64) return { ok: false, reason: 'malformed' };
  if (tDb !== dbName) return { ok: false, reason: 'dbname_mismatch' };
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return { ok: false, reason: 'expired' };
  const payload = `${tDb}.${rnd}.${exp}`;
  const expected = await hmacSha256(secret, payload);
  const got = decodeBase64urlToBytes(sigB64);
  if (!timingSafeEqual(expected, got)) return { ok: false, reason: 'bad_sig' };
  return { ok: true };
}
