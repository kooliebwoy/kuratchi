import { environmentKeys, projectRegions } from '$lib/data/dashboard';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
  return {
    keys: environmentKeys,
    regions: projectRegions
  };
};
