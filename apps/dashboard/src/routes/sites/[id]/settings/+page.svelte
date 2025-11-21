<script lang="ts">
  import { Button, Card, Alert } from '@kuratchi/ui';
  import { getSiteById } from '$lib/functions/sites.remote';

  const site = getSiteById();
</script>

<Card class="kui-site-settings">
  <div>
    <p class="kui-eyebrow">Sites</p>
    <h3>Site settings</h3>
    <p class="kui-subtext">Configure your site's basic information and visibility.</p>
  </div>

  {#if site.current}
    <form class="kui-form">
      <label class="kui-form-control" for="edit-site-name">
        <span class="kui-label">Site name</span>
        <input 
          id="edit-site-name"
          type="text" 
          value={site.current.name}
          class="kui-input" 
          required
        />
      </label>

      <label class="kui-form-control" for="edit-site-subdomain">
        <span class="kui-label">Subdomain</span>
        <div class="kui-input-group">
          <input 
            id="edit-site-subdomain"
            type="text" 
            value={site.current.subdomain}
            class="kui-input"
            pattern="[a-z0-9-]+"
            required
          />
          <span class="kui-suffix">.kuratchi.com</span>
        </div>
      </label>

      <label class="kui-form-control" for="edit-site-description">
        <span class="kui-label">Description</span>
        <textarea 
          id="edit-site-description"
          value={site.current.description || ''}
          class="kui-textarea" 
          rows="3"
        ></textarea>
      </label>

      <div class="kui-divider"></div>

      <label class="kui-switch">
        <input type="checkbox" checked />
        <span class="kui-switch__track"></span>
        <div>
          <span class="kui-label">Published</span>
          <p class="kui-subtext">Make your site publicly accessible.</p>
        </div>
      </label>

      <label class="kui-switch">
        <input type="checkbox" />
        <span class="kui-switch__track"></span>
        <div>
          <span class="kui-label">SEO indexing</span>
          <p class="kui-subtext">Allow search engines to index your site.</p>
        </div>
      </label>

      <div class="kui-divider"></div>

      <Alert type="warning">
        <div>
          <h4 class="kui-strong">Danger zone</h4>
          <p class="kui-subtext">Deleting a site is permanent and cannot be undone.</p>
        </div>
      </Alert>

      <Button type="button" variant="outline" class="danger">Delete site</Button>
    </form>
  {/if}
</Card>

<style>
  .kui-site-settings {
    display: grid;
    gap: 12px;
    padding: 16px;
  }

  .kui-eyebrow {
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #6b7280;
    margin: 0 0 6px;
  }

  h3 {
    margin: 0;
    font-size: 20px;
  }

  .kui-subtext {
    color: #6b7280;
    margin: 0;
  }

  .kui-form {
    display: grid;
    gap: 12px;
  }

  .kui-form-control {
    display: grid;
    gap: 6px;
  }

  .kui-label {
    font-weight: 600;
    font-size: 14px;
  }

  .kui-input,
  .kui-textarea {
    width: 100%;
    border-radius: 10px;
    border: 1px solid #e4e4e7;
    padding: 10px 12px;
    background: white;
    font-size: 14px;
  }

  .kui-input:focus,
  .kui-textarea:focus {
    outline: 2px solid rgba(129, 140, 248, 0.35);
    border-color: #a5b4fc;
  }

  .kui-input-group {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 8px;
  }

  .kui-suffix {
    padding: 10px 12px;
    border-radius: 10px;
    background: #f4f4f5;
    border: 1px solid #e4e4e7;
    font-weight: 600;
    color: #6b7280;
  }

  .kui-divider {
    height: 1px;
    background: #f1f1f3;
    margin: 4px 0;
  }

  .kui-switch {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px;
    align-items: center;
  }

  .kui-switch input {
    position: absolute;
    opacity: 0;
  }

  .kui-switch__track {
    width: 44px;
    height: 24px;
    background: #e4e4e7;
    border-radius: 999px;
    position: relative;
    transition: background 0.2s;
  }

  .kui-switch__track::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    transition: transform 0.2s;
  }

  .kui-switch input:checked + .kui-switch__track {
    background: linear-gradient(135deg, #a5b4fc, #6366f1);
  }

  .kui-switch input:checked + .kui-switch__track::after {
    transform: translateX(20px);
  }

  .kui-strong {
    margin: 0;
    font-weight: 700;
  }

  .danger {
    color: #b91c1c;
    border-color: rgba(239, 68, 68, 0.35);
  }
</style>
