<script lang="ts">
    import type { PluginContext, NavigationExtension } from '../context';
    import { EXT } from '../context';
    import { MenuWidget } from '../index';
    import { PanelTop, PanelBottom } from '@lucide/svelte';

    let { ctx }: { ctx: PluginContext } = $props();

    const nav = $derived(ctx.ext<NavigationExtension>(EXT.NAVIGATION));
    const pages = $derived(ctx.pages);
    const reservedPages = $derived(ctx.reservedPages);

    const headerItems = $derived(nav?.state.header.items ?? []);
    const footerItems = $derived(nav?.state.footer.items ?? []);
    const headerVisible = $derived(nav?.state.header.visible ?? true);
    const footerVisible = $derived(nav?.state.footer.visible ?? true);
    const headerMobileOnDesktop = $derived(nav?.state.header.useMobileMenuOnDesktop ?? false);

    function handleHeaderVisibleChange(e: Event) {
        const checked = (e.currentTarget as HTMLInputElement).checked;
        nav?.setHeaderVisible(checked);
    }

    function handleFooterVisibleChange(e: Event) {
        const checked = (e.currentTarget as HTMLInputElement).checked;
        nav?.setFooterVisible(checked);
    }

    function handleHeaderMobileOnDesktopChange(e: Event) {
        const checked = (e.currentTarget as HTMLInputElement).checked;
        nav?.setHeaderMobileOnDesktop(checked);
    }

    function handleHeaderMenuSave({ items }: { location: string; items: any[] }) {
        nav?.updateHeaderMenu(items);
    }

    function handleFooterMenuSave({ items }: { location: string; items: any[] }) {
        nav?.updateFooterMenu(items);
    }
</script>

<div class="nav-plugin">
    <!-- Header Menu Section -->
    <div class="nav-plugin__card">
        <div class="nav-plugin__cardHeader">
            <div class="nav-plugin__cardTitle">
                <PanelTop />
                <span>Header</span>
            </div>
            <label class="nav-plugin__toggle">
                <input type="checkbox" checked={headerVisible} onchange={handleHeaderVisibleChange} />
                <span>Show</span>
            </label>
        </div>
        <div class="nav-plugin__cardBody">
            <label class="nav-plugin__checkbox">
                <input type="checkbox" checked={headerMobileOnDesktop} onchange={handleHeaderMobileOnDesktopChange} />
                <span>Mobile menu on desktop</span>
            </label>
            <div class="nav-plugin__menuWidget">
                <MenuWidget
                    menuItems={headerItems}
                    pages={pages ?? []}
                    reservedPages={reservedPages ?? []}
                    menuLocation="header"
                    onSave={handleHeaderMenuSave}
                />
            </div>
        </div>
    </div>

    <!-- Footer Menu Section -->
    <div class="nav-plugin__card">
        <div class="nav-plugin__cardHeader">
            <div class="nav-plugin__cardTitle">
                <PanelBottom />
                <span>Footer</span>
            </div>
            <label class="nav-plugin__toggle">
                <input type="checkbox" checked={footerVisible} onchange={handleFooterVisibleChange} />
                <span>Show</span>
            </label>
        </div>
        <div class="nav-plugin__cardBody">
            <MenuWidget
                menuItems={footerItems}
                pages={pages ?? []}
                reservedPages={reservedPages ?? []}
                menuLocation="footer"
                onSave={handleFooterMenuSave}
            />
        </div>
    </div>
</div>

<style>
    .nav-plugin {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1rem;
    }

    .nav-plugin__card {
        background: var(--krt-editor-bg, #ffffff);
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-md, 0.5rem);
        overflow: hidden;
        box-shadow: var(--krt-editor-shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05));
    }

    .nav-plugin__cardHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        background: var(--krt-editor-surface, #f8fafc);
        border-bottom: 1px solid var(--krt-editor-border, #e2e8f0);
    }

    .nav-plugin__cardTitle {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--krt-editor-text-primary, #0f172a);
    }

    .nav-plugin__cardTitle :global(svg) {
        width: 1rem;
        height: 1rem;
        color: var(--krt-editor-text-secondary, #64748b);
    }

    .nav-plugin__toggle {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.8125rem;
        color: var(--krt-editor-text-secondary, #64748b);
        cursor: pointer;
    }

    .nav-plugin__toggle input[type="checkbox"] {
        width: 0.875rem;
        height: 0.875rem;
        accent-color: var(--krt-editor-accent, #3b82f6);
        cursor: pointer;
    }

    .nav-plugin__cardBody {
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .nav-plugin__checkbox {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.8125rem;
        color: var(--krt-editor-text-primary, #0f172a);
        cursor: pointer;
    }

    .nav-plugin__checkbox input[type="checkbox"] {
        width: 0.875rem;
        height: 0.875rem;
        accent-color: var(--krt-editor-accent, #3b82f6);
        cursor: pointer;
    }

    .nav-plugin__menuWidget {
        margin-top: 0.25rem;
    }
</style>
