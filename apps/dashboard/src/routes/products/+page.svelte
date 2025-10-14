<script lang="ts">
  import { Package, Plus, Edit, Archive, DollarSign, Check, X } from 'lucide-svelte';
  import { Dialog, FormField, FormInput, FormTextarea, FormSelect } from '@kuratchi/ui';
  import {
    getProducts,
    createProduct,
    updateProduct,
    archiveProduct,
    createPrice,
    archivePrice
  } from '$lib/api/products.remote';

  // Data
  const products = getProducts();
  const productsData = $derived(products.current || []);

  // Modals
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

<div class="p-8">
  <!-- Header -->
  <div class="mb-8 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
        <Package class="h-6 w-6 text-primary" />
      </div>
      <div>
        <h1 class="text-2xl font-bold">Products & Pricing</h1>
        <p class="text-sm text-base-content/70">Manage your Stripe products and pricing</p>
      </div>
    </div>
    <button class="btn btn-primary gap-2" onclick={openCreateProduct}>
      <Plus class="h-4 w-4" />
      Create Product
    </button>
  </div>

  <!-- Products Grid -->
  {#if productsData.length === 0}
    <div class="card bg-base-100 shadow-sm">
      <div class="card-body text-center py-16">
        <Package class="h-16 w-16 mx-auto mb-4 opacity-30" />
        <h3 class="text-lg font-bold mb-2">No products yet</h3>
        <p class="text-base-content/60 mb-6">Create your first product to start accepting payments</p>
        <button class="btn btn-primary mx-auto gap-2" onclick={openCreateProduct}>
          <Plus class="h-4 w-4" />
          Create Product
        </button>
      </div>
    </div>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {#each productsData as product}
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <!-- Product Header -->
            <div class="flex items-start justify-between mb-4">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <h3 class="text-lg font-bold">{product.name}</h3>
                  {#if product.active}
                    <span class="badge badge-success badge-sm">Active</span>
                  {:else}
                    <span class="badge badge-ghost badge-sm">Archived</span>
                  {/if}
                </div>
                {#if product.description}
                  <p class="text-sm text-base-content/60">{product.description}</p>
                {/if}
              </div>
              <div class="dropdown dropdown-end">
                <button tabindex="0" class="btn btn-ghost btn-sm btn-circle">
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
                <ul tabindex="0" class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52 z-10">
                  <li>
                    <form {...archiveProduct}>
                      <input type="hidden" name="productId" value={product.id} />
                      <button type="submit" class="text-error">
                        <Archive class="h-4 w-4" />
                        Archive Product
                      </button>
                    </form>
                  </li>
                </ul>
              </div>
            </div>

            <!-- Features -->
            {#if product.features && product.features.length > 0}
              <div class="mb-4">
                <p class="text-xs font-semibold text-base-content/70 mb-2">FEATURES</p>
                <ul class="space-y-1">
                  {#each product.features as feature}
                    <li class="flex items-center gap-2 text-sm">
                      <Check class="h-3 w-3 text-success" />
                      <span>{feature}</span>
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}

            <!-- Prices -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <p class="text-xs font-semibold text-base-content/70">PRICING</p>
                <button 
                  class="btn btn-ghost btn-xs gap-1" 
                  onclick={() => openCreatePrice(product)}
                >
                  <Plus class="h-3 w-3" />
                  Add Price
                </button>
              </div>
              
              {#if product.prices.length === 0}
                <p class="text-sm text-base-content/60 italic">No prices configured</p>
              {:else}
                <div class="space-y-2">
                  {#each product.prices as price}
                    <div class="flex items-center justify-between p-3 bg-base-200 rounded-lg">
                      <div>
                        <p class="font-bold">{formatPrice(price.unitAmount, price.currency)}</p>
                        <p class="text-xs text-base-content/60">{formatInterval(price.recurring)}</p>
                      </div>
                      <div class="flex items-center gap-2">
                        {#if price.active}
                          <span class="badge badge-success badge-xs">Active</span>
                        {:else}
                          <span class="badge badge-ghost badge-xs">Inactive</span>
                        {/if}
                        <form {...archivePrice}>
                          <input type="hidden" name="priceId" value={price.id} />
                          <button type="submit" class="btn btn-ghost btn-xs btn-circle">
                            <X class="h-3 w-3" />
                          </button>
                        </form>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>

            <!-- Product ID (for reference) -->
            <div class="mt-4 pt-4 border-t border-base-300">
              <p class="text-xs text-base-content/50">
                Product ID: <code class="text-xs">{product.id}</code>
              </p>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Create Product Dialog -->
{#if showCreateProductModal}
  <Dialog bind:open={showCreateProductModal} size="md" onClose={closeProductModal} class="rounded-2xl border border-base-200 shadow-xl" backdropClass="bg-black/40 backdrop-blur-sm">
    {#snippet header()}
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-lg">Create Product</h3>
        <button
          class="btn btn-ghost btn-sm btn-circle"
          type="button"
          onclick={closeProductModal}
          aria-label="Close"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    {/snippet}
    {#snippet children()}
      <form {...createProduct} class="space-y-4" onsubmit={closeProductModal}>
        <FormField 
          label="Product Name" 
          issues={createProduct.fields.name.issues()}
        >
          <FormInput 
            field={createProduct.fields.name} 
            placeholder="Pro Plan"
          />
        </FormField>

        <FormField 
          label="Description (optional)" 
          issues={createProduct.fields.description.issues()}
        >
          <FormTextarea 
            field={createProduct.fields.description} 
            placeholder="Perfect for growing teams"
            rows={2}
          />
        </FormField>

        <FormField 
          label="Features (optional, one per line)" 
          issues={createProduct.fields.features.issues()}
        >
          <FormTextarea 
            field={createProduct.fields.features} 
            placeholder="Unlimited projects&#10;Advanced analytics&#10;Priority support"
            rows={4}
            class="font-mono text-sm"
          />
        </FormField>

        <div class="modal-action">
          <button
            type="button"
            class="btn"
            onclick={closeProductModal}
          >
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" aria-busy={!!createProduct.pending} disabled={!!createProduct.pending}>
            Create Product
          </button>
        </div>
      </form>
    {/snippet}
  </Dialog>
{/if}

<!-- Create Price Dialog -->
{#if showCreatePriceModal && selectedProduct}
  <Dialog bind:open={showCreatePriceModal} size="md" onClose={closePriceModal} class="rounded-2xl border border-base-200 shadow-xl" backdropClass="bg-black/40 backdrop-blur-sm">
    {#snippet header()}
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-lg">Add Price to {selectedProduct.name}</h3>
        <button
          class="btn btn-ghost btn-sm btn-circle"
          type="button"
          onclick={closePriceModal}
          aria-label="Close"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    {/snippet}
    {#snippet children()}
      <form {...createPrice} class="space-y-4" onsubmit={closePriceModal}>
        <input type="hidden" name="productId" value={selectedProduct.id} />

        <FormField 
          label="Price Amount" 
          issues={createPrice.fields.amount.issues()}
        >
          <div class="join w-full">
            <span class="join-item btn btn-disabled">$</span>
            <FormInput 
              field={createPrice.fields.amount} 
              type="number"
              placeholder="29.00"
              class="join-item flex-1"
            />
          </div>
        </FormField>

        <FormField 
          label="Billing Interval" 
          issues={createPrice.fields.interval.issues()}
        >
          <FormSelect field={createPrice.fields.interval}>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
            <option value="week">Weekly</option>
            <option value="day">Daily</option>
          </FormSelect>
        </FormField>

        <div class="modal-action">
          <button
            type="button"
            class="btn"
            onclick={closePriceModal}
          >
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" aria-busy={!!createPrice.pending} disabled={!!createPrice.pending}>
            Create Price
          </button>
        </div>
      </form>
    {/snippet}
  </Dialog>
{/if}
