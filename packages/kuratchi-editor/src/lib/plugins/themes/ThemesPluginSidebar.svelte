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
    .themes-plugin {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1rem;
    }

    .themes-plugin__header {
        padding: 0 0.25rem;
    }

    .themes-plugin__header h3 {
        margin: 0 0 0.25rem 0;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--krt-editor-text-primary, #0f172a);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .themes-plugin__header p {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--krt-editor-text-secondary, #64748b);
    }

    .themes-plugin__grid {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .themes-plugin__themeButton {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 0.75rem;
        border: 2px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-lg, 0.75rem);
        background: var(--krt-editor-bg, #ffffff);
        cursor: pointer;
        transition: all 0.15s ease;
        text-align: left;
    }

    .themes-plugin__themeButton:hover {
        border-color: var(--krt-editor-accent, #3b82f6);
        background: var(--krt-editor-surface, #f8fafc);
        box-shadow: var(--krt-editor-shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1));
        transform: translateY(-1px);
    }

    .themes-plugin__themeButton.is-active {
        border-color: var(--krt-editor-accent, #3b82f6);
        background: rgba(59, 130, 246, 0.05);
        box-shadow: 0 0 0 1px var(--krt-editor-accent, #3b82f6);
    }

    .themes-plugin__themeButton.is-active .themes-plugin__themeName {
        color: var(--krt-editor-accent, #3b82f6);
    }

    .themes-plugin__themeDetails {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 0 0.25rem;
    }

    .themes-plugin__themeName {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--krt-editor-text-primary, #0f172a);
    }

    .themes-plugin__themeDescription {
        margin: 0;
        font-size: 0.75rem;
        color: var(--krt-editor-text-secondary, #64748b);
        line-height: 1.4;
    }

    .themes-plugin__empty {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem 1rem;
    }

    .themes-plugin__empty p {
        margin: 0;
        font-size: 0.875rem;
        color: var(--krt-editor-text-muted, #94a3b8);
    }
</style>
