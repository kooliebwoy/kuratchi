<script lang="ts">
	import { Building2, Plus, Pencil, Trash2, X } from 'lucide-svelte';
	import { Badge, Button, Card, Dialog, FormField, FormInput, FormSelect, FormTextarea, Alert, Loading } from '@kuratchi/ui';
	import { getOrganizations, createOrganization, updateOrganization, deleteOrganization } from '$lib/functions/organizations.remote';

	const organizations = getOrganizations();
	let showModal = $state(false);
	let modalMode = $state<'create' | 'edit'>('create');
	let editingOrg = $state<any>(null);

	let showDeleteDialog = $state(false);
	let deletingOrg = $state<any>(null);

	let formData = $state({
		organizationName: '',
		email: '',
		organizationSlug: '',
		notes: '',
		status: 'active' as 'active' | 'inactive' | 'lead'
	});

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

	function openCreateModal() {
		resetForm();
		modalMode = 'create';
		showModal = true;
	}

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

	function handleFormSubmit() {
		showModal = false;
		resetForm();
	}

	function openDeleteDialog(org: any) {
		deletingOrg = org;
		showDeleteDialog = true;
	}

	function closeDeleteDialog() {
		showDeleteDialog = false;
		deletingOrg = null;
	}

	function handleDeleteConfirm() {
		showDeleteDialog = false;
	}

	function formatStatus(status: string) {
		if (status === 'lead') return { label: 'Lead', variant: 'warning' };
		if (status === 'inactive') return { label: 'Inactive', variant: 'outline' };
		return { label: 'Active', variant: 'primary' };
	}
</script>

