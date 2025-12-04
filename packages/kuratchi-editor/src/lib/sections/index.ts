/**
 * Section Components and Utilities
 */

// Section layout types and utilities
export {
    type SectionLayout,
    type SectionWidth,
    type SectionSpacing,
    type SectionHeightMode,
    DEFAULT_SECTION_LAYOUT,
    WIDTH_OPTIONS,
    WIDTH_VALUES,
    SPACING_OPTIONS,
    SPACING_VALUES,
    HEIGHT_OPTIONS,
    HEIGHT_VALUES,
    getSectionLayoutStyles,
    mergeLayoutWithDefaults
} from './section-layout.js';

// Section layout controls component
export { default as SectionLayoutControls } from './SectionLayoutControls.svelte';

// Section components
export { default as AboutUs } from './AboutUs.svelte';
export { default as CatalogGrid } from './CatalogGrid.svelte';
export { default as CatalogView } from './CatalogView.svelte';
export { default as FeaturedVehicles } from './FeaturedVehicles.svelte';
export { default as AboutUsCard } from './AboutUsCard.svelte';
export { default as BlogHero } from './BlogHero.svelte';
export { default as BlogPostList } from './BlogPostList.svelte';
export { default as CardWithSlider } from './CardWithSlider.svelte';
export { default as Carousel } from './Carousel.svelte';
export { default as ContactCTA } from './ContactCTA.svelte';
export { default as FAQ } from './FAQ.svelte';
export { default as FeatureShowcase } from './FeatureShowcase.svelte';
export { default as GridCTAs } from './GridCTAs.svelte';
export { default as HeroFigure } from './HeroFigure.svelte';
export { default as HeroOverlay } from './HeroOverlay.svelte';
export { default as HoverCard } from './HoverCard.svelte';
export { default as IconBar } from './IconBar.svelte';
export { default as ImageDifference } from './ImageDifference.svelte';
export { default as Modal } from './Modal.svelte';
export { default as PricingPlans } from './PricingPlans.svelte';
export { default as SectionPreview } from './SectionPreview.svelte';
export { default as ServicesGrid } from './ServicesGrid.svelte';
export { default as Stats } from './Stats.svelte';
export { default as TestimonialsGrid } from './TestimonialsGrid.svelte';
