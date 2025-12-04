<script lang="ts">
    import { ChevronUp, ChevronDown } from '@lucide/svelte';
    import { BLOCK_SPACING_OPTIONS, type BlockSpacing } from './block-spacing.js';

    interface Props {
        spacingTop?: BlockSpacing;
        spacingBottom?: BlockSpacing;
        onSpacingTopChange?: (value: BlockSpacing) => void;
        onSpacingBottomChange?: (value: BlockSpacing) => void;
    }

    let {
        spacingTop = 'normal',
        spacingBottom = 'normal',
        onSpacingTopChange,
        onSpacingBottomChange
    }: Props = $props();
</script>

<div class="krt-spacingControl">
    <div class="krt-spacingControl__section">
        <div class="krt-spacingControl__label">
            <ChevronUp />
            <span>Top</span>
        </div>
        <div class="krt-spacingControl__options">
            {#each BLOCK_SPACING_OPTIONS as option}
                <button
                    type="button"
                    class="krt-spacingControl__option"
                    class:active={spacingTop === option.value}
                    onclick={() => onSpacingTopChange?.(option.value)}
                    title={option.description}
                >
                    {option.label}
                </button>
            {/each}
        </div>
    </div>
    <div class="krt-spacingControl__section">
        <div class="krt-spacingControl__label">
            <ChevronDown />
            <span>Bottom</span>
        </div>
        <div class="krt-spacingControl__options">
            {#each BLOCK_SPACING_OPTIONS as option}
                <button
                    type="button"
                    class="krt-spacingControl__option"
                    class:active={spacingBottom === option.value}
                    onclick={() => onSpacingBottomChange?.(option.value)}
                    title={option.description}
                >
                    {option.label}
                </button>
            {/each}
        </div>
    </div>
</div>

<style>
    .krt-spacingControl {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.5rem;
        border-top: 1px solid rgba(0, 0, 0, 0.1);
        margin-top: 0.25rem;
    }

    .krt-spacingControl__section {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .krt-spacingControl__label {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: rgba(0, 0, 0, 0.5);
    }

    .krt-spacingControl__label :global(svg) {
        width: 12px;
        height: 12px;
    }

    .krt-spacingControl__options {
        display: flex;
        gap: 0.125rem;
    }

    .krt-spacingControl__option {
        flex: 1;
        padding: 0.25rem 0.35rem;
        font-size: 0.65rem;
        font-weight: 500;
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 0.25rem;
        background: white;
        color: rgba(0, 0, 0, 0.6);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .krt-spacingControl__option:hover {
        background: rgba(99, 102, 241, 0.05);
        border-color: rgba(99, 102, 241, 0.3);
    }

    .krt-spacingControl__option.active {
        background: rgba(99, 102, 241, 0.1);
        border-color: rgba(99, 102, 241, 0.5);
        color: rgb(79, 70, 229);
    }
</style>