<div class="kui-orgs">
	<header class="kui-orgs__header">
		<div>
			<p class="kui-eyebrow">Superadmin</p>
			<h1>Organizations</h1>
			<p class="kui-subtext">Manage every organization across the platform.</p>
		</div>
		<Button variant="primary" size="sm" onclick={openCreateModal}>
			<Plus class="kui-icon" />
			New organization
		</Button>
	</header>

	<Card class="kui-panel">
		{#if organizations.loading}
			<div class="kui-center"><Loading /></div>
		{:else}
			<div class="kui-table-scroll">
				<table class="kui-table">
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
						{#if organizations.current && organizations.current.length > 0}
							{#each organizations.current as org}
								{@const status = formatStatus(org.status)}
								<tr>
									<td class="kui-strong">{org.organizationName || 'Unnamed'}</td>
									<td><code>{org.organizationSlug}</code></td>
									<td>{org.email}</td>
									<td><Badge variant={status.variant} size="xs">{status.label}</Badge></td>
									<td class="kui-subtext">{new Date(org.created_at).toLocaleDateString()}</td>
									<td class="text-right">
										<div class="kui-inline end">
											<Button variant="ghost" size="xs" onclick={() => openEditModal(org)}>
												<Pencil class="kui-icon" />
											</Button>
											<Button variant="ghost" size="xs" class="danger" onclick={() => openDeleteDialog(org)}>
												<Trash2 class="kui-icon" />
											</Button>
										</div>
									</td>
								</tr>
							{/each}
						{:else}
							<tr>
								<td colspan="6">
									<div class="kui-empty">
										<Building2 class="kui-empty__icon" />
										<p class="kui-subtext">No organizations yet</p>
										<Button variant="primary" size="sm" onclick={openCreateModal}>
											Create your first organization
										</Button>
									</div>
								</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>
</div>

{#if showModal}
  <Dialog bind:open={showModal} size="md" onClose={resetForm}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3>{modalMode === 'create' ? 'Create organization' : 'Edit organization'}</h3>
        <Button variant="ghost" size="xs" onclick={() => { showModal = false; resetForm(); }} aria-label="Close">
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      {@const formRef = modalMode === 'create' ? createOrganization : updateOrganization}
      <form {...formRef} class="kui-stack" onsubmit={handleFormSubmit}>
        {#if modalMode === 'edit' && editingOrg}
          <input type="hidden" name="id" value={editingOrg.id} />
        {/if}
        
        <FormField label="Organization Name" issues={formRef.fields.organizationName.issues()}>
          <FormInput field={formRef.fields.organizationName} placeholder="Acme Corp" />
        </FormField>

        <FormField
          label="Organization Slug"
          issues={formRef.fields.organizationSlug.issues()}
          hint="Lowercase letters, numbers, and hyphens only"
        >
          <FormInput field={formRef.fields.organizationSlug} placeholder="acme-corp" />
        </FormField>

        <FormField label="Email" issues={formRef.fields.email.issues()}>
          <FormInput field={formRef.fields.email} type="email" placeholder="contact@acme.com" />
        </FormField>

        <FormField label="Status" issues={formRef.fields.status.issues()}>
          <FormSelect field={formRef.fields.status}>
            <option value="lead">Lead</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </FormSelect>
        </FormField>

        <FormField label="Notes" issues={formRef.fields.notes.issues()}>
          <FormTextarea field={formRef.fields.notes} placeholder="Additional notes..." rows={3} />
        </FormField>

        {#snippet actions(close)}
          <Button variant="ghost" type="button" onclick={() => { close(); resetForm(); }}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!!formRef.pending}>
            {modalMode === 'create' ? 'Create' : 'Save'}
          </Button>
        {/snippet}
      </form>
    {/snippet}
  </Dialog>
{/if}

{#if showDeleteDialog && deletingOrg}
  <Dialog bind:open={showDeleteDialog} size="sm" onClose={closeDeleteDialog}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3 class="danger-text">Delete organization</h3>
        <Button variant="ghost" size="xs" onclick={closeDeleteDialog} aria-label="Close">
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="kui-stack">
        <Alert type="warning">This action cannot be undone.</Alert>
        <p class="kui-subtext">
          Are you sure you want to delete <strong>{deletingOrg.organizationName}</strong>?
        </p>
        
        <form {...deleteOrganization} onsubmit={handleDeleteConfirm}>
          <input type="hidden" name="id" value={deletingOrg.id} />
          
          {#snippet actions(close)}
            <Button variant="ghost" type="button" onclick={closeDeleteDialog}>Cancel</Button>
            <Button 
              type="submit" 
              variant="primary" 
              class="danger" 
              disabled={!!deleteOrganization.pending}
            >
              {deleteOrganization.pending ? 'Deleting...' : 'Delete'}
            </Button>
          {/snippet}
        </form>
      </div>
    {/snippet}
  </Dialog>
{/if}

<style>
	.kui-orgs {
		display: grid;
		gap: 14px;
	}

	.kui-orgs__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	h1 {
		margin: 0;
		font-size: 26px;
	}

	.kui-eyebrow {
		font-size: 12px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #6b7280;
		margin: 0 0 6px;
	}

	.kui-subtext {
		color: #6b7280;
		margin: 0;
	}

	.kui-panel {
		padding: 16px;
	}

	.kui-table-scroll {
		overflow: auto;
	}

	.kui-table {
		width: 100%;
		border-collapse: collapse;
	}

	.kui-table th,
	.kui-table td {
		padding: 12px;
		border-bottom: 1px solid #f1f1f3;
		text-align: left;
	}

	.kui-table th {
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-size: 13px;
		color: #6b7280;
	}

	.kui-empty {
		padding: 28px 12px;
		display: grid;
		gap: 10px;
		justify-items: center;
	}

	.kui-empty__icon {
		width: 40px;
		height: 40px;
		color: #d4d4d8;
	}

	.kui-inline {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.kui-inline.end {
		justify-content: flex-end;
	}

	.kui-strong {
		font-weight: 600;
	}

	.kui-modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.kui-stack {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	code {
		background: #f4f4f5;
		padding: 4px 6px;
		border-radius: 8px;
	}

	.danger {
		color: #b91c1c;
		border-color: rgba(239, 68, 68, 0.35);
	}

	.danger-text {
		color: #b91c1c;
		margin: 0;
	}
</style>
