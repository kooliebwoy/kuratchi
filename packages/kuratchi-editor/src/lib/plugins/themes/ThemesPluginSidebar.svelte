<script lang="ts">
    import type { PluginContext, ThemesExtension } from '../context';
    import { EXT } from '../context';
    import ThemePreview from '../../themes/ThemePreview.svelte';

    let { ctx }: { ctx: PluginContext } = $props();

    const themesExt = $derived(ctx.ext<ThemesExtension>(EXT.THEMES));
    const themes = $derived(themesExt?.themes ?? []);
    const selectedThemeId = $derived(themesExt?.selectedThemeId ?? '');

    function handleApplyTheme(themeId: string) {
        themesExt?.applyTheme(themeId);
    }
</script>

<div class="themes-plugin">
    <div class="themes-plugin__header">
        <h3>Themes</h3>
        <p>Choose a theme to style your entire site</p>
    </div>

    <div class="themes-plugin__grid">
        {#each themes as theme (theme.metadata.id)}
            <button
                class="themes-plugin__themeButton"
                class:is-active={selectedThemeId === theme.metadata.id}
                onclick={() => handleApplyTheme(theme.metadata.id)}
            >
                <ThemePreview theme={theme as any} scale={0.35} />
                <div class="themes-plugin__themeDetails">
                    <div class="themes-plugin__themeName">{theme.metadata.name}</div>
                    <p class="themes-plugin__themeDescription">{theme.metadata.description}</p>
                </div>
            </button>
        {/each}
    </div>

    {#if themes.length === 0}
        <div class="themes-plugin__empty">
            <p>No themes available</p>
        </div>
    {/if}
</div>

<style>
    .themes-plugin { display: flex; flex-direction: column; gap: 16px; }
    .themes-plugin__header { padding: 0 4px; }
    .themes-plugin__header h3 { margin: 0 0 4px 0; font-size: 13px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; }
    .themes-plugin__header p { margin: 0; font-size: 13px; color: #6b7280; }
    .themes-plugin__grid { display: flex; flex-direction: column; gap: 12px; }
    .themes-plugin__themeButton { display: flex; flex-direction: column; gap: 12px; padding: 12px; border: 2px solid #e5e7eb; border-radius: 12px; background: #ffffff; cursor: pointer; transition: all 0.15s ease; text-align: left; }
    .themes-plugin__themeButton:hover { border-color: #d1d5db; background: #f9fafb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .themes-plugin__themeButton.is-active { border-color: #3b82f6; background: #eff6ff; }
    .themes-plugin__themeButton.is-active .themes-plugin__themeName { color: #2563eb; }
    .themes-plugin__themeDetails { display: flex; flex-direction: column; gap: 4px; padding: 0 4px; }
    .themes-plugin__themeName { font-size: 14px; font-weight: 600; color: #374151; }
    .themes-plugin__themeDescription { margin: 0; font-size: 12px; color: #6b7280; line-height: 1.4; }
    .themes-plugin__empty { display: flex; align-items: center; justify-content: center; padding: 32px 16px; }
    .themes-plugin__empty p { margin: 0; font-size: 14px; color: #9ca3af; }
</style>
