import { env } from 'cloudflare:workers';
import { kuratchiORM } from '@kuratchi/orm';
import {
  hashPassword,
  comparePassword,
  generateSessionToken,
  hashToken,
  buildSessionCookie,
  parseSessionCookie,
} from '@kuratchi/auth';
import { getAuth } from '@kuratchi/auth';
import { redirect } from '@kuratchi/js';
import { logActivity } from './audit';
import { sendVerificationEmail, sendWelcomeEmail } from './emails';

const db = kuratchiORM(() => (env as any).DB);

// -- Get Current User ------------------------------------------------

export function getTurnstileSiteKey(): string {
  return ((env as any).TURNSTILE_SITE_KEY as string | undefined) || '';
}

export async function getCurrentUser() {
  const auth = getAuth();
  const sessionCookie = auth.getSessionCookie();

  if (!sessionCookie) return null;

  const secret = (env as any).AUTH_SECRET || '';
  const parsed = await parseSessionCookie(secret, sessionCookie);
  if (!parsed) return null;

  const sessionResult = await db.session
    .where({ sessionToken: parsed.tokenHash })
    .first();
  const session = (sessionResult.data ?? null) as any;

  if (!session) return null;

  if (session.expires < Date.now()) {
    await db.session.delete({ sessionToken: parsed.tokenHash });
    return null;
  }

  const userResult = await db.users.where({ id: session.userId }).first();
  const user = (userResult.data ?? null) as any;

  if (!user) return null;

  // Look up user's organization
  const orgUserResult = await db.organizationUsers.where({ email: user.email }).first();
  const orgUser = orgUserResult.data as any;

  const { password_hash, ...safeUser } = user;
  return { ...safeUser, organizationId: orgUser?.organizationId || null };
}

// -- Sign Up --------------------------------------------------------

export async function signUp(formData: FormData): Promise<void> {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const name = (formData.get('name') as string)?.trim() || null;

  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const existing = await db.users.where({ email }).first();
  if (existing.data && (existing.data as any).id) {
    throw new Error('An account with this email already exists');
  }

  const secret = (env as any).AUTH_SECRET || '';
  const hashedPassword = await hashPassword(password, undefined, secret);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const insertResult = await db.users.insert({
    id,
    email,
    name,
    password_hash: hashedPassword,
    status: true,
    role: 'admin',
    created_at: now,
    updated_at: now,
  });

  if (!insertResult.success) {
    throw new Error('Failed to create account');
  }

  // Create a personal organization for the new user
  const orgId = crypto.randomUUID();
  const orgSlug = email.split('@')[0].replace(/[^a-z0-9-]/gi, '-').toLowerCase();

  await db.organizations.insert({
    id: orgId,
    organizationName: name || email.split('@')[0],
    email,
    organizationSlug: orgSlug,
    status: 'active',
    created_at: now,
    updated_at: now,
  });

  // Link the user to the organization
  await db.organizationUsers.insert({
    id: crypto.randomUUID(),
    email,
    organizationId: orgId,
    organizationSlug: orgSlug,
    created_at: now,
    updated_at: now,
  });

  // Create email verification token and send verification email
  const verifyToken = crypto.randomUUID();
  const verifyTokenHash = await hashToken(verifyToken);
  const verifyExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  await db.emailVerificationToken.insert({
    id: crypto.randomUUID(),
    token: verifyTokenHash,
    email,
    userId: id,
    expires: verifyExpiry,
    created_at: now,
    updated_at: now,
  });

  await sendVerificationEmail(email, verifyToken);

  logActivity({ action: 'user.signup', userId: id, organizationId: orgId, data: { email } });

  redirect('/auth/verify-email?email=' + encodeURIComponent(email));
}

// -- Sign In --------------------------------------------------------

export async function signIn(formData: FormData): Promise<void> {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;

  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  const result = await db.users.where({ email }).first();
  const user = (result.data ?? null) as any;

  if (!user || !user.password_hash) {
    throw new Error('Invalid email or password');
  }

  if (!user.emailVerified) {
    throw new Error('Please verify your email before signing in. Check your inbox for the verification link.');
  }

  const secret = (env as any).AUTH_SECRET || '';
  const isValid = await comparePassword(password, user.password_hash, secret);

  if (!isValid) {
    throw new Error('Invalid email or password');
  }

  const sessionToken = generateSessionToken();
  const sessionTokenHash = await hashToken(sessionToken);

  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await db.session.insert({
    sessionToken: sessionTokenHash,
    userId: user.id,
    expires: expires.getTime(),
  });

  const sessionCookie = await buildSessionCookie(secret, 'default', sessionTokenHash);

  const auth = getAuth();
  const setCookieHeader = auth.buildSetCookie('kuratchi-db-session', sessionCookie, {
    expires,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  });

  const locals = auth.getLocals();
  if (!locals.__setCookieHeaders) locals.__setCookieHeaders = [];
  locals.__setCookieHeaders.push(setCookieHeader);

  redirect('/');

  logActivity({ action: 'user.signin', userId: user.id, data: { email } });
}

