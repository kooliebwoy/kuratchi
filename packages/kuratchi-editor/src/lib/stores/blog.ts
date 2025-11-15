import { writable } from 'svelte/store';
import type { BlogData } from '../types';
import { createDefaultBlogData } from '../types';

export const blogStore = writable<BlogData>(createDefaultBlogData());
