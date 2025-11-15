import type { BlockPresetDefinition, BlockSnapshot } from './types';

const clone = <T extends BlockSnapshot>(snapshot: T): T => JSON.parse(JSON.stringify(snapshot));

const heroFigureBlock: BlockSnapshot = {
	type: 'hero-figure',
	heading: 'Hero Heading',
	body: 'Provident cupiditate voluptatem et in. Quaerat fugiat ut assumenda excepturi exercitationem quasi.',
	button: { link: '#', label: 'Read more' },
	image: {
		url: 'https://fakeimg.pl/489x600/?text=World&font=lobster',
		alt: 'Clutch CMS'
	},
	metadata: {
		reverseOrder: false,
		buttonColor: 'bg-base-200',
		headingColor: 'text-content',
		textColor: 'text-content',
		backgroundColor: '#ffffff'
	}
};

const heroOverlayBlock: BlockSnapshot = {
	type: 'hero-overlay',
	heading: 'Hello There',
	body: 'Provident cupiditate voluptatem et in. Quaerat fugiat ut assumenda excepturi exercitationem quasi.',
	button: { link: '#', label: 'Read more' },
	image: {
		src: 'https://fakeimg.pl/489x600/?text=World&font=lobster',
		alt: 'Clutch CMS',
		title: 'Clutch CMS'
	},
	backgroundColor: '#ffffff',
	textColor: '#ffffff',
	buttonColor: 'bg-base-200',
	headingColor: 'text-content',
	showBackgroundImage: true,
	backgroundImage: 'https://img.daisyui.com/images/stock/photo-1507358522600-9f71e620c44e.webp'
};

const aboutUsHeroBlock: BlockSnapshot = {
	type: 'about-us-hero',
	heading: 'About Us',
	body: 'Random words from the editor Click to edit me',
	button: { label: 'Read more', link: '#' },
	metadata: {
		backgroundColor: '#54545499',
		headingColor: '#212121',
		buttonColor: '#212121',
		textColor: '#ffffff'
	}
};

const aboutUsCardBlock: BlockSnapshot = {
	type: 'about-us-card',
	heading: 'About Us',
	body: `Lorem Ipsum is simply dummy text of the printing and typesetting industry.`,
	image: {
		url: 'https://fakeimg.pl/650x500/?text=World&font=lobster',
		alt: 'Hero Image',
		title: 'Hero Image'
	},
	metadata: {
		backgroundColor: '#575757',
		textColor: '#ffffff',
		reverseOrder: false
	}
};

const cardWithSliderBlock: BlockSnapshot = {
	type: 'card-with-slider',
	heading: 'Noteworthy technology acquisitions 2021',
	body: 'Here are the biggest enterprise technology acquisitions of 2021 so far, in reverse chronological order.',
	button: { label: 'Read more', link: '#' },
	images: [],
	metadata: {
		backgroundColor: '#575757',
		cardBackgroundColor: '#212121',
		reverseOrder: false,
		buttonColor: '#212121',
		headingColor: 'text-content',
		contentColor: 'text-content'
	}
};

const iconBarBlock: BlockSnapshot = {
	type: 'icon-bar',
	icons: [
		{ icon: 'truck', link: '#', name: 'Free Shipping & Returns', enabled: true },
		{ icon: 'badgeDollarSign', link: '#', name: '100% Money Back Guarantee', enabled: true },
		{ icon: 'home', link: '#', name: 'High Quality Material', enabled: true },
		{ icon: 'circleDollarSign', link: '#', name: 'Safe and Secure Checkout', enabled: true }
	],
	metadata: {
		backgroundColor: '#575757',
		iconColors: '#212121',
		roundedBorder: 'rounded-3xl'
	}
};

const gridCtasBlock: BlockSnapshot = {
	type: 'grid-ctas',
	heading: 'Our Services',
	button: { link: '#', label: 'Read more' },
	cards: [
		{
			title: 'Consulting',
			buttonLabel: 'Explore',
			buttonLink: '#',
			image: { url: 'https://fakeimg.pl/400x300/?text=Consulting', alt: 'Consulting' }
		},
		{
			title: 'Design',
			buttonLabel: 'Learn more',
			buttonLink: '#',
			image: { url: 'https://fakeimg.pl/400x300/?text=Design', alt: 'Design' }
		},
		{
			title: 'Delivery',
			buttonLabel: 'See details',
			buttonLink: '#',
			image: { url: 'https://fakeimg.pl/400x300/?text=Delivery', alt: 'Delivery' }
		}
	],
	metadata: {
		buttonColor: 'bg-base-200',
		headingColor: 'text-content',
		textColor: 'text-content',
		backgroundColor: '#ffffff'
	}
};

const servicesGridBlock: BlockSnapshot = {
	type: 'services-grid',
	metadata: {
		title: 'Our Services',
		subtitle: 'We provide comprehensive professional services.',
		services: [
			{
				title: 'Service One',
				description: 'Professional service description here.',
				icon: 'star'
			},
			{
				title: 'Service Two',
				description: 'Professional service description here.',
				icon: 'star'
			},
			{
				title: 'Service Three',
				description: 'Professional service description here.',
				icon: 'star'
			}
		],
		styling: {
			backgroundColor: '#ffffff',
			textColor: '#1f2937',
			columns: 3,
			spacing: 'large'
		}
	}
};

export const layoutPresets: BlockPresetDefinition[] = [
	{
		id: 'hero-figure',
		name: 'Hero with Figure',
		description: 'Two-column hero section with large imagery',
		create: () => [clone(heroFigureBlock)]
	},
	{
		id: 'hero-overlay',
		name: 'Hero Overlay',
		description: 'Full-bleed hero with overlay image',
		create: () => [clone(heroOverlayBlock)]
	},
	{
		id: 'about-us-hero',
		name: 'About Hero',
		description: 'Centered hero for about pages',
		create: () => [clone(aboutUsHeroBlock)]
	},
	{
		id: 'about-us-card',
		name: 'About Card',
		description: 'Two-column story with image',
		create: () => [clone(aboutUsCardBlock)]
	},
	{
		id: 'card-with-slider',
		name: 'Card + Slider',
		description: 'Content card alongside an image slider',
		create: () => [clone(cardWithSliderBlock)]
	},
	{
		id: 'icon-bar',
		name: 'Icon Bar',
		description: 'Icon-driven highlight strip',
		create: () => [clone(iconBarBlock)]
	},
	{
		id: 'grid-ctas',
		name: 'Grid CTAs',
		description: 'Image grid with call-to-action buttons',
		create: () => [clone(gridCtasBlock)]
	},
	{
		id: 'services-grid',
		name: 'Services Grid',
		description: 'Multi-column service highlights',
		create: () => [clone(servicesGridBlock)]
	}
];

export const layoutPresetMap = new Map(layoutPresets.map((preset) => [preset.id, preset]));

export const getLayoutPreset = (id: string | null | undefined) =>
	(id ? layoutPresetMap.get(id) : undefined) ?? layoutPresets[0];

export const createLayoutBlocks = (presetId: string): BlockSnapshot[] => {
	const preset = getLayoutPreset(presetId);
	return preset.create();
};
