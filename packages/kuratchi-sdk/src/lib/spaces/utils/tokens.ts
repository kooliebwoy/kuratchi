/**
 * Kuratchi Spaces - Token Generation Utilities
 */

/**
 * Generate a space token with HMAC-SHA256 signature
 * Format: spaceId.random.expiry.signature
 */
export async function generateSpaceToken(
  spaceId: string,
  gatewayKey: string,
  expiryMs: number = 3600000 // 1 hour default
): Promise<string> {
  const rnd = crypto.randomUUID().substring(0, 8);
  const exp = Date.now() + expiryMs;
  const payload = `${spaceId}.${rnd}.${exp}`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(gatewayKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const bytes = new Uint8Array(sig);
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  let b64 = btoa(str);
  b64 = b64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${payload}.${b64}`;
}

/**
 * Validate a space token
 */
export async function validateSpaceToken(
  token: string,
  spaceId: string,
  gatewayKey: string
): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 4) {
    return false;
  }

  const [tSpace, rnd, expStr, sigB64] = parts;

  // Check space ID matches
  if (tSpace !== spaceId) {
    return false;
  }

  // Check expiry
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) {
    return false;
  }

  // Verify signature
  const payload = `${tSpace}.${rnd}.${exp}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(gatewayKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const bytes = new Uint8Array(sig);
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  let b64 = btoa(str);
  b64 = b64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return b64 === sigB64;
}
