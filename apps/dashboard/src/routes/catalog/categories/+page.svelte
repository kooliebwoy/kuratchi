<script lang="ts">
  import { Button, Card, Dialog, Badge, Loading } from '@kuratchi/ui';
  import { Plus, Pencil, Trash2, Tag } from '@lucide/svelte';
  import { getCategories, createCategory, updateCategory, deleteCategory, type CatalogCategory as Category } from '$lib/functions/catalog.remote';

  // Data
  const categoriesData = getCategories();
  const categories = $derived(categoriesData.current || []);
  const loading = $derived(categoriesData.loading);

  // State
  let showModal = $state(false);
  let showDeleteModal = $state(false);
  let editingCategory = $state<Category | null>(null);
  let submitting = $state(false);

  // Form state
  let categoryName = $state('');
  let categoryDescription = $state('');
  let categoryColor = $state('#6b7280');

  // Handlers
  function openModal(category?: Category) {
    if (category) {
      editingCategory = category;
      categoryName = category.name;
      categoryDescription = category.description || '';
      categoryColor = category.color;
    } else {
      editingCategory = null;
      categoryName = '';
      categoryDescription = '';
      categoryColor = '#6b7280';
    }
    showModal = true;
  }

  function openDeleteModal(category: Category) {
    editingCategory = category;
    showDeleteModal = true;
  }

  function closeModals() {
    showModal = false;
    showDeleteModal = false;
    editingCategory = null;
  }

  async function handleSave() {
    if (!categoryName.trim()) return;
    submitting = true;
    try {
      if (editingCategory) {
        await updateCategory({ id: editingCategory.id, name: categoryName, description: categoryDescription, color: categoryColor, icon: 'tag' });
      } else {
        await createCategory({ name: categoryName, description: categoryDescription, color: categoryColor, icon: 'tag' });
      }
      await categoriesData.refresh();
      closeModals();
    } catch (error) {
      console.error('Error saving category:', error);
    } finally {
      submitting = false;
    }
  }

  async function handleDelete() {
    if (!editingCategory) return;
    submitting = true;
    try {
      await deleteCategory({ id: editingCategory.id });
      await categoriesData.refresh();
      closeModals();
    } catch (error) {
      console.error('Error deleting category:', error);
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Categories - Catalog</title>
</svelte:head>

<div class="page">
  <!-- Header -->
  <div class="header">
    <div>
      <h2>Categories</h2>
      <p class="muted">Organize vehicles by type</p>
    </div>
    <Button variant="secondary" size="sm" onclick={() => openModal()}>
      <Plus size={14} />
      Add
    </Button>
  </div>

  <!-- Content -->
  {#if loading}
    <div class="center"><Loading size="sm" /></div>
  {:else if categories.length === 0}
    <div class="center">
      <p class="muted">No categories yet</p>
      <Button variant="secondary" size="sm" onclick={() => openModal()}>Create Category</Button>
    </div>
  {:else}
    <div class="list">
      {#each categories as category}
        <div class="item">
          <div class="item-left">
            <div class="color-dot" style="background: {category.color};"></div>
            <div>
              <span class="name">{category.name}</span>
              {#if category.description}
                <span class="desc">{category.description}</span>
              {/if}
            </div>
          </div>
          <div class="item-right">
            <span class="count">{category.vehicle_count}</span>
            <button class="icon-btn" onclick={() => openModal(category)}><Pencil size={14} /></button>
            <button class="icon-btn danger" onclick={() => openDeleteModal(category)}><Trash2 size={14} /></button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Add/Edit Modal -->
{#if showModal}
  <Dialog bind:open={showModal} size="sm" onClose={closeModals}>
    {#snippet header()}
      <h3>{editingCategory ? 'Edit' : 'Add'} Category</h3>
    {/snippet}
    {#snippet children()}
      <div class="form">
        <div class="field">
          <label for="name">Name</label>
          <input id="name" type="text" bind:value={categoryName} placeholder="e.g., ATV, UTV" />
        </div>
        <div class="field">
          <label for="desc">Description</label>
          <input id="desc" type="text" bind:value={categoryDescription} placeholder="Optional description" />
        </div>
        <div class="field">
          <label for="color">Color</label>
          <div class="color-row">
            <input id="color" type="color" bind:value={categoryColor} />
            <input type="text" bind:value={categoryColor} class="color-hex" />
          </div>
        </div>
      </div>
    {/snippet}
    {#snippet actions()}
      <div class="actions">
        <Button variant="ghost" size="sm" onclick={closeModals}>Cancel</Button>
        <Button variant="primary" size="sm" onclick={handleSave} disabled={submitting || !categoryName.trim()}>
          {submitting ? 'Saving...' : 'Save'}
        </Button>
      </div>
    {/snippet}
  </Dialog>
{/if}

<!-- Delete Modal -->
{#if showDeleteModal && editingCategory}
  <Dialog bind:open={showDeleteModal} size="sm" onClose={closeModals}>
    {#snippet header()}
      <h3>Delete Category</h3>
    {/snippet}
    {#snippet children()}
      <p>Delete <strong>{editingCategory.name}</strong>?</p>
      {#if editingCategory.vehicle_count > 0}
        <p class="warning">Has {editingCategory.vehicle_count} vehicles assigned.</p>
      {/if}
    {/snippet}
    {#snippet actions()}
      <div class="actions">
        <Button variant="ghost" size="sm" onclick={closeModals}>Cancel</Button>
        <Button variant="error" size="sm" onclick={handleDelete} disabled={submitting}>
          {submitting ? 'Deleting...' : 'Delete'}
        </Button>
      </div>
    {/snippet}
  </Dialog>
{/if}

<style>
  .page { padding: 1rem; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
  .header h2 { font-size: 1.125rem; font-weight: 600; margin: 0; }
  .muted { color: var(--kui-color-muted); font-size: 0.75rem; margin: 0.25rem 0 0; }
  .center { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding: 2rem; }

  .list { display: flex; flex-direction: column; gap: 0.5rem; }
  .item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--kui-color-surface); border: 1px solid var(--kui-color-border); border-radius: var(--kui-radius-md); }
  .item-left { display: flex; align-items: center; gap: 0.75rem; }
  .item-right { display: flex; align-items: center; gap: 0.5rem; }
  .color-dot { width: 0.75rem; height: 0.75rem; border-radius: 50%; flex-shrink: 0; }
  .name { font-size: 0.875rem; font-weight: 500; }
  .desc { display: block; font-size: 0.75rem; color: var(--kui-color-muted); }
  .count { font-size: 0.75rem; color: var(--kui-color-muted); padding: 0.125rem 0.5rem; background: var(--kui-color-surface-muted); border-radius: var(--kui-radius-sm); }

  .icon-btn { background: none; border: none; padding: 0.25rem; cursor: pointer; color: var(--kui-color-muted); border-radius: var(--kui-radius-sm); }
  .icon-btn:hover { background: var(--kui-color-surface-muted); color: var(--kui-color-text); }
  .icon-btn.danger:hover { color: var(--kui-color-error); }

  .form { display: flex; flex-direction: column; gap: 0.75rem; }
  .field { display: flex; flex-direction: column; gap: 0.25rem; }
  .field label { font-size: 0.75rem; font-weight: 500; color: var(--kui-color-muted); }
  .field input { padding: 0.5rem; border: 1px solid var(--kui-color-border); border-radius: var(--kui-radius-sm); font-size: 0.875rem; background: var(--kui-color-surface); color: var(--kui-color-text); }
  .field input:focus { outline: none; border-color: var(--kui-color-primary); }
  .color-row { display: flex; gap: 0.5rem; }
  .color-row input[type="color"] { width: 2rem; height: 2rem; border: 1px solid var(--kui-color-border); border-radius: var(--kui-radius-sm); cursor: pointer; }
  .color-hex { flex: 1; }

  .actions { display: flex; justify-content: flex-end; gap: 0.5rem; padding-top: 0.75rem; border-top: 1px solid var(--kui-color-border); }
  .warning { font-size: 0.75rem; color: var(--kui-color-warning); margin: 0.5rem 0 0; }
</style>
