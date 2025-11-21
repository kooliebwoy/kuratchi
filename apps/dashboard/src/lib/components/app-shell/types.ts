import type { ComponentType } from 'svelte';

export interface AppNavItem {
  label: string;
  href: string;
  icon: ComponentType;
  requireSuperadmin?: boolean;
}

export interface AppUser {
  name: string;
  email: string;
  avatarUrl?: string;
}
