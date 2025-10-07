import { json } from '@sveltejs/kit';

export const GET = async ({ locals }) => {
  try {
    const adminApi = locals.kuratchi?.auth?.admin;
    if (!adminApi) return new Response('Admin API not available', { status: 500 });
    const organizations = await adminApi.listOrganizations();
    return json({ organizations });
  } catch (e: any) {
    console.error('[super/orgs] Failed to list organizations:', e);
    return new Response('Failed to list organizations', { status: 500 });
  }
};
