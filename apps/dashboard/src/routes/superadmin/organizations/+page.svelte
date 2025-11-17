<script lang="ts">
	import { Building2, Plus, Pencil, Trash2, X } from 'lucide-svelte';
	import { Dialog, FormField, FormInput, FormSelect, FormTextarea } from '@kuratchi/ui';
	import { getOrganizations, createOrganization, updateOrganization, deleteOrganization } from '$lib/functions/organizations.remote';

	// Fetch organizations
	const organizations = getOrganizations();
	// Modal state
	let showModal = $state(false);
	let modalMode = $state<'create' | 'edit'>('create');
	let editingOrg = $state<any>(null);

	// Delete confirmation state
	let showDeleteDialog = $state(false);
	let deletingOrg = $state<any>(null);

	// Form state
	let formData = $state({
		organizationName: '',
		email: '',
		organizationSlug: '',
		notes: '',
		status: 'active' as 'active' | 'inactive' | 'lead'
	});

	// Reset form
	function resetForm() {
		formData = {
			organizationName: '',
			email: '',
			organizationSlug: '',
			notes: '',
			status: 'active'
		};
		editingOrg = null;
	}

	// Open create modal
	function openCreateModal() {
		resetForm();
		modalMode = 'create';
		showModal = true;
	}

	// Open edit modal
	function openEditModal(org: any) {
		editingOrg = org;
		formData = {
			organizationName: org.organizationName || '',
			email: org.email || '',
			organizationSlug: org.organizationSlug || '',
			notes: org.notes || '',
			status: org.status || 'active'
		};
		modalMode = 'edit';
		showModal = true;
	}

	// Auto-generate slug from name
	function generateSlug() {
		if (!formData.organizationSlug && formData.organizationName) {
			formData.organizationSlug = formData.organizationName
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '');
		}
	}

	// Handle submit  
	function handleFormSubmit(event: SubmitEvent) {
		// Form submission is handled by the remote form
		showModal = false;
		resetForm();
	}

	// Open delete confirmation
	function openDeleteDialog(org: any) {
		deletingOrg = org;
		showDeleteDialog = true;
	}

	// Close delete dialog
	function closeDeleteDialog() {
		showDeleteDialog = false;
		deletingOrg = null;
	}

	// Handle delete confirmation
	function handleDeleteConfirm() {
		showDeleteDialog = false;
		// The form submission will handle the actual deletion
	}

	// Status badge colors
	function getStatusColor(status: string) {
		switch (status) {
			case 'active': return 'badge-success';
			case 'inactive': return 'badge-error';
			case 'lead': return 'badge-warning';
			default: return 'badge-neutral';
		}
	}
</script>

<div class="flex justify-end mb-6">
	<button class="btn btn-primary" onclick={openCreateModal}>
		<Plus class="h-4 w-4" />
		New Organization
	</button>
