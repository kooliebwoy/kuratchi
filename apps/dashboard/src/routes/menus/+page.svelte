<script lang="ts">
    import { Button, Loading, Card, Badge, Dialog, FormField } from '@kuratchi/ui';
    import { getMenus, createMenu, deleteMenu, getMenuSites, attachMenuToSite, detachMenuFromSite } from '$lib/functions/navigation.remote';
    import { getSites } from '$lib/functions/sites.remote';
    import { Plus, Trash2, Edit, Link, Unlink, Menu, X, GripVertical, ChevronRight, ExternalLink } from '@lucide/svelte';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';

    interface NavigationItem {
        id: string;
        label: string;
        url: string;
        target?: '_self' | '_blank';
        icon?: string;
        children?: NavigationItem[];
    }

    interface AttachedSite {
        siteId: string;
        siteName: string;
        subdomain: string;
        region: string;
    }

    interface Menu {
        id: string;
        name: string;
        description: string | null;
        items: NavigationItem[];
        status: boolean;
        created_at: string;
        attachedSites: AttachedSite[];
    }

    interface Site {
        id: string;
        name: string;
        subdomain: string;
        region?: 'header' | 'footer';
    }

    // State
    let menus = $state<Menu[]>([]);
    let sites = $state<Site[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);
    let successMessage = $state<string | null>(null);

    // Modals
    let showCreateModal = $state(false);
    let showAttachModal = $state(false);
    let showDeleteModal = $state(false);
    let selectedMenuForAttach = $state<Menu | null>(null);
    let selectedMenuForDelete = $state<Menu | null>(null);
    let attachedSites = $state<Site[]>([]);
    let loadingAttachedSites = $state(false);

    // New menu data
    let newMenuName = $state('');
    let saving = $state(false);

    // Attach modal state
    let selectedSiteId = $state('');
    let selectedRegion = $state<'header' | 'footer'>('header');

    // Load data on mount
    onMount(() => {
        loadData();
    });

    async function loadData() {
        loading = true;
        error = null;
        try {
            const sitesResult = await getSites();
            sites = sitesResult || [];
            
            try {
                const menusResult = await getMenus();
                menus = menusResult || [];
            } catch (menusErr: any) {
                console.error('Failed to load menus:', menusErr);
                menus = [];
                if (menusErr?.message?.includes('no such table') || menusErr?.status === 500) {
                    console.log('Menus table may not exist yet - showing empty state');
                } else {
                    throw menusErr;
                }
            }
        } catch (err: any) {
            console.error('Failed to load data:', err);
            error = err?.body?.message || err?.message || 'Failed to load data';
        } finally {
            loading = false;
        }
    }

    async function handleCreateMenu() {
        if (!newMenuName.trim()) return;

        saving = true;
        error = null;
        try {
            await createMenu({
                name: newMenuName,
                description: '',
                items: [
                    {
                        id: crypto.randomUUID(),
                        label: 'Home',
                        url: '/',
                        target: '_self'
                    },
                    {
                        id: crypto.randomUUID(),
                        label: 'About',
                        url: '/about',
                        target: '_self'
                    },
                    {
                        id: crypto.randomUUID(),
                        label: 'Contact',
                        url: '/contact',
                        target: '_self'
                    }
                ]
            });

            successMessage = 'Menu created successfully!';
            setTimeout(() => successMessage = null, 3000);
            
            showCreateModal = false;
            newMenuName = '';
            await loadData();
        } catch (err: any) {
            console.error('Failed to create menu:', err);
            error = err?.body?.message || err?.message || 'Failed to create menu';
        } finally {
            saving = false;
        }
    }

    async function handleDeleteMenu() {
        if (!selectedMenuForDelete) return;

        saving = true;
        error = null;
        try {
            await deleteMenu({ id: selectedMenuForDelete.id });
            successMessage = 'Menu deleted successfully!';
            setTimeout(() => successMessage = null, 3000);
            
            showDeleteModal = false;
            selectedMenuForDelete = null;
            await loadData();
        } catch (err: any) {
            console.error('Failed to delete menu:', err);
            error = err?.body?.message || err?.message || 'Failed to delete menu';
        } finally {
            saving = false;
        }
    }

    async function openAttachModal(menu: Menu) {
        selectedMenuForAttach = menu;
        loadingAttachedSites = true;
        showAttachModal = true;
        
        try {
            const result = await getMenuSites();
            attachedSites = result || [];
        } catch (err) {
            console.error('Failed to load attached sites:', err);
            attachedSites = [];
        } finally {
            loadingAttachedSites = false;
        }
    }

    async function handleAttachMenu() {
        if (!selectedMenuForAttach || !selectedSiteId) return;

        saving = true;
        error = null;
        try {
            await attachMenuToSite({
                menuId: selectedMenuForAttach.id,
                siteId: selectedSiteId,
                region: selectedRegion
            });

            successMessage = `Menu attached to site (${selectedRegion})!`;
            setTimeout(() => successMessage = null, 3000);
            
            // Refresh attached sites
            const result = await getMenuSites();
            attachedSites = result || [];
            selectedSiteId = '';
        } catch (err: any) {
            console.error('Failed to attach menu:', err);
            error = err?.body?.message || err?.message || 'Failed to attach menu';
        } finally {
            saving = false;
        }
    }

    async function handleDetachMenu(site: Site) {
        if (!selectedMenuForAttach) return;

        saving = true;
        error = null;
        try {
            await detachMenuFromSite({
                menuId: selectedMenuForAttach.id,
                siteId: site.id,
                region: site.region || 'header'
            });

            successMessage = 'Menu detached from site!';
            setTimeout(() => successMessage = null, 3000);
            
            // Refresh attached sites
            const result = await getMenuSites();
            attachedSites = result || [];
        } catch (err: any) {
            console.error('Failed to detach menu:', err);
            error = err?.body?.message || err?.message || 'Failed to detach menu';
        } finally {
            saving = false;
        }
    }

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function countItems(items: NavigationItem[]): number {
        let count = items.length;
        for (const item of items) {
            if (item.children) {
                count += countItems(item.children);
            }
        }
        return count;
    }
