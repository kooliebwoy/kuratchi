import type { RequestEvent } from '@sveltejs/kit';

export type Platform = RequestEvent['platform'];

const platformStack: (Platform | null)[] = [];
let fallbackPlatform: Platform | null = null;

export function pushPlatform(platform: Platform): void {
    platformStack.push(platform ?? null);
}

export function popPlatform(): void {
    platformStack.pop();
}

export function getCurrentPlatform(): Platform {
    if (platformStack.length > 0) {
        const current = platformStack[platformStack.length - 1];
        if (current) return current;
    }
    return fallbackPlatform ?? undefined;
}

export function setFallbackPlatform(platform: Platform): void {
    fallbackPlatform = platform ?? null;
}

export async function runWithPlatform<T>(platform: Platform, callback: () => Promise<T> | T): Promise<T> {
    pushPlatform(platform);
    try {
        return await callback();
    } finally {
        popPlatform();
    }
}

export async function ensurePlatformEnv(event: RequestEvent, options?: { dev?: boolean }): Promise<void> {
    const platform = (event as any).platform;
    if (platform) {
        setFallbackPlatform(platform as Platform);
    }

    const hasEnv = !!(platform && typeof platform === 'object' && 'env' in platform && (platform as any).env);

    if (!options?.dev || hasEnv) {
        return;
    }

    try {
        const loadWrangler = new Function('return import("wrangler")') as () => Promise<any>;
        const wrangler = await loadWrangler().catch(() => null);
        const proxy = await wrangler?.getPlatformProxy?.();
        if (proxy?.env) {
            const target = platform && typeof platform === 'object' ? platform : {};
            (target as any).env = proxy.env;
            (event as any).platform = target;
            setFallbackPlatform(target as Platform);
        }
    } catch (err) {
        console.warn('[Kuratchi][dev] Failed to load wrangler platform proxy:', err);
    }
}
