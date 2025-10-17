import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals: { session } }) => {
  if (!session?.user) redirect(302, '/auth/signin');
};
