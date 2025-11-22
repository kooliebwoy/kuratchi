import SaigeBlakeFooter from '../footers/SaigeBlakeFooter.svelte';
import TwigAndPearlFooter from '../footers/TwigAndPearlFooter.svelte';
import type { Component } from 'svelte';
import { PanelBottom } from '@lucide/svelte';

export interface FooterDefinition {
	name: string;
	type: string;
	icon: Component<any>;
	description: string;
	component: Component<any>;
}

export const footers: FooterDefinition[] = [
	{
		name: 'Saige & Blake Footer',
		type: 'saige-blake-footer',
		icon: PanelBottom,
		description: 'Two-row footer with subscription CTA',
		component: SaigeBlakeFooter
	},
	{
		name: 'Twig & Pearl Footer',
		type: 'twig-and-pearl-footer',
		icon: PanelBottom,
		description: 'Column-based footer with stacked menus',
		component: TwigAndPearlFooter
	}
];

export const footerMap = new Map(footers.map((def) => [def.type, def]));

export const getFooter = (type: string) => footerMap.get(type);
