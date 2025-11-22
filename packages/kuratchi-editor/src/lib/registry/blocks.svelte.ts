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
import Modal from '../blocks/Modal.svelte';
import type { Component } from 'svelte';
import { AlignLeft, CheckSquare, Columns2, Grid2x2, Heading1, Image as ImageIcon, Images, ListChecks, Minus, MousePointerClick, Sparkles, Square, PanelsTopLeft } from '@lucide/svelte';

export interface BlockDefinition {
	name: string;
	type: string;
	icon: Component<any>;
	description: string;
	component: Component<any>;
}

export const blocks: BlockDefinition[] = [
	{
		name: 'Heading',
		type: 'heading',
		icon: Heading1,
		description: 'Add a heading block',
		component: Heading
	},
	{
		name: 'Paragraph',
		type: 'paragraph',
		icon: AlignLeft,
		description: 'Add a paragraph block',
		component: Paragraph
	},
	{
		name: 'Checklist',
		type: 'checklist',
		icon: CheckSquare,
		description: 'Add a checklist block',
		component: Checklist
	},
	{
		name: 'Divider',
		type: 'divider',
		icon: Minus,
		description: 'Add a section divider',
		component: Divider
	},
	{
		name: 'Button',
		type: 'button',
		icon: MousePointerClick,
		description: 'Add a customizable call-to-action button',
		component: Button
	},
	{
		name: 'Image',
		type: 'image',
		icon: ImageIcon,
		description: 'Insert a single image',
		component: ImageBlock
	},
	{
		name: 'List',
		type: 'list',
		icon: ListChecks,
		description: 'Add an ordered or unordered list',
		component: ListsBlock
	},
	{
		name: 'Grid',
		type: 'grid',
		icon: Grid2x2,
		description: 'Flexible multi-column grid layout',
		component: GridBlock
	},
	{
		name: 'Two Column',
		type: 'two-column',
		icon: Columns2,
		description: 'Split content into two columns',
		component: TwoColumnBlock
	},
	{
		name: 'Image Difference',
		type: 'image-difference',
		icon: PanelsTopLeft,
		description: 'Compare two images with a slider',
		component: ImageDifference
	},
	{
		name: 'Carousel',
		type: 'carousel',
		icon: Images,
		description: 'Full-width carousel with navigation controls',
		component: Carousel
	},
	{
		name: '3D Hover Card',
		type: 'hover-card',
		icon: Sparkles,
		description: '3D hover image card with CTA',
		component: HoverCard
	},
	{
		name: 'Modal',
		type: 'modal',
		icon: Square,
		description: 'Popup modal with forms, images, or custom content',
		component: Modal
	}
];

export const blockMap = new Map(blocks.map((definition) => [definition.type, definition]));

export const getBlock = (type: string) => blockMap.get(type);
