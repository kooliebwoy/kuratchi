<script lang="ts">
    import type { PluginContext, SiteLayoutExtension, SitePresetItem } from '../context';
    import { EXT } from '../context';
    import HeaderPreview from '../../headers/HeaderPreview.svelte';
    import FooterPreview from '../../footers/FooterPreview.svelte';

    let { ctx }: { ctx: PluginContext } = $props();

    const layout = $derived(ctx.ext<SiteLayoutExtension>(EXT.SITE_LAYOUT));
    const headerPresets = $derived(layout?.headerPresets ?? []);
    const footerPresets = $derived(layout?.footerPresets ?? []);

    function handleMountHeader(preset: SitePresetItem) {
        layout?.mountHeader(preset.component, { type: preset.type });
    }

    function handleMountFooter(preset: SitePresetItem) {
        layout?.mountFooter(preset.component, { type: preset.type });
    }
</script>

<div class="site-plugin">
    <div class="site-plugin__section">
        <h3 class="site-plugin__sectionTitle">Headers</h3>
        <div class="site-plugin__presetGrid">
            {#each headerPresets as header}
                <button class="site-plugin__presetButton" onclick={() => handleMountHeader(header)}>
                    <HeaderPreview header={header as any} scale={0.25} />
                    <div class="site-plugin__presetLabel">{header.name}</div>
                </button>
            {/each}
        </div>
    </div>

    <div class="site-plugin__section">
        <h3 class="site-plugin__sectionTitle">Footers</h3>
        <div class="site-plugin__presetGrid">
            {#each footerPresets as footer}
                <button class="site-plugin__presetButton" onclick={() => handleMountFooter(footer)}>
                    <FooterPreview footer={footer as any} scale={0.25} />
                    <div class="site-plugin__presetLabel">{footer.name}</div>
                </button>
            {/each}
        </div>
    </div>
</div>

<style>
    .site-plugin {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        padding: 1rem;
    }

    .site-plugin__section {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .site-plugin__sectionTitle {
        margin: 0;
        padding: 0 0.25rem;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--krt-editor-text-primary, #0f172a);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .site-plugin__presetGrid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.5rem;
    }

    .site-plugin__presetButton {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.5rem;
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-md, 0.5rem);
        background: var(--krt-editor-bg, #ffffff);
        cursor: pointer;
        transition: all 0.15s ease;
        text-align: left;
    }

    .site-plugin__presetButton:hover {
        border-color: var(--krt-editor-accent, #3b82f6);
        background: var(--krt-editor-surface, #f8fafc);
        box-shadow: var(--krt-editor-shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05));
        transform: translateY(-1px);
    }

    .site-plugin__presetButton:active {
        background: var(--krt-editor-surface-hover, #f1f5f9);
        transform: translateY(0);
    }

    .site-plugin__presetLabel {
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--krt-editor-text-primary, #0f172a);
        padding: 0 0.25rem;
    }
</style>
