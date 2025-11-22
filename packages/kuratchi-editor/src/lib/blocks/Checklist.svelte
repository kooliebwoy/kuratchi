<script lang="ts">
    import { BlockActions } from "../utils/index.js";
    import Checkbox from "./Checkbox.svelte";
    import { onMount, mount } from "svelte";

    interface Props {
        id?: string;
        checklist?: any[];
        type?: string;
        metadata?: any;
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        checklist = $bindable([]),
        type = 'checklist',
        metadata = {
            color: '#000000',
        },
        editable = true
    }: Props = $props();

    let component = $state<HTMLElement>();

    // extract body from the content and the card title
    let content = $derived({
        id,
        type,
        checklist,
        // metadata : {
        //     color,
        // }
    })

    let checklistParent: HTMLDivElement | null = null;

    function handleKeyDown(event: KeyboardEvent): void {
        try {
            const isEnter = event.key === 'Enter';
            const isBackspace = event.key === 'Backspace';

            if ( isEnter ) {
                event.preventDefault();
                if (checklistParent) {
                    const newCheckbox = mount(Checkbox, { 
                        target: checklistParent 
                    });
                    const lastChild = checklistParent.lastElementChild as HTMLElement;
                    if (lastChild) {
                        const editable = lastChild.querySelector('[contenteditable]') as HTMLElement;
                        if (editable) {
                            editable.focus();
                        }
                    }
                }
            }

            if ( isBackspace ) {
                const checkbox = event.target?.parentElement as HTMLElement;
                if (checkbox && event?.target?.textContent?.trim() === '') {
                    const nearestSibling = checkbox.previousElementSibling as HTMLElement || checkbox.nextElementSibling as HTMLElement;
                    if (nearestSibling) {
                        checkbox.remove();
                        const editable = nearestSibling.querySelector('[contenteditable]') as HTMLElement;
                        if (editable) {
                            editable.focus();
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error occurred in handleKeyDown:', error);
        }
    }

    let mounted = $state(false);
    onMount(() => {
        if (!editable) return;
        mounted = true;
    });
</script>

{#if editable}
    <div class="editor-item group relative" bind:this={component}>
        {#if mounted}
            <BlockActions {component} />
        {/if}

        <div data-type={type} id={id} class="w-full min-w-full">
            <!-- JSON Data for this component -->
            <div class="hidden" id="metadata-{id}">
                {JSON.stringify(content)}
            </div>

            <div onkeydown={(e) => handleKeyDown(e)} bind:this={checklistParent} role="list">
                <Checkbox />
            </div>
        </div>
    </div>
{:else}
    <div data-type={type} id={id} class="w-full min-w-full space-y-3">
        {#each Array.isArray(checklist) ? checklist : [] as item, index}
            <div class="flex items-start gap-3">
                <input type="checkbox" class="checkbox" disabled checked={Boolean(item?.completed)} />
                <p class="flex-1 text-base" style:color={metadata?.color || '#000000'}>
                    {item?.content ?? `Item ${index + 1}`}
                </p>
            </div>
        {/each}
    </div>
{/if}
