<script lang="ts">
	import { Shield, Plus, Pencil, Trash2, X, Building2 } from 'lucide-svelte';
	import { Dialog } from '@kuratchi/ui';
	import {
		getRoles,
		getPermissions,
		getRolePermissions,
		createRole,
		updateRole,
		archiveRole,
		createPermission,
		updatePermission,
		archivePermission,
		attachPermissionToRole,
		detachPermissionFromRole
	} from './roles.remote';

	// Data sources
	const roles = getRoles();
	const permissions = getPermissions();
	const rolePerms = getRolePermissions();

	// Normalized lists
	const rolesList = $derived(
		roles.current
			? (Array.isArray(roles.current) ? (roles.current as any[]) : (((roles.current as any).data ?? []) as any[]))
			: ([] as any[])
	);
	const permissionsList = $derived(
		permissions.current
			? (Array.isArray(permissions.current) ? (permissions.current as any[]) : (((permissions.current as any).data ?? []) as any[]))
			: ([] as any[])
	);
	const permsByRole = $derived(rolePerms.current?.byRole || {});

	// Modal state
	let showRoleModal = $state(false);
	let showPermModal = $state(false);
	let showDeleteConfirm = $state(false);
	let modalMode = $state<'create' | 'edit'>('create');
	let permModalMode = $state<'create' | 'edit'>('create');
	let editingRole = $state<any>(null);
	let editingPerm = $state<any>(null);
	let deletingRole = $state<any>(null);
	let selectedPermissions = $state<Set<string>>(new Set());
	let activeTab = $state<'roles' | 'permissions'>('roles');

	// Form state
	let formData = $state({
		name: '',
		description: ''
	});

	let permFormData = $state({
		value: '',
		label: '',
		description: ''
	});

	function resetForm() {
		formData = { name: '', description: '' };
		editingRole = null;
		selectedPermissions = new Set();
	}

	function resetPermForm() {
		permFormData = { value: '', label: '', description: '' };
		editingPerm = null;
	}

	function openCreateModal() {
		resetForm();
		modalMode = 'create';
		showRoleModal = true;
	}

	function openEditModal(role: any) {
		editingRole = role;
		formData = {
			name: role.name || '',
			description: role.description || ''
		};
		// Load current permissions for this role
		const rolePermissions = permsByRole[role.id] || [];
		selectedPermissions = new Set(rolePermissions.map((p: any) => p.id));
		modalMode = 'edit';
		showRoleModal = true;
	}

	async function handleRoleSubmit() {
		// Close modal and sync permissions after a delay
		showRoleModal = false;
		
		if (editingRole) {
			const roleId = editingRole.id;
			const permsToSync = new Set(selectedPermissions);
			
			// Wait for role update to complete, then sync permissions
			setTimeout(async () => {
				const currentPerms = new Set((permsByRole[roleId] || []).map((p: any) => p.id));
				const toAttach = Array.from(permsToSync).filter(id => !currentPerms.has(id));
				const toDetach = Array.from(currentPerms).filter(id => !permsToSync.has(id));
				
				// Attach new permissions
				for (const permId of toAttach) {
					const formEl = document.getElementById(`attach-perm-${roleId}-${permId}`) as HTMLFormElement;
					if (formEl) {
						formEl.requestSubmit();
						await new Promise(resolve => setTimeout(resolve, 100));
					}
				}
				
				// Detach removed permissions
				for (const permId of toDetach) {
					const formEl = document.getElementById(`detach-perm-${roleId}-${permId}`) as HTMLFormElement;
					if (formEl) {
						formEl.requestSubmit();
						await new Promise(resolve => setTimeout(resolve, 100));
					}
				}
				
				// Refresh role permissions
				await rolePerms.refresh();
			}, 500);
		}
		
		resetForm();
	}

	function togglePermission(permId: string) {
		if (selectedPermissions.has(permId)) {
			selectedPermissions.delete(permId);
		} else {
			selectedPermissions.add(permId);
		}
		selectedPermissions = selectedPermissions; // trigger reactivity
	}

	function getRolePermissionCount(roleId: string) {
		return (permsByRole[roleId] || []).length;
	}

	function openCreatePermModal() {
		resetPermForm();
		permModalMode = 'create';
		showPermModal = true;
	}

	function openEditPermModal(perm: any) {
		editingPerm = perm;
		permFormData = {
			value: perm.value || '',
			label: perm.label || '',
			description: perm.description || ''
		};
		permModalMode = 'edit';
		showPermModal = true;
	}

	function openDeleteConfirm(role: any) {
		deletingRole = role;
		showDeleteConfirm = true;
	}

	function confirmDelete() {
		showDeleteConfirm = false;
		// The form will be submitted after this
	}
