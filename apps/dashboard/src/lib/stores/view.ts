import { writable } from 'svelte/store';

export type DashboardView =
  | 'overview'
  | 'database'
  | 'auth'
  | 'users'
  | 'storage'
  | 'logs'
  | 'settings';

export const activeView = writable<DashboardView>('overview');
