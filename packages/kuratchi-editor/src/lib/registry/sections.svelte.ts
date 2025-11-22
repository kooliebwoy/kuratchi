import type { BlockPresetDefinition, BlockSnapshot } from '../presets/types';

/**
 * Section Registry
 * 
 * Default configurations for section-level components (hero, about, services, etc.)
 * Sections are composed of multiple blocks and represent complete page regions.
 * Themes directly compose sections to create complete sites.
 */

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
		buttonColor: '#0f172a',
		headingColor: '#0f172a',
		textColor: '#475569',
		backgroundColor: '#f8fafc'
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
	metadata: {
		reverseOrder: false,
		backgroundColor: '#05060a',
		headingColor: '#f8fafc',
		textColor: '#e2e8f0',
		buttonColor: '#f97316',
		showBackgroundImage: true,
		backgroundImage: 'https://fakeimg.pl/1600x900/?text=Hero+Overlay'
	}
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
		buttonColor: '#0f172a',
		headingColor: '#0f172a',
		textColor: '#475569',
		backgroundColor: '#f8fafc'
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

/**
 * Section defaults - used by themes to compose pages
 */
export const sectionDefaults: Record<string, BlockSnapshot> = {
	'hero-figure': heroFigureBlock,
	'hero-overlay': heroOverlayBlock,
	'about-us-hero': aboutUsHeroBlock,
	'about-us-card': aboutUsCardBlock,
	'card-with-slider': cardWithSliderBlock,
	'icon-bar': iconBarBlock,
	'grid-ctas': gridCtasBlock,
	'services-grid': servicesGridBlock
};

export const getSectionDefault = (sectionId: string): BlockSnapshot | undefined => {
	return sectionDefaults[sectionId];
};

export const createSectionBlocks = (...sectionIds: string[]): BlockSnapshot[] => {
	return sectionIds
		.map(id => getSectionDefault(id))
		.filter((section): section is BlockSnapshot => section !== undefined);
};
