<script lang="ts">
    /**
     * NavSettingsPanel - Reusable navigation settings UI for header/footer inspectors
     * 
     * Usage in header/footer:
     * <NavSettingsPanel
     *     bind:dropdownTrigger={navDropdownTrigger}
     *     bind:dropdownAlign={navDropdownAlign}
     *     bind:submenuDirection={navSubmenuDirection}
     *     bind:hoverBgColor={navHoverBgColor}
     *     bind:hoverTextColor={navHoverTextColor}
     *     bind:dropdownBgColor={navDropdownBgColor}
     *     bind:dropdownTextColor={navDropdownTextColor}
     *     bind:dropdownHoverBgColor={navDropdownHoverBgColor}
     *     bind:mobileStyle={mobileNavStyle}
     *     bind:mobileDrawerPosition={mobileDrawerPosition}
     * />
     */

    type DropdownTrigger = 'hover' | 'click';
    type DropdownAlign = 'start' | 'center' | 'end';
    type SubmenuDirection = 'left' | 'right';
    type MobileStyle = 'drawer' | 'fullscreen';
    type DrawerPosition = 'left' | 'right';

    interface Props {
        dropdownTrigger?: DropdownTrigger;
        dropdownAlign?: DropdownAlign;
        submenuDirection?: SubmenuDirection;
        hoverBgColor?: string;
        hoverTextColor?: string;
        dropdownBgColor?: string;
        dropdownTextColor?: string;
        dropdownHoverBgColor?: string;
        mobileStyle?: MobileStyle;
        mobileDrawerPosition?: DrawerPosition;
        /** Show mobile menu settings */
        showMobileSettings?: boolean;
        /** Custom section class */
        sectionClass?: string;
    }

    let {
        dropdownTrigger = $bindable('hover'),
        dropdownAlign = $bindable('start'),
        submenuDirection = $bindable('right'),
        hoverBgColor = $bindable(''),
        hoverTextColor = $bindable(''),
        dropdownBgColor = $bindable(''),
        dropdownTextColor = $bindable(''),
        dropdownHoverBgColor = $bindable(''),
        mobileStyle = $bindable('drawer'),
        mobileDrawerPosition = $bindable('right'),
        showMobileSettings = true,
        sectionClass = 'krt-headerDrawer__section',
    }: Props = $props();
</script>

<section class={sectionClass}>
    <h3 class="krt-headerDrawer__title">Navigation Style</h3>
    <div class="krt-headerDrawer__cards">
        <label class="krt-headerDrawer__card">
            <span>Dropdown Trigger</span>
            <select class="krt-headerDrawer__select" bind:value={dropdownTrigger}>
                <option value="hover">Hover</option>
                <option value="click">Click</option>
            </select>
        </label>
        <label class="krt-headerDrawer__card">
            <span>Dropdown Align</span>
            <select class="krt-headerDrawer__select" bind:value={dropdownAlign}>
                <option value="start">Left</option>
                <option value="center">Center</option>
                <option value="end">Right</option>
            </select>
        </label>
        <label class="krt-headerDrawer__card">
            <span>Submenu Direction</span>
            <select class="krt-headerDrawer__select" bind:value={submenuDirection}>
                <option value="right">Right</option>
                <option value="left">Left</option>
            </select>
        </label>
    </div>
</section>

<section class={sectionClass}>
    <h3 class="krt-headerDrawer__title">Nav Item Hover</h3>
    <div class="krt-headerDrawer__cards">
        <label class="krt-headerDrawer__card krt-headerDrawer__card--color">
            <span>Background</span>
            <div class="krt-headerDrawer__colorControl">
                <input type="color" bind:value={hoverBgColor} />
                <input type="text" class="krt-headerDrawer__input" bind:value={hoverBgColor} placeholder="transparent" />
            </div>
        </label>
        <label class="krt-headerDrawer__card krt-headerDrawer__card--color">
            <span>Text Color</span>
            <div class="krt-headerDrawer__colorControl">
                <input type="color" bind:value={hoverTextColor} />
                <input type="text" class="krt-headerDrawer__input" bind:value={hoverTextColor} placeholder="inherit" />
            </div>
        </label>
    </div>
</section>

