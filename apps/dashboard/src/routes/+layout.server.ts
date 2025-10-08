import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { session } }) => {
  const isAuthenticated = !!session?.user;

  const user = {
    name: session?.user?.name,
    email: session?.user?.email
  }

  return {
    isAuthenticated,
    user
  }
};
