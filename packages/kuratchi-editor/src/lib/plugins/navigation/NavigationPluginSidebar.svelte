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
    .nav-plugin { display: flex; flex-direction: column; gap: 16px; }
    .nav-plugin__card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
    .nav-plugin__cardHeader { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
    .nav-plugin__cardTitle { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: #374151; }
    .nav-plugin__cardTitle :global(svg) { width: 16px; height: 16px; color: #6b7280; }
    .nav-plugin__toggle { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #6b7280; cursor: pointer; }
    .nav-plugin__toggle input[type="checkbox"] { width: 14px; height: 14px; accent-color: #3b82f6; }
    .nav-plugin__cardBody { padding: 14px; display: flex; flex-direction: column; gap: 12px; }
    .nav-plugin__checkbox { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #4b5563; cursor: pointer; }
    .nav-plugin__checkbox input[type="checkbox"] { width: 14px; height: 14px; accent-color: #3b82f6; }
    .nav-plugin__menuWidget { margin-top: 4px; }
</style>
