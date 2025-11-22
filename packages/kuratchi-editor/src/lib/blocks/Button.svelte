<script lang="ts">
    import { BlockActions } from "../utils/index.js";
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
        editable?: boolean;
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
        },
        editable = true
    }: Props = $props();

    let component = $state<HTMLElement>();
    let style = $state(metadata?.style ?? 'primary');
    let size = $state(metadata?.size ?? 'md');
    let target = $state(metadata?.target ?? '_self');

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
        if (!editable) return;
        mounted = true;
    });
</script>

{#if editable}
    <div class="editor-item group relative krt-button-block" bind:this={component}>
        {#if mounted}
            <BlockActions {component}>
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
            </BlockActions>
        {/if}
        
        <div data-type={type} {id} class="krt-button-body">
            <!-- JSON Data for this component -->
            <script type="application/json" id="metadata-{id}">
                {JSON.stringify(content)}
            </script>

            <div class="krt-button-align">
                <a 
                    href={url} 
                    {target}
                    class={`krt-button krt-button--${style} krt-button--${size}`}
                    contenteditable
                    bind:textContent={text}
                    role="button"
                >
                    {text}
                </a>
            </div>
        </div>
    </div>
{:else}
    <div data-type={type} {id} class="krt-button-block krt-button-body">
        <div class="krt-button-align">
            <a
                href={url}
                target={target === '_blank' ? '_blank' : '_self'}
                rel={target === '_blank' ? 'noopener noreferrer' : undefined}
                class={`krt-button krt-button--${style} krt-button--${size}`}
            >
                {text}
            </a>
        </div>
    </div>
{/if}

<style>
    .krt-button-block {
        width: 100%;
        min-width: 100%;
    }

    .krt-button-body {
        padding-block: 1rem;
    }

    .krt-button-align {
        display: flex;
        justify-content: center;
    }

    .krt-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--krt-radius-pill, 9999px);
        padding: 0.5rem 1.5rem;
        border: none;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 600;
        letter-spacing: 0.01em;
        text-decoration: none;
        background-color: var(--krt-color-primary, #111827);
        color: #f9fafb;
        box-shadow: var(--krt-shadow-sm, 0 1px 2px rgba(15, 23, 42, 0.06));
        transition:
            background-color 150ms ease,
            color 150ms ease,
            box-shadow 150ms ease,
            transform 150ms ease;
    }

    .krt-button--secondary {
        background-color: var(--krt-color-surface, #ffffff);
        color: var(--krt-color-text, #111827);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        box-shadow: none;
    }

    .krt-button--accent {
        background-color: var(--krt-color-accent, #4f46e5);
        color: #f9fafb;
    }

    .krt-button--ghost {
        background-color: transparent;
        color: var(--krt-color-primary, #111827);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        box-shadow: none;
    }

    .krt-button--xs {
        padding: 0.25rem 0.75rem;
        font-size: 0.75rem;
    }

    .krt-button--sm {
        padding: 0.4rem 1rem;
        font-size: 0.8rem;
    }

    .krt-button--md {
        padding: 0.5rem 1.25rem;
    }

    .krt-button--lg {
        padding: 0.75rem 1.5rem;
        font-size: 1rem;
    }

    .krt-button:focus-visible {
        outline: 2px solid var(--krt-color-accent, #4f46e5);
        outline-offset: 2px;
    }

    .krt-button:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
    }
</style>
