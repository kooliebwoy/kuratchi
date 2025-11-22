import type { BlockSnapshot, SiteRegionState } from '../presets/types';

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

const cloneSnapshot = <T extends BlockSnapshot>(snapshot: T): T =>
	JSON.parse(JSON.stringify(snapshot));

export interface FooterOption {
	id: string;
	name: string;
	description: string;
	blockType: string;
	create: () => BlockSnapshot;
}

export const footerOptions: FooterOption[] = [
	{
		id: 'saige-blake-footer',
		name: 'Saige & Blake Footer',
		description: 'Two-row footer with subscription CTA',
		blockType: saigeBlakeFooterDefaults.type,
		create: () => cloneSnapshot(saigeBlakeFooterDefaults)
	},
	{
		id: 'twig-and-pearl-footer',
		name: 'Twig & Pearl Footer',
		description: 'Column-based footer with stacked menus',
		blockType: twigAndPearlFooterDefaults.type,
		create: () => cloneSnapshot(twigAndPearlFooterDefaults)
	}
];

const footerOptionMap = new Map(footerOptions.map((option) => [option.id, option]));

export const isFooterBlockType = (type: string | null | undefined) =>
	!!type && footerOptions.some((option) => option.blockType === type);

export const createFooterRegion = (presetId: string): SiteRegionState => {
	const option = footerOptionMap.get(presetId) ?? footerOptions[0];
	return {
		presetId: option.id,
		blocks: [option.create()]
	};
};
