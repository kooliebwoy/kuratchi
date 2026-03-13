const textEncoder = new TextEncoder();

export type AgentConnectionPayload = {
  organizationId: string;
  sessionId: string;
  agent: string;
  name: string;
  exp: number;
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importSecret(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signAgentConnectionToken(
  payload: AgentConnectionPayload,
  secret: string,
): Promise<string> {
  const key = await importSecret(secret);
  const encodedPayload = toBase64Url(textEncoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(encodedPayload));
  return `${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyAgentConnectionToken(
  token: string,
  secret: string,
): Promise<AgentConnectionPayload | null> {
  const [encodedPayload, encodedSignature] = token.split('.');
  if (!encodedPayload || !encodedSignature) return null;

  const key = await importSecret(secret);
  const verified = await crypto.subtle.verify(
    'HMAC',
    key,
    fromBase64Url(encodedSignature),
    textEncoder.encode(encodedPayload),
  );
  if (!verified) return null;

  const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encodedPayload))) as AgentConnectionPayload;
  if (!payload?.organizationId || !payload?.sessionId || !payload?.agent || !payload?.name) return null;
  if (typeof payload.exp !== 'number' || payload.exp <= Date.now()) return null;
  return payload;
}
