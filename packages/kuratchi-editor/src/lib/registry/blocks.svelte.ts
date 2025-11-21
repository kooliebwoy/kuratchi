import Heading from '../blocks/Heading.svelte';
import Paragraph from '../blocks/Paragraph.svelte';
import Checklist from '../blocks/Checklist.svelte';
import Divider from '../blocks/Divider.svelte';
import Button from '../blocks/Button.svelte';
import ImageBlock from '../blocks/Image.svelte';
import ListsBlock from '../blocks/Lists.svelte';
import GridBlock from '../blocks/Grid.svelte';
import TwoColumnBlock from '../blocks/TwoColumn.svelte';
import ImageDifference from '../blocks/ImageDifference.svelte';
import Carousel from '../blocks/Carousel.svelte';
import HoverCard from '../blocks/HoverCard.svelte';
import HeroFigure from '../layouts/HeroFigure.svelte';
import HeroOverlay from '../layouts/HeroOverlay.svelte';
import AboutUs from '../layouts/AboutUs.svelte';
import AboutUsCard from '../layouts/AboutUsCard.svelte';
import CardWithSlider from '../layouts/CardWithSlider.svelte';
import IconBar from '../layouts/IconBar.svelte';
import GridCTAs from '../layouts/GridCTAs.svelte';
import ServicesGrid from '../layouts/ServicesGrid.svelte';
import BlogHero from '../layouts/BlogHero.svelte';
import BlogPostList from '../layouts/BlogPostList.svelte';
import SaigeBlakeHeader from '../headers/SaigeBlakeHeader.svelte';
import TwigAndPearlHeader from '../headers/TwigAndPearlHeader.svelte';
import SaigeBlakeFooter from '../footers/SaigeBlakeFooter.svelte';
import TwigAndPearlFooter from '../footers/TwigAndPearlFooter.svelte';
import type { Component } from 'svelte';
import { AlignLeft, CheckSquare, Columns2, Grid2x2, Heading1, Image as ImageIcon, Images, LayoutGrid, ListChecks, Minus, MousePointerClick, PanelBottom, PanelTop, PanelsTopLeft, Sparkles } from '@lucide/svelte';

export interface BlockDefinition {
	name: string;
	type: string;
	icon: Component<any>;
	description: string;
	component: Component<any>;
	showInPalette?: boolean;
}

export const blocks: BlockDefinition[] = [
	{
		name: 'Heading',
		type: 'heading',
		icon: Heading1,
		description: 'Add a heading block',
		component: Heading,
		showInPalette: true
	},
	{
		name: 'Paragraph',
		type: 'paragraph',
		icon: AlignLeft,
		description: 'Add a paragraph block',
		component: Paragraph,
		showInPalette: true
	},
	{
		name: 'Checklist',
		type: 'checklist',
		icon: CheckSquare,
		description: 'Add a checklist block',
		component: Checklist,
		showInPalette: true
	},
	{
		name: 'Divider',
		type: 'divider',
		icon: Minus,
		description: 'Add a section divider',
		component: Divider,
		showInPalette: true
	},
	{
		name: 'Button',
		type: 'button',
		icon: MousePointerClick,
		description: 'Add a customizable call-to-action button',
		component: Button,
		showInPalette: true
	},
	{
		name: 'Image',
		type: 'image',
		icon: ImageIcon,
		description: 'Insert a single image',
		component: ImageBlock,
		showInPalette: true
	},
	{
		name: 'List',
		type: 'list',
		icon: ListChecks,
		description: 'Add an ordered or unordered list',
		component: ListsBlock,
		showInPalette: true
	},
	{
		name: 'Grid',
		type: 'grid',
		icon: Grid2x2,
		description: 'Flexible multi-column grid layout',
		component: GridBlock,
		showInPalette: true
	},
	{
		name: 'Two Column',
		type: 'two-column',
		icon: Columns2,
		description: 'Split content into two columns',
		component: TwoColumnBlock,
		showInPalette: true
	},
	{
		name: 'Image Difference',
		type: 'image-difference',
		icon: PanelsTopLeft,
		description: 'Compare two images with a slider',
		component: ImageDifference,
		showInPalette: true
	},
	{
		name: 'Carousel',
		type: 'carousel',
		icon: Images,
		description: 'Full-width carousel with navigation controls',
		component: Carousel,
		showInPalette: true
	},
	{
		name: '3D Hover Card',
		type: 'hover-card',
		icon: Sparkles,
		description: '3D hover image card with CTA',
		component: HoverCard,
		showInPalette: true
	},
	// Layout blocks (hidden from default picker, composed via presets)
	{
		name: 'Hero Figure',
		type: 'hero-figure',
		icon: LayoutGrid,
		description: 'Hero with two-column image',
		component: HeroFigure,
		showInPalette: false
	},
	{
		name: 'Hero Overlay',
		type: 'hero-overlay',
		icon: PanelsTopLeft,
		description: 'Hero with overlay background',
		component: HeroOverlay,
		showInPalette: false
	},
	{
		name: 'About Us Hero',
		type: 'about-us-hero',
		icon: LayoutGrid,
		description: 'Centered hero section',
		component: AboutUs,
		showInPalette: false
	},
	{
		name: 'About Us Card',
		type: 'about-us-card',
		icon: LayoutGrid,
		description: 'Two-column about section',
		component: AboutUsCard,
		showInPalette: false
	},
	{
		name: 'Card With Slider',
		type: 'card-with-slider',
		icon: LayoutGrid,
		description: 'Content card paired with image slider',
		component: CardWithSlider,
		showInPalette: false
	},
	{
		name: 'Icon Bar',
		type: 'icon-bar',
		icon: LayoutGrid,
		description: 'Icon highlights strip',
		component: IconBar,
		showInPalette: false
	},
	{
		name: 'Grid CTAs',
		type: 'grid-ctas',
		icon: LayoutGrid,
		description: 'Image cards grid',
		component: GridCTAs,
		showInPalette: false
	},
	{
		name: 'Services Grid',
		type: 'services-grid',
		icon: LayoutGrid,
		description: 'Feature/service grid',
		component: ServicesGrid,
		showInPalette: false
	},
	{
		name: 'Blog Hero',
		type: 'blog-hero',
		icon: LayoutGrid,
		description: 'Hero section for blog index pages',
		component: BlogHero,
		showInPalette: false
	},
	{
		name: 'Blog Post List',
		type: 'blog-post-list',
		icon: LayoutGrid,
		description: 'Listing of recent blog posts',
		component: BlogPostList,
		showInPalette: false
	},
	// Site chrome blocks (headers/footers)
	{
		name: 'Saige & Blake Header',
		type: 'saige-blake-header',
		icon: PanelTop,
		description: 'Two-column nav with social icons',
		component: SaigeBlakeHeader,
		showInPalette: false
	},
	{
		name: 'Twig & Pearl Header',
		type: 'twig-and-pearl-header',
		icon: PanelTop,
		description: 'Minimal navigation header',
		component: TwigAndPearlHeader,
		showInPalette: false
	},
	{
		name: 'Saige & Blake Footer',
		type: 'saige-blake-footer',
		icon: PanelBottom,
		description: 'Footer with CTA and menu',
		component: SaigeBlakeFooter,
		showInPalette: false
	},
	{
		name: 'Twig & Pearl Footer',
		type: 'twig-and-pearl-footer',
		icon: PanelBottom,
		description: 'Multi-column footer',
		component: TwigAndPearlFooter,
		showInPalette: false
	}
];

export const blockMap = new Map(blocks.map((definition) => [definition.type, definition]));

export const getBlock = (type: string) => blockMap.get(type);
