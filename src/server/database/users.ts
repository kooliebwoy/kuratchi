import { env } from 'cloudflare:workers';
import { kuratchiORM } from '@kuratchi/orm';
import { getLocals } from '@kuratchi/js';
import { getCurrentUser } from './auth';

const db = kuratchiORM(() => (env as any).DB);

async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    getLocals().__redirectTo = '/auth/signin';
    throw new Error('Unauthorized');
  }
  if (!user.organizationId) {
    throw new Error('User is not associated with an organization');
  }
  return user;
}

export async function getUsers() {
  const user = await requireAuth();

  // Get all emails in this organization
  const orgUsersResult = await db.organizationUsers
    .where({ organizationId: user.organizationId })
    .many();
  const orgUsers = (orgUsersResult.data ?? []) as any[];
  const orgEmails = new Set(orgUsers.map((ou: any) => ou.email));

  // Get all non-deleted users and filter to org members
  const result = await db.users
    .where({ deleted_at: null })
    .many();
  const allUsers = (result.data ?? []) as any[];

  return allUsers.filter((u: any) => orgEmails.has(u.email));
}

async function requireOrgMember(userId: string, organizationId: string): Promise<void> {
  const userResult = await db.users.where({ id: userId }).first();
  const targetUser = userResult.data as any;
  if (!targetUser) throw new Error('User not found');

  const orgUserResult = await db.organizationUsers
    .where({ email: targetUser.email, organizationId })
    .first();
  if (!orgUserResult.data) throw new Error('User not found in your organization');
}

export async function inviteUser(formData: FormData): Promise<void> {
  const user = await requireAuth();

  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const name = (formData.get('name') as string)?.trim();
  const role = (formData.get('role') as string)?.trim() || 'member';

  if (!email || !name) {
    throw new Error('Email and name are required');
  }

  const existing = await db.users.where({ email }).first();
  if (existing.data && (existing.data as any).id) {
    throw new Error('A user with this email already exists');
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const inviteToken = crypto.randomUUID();
  const inviteExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;

  const insertResult = await db.users.insert({
    id,
    email,
    name,
    role,
    status: null,
    password_hash: null,
    invite_token: inviteToken,
    invite_expires_at: inviteExpiry,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });

  if (!insertResult.success) {
    throw new Error('Failed to invite user');
  }

  // Link invited user to the same organization
  await db.organizationUsers.insert({
    id: crypto.randomUUID(),
    email,
    organizationId: user.organizationId,
    created_at: now,
    updated_at: now,
  });

  getLocals().__redirectTo = '/account/users';
}

export async function suspendUser(formData: FormData): Promise<void> {
  const user = await requireAuth();

  const id = formData.get('id') as string;
  if (!id) throw new Error('User ID is required');

  await requireOrgMember(id, user.organizationId);

  await db.users
    .where({ id })
    .update({ status: false, updated_at: new Date().toISOString() });
}

export async function activateUser(formData: FormData): Promise<void> {
  const user = await requireAuth();

  const id = formData.get('id') as string;
  if (!id) throw new Error('User ID is required');

  await requireOrgMember(id, user.organizationId);

  await db.users
    .where({ id })
    .update({ status: true, updated_at: new Date().toISOString() });
}

export async function deleteUser(formData: FormData): Promise<void> {
  const user = await requireAuth();

  const id = formData.get('id') as string;
  if (!id) throw new Error('User ID is required');

  await requireOrgMember(id, user.organizationId);

  const now = new Date().toISOString();
  await db.users
    .where({ id })
    .update({ deleted_at: now });

  getLocals().__redirectTo = '/account/users';
}
