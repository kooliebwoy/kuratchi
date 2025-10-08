<script lang="ts">
	import { Activity, CheckCircle, XCircle, User, Clock, Info, Shield, Building2 } from 'lucide-svelte';
	import { getAdminActivities } from './activity.remote';

	// Fetch activities
	const activities = getAdminActivities();

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

	// Parse JSON data safely
	function parseData(dataStr: string | null) {
		if (!dataStr) return null;
		try {
			return JSON.parse(dataStr);
		} catch {
			return null;
		}
	}
</script>

<div class="p-8">
	<!-- Header -->
	<div class="mb-8 flex items-center justify-between">
		<div class="flex items-center gap-3">
			<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
				<Activity class="h-6 w-6 text-primary" />
			</div>
			<div>
				<h1 class="text-2xl font-bold">Activity Log</h1>
				<p class="text-sm text-base-content/70">Dashboard and admin actions</p>
			</div>
		</div>
	</div>

	<!-- Activity Timeline -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			{#if activities.loading}
				<div class="flex justify-center py-8">
					<span class="loading loading-spinner loading-lg"></span>
				</div>
			{:else if activities.current && activities.current.length > 0}
				<div class="space-y-4">
					{#each activities.current as activity}
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
									<div>
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
											{#if activity.userId}
												<span class="flex items-center gap-1 text-xs text-base-content/60">
													<User class="h-3 w-3" />
													{activity.userId.substring(0, 8)}
												</span>
											{/if}
											{#if activity.organizationId}
												<span class="flex items-center gap-1 text-xs text-base-content/60">
													<Building2 class="h-3 w-3" />
													{activity.organizationId.substring(0, 8)}
												</span>
											{/if}
										</div>
										
										{#if activity.data}
											{@const parsedData = parseData(activity.data)}
											{#if parsedData}
												<div class="mt-2 rounded-lg bg-base-200/50 p-3">
													<pre class="text-xs overflow-x-auto">{JSON.stringify(parsedData, null, 2)}</pre>
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
										{formatTimestamp(activity.created_at)}
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="flex flex-col items-center gap-2 py-12">
					<Activity class="h-12 w-12 text-base-content/30" />
					<p class="text-base-content/70">No activity yet</p>
					<p class="text-sm text-base-content/50">Actions will appear here as they happen</p>
				</div>
			{/if}
		</div>
	</div>
</div>
