import SaigeBlakeFooter from "../footers/SaigeBlakeFooter.svelte";
import SaigeBlakeFooterImage from "../footers/images/SaigeBlakeFooter.png";
import TwigAndPearlFooter from "../footers/TwigAndPearlFooter.svelte";
import TwigAndPearlFooterImage from "../footers/images/TwigAndPearlFooter.png";

interface FooterBlocks {
    type: string;
    image: string;
    component: any;
}

export const footerBlocks: FooterBlocks[] = [
    {
        type: 'saige-blake-footer',
        image: SaigeBlakeFooterImage,
        component: SaigeBlakeFooter
    },
    {
        type: 'twig-and-pearl-footer',
        image: TwigAndPearlFooterImage,
        component: TwigAndPearlFooter
    },
];

export const footerBlocksMap = new Map(footerBlocks.map(l => [l.type, l]));

export const getFooterBlock = (type: string) => {
    return footerBlocksMap.get(type);
}