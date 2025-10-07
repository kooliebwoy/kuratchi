import {
  overviewCards,
  trafficGraph,
  recentActivity,
  databaseTables,
  authProviders,
  userInsights
} from '$lib/data/dashboard';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
  return {
    cards: overviewCards,
    traffic: trafficGraph,
    activity: recentActivity,
    tables: databaseTables,
    providers: authProviders,
    users: userInsights
  };
};
