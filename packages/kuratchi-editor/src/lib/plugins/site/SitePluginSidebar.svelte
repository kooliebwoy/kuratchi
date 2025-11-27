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
    .site-plugin { display: flex; flex-direction: column; gap: 24px; }
    .site-plugin__section { display: flex; flex-direction: column; gap: 12px; }
    .site-plugin__sectionTitle { margin: 0; padding: 0 4px; font-size: 13px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; }
    .site-plugin__presetGrid { display: grid; grid-template-columns: 1fr; gap: 8px; }
    .site-plugin__presetButton { display: flex; flex-direction: column; gap: 8px; padding: 8px; border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff; cursor: pointer; transition: all 0.15s ease; text-align: left; }
    .site-plugin__presetButton:hover { border-color: #d1d5db; background: #f9fafb; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); }
    .site-plugin__presetButton:active { background: #f3f4f6; }
    .site-plugin__presetLabel { font-size: 13px; font-weight: 500; color: #374151; padding: 0 4px; }
</style>
