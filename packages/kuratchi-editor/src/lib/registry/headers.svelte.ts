import type { BlockSnapshot, SiteRegionState } from '../presets/types';

const saigeBlakeDefaults: BlockSnapshot = {
	type: 'saige-blake-header',
	backgroundColor: '#ffffff',
	textColor: '#92c8c8',
	reverseOrder: false,
	icons: [
		{ icon: 'facebook', link: '#', name: 'Facebook', enabled: true },
		{ icon: 'x', link: '#', name: 'X', enabled: true },
		{ icon: 'instagram', link: '#', name: 'Instagram', enabled: true }
	],
	menu: [],
	logo: {
		url: '/clutch-cms-logo.png',
		alt: 'Logo'
	}
};

const twigAndPearlDefaults: BlockSnapshot = {
	type: 'twig-and-pearl-header',
	backgroundColor: '#212121',
	homeIconColor: '#575757',
	textColor: '#ffffff',
	reverseOrder: false,
	searchEnabled: true,
	icons: [
		{ icon: 'facebook', link: '#', name: 'Facebook', enabled: true },
		{ icon: 'x', link: '#', name: 'X', enabled: true },
		{ icon: 'instagram', link: '#', name: 'Instagram', enabled: true }
	],
	menu: [],
	useMobileMenuOnDesktop: false
};

const cloneSnapshot = <T extends BlockSnapshot>(snapshot: T): T =>
	JSON.parse(JSON.stringify(snapshot));

export interface HeaderOption {
	id: string;
	name: string;
	description: string;
	blockType: string;
	create: () => BlockSnapshot;
}

export const headerOptions: HeaderOption[] = [
	{
		id: 'saige-blake-header',
		name: 'Saige & Blake',
		description: 'Two-column header with icons and navigation',
		blockType: saigeBlakeDefaults.type,
		create: () => cloneSnapshot(saigeBlakeDefaults)
	},
	{
		id: 'twig-and-pearl-header',
		name: 'Twig & Pearl',
		description: 'Minimalist nav with centered menu',
		blockType: twigAndPearlDefaults.type,
		create: () => cloneSnapshot(twigAndPearlDefaults)
	}
];

const headerOptionMap = new Map(headerOptions.map((option) => [option.id, option]));
const defaultHeaderId = headerOptions[0]?.id ?? 'saige-blake-header';

export const isHeaderBlockType = (type: string | null | undefined) =>
	!!type && headerOptions.some((option) => option.blockType === type);

export const createHeaderRegion = (presetId: string): SiteRegionState => {
	const option = headerOptionMap.get(presetId) ?? headerOptions[0];
	return {
		presetId: option.id,
		blocks: [option.create()]
	};
};
