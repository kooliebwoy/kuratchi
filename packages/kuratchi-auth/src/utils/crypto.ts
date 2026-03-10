/**
 * @kuratchi/auth â€” Crypto utilities
 * Pure WebCrypto API â€” works in Cloudflare Workers, Node 20+, Deno, Bun
 */

/**
 * Generate a secure random session token using Web Crypto API
 * @returns A base64url encoded random string
 */
export function generateSessionToken(): string {
	const bytes = new Uint8Array(20);
	crypto.getRandomValues(bytes);
	return toBase64Url(bytes);
}

/**
 * Hash a password with PBKDF2 + optional pepper
 * Returns "saltHex:hashHex"
 */
export const hashPassword = async (password: string, providedSalt?: Uint8Array, pepper?: string): Promise<string> => {
	const encoder = new TextEncoder();
	const salt = providedSalt || crypto.getRandomValues(new Uint8Array(16));

	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		encoder.encode(pepper ? `${password}:${pepper}` : password),
		{ name: 'PBKDF2' },
		false,
		['deriveBits', 'deriveKey']
	);

	const key = await crypto.subtle.deriveKey(
		{
			name: 'PBKDF2',
			salt: salt.buffer as ArrayBuffer,
			iterations: 100000,
			hash: 'SHA-256',
		},
		keyMaterial,
		{ name: 'AES-GCM', length: 256 },
		true,
		['encrypt', 'decrypt']
	);

	const exportedKey = await crypto.subtle.exportKey('raw', key);
	const hashArray = Array.from(new Uint8Array(exportedKey));
	const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

	const saltArray = Array.from(salt);
	const saltHex = saltArray.map(b => b.toString(16).padStart(2, '0')).join('');

	return `${saltHex}:${hashHex}`;
};

/**
 * Compare a plaintext password against a stored hash.
 * Uses HMAC-verify for the final comparison to ensure constant-time behaviour
 * and prevent timing side-channel leakage.
 */