</div>

	<!-- Organizations Table -->
	<div class="card bg-base-100 shadow-sm">
		<div class="overflow-x-auto">
			<table class="table">
				<thead>
					<tr>
						<th>Name</th>
						<th>Slug</th>
						<th>Email</th>
						<th>Status</th>
						<th>Created</th>
						<th class="text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#if organizations.loading}
						<tr>
							<td colspan="6" class="text-center">
								<span class="loading loading-spinner loading-md"></span>
							</td>
						</tr>
					{:else if organizations.current && organizations.current.length > 0}
						{#each organizations.current as org}
							<tr class="hover">
								<td class="font-medium">{org.organizationName || 'Unnamed'}</td>
								<td>
									<code class="text-xs bg-base-200 px-2 py-1 rounded">{org.organizationSlug}</code>
								</td>
								<td>{org.email}</td>
								<td>
									<span class="badge {getStatusColor(org.status)} badge-sm">
										{org.status}
									</span>
								</td>
								<td class="text-sm text-base-content/70">
									{new Date(org.created_at).toLocaleDateString()}
								</td>
								<td class="text-right">
									<div class="flex justify-end gap-2">
										<button 
											class="btn btn-ghost btn-sm btn-square"
											onclick={() => openEditModal(org)}
										>
											<Pencil class="h-4 w-4" />
										</button>
										<button 
											class="btn btn-ghost btn-sm btn-square text-error"
											onclick={() => openDeleteDialog(org)}
										>
											<Trash2 class="h-4 w-4" />
										</button>
									</div>
								</td>
							</tr>
						{/each}
					{:else}
						<tr>
							<td colspan="6" class="text-center py-8">
								<div class="flex flex-col items-center gap-2">
									<Building2 class="h-12 w-12 text-base-content/30" />
									<p class="text-base-content/70">No organizations yet</p>
									<button class="btn btn-sm btn-primary" onclick={openCreateModal}>
										Create your first organization
									</button>
								</div>
							</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	</div>

<!-- Create/Edit Dialog -->
{#if showModal}
  <Dialog bind:open={showModal} size="md" onClose={resetForm} class="rounded-2xl border border-base-200 shadow-xl" backdropClass="bg-black/40 backdrop-blur-sm">
    {#snippet header()}
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-lg">
          {modalMode === 'create' ? 'Create Organization' : 'Edit Organization'}
        </h3>
        <button
          class="btn btn-ghost btn-sm btn-circle"
          type="button"
          onclick={() => { showModal = false; resetForm(); }}
          aria-label="Close"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    {/snippet}
    {#snippet children()}
      {@const formRef = modalMode === 'create' ? createOrganization : updateOrganization}
      <form {...formRef} class="space-y-4">
        {#if modalMode === 'edit' && editingOrg}
          <input type="hidden" name="id" value={editingOrg.id} />
        {/if}
        
        <FormField 
          label="Organization Name" 
          issues={formRef.fields.organizationName.issues()}
        >
          <FormInput 
            field={formRef.fields.organizationName} 
            placeholder="Acme Corp"
          />
        </FormField>

        <FormField 
          label="Organization Slug" 
          issues={formRef.fields.organizationSlug.issues()}
          hint="Lowercase letters, numbers, and hyphens only"
        >
          <FormInput 
            field={formRef.fields.organizationSlug} 
            placeholder="acme-corp"
          />
        </FormField>

        <FormField 
          label="Email" 
          issues={formRef.fields.email.issues()}
        >
          <FormInput 
            field={formRef.fields.email} 
            type="email"
            placeholder="contact@acme.com"
          />
        </FormField>

        <FormField 
          label="Status" 
          issues={formRef.fields.status.issues()}
        >
          <FormSelect field={formRef.fields.status}>
            <option value="lead">Lead</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </FormSelect>
        </FormField>

        <FormField 
          label="Notes" 
          issues={formRef.fields.notes.issues()}
        >
          <FormTextarea 
            field={formRef.fields.notes} 
            placeholder="Additional notes..."
            rows={3}
          />
        </FormField>

        <div class="modal-action">
          <button
            type="button"
            class="btn"
            onclick={() => { showModal = false; resetForm(); }}
          >
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" aria-busy={!!formRef.pending} disabled={!!formRef.pending}>
            {modalMode === 'create' ? 'Create' : 'Save'}
          </button>
        </div>
      </form>
    {/snippet}
  </Dialog>
{/if}

<!-- Delete Confirmation Dialog -->
{#if showDeleteDialog && deletingOrg}
  <Dialog bind:open={showDeleteDialog} size="sm" onClose={closeDeleteDialog} class="rounded-2xl border border-base-200 shadow-xl" backdropClass="bg-black/40 backdrop-blur-sm">
    {#snippet header()}
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-lg text-error">Delete Organization</h3>
        <button
          class="btn btn-ghost btn-sm btn-circle"
          type="button"
          onclick={closeDeleteDialog}
          aria-label="Close"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="space-y-4">
        <div class="alert alert-warning">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>This action cannot be undone!</span>
        </div>
        
        <p class="text-base-content/70">
          Are you sure you want to delete <strong class="text-base-content">{deletingOrg.organizationName}</strong>?
        </p>
        
        <form {...deleteOrganization} onsubmit={handleDeleteConfirm}>
          <input type="hidden" name="id" value={deletingOrg.id} />
          
          <div class="modal-action">
            <button
              type="button"
              class="btn"
              onclick={closeDeleteDialog}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              class="btn btn-error" 
              aria-busy={!!deleteOrganization.pending} 
              disabled={!!deleteOrganization.pending}
            >
              {deleteOrganization.pending ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </form>
      </div>
    {/snippet}
  </Dialog>
{/if}