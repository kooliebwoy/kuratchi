import SaigeBlakeHeader from "../headers/SaigeBlakeHeader.svelte";
import SaigeBlakeHeaderImage from "../headers/images/SaigeBlakeHeader.png";
import TwigAndPearlHeader from "../headers/TwigAndPearlHeader.svelte";
import TwigAndPearlHeaderImage from "../headers/images/TwigAndPearlHeader.png";

interface HeaderBlocks {
    type: string;
    image: string;
    component: any;
}

export const headerBlocks: HeaderBlocks[] = [
    {
        type: 'saige-blake-header',
        image: SaigeBlakeHeaderImage,
        component: SaigeBlakeHeader
    },
    {
        type: 'twig-and-pearl-header',
        image: TwigAndPearlHeaderImage,
        component: TwigAndPearlHeader
    },
];

export const headerBlocksMap = new Map(headerBlocks.map(l => [l.type, l]));

export const getHeaderBlock = (type: string) => {
    return headerBlocksMap.get(type);
}