<script lang="ts">
    import { SideActions } from "$lib/shell";
    import { onMount } from "svelte";

    interface Props {
        id?: string;
        text?: string;
        url?: string;
        type?: string;
        metadata?: {
            style?: 'primary' | 'secondary' | 'accent' | 'neutral' | 'ghost';
            size?: 'xs' | 'sm' | 'md' | 'lg';
            target?: '_blank' | '_self';
        };
    }

    let {
        id = crypto.randomUUID(),
        text = 'Click me',
        url = '#',
        type = 'button',
        metadata = {
            style: 'primary',
            size: 'md',
            target: '_self'
        }
    }: Props = $props();

    let component: HTMLElement;
    let style = $state(metadata.style);
    let size = $state(metadata.size);
    let target = $state(metadata.target);

    let content = $derived({
        id,
        type,
        text,
        url,
        metadata: {
            style,
            size,
            target
        }
    });

    let mounted = $state(false);
    onMount(() => {
        mounted = true;
    });
</script>

<div class="editor-item group relative" bind:this={component}>
    {#if mounted}
        <SideActions {component}>
            <small>Button Style</small>
            <li><button class="btn btn-sm btn-ghost" onclick={() => style = 'primary'}>Primary</button></li>
            <li><button class="btn btn-sm btn-ghost" onclick={() => style = 'secondary'}>Secondary</button></li>
            <li><button class="btn btn-sm btn-ghost" onclick={() => style = 'accent'}>Accent</button></li>
            <li><button class="btn btn-sm btn-ghost" onclick={() => style = 'ghost'}>Ghost</button></li>
            
            <div class="divider my-1"></div>
            <small>Button Size</small>
            <li><button class="btn btn-sm btn-ghost" onclick={() => size = 'xs'}>Extra Small</button></li>
            <li><button class="btn btn-sm btn-ghost" onclick={() => size = 'sm'}>Small</button></li>
            <li><button class="btn btn-sm btn-ghost" onclick={() => size = 'md'}>Medium</button></li>
            <li><button class="btn btn-sm btn-ghost" onclick={() => size = 'lg'}>Large</button></li>
            
            <div class="divider my-1"></div>
            <small>Link Target</small>
            <li><button class="btn btn-sm btn-ghost" onclick={() => target = '_self'}>Same Window</button></li>
            <li><button class="btn btn-sm btn-ghost" onclick={() => target = '_blank'}>New Window</button></li>
        </SideActions>
    {/if}
    
    <div data-type={type} {id} class="w-full min-w-full">
        <!-- JSON Data for this component -->
        <div class="hidden" id="metadata-{id}">
            {JSON.stringify(content)}
        </div>

        <div class="flex justify-center py-4">
            <a 
                href={url} 
                {target}
                class="btn btn-{style} btn-{size}"
                contenteditable
                bind:textContent={text}
                role="button"
            >
                {text}
            </a>
        </div>
    </div>
</div>
