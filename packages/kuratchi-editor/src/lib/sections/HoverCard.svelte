<script lang="ts">
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
	import { onMount } from 'svelte';
	import { BlockActions } from "../utils/index.js";
	import SectionLayoutControls from './SectionLayoutControls.svelte';
	import { type SectionLayout, DEFAULT_SECTION_LAYOUT, getSectionLayoutStyles, mergeLayoutWithDefaults } from './section-layout.js';

	interface Props {
		id?: string;
		type?: string;
		title?: string;
		subtitle?: string;
		ctaLabel?: string;
		ctaLink?: string;
		imageUrl?: string;
		backgroundUrl?: string;
		layout?: Partial<SectionLayout>;
		editable?: boolean;
	}

	let {
		id = crypto.randomUUID(),
		type = "hover-card",
		title = "Spring Collection",
		subtitle = "Elevated essentials in organic textures and soft silhouettes.",
		ctaLabel = "Shop arrivals",
		ctaLink = "#",
		imageUrl = "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1600&q=80",
		backgroundUrl = "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80",
		layout = {},
		editable = true
	}: Props = $props();

	let sectionLayout = $state<SectionLayout>(mergeLayoutWithDefaults(layout));
	let layoutStyles = $derived(getSectionLayoutStyles(sectionLayout));

	let content = $derived({
		id,
		type,
		title,
		subtitle,
		ctaLabel,
		ctaLink,
		imageUrl,
		backgroundUrl,
		layout: sectionLayout
	});

	let component: HTMLElement;
    const componentRef = {};
	let mounted = $state(false);

	onMount(() => {
		mounted = true;
	});

    onMount(() => {
        if (typeof editable !== 'undefined' && !editable) return;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
	<div class="editor-item group relative krt-hoverCard" style={layoutStyles} bind:this={component}>
		{#if mounted}
			<BlockActions
				{id}
				{type}
				element={component}
				inspectorTitle="Hover card settings"
			>
				{#snippet inspector()}
					<div class="krt-hoverCardDrawer">
						<section class="krt-hoverCardDrawer__section">
							<h3>Section Layout</h3>
							<SectionLayoutControls bind:layout={sectionLayout} />
						</section>

						<section class="krt-hoverCardDrawer__section">
							<h3>Content</h3>
							<div class="krt-hoverCardDrawer__field">
								<label class="krt-hoverCardDrawer__label">Title</label>
								<input type="text" class="krt-hoverCardDrawer__input" bind:value={title} />
							</div>
							<div class="krt-hoverCardDrawer__field">
								<label class="krt-hoverCardDrawer__label">Subtitle</label>
								<textarea class="krt-hoverCardDrawer__textarea" rows="3" bind:value={subtitle}></textarea>
							</div>
						</section>

						<section class="krt-hoverCardDrawer__section">
							<h3>Call to Action</h3>
							<div class="krt-hoverCardDrawer__row">
								<div class="krt-hoverCardDrawer__field">
									<label class="krt-hoverCardDrawer__label">CTA Label</label>
									<input type="text" class="krt-hoverCardDrawer__input" bind:value={ctaLabel} />
								</div>
								<div class="krt-hoverCardDrawer__field">
									<label class="krt-hoverCardDrawer__label">CTA Link</label>
									<input type="text" class="krt-hoverCardDrawer__input" bind:value={ctaLink} />
								</div>
							</div>
						</section>

						<section class="krt-hoverCardDrawer__section">
							<h3>Images</h3>
							<div class="krt-hoverCardDrawer__field">
								<label class="krt-hoverCardDrawer__label">Foreground Image URL</label>
								<input type="text" class="krt-hoverCardDrawer__input" bind:value={imageUrl} />
							</div>
							<div class="krt-hoverCardDrawer__field">
								<label class="krt-hoverCardDrawer__label">Background Image URL</label>
								<input type="text" class="krt-hoverCardDrawer__input" bind:value={backgroundUrl} />
							</div>
						</section>
					</div>
				{/snippet}
			</BlockActions>
		{/if}
		<div class="krt-hoverCard__inner">
			<div class="card card-3d" style={`--bg-image:url('${backgroundUrl}')`} {id} data-type={type}>
				<div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
					<div class="content-3d">
						<div class="copy-3d">
							<p class="text-sm uppercase tracking-widest opacity-70">Featured</p>
							<h3 class="text-4xl font-semibold">{title}</h3>
							<p class="opacity-80" contenteditable bind:innerHTML={subtitle}></p>
							{#if ctaLabel}
								<a class="btn btn-outline btn-sm rounded-full mt-2" href={ctaLink} target="_blank">{ctaLabel}</a>
							{/if}
						</div>
						<div class="image-3d">
							<img src={imageUrl} alt={title} class="rounded-2xl shadow-2xl" />
						</div>
					</div>
				</div>
		</div>
	</div>

{:else}
	<section class="krt-hoverCard" style={layoutStyles} id={id} data-type={type}>
		<div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
		<div class="krt-hoverCard__inner">
			<div class="card card-3d" style={`--bg-image:url('${backgroundUrl}')`}>
				<div class="content-3d">
					<div class="copy-3d">
						<p class="text-sm uppercase tracking-widest opacity-70">Featured</p>
						<h3 class="text-4xl font-semibold">{title}</h3>
						<p class="opacity-80">{subtitle}</p>
						{#if ctaLabel}
							<a class="btn btn-outline btn-sm rounded-full mt-2" href={ctaLink}>{ctaLabel}</a>
						{/if}
					</div>
					<div class="image-3d">
						<img src={imageUrl} alt={title} class="rounded-2xl shadow-2xl" />
					</div>
				</div>
			</div>
		</div>
	</section>
{/if}

<style>
	/* Section Layout */
	.krt-hoverCard {
		width: 100%;
		max-width: var(--section-max-width, 100%);
		margin-left: auto;
		margin-right: auto;
		padding-left: var(--section-padding-x, 1.5rem);
		padding-right: var(--section-padding-x, 1.5rem);
		padding-top: var(--section-padding-y, 3rem);
		padding-bottom: var(--section-padding-y, 3rem);
		min-height: var(--section-min-height, auto);
		border-radius: var(--section-border-radius, 0);
		box-sizing: border-box;
	}

	.krt-hoverCard__inner {
		width: 100%;
	}

	/* Drawer Styles */
	.krt-hoverCardDrawer {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.krt-hoverCardDrawer__section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.krt-hoverCardDrawer__section h3 {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #6b7280;
		margin: 0;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.krt-hoverCardDrawer__field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.krt-hoverCardDrawer__row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.krt-hoverCardDrawer__label {
		font-size: 0.75rem;
		font-weight: 500;
		color: #374151;
	}

	.krt-hoverCardDrawer__input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		background: #fff;
		color: #1f2937;
		transition: border-color 0.15s ease;
	}

	.krt-hoverCardDrawer__input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
	}

	.krt-hoverCardDrawer__textarea {
		width: 100%;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		background: #fff;
		color: #1f2937;
		resize: vertical;
		min-height: 80px;
		font-family: inherit;
		transition: border-color 0.15s ease;
	}

	.krt-hoverCardDrawer__textarea:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
	}

	/* Card 3D Styles */
	:global(.card-3d) {
		position: relative;
		display: block;
		border-radius: 1.5rem;
		overflow: hidden;
		padding: 2rem;
		background: radial-gradient(circle at center, rgba(255, 255, 255, 0.1), rgba(0, 0, 0, 0.8));
		min-height: 360px;
		color: #fff;
	}

	:global(.card-3d::before) {
		content: '';
		position: absolute;
		inset: 0;
		background-image: var(--bg-image);
		background-size: cover;
		background-position: center;
		filter: blur(20px);
		opacity: 0.5;
		z-index: 0;
	}

	:global(.card-3d .content-3d) {
		position: relative;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		align-items: center;
		gap: 2rem;
		z-index: 1;
	}

	:global(.card-3d .image-3d img) {
		width: 100%;
		height: auto;
		transform: rotateY(-8deg) rotateX(8deg);
		transition: transform 0.5s ease, filter 0.5s ease;
		filter: drop-shadow(0 20px 30px rgba(0, 0, 0, 0.4));
	}

	:global(.card-3d:hover .image-3d img) {
		transform: rotateY(-2deg) rotateX(2deg) scale(1.02);
		filter: drop-shadow(0 30px 40px rgba(0, 0, 0, 0.45));
	}

	:global(.card-3d .copy-3d h3) {
		font-size: clamp(1.5rem, 4vw, 2.75rem);
		margin-bottom: 0.75rem;
	}

	:global(.card-3d .copy-3d p) {
		font-size: 1rem;
		line-height: 1.5;
		max-width: 28rem;
	}
</style>