</script>

<svelte:head>
    <title>Navigation Menus | Kuratchi</title>
</svelte:head>

<div class="page">
    <header class="page__header">
        <div class="page__headerContent">
            <h1 class="page__title">Navigation Menus</h1>
            <p class="page__description">Create and manage navigation menus for your sites. Menus can be shared across multiple sites.</p>
        </div>
        <Button variant="primary" onclick={() => showCreateModal = true}>
            <Plus size={16} />
            Create Menu
        </Button>
    </header>

    {#if error}
        <div class="alert alert--error">
            <span>{error}</span>
            <button class="alert__close" onclick={() => error = null}>
                <X size={16} />
            </button>
        </div>
    {/if}

    {#if successMessage}
        <div class="alert alert--success">
            <span>{successMessage}</span>
        </div>
    {/if}

    {#if loading}
        <div class="loading-state">
            <Loading />
            <p>Loading menus...</p>
        </div>
    {:else if menus.length === 0}
        <div class="empty-state">
            <Menu size={48} strokeWidth={1.5} />
            <h2>No menus yet</h2>
            <p>Create your first navigation menu to get started.</p>
            <Button variant="primary" onclick={() => showCreateModal = true}>
                <Plus size={16} />
                Create Menu
            </Button>
        </div>
    {:else}
        <div class="menu-grid">
            {#each menus as menu}
                <Card class="menu-card">
                    <div class="menu-card__header">
                        <div class="menu-card__icon">
                            <Menu size={20} />
                        </div>
                        <div class="menu-card__info">
                            <h3 class="menu-card__name">{menu.name}</h3>
                            <p class="menu-card__meta">
                                {countItems(menu.items)} items · Created {formatDate(menu.created_at)}
                            </p>
                        </div>
                        <Badge variant={menu.status ? 'success' : 'neutral'}>
                            {menu.status ? 'Active' : 'Inactive'}
                        </Badge>
                    </div>

                    <!-- Attached Sites -->
                    {#if menu.attachedSites && menu.attachedSites.length > 0}
                        <div class="menu-card__sites">
                            {#each menu.attachedSites as site}
                                <div class="site-tag">
                                    <span class="site-tag__name">{site.siteName}</span>
                                    <Badge variant="neutral" size="sm">{site.region}</Badge>
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <div class="menu-card__no-sites">
                            <span>Not attached to any site</span>
                        </div>
                    {/if}

                    {#if menu.items.length > 0}
                        <div class="menu-card__preview">
                            {#each menu.items.slice(0, 5) as item}
                                <div class="menu-preview-item">
                                    <ChevronRight size={14} />
                                    <span>{item.label}</span>
                                    {#if item.children && item.children.length > 0}
                                        <Badge variant="neutral" size="sm">+{item.children.length}</Badge>
                                    {/if}
                                </div>
                            {/each}
                            {#if menu.items.length > 5}
                                <div class="menu-preview-more">
                                    +{menu.items.length - 5} more items
                                </div>
                            {/if}
                        </div>
                    {/if}

                    <div class="menu-card__actions">
                        <Button variant="ghost" size="sm" onclick={() => goto(`/menus/${menu.id}`)}>
                            <Edit size={14} />
                            Edit
                        </Button>
                        <Button variant="ghost" size="sm" onclick={() => openAttachModal(menu)}>
                            <Link size={14} />
                            Sites
                        </Button>
                        <Button variant="ghost" size="sm" onclick={() => { selectedMenuForDelete = menu; showDeleteModal = true; }}>
                            <Trash2 size={14} />
                            Delete
                        </Button>
                    </div>
                </Card>
            {/each}
        </div>
    {/if}
</div>

<!-- Create Menu Modal -->
<Dialog bind:open={showCreateModal} size="md">
    {#snippet header()}
        <div class="kui-modal-header">
            <h3>Create Navigation Menu</h3>
            <Button variant="ghost" size="xs" onclick={() => showCreateModal = false}>
                <X size={16} />
            </Button>
        </div>
    {/snippet}
    {#snippet children()}
        <div class="kui-stack">
            <FormField label="Menu Name">
                <input
                    type="text"
                    bind:value={newMenuName}
                    placeholder="e.g., Main Navigation"
                    class="kui-input"
                    onkeydown={(e) => e.key === 'Enter' && handleCreateMenu()}
                />
                <span class="kui-subtext">A default menu with Home, About, and Contact links will be created.</span>
            </FormField>
            <div class="kui-modal-actions">
                <Button variant="ghost" onclick={() => showCreateModal = false}>Cancel</Button>
                <Button onclick={handleCreateMenu} disabled={saving || !newMenuName.trim()}>
                    {saving ? 'Creating...' : 'Create Menu'}
                </Button>
            </div>
        </div>
    {/snippet}
</Dialog>

<!-- Attach to Sites Modal -->
<Dialog bind:open={showAttachModal} size="lg" onClose={() => { showAttachModal = false; selectedMenuForAttach = null; }}>
    {#snippet header()}
        <div class="kui-modal-header">
            <h3>Manage Sites - {selectedMenuForAttach?.name || 'Menu'}</h3>
            <Button variant="ghost" size="xs" onclick={() => { showAttachModal = false; selectedMenuForAttach = null; }}>
                <X size={16} />
            </Button>
        </div>
    {/snippet}
    {#snippet children()}
        <div class="kui-stack">
            <div class="attach-section">
                <h4>Attach to Site</h4>
                <div class="attach-form">
                    <select bind:value={selectedSiteId} class="kui-select">
                        <option value="">Select a site...</option>
                        {#each sites as site}
                            <option value={site.id}>{site.name} ({site.subdomain})</option>
                        {/each}
                    </select>
                    <select bind:value={selectedRegion} class="kui-select">
                        <option value="header">Header</option>
                        <option value="footer">Footer</option>
                    </select>
                    <Button onclick={handleAttachMenu} disabled={saving || !selectedSiteId}>
                        <Link size={14} />
                        Attach
                    </Button>
                </div>
            </div>

            <div class="attached-section">
                <h4>Currently Attached Sites</h4>
                {#if loadingAttachedSites}
                    <div class="loading-inline">
                        <Loading />
                        <span>Loading...</span>
                    </div>
                {:else if attachedSites.length === 0}
                    <p class="kui-subtext">This menu is not attached to any sites yet.</p>
                {:else}
                    <div class="attached-list">
                        {#each attachedSites as site}
                            <div class="attached-item">
                                <div class="attached-item__info">
                                    <span class="attached-item__name">{site.name}</span>
                                    <Badge variant="neutral" size="sm">{site.region || 'header'}</Badge>
                                </div>
                                <Button variant="ghost" size="sm" onclick={() => handleDetachMenu(site)}>
                                    <Unlink size={14} />
                                    Detach
                                </Button>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
            <div class="kui-modal-actions">
                <Button onclick={() => { showAttachModal = false; selectedMenuForAttach = null; }}>Done</Button>
            </div>
        </div>
    {/snippet}
</Dialog>

<!-- Delete Confirmation Modal -->
<Dialog bind:open={showDeleteModal} size="sm" onClose={() => { showDeleteModal = false; selectedMenuForDelete = null; }}>
    {#snippet header()}
        <div class="kui-modal-header">
            <h3>Delete Menu</h3>
            <Button variant="ghost" size="xs" onclick={() => { showDeleteModal = false; selectedMenuForDelete = null; }}>
                <X size={16} />
            </Button>
        </div>
    {/snippet}
    {#snippet children()}
        <div class="kui-stack">
            <p>Are you sure you want to delete <strong>{selectedMenuForDelete?.name}</strong>?</p>
            <p class="kui-subtext kui-text-danger">This action cannot be undone. All site attachments will also be removed.</p>
            <div class="kui-modal-actions">
                <Button variant="ghost" onclick={() => { showDeleteModal = false; selectedMenuForDelete = null; }}>Cancel</Button>
                <Button variant="destructive" onclick={handleDeleteMenu} disabled={saving}>
                    {saving ? 'Deleting...' : 'Delete Menu'}
                </Button>
            </div>
        </div>
    {/snippet}
</Dialog>

<style>
    .page {
        padding: 2rem;
        max-width: 1200px;
        margin: 0 auto;
    }

    .page__header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 2rem;
        gap: 1rem;
    }

    .page__title {
        font-size: 1.75rem;
        font-weight: 600;
        color: var(--color-text-primary, #0f172a);
        margin: 0 0 0.25rem 0;
    }

    .page__description {
        color: var(--color-text-secondary, #64748b);
        margin: 0;
    }

    .alert {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
        margin-bottom: 1.5rem;
    }

    .alert--error {
        background: #fef2f2;
        color: #dc2626;
        border: 1px solid #fecaca;
    }

    .alert--success {
        background: #f0fdf4;
        color: #16a34a;
        border: 1px solid #bbf7d0;
    }

    .alert__close {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.25rem;
        color: inherit;
        opacity: 0.7;
    }

    .alert__close:hover {
        opacity: 1;
    }

    .loading-state,
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem 2rem;
        text-align: center;
        color: var(--color-text-secondary, #64748b);
    }

    .empty-state h2 {
        margin: 1rem 0 0.5rem;
        color: var(--color-text-primary, #0f172a);
    }

    .empty-state p {
        margin: 0 0 1.5rem;
    }

    .menu-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
        gap: 1.5rem;
    }

    :global(.menu-card) {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .menu-card__header {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
    }

    .menu-card__icon {
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 0.5rem;
        background: var(--color-surface, #f8fafc);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-text-secondary, #64748b);
        flex-shrink: 0;
    }

    .menu-card__info {
        flex: 1;
        min-width: 0;
    }

    .menu-card__name {
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-text-primary, #0f172a);
        margin: 0;
    }

    .menu-card__meta {
        font-size: 0.8125rem;
        color: var(--color-text-secondary, #64748b);
        margin: 0.25rem 0 0;
    }

    .menu-card__preview {
        background: var(--color-surface, #f8fafc);
        border-radius: 0.5rem;
        padding: 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
    }

    .menu-preview-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.8125rem;
        color: var(--color-text-primary, #0f172a);
    }

    .menu-preview-item :global(svg) {
        color: var(--color-text-secondary, #64748b);
    }

    .menu-preview-more {
        font-size: 0.75rem;
        color: var(--color-text-secondary, #64748b);
        padding-left: 1.25rem;
    }

    .menu-card__sites {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .site-tag {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.375rem 0.625rem;
        background: var(--color-primary-light, #eff6ff);
        border-radius: 0.375rem;
        font-size: 0.8125rem;
    }

    .site-tag__name {
        color: var(--color-primary, #3b82f6);
        font-weight: 500;
    }

    .menu-card__no-sites {
        font-size: 0.8125rem;
        color: var(--color-text-tertiary, #94a3b8);
        font-style: italic;
    }

    .menu-card__actions {
        display: flex;
        gap: 0.5rem;
        padding-top: 0.5rem;
        border-top: 1px solid var(--color-border, #e2e8f0);
    }

    /* Attach section styles */
    .attach-section,
    .attached-section {
        margin-bottom: 1.5rem;
    }

    .attach-section h4,
    .attached-section h4 {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--color-text-primary, #0f172a);
        margin: 0 0 0.75rem;
    }

    .attach-form {
        display: flex;
        gap: 0.75rem;
    }

    .attach-form :global(.kui-select) {
        flex: 1;
    }

    .attach-form :global(.kui-select:last-of-type) {
        flex: 0 0 120px;
    }

    .loading-inline {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--color-text-secondary, #64748b);
        font-size: 0.875rem;
    }

    .attached-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .attached-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem;
        background: var(--color-surface, #f8fafc);
        border-radius: 0.5rem;
    }

    .attached-item__info {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .attached-item__name {
        font-size: 0.875rem;
        font-weight: 500;
    }
</style>
