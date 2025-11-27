import Heading from '../blocks/Heading.svelte';
import Paragraph from '../blocks/Paragraph.svelte';
import Checklist from '../blocks/Checklist.svelte';
import Divider from '../blocks/Divider.svelte';
import Button from '../blocks/Button.svelte';
import ImageBlock from '../blocks/Image.svelte';
import ListsBlock from '../blocks/Lists.svelte';
import GridBlock from '../blocks/Grid.svelte';
import TwoColumnBlock from '../blocks/TwoColumn.svelte';
import type { Component } from 'svelte';
import { AlignLeft, CheckSquare, Columns2, Grid2x2, Heading1, Image as ImageIcon, ListChecks, Minus, MousePointerClick } from '@lucide/svelte';

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
	}
];

export const blockMap = new Map(blocks.map((definition) => [definition.type, definition]));

export const getBlock = (type: string) => blockMap.get(type);
