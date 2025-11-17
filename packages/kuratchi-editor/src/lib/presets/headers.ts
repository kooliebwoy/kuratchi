import type { BlockPresetDefinition, BlockSnapshot, SiteRegionState } from './types';

const clone = <T extends BlockSnapshot>(snapshot: T): T => JSON.parse(JSON.stringify(snapshot));

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

export const headerPresets: BlockPresetDefinition[] = [
	{
		id: 'saige-blake-header',
		name: 'Saige & Blake',
		description: 'Two-column header with icons and navigation',
		create: () => [clone(saigeBlakeDefaults)]
	},
	{
		id: 'twig-and-pearl-header',
		name: 'Twig & Pearl',
		description: 'Minimalist nav with centered menu',
		create: () => [clone(twigAndPearlDefaults)]
	}
];

const headerPresetMap = new Map(headerPresets.map((preset) => [preset.id, preset]));
const headerBlockTypes = new Set(headerPresets.flatMap((preset) => preset.create().map((block) => block.type)));

export const getHeaderPreset = (id: string | null | undefined) =>
	(id ? headerPresetMap.get(id) : undefined) ?? headerPresets[0];

export const isHeaderBlockType = (type: string | null | undefined) =>
	!!type && headerBlockTypes.has(type);

export const createHeaderRegion = (presetId: string): SiteRegionState => {
	const preset = getHeaderPreset(presetId);
	return {
		presetId: preset.id,
		blocks: preset.create()
	};
};
