<script lang="ts">
	import { Activity, CheckCircle, XCircle, User, Clock, Info, Shield, Building2, Trash2, Search, Filter, TrendingUp, AlertCircle, Plus, Pencil, Settings, ChevronDown, ChevronRight } from 'lucide-svelte';
	import { Dialog, FormField, FormInput, FormSelect, FormTextarea, FormCheckbox } from '@kuratchi/ui';
	import { getActivities, getActivityStats, clearOldActivities, getActivityTypes, createActivityType, updateActivityType, deleteActivityType } from '$lib/api/activity.remote';
	
	// Tab state
	let activeTab = $state<'log' | 'types'>('log');
	
	// Expanded activities state
	let expandedActivities = $state<Set<string>>(new Set());
	
	function toggleExpanded(activityId: string) {
		if (expandedActivities.has(activityId)) {
			expandedActivities.delete(activityId);
		} else {
			expandedActivities.add(activityId);
		}
		expandedActivities = new Set(expandedActivities);
	}

	// Data sources
	const activities = getActivities();
	const stats = getActivityStats();

	// Derived lists
	const activitiesList = $derived(activities.current ? (Array.isArray(activities.current) ? activities.current : []) : []);
	const statsData = $derived(stats.current || { total: 0, last24h: 0, last7d: 0, last30d: 0, adminActions: 0, userActions: 0, failedActions: 0, activeUsers: 0 });

	// Filter state
	let searchQuery = $state('');
	let filterAction = $state('');
	let filterUser = $state('');
	let filterStatus = $state<'all' | 'success' | 'failed'>('all');
	let filterType = $state<'all' | 'admin' | 'user'>('all');

	// Get unique action types
	const uniqueActions = $derived.by(() => {
		const actions: Record<string, boolean> = {};
		activitiesList.forEach((a: any) => {
			actions[a.action] = true;
		});
		return Object.keys(actions).sort();
	});

	// Get unique users
	const uniqueUsers = $derived.by(() => {
		const usersMap: Record<string, any> = {};
		activitiesList.forEach((a: any) => {
			if (a.userId && !usersMap[a.userId]) {
				usersMap[a.userId] = { id: a.userId, name: a.userName, email: a.userEmail };
			}
		});
		return Object.values(usersMap);
	});

	// Filtered activities
	const filteredActivities = $derived.by(() => {
		let filtered = activitiesList;

		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			filtered = filtered.filter((a: any) =>
				a.action?.toLowerCase().includes(q) ||
				a.userName?.toLowerCase().includes(q) ||
				a.userEmail?.toLowerCase().includes(q) ||
				a.ip?.toLowerCase().includes(q)
			);
		}

		if (filterAction) {
			filtered = filtered.filter((a: any) => a.action === filterAction);
		}

		if (filterUser) {
			filtered = filtered.filter((a: any) => a.userId === filterUser);
		}

		if (filterStatus !== 'all') {
			filtered = filtered.filter((a: any) => {
				return filterStatus === 'success' ? a.status !== false : a.status === false;
			});
		}

		if (filterType !== 'all') {
			filtered = filtered.filter((a: any) => {
				return filterType === 'admin' ? a.isAdminAction : !a.isAdminAction;
			});
		}

		return filtered;
	});

	// Format timestamp
	function formatTimestamp(timestamp: string) {
		const date = new Date(timestamp);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return 'Just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;
		
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
		});
	}

	// Get action badge color
	function getActionColor(action: string, isAdminAction: boolean) {
		// Admin actions get purple/primary color
		if (isAdminAction) return 'badge-primary';
		
		const actionLower = action.toLowerCase();
		if (actionLower.includes('create')) return 'badge-success';
		if (actionLower.includes('delete')) return 'badge-error';
		if (actionLower.includes('update') || actionLower.includes('edit')) return 'badge-warning';
		if (actionLower.includes('login') || actionLower.includes('auth')) return 'badge-info';
		return 'badge-neutral';
	}

	function handleClearOld() {
		if (!confirm('Clear activities older than 90 days?')) return;
		const formEl = document.getElementById('clear-old-form') as HTMLFormElement;
		formEl?.requestSubmit();
	}
	
	// Activity Types Management
	const activityTypes = getActivityTypes();
	const activityTypesList = $derived(activityTypes.current ? (Array.isArray(activityTypes.current) ? activityTypes.current : []) : []);
	
	let showTypeModal = $state(false);
	let typeModalMode = $state<'create' | 'edit'>('create');
	let editingType = $state<any>(null);
	
	function openCreateTypeModal() {
		typeModalMode = 'create';
		editingType = null;
		showTypeModal = true;
	}
	
	function openEditTypeModal(type: any) {
		typeModalMode = 'edit';
		editingType = type;
		showTypeModal = true;
	}
	
	function closeTypeModal() {
		showTypeModal = false;
		editingType = null;
	}
	
	function handleDeleteType(id: string) {
		if (!confirm('Delete this activity type?')) return;
		const formEl = document.getElementById(`delete-type-${id}`) as HTMLFormElement;
		formEl?.requestSubmit();
	}
	
	function getSeverityColor(severity: string) {
		switch (severity) {
			case 'critical': return 'badge-error';
			case 'warning': return 'badge-warning';
			case 'info': return 'badge-info';
			default: return 'badge-neutral';
		}
	}
