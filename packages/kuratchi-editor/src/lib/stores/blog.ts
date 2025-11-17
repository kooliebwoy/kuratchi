import { writable } from 'svelte/store';
import type { BlogData } from '../types';

// Initialize with empty data - will be populated when editor loads
export const blogStore = writable<BlogData>({
  categories: [],
  tags: [],
  posts: [],
  settings: {}
});
