import SaigeBlakeHeader from '../headers/SaigeBlakeHeader.svelte';
import TwigAndPearlHeader from '../headers/TwigAndPearlHeader.svelte';
import PowersportsHeader from '../headers/PowersportsHeader.svelte';
import type { Component } from 'svelte';
import { PanelTop } from '@lucide/svelte';

export interface HeaderDefinition {
	name: string;
	type: string;
	icon: Component<any>;
	description: string;
	component: Component<any>;
}

export const headers: HeaderDefinition[] = [
	{
		name: 'Saige & Blake',
		type: 'saige-blake-header',
		icon: PanelTop,
		description: 'Two-column header with icons and navigation',
		component: SaigeBlakeHeader
	},
	{
		name: 'Twig & Pearl',
		type: 'twig-and-pearl-header',
		icon: PanelTop,
		description: 'Minimalist nav with centered menu',
		component: TwigAndPearlHeader
	},
	{
		name: 'Powersports',
		type: 'powersports-header',
		icon: PanelTop,
		description: 'Dark header with top bar, nav, and CTA - supports sticky mode',
		component: PowersportsHeader
	}
];

export const headerMap = new Map(headers.map((def) => [def.type, def]));

export const getHeader = (type: string) => headerMap.get(type);
