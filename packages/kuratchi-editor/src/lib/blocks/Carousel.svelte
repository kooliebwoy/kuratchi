<script lang="ts">
	import { Pencil } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { BlockActions, SideActions } from "../utils/index.js";

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
		metadata = {
			showIndicators: true
		},
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
			showIndicators
		}
	});

	let component: HTMLElement;
	let mounted = $state(false);
	const sideActionsId = `side-actions-${id}`;

	onMount(() => {
		mounted = true;
	});
</script>

{#if editable}
	<div class="editor-item group relative" bind:this={component}>
		{#if mounted}
			<BlockActions {id} {type} element={component} />
		{/if}
		<div class="space-y-2" {id} data-type={type}>
			<script type="application/json" id="metadata-{id}">{JSON.stringify(content)}</script>
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

	<SideActions triggerId={sideActionsId}>
		{#snippet label()}
			<button id={sideActionsId} class="krt-editButton" aria-label="Edit carousel settings" type="button">
				<Pencil size={16} />
				<span>Edit Settings</span>
			</button>
		{/snippet}
		{#snippet content()}
			<div class="space-y-4">
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" class="checkbox checkbox-sm checkbox-accent" bind:checked={showIndicators} />
					Show slide indicators
				</label>

				<button class="btn btn-sm btn-primary w-full" type="button" onclick={addSlide}>
					Add slide
				</button>

				<div class="space-y-3 max-h-[26rem] overflow-y-auto pr-1">
					{#each slides as slide, index (slide.id)}
						<div class="border border-base-300 rounded-lg p-3 space-y-2 bg-base-100">
							<div class="flex justify-between items-center">
								<h4 class="text-xs font-semibold uppercase tracking-wide text-base-content/70">Slide {index + 1}</h4>
								<button class="btn btn-ghost btn-xs text-error" type="button" onclick={() => removeSlide(index)} disabled={slides.length <= 1}>
									Remove
								</button>
							</div>
							<label class="form-control w-full">
								<span class="label-text text-xs">Image URL</span>
								<input type="text" class="input input-sm input-bordered" bind:value={slide.imageUrl} placeholder="https://..." />
							</label>
							<label class="form-control w-full">
								<span class="label-text text-xs">Title</span>
								<input type="text" class="input input-sm input-bordered" bind:value={slide.title} placeholder="Slide title" />
							</label>
							<label class="form-control w-full">
								<span class="label-text text-xs">Description</span>
								<textarea class="textarea textarea-sm textarea-bordered" rows="2" bind:value={slide.description} placeholder="Add supporting copy"></textarea>
							</label>
							<div class="grid grid-cols-2 gap-2">
								<label class="form-control">
									<span class="label-text text-xs">Button label</span>
									<input type="text" class="input input-sm input-bordered" bind:value={slide.ctaLabel} placeholder="Learn more" />
								</label>
								<label class="form-control">
									<span class="label-text text-xs">Button link</span>
									<input type="text" class="input input-sm input-bordered" bind:value={slide.ctaLink} placeholder="https://..." />
								</label>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/snippet}
	</SideActions>
{:else}
	<section id={id} data-type={type} class="space-y-2">
		<script type="application/json" id="metadata-{id}">{JSON.stringify(content)}</script>
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
