import { json } from '@sveltejs/kit';

export const POST = async ({ locals, request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const orgId = (body?.orgId ?? null) as string | null;

    const helper = locals.kuratchi?.superadmin;
    if (!helper?.setOrganization) {
      return new Response('Superadmin not available', { status: 500 });
    }

    helper.setOrganization(orgId);
    return json({ success: true, activeOrgId: helper.getActiveOrgId?.() ?? null });
  } catch (e: any) {
    console.error('[super/switch-org] Failed:', e);
    return new Response('Failed to switch organization', { status: 500 });
  }
};
