<script lang="ts">
    import {
        type SectionLayout,
        type SectionWidth,
        type SectionSpacing,
        type SectionHeightMode,
        WIDTH_OPTIONS,
        SPACING_OPTIONS,
        HEIGHT_OPTIONS,
        DEFAULT_SECTION_LAYOUT
    } from './section-layout.js';
    import { MoveHorizontal, MoveVertical, Maximize2, RectangleHorizontal } from '@lucide/svelte';

    interface Props {
        /** The layout configuration to bind to */
        layout: SectionLayout;
        /** Whether to show height controls (some sections may not need them) */
        showHeightControls?: boolean;
        /** Whether to show corner radius toggle */
        showCornerControls?: boolean;
        /** Callback when any layout value changes */
        onchange?: (layout: SectionLayout) => void;
    }

    let {
        layout = $bindable(DEFAULT_SECTION_LAYOUT),
        showHeightControls = false,
        showCornerControls = true,
        onchange
    }: Props = $props();

    // Emit change event
    const emitChange = () => {
        onchange?.(layout);
    };

    function updateWidth(value: SectionWidth) {
        layout.width = value;
        emitChange();
    }

    function updateHorizontalSpacing(value: SectionSpacing) {
        layout.horizontalSpacing = value;
        emitChange();
    }

    function updateVerticalSpacing(value: SectionSpacing) {
        layout.verticalSpacing = value;
        emitChange();
    }

    function updateHeightMode(value: SectionHeightMode) {
        layout.heightMode = value;
        if (value !== 'custom') {
            layout.customHeight = undefined;
        }
        emitChange();
    }

    function updateCustomHeight(value: string) {
        layout.customHeight = value;
        emitChange();
    }

    function toggleCorners() {
        layout.roundedCorners = !layout.roundedCorners;
        emitChange();
    }
</script>