// -- Sign Out -------------------------------------------------------

export async function signOut(formData: FormData): Promise<void> {
  const auth = getAuth();
  const sessionCookie = auth.getSessionCookie();

  if (sessionCookie) {
    const secret = (env as any).AUTH_SECRET || '';
    const parsed = await parseSessionCookie(secret, sessionCookie);
    if (parsed) {
      await db.session.delete({ sessionToken: parsed.tokenHash });
    }
  }

  const clearHeader = auth.buildClearCookie('kuratchi-db-session');
  const locals = auth.getLocals();
  if (!locals.__setCookieHeaders) locals.__setCookieHeaders = [];
  locals.__setCookieHeaders.push(clearHeader);

  redirect('/auth/signin');
}

// -- Verify Email ---------------------------------------------------

export async function verifyEmail(token: string): Promise<{ success: boolean; error?: string }> {
  if (!token) return { success: false, error: 'Missing verification token.' };

  const tokenHash = await hashToken(token);

  const result = await db.emailVerificationToken
    .where({ token: tokenHash })
    .first();
  const record = result.data as any;

  if (!record) return { success: false, error: 'Invalid verification link. Please request a new one.' };

  if (record.expires < Date.now()) {
    await db.emailVerificationToken.delete({ id: record.id });
    return { success: false, error: 'This verification link has expired. Please request a new one.' };
  }

  const now = new Date().toISOString();

  await db.users
    .where({ id: record.userId })
    .update({ emailVerified: Date.now(), updated_at: now });

  // Clean up all verification tokens for this user
  await db.emailVerificationToken.delete({ userId: record.userId });

  await sendWelcomeEmail(record.email);

  logActivity({ action: 'user.email_verified', userId: record.userId, data: { email: record.email } });

  return { success: true };
}

// -- Resend Verification Email --------------------------------------

export async function resendVerification(formData: FormData): Promise<void> {
  const email = (formData.get('email') as string)?.trim().toLowerCase();

  if (!email) throw new Error('Email is required');

  const userResult = await db.users.where({ email }).first();
  const user = userResult.data as any;

  if (!user) throw new Error('No account found with this email.');

  if (user.emailVerified) throw new Error('This email is already verified.');

  // Delete any existing tokens for this user
  await db.emailVerificationToken.delete({ userId: user.id });

  const verifyToken = crypto.randomUUID();
  const verifyTokenHash = await hashToken(verifyToken);
  const now = new Date().toISOString();

  await db.emailVerificationToken.insert({
    id: crypto.randomUUID(),
    token: verifyTokenHash,
    email,
    userId: user.id,
    expires: Date.now() + 24 * 60 * 60 * 1000,
    created_at: now,
    updated_at: now,
  });

  await sendVerificationEmail(email, verifyToken);
}

// -- Accept Invite --------------------------------------------------

export async function acceptInvite(formData: FormData): Promise<void> {
  const token = formData.get('token') as string;
  const password = formData.get('password') as string;
  const name = (formData.get('name') as string)?.trim();

  if (!token || !password) throw new Error('Token and password are required');
  if (password.length < 8) throw new Error('Password must be at least 8 characters');

  const userResult = await db.users.where({ invite_token: token }).first();
  const user = userResult.data as any;

  if (!user) throw new Error('Invalid invite link.');
  if (user.invite_expires_at && user.invite_expires_at < Date.now()) {
    throw new Error('This invite has expired. Please ask your admin to resend it.');
  }

  const secret = (env as any).AUTH_SECRET || '';
  const hashedPassword = await hashPassword(password, undefined, secret);
  const now = new Date().toISOString();

  await db.users
    .where({ id: user.id })
    .update({
      password_hash: hashedPassword,
      name: name || user.name,
      status: true,
      emailVerified: Date.now(),
      invite_token: null,
      invite_expires_at: null,
      updated_at: now,
    });

  logActivity({ action: 'user.invite_accepted', userId: user.id, data: { email: user.email } });

  redirect('/auth/signin');
}
