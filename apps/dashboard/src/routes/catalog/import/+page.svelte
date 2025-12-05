<script lang="ts">
  import { Card, Button } from '@kuratchi/ui';
  import { Upload, FileText, AlertCircle } from '@lucide/svelte';
</script>

<svelte:head>
  <title>Import - Catalog Management</title>
</svelte:head>

<div class="import-page">
  <!-- Header -->
  <div class="page-header">
    <h2>Import Catalog Data</h2>
    <p class="subtext">Bulk import vehicles and OEM data</p>
  </div>

  <!-- Import Options -->
  <div class="import-options">
    <!-- CSV Import -->
    <Card class="import-card">
      <div class="import-card-content">
        <div class="import-icon">
          <FileText class="icon" />
        </div>
        <div class="import-info">
          <h3>CSV Import</h3>
          <p class="import-description">Import vehicles from a CSV file</p>
        </div>
        <Button variant="primary" size="sm" disabled>
          Coming Soon
        </Button>
      </div>
    </Card>

    <!-- PDF Import -->
    <Card class="import-card">
      <div class="import-card-content">
        <div class="import-icon">
          <Upload class="icon" />
        </div>
        <div class="import-info">
          <h3>PDF Specifications</h3>
          <p class="import-description">Extract data from OEM PDFs</p>
        </div>
        <Button variant="primary" size="sm" disabled>
          Coming Soon
        </Button>
      </div>
    </Card>
  </div>

  <!-- Info Card -->
  <Card class="info-card">
    <div class="info-content">
      <AlertCircle class="info-icon" />
      <div class="info-text">
        <p class="info-title">Bulk import features coming soon</p>
        <p class="info-description">For now, use the Vehicles tab to add vehicles one at a time via URL scraping.</p>
      </div>
    </div>
  </Card>
</div>

<style>
  .import-page {
    display: flex;
    flex-direction: column;
    gap: var(--kui-spacing-lg);
  }

  .page-header h2 {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
  }

  .subtext {
    color: var(--kui-color-muted);
    font-size: 0.875rem;
    margin: 0.25rem 0 0;
  }

  .import-options {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--kui-spacing-md);
  }

  @media (min-width: 768px) {
    .import-options {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  :global(.import-card) {
    padding: var(--kui-spacing-lg);
    cursor: pointer;
    transition: box-shadow 0.2s ease;
  }

  :global(.import-card:hover) {
    box-shadow: var(--kui-shadow-lg);
  }

  .import-card-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--kui-spacing-md);
  }

  .import-icon {
    display: flex;
    height: 3rem;
    width: 3rem;
    align-items: center;
    justify-content: center;
    border-radius: var(--kui-radius-md);
    background: color-mix(in srgb, var(--kui-color-primary) 10%, transparent);
    color: var(--kui-color-primary);
  }

  
  .import-info h3 {
    font-weight: 700;
    margin: 0;
  }

  .import-description {
    color: var(--kui-color-muted);
    font-size: 0.875rem;
    margin: 0.25rem 0 0;
  }

  :global(.info-card) {
    padding: var(--kui-spacing-md);
    background: color-mix(in srgb, var(--kui-color-info) 5%, transparent);
    border: 1px solid color-mix(in srgb, var(--kui-color-info) 20%, transparent);
  }

  .info-content {
    display: flex;
    gap: var(--kui-spacing-sm);
  }

  .info-text {
    font-size: 0.875rem;
  }

  .info-title {
    font-weight: 600;
    color: var(--kui-color-info);
    margin: 0 0 0.25rem;
  }

  .info-description {
    color: color-mix(in srgb, var(--kui-color-text) 70%, transparent);
    margin: 0;
  }
</style>