export const comparePassword = async (password: string, hashedPassword: string, pepper?: string): Promise<boolean> => {
	const [salt, hash] = hashedPassword.split(':');
	const saltMatches = salt.match(/.{1,2}/g);
	if (!saltMatches) return false;
	const saltBuffer = new Uint8Array(saltMatches.map(byte => parseInt(byte, 16)));

	const _hash = await hashPassword(password, saltBuffer, pepper);
	const [, _hashHex] = _hash.split(':');

	// Constant-time comparison via crypto.subtle.verify (HMAC).
	// crypto.subtle.verify() is spec-guaranteed to run in constant time,
	// unlike JavaScript's === operator which may short-circuit.
	const enc = new TextEncoder();
	const zeroKey = await crypto.subtle.importKey(
		'raw', new Uint8Array(32),
		{ name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
	);
	const mac = await crypto.subtle.sign('HMAC', zeroKey, enc.encode(_hashHex));
	return crypto.subtle.verify('HMAC', zeroKey, mac, enc.encode(hash));
};

/**
 * SHA-256 hash a token string
 */
export const hashToken = async (token: string): Promise<string> => {
	const encoder = new TextEncoder();
	const data = encoder.encode(token);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// ==============================
// Base64url helpers
// ==============================

const _toBytes = (input: string | ArrayBuffer | Uint8Array) =>
	typeof input === 'string' ? new TextEncoder().encode(input) : (input instanceof Uint8Array ? input : new Uint8Array(input));

const _bytesToBase64 = (bytes: Uint8Array) => {
	const B = (globalThis as any).Buffer;
	if (B) return B.from(bytes).toString('base64');
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary);
};

const _base64ToBytes = (b64: string) => {
	const B = (globalThis as any).Buffer;
	if (B) return new Uint8Array(B.from(b64, 'base64'));
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
};

export const toBase64Url = (buf: ArrayBuffer | Uint8Array | string) =>
	_bytesToBase64(_toBytes(buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

export const fromBase64Url = (b64url: string): Uint8Array => {
	const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '=');
	return _base64ToBytes(b64);
};

export function b64urlDecodeToString(str: string): string {
	const decoded = fromBase64Url(str);
	return new TextDecoder().decode(decoded);
}

// ==============================
// Session cookie encryption (AES-GCM)
// ==============================

/**
 * Derive an AES-GCM-256 key from AUTH_SECRET using HKDF-SHA-256.
 *
 * BREAKING CHANGE from prior SHA-256 direct-hash derivation:
 * Any cookie or value encrypted with the old key is no longer decryptable.
 * All active sessions are invalidated when this version is deployed.
 *
 * The `info` label provides domain separation so the same secret produces
 * independent keys for different purposes (sessions, stored tokens, etc.).
 */
const importAesGcmKey = async (secret: string, info = 'kuratchi-session-v1'): Promise<CryptoKey> => {
	if (!secret) {
		throw new Error('[kuratchi/auth] Cannot derive encryption key from empty secret. Set AUTH_SECRET.');
	}
	const enc = new TextEncoder();
	const baseKey = await crypto.subtle.importKey(
		'raw', enc.encode(secret),
		'HKDF', false, ['deriveKey']
	);
	return crypto.subtle.deriveKey(
		{
			name: 'HKDF',
			hash: 'SHA-256',
			salt: new Uint8Array(0), // empty salt is acceptable when IKM is already high-entropy
			info: enc.encode(info),
		},
		baseKey,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
};

/**
 * Build an opaque encrypted session cookie from orgId and tokenHash
 */
export const buildSessionCookie = async (
	secret: string,
	orgId: string,
	tokenHash: string
): Promise<string> => {
	const key = await importAesGcmKey(secret);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const payload = JSON.stringify({ o: orgId, th: tokenHash });
	const pt = new TextEncoder().encode(payload);
	const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pt);
	const combined = new Uint8Array(iv.byteLength + (ct as ArrayBuffer).byteLength);
	combined.set(iv, 0);
	combined.set(new Uint8Array(ct), iv.byteLength);
	return toBase64Url(combined);
};

/**
 * Parse an opaque session cookie into { orgId, tokenHash }
 */
export const parseSessionCookie = async (
	secret: string,
	cookie: string
): Promise<{ orgId: string; tokenHash: string } | null> => {
	try {
		if (!cookie) return null;
		const data = fromBase64Url(cookie);
		if (data.byteLength < 13) return null;
		const iv = data.slice(0, 12);
		const ct = data.slice(12);
		const key = await importAesGcmKey(secret);
		const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
		const json = new TextDecoder().decode(pt);
		const parsed = JSON.parse(json);
		if (!parsed?.o || !parsed?.th) return null;
		return { orgId: parsed.o, tokenHash: parsed.th };
	} catch {
		return null;
	}
};

// ==============================
// Generic at-rest value encryption (OAuth tokens, etc.)
// ==============================

/**
 * Encrypt a sensitive string value for at-rest storage (e.g. OAuth access/refresh tokens).
 * Uses AES-GCM-256 with a key derived from AUTH_SECRET via HKDF, domain-separated from
 * the session cookie key by a different info label.
 * Returns a base64url-encoded IV+ciphertext blob.
 */
export const encryptValue = async (secret: string, value: string): Promise<string> => {
	const key = await importAesGcmKey(secret, 'kuratchi-stored-value-v1');
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const pt = new TextEncoder().encode(value);
	const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pt);
	const combined = new Uint8Array(iv.byteLength + (ct as ArrayBuffer).byteLength);
	combined.set(iv, 0);
	combined.set(new Uint8Array(ct), iv.byteLength);
	return toBase64Url(combined);
};

/**
 * Decrypt a value encrypted by encryptValue. Returns null if decryption fails
 * (wrong key, truncated data, or tampered ciphertext).
 */
export const decryptValue = async (secret: string, encrypted: string): Promise<string | null> => {
	try {
		const data = fromBase64Url(encrypted);
		if (data.byteLength < 13) return null;
		const iv = data.slice(0, 12);
		const ct = data.slice(12);
		const key = await importAesGcmKey(secret, 'kuratchi-stored-value-v1');
		const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
		return new TextDecoder().decode(pt);
	} catch {
		return null;
	}
};

// ==============================
// HMAC state signing (for OAuth)
// ==============================

export const importHmacKey = async (secret: string): Promise<CryptoKey> =>
	crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

export const signState = async (secret: string, payload: Record<string, any>): Promise<string> => {
	const key = await importHmacKey(secret);
	const json = JSON.stringify(payload);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(json));
	return `${toBase64Url(json)}.${toBase64Url(new Uint8Array(sig))}`;
};

export const verifyState = async (secret: string, state: string): Promise<Record<string, any> | null> => {
	try {
		const [p, s] = state.split('.', 2);
		if (!p || !s) return null;
		const json = b64urlDecodeToString(p);
		const key = await importHmacKey(secret);
		const sigBytes = fromBase64Url(s);
		const sigCopy = new Uint8Array(sigBytes.byteLength);
		sigCopy.set(sigBytes);
		const sigBuf: ArrayBuffer = sigCopy.buffer;
		const valid = await crypto.subtle.verify('HMAC', key, sigBuf, new TextEncoder().encode(json));
		if (!valid) return null;
		return JSON.parse(json);
	} catch {
		return null;
	}
};



