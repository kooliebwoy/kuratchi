<script lang="ts">
  import { Button, Card, Dialog, FormField, FormInput, FormSelect, FormTextarea, Badge } from '@kuratchi/ui';
  import { Package, Plus, Archive, Check, X } from 'lucide-svelte';
  import { getProducts, createProduct, archiveProduct, createPrice, archivePrice } from '$lib/functions/products.remote';

  const products = getProducts();
  const productsData = $derived(products.current || []);

  let showCreateProductModal = $state(false);
  let showCreatePriceModal = $state(false);
  let selectedProduct = $state<any>(null);

  function openCreateProduct() {
    showCreateProductModal = true;
  }

  function openCreatePrice(product: any) {
    selectedProduct = product;
    showCreatePriceModal = true;
  }

  function closeProductModal() {
    showCreateProductModal = false;
  }

  function closePriceModal() {
    showCreatePriceModal = false;
    selectedProduct = null;
  }

  function formatPrice(amount: number, currency: string) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100);
  }

  function formatInterval(recurring: any) {
    if (!recurring) return 'One-time';
    const count = recurring.interval_count || 1;
    const interval = recurring.interval;
    return count === 1 ? `per ${interval}` : `every ${count} ${interval}s`;
  }
</script>

<svelte:head>
  <title>Products & Pricing - Kuratchi Dashboard</title>
</svelte:head>

