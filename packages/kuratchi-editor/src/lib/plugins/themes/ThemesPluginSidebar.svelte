<script lang="ts">
    import type { PluginContext, ThemesExtension, ThemeSettings } from '../context';
    import { EXT, DEFAULT_THEME_SETTINGS } from '../context';
    import ThemePreview from '../../themes/ThemePreview.svelte';
    import { RotateCcw, ChevronDown, ChevronUp } from '@lucide/svelte';

    let { ctx }: { ctx: PluginContext } = $props();

    const themesExt = $derived(ctx.ext<ThemesExtension>(EXT.THEMES));
    const themes = $derived(themesExt?.themes ?? []);
    const selectedThemeId = $derived(themesExt?.selectedThemeId ?? '');
    const themeSettings = $derived(themesExt?.themeSettings ?? DEFAULT_THEME_SETTINGS);

    // UI state
    let activeSection = $state<'themes' | 'settings'>('themes');
    let showAdvanced = $state(false);

    function handleApplyTheme(themeId: string) {
        themesExt?.applyTheme(themeId);
    }

    function handleSwitchTheme(themeId: string, updateHeaderFooter: boolean) {
        themesExt?.switchTheme(themeId, { updateHeaderFooter });
    }

    function handleSettingChange<K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) {
        themesExt?.updateThemeSettings({ [key]: value });
    }

    function handleResetSettings() {
        themesExt?.resetThemeSettings();
    }

    // Options for select controls
    const maxWidthOptions = [
        { value: 'full', label: 'Full Width' },
        { value: 'wide', label: 'Wide (1440px)' },
        { value: 'medium', label: 'Medium (1200px)' },
        { value: 'narrow', label: 'Narrow (960px)' }
    ] as const;

    const spacingOptions = [
        { value: 'none', label: 'None' },
        { value: 'small', label: 'Small' },
        { value: 'medium', label: 'Medium' },
        { value: 'large', label: 'Large' }
    ] as const;

    const radiusOptions = [
        { value: 'none', label: 'None' },
        { value: 'small', label: 'Small' },
        { value: 'medium', label: 'Medium' },
        { value: 'large', label: 'Large' }
    ] as const;
</script>

