<script lang="ts">
  import { getSiteById, updateSiteTheme } from '$lib/api/sites.remote';
  import { getAllThemes } from '@kuratchi/editor';
  import { Palette, Check } from 'lucide-svelte';

  const site = getSiteById();
  const availableThemes = getAllThemes();

  let selectedTheme = $state('minimal');
  let saving = $state(false);
  let saveError = $state<string | null>(null);
  let saveSuccess = $state(false);

  // Initialize selected theme when site data loads
  $effect(() => {
    if (site.current) {
      const metadata = site.current.metadata as any;
      selectedTheme = metadata?.themeId || site.current.theme || 'minimal';
    }
  });

</script>

<div class="card border border-base-200 bg-base-200/30">
  <div class="card-body">
    <div class="space-y-6">
      <div>
        <h3 class="text-lg font-semibold mb-2">Choose a Theme</h3>
        <p class="text-sm text-base-content/60">Select a theme for your site. You can customize it further in the editor.</p>
      </div>

      {#if saveSuccess}
        <div class="alert alert-success">
          <Check class="h-5 w-5" />
          <span>Theme updated successfully!</span>
        </div>
      {/if}

      {#if saveError}
        <div class="alert alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{saveError}</span>
        </div>
      {/if}

      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {#each availableThemes as theme}
          <button
            onclick={() => {
              if (!site.current?.id || saving) return;

              selectedTheme = theme.metadata.id;
              saving = true;
              saveError = null;
              saveSuccess = false;

              updateSiteTheme({ siteId: site.current.id, themeId: theme.metadata.id })
                .then(async (result) => {
                  if (result?.success) {
                    saveSuccess = true;
                    await site.refresh();
                    setTimeout(() => {
                      saveSuccess = false;
                    }, 3000);
                  } else {
                    saveError = 'Failed to update theme. Please try again.';
                  }
                })
                .catch((err) => {
                  console.error('Failed to update theme:', err);
                  saveError = err instanceof Error ? err.message : 'Failed to update theme. Please try again.';
                })
                .finally(() => {
                  saving = false;
                });
            }}
            disabled={saving}
            class="card bg-base-100 border-2 transition-all hover:shadow-lg {selectedTheme === theme.metadata.id ? 'border-primary' : 'border-base-200'} {saving ? 'opacity-50 cursor-not-allowed' : ''}"
          >
            <div class="card-body p-4">
              <div class="aspect-video bg-base-200 rounded-lg mb-3 flex items-center justify-center">
                <Palette class="h-8 w-8 text-base-content/40" />
              </div>
              <div class="flex items-start justify-between">
                <div class="text-left">
                  <h4 class="font-semibold">{theme.metadata.name}</h4>
                  <p class="text-xs text-base-content/60">{theme.metadata.description}</p>
                </div>
                {#if selectedTheme === theme.metadata.id}
                  <div class="badge badge-primary badge-sm gap-1">
                    <Check class="h-3 w-3" />
                    Active
                  </div>
                {/if}
              </div>
            </div>
          </button>
        {/each}
      </div>

      <div class="alert">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Changing themes will update your homepage with the new theme's default template. Your existing content will be preserved.</span>
      </div>
    </div>
  </div>
</div>
