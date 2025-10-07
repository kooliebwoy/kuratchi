import { authTimeline, authMetrics } from '$lib/data/dashboard';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
  return {
    timeline: authTimeline,
    metrics: authMetrics
  };
};
