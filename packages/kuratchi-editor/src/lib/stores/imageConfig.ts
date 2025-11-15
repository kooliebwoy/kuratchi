import { writable } from 'svelte/store';

export interface ImageConfig {
    uploadEndpoint?: string;
    uploadHandler?: (file: File, folder?: string) => Promise<{
        url: string;
        key?: string;
        filename?: string;
        size?: number;
        contentType?: string;
    }>;
    deleteHandler?: (imageId: string) => Promise<void>;
}

export const imageConfig = writable<ImageConfig>({});
