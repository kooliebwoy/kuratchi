<script lang="ts">
	import { Pencil } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { BlockActions, SideActions } from "../utils/index.js";

	interface Props {
		id?: string;
		type?: string;
		title?: string;
		subtitle?: string;
		ctaLabel?: string;
		ctaLink?: string;
		imageUrl?: string;
		backgroundUrl?: string;
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
		editable = true
	}: Props = $props();

	let content = $derived({
		id,
		type,
		title,
		subtitle,
		ctaLabel,
		ctaLink,
		imageUrl,
		backgroundUrl
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

	<SideActions triggerId={sideActionsId}>
		{#snippet label()}
			<button id={sideActionsId} class="krt-editButton" aria-label="Edit hover card settings" type="button">
				<Pencil size={16} />
				<span>Edit Settings</span>
			</button>
		{/snippet}
		{#snippet content()}
			<div class="space-y-4">
				<label class="form-control">
					<span class="label-text text-xs">Title</span>
					<input type="text" class="input input-sm input-bordered" bind:value={title} />
				</label>
				<label class="form-control">
					<span class="label-text text-xs">Subtitle</span>
					<textarea class="textarea textarea-sm textarea-bordered" rows="3" bind:value={subtitle}></textarea>
				</label>
				<div class="grid grid-cols-2 gap-2">
					<label class="form-control">
						<span class="label-text text-xs">CTA Label</span>
						<input type="text" class="input input-sm input-bordered" bind:value={ctaLabel} />
					</label>
					<label class="form-control">
						<span class="label-text text-xs">CTA Link</span>
						<input type="text" class="input input-sm input-bordered" bind:value={ctaLink} />
					</label>
				</div>
				<label class="form-control">
					<span class="label-text text-xs">Foreground Image URL</span>
					<input type="text" class="input input-sm input-bordered" bind:value={imageUrl} />
				</label>
				<label class="form-control">
					<span class="label-text text-xs">Background Image URL</span>
					<input type="text" class="input input-sm input-bordered" bind:value={backgroundUrl} />
				</label>
			</div>
		{/snippet}
	</SideActions>
{:else}
	<section id={id} data-type={type}>
		<div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
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
	</section>
{/if}

<style>
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
