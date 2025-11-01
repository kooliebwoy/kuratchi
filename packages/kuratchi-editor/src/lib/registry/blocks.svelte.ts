import Paragraph from "../blocks/Paragraph.svelte";
import Heading from "../blocks/Heading.svelte";
import Image from "../blocks/Image.svelte";
import Checklist from "../blocks/Checklist.svelte";
import Lists from "../blocks/Lists.svelte";
import Divider from "../blocks/Divider.svelte";
import ImageDifference from "../blocks/ImageDifference.svelte";
import AiWriter from "../blocks/AiWriter.svelte";
import { Heading1, AlignLeft, CheckSquare, Minus } from "@lucide/svelte";

type IconComponent = any;

interface Block {
    name: string;
    type: string;
    icon: IconComponent;
    description: string;
    component: any;
}

// Create a list of components that can be added to the editor
export const blocks: Block[] = [
    // {
    //     name: 'AI Writer',
    //     type: 'ai-writer',
    //     icon: 'tabler:file-ai',
    //     description: 'Add an editor ai',
    //     component: AiWriter
    // },
    {
        name: 'Heading',
        type: 'heading',
        icon: Heading1,
        description: 'Add a heading 1',
        component: Heading
    },
    {
        name: 'Paragraph',
        type: 'paragraph',
        icon: AlignLeft,
        description: 'Add a paragraph',
        component: Paragraph
    },
    // {
    //     name: 'Image',
    //     type: 'image',
    //     icon: 'mdi-light:image',
    //     description: 'Add an image',
    //     component: Image
    // },
    {
        name: 'Checklist',
        type: 'checklist',
        icon: CheckSquare,
        description: 'Add a chceklist',
        component: Checklist
    },
    // {
    //     name: 'Bullet List',
    //     type: 'list',
    //     icon: 'icon-park-outline:list',
    //     description: 'Add a list',
    //     component: Lists
    // },
    {
        name: 'Divider',
        type: 'divider',
        icon: Minus,
        description: 'Add a section divider',
        component: Divider
    },
    // {
    //     name: 'Image Difference',
    //     type: 'image-difference',
    //     icon: 'tabler:layers-difference',
    //     description: 'Compare two images',
    //     component: ImageDifference
    // }
];

export const blockMap = new Map(blocks.map(c => [c.type, c]));

export const getBlock = (type: string) => {
    return blockMap.get(type);
}