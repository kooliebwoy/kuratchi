import { writable } from 'svelte/store';

export interface ImageConfig {
    uploadEndpoint?: string;
}

export const imageConfig = writable<ImageConfig>({});
