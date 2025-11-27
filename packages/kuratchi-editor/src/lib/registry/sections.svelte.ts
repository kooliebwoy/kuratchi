import HeroFigure from '../sections/HeroFigure.svelte';
import HeroOverlay from '../sections/HeroOverlay.svelte';
import AboutUs from '../sections/AboutUs.svelte';
import AboutUsCard from '../sections/AboutUsCard.svelte';
import CardWithSlider from '../sections/CardWithSlider.svelte';
import IconBar from '../sections/IconBar.svelte';
import GridCTAs from '../sections/GridCTAs.svelte';
import ServicesGrid from '../sections/ServicesGrid.svelte';
import FAQ from '../sections/FAQ.svelte';
import Stats from '../sections/Stats.svelte';
import FeatureShowcase from '../sections/FeatureShowcase.svelte';
import TestimonialsGrid from '../sections/TestimonialsGrid.svelte';
import PricingPlans from '../sections/PricingPlans.svelte';
import ContactCTA from '../sections/ContactCTA.svelte';
// Blocks promoted to sections
import Carousel from '../sections/Carousel.svelte';
import HoverCard from '../sections/HoverCard.svelte';
import Modal from '../sections/Modal.svelte';
import ImageDifference from '../sections/ImageDifference.svelte';
import type { Component } from 'svelte';
import { BarChart3, HelpCircle, Images, LayoutGrid, Sparkles, Square, Sliders } from '@lucide/svelte';

export interface SectionDefinition {
	name: string;
	type: string;
	icon: Component<any>;
	description: string;
	component: Component<any>;
}

export const sections: SectionDefinition[] = [
	{
		name: 'Hero Figure',
		type: 'hero-figure',
		icon: LayoutGrid,
		description: 'Hero section with image and text side by side',
		component: HeroFigure
	},
	{
		name: 'Hero Overlay',
		type: 'hero-overlay',
		icon: LayoutGrid,
		description: 'Hero section with text overlaid on background image',
		component: HeroOverlay
	},
	{
		name: 'About Us',
		type: 'about-us-hero',
		icon: LayoutGrid,
		description: 'About us hero section',
		component: AboutUs
	},
	{
		name: 'About Us Card',
		type: 'about-us-card',
		icon: LayoutGrid,
		description: 'About us card layout',
		component: AboutUsCard
	},
	{
		name: 'Card with Slider',
		type: 'card-with-slider',
		icon: LayoutGrid,
		description: 'Card layout with image slider',
		component: CardWithSlider
	},
	{
		name: 'Icon Bar',
		type: 'icon-bar',
		icon: LayoutGrid,
		description: 'Horizontal bar with icons and text',
		component: IconBar
	},
	{
		name: 'Grid CTAs',
		type: 'grid-ctas',
		icon: LayoutGrid,
		description: 'Grid of call-to-action cards',
		component: GridCTAs
	},
        {
                name: 'Services Grid',
                type: 'services-grid',
                icon: LayoutGrid,
                description: 'Grid layout for services',
                component: ServicesGrid
        },
        {
                name: 'Stats',
                type: 'stats',
                icon: BarChart3,
                description: 'Summarize key metrics with short descriptions',
                component: Stats
        },
        {
                name: 'Feature Showcase',
                type: 'feature-showcase',
                icon: LayoutGrid,
                description: 'Four-up feature layout with badges',
                component: FeatureShowcase
        },
        {
                name: 'FAQs',
                type: 'faq',
                icon: HelpCircle,
                description: 'Accordion for common questions and answers',
                component: FAQ
        },
        {
                name: 'Testimonials',
                type: 'testimonials-grid',
                icon: LayoutGrid,
                description: 'Grid of testimonial cards',
                component: TestimonialsGrid
        },
        {
                name: 'Pricing Plans',
                type: 'pricing-plans',
                icon: LayoutGrid,
                description: 'Three-tier pricing comparison',
                component: PricingPlans
        },
        {
                name: 'Contact CTA',
                type: 'contact-cta',
                icon: LayoutGrid,
                description: 'Contact and lead capture section',
                component: ContactCTA
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
        },
        {
                name: 'Image Difference',
                type: 'image-difference',
                icon: Sliders,
                description: 'Compare two images with a slider',
                component: ImageDifference
        }
];

export const sectionMap = new Map(sections.map((def) => [def.type, def]));

export const getSection = (type: string) => sectionMap.get(type);

// Legacy export for backwards compatibility with themes
export const sectionDefaults = sections.reduce((acc, section) => {
	acc[section.type] = { type: section.type };
	return acc;
}, {} as Record<string, { type: string }>);
