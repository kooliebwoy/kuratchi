<script lang="ts">
    import { EditorDrawer as Drawer } from '$lib/shell';
    import { Pencil, GripVertical, Trash2, Wand2 } from '@lucide/svelte';
	import { deserialize, applyAction } from "$app/forms";
	import { invalidateAll } from "$app/navigation";
	import type { ActionResult } from "@sveltejs/kit";
  	import { deleteElement, validation, validationMessage } from '$lib/utils/editor.svelte';

	interface Props {
		id?: string;
		generatedContent?: string;
		type?: string;
		metadata?: any;
	}

	let {
		id = crypto.randomUUID(),
		generatedContent = $bindable('Click Edit button to submit prompt...'),
		type = 'ai-writer',
		metadata = {}
	}: Props = $props();

	let component: HTMLElement;
	let componentEditor: HTMLElement;

	// extract body from the content and the card title
	let content = $derived({
		id,
		type,
		generatedContent,
	})

	let formLoading: boolean = $state(false);

	async function handleSubmit(event: Event) {
		event.preventDefault();
		const form = event.target as HTMLFormElement;

		if ( !form ) {
			console.error('No form found');
			return;
		}

		const data = new FormData(form);

		formLoading = true;

		const response = await fetch(form.action, {
			method: 'POST',
			body: data,
		});
	
		const result: ActionResult = deserialize(await response.text());

		formLoading = false;
	
		if (result.type === 'success') {
			// rerun all `load` functions, following the successful update
			await invalidateAll();
			generatedContent = result?.data?.response;
		}
	
		applyAction(result);
	}
</script>

<div class="editor-item group">
	<!-- Edit Popup -->
	<div class="editor-block-controls" bind:this={componentEditor} >
		<Drawer id={`componentDrawer${id}`}>
			{#snippet label()}			
				<label for={`componentDrawer${id}`} class="btn btn-xs btn-naked">
					<Pencil class="text-xl text-accent" />
				</label>
			{/snippet}
			{#snippet content()}
				<div class="card-body">
					<h3 class="card-title">Current Content</h3>

					<label class="form-control w-full">
						<div class="label">
							<span class="label-text">Edit Content Manually</span>
						</div>
						<textarea class="textarea textarea-bordered h-24" placeholder="Enter request..." bind:value={generatedContent} required></textarea>
					</label>

					<div class="divider">OR AI Generated</div>

					<form method="POST" action="/website/pages?/aiPrompt" enctype="multipart/form-data" novalidate onsubmit={(e) => handleSubmit(e)}>
						<label class="form-control w-full">
							<div class="label">
								<span class="label-text">Prompt Request</span>
							</div>
							<textarea class="textarea textarea-bordered h-24 {validation}" placeholder="Enter request..." name="prompt" required></textarea>
							<span class={validationMessage}>Prompt Request is required!</span>
						</label>
						<div class="card-actions mt-4 justify-end">
							<button type="submit" class="btn btn-neutral btn-sm">
								{ formLoading ? 'Generating...' : 'Generate' }
								{#if !formLoading}
									<Wand2 class="text-accent text-2xl" />
								{:else}
									<span class="loading loading-spinner"></span>
								{/if}
							</button>
						</div>
					</form>
				</div>
			{/snippet}
		</Drawer>
		<div>
			<button class="btn btn-xs btn-naked">
				<GripVertical class="text-xl text-teal-50" />
			</button>
		</div>
		<div>
			<!-- Delete Button -->
			<button class="btn btn-xs btn-naked" onclick={() => deleteElement(component!)}>
				<Trash2 class="text-xl text-error" />
			</button>
		</div>
	</div>

	<div data-type={type} id={id} bind:this={component} class="w-full min-w-full">
		<!-- JSON Data for this component -->
		<div class="hidden" id="metadata-{id}">
			{JSON.stringify(content)}
		</div>

		<article id="generatedContent" class="prose w-full min-w-full" contenteditable bind:innerHTML={generatedContent}></article>
	</div>
</div>
