<script lang="ts">
  import { getSiteById } from '$lib/api/sites.remote';
  import { Palette } from 'lucide-svelte';

  const site = getSiteById();

  // Available themes
  const themes = [
    { id: 'minimal', name: 'Minimal', description: 'Clean and simple design', preview: '/themes/minimal.png' },
    { id: 'modern', name: 'Modern', description: 'Contemporary and sleek', preview: '/themes/modern.png' },
    { id: 'classic', name: 'Classic', description: 'Timeless and elegant', preview: '/themes/classic.png' },
    { id: 'bold', name: 'Bold', description: 'Eye-catching and vibrant', preview: '/themes/bold.png' },
    { id: 'creative', name: 'Creative', description: 'Artistic and unique', preview: '/themes/creative.png' },
    { id: 'professional', name: 'Professional', description: 'Business-focused design', preview: '/themes/professional.png' }
  ];

  let selectedTheme = $state('minimal');

  // Initialize selected theme when site data loads
  $effect(() => {
    if (site.current?.theme) {
      selectedTheme = site.current.theme;
    }
  });

  function handleThemeSelect(themeId: string) {
    selectedTheme = themeId;
    // TODO: Save theme selection to API
    console.log('Theme selected:', themeId);
  }
</script>

<div class="card border border-base-200 bg-base-200/30">
  <div class="card-body">
    <div class="space-y-6">
      <div>
        <h3 class="text-lg font-semibold mb-2">Choose a Theme</h3>
        <p class="text-sm text-base-content/60">Select a theme for your site. You can customize it further in the editor.</p>
      </div>

      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {#each themes as theme}
          <button
            onclick={() => handleThemeSelect(theme.id)}
            class="card bg-base-100 border-2 transition-all hover:shadow-lg {selectedTheme === theme.id ? 'border-primary' : 'border-base-200'}"
          >
            <div class="card-body p-4">
              <div class="aspect-video bg-base-200 rounded-lg mb-3 flex items-center justify-center">
                <Palette class="h-8 w-8 text-base-content/40" />
              </div>
              <div class="flex items-start justify-between">
                <div class="text-left">
                  <h4 class="font-semibold">{theme.name}</h4>
                  <p class="text-xs text-base-content/60">{theme.description}</p>
                </div>
                {#if selectedTheme === theme.id}
                  <div class="badge badge-primary badge-sm">Active</div>
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
        <span>Theme previews will be added in the next update</span>
      </div>
    </div>
  </div>
</div>
