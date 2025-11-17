import type { BlockPresetDefinition, BlockSnapshot, SiteRegionState } from './types';

const clone = <T extends BlockSnapshot>(snapshot: T): T => JSON.parse(JSON.stringify(snapshot));

const saigeBlakeFooterDefaults: BlockSnapshot = {
	type: 'saige-blake-footer',
	backgroundColor: '#212121',
	textColor: '#ffffff',
	reverseOrder: false,
	subscribeText: 'Get all the latest news and info sent to your inbox.',
	copyrightText: {
		href: 'https://kayde.io',
		by: 'Kayde'
	},
	icons: [
		{ icon: 'facebook', slug: '#', name: 'Facebook', enabled: true },
		{ icon: 'x', slug: '#', name: 'X', enabled: true },
		{ icon: 'instagram', slug: '#', name: 'Instagram', enabled: true }
	],
	menu: [
		{ label: 'Privacy Policy', slug: '/product-a' },
		{ label: 'Terms & Conditions', slug: '/product-b' },
		{ label: 'Follow Us', slug: '/product-c' },
		{ label: 'Contact Us', slug: '/product-d' }
	]
};

const twigAndPearlFooterDefaults: BlockSnapshot = {
	type: 'twig-and-pearl-footer',
	backgroundColor: '#212121',
	textColor: '#ffffff',
	reverseOrder: false,
	icons: [
		{ icon: 'facebook', link: '#', name: 'Facebook', enabled: true },
		{ icon: 'x', link: '#', name: 'X', enabled: true },
		{ icon: 'instagram', link: '#', name: 'Instagram', enabled: true }
	],
	menu: [
		{
			label: 'Legal',
			items: [
				{ label: 'Privacy Policy', link: '/product-a' },
				{ label: 'Terms & Conditions', link: '/product-b' }
			]
		},
		{
			label: 'Resources',
			items: [
				{ label: 'CMS Login', link: '/product-a' },
				{ label: 'Clutch Blog', link: '/product-b' }
			]
		},
		{
			label: 'Follow Us',
			items: [
				{ label: 'Discord', link: '/product-a' },
				{ label: 'Facebook', link: '/product-b' }
			]
		}
	],
	copyrightText: {
		href: 'https://kayde.io',
		by: 'Kayde'
	}
};

export const footerPresets: BlockPresetDefinition[] = [
	{
		id: 'saige-blake-footer',
		name: 'Saige & Blake Footer',
		description: 'Two-row footer with subscription CTA',
		create: () => [clone(saigeBlakeFooterDefaults)]
	},
	{
		id: 'twig-and-pearl-footer',
		name: 'Twig & Pearl Footer',
		description: 'Column-based footer with stacked menus',
		create: () => [clone(twigAndPearlFooterDefaults)]
	}
];

const footerPresetMap = new Map(footerPresets.map((preset) => [preset.id, preset]));
const footerBlockTypes = new Set(footerPresets.flatMap((preset) => preset.create().map((block) => block.type)));

export const getFooterPreset = (id: string | null | undefined) =>
	(id ? footerPresetMap.get(id) : undefined) ?? footerPresets[0];

export const isFooterBlockType = (type: string | null | undefined) =>
	!!type && footerBlockTypes.has(type);

export const createFooterRegion = (presetId: string): SiteRegionState => {
	const preset = getFooterPreset(presetId);
	return {
		presetId: preset.id,
		blocks: preset.create()
	};
};