<div class="krt-layoutControls">
    <!-- Width Control -->
    <div class="krt-layoutControls__group">
        <div class="krt-layoutControls__label">
            <RectangleHorizontal size={14} />
            <span>Section Width</span>
        </div>
        <div class="krt-layoutControls__buttonGroup">
            {#each WIDTH_OPTIONS as opt}
                <button
                    type="button"
                    class="krt-layoutControls__optionBtn"
                    class:is-active={layout.width === opt.value}
                    onclick={() => updateWidth(opt.value)}
                    title={opt.description}
                >
                    {opt.label}
                </button>
            {/each}
        </div>
    </div>

    <!-- Horizontal Spacing Control -->
    <div class="krt-layoutControls__group">
        <div class="krt-layoutControls__label">
            <MoveHorizontal size={14} />
            <span>Horizontal Space</span>
        </div>
        <div class="krt-layoutControls__segmented">
            {#each SPACING_OPTIONS as opt}
                <button
                    type="button"
                    class="krt-layoutControls__segmentBtn"
                    class:is-active={layout.horizontalSpacing === opt.value}
                    onclick={() => updateHorizontalSpacing(opt.value)}
                    title={opt.label}
                >
                    <span class="krt-layoutControls__segmentIcon">{opt.icon}</span>
                </button>
            {/each}
        </div>
        <span class="krt-layoutControls__hint">{SPACING_OPTIONS.find(o => o.value === layout.horizontalSpacing)?.label}</span>
    </div>

    <!-- Vertical Spacing Control -->
    <div class="krt-layoutControls__group">
        <div class="krt-layoutControls__label">
            <MoveVertical size={14} />
            <span>Vertical Space</span>
        </div>
        <div class="krt-layoutControls__segmented">
            {#each SPACING_OPTIONS as opt}
                <button
                    type="button"
                    class="krt-layoutControls__segmentBtn"
                    class:is-active={layout.verticalSpacing === opt.value}
                    onclick={() => updateVerticalSpacing(opt.value)}
                    title={opt.label}
                >
                    <span class="krt-layoutControls__segmentIcon">{opt.icon}</span>
                </button>
            {/each}
        </div>
        <span class="krt-layoutControls__hint">{SPACING_OPTIONS.find(o => o.value === layout.verticalSpacing)?.label}</span>
    </div>

    <!-- Height Controls (optional) -->
    {#if showHeightControls}
        <div class="krt-layoutControls__group">
            <div class="krt-layoutControls__label">
                <Maximize2 size={14} />
                <span>Section Height</span>
            </div>
            <select
                class="krt-layoutControls__select"
                value={layout.heightMode}
                onchange={(e) => updateHeightMode(e.currentTarget.value as SectionHeightMode)}
            >
                {#each HEIGHT_OPTIONS as opt}
                    <option value={opt.value}>{opt.label} — {opt.description}</option>
                {/each}
            </select>
            {#if layout.heightMode === 'custom'}
                <input
                    type="text"
                    class="krt-layoutControls__input"
                    placeholder="e.g., 400px or 60vh"
                    value={layout.customHeight ?? ''}
                    oninput={(e) => updateCustomHeight(e.currentTarget.value)}
                />
            {/if}
        </div>
    {/if}

    <!-- Corner Radius Toggle (optional) -->
    {#if showCornerControls}
        <label class="krt-layoutControls__toggle">
            <input
                type="checkbox"
                checked={layout.roundedCorners}
                onchange={toggleCorners}
            />
            <span>Rounded corners</span>
        </label>
    {/if}
</div>

<style>
    .krt-layoutControls {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .krt-layoutControls__group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .krt-layoutControls__label {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--krt-color-muted, #64748b);
    }

    .krt-layoutControls__label :global(svg) {
        opacity: 0.7;
    }

    /* Button Group (for width options) */
    .krt-layoutControls__buttonGroup {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
    }

    .krt-layoutControls__optionBtn {
        flex: 1;
        min-width: fit-content;
        padding: 0.45rem 0.6rem;
        border: 1px solid var(--krt-color-border-subtle, #e2e8f0);
        border-radius: var(--krt-radius-sm, 0.375rem);
        background: var(--krt-color-surface, #ffffff);
        font-size: 0.7rem;
        font-weight: 500;
        color: var(--krt-color-text, #334155);
        cursor: pointer;
        transition: all 0.12s ease;
        white-space: nowrap;
    }

    .krt-layoutControls__optionBtn:hover {
        border-color: var(--krt-color-primary, #3b82f6);
        background: color-mix(in srgb, var(--krt-color-primary, #3b82f6) 8%, transparent);
    }

    .krt-layoutControls__optionBtn.is-active {
        border-color: var(--krt-color-primary, #3b82f6);
        background: var(--krt-color-primary, #3b82f6);
        color: white;
    }

    /* Segmented Control (for spacing) */
    .krt-layoutControls__segmented {
        display: flex;
        border: 1px solid var(--krt-color-border-subtle, #e2e8f0);
        border-radius: var(--krt-radius-md, 0.5rem);
        overflow: hidden;
        background: var(--krt-color-surface, #ffffff);
    }

    .krt-layoutControls__segmentBtn {
        flex: 1;
        padding: 0.5rem;
        border: none;
        border-right: 1px solid var(--krt-color-border-subtle, #e2e8f0);
        background: transparent;
        cursor: pointer;
        transition: all 0.12s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .krt-layoutControls__segmentBtn:last-child {
        border-right: none;
    }

    .krt-layoutControls__segmentBtn:hover {
        background: color-mix(in srgb, var(--krt-color-primary, #3b82f6) 8%, transparent);
    }

    .krt-layoutControls__segmentBtn.is-active {
        background: var(--krt-color-primary, #3b82f6);
        color: white;
    }

    .krt-layoutControls__segmentIcon {
        font-size: 0.85rem;
        line-height: 1;
    }

    .krt-layoutControls__hint {
        font-size: 0.7rem;
        color: var(--krt-color-muted, #94a3b8);
        text-align: center;
    }

    /* Select */
    .krt-layoutControls__select {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--krt-color-border-subtle, #e2e8f0);
        border-radius: var(--krt-radius-sm, 0.375rem);
        background: var(--krt-color-surface, #ffffff);
        font-size: 0.8rem;
        color: var(--krt-color-text, #334155);
        cursor: pointer;
    }

    .krt-layoutControls__select:focus {
        outline: none;
        border-color: var(--krt-color-primary, #3b82f6);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--krt-color-primary, #3b82f6) 20%, transparent);
    }

    /* Text Input */
    .krt-layoutControls__input {
        padding: 0.45rem 0.65rem;
        border: 1px solid var(--krt-color-border-subtle, #e2e8f0);
        border-radius: var(--krt-radius-sm, 0.375rem);
        background: var(--krt-color-surface, #ffffff);
        font-size: 0.8rem;
        font-family: monospace;
        color: var(--krt-color-text, #334155);
    }

    .krt-layoutControls__input:focus {
        outline: none;
        border-color: var(--krt-color-primary, #3b82f6);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--krt-color-primary, #3b82f6) 20%, transparent);
    }

    .krt-layoutControls__input::placeholder {
        color: var(--krt-color-muted, #94a3b8);
    }

    /* Toggle */
    .krt-layoutControls__toggle {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.8rem;
        font-weight: 500;
        color: var(--krt-color-text, #334155);
        cursor: pointer;
        padding: 0.25rem 0;
    }

    .krt-layoutControls__toggle input[type="checkbox"] {
        width: 1rem;
        height: 1rem;
        accent-color: var(--krt-color-primary, #3b82f6);
        cursor: pointer;
    }
</style>
