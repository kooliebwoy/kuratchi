<script lang="ts">
	import '../app.css';
	import { Database, Github } from 'lucide-svelte';
</script>

<div class="min-h-screen bg-white text-gray-900">
	<nav class="bg-white border-b border-gray-100">
		<div class="max-w-7xl mx-auto px-6 py-4">
			<div class="flex items-center justify-between">
				<a
					href="/"
					class="flex items-center gap-2 text-xl font-bold text-gray-900 hover:text-gray-700 transition-colors"
				>
					<Database class="w-6 h-6" />
					<span>Kuratchi</span>
					<span
						class="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-600"
					>
						Docs
					</span>
				</a>
				<div class="hidden items-center gap-6 text-sm md:flex">
					<a
						href="/sdk/overview"
						class="text-gray-600 hover:text-gray-900 transition-colors font-medium"
					>
						SDK
					</a>
					<a
						href="https://kuratchi.dev"
						class="text-gray-600 hover:text-gray-900 transition-colors font-medium"
					>
						Website
					</a>
					<a
						href="https://github.com/kooliebwoy/kuratchi"
						target="_blank"
						rel="noopener"
						class="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
					>
						<Github class="w-4 h-4" />
						<span class="font-medium">GitHub</span>
					</a>
				</div>
			</div>
		</div>
	</nav>

	<main class="max-w-7xl mx-auto px-6 py-10">
		<slot />
	</main>
</div>
