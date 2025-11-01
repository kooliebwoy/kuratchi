import { writable } from 'svelte/store';

export const headingStore = writable<string>('');
export const sideBarStore = writable<boolean>(true);
