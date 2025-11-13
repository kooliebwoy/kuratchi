import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  const isAuthenticated = !!locals.session?.user;

  const isSuperadmin = locals.kuratchi?.superadmin?.isSuperadmin?.() || false;
  // const isEmailVerified = locals.session?.user?.isEmailVerified;

  const user = {
    name: locals.session?.user?.name,
    email: locals.session?.user?.email,
    organizationId: locals.session?.organizationId
  }

  return {
    isAuthenticated,
    isSuperadmin,
    user
  }
};
