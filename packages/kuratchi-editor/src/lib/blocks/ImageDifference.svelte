<script lang="ts">
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import { onMount } from 'svelte';
    import { BlockActions } from '../utils/index.js';

    interface DifferenceImage {
        id: string;
        src: string;
        alt: string;
        key?: string;
    }

    interface Props {
        id?: string;
        type?: string;
        metadata?: {
            image1: DifferenceImage;
            image2: DifferenceImage;
        };
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'image-difference',
        metadata = $bindable({
            image1: {
                id: 'image-1',
                src: 'https://fakeimg.pl/1024x768/?text=Before',
                alt: 'Before image',
                key: ''
            },
            image2: {
                id: 'image-2',
                src: 'https://fakeimg.pl/1024x768/?text=After',
                alt: 'After image',
                key: ''
            }
        }),
        editable = true
    }: Props = $props();

    let component = $state<HTMLElement>();
    const componentRef = {};
    let mounted = $state(false);
    onMount(() => {
        if (!editable) return;
        mounted = true;
    });

    const content = $derived({ id, type, metadata });

    let split = $state(50);
    const viewportStyle = $derived(`--krt-diff-split: ${editable ? split : 50}%`);

    const imageUrl = (image?: DifferenceImage) => (image?.key ? `/api/bucket/${image.key}` : image?.src ?? '');

    const handleSliderInput = (event: Event) => {
        const target = event.currentTarget as HTMLInputElement;
        split = Number(target.value);
    };

    onMount(() => {
        if (typeof editable !== 'undefined' && !editable) return;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
    <div class="editor-item group relative" bind:this={component}>
        {#if mounted}
            <BlockActions {component} />
        {/if}

        <div data-type={type} id={id} class="krt-diff">
            <div class="krt-diff__metadata">{JSON.stringify(content)}</div>
            <div class="krt-diff__viewport" style={viewportStyle} role="img" aria-label="Image comparison slider">
                <figure class="krt-diff__layer">
                    <img src={imageUrl(metadata.image1)} alt={metadata.image1.alt} loading="lazy" />
                    <figcaption>Before</figcaption>
                </figure>
                <figure class="krt-diff__layer krt-diff__layer--after">
                    <img src={imageUrl(metadata.image2)} alt={metadata.image2.alt} loading="lazy" />
                    <figcaption>After</figcaption>
                </figure>
                <input
                    class="krt-diff__slider"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={split}
                    oninput={handleSliderInput}
                    aria-label="Adjust comparison"
                />
                <div class="krt-diff__handle" aria-hidden="true"></div>
            </div>
        </div>
    </div>
{:else}
    <div data-type={type} id={id} class="krt-diff">
        <div class="krt-diff__metadata">{JSON.stringify(content)}</div>
        <div class="krt-diff__viewport" style={viewportStyle} role="img" aria-label="Image comparison">
            <figure class="krt-diff__layer">
                <img src={imageUrl(metadata.image1)} alt={metadata.image1.alt} loading="lazy" />
            </figure>
            <figure class="krt-diff__layer krt-diff__layer--after">
                <img src={imageUrl(metadata.image2)} alt={metadata.image2.alt} loading="lazy" />
            </figure>
            <div class="krt-diff__handle" aria-hidden="true"></div>
        </div>
    </div>
{/if}

<style>
    .krt-diff {
        position: relative;
        width: 100%;
        min-width: 100%;
    }

    .krt-diff__metadata {
        display: none;
    }

    .krt-diff__viewport {
        position: relative;
        aspect-ratio: 16 / 9;
        overflow: hidden;
        border-radius: var(--krt-radius-xl, 1rem);
        box-shadow: 0 20px 45px rgba(15, 23, 42, 0.25);
        --krt-diff-split: 50%;
    }

    .krt-diff__layer {
        margin: 0;
        position: absolute;
        inset: 0;
    }

    .krt-diff__layer img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    .krt-diff__layer figcaption {
        position: absolute;
        inset: 1rem auto auto 1rem;
        background: rgba(0, 0, 0, 0.55);
        color: #fff;
        border-radius: 999px;
        font-size: 0.75rem;
        padding: 0.25rem 0.75rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .krt-diff__layer--after figcaption {
        inset: auto 1rem 1rem auto;
    }

    .krt-diff__layer--after img {
        clip-path: inset(0 calc(100% - var(--krt-diff-split, 50%)) 0 0);
    }

    .krt-diff__slider {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: col-resize;
    }

    .krt-diff__handle {
        position: absolute;
        top: 50%;
        left: var(--krt-diff-split, 50%);
        width: 0.2rem;
        height: 100%;
        background: rgba(255, 255, 255, 0.8);
        transform: translate(-50%, -50%);
        box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.2);
    }

    .krt-diff__handle::before,
    .krt-diff__handle::after {
        content: '';
        position: absolute;
        width: 1.6rem;
        height: 1.6rem;
        border-radius: 999px;
        border: 2px solid rgba(255, 255, 255, 0.9);
        background: rgba(15, 23, 42, 0.7);
        left: 50%;
        transform: translateX(-50%);
    }

    .krt-diff__handle::before {
        top: -0.8rem;
    }

    .krt-diff__handle::after {
        bottom: -0.8rem;
    }

    .krt-diff__handle::before {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: rgba(255, 255, 255, 0.8);
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
    }
</style>

