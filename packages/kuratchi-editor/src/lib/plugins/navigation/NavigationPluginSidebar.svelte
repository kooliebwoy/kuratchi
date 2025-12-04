<script lang="ts">
	import type { PluginContext, NavigationExtension, NavMenuItem } from '../context';
	import { EXT } from '../context';
	import {
		ChevronRight,
		ChevronDown,
		Plus,
		GripVertical,
		ExternalLink,
		FileText,
		Pencil,
		Copy,
		Trash2,
		X,
		PanelTop,
		PanelBottom,
		Menu
	} from '@lucide/svelte';

	let { ctx }: { ctx: PluginContext } = $props();

	const extension = $derived(ctx.ext<NavigationExtension>(EXT.NAVIGATION)!);

	// State
	let activeRegion: 'header' | 'footer' = $state('header');
	let expandedItems: Set<string> = $state(new Set());
	let showEditModal = $state(false);
	let editingItem: NavMenuItem | null = $state(null);
	let editingRegion: 'header' | 'footer' | null = $state(null);
	let editingParentId: string | null = $state(null);
	let isCreatingNew = $state(false);

	// Modal form state
	let formLabel = $state('');
	let formUrl = $state('');
	let formPageId = $state('');
	let formIsExternal = $state(false);
	let formTitle = $state('');
	let formAriaLabel = $state('');
	let formRel = $state('');
	let formTarget: '_self' | '_blank' | '_parent' | '_top' = $state('_self');

	// Drag state
	let draggedItem: NavMenuItem | null = $state(null);
	let draggedFromRegion: 'header' | 'footer' | null = $state(null);
	let draggedFromParentId: string | null = $state(null);
	let dropTargetId: string | null = $state(null);
	let dropPosition: 'before' | 'after' | 'inside' | null = $state(null);

	// Derived
	let currentItems = $derived(
		activeRegion === 'header' ? extension?.state.header.items : extension?.state.footer.items
	);

	// Pages for dropdown
	let availablePages = $derived(ctx.pages ?? []);

	// Generate unique ID
	function generateId(): string {
		return `nav-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	// Toggle item expansion
	function toggleExpand(id: string) {
		const newSet = new Set(expandedItems);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		expandedItems = newSet;
	}

	// Open modal for new item
	function openNewItemModal(parentId: string | null = null) {
		isCreatingNew = true;
		editingItem = null;
		editingRegion = activeRegion;
		editingParentId = parentId;
		formLabel = '';
		formUrl = '';
		formPageId = '';
		formIsExternal = false;
		formTitle = '';
		formAriaLabel = '';
		formRel = '';
		formTarget = '_self';
		showEditModal = true;
	}

	// Open modal for editing existing item
	function openEditModal(item: NavMenuItem, region: 'header' | 'footer', parentId: string | null) {
		isCreatingNew = false;
		editingItem = item;
		editingRegion = region;
		editingParentId = parentId;
		formLabel = item.label;
		formUrl = item.url;
		formPageId = item.pageId ?? '';
		formIsExternal = item.isExternal ?? false;
		formTitle = item.title ?? '';
		formAriaLabel = item.ariaLabel ?? '';
		formRel = item.rel ?? '';
		formTarget = item.target ?? '_self';
		showEditModal = true;
	}

	// Close modal
	function closeModal() {
		showEditModal = false;
		editingItem = null;
		editingRegion = null;
		editingParentId = null;
		isCreatingNew = false;
	}

	// Save item from modal
	function saveItem() {
		if (!formLabel.trim()) return;

		const newItem: NavMenuItem = {
			id: isCreatingNew ? generateId() : editingItem!.id,
			label: formLabel.trim(),
			url: formIsExternal ? formUrl.trim() : formUrl.trim() || `/${formLabel.toLowerCase().replace(/\s+/g, '-')}`,
			pageId: formIsExternal ? undefined : formPageId || undefined,
			isExternal: formIsExternal,
			title: formTitle.trim() || undefined,
			ariaLabel: formAriaLabel.trim() || undefined,
			rel: formRel.trim() || undefined,
			target: formTarget,
			openInNewTab: formTarget === '_blank',
			children: isCreatingNew ? [] : editingItem?.children ?? []
		};

		if (isCreatingNew) {
			addItemToRegion(newItem, editingRegion!, editingParentId);
		} else {
			updateItemInRegion(newItem, editingRegion!, editingParentId);
		}

		closeModal();
	}

	// Add item to region
	function addItemToRegion(item: NavMenuItem, region: 'header' | 'footer', parentId: string | null) {
		if (!extension) return;
		const currentItems = region === 'header' ? extension.state.header.items : extension.state.footer.items;
		
		let newItems: NavMenuItem[];
		if (parentId === null) {
			newItems = [...currentItems, item];
		} else {
			newItems = addItemToParent(currentItems, parentId, item);
		}
		
		// Use extension methods to save
		if (region === 'header') {
			extension.updateHeaderMenu(newItems);
		} else {
			extension.updateFooterMenu(newItems);
		}
	}

	// Helper to add item to nested parent
	function addItemToParent(items: NavMenuItem[], parentId: string, newItem: NavMenuItem): NavMenuItem[] {
		return items.map(item => {
			if (item.id === parentId) {
				return {
					...item,
					children: [...(item.children ?? []), newItem]
				};
			}
			if (item.children?.length) {
				return {
					...item,
					children: addItemToParent(item.children, parentId, newItem)
				};
			}
			return item;
		});
	}

	// Update item in region
	function updateItemInRegion(updatedItem: NavMenuItem, region: 'header' | 'footer', parentId: string | null) {
		if (!extension) return;
		const currentItems = region === 'header' ? extension.state.header.items : extension.state.footer.items;
		const newItems = updateItemInTree(currentItems, updatedItem);
		
		// Use extension methods to save
		if (region === 'header') {
			extension.updateHeaderMenu(newItems);
		} else {
			extension.updateFooterMenu(newItems);
		}
	}

	// Helper to update item in tree
	function updateItemInTree(items: NavMenuItem[], updatedItem: NavMenuItem): NavMenuItem[] {
		return items.map(item => {
			if (item.id === updatedItem.id) {
				return updatedItem;
			}
			if (item.children?.length) {
				return {
					...item,
					children: updateItemInTree(item.children, updatedItem)
				};
			}
			return item;
		});
	}

	// Duplicate item
	function duplicateItem(item: NavMenuItem, region: 'header' | 'footer', parentId: string | null) {
		const duplicated = duplicateItemRecursive(item);
		duplicated.label = `${duplicated.label} (Copy)`;
		addItemToRegion(duplicated, region, parentId);
	}

	// Helper to duplicate item with new IDs
	function duplicateItemRecursive(item: NavMenuItem): NavMenuItem {
		return {
			...item,
			id: generateId(),
			children: item.children?.map((child: NavMenuItem) => duplicateItemRecursive(child))
		};
	}

	// Delete item
	function deleteItem(itemId: string, region: 'header' | 'footer') {
		if (!extension) return;
		const currentItems = region === 'header' ? extension.state.header.items : extension.state.footer.items;
		const newItems = removeItemFromTree(currentItems, itemId);
		
		// Use extension methods to save
		if (region === 'header') {
			extension.updateHeaderMenu(newItems);
		} else {
			extension.updateFooterMenu(newItems);
		}
	}

	// Helper to remove item from tree
	function removeItemFromTree(items: NavMenuItem[], itemId: string): NavMenuItem[] {
		return items
			.filter(item => item.id !== itemId)
			.map(item => ({
				...item,
				children: item.children ? removeItemFromTree(item.children, itemId) : undefined
			}));
	}

	// Drag and Drop handlers
	function handleDragStart(e: DragEvent, item: NavMenuItem, region: 'header' | 'footer', parentId: string | null) {
		draggedItem = item;
		draggedFromRegion = region;
		draggedFromParentId = parentId;
		
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', item.id);
		}
	}

	function handleDragOver(e: DragEvent, targetId: string, position: 'before' | 'after' | 'inside') {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		dropTargetId = targetId;
		dropPosition = position;
	}

	function handleDragLeave() {
		dropTargetId = null;
		dropPosition = null;
	}

	function handleDrop(e: DragEvent, targetId: string, position: 'before' | 'after' | 'inside', region: 'header' | 'footer') {
		e.preventDefault();
		
		if (!draggedItem || draggedItem.id === targetId || !extension) {
			resetDragState();
			return;
		}

		// Get current items
		const currentItems = region === 'header' ? extension.state.header.items : extension.state.footer.items;
		
		// Remove from original position
		let items = removeItemFromTree(currentItems, draggedItem.id);
		
		// Insert at new position
		if (position === 'inside') {
			items = insertItemInside(items, targetId, draggedItem);
		} else {
			items = insertItemAdjacent(items, targetId, draggedItem, position);
		}
		
		// Use extension methods to save
		if (region === 'header') {
			extension.updateHeaderMenu(items);
		} else {
			extension.updateFooterMenu(items);
		}
		
		resetDragState();
	}

	function handleDragEnd() {
		resetDragState();
	}

	function resetDragState() {
		draggedItem = null;
		draggedFromRegion = null;
		draggedFromParentId = null;
		dropTargetId = null;
		dropPosition = null;
	}

	// Helper to insert item inside target (as child)
	function insertItemInside(items: NavMenuItem[], targetId: string, newItem: NavMenuItem): NavMenuItem[] {
		return items.map(item => {
			if (item.id === targetId) {
				return {
					...item,
					children: [...(item.children ?? []), newItem]
				};
			}
			if (item.children?.length) {
				return {
					...item,
					children: insertItemInside(item.children, targetId, newItem)
				};
			}
			return item;
		});
	}

	// Helper to insert item adjacent to target
	function insertItemAdjacent(items: NavMenuItem[], targetId: string, newItem: NavMenuItem, position: 'before' | 'after'): NavMenuItem[] {
		const result: NavMenuItem[] = [];
		
		for (const item of items) {
			if (item.id === targetId) {
				if (position === 'before') {
					result.push(newItem, item);
				} else {
					result.push(item, newItem);
				}
			} else {
				const processedItem = {
					...item,
					children: item.children?.length 
						? insertItemAdjacent(item.children, targetId, newItem, position) 
						: item.children
				};
				result.push(processedItem);
			}
		}
		
		// If targetId wasn't found at this level, return original (it was inserted in children)
		if (!items.find(i => i.id === targetId)) {
			return items.map(item => ({
				...item,
				children: item.children?.length 
					? insertItemAdjacent(item.children, targetId, newItem, position)
					: item.children
			}));
		}
		
		return result;
	}

	// Handle page selection change
	function handlePageChange(e: Event) {
		const select = e.target as HTMLSelectElement;
		formPageId = select.value;
		if (formPageId) {
			const page = availablePages.find((p) => p.id === formPageId);
			if (page) {
				formUrl = `/${page.slug}`;
				if (!formLabel) {
					formLabel = page.name;
				}
			}
		}
	}
</script>

{#if !extension}
	<div class="nav-plugin-sidebar">
		<div class="empty-state">
			<Menu size={24} />
			<p>Navigation not available</p>
			<span>Navigation extension is not loaded</span>
		</div>
	</div>
{:else}
<div class="nav-plugin-sidebar">
	<!-- Region Tabs -->
	<div class="region-tabs">
		<button
			type="button"
			class="region-tab"
			class:active={activeRegion === 'header'}
			onclick={() => (activeRegion = 'header')}
		>
			<PanelTop size={14} />
			Header
		</button>
		<button
			type="button"
			class="region-tab"
			class:active={activeRegion === 'footer'}
			onclick={() => (activeRegion = 'footer')}
		>
			<PanelBottom size={14} />
			Footer
		</button>
	</div>

	<!-- Add Link Button -->
	<div class="add-link-container">
		<button type="button" class="add-link-btn" onclick={() => openNewItemModal(null)}>
			<Plus size={14} />
			Add Link
		</button>
	</div>

	<!-- Tree View -->
	<div class="tree-container">
		{#if currentItems.length === 0}
			<div class="empty-state">
				<Menu size={24} />
				<p>No navigation items yet</p>
				<span>Click "Add Link" to create your first item</span>
			</div>
		{:else}
			<ul class="tree-list" role="tree">
				{#each currentItems as item, index (item.id)}
					{@render treeItem(item, activeRegion, null, 0)}
				{/each}
			</ul>
		{/if}
	</div>
</div>
{/if}

{#snippet treeItem(item: NavMenuItem, region: 'header' | 'footer', parentId: string | null, depth: number)}
	<li
		class="tree-item"
		class:dragging={draggedItem?.id === item.id}
		class:drop-before={dropTargetId === item.id && dropPosition === 'before'}
		class:drop-after={dropTargetId === item.id && dropPosition === 'after'}
		class:drop-inside={dropTargetId === item.id && dropPosition === 'inside'}
		style="--depth: {depth}"
		role="treeitem"
		aria-selected="false"
		aria-expanded={item.children?.length ? expandedItems.has(item.id) : undefined}
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="drop-zone drop-zone-before"
			ondragover={(e) => handleDragOver(e, item.id, 'before')}
			ondragleave={handleDragLeave}
			ondrop={(e) => handleDrop(e, item.id, 'before', region)}
		></div>

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="tree-item-content"
			draggable="true"
			ondragstart={(e) => handleDragStart(e, item, region, parentId)}
			ondragend={handleDragEnd}
		>
			<span class="drag-handle">
				<GripVertical size={12} />
			</span>

			{#if item.children?.length}
				<button
					type="button"
					class="expand-btn"
					onclick={() => toggleExpand(item.id)}
					aria-label={expandedItems.has(item.id) ? 'Collapse' : 'Expand'}
				>
					{#if expandedItems.has(item.id)}
						<ChevronDown size={12} />
					{:else}
						<ChevronRight size={12} />
					{/if}
				</button>
			{:else}
				<span class="expand-spacer"></span>
			{/if}

			<span class="item-icon">
				{#if item.isExternal}
					<ExternalLink size={12} />
				{:else}
					<FileText size={12} />
				{/if}
			</span>

			<span class="item-label" title={item.url}>{item.label}</span>

			<div class="item-actions">
				<button
					type="button"
					class="action-btn"
					onclick={() => openNewItemModal(item.id)}
					title="Add child link"
				>
					<Plus size={12} />
				</button>
				<button
					type="button"
					class="action-btn"
					onclick={() => openEditModal(item, region, parentId)}
					title="Edit link"
				>
					<Pencil size={12} />
				</button>
				<button
					type="button"
					class="action-btn"
					onclick={() => duplicateItem(item, region, parentId)}
					title="Duplicate link"
				>
					<Copy size={12} />
				</button>
				<button
					type="button"
					class="action-btn action-btn-danger"
					onclick={() => deleteItem(item.id, region)}
					title="Delete link"
				>
					<Trash2 size={12} />
				</button>
			</div>
		</div>

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="drop-zone drop-zone-inside"
			ondragover={(e) => handleDragOver(e, item.id, 'inside')}
			ondragleave={handleDragLeave}
			ondrop={(e) => handleDrop(e, item.id, 'inside', region)}
		></div>

		<!-- Children -->
		{#if item.children?.length && expandedItems.has(item.id)}
			<ul class="tree-list tree-list-nested" role="group">
				{#each item.children as child (child.id)}
					{@render treeItem(child, region, item.id, depth + 1)}
				{/each}
			</ul>
		{/if}

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="drop-zone drop-zone-after"
			ondragover={(e) => handleDragOver(e, item.id, 'after')}
			ondragleave={handleDragLeave}
			ondrop={(e) => handleDrop(e, item.id, 'after', region)}
		></div>
	</li>
{/snippet}

<!-- Edit Modal -->
{#if showEditModal}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay" onclick={closeModal} onkeydown={(e) => e.key === 'Escape' && closeModal()} role="presentation">
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && closeModal()} role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="0">
			<div class="modal-header">
				<h3 id="modal-title">{isCreatingNew ? 'Add New Link' : 'Edit Link'}</h3>
				<button type="button" class="modal-close" onclick={closeModal}>
					<X size={18} />
				</button>
			</div>

			<div class="modal-body">
				<!-- Link Type Toggle -->
				<div class="form-group">
					<span class="form-label">Link Type</span>
					<div class="toggle-group">
						<button
							type="button"
							class="toggle-btn"
							class:active={!formIsExternal}
							onclick={() => (formIsExternal = false)}
						>
							<FileText size={14} />
							Internal Page
						</button>
						<button
							type="button"
							class="toggle-btn"
							class:active={formIsExternal}
							onclick={() => (formIsExternal = true)}
						>
							<ExternalLink size={14} />
							External Link
						</button>
					</div>
				</div>

				<!-- Label -->
				<div class="form-group">
					<label class="form-label" for="nav-label">Label <span class="required">*</span></label>
					<input
						type="text"
						id="nav-label"
						class="form-input"
						bind:value={formLabel}
						placeholder="e.g., About Us"
						required
					/>
				</div>

				<!-- Page Select (Internal) or URL (External) -->
				{#if formIsExternal}
					<div class="form-group">
						<label class="form-label" for="nav-url">URL <span class="required">*</span></label>
						<input
							type="url"
							id="nav-url"
							class="form-input"
							bind:value={formUrl}
							placeholder="https://example.com"
							required
						/>
					</div>
				{:else}
					<div class="form-group">
						<label class="form-label" for="nav-page">Select Page</label>
						<select id="nav-page" class="form-input" value={formPageId} onchange={handlePageChange}>
							<option value="">-- Choose a page --</option>
							{#each availablePages as page}
								<option value={page.id}>
									{page.name} (/{page.slug})
								</option>
							{/each}
						</select>
					</div>
					<div class="form-group">
						<label class="form-label" for="nav-url-internal">URL Path</label>
						<input
							type="text"
							id="nav-url-internal"
							class="form-input"
							bind:value={formUrl}
							placeholder="/about"
						/>
					</div>
				{/if}

				<hr class="form-divider" />

				<h4 class="section-title">SEO & Accessibility</h4>

				<!-- Title Attribute -->
				<div class="form-group">
					<label class="form-label" for="nav-title">Title Attribute</label>
					<input
						type="text"
						id="nav-title"
						class="form-input"
						bind:value={formTitle}
						placeholder="Tooltip text on hover"
					/>
					<span class="form-hint">Shows as tooltip when hovering over the link</span>
				</div>

				<!-- Aria Label -->
				<div class="form-group">
					<label class="form-label" for="nav-aria">Aria Label</label>
					<input
						type="text"
						id="nav-aria"
						class="form-input"
						bind:value={formAriaLabel}
						placeholder="Descriptive label for screen readers"
					/>
					<span class="form-hint">Improves accessibility for screen reader users</span>
				</div>

				<!-- Target -->
				<div class="form-group">
					<label class="form-label" for="nav-target">Open In</label>
					<select id="nav-target" class="form-input" bind:value={formTarget}>
						<option value="_self">Same Window</option>
						<option value="_blank">New Tab</option>
					</select>
				</div>

				<!-- Rel Attribute -->
				<div class="form-group">
					<label class="form-label" for="nav-rel">Rel Attribute</label>
					<input
						type="text"
						id="nav-rel"
						class="form-input"
						bind:value={formRel}
						placeholder="e.g., noopener noreferrer nofollow"
					/>
					<span class="form-hint">Controls link relationship (e.g., nofollow for SEO)</span>
				</div>
			</div>

			<div class="modal-footer">
				<button type="button" class="btn btn-secondary" onclick={closeModal}>Cancel</button>
				<button type="button" class="btn btn-primary" onclick={saveItem} disabled={!formLabel.trim()}>
					{isCreatingNew ? 'Add Link' : 'Save Changes'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.nav-plugin-sidebar {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--krt-editor-bg);
	}

	/* Region Tabs */
	.region-tabs {
		display: flex;
		gap: 4px;
		padding: 12px;
		border-bottom: 1px solid var(--krt-editor-border);
	}

	.region-tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 8px 12px;
		background: transparent;
		border: 1px solid var(--krt-editor-border);
		border-radius: 6px;
		color: var(--krt-editor-text-muted);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.region-tab:hover {
		background: var(--krt-editor-surface);
		color: var(--krt-editor-text);
	}

	.region-tab.active {
		background: var(--krt-editor-accent);
		border-color: var(--krt-editor-accent);
		color: var(--krt-editor-accent-text);
	}

	/* Add Link Button */
	.add-link-container {
		padding: 12px;
	}

	.add-link-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		padding: 10px 16px;
		background: var(--krt-editor-accent);
		border: none;
		border-radius: 6px;
		color: var(--krt-editor-accent-text);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.add-link-btn:hover {
		opacity: 0.9;
	}

	/* Tree Container */
	.tree-container {
		flex: 1;
		overflow-y: auto;
		padding: 0 12px 12px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 32px 16px;
		color: var(--krt-editor-text-muted);
		text-align: center;
	}

	.empty-state p {
		margin: 12px 0 4px;
		font-size: 13px;
		font-weight: 500;
		color: var(--krt-editor-text);
	}

	.empty-state span {
		font-size: 12px;
	}

	/* Tree List */
	.tree-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.tree-list-nested {
		margin-left: 20px;
	}

	/* Tree Item */
	.tree-item {
		position: relative;
	}

	.tree-item-content {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 8px;
		margin: 2px 0;
		background: var(--krt-editor-surface);
		border: 1px solid var(--krt-editor-border);
		border-radius: 6px;
		cursor: grab;
		transition: all 0.15s ease;
	}

	.tree-item-content:hover {
		border-color: var(--krt-editor-border-hover, var(--krt-editor-accent));
	}

	.tree-item.dragging .tree-item-content {
		opacity: 0.5;
	}

	.tree-item.drop-before .tree-item-content {
		border-top: 2px solid var(--krt-editor-accent);
	}

	.tree-item.drop-after .tree-item-content {
		border-bottom: 2px solid var(--krt-editor-accent);
	}

	.tree-item.drop-inside .tree-item-content {
		background: color-mix(in srgb, var(--krt-editor-accent) 15%, transparent);
		border-color: var(--krt-editor-accent);
	}

	/* Drag Handle */
	.drag-handle {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2px;
		color: var(--krt-editor-text-muted);
		cursor: grab;
	}

	/* Expand Button */
	.expand-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--krt-editor-text-muted);
		cursor: pointer;
	}

	.expand-btn:hover {
		background: var(--krt-editor-border);
		color: var(--krt-editor-text);
	}

	.expand-spacer {
		width: 18px;
	}

	/* Item Icon */
	.item-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--krt-editor-text-muted);
	}

	/* Item Label */
	.item-label {
		flex: 1;
		font-size: 12px;
		font-weight: 500;
		color: var(--krt-editor-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Item Actions */
	.item-actions {
		display: flex;
		gap: 2px;
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.tree-item-content:hover .item-actions {
		opacity: 1;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--krt-editor-text-muted);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.action-btn:hover {
		background: var(--krt-editor-border);
		color: var(--krt-editor-text);
	}

	.action-btn-danger:hover {
		background: #fee2e2;
		color: #dc2626;
	}

	/* Drop Zones */
	.drop-zone {
		position: absolute;
		left: 0;
		right: 0;
		height: 8px;
		pointer-events: none;
	}

	.drop-zone-before {
		top: -4px;
	}

	.drop-zone-after {
		bottom: -4px;
	}

	.drop-zone-inside {
		display: none;
	}

	.tree-item:hover .drop-zone {
		pointer-events: auto;
	}

	/* Modal Overlay */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal {
		width: 100%;
		max-width: 520px;
		max-height: 90vh;
		background: var(--krt-editor-bg);
		border-radius: 12px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--krt-editor-border);
	}

	.modal-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--krt-editor-text);
	}

	.modal-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 6px;
		color: var(--krt-editor-text-muted);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.modal-close:hover {
		background: var(--krt-editor-surface);
		color: var(--krt-editor-text);
	}

	.modal-body {
		flex: 1;
		overflow-y: auto;
		padding: 20px;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding: 16px 20px;
		border-top: 1px solid var(--krt-editor-border);
	}

	/* Form Elements */
	.form-group {
		margin-bottom: 16px;
	}

	.form-label {
		display: block;
		margin-bottom: 6px;
		font-size: 12px;
		font-weight: 500;
		color: var(--krt-editor-text);
	}

	.required {
		color: #dc2626;
	}

	.form-input {
		width: 100%;
		padding: 10px 12px;
		background: var(--krt-editor-surface);
		border: 1px solid var(--krt-editor-border);
		border-radius: 6px;
		font-size: 13px;
		color: var(--krt-editor-text);
		transition: all 0.15s ease;
	}

	.form-input:focus {
		outline: none;
		border-color: var(--krt-editor-accent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--krt-editor-accent) 20%, transparent);
	}

	.form-input::placeholder {
		color: var(--krt-editor-text-muted);
	}

	.form-hint {
		display: block;
		margin-top: 4px;
		font-size: 11px;
		color: var(--krt-editor-text-muted);
	}

	.form-divider {
		border: none;
		border-top: 1px solid var(--krt-editor-border);
		margin: 20px 0;
	}

	.section-title {
		margin: 0 0 16px;
		font-size: 13px;
		font-weight: 600;
		color: var(--krt-editor-text);
	}

	/* Toggle Group */
	.toggle-group {
		display: flex;
		gap: 8px;
	}

	.toggle-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 10px 12px;
		background: var(--krt-editor-surface);
		border: 1px solid var(--krt-editor-border);
		border-radius: 6px;
		font-size: 12px;
		font-weight: 500;
		color: var(--krt-editor-text-muted);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.toggle-btn:hover {
		border-color: var(--krt-editor-accent);
		color: var(--krt-editor-text);
	}

	.toggle-btn.active {
		background: var(--krt-editor-accent);
		border-color: var(--krt-editor-accent);
		color: var(--krt-editor-accent-text);
	}

	/* Buttons */
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 10px 16px;
		border-radius: 6px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background: var(--krt-editor-accent);
		border: none;
		color: var(--krt-editor-accent-text);
	}

	.btn-primary:hover:not(:disabled) {
		opacity: 0.9;
	}

	.btn-secondary {
		background: transparent;
		border: 1px solid var(--krt-editor-border);
		color: var(--krt-editor-text);
	}

	.btn-secondary:hover:not(:disabled) {
		background: var(--krt-editor-surface);
	}
</style>
