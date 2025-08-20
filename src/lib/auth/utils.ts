import type { Session } from './types.js';

/**
 * Generate a secure random session token using Web Crypto API
 * @returns A base64 encoded random string
 */
export function generateSessionToken(): string {
	// Create a random array of 20 bytes (160 bits)
	const bytes = new Uint8Array(20);
	crypto.getRandomValues(bytes);
	// Return URL-safe base64
	return toBase64Url(bytes);
}

/**
 * Extract orgId from a sessionId formatted as "<orgId>.<random>".
 * Returns null for admin sessions ("admin.<random>") or when not present.
 */
export function parseOrgIdFromSessionId(sessionId: string): string | null {
    if (!sessionId) return null;
    const dotIndex = sessionId.indexOf('.');
    if (dotIndex <= 0) return null; // no prefix
    const prefix = sessionId.slice(0, dotIndex);
    if (!prefix || prefix === 'admin') return null;
    return prefix;
}

/**
 * Create a new session in the database
 * @param token - The session token
 * @param userId - The user ID
 * @returns The created session object
 */
export async function createSession(token: string, userId: string): Promise<Partial<Session>> {
	// Hash the token for storage
	const encoder = new TextEncoder();
	const data = encoder.encode(token);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	
	// Convert the hash to hex string
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const sessionToken = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
	
	// Create the session with 30 days expiry
	const expires = new Date();
	expires.setDate(expires.getDate() + 30);
	
	// Current timestamp for created_at and updated_at
	const now = new Date();
	
	const session: Session = {
		sessionToken,
		userId,
		expires,
		created_at: now.toISOString(),
		updated_at: now.toISOString(),
		deleted_at: null
	};
	
	return session;
}


/**
 * Create a session token response for frontend workers to use
 * Backend services should return this data, not set cookies directly
 */
export function createSessionTokenResponse(token: string, expiresAt: Date, userEmail: string) {
	// Combine token and userEmail for the cookie value
	const combinedToken = `${token}:${userEmail}`;
	
	return {
		token: combinedToken,
		expiresAt,
		cookieOptions: {
			httpOnly: true,
			sameSite: "lax" as const,
			expires: expiresAt,
			path: "/"
		}
	};
}

/**
 * Parse a session token from a cookie value
 * Used by backend services to validate tokens sent from frontend
 */
export function parseSessionToken(cookieValue: string): { token: string; userEmail: string } | null {
	if (!cookieValue || !cookieValue.includes(':')) {
		return null;
	}
	
	const [token, userEmail] = cookieValue.split(':', 2);
	if (!token || !userEmail) {
		return null;
	}
	
	return { token, userEmail };
}

// logic to salt, hash, and encrypt a password using WebCrypto API so we can store it in our database
export const hashPassword = async (password: string, providedSalt?: Uint8Array, pepper?: string): Promise<string> => {
    const encoder = new TextEncoder();

    // generate a random salt
    const salt = providedSalt || crypto.getRandomValues(new Uint8Array(16));

    // key material 
    const keyMaterial = await crypto.subtle.importKey(
        'raw', 
        encoder.encode(pepper ? `${password}:${pepper}` : password),
        { name: 'PBKDF2' }, 
        false, 
        ['deriveBits', 'deriveKey']
    );

    // generate key
    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt.buffer as ArrayBuffer,
            iterations: 100000,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );

    const exportedKey = await crypto.subtle.exportKey("raw", key);

    const hashArray = Array.from(new Uint8Array(exportedKey));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const saltArray = Array.from(salt);
    const saltHex = saltArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return `${saltHex}:${hashHex}`;
}

// compare the password provided by the user with the hashed password stored in the database
export const comparePassword = async (password: string, hashedPassword: string, pepper?: string): Promise<boolean> => {
    const [salt, hash] = hashedPassword.split(':');
    const saltMatches = salt.match(/.{1,2}/g);
    if (!saltMatches) return false;
    const saltBuffer = new Uint8Array(saltMatches.map(byte => parseInt(byte, 16)));
    //const hashBuffer = new Uint8Array(hash.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

    // hash the password to compare
    const _hash = await hashPassword(password, saltBuffer, pepper);
    const [, _hashHex] = _hash.split(':');

    return _hashHex === hash;
}

// logic to salt, hash, and encrypt a password using WebCrypto API so we can store it in our database
export const hashToken = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);

    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
}

// SessionValidationResult is now defined in AuthService.ts

// ==============================
// Opaque session cookie envelope
// ==============================

// Base64url helpers (Node + Workers compatible)
const _toBytes = (input: string | ArrayBuffer | Uint8Array) =>
    typeof input === 'string' ? new TextEncoder().encode(input) : (input instanceof Uint8Array ? input : new Uint8Array(input));

const _bytesToBase64 = (bytes: Uint8Array) => {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    // @ts-ignore
    return btoa(binary);
};

const _base64ToBytes = (b64: string) => {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
    // @ts-ignore
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
};

const toBase64Url = (buf: ArrayBuffer | Uint8Array | string) =>
    _bytesToBase64(_toBytes(buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const fromBase64Url = (b64url: string): Uint8Array => {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '=');
    return _base64ToBytes(b64);
};

// Derive an AES-GCM key directly from a secret string (32 bytes via SHA-256)
const importAesGcmKey = async (secret: string): Promise<CryptoKey> => {
    const enc = new TextEncoder();
    const raw = await crypto.subtle.digest('SHA-256', enc.encode(secret));
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
};

// Build an opaque cookie string from orgId and tokenHash
export const buildSessionCookie = async (
    secret: string,
    orgId: string | 'admin',
    tokenHash: string
): Promise<string> => {
    const key = await importAesGcmKey(secret);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const payload = JSON.stringify({ o: orgId, th: tokenHash });
    const pt = new TextEncoder().encode(payload);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pt);
    // cookie = base64url(iv | ct)
    const combined = new Uint8Array(iv.byteLength + (ct as ArrayBuffer).byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ct), iv.byteLength);
    return toBase64Url(combined);
};

// Parse opaque cookie into { orgId, tokenHash }
export const parseSessionCookie = async (
    secret: string,
    cookie: string
): Promise<{ orgId: string | 'admin'; tokenHash: string } | null> => {
    try {
        if (!cookie) return null;
        const data = fromBase64Url(cookie);
        if (data.byteLength < 13) return null; // invalid
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