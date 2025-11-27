<script lang="ts">
    import { Search, X } from "@lucide/svelte";
    import { LucideIconMap, lucideIconKeys, type LucideIconKey } from "../utils/lucide-icons.js";

    interface Props {
        selectedIcons?: { icon: LucideIconKey; name?: string }[];
    }

    let { selectedIcons = $bindable([]) }: Props = $props();

    let showLoading = $state(false);
    let searchValue = $state('');
    let icons = $state<LucideIconKey[]>([]);
    let isOpen = $state(false);

    const search = async () => {
        showLoading = true;
        const q = searchValue.trim().toLowerCase();
        icons = q ? (lucideIconKeys.filter(k => k.includes(q))) : lucideIconKeys;
        showLoading = false;
        isOpen = true;
    }

    const toggleOpen = () => {
        isOpen = !isOpen;
        if (isOpen && icons.length === 0) {
            icons = lucideIconKeys;
        }
    }

    const selectIcon = (icon: LucideIconKey) => {
        if (!selectedIcons.find(t => t.icon === icon)) {
            selectedIcons = [...selectedIcons, {icon, name: ''}];
        }
        isOpen = false;
    }

    const removeIcon = (icon: LucideIconKey) => {
        selectedIcons = selectedIcons.filter(t => t.icon !== icon);
    }
</script>