</script>

<svelte:head>
	<title>Activity Log - Kuratchi Dashboard</title>
</svelte:head>

<div class="p-8">
	<!-- Header -->
	<div class="mb-8 flex items-center justify-between">
		<div class="flex items-center gap-3">
			<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
				<Activity class="h-6 w-6 text-primary" />
			</div>
			<div>
				<h1 class="text-2xl font-bold">Activity Log</h1>
				<p class="text-sm text-base-content/70">Monitor system and user activity</p>
			</div>
		</div>
		{#if activeTab === 'log'}
			<button class="btn btn-outline btn-error" onclick={handleClearOld}>
				<Trash2 class="h-4 w-4" />
				Clear Old
			</button>
		{:else}
			<button class="btn btn-primary" onclick={openCreateTypeModal}>
				<Plus class="h-4 w-4" />
				New Activity Type
			</button>
		{/if}
	</div>

	<!-- Tabs -->
	<div class="tabs tabs-boxed mb-6 w-fit">
		<button 
			class="tab {activeTab === 'log' ? 'tab-active' : ''}" 
			onclick={() => activeTab = 'log'}
		>
			<Activity class="h-4 w-4 mr-2" />
			Activity Log
		</button>
		<button 
			class="tab {activeTab === 'types' ? 'tab-active' : ''}" 
			onclick={() => activeTab = 'types'}
		>
			<Settings class="h-4 w-4 mr-2" />
			Activity Types
		</button>
	</div>

	{#if activeTab === 'log'}
	<!-- Stats Cards -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
		<div class="card bg-base-100 shadow-sm">
			<div class="card-body p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs text-base-content/60 uppercase font-semibold">Last 24 Hours</p>
						<p class="text-3xl font-bold text-primary">{statsData.last24h}</p>
					</div>
					<div class="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
						<TrendingUp class="h-6 w-6 text-primary" />
					</div>
				</div>
			</div>
		</div>

		<div class="card bg-base-100 shadow-sm">
			<div class="card-body p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs text-base-content/60 uppercase font-semibold">User Actions</p>
						<p class="text-3xl font-bold text-info">{statsData.userActions}</p>
					</div>
					<div class="w-12 h-12 rounded-lg bg-info/10 flex items-center justify-center">
						<User class="h-6 w-6 text-info" />
					</div>
				</div>
			</div>
		</div>

		<div class="card bg-base-100 shadow-sm">
			<div class="card-body p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs text-base-content/60 uppercase font-semibold">Admin Actions</p>
						<p class="text-3xl font-bold text-warning">{statsData.adminActions}</p>
					</div>
					<div class="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
						<Shield class="h-6 w-6 text-warning" />
					</div>
				</div>
			</div>
		</div>

		<div class="card bg-base-100 shadow-sm">
			<div class="card-body p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs text-base-content/60 uppercase font-semibold">Failed Actions</p>
						<p class="text-3xl font-bold text-error">{statsData.failedActions}</p>
					</div>
					<div class="w-12 h-12 rounded-lg bg-error/10 flex items-center justify-center">
						<AlertCircle class="h-6 w-6 text-error" />
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Filters -->
	<div class="mb-6 flex flex-wrap items-center gap-3">
		<div class="form-control">
			<div class="input-group">
				<span class="bg-base-200 flex items-center justify-center px-3">
					<Search class="h-4 w-4" />
				</span>
				<input
					type="text"
					placeholder="Search activities..."
					class="input input-bordered input-sm w-64"
					bind:value={searchQuery}
				/>
			</div>
		</div>

		<select class="select select-bordered select-sm w-48" bind:value={filterAction}>
			<option value="">All Actions</option>
			{#each uniqueActions as action}
				<option value={action}>{action}</option>
			{/each}
		</select>

		<select class="select select-bordered select-sm w-48" bind:value={filterUser}>
			<option value="">All Users</option>
			{#each uniqueUsers as user}
				<option value={user.id}>{user.name}</option>
			{/each}
		</select>

		<select class="select select-bordered select-sm w-40" bind:value={filterStatus}>
			<option value="all">All Status</option>
			<option value="success">Success Only</option>
			<option value="failed">Failed Only</option>
		</select>

		<select class="select select-bordered select-sm w-40" bind:value={filterType}>
			<option value="all">All Types</option>
			<option value="admin">Admin Only</option>
			<option value="user">User Only</option>
		</select>
	</div>

	<!-- Activity Timeline -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			{#if activities.loading}
				<div class="flex justify-center py-8">
					<span class="loading loading-spinner loading-lg"></span>
				</div>
			{:else if filteredActivities.length > 0}
				<div class="space-y-4">
					{#each filteredActivities as activity}
						<div class="flex gap-4 border-b border-base-200 pb-4 last:border-0">
							<!-- Status Icon -->
							<div class="flex-shrink-0">
								{#if activity.status}
									<div class="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
										<CheckCircle class="h-5 w-5 text-success" />
									</div>
								{:else}
									<div class="flex h-10 w-10 items-center justify-center rounded-full bg-error/10">
										<XCircle class="h-5 w-5 text-error" />
									</div>
								{/if}
							</div>

							<!-- Activity Details -->
							<div class="flex-1">
								<div class="flex items-start justify-between gap-4">
									<div class="flex-1">
										<div class="flex items-center gap-2 flex-wrap">
											<span class="badge {getActionColor(activity.action, activity.isAdminAction)} badge-sm">
												{activity.action}
											</span>
											{#if activity.isAdminAction}
												<span class="badge badge-ghost badge-xs">
													<Shield class="h-3 w-3 mr-1" />
													Admin
												</span>
											{/if}
											{#if activity.isHidden}
												<span class="badge badge-ghost badge-xs opacity-50">
													Hidden
												</span>
											{/if}
											{#if activity.userName}
												<span class="flex items-center gap-1 text-xs text-base-content/60">
													<User class="h-3 w-3" />
													{activity.userName}
												</span>
											{/if}
											{#if activity.organizationId}
												<span class="flex items-center gap-1 text-xs text-base-content/60">
													<Building2 class="h-3 w-3" />
													{activity.organizationId.substring(0, 8)}
												</span>
											{/if}
										</div>
										
										<!-- Expandable Data Section -->
										{#if activity.data && typeof activity.data === 'object' && Object.keys(activity.data).length > 0}
											<button
												class="mt-2 flex items-center gap-2 text-xs text-base-content/70 hover:text-base-content transition-colors"
												onclick={() => toggleExpanded(activity.id)}
											>
												{#if expandedActivities.has(activity.id)}
													<ChevronDown class="h-4 w-4" />
													Hide Details
												{:else}
													<ChevronRight class="h-4 w-4" />
													Show Details ({Object.keys(activity.data).length} {Object.keys(activity.data).length === 1 ? 'field' : 'fields'})
												{/if}
											</button>
											
											{#if expandedActivities.has(activity.id)}
												<div class="mt-2 rounded-lg bg-base-200/50 p-3 border border-base-300">
													<pre class="text-xs overflow-x-auto">{JSON.stringify(activity.data, null, 2)}</pre>
												</div>
											{/if}
										{/if}

										<!-- Metadata -->
										<div class="mt-2 flex flex-wrap items-center gap-4 text-xs text-base-content/60">
											{#if activity.ip}
												<span class="flex items-center gap-1">
													<Info class="h-3 w-3" />
													{activity.ip}
												</span>
											{/if}
											{#if activity.userAgent}
												<span class="truncate max-w-xs" title={activity.userAgent}>
													{activity.userAgent}
												</span>
											{/if}
										</div>
									</div>

									<!-- Timestamp -->
									<div class="flex items-center gap-1 text-xs text-base-content/60 whitespace-nowrap">
										<Clock class="h-3 w-3" />
										{formatTimestamp(activity.createdAt)}
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="flex flex-col items-center gap-2 py-12">
					<Activity class="h-12 w-12 text-base-content/30" />
					<p class="text-base-content/70">No activity found</p>
					{#if searchQuery || filterAction || filterUser || filterStatus !== 'all' || filterType !== 'all'}
						<p class="text-sm text-base-content/50">Try adjusting your filters</p>
					{:else}
						<p class="text-sm text-base-content/50">Actions will appear here as they happen</p>
					{/if}
				</div>
			{/if}
		</div>
	</div>
	{:else}
	<!-- Activity Types Table -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			{#if activityTypes.loading}
				<div class="flex justify-center py-8">
					<span class="loading loading-spinner loading-lg"></span>
				</div>
			{:else if activityTypesList.length > 0}
				<div class="overflow-x-auto">
					<table class="table">
						<thead>
							<tr>
								<th>Action</th>
								<th>Label</th>
								<th>Category</th>
								<th>Severity</th>
								<th>Flags</th>
								<th>Description</th>
								<th class="text-right">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each activityTypesList as type}
								<tr class="hover">
									<td>
										<code class="text-xs bg-base-200 px-2 py-1 rounded">{type.action}</code>
									</td>
									<td class="font-medium">{type.label}</td>
									<td>
										{#if type.category}
											<span class="badge badge-sm badge-ghost">{type.category}</span>
										{:else}
											<span class="text-base-content/40">-</span>
										{/if}
									</td>
									<td>
										<span class="badge badge-sm {getSeverityColor(type.severity)}">
											{type.severity || 'info'}
										</span>
									</td>
									<td>
										<div class="flex gap-1">
											{#if type.isAdminAction}
												<span class="badge badge-xs badge-primary">
													<Shield class="h-3 w-3 mr-1" />
													Admin
												</span>
											{/if}
											{#if type.isHidden}
												<span class="badge badge-xs badge-ghost opacity-50">
													Hidden
												</span>
											{/if}
											{#if !type.isAdminAction && !type.isHidden}
												<span class="text-base-content/40 text-xs">-</span>
											{/if}
										</div>
									</td>
									<td class="text-sm text-base-content/70 max-w-xs truncate">
										{type.description || '-'}
									</td>
									<td class="text-right">
										<div class="flex justify-end gap-2">
											<button 
												class="btn btn-ghost btn-sm btn-square"
												onclick={() => openEditTypeModal(type)}
												title="Edit"
											>
												<Pencil class="h-4 w-4" />
											</button>
											<button 
												class="btn btn-ghost btn-sm btn-square text-error"
												onclick={() => handleDeleteType(type.id)}
												title="Delete"
											>
												<Trash2 class="h-4 w-4" />
											</button>
										</div>
										<!-- Hidden delete form -->
										<form {...deleteActivityType} id="delete-type-{type.id}" style="display: none;">
											<input type="hidden" name="id" value={type.id} />
										</form>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<div class="flex flex-col items-center gap-2 py-12">
					<Settings class="h-12 w-12 text-base-content/30" />
					<p class="text-base-content/70">No activity types defined</p>
					<button class="btn btn-sm btn-primary" onclick={openCreateTypeModal}>
						Create your first activity type
					</button>
				</div>
			{/if}
		</div>
	</div>
	{/if}
</div>

<!-- Hidden form for clearing old activities -->
<form {...clearOldActivities} id="clear-old-form" style="display: none;">
	<input type="hidden" name="daysOld" value="90" />
</form>

<!-- Activity Type Modal -->
{#if showTypeModal}
	<Dialog bind:open={showTypeModal} size="md" onClose={closeTypeModal}>
		{#snippet header()}
			<h3 class="font-bold text-lg">
				{typeModalMode === 'create' ? 'Create Activity Type' : 'Edit Activity Type'}
			</h3>
		{/snippet}
		{#snippet children()}
			{@const formRef = typeModalMode === 'create' ? createActivityType : updateActivityType}
			<form {...formRef} onsubmit={closeTypeModal} class="space-y-4">
				{#if typeModalMode === 'edit' && editingType}
					<input type="hidden" name="id" value={editingType.id} />
				{/if}
				
				<FormField 
					label="Action" 
					issues={formRef.fields.action.issues()}
					hint="Unique identifier (e.g., user.login, post.created)"
				>
					<FormInput 
						field={formRef.fields.action} 
						placeholder="organization.created"
						disabled={typeModalMode === 'edit'}
					/>
				</FormField>

				<FormField 
					label="Label" 
					issues={formRef.fields.label.issues()}
				>
					<FormInput 
						field={formRef.fields.label} 
						placeholder="Organization Created"
					/>
				</FormField>

				<div class="grid grid-cols-2 gap-4">
					<FormField 
						label="Category" 
						issues={formRef.fields.category.issues()}
					>
						<FormInput 
							field={formRef.fields.category} 
							placeholder="organizations"
						/>
					</FormField>

					<FormField 
						label="Severity" 
						issues={formRef.fields.severity.issues()}
					>
						<FormSelect field={formRef.fields.severity}>
							<option value="info">Info</option>
							<option value="warning">Warning</option>
							<option value="critical">Critical</option>
						</FormSelect>
					</FormField>
				</div>

				<FormField 
					label="Description" 
					issues={formRef.fields.description.issues()}
				>
					<FormTextarea 
						field={formRef.fields.description} 
						placeholder="Describe what this activity represents..."
						rows={2}
					/>
				</FormField>

				<div class="flex gap-4">
					<FormCheckbox 
						field={formRef.fields.isAdminAction} 
						label="Admin Action"
					/>
					<FormCheckbox 
						field={formRef.fields.isHidden} 
						label="Hidden (Admin Only)"
					/>
				</div>

				<div class="modal-action">
					<button type="button" class="btn" onclick={closeTypeModal}>
						Cancel
					</button>
					<button type="submit" class="btn btn-primary" aria-busy={!!formRef.pending} disabled={!!formRef.pending}>
						{typeModalMode === 'create' ? 'Create' : 'Save'}
					</button>
				</div>
			</form>
		{/snippet}
	</Dialog>
{/if}
