import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const turnstile = (locals.kuratchi as any)?.security?.turnstile || null;
  return { turnstile };
};