</script>

<div class="p-8">
	<!-- Header -->
	<div class="mb-8 flex items-center justify-between">
		<div class="flex items-center gap-3">
			<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
				<Shield class="h-6 w-6 text-primary" />
			</div>
			<div>
				<h1 class="text-2xl font-bold">Roles & Permissions</h1>
				<p class="text-sm text-base-content/70">Manage access control for your organization</p>
			</div>
		</div>
		<div class="flex gap-2">
			<button class="btn btn-outline" onclick={openCreatePermModal}>
				<Plus class="h-4 w-4" />
				New Permission
			</button>
			<button class="btn btn-primary" onclick={openCreateModal}>
				<Plus class="h-4 w-4" />
				New Role
			</button>
		</div>
	</div>

	<!-- Tabs -->
	<div class="tabs tabs-boxed mb-6 w-fit">
		<button 
			class="tab {activeTab === 'roles' ? 'tab-active' : ''}" 
			onclick={() => activeTab = 'roles'}
		>
			Roles
		</button>
		<button 
			class="tab {activeTab === 'permissions' ? 'tab-active' : ''}" 
			onclick={() => activeTab = 'permissions'}
		>
			Permissions
		</button>
	</div>

	<!-- Roles Table -->
	{#if activeTab === 'roles'}
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th>Role Name</th>
							<th>Description</th>
							<th>Permissions</th>
							<th class="text-right">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#if roles.loading}
							<tr><td colspan="4" class="text-center py-8"><span class="loading loading-spinner loading-md"></span></td></tr>
						{:else if rolesList.length > 0}
							{#each rolesList as role}
								<tr class="hover">
									<td class="font-medium">{role.name}</td>
									<td class="text-sm text-base-content/70">{role.description || '-'}</td>
									<td>
										<span class="badge badge-primary badge-sm">{getRolePermissionCount(role.id)} permissions</span>
									</td>
									<td class="text-right">
										<div class="flex justify-end gap-2">
											<button class="btn btn-ghost btn-sm btn-square" onclick={() => openEditModal(role)} title="Edit role">
												<Pencil class="h-4 w-4" />
											</button>
											<button class="btn btn-ghost btn-sm btn-square text-error" onclick={() => openDeleteConfirm(role)} title="Delete role">
												<Trash2 class="h-4 w-4" />
											</button>
										</div>
									</td>
								</tr>
							{/each}
						{:else}
							<tr><td colspan="4" class="text-center py-8 text-base-content/60">No roles yet. Create one to get started.</td></tr>
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	</div>
	{:else}
	<!-- Permissions Table -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th>Value</th>
							<th>Label</th>
							<th>Description</th>
							<th class="text-right">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#if permissions.loading}
							<tr><td colspan="4" class="text-center py-8"><span class="loading loading-spinner loading-md"></span></td></tr>
						{:else if permissionsList.length > 0}
							{#each permissionsList as perm}
								<tr class="hover">
									<td><code class="text-xs bg-base-200 px-2 py-1 rounded">{perm.value}</code></td>
									<td class="font-medium">{perm.label || '-'}</td>
									<td class="text-sm text-base-content/70">{perm.description || '-'}</td>
									<td class="text-right">
										<div class="flex justify-end gap-2">
											<button class="btn btn-ghost btn-sm btn-square" onclick={() => openEditPermModal(perm)} title="Edit permission">
												<Pencil class="h-4 w-4" />
											</button>
											<button class="btn btn-ghost btn-sm btn-square text-error" onclick={() => openDeleteConfirm(perm)} title="Delete permission">
												<Trash2 class="h-4 w-4" />
											</button>
										</div>
									</td>
								</tr>
							{/each}
						{:else}
							<tr><td colspan="4" class="text-center py-8 text-base-content/60">No permissions yet. Create one to get started.</td></tr>
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	</div>
	{/if}
</div>

<!-- Create/Edit Role Modal -->
<Dialog bind:open={showRoleModal} size="lg" class="rounded-2xl border border-base-200 shadow-xl" backdropClass="bg-black/40 backdrop-blur-sm">
	{#snippet header()}
		<div class="flex items-center justify-between">
			<h3 class="font-bold text-lg">{modalMode === 'create' ? 'Create Role' : 'Edit Role'}</h3>
			<button class="btn btn-ghost btn-sm btn-circle" onclick={() => { showRoleModal = false; resetForm(); }} aria-label="Close">
				<X class="h-4 w-4" />
			</button>
		</div>
	{/snippet}
	{#snippet children()}
		{#if modalMode === 'create'}
			<form {...createRole} onsubmit={handleRoleSubmit} class="space-y-4">
				<div class="form-control">
					<label class="label" for="role-name"><span class="label-text">Role Name</span></label>
					<input id="role-name" {...createRole.fields.name.as('text')} class="input input-bordered" placeholder="editor" required />
				</div>
				<div class="form-control">
					<label class="label" for="role-desc"><span class="label-text">Description</span></label>
					<textarea id="role-desc" {...createRole.fields.description.as('text')} class="textarea textarea-bordered" placeholder="Can edit posts and upload media" rows="2"></textarea>
				</div>
				<div class="modal-action">
					<button type="button" class="btn" onclick={() => { showRoleModal = false; resetForm(); }}>Cancel</button>
					<button type="submit" class="btn btn-primary">Create Role</button>
				</div>
			</form>
		{:else}
			<form {...updateRole} onsubmit={handleRoleSubmit} class="space-y-4">
				<input type="hidden" name="id" value={editingRole?.id} />
				<div class="form-control">
					<label class="label" for="role-name-edit"><span class="label-text">Role Name</span></label>
					<input id="role-name-edit" {...updateRole.fields.name.as('text')} class="input input-bordered" placeholder="editor" value={formData.name} required />
				</div>
				<div class="form-control">
					<label class="label" for="role-desc-edit"><span class="label-text">Description</span></label>
					<textarea id="role-desc-edit" {...updateRole.fields.description.as('text')} class="textarea textarea-bordered" placeholder="Can edit posts and upload media" value={formData.description} rows="2"></textarea>
				</div>
				
				<!-- Permissions Selection -->
				<div class="form-control">
					<label class="label"><span class="label-text font-semibold">Permissions</span></label>
					<div class="border border-base-300 rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
						{#if permissionsList.length > 0}
							{#each permissionsList as perm}
								<label class="flex items-center gap-3 cursor-pointer hover:bg-base-200 p-2 rounded">
									<input 
										type="checkbox" 
										class="checkbox checkbox-sm" 
										checked={selectedPermissions.has(perm.id)}
										onchange={() => togglePermission(perm.id)}
									/>
									<div class="flex-1">
										<div class="font-medium text-sm">{perm.label || perm.value}</div>
										{#if perm.description}
											<div class="text-xs text-base-content/60">{perm.description}</div>
										{/if}
									</div>
								</label>
							{/each}
						{:else}
							<div class="text-center text-sm text-base-content/60 py-4">No permissions available</div>
						{/if}
					</div>
				</div>

				<div class="modal-action">
					<button type="button" class="btn" onclick={() => { showRoleModal = false; resetForm(); }}>Cancel</button>
					<button type="submit" class="btn btn-primary">Save Changes</button>
				</div>
			</form>
		{/if}
	{/snippet}
</Dialog>

<!-- Create/Edit Permission Modal -->
<Dialog bind:open={showPermModal} size="md" class="rounded-2xl border border-base-200 shadow-xl" backdropClass="bg-black/40 backdrop-blur-sm">
	{#snippet header()}
		<div class="flex items-center justify-between">
			<h3 class="font-bold text-lg">{permModalMode === 'create' ? 'New Permission' : 'Edit Permission'}</h3>
			<button class="btn btn-ghost btn-sm btn-circle" onclick={() => { showPermModal = false; resetPermForm(); }} aria-label="Close">
				<X class="h-4 w-4" />
			</button>
		</div>
	{/snippet}
	{#snippet children()}
		{#if permModalMode === 'create'}
			<form {...createPermission} onsubmit={() => { showPermModal = false; resetPermForm(); }} class="space-y-3">
				<div class="form-control">
					<label class="label" for="perm-value"><span class="label-text">Value</span></label>
					<input id="perm-value" type="text" name="value" class="input input-bordered" placeholder="posts.create" required />
					<label class="label"><span class="label-text-alt">Unique identifier (e.g., posts.create, users.delete)</span></label>
				</div>
				<div class="form-control">
					<label class="label" for="perm-label"><span class="label-text">Label</span></label>
					<input id="perm-label" type="text" name="label" class="input input-bordered" placeholder="Create Posts" />
				</div>
				<div class="form-control">
					<label class="label" for="perm-desc"><span class="label-text">Description</span></label>
					<textarea id="perm-desc" name="description" class="textarea textarea-bordered" placeholder="Allows creating new posts" rows="2"></textarea>
				</div>
				<div class="modal-action">
					<button type="button" class="btn" onclick={() => { showPermModal = false; resetPermForm(); }}>Cancel</button>
					<button type="submit" class="btn btn-primary">Create Permission</button>
				</div>
			</form>
		{:else}
			<form {...updatePermission} onsubmit={() => { showPermModal = false; resetPermForm(); }} class="space-y-3">
				<input type="hidden" name="id" value={editingPerm?.id} />
				<div class="form-control">
					<label class="label" for="perm-value-edit"><span class="label-text">Value</span></label>
					<input id="perm-value-edit" {...updatePermission.fields.value.as('text')} class="input input-bordered" placeholder="posts.create" value={permFormData.value} required />
					<label class="label"><span class="label-text-alt">Unique identifier (e.g., posts.create, users.delete)</span></label>
				</div>
				<div class="form-control">
					<label class="label" for="perm-label-edit"><span class="label-text">Label</span></label>
					<input id="perm-label-edit" {...updatePermission.fields.label.as('text')} class="input input-bordered" placeholder="Create Posts" value={permFormData.label} />
				</div>
				<div class="form-control">
					<label class="label" for="perm-desc-edit"><span class="label-text">Description</span></label>
					<textarea id="perm-desc-edit" {...updatePermission.fields.description.as('text')} class="textarea textarea-bordered" placeholder="Allows creating new posts" value={permFormData.description} rows="2"></textarea>
				</div>
				<div class="modal-action">
					<button type="button" class="btn" onclick={() => { showPermModal = false; resetPermForm(); }}>Cancel</button>
					<button type="submit" class="btn btn-primary">Update Permission</button>
				</div>
			</form>
		{/if}
	{/snippet}
</Dialog>

<!-- Delete Confirmation Dialog -->
<Dialog bind:open={showDeleteConfirm} size="sm" class="rounded-2xl border border-error shadow-xl" backdropClass="bg-black/40 backdrop-blur-sm">
	{#snippet header()}
		<div class="flex items-center justify-between">
			<h3 class="font-bold text-lg text-error">Confirm Delete</h3>
			<button class="btn btn-ghost btn-sm btn-circle" onclick={() => { showDeleteConfirm = false; deletingRole = null; }} aria-label="Close">
				<X class="h-4 w-4" />
			</button>
		</div>
	{/snippet}
	{#snippet children()}
		<div class="space-y-4">
			<p class="text-base-content/70">
				Are you sure you want to delete <strong class="font-semibold">{deletingRole?.name || deletingRole?.value}</strong>?
			</p>
			<p class="text-sm text-error">This action cannot be undone.</p>
			
			<div class="flex gap-2 justify-end">
				<button type="button" class="btn btn-outline" onclick={() => { showDeleteConfirm = false; deletingRole = null; }}>
					Cancel
				</button>
				{#if deletingRole?.value}
					<!-- Deleting a permission -->
					<form {...archivePermission} onsubmit={() => { showDeleteConfirm = false; deletingRole = null; }}>
						<input type="hidden" name="id" value={deletingRole?.id} />
						<button type="submit" class="btn btn-error">
							Delete Permission
						</button>
					</form>
				{:else}
					<!-- Deleting a role -->
					<form {...archiveRole} onsubmit={() => { showDeleteConfirm = false; deletingRole = null; }}>
						<input type="hidden" name="id" value={deletingRole?.id} />
						<button type="submit" class="btn btn-error">
							Delete Role
						</button>
					</form>
				{/if}
			</div>
		</div>
	{/snippet}
</Dialog>

<!-- Hidden forms for attaching/detaching permissions -->
{#each rolesList as role}
	{#each permissionsList as perm}
		<form {...attachPermissionToRole} id="attach-perm-{role.id}-{perm.id}" style="display: none;">
			<input type="hidden" name="roleId" value={role.id} />
			<input type="hidden" name="permissionId" value={perm.id} />
		</form>
		<form {...detachPermissionFromRole} id="detach-perm-{role.id}-{perm.id}" style="display: none;">
			<input type="hidden" name="roleId" value={role.id} />
			<input type="hidden" name="permissionId" value={perm.id} />
		</form>
	{/each}
{/each}
