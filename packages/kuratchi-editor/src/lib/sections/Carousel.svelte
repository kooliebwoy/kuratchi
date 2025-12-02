<script lang="ts">
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
	import { onMount } from 'svelte';
	import { BlockActions } from "../utils/index.js";
    import SectionLayoutControls from './SectionLayoutControls.svelte';
    import { 
        type SectionLayout, 
        DEFAULT_SECTION_LAYOUT, 
        getSectionLayoutStyles,
        mergeLayoutWithDefaults 
    } from './section-layout.js';

	type Slide = {
		id?: string;
		title?: string;
		description?: string;
		imageUrl?: string;
		ctaLabel?: string;
		ctaLink?: string;
	};

	interface Props {
		id?: string;
		type?: string;
		slides?: Slide[];
		metadata?: {
			showIndicators?: boolean;
			layout?: Partial<SectionLayout>;
		};
		editable?: boolean;
	}

	const defaultSlides: Slide[] = [
		{
			id: crypto.randomUUID(),
			title: "Luminous Interiors",
			description: "Create dramatic lighting scenes with warm accents and minimal effort.",
			imageUrl: "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1600&q=80",
			ctaLabel: "Book a consult",
			ctaLink: "#"
		},
		{
			id: crypto.randomUUID(),
			title: "Modern Tableware",
			description: "Handmade ceramics inspired by coastal palettes and organic silhouettes.",
			imageUrl: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1600&q=80",
			ctaLabel: "View collection",
			ctaLink: "#"
		},
		{
			id: crypto.randomUUID(),
			title: "Outdoor Escapes",
			description: "Furniture pieces designed for all-weather comfort and relaxation.",
			imageUrl: "https://images.unsplash.com/photo-1505693314120-0d443867891c?auto=format&fit=crop&w=1600&q=80",
			ctaLabel: "Explore lookbook",
			ctaLink: "#"
		}
	];

	let {
		id = crypto.randomUUID(),
		type = "carousel",
		slides = $bindable<Slide[]>([...defaultSlides]),
		metadata = $bindable({
			showIndicators: true,
			layout: { ...DEFAULT_SECTION_LAYOUT }
		}),
		editable = true
	}: Props = $props();

	const normalizeSlides = () => {
		slides = slides.map((slide) => ({
			id: slide.id ?? crypto.randomUUID(),
			title: slide.title ?? "Slide title",
			description: slide.description ?? "Slide description goes here.",
			imageUrl: slide.imageUrl ?? "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1600&q=80",
			ctaLabel: slide.ctaLabel ?? "Learn more",
			ctaLink: slide.ctaLink ?? "#"
		}));
	};

	normalizeSlides();

	let showIndicators = $state(metadata.showIndicators ?? true);

	// Section layout state
	let sectionLayout = $state<SectionLayout>(mergeLayoutWithDefaults(metadata.layout));
	
	// Sync layout changes back to metadata
	$effect(() => {
		metadata.layout = { ...sectionLayout };
	});

	const sectionLayoutStyles = $derived(getSectionLayoutStyles(sectionLayout));

	const slideId = (index: number) => `carousel-${id}-${index}`;
	const prevId = (index: number) => slideId((index - 1 + slides.length) % slides.length);
	const nextId = (index: number) => slideId((index + 1) % slides.length);

	const addSlide = () => {
		slides = [
			...slides,
			{
				id: crypto.randomUUID(),
				title: "New slide",
				description: "Describe this slide",
				imageUrl: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1600&q=80",
				ctaLabel: "Learn more",
				ctaLink: "#"
			}
		];
	};

	const removeSlide = (index: number) => {
		if (slides.length <= 1) return;
		slides = slides.filter((_, i) => i !== index);
	};

	let content = $derived({
		id,
		type,
		slides,
		metadata: {
			showIndicators,
			layout: metadata.layout
		}
	});

	let component: HTMLElement;
    const componentRef = {};
	let mounted = $state(false);

	onMount(() => {
		if (!editable) return;
		mounted = true;
		blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
		return () => blockRegistry.unregister(componentRef);
	});
</script>

