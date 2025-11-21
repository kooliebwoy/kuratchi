<script lang="ts">
	let { children, data } = $props();
	const sections = data.sections ?? [];
	const activeSlug = data.activeSlug ?? 'overview';
</script>

<section class="flex w-full gap-10">
	<aside class="hidden w-64 shrink-0 md:block">
		<div class="sticky top-28 space-y-4">
			<h2 class="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
				Database
			</h2>
			<ul class="space-y-1 text-sm">
				{#each sections as section}
					<li>
						<a
							href={section.slug === 'overview' ? '/sdk/database' : `/sdk/database/${section.slug}`}
							class={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
								section.slug === activeSlug
									? 'bg-indigo-600 text-white shadow-sm'
									: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
							}`}
						>
							<span class="truncate">{section.title}</span>
						</a>
					</li>
				{/each}
			</ul>
		</div>
	</aside>

	<div class="min-w-0 flex-1">
		<div class="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
			{@render children?.()}
		</div>
	</div>
</section>
