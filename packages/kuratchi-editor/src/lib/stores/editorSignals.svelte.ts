/**
 * WeakMap-backed registry for live block data.
 * Components register a stable ref with a getter; callers can read the latest
 * values without querying the DOM or parsing JSON.
 */
export interface BlockData extends Record<string, unknown> {
    id: string;
    type: string;
    region?: 'header' | 'footer' | 'content' | string;
}

type BlockGetter = () => BlockData;

class SignalRegistry {
    private registry = new WeakMap<object, { getter: BlockGetter; region?: string; element?: Element | null | undefined }>();
    private refs = new Set<object>();
    // WeakMap doesn't support iteration; use Map for reverse lookup
    private elementLookup = new Map<Element, object>();

    register(ref: object, getter: BlockGetter, region?: string, element?: Element | null | undefined) {
        if (element instanceof Element) {
            const existingRef = this.elementLookup.get(element);
            if (existingRef) {
                this.unregister(existingRef);
            }
        }
        this.registry.set(ref, { getter, region, element: element ?? undefined });
        this.refs.add(ref);
        if (element instanceof Element) {
            this.elementLookup.set(element, ref);
        }
    }

    unregister(ref: object) {
        this.refs.delete(ref);
        // Clean any element backrefs
        for (const [el, storedRef] of this.elementLookup) {
            if (storedRef === ref) {
                this.elementLookup.delete(el);
            }
        }
    }

    unregisterByElement(element: Element | null | undefined) {
        if (!element) return;
        const ref = this.elementLookup.get(element);
        if (!ref) return;
        this.unregister(ref);
        this.elementLookup.delete(element);
    }

    clearRegion(region: string) {
        const toDelete: object[] = [];
        for (const ref of this.refs) {
            const entry = this.registry.get(ref);
            if (entry?.region === region) {
                toDelete.push(ref);
            }
        }
        toDelete.forEach((ref) => this.unregister(ref));
    }

    pruneRegion(region: string, root?: Element | null) {
        const toDelete: object[] = [];
        for (const ref of this.refs) {
            const entry = this.registry.get(ref);
            if (!entry || entry.region !== region) continue;
            if (root && entry.element instanceof Element && !root.contains(entry.element)) {
                toDelete.push(ref);
                continue;
            }
            if (entry.element instanceof Element && !this.elementLookup.has(entry.element)) {
                toDelete.push(ref);
            }
        }
        toDelete.forEach((ref) => this.unregister(ref));
    }

    all(region?: string): BlockData[] {
        return Array.from(this.refs)
            .map((ref) => this.registry.get(ref))
            .filter((entry): entry is { getter: BlockGetter; region?: string } => Boolean(entry))
            .filter((entry) => !region || entry.region === region)
            .map((entry) => entry.getter());
    }
}

export const blockRegistry = new SignalRegistry();
