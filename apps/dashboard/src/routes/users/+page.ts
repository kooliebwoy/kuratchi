import { userInsights } from '$lib/data/dashboard';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
  return {
    users: userInsights
  };
};
