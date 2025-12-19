<script lang="ts">
    import { ImagePicker } from '../index.js';
    import InspectorSection from './InspectorSection.svelte';

    interface LogoData {
        url: string;
        alt: string;
    }

    interface Props {
        logo?: LogoData;
        title?: string;
        hint?: string;
    }

    let {
        logo = $bindable({ url: '', alt: '' }),
        title = 'Logo',
        hint = 'Upload or enter URL for your logo'
    }: Props = $props();

    const logoUrl = $derived(logo?.url || '');
    const logoAlt = $derived(logo?.alt || 'Logo');
</script>

<InspectorSection {title} icon="🏷️" {hint}>
    {#if logoUrl}
        <div class="krt-logoEditor__preview">
            <img src={logoUrl} alt={logoAlt} class="krt-logoEditor__img" />
        </div>
    {/if}
    <div class="krt-logoEditor__picker">
        <ImagePicker bind:selectedImage={logo} mode="single" />
    </div>
</InspectorSection>

<style>
    .krt-logoEditor__preview {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--krt-space-lg, 1rem);
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        border: 2px dashed var(--krt-color-border-subtle, #e5e7eb);
        border-radius: var(--krt-radius-md, 0.5rem);
    }

    .krt-logoEditor__img {
        max-height: 3rem;
        max-width: 100%;
        object-fit: contain;
    }

    .krt-logoEditor__picker {
        padding: var(--krt-space-md, 0.75rem) var(--krt-space-lg, 1rem);
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        background: var(--krt-color-surface, #ffffff);
    }
</style>