<section class={sectionClass}>
    <h3 class="krt-headerDrawer__title">Dropdown Colors</h3>
    <div class="krt-headerDrawer__cards">
        <label class="krt-headerDrawer__card krt-headerDrawer__card--color">
            <span>Background</span>
            <div class="krt-headerDrawer__colorControl">
                <input type="color" bind:value={dropdownBgColor} />
                <input type="text" class="krt-headerDrawer__input" bind:value={dropdownBgColor} placeholder="auto" />
            </div>
        </label>
        <label class="krt-headerDrawer__card krt-headerDrawer__card--color">
            <span>Text Color</span>
            <div class="krt-headerDrawer__colorControl">
                <input type="color" bind:value={dropdownTextColor} />
                <input type="text" class="krt-headerDrawer__input" bind:value={dropdownTextColor} placeholder="#1f2937" />
            </div>
        </label>
        <label class="krt-headerDrawer__card krt-headerDrawer__card--color">
            <span>Hover Background</span>
            <div class="krt-headerDrawer__colorControl">
                <input type="color" bind:value={dropdownHoverBgColor} />
                <input type="text" class="krt-headerDrawer__input" bind:value={dropdownHoverBgColor} placeholder="auto" />
            </div>
        </label>
    </div>
</section>

{#if showMobileSettings}
    <section class={sectionClass}>
        <h3 class="krt-headerDrawer__title">Mobile Menu</h3>
        <p class="krt-headerDrawer__hint">These settings configure how the mobile menu appears when triggered at mobile breakpoints.</p>
        <div class="krt-headerDrawer__cards">
            <label class="krt-headerDrawer__card">
                <span>Menu Style</span>
                <select class="krt-headerDrawer__select" bind:value={mobileStyle}>
                    <option value="drawer">Drawer</option>
                    <option value="fullscreen">Fullscreen</option>
                </select>
            </label>
            {#if mobileStyle === 'drawer'}
                <label class="krt-headerDrawer__card">
                    <span>Drawer Position</span>
                    <select class="krt-headerDrawer__select" bind:value={mobileDrawerPosition}>
                        <option value="right">Right</option>
                        <option value="left">Left</option>
                    </select>
                </label>
            {/if}
        </div>
    </section>
{/if}

<style>
    /* Section styles */
    section {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-sm, 0.5rem);
        padding-bottom: var(--krt-space-lg, 1rem);
        border-bottom: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        margin-bottom: var(--krt-space-lg, 1rem);
    }

    section:last-child {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
    }

    .krt-headerDrawer__title {
        font-size: 0.8rem;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--krt-color-muted, #6b7280);
        margin: 0 0 var(--krt-space-sm, 0.5rem) 0;
    }

    .krt-headerDrawer__cards {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-sm, 0.5rem);
    }

    .krt-headerDrawer__card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--krt-space-sm, 0.5rem);
        padding: var(--krt-space-md, 0.75rem) var(--krt-space-lg, 1rem);
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        background: var(--krt-color-surface, #ffffff);
        font-size: 0.9rem;
    }

    .krt-headerDrawer__card span {
        font-weight: 500;
    }

    .krt-headerDrawer__select {
        padding: 0.4rem 0.6rem;
        border-radius: var(--krt-radius-sm, 0.375rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        background: var(--krt-color-bg, #fafafa);
        font-size: 0.85rem;
        color: var(--krt-color-text, #1f2937);
        cursor: pointer;
        min-width: 6rem;
    }

    .krt-headerDrawer__select:focus {
        outline: 2px solid var(--krt-color-primary, #3b82f6);
        outline-offset: 1px;
    }

    .krt-headerDrawer__card--color {
        flex-direction: column;
        align-items: flex-start;
    }

    .krt-headerDrawer__colorControl {
        display: flex;
        align-items: center;
        gap: var(--krt-space-sm, 0.5rem);
        width: 100%;
    }

    .krt-headerDrawer__colorControl input[type='color'] {
        width: 2.5rem;
        height: 2.5rem;
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 2px solid var(--krt-color-border-subtle, #e5e7eb);
        background: none;
        padding: 0;
        cursor: pointer;
        flex-shrink: 0;
    }

    .krt-headerDrawer__input {
        flex: 1;
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        padding: 0.45rem 0.75rem;
        font-size: 0.85rem;
        background: #f9fafb;
        font-family: 'SFMono-Regular', ui-monospace, Menlo, Monaco, Consolas, monospace;
        color: var(--krt-color-muted, #6b7280);
    }

    .krt-headerDrawer__input:focus {
        outline: 2px solid var(--krt-color-primary, #3b82f6);
        outline-offset: 1px;
    }

    .krt-headerDrawer__hint {
        font-size: 0.8rem;
        color: var(--krt-color-muted, #6b7280);
        margin: 0;
        line-height: 1.4;
    }
</style>
