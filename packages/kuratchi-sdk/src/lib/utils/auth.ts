 

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

export const toBase64Url = (buf: ArrayBuffer | Uint8Array | string) =>
    _bytesToBase64(_toBytes(buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

export const fromBase64Url = (b64url: string): Uint8Array => {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '=');
    return _base64ToBytes(b64);
};

// Convenience: decode base64url string into UTF-8 text
export function b64urlDecodeToString(str: string): string {
    const decoded = fromBase64Url(str);
    return new TextDecoder().decode(decoded);
}

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

// ==============================
// Additional helpers for OAuth state
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
        // Copy into a fresh ArrayBuffer to avoid SharedArrayBuffer typing
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