{#if editable}
	<div class="editor-item group relative" bind:this={component}>
		{#if mounted}
			<BlockActions
				{id}
				{type}
				element={component}
				inspectorTitle="Carousel settings"
			>
				{#snippet inspector()}
					<div class="krt-carouselDrawer">
						<section class="krt-carouselDrawer__section">
							<h3>Section Layout</h3>
							<SectionLayoutControls bind:layout={sectionLayout} />
						</section>

						<section class="krt-carouselDrawer__section">
							<div class="krt-carouselDrawer__header">
								<div>
									<p class="krt-carouselDrawer__eyebrow">Slides</p>
									<h3>Manage slides</h3>
								</div>
								<button class="krt-carouselDrawer__action" type="button" onclick={addSlide}>
									Add slide
								</button>
							</div>

							<div class="krt-carouselDrawer__list">
								{#each slides as slide, index (slide.id)}
									<article class="krt-carouselDrawer__card">
										<header class="krt-carouselDrawer__cardHeader">
											<span>Slide {index + 1}</span>
											<div class="krt-carouselDrawer__cardControls">
												<button type="button" onclick={() => moveSlide(index, 'up')} disabled={index === 0}>↑</button>
												<button type="button" onclick={() => moveSlide(index, 'down')} disabled={index === slides.length - 1}>↓</button>
												<button type="button" class="krt-carouselDrawer__danger" onclick={() => removeSlide(index)}>✕</button>
											</div>
										</header>

										<div class="krt-carouselDrawer__grid">
											<label class="krt-carouselDrawer__field">
												<span>Title</span>
												<input type="text" bind:value={slides[index].title} placeholder="Slide title" />
											</label>
											<label class="krt-carouselDrawer__field">
												<span>Description</span>
												<textarea rows="2" bind:value={slides[index].description} placeholder="Short description"></textarea>
											</label>
											<label class="krt-carouselDrawer__field">
												<span>Image URL</span>
												<input type="url" bind:value={slides[index].imageUrl} placeholder="https://" />
											</label>
											<label class="krt-carouselDrawer__field">
												<span>CTA label</span>
												<input type="text" bind:value={slides[index].ctaLabel} placeholder="Learn more" />
											</label>
											<label class="krt-carouselDrawer__field">
												<span>CTA link</span>
												<input type="url" bind:value={slides[index].ctaLink} placeholder="https://" />
											</label>
										</div>
									</article>
								{/each}
							</div>
						</section>

						<section class="krt-carouselDrawer__section">
							<h3>Display</h3>
							<label class="krt-carouselDrawer__toggle">
								<input type="checkbox" bind:checked={showIndicators} />
								<span>Show slide indicators</span>
							</label>
						</section>
					</div>
				{/snippet}
			</BlockActions>
		{/if}
		<div class="space-y-2 krt-carousel" {id} data-type={type} style={sectionLayoutStyles}>
			<div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
			<div class="carousel w-full rounded-box overflow-hidden">
				{#each slides as slide, index (slide.id)}
					<div class="carousel-item relative w-full" id={slideId(index)}>
						<img src={slide.imageUrl} alt={slide.title} class="w-full object-cover max-h-[520px]" />
						<div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent flex items-end">
							<div class="p-8 text-white space-y-3 max-w-2xl">
								<h2 class="text-3xl font-bold" contenteditable bind:innerHTML={slide.title}></h2>
								<p class="opacity-90" contenteditable bind:innerHTML={slide.description}></p>
								{#if slide.ctaLabel}
									<a class="btn btn-primary btn-sm" href={slide.ctaLink || '#'}>{slide.ctaLabel}</a>
								{/if}
							</div>
						</div>
						<div class="absolute flex justify-between transform -translate-y-1/2 left-5 right-5 top-1/2">
							<a href={`#${prevId(index)}`} class="btn btn-circle btn-sm">❮</a>
							<a href={`#${nextId(index)}`} class="btn btn-circle btn-sm">❯</a>
						</div>
					</div>
				{/each}
			</div>
			{#if showIndicators}
				<div class="flex justify-center w-full py-2 gap-2">
					{#each slides as _, index}
						<a href={`#${slideId(index)}`} class="btn btn-xs">{index + 1}</a>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	
{:else}
	<section id={id} data-type={type} class="space-y-2 krt-carousel" style={sectionLayoutStyles}>
		<div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
		<div class="carousel w-full rounded-box overflow-hidden">
			{#each slides as slide, index (slide.id)}
				<div class="carousel-item relative w-full" id={slideId(index)}>
					<img src={slide.imageUrl} alt={slide.title} class="w-full object-cover" />
					<div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent flex items-end">
						<div class="p-8 text-white space-y-3 max-w-2xl">
							<h2 class="text-3xl font-bold">{slide.title}</h2>
							<p class="opacity-90">{slide.description}</p>
							{#if slide.ctaLabel}
								<a class="btn btn-primary btn-sm" href={slide.ctaLink || '#'}>{slide.ctaLabel}</a>
							{/if}
						</div>
					</div>
					<div class="absolute flex justify-between transform -translate-y-1/2 left-5 right-5 top-1/2">
						<a href={`#${prevId(index)}`} class="btn btn-circle btn-sm">❮</a>
						<a href={`#${nextId(index)}`} class="btn btn-circle btn-sm">❯</a>
					</div>
				</div>
			{/each}
		</div>
		{#if showIndicators}
			<div class="flex justify-center w-full py-2 gap-2">
				{#each slides as _, index}
					<a href={`#${slideId(index)}`} class="btn btn-xs">{index + 1}</a>
				{/each}
			</div>
		{/if}
	</section>
{/if}

<style>
	.krt-carousel {
		width: 100%;
		max-width: var(--section-max-width, 100%);
		margin-inline: auto;
		padding-inline: var(--section-padding-x, 0);
		padding-block: var(--section-padding-y, 0);
		border-radius: var(--section-border-radius, 0);
	}

	.krt-carouselDrawer {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.krt-carouselDrawer__section {
		border: 1px solid var(--krt-color-border-subtle, #e2e8f0);
		border-radius: 1rem;
		padding: 1.25rem;
		background: var(--krt-color-surface, #fff);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.krt-carouselDrawer__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.krt-carouselDrawer__eyebrow {
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.2em;
		margin: 0;
		color: var(--krt-color-muted, #475569);
	}

	.krt-carouselDrawer__header h3 {
		margin: 0.1rem 0 0;
		font-size: 1rem;
	}

	.krt-carouselDrawer__action {
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		border: 1px solid var(--krt-color-border-subtle, #e2e8f0);
		background: var(--krt-color-surface, #fff);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
	}

	.krt-carouselDrawer__action:hover {
		background: var(--krt-color-surface-hover, #f8fafc);
	}

	.krt-carouselDrawer__list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-height: 400px;
		overflow-y: auto;
	}

	.krt-carouselDrawer__card {
		border: 1px solid var(--krt-color-border-subtle, #e2e8f0);
		border-radius: 0.75rem;
		padding: 1rem;
		background: var(--krt-color-surface, #fff);
	}

	.krt-carouselDrawer__cardHeader {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
		font-weight: 600;
	}

	.krt-carouselDrawer__cardControls {
		display: flex;
		gap: 0.25rem;
	}

	.krt-carouselDrawer__cardControls button {
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--krt-color-border-subtle, #e2e8f0);
		background: var(--krt-color-surface, #fff);
		border-radius: 0.25rem;
		font-size: 0.75rem;
		cursor: pointer;
	}

	.krt-carouselDrawer__cardControls button:hover:not(:disabled) {
		background: var(--krt-color-surface-hover, #f8fafc);
	}

	.krt-carouselDrawer__cardControls button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.krt-carouselDrawer__danger {
		color: #ef4444 !important;
		border-color: #ef4444 !important;
	}

	.krt-carouselDrawer__danger:hover:not(:disabled) {
		background: #fef2f2 !important;
	}

	.krt-carouselDrawer__grid {
		display: grid;
		gap: 0.75rem;
	}

	.krt-carouselDrawer__field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.krt-carouselDrawer__field span {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--krt-color-muted, #475569);
	}

	.krt-carouselDrawer__field input,
	.krt-carouselDrawer__field textarea {
		padding: 0.5rem;
		border: 1px solid var(--krt-color-border-subtle, #e2e8f0);
		border-radius: 0.375rem;
		font-size: 0.875rem;
	}

	.krt-carouselDrawer__toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
	}
</style>
