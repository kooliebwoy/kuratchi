import HeroFigure from "../layouts/HeroFigure.svelte";
import HeroFigureImage from "../layouts/images/HeroFigure.png";
import HeroOverlay from "../layouts/HeroOverlay.svelte";
import HeroOverlayImage from "../layouts/images/HeroOverlay.png";
import AboutUs from "../layouts/AboutUs.svelte";
import AboutUsHeroImage from "../layouts/images/AboutUsHero.png";
import CardWithSlider from "../layouts/CardWithSlider.svelte";
import CardWithSliderImage from "../layouts/images/CardWithSlider.png";
import IconBar from "../layouts/IconBar.svelte";
import IconBarImage from "../layouts/images/IconBar.png";
import AboutUsCard from "../layouts/AboutUsCard.svelte";
import AboutUsCardImage from "../layouts/images/AboutUsCard.png";
import GridCTAs from "../layouts/GridCTAs.svelte";
import GridCTAsImage from "../layouts/images/GridCTAs.png";
import ServicesGrid from "../layouts/ServicesGrid.svelte";
import { LayoutGrid, PanelsTopLeft, Images, Grid3x3 } from "@lucide/svelte";
type IconComponent = any;

interface Layout {
    name: string;
    type: string;
    icon: IconComponent;
    description: string;
    image: string;
    component: any;
}

export const layouts : Layout[] = [
    {
        name: 'Hero With Figure',
        type: 'hero-figure',
        icon: LayoutGrid,
        description: 'Add a hero section with a figure',
        image: HeroFigureImage,
        component: HeroFigure
    },
    {
        name: 'Hero With Overlay',
        type: 'hero-overlay',
        icon: PanelsTopLeft,
        description: 'Add a hero section with an overlay',
        image: HeroOverlayImage,
        component: HeroOverlay
    },
    {
        name: 'About Us Hero',
        type: 'about-us-hero',
        icon: LayoutGrid,
        description: 'Add an about us hero section',
        image: AboutUsHeroImage,
        component: AboutUs
    },
    {
        name: 'Card With Slider',
        type: 'card-with-slider',
        icon: Images,
        description: 'Add a card with a slider',
        image: CardWithSliderImage,
        component: CardWithSlider
    },
    {
        name: 'Icon Bar',
        type: 'icon-bar',
        icon: PanelsTopLeft,
        description: 'Add an icon bar',
        image: IconBarImage,
        component: IconBar
    },
    {
        name: 'About Us Card',
        type: 'about-us-card',
        icon: LayoutGrid,
        description: 'Add an about us card',
        image: AboutUsCardImage,
        component: AboutUsCard
    },
    {
        name: 'Grid CTAs',
        type: 'grid-ctas',
        icon: LayoutGrid,
        description: 'Add grid CTAs',
        image: GridCTAsImage,
        component: GridCTAs
    },
    {
        name: 'Services Grid',
        type: 'services-grid',
        icon: Grid3x3,
        description: 'Add a services grid section with customizable layout',
        image: '', // TODO: Add image
        component: ServicesGrid
    }
];

export const layoutMap = new Map(layouts.map(l => [l.type, l]));

export function getLayout(type: string) {
    return layoutMap.get(type);
}