<div class="kui-products">
  <header class="kui-products__header">
    <div class="kui-inline">
      <div class="kui-icon-box">
        <Package />
      </div>
      <div>
        <p class="kui-eyebrow">Billing</p>
        <h1>Products & Pricing</h1>
        <p class="kui-subtext">Manage Stripe products, plans, and recurring prices.</p>
      </div>
    </div>
    <Button variant="primary" size="sm" onclick={openCreateProduct}>
      <Plus class="kui-icon" />
      Create product
    </Button>
  </header>

  {#if productsData.length === 0}
    <Card class="kui-empty-card">
      <div class="kui-empty">
        <div class="kui-icon-hero">
          <Package />
        </div>
        <h3>No products yet</h3>
        <p class="kui-subtext">Create your first product to start accepting payments.</p>
        <Button variant="primary" size="sm" onclick={openCreateProduct}>
          <Plus class="kui-icon" />
          Create product
        </Button>
      </div>
    </Card>
  {:else}
    <div class="kui-product-grid">
      {#each productsData as product}
        <Card class="kui-product">
          <div class="kui-product__header">
            <div>
              <div class="kui-inline gap">
                <h3>{product.name}</h3>
                {#if product.active}
                  <Badge variant="primary" size="xs">Active</Badge>
                {:else}
                  <Badge variant="outline" size="xs">Archived</Badge>
                {/if}
              </div>
              {#if product.description}
                <p class="kui-subtext">{product.description}</p>
              {/if}
            </div>
            <form {...archiveProduct}>
              <input type="hidden" name="productId" value={product.id} />
              <Button variant="ghost" size="xs" aria-label="Archive product">
                <Archive class="kui-icon" />
              </Button>
            </form>
          </div>

          {#if product.features && product.features.length > 0}
            <div class="kui-feature-list">
              <p class="kui-eyebrow">Features</p>
              <ul>
                {#each product.features as feature}
                  <li><Check class="kui-icon" /> {feature}</li>
                {/each}
              </ul>
            </div>
          {/if}

          <div class="kui-price-block">
            <div class="kui-inline between">
              <p class="kui-eyebrow">Pricing</p>
              <Button variant="ghost" size="xs" onclick={() => openCreatePrice(product)}>
                <Plus class="kui-icon" /> Add price
              </Button>
            </div>

            {#if product.prices.length === 0}
              <p class="kui-subtext">No prices configured</p>
            {:else}
              <div class="kui-price-list">
                {#each product.prices as price}
                  <div class="kui-price-row">
                    <div>
                      <p class="kui-strong">{formatPrice(price.unitAmount, price.currency)}</p>
                      <p class="kui-subtext">{formatInterval(price.recurring)}</p>
                    </div>
                    <div class="kui-inline gap">
                      {#if price.active}
                        <Badge variant="primary" size="xs">Active</Badge>
                      {:else}
                        <Badge variant="outline" size="xs">Inactive</Badge>
                      {/if}
                      <form {...archivePrice}>
                        <input type="hidden" name="priceId" value={price.id} />
                        <Button variant="ghost" size="xs" aria-label="Archive price">
                          <X class="kui-icon" />
                        </Button>
                      </form>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <div class="kui-meta">
            <p class="kui-subtext">Product ID</p>
            <code>{product.id}</code>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</div>

{#if showCreateProductModal}
  <Dialog bind:open={showCreateProductModal} size="md" onClose={closeProductModal}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3>Create product</h3>
        <Button variant="ghost" size="xs" onclick={closeProductModal} aria-label="Close">
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <form {...createProduct} class="kui-stack" onsubmit={closeProductModal}>
        <FormField label="Product name" issues={createProduct.fields.name.issues()}>
          <FormInput field={createProduct.fields.name} placeholder="Pro Plan" />
        </FormField>

        <FormField label="Description (optional)" issues={createProduct.fields.description.issues()}>
          <FormTextarea
            field={createProduct.fields.description}
            placeholder="Perfect for growing teams"
            rows={2}
          />
        </FormField>

        <FormField label="Features (optional, one per line)" issues={createProduct.fields.features.issues()}>
          <FormTextarea
            field={createProduct.fields.features}
            placeholder="Unlimited projects&#10;Advanced analytics&#10;Priority support"
            rows={4}
            class="font-mono text-sm"
          />
        </FormField>

        {#snippet actions(close)}
          <Button variant="ghost" type="button" onclick={close}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!!createProduct.pending}>
            Create product
          </Button>
        {/snippet}
      </form>
    {/snippet}
  </Dialog>
{/if}

{#if showCreatePriceModal && selectedProduct}
  <Dialog bind:open={showCreatePriceModal} size="md" onClose={closePriceModal}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3>Add price to {selectedProduct.name}</h3>
        <Button variant="ghost" size="xs" onclick={closePriceModal} aria-label="Close">
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <form {...createPrice} class="kui-stack" onsubmit={closePriceModal}>
        <input type="hidden" name="productId" value={selectedProduct.id} />

        <FormField label="Price amount" issues={createPrice.fields.amount.issues()}>
          <div class="kui-input-group">
            <span class="prefix">$</span>
            <FormInput field={createPrice.fields.amount} type="number" placeholder="29.00" />
          </div>
        </FormField>

        <FormField label="Billing interval" issues={createPrice.fields.interval.issues()}>
          <FormSelect field={createPrice.fields.interval}>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
            <option value="week">Weekly</option>
            <option value="day">Daily</option>
          </FormSelect>
        </FormField>

        {#snippet actions(close)}
          <Button variant="ghost" type="button" onclick={close}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!!createPrice.pending}>
            Create price
          </Button>
        {/snippet}
      </form>
    {/snippet}
  </Dialog>
{/if}

<style>
  .kui-products {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .kui-products__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .kui-inline {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .kui-inline.between {
    justify-content: space-between;
    width: 100%;
  }

  .kui-inline.gap {
    gap: 8px;
    align-items: center;
  }

  .kui-icon-box {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #c7d2fe, #a5b4fc);
    color: #1d1b72;
  }

  h1 {
    margin: 0;
    font-size: 26px;
  }

  h3 {
    margin: 0;
    font-size: 18px;
  }

  .kui-eyebrow {
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #6b7280;
    margin: 0 0 6px;
  }

  .kui-subtext {
    color: #6b7280;
    margin: 0;
  }

  .kui-icon {
    width: 16px;
    height: 16px;
  }

  .kui-product-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 12px;
  }

  .kui-product {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .kui-product__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .kui-feature-list ul {
    list-style: none;
    padding: 0;
    margin: 8px 0 0;
    display: grid;
    gap: 6px;
  }

  .kui-feature-list li {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 10px;
    background: #f8fafc;
  }

  .kui-price-block {
    background: #f8fafc;
    border-radius: 12px;
    padding: 12px;
    border: 1px solid #e2e8f0;
    display: grid;
    gap: 10px;
  }

  .kui-price-list {
    display: grid;
    gap: 10px;
  }

  .kui-price-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: white;
    border-radius: 10px;
    padding: 10px 12px;
    border: 1px solid #e4e4e7;
  }

  .kui-strong {
    font-weight: 600;
    margin: 0;
  }

  .kui-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #f1f1f3;
    padding-top: 10px;
    font-size: 13px;
    color: #6b7280;
  }

  code {
    font-family: ui-monospace, SFMono-Regular, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    background: #f4f4f5;
    padding: 4px 6px;
    border-radius: 8px;
  }

  .kui-empty-card {
    padding: 24px;
  }

  .kui-empty {
    display: grid;
    gap: 10px;
    justify-items: center;
    text-align: center;
  }

  .kui-icon-hero {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    background: linear-gradient(135deg, #e9d5ff, #c084fc);
    display: grid;
    place-items: center;
    color: #3b0764;
  }

  .kui-icon-hero :global(svg) {
    width: 32px;
    height: 32px;
  }

  .kui-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .kui-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .kui-input-group {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border: 1px solid #e4e4e7;
    border-radius: 12px;
    background: white;
  }

  .kui-input-group .prefix {
    color: #6b7280;
    font-weight: 700;
  }
</style>
