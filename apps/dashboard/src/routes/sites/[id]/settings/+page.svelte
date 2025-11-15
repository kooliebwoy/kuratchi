<script lang="ts">
  import { getSiteById } from '$lib/functions/sites.remote';

  const site = getSiteById();
</script>

<div class="card border border-base-200 bg-base-200/30">
  <div class="card-body">
    <div class="space-y-6">
      <div>
        <h3 class="text-lg font-semibold mb-2">Site Settings</h3>
        <p class="text-sm text-base-content/60">Configure your site's basic information and settings</p>
      </div>

      {#if site.current}
        <form class="space-y-4">
          <div class="form-control">
            <label class="label" for="edit-site-name">
              <span class="label-text">Site Name</span>
            </label>
            <input 
              id="edit-site-name"
              type="text" 
              value={site.current.name}
              class="input input-bordered w-full" 
              required
            />
          </div>

          <div class="form-control">
            <label class="label" for="edit-site-subdomain">
              <span class="label-text">Subdomain</span>
            </label>
            <div class="join w-full">
              <input 
                id="edit-site-subdomain"
                type="text" 
                value={site.current.subdomain}
                class="input input-bordered join-item flex-1" 
                pattern="[a-z0-9-]+"
                required
              />
              <span class="btn btn-ghost join-item no-animation">.kuratchi.com</span>
            </div>
          </div>

          <div class="form-control">
            <label class="label" for="edit-site-description">
              <span class="label-text">Description</span>
            </label>
            <textarea 
              id="edit-site-description"
              value={site.current.description || ''}
              class="textarea textarea-bordered" 
              rows="3"
            ></textarea>
          </div>

          <div class="divider"></div>

          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-4">
              <input type="checkbox" class="toggle toggle-primary" checked />
              <div>
                <span class="label-text font-medium">Published</span>
                <p class="text-xs text-base-content/60">Make your site publicly accessible</p>
              </div>
            </label>
          </div>

          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-4">
              <input type="checkbox" class="toggle toggle-primary" />
              <div>
                <span class="label-text font-medium">SEO Indexing</span>
                <p class="text-xs text-base-content/60">Allow search engines to index your site</p>
              </div>
            </label>
          </div>

          <div class="divider"></div>

          <div class="alert alert-warning">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 class="font-bold">Danger Zone</h3>
              <div class="text-sm">Deleting a site is permanent and cannot be undone</div>
            </div>
          </div>

          <button type="button" class="btn btn-error btn-outline btn-sm">
            Delete Site
          </button>
        </form>
      {/if}
    </div>
  </div>
</div>
