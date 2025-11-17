import type { ComponentType } from 'svelte';

/**
 * Serializable snapshot for a block instance. Matches the payload saved in metadata divs.
 */
export interface BlockSnapshot extends Record<string, unknown> {
	type: string;
}

export interface BlockPresetDefinition {
	id: string;
	name: string;
	description?: string;
	icon?: ComponentType;
	tags?: string[];
	create: () => BlockSnapshot[];
}

export interface SiteRegionState {
	presetId: string | null;
	blocks: BlockSnapshot[];
}
