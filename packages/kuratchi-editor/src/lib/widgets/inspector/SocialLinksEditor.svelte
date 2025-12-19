<script lang="ts">
    import { IconPicker } from '../index.js';
    import { LucideIconMap, type LucideIconKey } from '../../utils/lucide-icons.js';
    import InspectorSection from './InspectorSection.svelte';

    interface SocialIcon {
        icon: LucideIconKey;
        link?: string;
        slug?: string;
        name: string;
        enabled: boolean;
    }

    interface Props {
        icons?: SocialIcon[];
        title?: string;
        hint?: string;
        /** Field name used for the URL (default: 'link', footers use 'slug') */
        linkField?: 'link' | 'slug';
    }

    let {
        icons = $bindable([]),
        title = 'Social Links',
        hint = 'Add and configure social media links',
        linkField = 'link'
    }: Props = $props();

    // Helper to get/set the link value based on linkField
    function getLinkValue(icon: SocialIcon): string {
        return (linkField === 'slug' ? icon.slug : icon.link) ?? '';
    }

    function setLinkValue(icon: SocialIcon, value: string) {
        if (linkField === 'slug') {
            icon.slug = value;
        } else {
            icon.link = value;
        }
    }
</script>

<InspectorSection {title} icon="🔗" {hint}>
    <div class="krt-socialLinks__picker">
        <IconPicker bind:selectedIcons={icons} />
    </div>

    {#each icons as icon}
        {@const Comp = LucideIconMap[icon.icon as LucideIconKey]}
        <label class="krt-socialLinks__item">
            <div class="krt-socialLinks__header">
                {#if Comp}
                    <Comp aria-hidden="true" />
                {/if}
                <span>{icon.name}</span>
            </div>
            <input
                type="text"
                class="krt-socialLinks__input"
                placeholder="https://example.com"
                value={getLinkValue(icon)}
                onchange={(e) => setLinkValue(icon, (e.target as HTMLInputElement).value)}
            />
        </label>
    {/each}
</InspectorSection>

<style>
    .krt-socialLinks__picker {
        padding: var(--krt-space-md, 0.75rem) var(--krt-space-lg, 1rem);
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        background: var(--krt-color-surface, #ffffff);
    }

    .krt-socialLinks__item {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--krt-space-sm, 0.5rem);
        padding: var(--krt-space-md, 0.75rem) var(--krt-space-lg, 1rem);
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        background: var(--krt-color-surface, #ffffff);
        cursor: pointer;
    }

    .krt-socialLinks__header {
        display: flex;
        align-items: center;
        gap: var(--krt-space-sm, 0.5rem);
        font-size: 0.75rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--krt-color-muted, #6b7280);
    }

    .krt-socialLinks__header :global(svg) {
        width: 1.25rem;
        height: 1.25rem;
        color: var(--krt-color-accent, #4f46e5);
    }

    .krt-socialLinks__input {
        width: 100%;
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        padding: 0.45rem 0.75rem;
        font-size: 0.85rem;
        background: #f9fafb;
    }

    .krt-socialLinks__input:focus {
        outline: 2px solid var(--krt-color-primary, #3b82f6);
        outline-offset: 1px;
    }
</style>
