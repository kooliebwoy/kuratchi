// Use globalThis.__kuratchi_context__ instead of importing getRequest directly
// to avoid module duplication issues where the request context is set in a
// different instance of the context module than the one we import.
function getRequestFromGlobal(): Request | null {
  const ctx = (globalThis as any).__kuratchi_context__;
  return ctx?.request ?? null;
}

export interface DesktopNotificationPayload {
  title: string;
  body?: string;
}

export interface DesktopCommandRequest {
  command: string;
  workingDirectory?: string;
  timeoutMs?: number;
}

export interface DesktopCommandResult {
  ok: boolean;
  error?: string | null;
  exitCode: number;
  durationMs: number;
  stdout: string;
  stderr: string;
}

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [rawKey, ...rest] = part.split('=');
    if ((rawKey ?? '').trim() !== name) continue;
    return rest.join('=').trim() || null;
  }
  return null;
}

function getDesktopApiOrigin(): string | null {
  const request = getRequestFromGlobal();
  if (!request) return null;

  const headerOrigin = request.headers.get('x-kuratchi-desktop-api-origin')
    || request.headers.get('x-kuratchi-desktop-origin');
  if (headerOrigin) return headerOrigin;

  const cookieOrigin = parseCookie(request.headers.get('cookie'), '__kuratchi_desktop_api');
  if (!cookieOrigin) return null;

  try {
    return decodeURIComponent(cookieOrigin);
  } catch {
    return cookieOrigin;
  }
}

export async function showDesktopNotification(payload: DesktopNotificationPayload): Promise<boolean> {
  const title = payload.title?.trim();
  if (!title) {
    throw new Error('showDesktopNotification requires a title.');
  }

  const desktopApiOrigin = getDesktopApiOrigin();
  if (!desktopApiOrigin) {
    return false;
  }

  const response = await fetch(new URL('/notifications/show', desktopApiOrigin), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      title,
      body: payload.body ?? '',
    }),
  });

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    console.warn(`[kuratchi] Desktop notification request failed with status ${response.status}.`);
    return false;
  }

  const payloadResult = await response.json().catch(() => null) as { ok?: boolean } | null;
  return payloadResult?.ok === true;
}

export async function runDesktopCommand(
  request: DesktopCommandRequest,
): Promise<DesktopCommandResult | null> {
  const command = request.command?.trim();
  if (!command) {
    throw new Error('runDesktopCommand requires a command.');
  }

  const desktopApiOrigin = getDesktopApiOrigin();
  if (!desktopApiOrigin) {
    return null;
  }

  const response = await fetch(new URL('/commands/run', desktopApiOrigin), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      command,
      workingDirectory: request.workingDirectory ?? null,
      timeoutMs: request.timeoutMs ?? 30000,
    }),
  });

  if (!response.ok) {
    throw new Error(`[kuratchi] Desktop command request failed with status ${response.status}.`);
  }

  return await response.json() as DesktopCommandResult;
}