<div class="themes-plugin">
    <!-- Tab Navigation -->
    <div class="themes-plugin__tabs">
        <button
            class="themes-plugin__tab"
            class:is-active={activeSection === 'themes'}
            onclick={() => activeSection = 'themes'}
        >
            Themes
        </button>
        <button
            class="themes-plugin__tab"
            class:is-active={activeSection === 'settings'}
            onclick={() => activeSection = 'settings'}
        >
            Settings
        </button>
    </div>

    {#if activeSection === 'themes'}
        <!-- Theme Selection -->
        <div class="themes-plugin__section">
            <div class="themes-plugin__header">
                <h3>Select Theme</h3>
                <p>Choose a theme style for your site</p>
            </div>

            <div class="themes-plugin__grid">
                {#each themes as theme (theme.metadata.id)}
                    <button
                        class="themes-plugin__themeButton"
                        class:is-active={selectedThemeId === theme.metadata.id}
                        onclick={() => handleSwitchTheme(theme.metadata.id, true)}
                    >
                        <ThemePreview theme={theme as any} scale={0.35} />
                        <div class="themes-plugin__themeDetails">
                            <div class="themes-plugin__themeName">{theme.metadata.name}</div>
                            <p class="themes-plugin__themeDescription">{theme.metadata.description}</p>
                        </div>
                        {#if selectedThemeId === theme.metadata.id}
                            <span class="themes-plugin__activeIndicator">Active</span>
                        {/if}
                    </button>
                {/each}
            </div>

            {#if themes.length === 0}
                <div class="themes-plugin__empty">
                    <p>No themes available</p>
                </div>
            {/if}
        </div>
    {:else}
        <!-- Theme Settings -->
        <div class="themes-plugin__section">
            <div class="themes-plugin__header">
                <h3>Theme Settings</h3>
                <p>Customize your theme appearance</p>
                <button class="themes-plugin__resetBtn" onclick={handleResetSettings} title="Reset to defaults">
                    <RotateCcw size={14} />
                    Reset
                </button>
            </div>

            <!-- Layout Settings -->
            <div class="themes-plugin__group">
                <h4>Layout</h4>
                
                <label class="themes-plugin__field">
                    <span>Max Width</span>
                    <select
                        onchange={(e) => handleSettingChange('maxWidth', e.currentTarget.value as ThemeSettings['maxWidth'])}
                    >
                        {#each maxWidthOptions as opt}
                            <option value={opt.value} selected={themeSettings.maxWidth === opt.value}>{opt.label}</option>
                        {/each}
                    </select>
                </label>

                <label class="themes-plugin__field">
                    <span>Section Spacing</span>
                    <select
                        onchange={(e) => handleSettingChange('sectionSpacing', e.currentTarget.value as ThemeSettings['sectionSpacing'])}
                    >
                        {#each spacingOptions as opt}
                            <option value={opt.value} selected={themeSettings.sectionSpacing === opt.value}>{opt.label}</option>
                        {/each}
                    </select>
                </label>

                <label class="themes-plugin__field">
                    <span>Border Radius</span>
                    <select
                        onchange={(e) => handleSettingChange('borderRadius', e.currentTarget.value as ThemeSettings['borderRadius'])}
                    >
                        {#each radiusOptions as opt}
                            <option value={opt.value} selected={themeSettings.borderRadius === opt.value}>{opt.label}</option>
                        {/each}
                    </select>
                </label>
            </div>

            <!-- Color Settings -->
            <div class="themes-plugin__group">
                <h4>Colors</h4>

                <label class="themes-plugin__field themes-plugin__field--color">
                    <span>Background</span>
                    <div class="themes-plugin__colorInput">
                        <input
                            type="color"
                            value={themeSettings.backgroundColor}
                            onchange={(e) => handleSettingChange('backgroundColor', e.currentTarget.value)}
                        />
                        <input
                            type="text"
                            value={themeSettings.backgroundColor}
                            onchange={(e) => handleSettingChange('backgroundColor', e.currentTarget.value)}
                            placeholder="#ffffff"
                        />
                    </div>
                </label>

                <label class="themes-plugin__field themes-plugin__field--color">
                    <span>Primary Color</span>
                    <div class="themes-plugin__colorInput">
                        <input
                            type="color"
                            value={themeSettings.primaryColor}
                            onchange={(e) => handleSettingChange('primaryColor', e.currentTarget.value)}
                        />
                        <input
                            type="text"
                            value={themeSettings.primaryColor}
                            onchange={(e) => handleSettingChange('primaryColor', e.currentTarget.value)}
                            placeholder="#3b82f6"
                        />
                    </div>
                </label>

                <label class="themes-plugin__field themes-plugin__field--color">
                    <span>Secondary Color</span>
                    <div class="themes-plugin__colorInput">
                        <input
                            type="color"
                            value={themeSettings.secondaryColor}
                            onchange={(e) => handleSettingChange('secondaryColor', e.currentTarget.value)}
                        />
                        <input
                            type="text"
                            value={themeSettings.secondaryColor}
                            onchange={(e) => handleSettingChange('secondaryColor', e.currentTarget.value)}
                            placeholder="#64748b"
                        />
                    </div>
                </label>

                <label class="themes-plugin__field themes-plugin__field--color">
                    <span>Text Color</span>
                    <div class="themes-plugin__colorInput">
                        <input
                            type="color"
                            value={themeSettings.textColor}
                            onchange={(e) => handleSettingChange('textColor', e.currentTarget.value)}
                        />
                        <input
                            type="text"
                            value={themeSettings.textColor}
                            onchange={(e) => handleSettingChange('textColor', e.currentTarget.value)}
                            placeholder="#0f172a"
                        />
                    </div>
                </label>
            </div>

            <!-- Advanced Options Toggle -->
            <button class="themes-plugin__advancedToggle" onclick={() => showAdvanced = !showAdvanced}>
                {#if showAdvanced}
                    <ChevronUp size={16} />
                {:else}
                    <ChevronDown size={16} />
                {/if}
                Advanced Options
            </button>

            {#if showAdvanced}
                <div class="themes-plugin__group">
                    <h4>Header & Footer</h4>
                    <p class="themes-plugin__hint">Switch theme style without changing your content</p>
                    
                    <div class="themes-plugin__themeSwitch">
                        {#each themes as theme (theme.metadata.id)}
                            <button
                                class="themes-plugin__themeSwitchBtn"
                                class:is-active={selectedThemeId === theme.metadata.id}
                                onclick={() => handleSwitchTheme(theme.metadata.id, true)}
                            >
                                {theme.metadata.name}
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .themes-plugin {
        display: flex;
        flex-direction: column;
        gap: 0;
        padding: 0;
    }

    /* Tab Navigation */
    .themes-plugin__tabs {
        display: flex;
        border-bottom: 1px solid var(--krt-editor-border, #e2e8f0);
        padding: 0 1rem;
        gap: 0;
    }

    .themes-plugin__tab {
        flex: 1;
        padding: 0.75rem 1rem;
        border: none;
        background: transparent;
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--krt-editor-text-secondary, #64748b);
        cursor: pointer;
        transition: all 0.15s ease;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
    }

    .themes-plugin__tab:hover {
        color: var(--krt-editor-text-primary, #0f172a);
    }

    .themes-plugin__tab.is-active {
        color: var(--krt-editor-accent, #3b82f6);
        border-bottom-color: var(--krt-editor-accent, #3b82f6);
    }

    /* Section Container */
    .themes-plugin__section {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1rem;
    }

    .themes-plugin__header {
        padding: 0 0.25rem;
        position: relative;
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

    .themes-plugin__resetBtn {
        position: absolute;
        top: 0;
        right: 0;
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.25rem 0.5rem;
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        background: var(--krt-editor-bg, #ffffff);
        font-size: 0.75rem;
        color: var(--krt-editor-text-secondary, #64748b);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .themes-plugin__resetBtn:hover {
        border-color: var(--krt-editor-accent, #3b82f6);
        color: var(--krt-editor-accent, #3b82f6);
    }

    /* Theme Grid */
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
        position: relative;
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

    .themes-plugin__activeIndicator {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        padding: 0.125rem 0.5rem;
        background: var(--krt-editor-accent, #3b82f6);
        color: white;
        font-size: 0.625rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
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

    /* Settings Groups */
    .themes-plugin__group {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 1rem;
        background: var(--krt-editor-surface, #f8fafc);
        border-radius: var(--krt-editor-radius-md, 0.5rem);
        border: 1px solid var(--krt-editor-border, #e2e8f0);
    }

    .themes-plugin__group h4 {
        margin: 0;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--krt-editor-text-primary, #0f172a);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .themes-plugin__hint {
        margin: 0;
        font-size: 0.75rem;
        color: var(--krt-editor-text-muted, #94a3b8);
    }

    /* Form Fields */
    .themes-plugin__field {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
    }

    .themes-plugin__field > span {
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--krt-editor-text-secondary, #64748b);
    }

    .themes-plugin__field select {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        background: var(--krt-editor-bg, #ffffff);
        font-size: 0.8125rem;
        color: var(--krt-editor-text-primary, #0f172a);
        cursor: pointer;
        transition: border-color 0.15s ease;
    }

    .themes-plugin__field select:hover,
    .themes-plugin__field select:focus {
        border-color: var(--krt-editor-accent, #3b82f6);
        outline: none;
    }

    /* Color Input */
    .themes-plugin__colorInput {
        display: flex;
        gap: 0.5rem;
        align-items: center;
    }

    .themes-plugin__colorInput input[type="color"] {
        width: 2.5rem;
        height: 2rem;
        padding: 0;
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        cursor: pointer;
        background: transparent;
    }

    .themes-plugin__colorInput input[type="color"]::-webkit-color-swatch-wrapper {
        padding: 2px;
    }

    .themes-plugin__colorInput input[type="color"]::-webkit-color-swatch {
        border: none;
        border-radius: 2px;
    }

    .themes-plugin__colorInput input[type="text"] {
        flex: 1;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        background: var(--krt-editor-bg, #ffffff);
        font-size: 0.8125rem;
        font-family: monospace;
        color: var(--krt-editor-text-primary, #0f172a);
    }

    .themes-plugin__colorInput input[type="text"]:focus {
        border-color: var(--krt-editor-accent, #3b82f6);
        outline: none;
    }

    /* Advanced Toggle */
    .themes-plugin__advancedToggle {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-md, 0.5rem);
        background: transparent;
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--krt-editor-text-secondary, #64748b);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .themes-plugin__advancedToggle:hover {
        border-color: var(--krt-editor-accent, #3b82f6);
        color: var(--krt-editor-accent, #3b82f6);
    }

    /* Theme Switch Buttons */
    .themes-plugin__themeSwitch {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .themes-plugin__themeSwitchBtn {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        background: var(--krt-editor-bg, #ffffff);
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--krt-editor-text-secondary, #64748b);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .themes-plugin__themeSwitchBtn:hover {
        border-color: var(--krt-editor-accent, #3b82f6);
        color: var(--krt-editor-accent, #3b82f6);
    }

    .themes-plugin__themeSwitchBtn.is-active {
        background: var(--krt-editor-accent, #3b82f6);
        border-color: var(--krt-editor-accent, #3b82f6);
        color: white;
    }

    /* Empty State */
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