<div class="krt-iconPicker">
    <div class="krt-iconPicker__header">
        <h3 class="krt-iconPicker__title">Search Icons</h3>
    </div>

    <div class="krt-iconPicker__search">
        <div class="krt-iconPicker__searchBox">
            <Search class="krt-iconPicker__searchIcon" />
            <input 
                type="text" 
                class="krt-iconPicker__searchInput" 
                placeholder="Search icons..." 
                bind:value={searchValue}
                oninput={search}
            />
        </div>
        <button 
            class="krt-iconPicker__toggleButton"
            onclick={toggleOpen}
            title={isOpen ? "Close" : "Open"}
        >
            {#if isOpen}
                ▲
            {:else}
                ▼
            {/if}
        </button>
    </div>

    {#if isOpen}
        <div class="krt-iconPicker__dropdown">
            {#if showLoading}
                <div class="krt-iconPicker__loading">
                    <div class="krt-iconPicker__spinner"></div>
                    <p>Searching...</p>
                </div>
            {:else if icons.length > 0}
                <div class="krt-iconPicker__grid">
                    {#each icons as icon}
                        {@const Comp = LucideIconMap[icon]}
                        <button 
                            type="button" 
                            class="krt-iconPicker__iconButton"
                            onclick={() => selectIcon(icon)}
                            title={icon}
                        >
                            <Comp class="krt-iconPicker__iconButtonIcon" />
                        </button>
                    {/each}
                </div>
            {:else}
                <div class="krt-iconPicker__empty">
                    <p>No icons found</p>
                </div>
            {/if}
        </div>
    {/if}

    {#if selectedIcons.length > 0}
        <div class="krt-iconPicker__selected">
            <h4 class="krt-iconPicker__selectedTitle">Selected Icons</h4>
            <div class="krt-iconPicker__selectedGrid">
                {#each selectedIcons as {icon, name}}
                    {@const Comp = LucideIconMap[icon]}
                    <div class="krt-iconPicker__selectedItem">
                        <div class="krt-iconPicker__selectedIcon">
                            <Comp />
                        </div>
                        <button 
                            type="button"
                            class="krt-iconPicker__removeButton"
                            onclick={() => removeIcon(icon)}
                            title="Remove"
                        >
                            <X />
                        </button>
                    </div>
                {/each}
            </div>
        </div>
    {:else}
        <div class="krt-iconPicker__noSelected">
            <p>No icons selected</p>
        </div>
    {/if}
</div>

<style>
    .krt-iconPicker {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        width: 100%;
    }

    .krt-iconPicker__header {
        padding-bottom: 0.5rem;
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    }

    .krt-iconPicker__title {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: rgba(0, 0, 0, 0.85);
    }

    .krt-iconPicker__search {
        display: flex;
        gap: 0.5rem;
        align-items: center;
    }

    .krt-iconPicker__searchBox {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.6rem 0.8rem;
        border: 1px solid rgba(0, 0, 0, 0.15);
        border-radius: 0.5rem;
        background: #ffffff;
        transition: all 200ms ease;
    }

    .krt-iconPicker__searchBox:focus-within {
        border-color: rgba(59, 130, 246, 0.5);
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    }

    .krt-iconPicker__searchIcon {
        width: 1.125rem;
        height: 1.125rem;
        color: rgba(0, 0, 0, 0.4);
        flex-shrink: 0;
    }

    .krt-iconPicker__searchInput {
        flex: 1;
        border: none;
        outline: none;
        background: transparent;
        font-size: 0.9rem;
        color: rgba(0, 0, 0, 0.8);
        font-family: inherit;
    }

    .krt-iconPicker__searchInput::placeholder {
        color: rgba(0, 0, 0, 0.4);
    }

    .krt-iconPicker__toggleButton {
        width: 2.25rem;
        height: 2.25rem;
        border: 1px solid rgba(0, 0, 0, 0.15);
        border-radius: 0.5rem;
        background: #ffffff;
        color: rgba(0, 0, 0, 0.6);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.75rem;
        font-weight: 600;
        transition: all 200ms ease;
    }

    .krt-iconPicker__toggleButton:hover {
        border-color: rgba(59, 130, 246, 0.5);
        background: rgba(59, 130, 246, 0.05);
        color: rgba(59, 130, 246, 0.8);
    }

    .krt-iconPicker__dropdown {
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 0.5rem;
        background: #ffffff;
        padding: 0.75rem;
        max-height: 18rem;
        overflow-y: auto;
        animation: slideDown 200ms ease;
    }

    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-0.5rem);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .krt-iconPicker__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(2.5rem, 1fr));
        gap: 0.5rem;
    }

    .krt-iconPicker__iconButton {
        width: 100%;
        aspect-ratio: 1;
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 0.375rem;
        background: transparent;
        color: rgba(0, 0, 0, 0.7);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 150ms ease;
    }

    .krt-iconPicker__iconButton:hover {
        border-color: rgba(59, 130, 246, 0.5);
        background: rgba(59, 130, 246, 0.08);
        color: rgba(59, 130, 246, 0.9);
        transform: scale(1.05);
    }

    .krt-iconPicker__iconButtonIcon {
        width: 1.25rem;
        height: 1.25rem;
    }

    .krt-iconPicker__loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        padding: 2rem 1rem;
        color: rgba(0, 0, 0, 0.6);
    }

    .krt-iconPicker__spinner {
        width: 1.5rem;
        height: 1.5rem;
        border: 2px solid rgba(59, 130, 246, 0.2);
        border-top-color: rgba(59, 130, 246, 0.8);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .krt-iconPicker__empty {
        padding: 2rem 1rem;
        text-align: center;
        color: rgba(0, 0, 0, 0.5);
        font-size: 0.9rem;
    }

    .krt-iconPicker__selected {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 0.75rem;
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 0.5rem;
        background: rgba(59, 130, 246, 0.02);
    }

    .krt-iconPicker__selectedTitle {
        margin: 0;
        font-size: 0.85rem;
        font-weight: 600;
        color: rgba(0, 0, 0, 0.7);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .krt-iconPicker__selectedGrid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(3rem, 1fr));
        gap: 0.5rem;
    }

    .krt-iconPicker__selectedItem {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        aspect-ratio: 1;
        border: 1px solid rgba(59, 130, 246, 0.3);
        border-radius: 0.375rem;
        background: rgba(59, 130, 246, 0.08);
        transition: all 150ms ease;
    }

    .krt-iconPicker__selectedItem:hover {
        border-color: rgba(59, 130, 246, 0.6);
        background: rgba(59, 130, 246, 0.15);
    }

    .krt-iconPicker__selectedIcon {
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(59, 130, 246, 0.8);
    }

    .krt-iconPicker__selectedIcon :global(svg) {
        width: 1.5rem;
        height: 1.5rem;
    }

    .krt-iconPicker__removeButton {
        position: absolute;
        top: -0.5rem;
        right: -0.5rem;
        width: 1.5rem;
        height: 1.5rem;
        border: none;
        border-radius: 50%;
        background: #ef4444;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: all 150ms ease;
    }

    .krt-iconPicker__selectedItem:hover .krt-iconPicker__removeButton {
        opacity: 1;
    }

    .krt-iconPicker__removeButton:hover {
        background: #dc2626;
        transform: scale(1.1);
    }

    .krt-iconPicker__removeButton :global(svg) {
        width: 0.875rem;
        height: 0.875rem;
    }

    .krt-iconPicker__noSelected {
        padding: 1rem;
        text-align: center;
        color: rgba(0, 0, 0, 0.4);
        font-size: 0.9rem;
        font-style: italic;
    }
</style>
