<script lang="ts">
  import { Save, Crown, Zap, Sparkles, Calendar, Receipt, Settings, Check, Loader2 } from 'lucide-svelte';
  import {
    getBillingInfo,
    getSubscriptionDetails,
    getAvailablePlans,
    updateBillingEmail,
    upgradePlan,
    manageBilling
  } from '$lib/functions/settings.remote';

  // Data sources
  const billing = getBillingInfo();
  const subscription = getSubscriptionDetails();
  const plans = getAvailablePlans();

  // Derived data
  const billingData = $derived(billing.current || null);
  const subscriptionData = $derived(subscription.current || null);
  const plansData = $derived(plans.current || []);

  // Form state
  let billingForm = $state({
    billingEmail: ''
  });

  let pendingPriceId = $state<string | null>(null);

  function handlePlanSubmit(priceId: string) {
    pendingPriceId = priceId;
  }

  // Load billing data into form
  $effect(() => {
    if (billingData) {
      billingForm.billingEmail = billingData.billingEmail || '';
    }
  });

  $effect(() => {
    if (!upgradePlan.pending) {
      pendingPriceId = null;
    }
  });

  $effect(() => {
    const checkoutUrl = upgradePlan.result?.checkoutUrl;
    if (upgradePlan.result?.success && checkoutUrl) {
      window.location.href = checkoutUrl;
    }
  });

  $effect(() => {
    const portalUrl = manageBilling.result?.portalUrl;
    if (manageBilling.result?.success && portalUrl) {
      window.location.href = portalUrl;
    }
  });
</script>

<svelte:head>
  <title>Billing - Kuratchi Dashboard</title>
</svelte:head>

<div class="space-y-6">
  <!-- Current Plan Card -->
  <div class="card bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 shadow-lg">
    <div class="card-body">
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center gap-3">
          {#if subscriptionData?.plan === 'free'}
            <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-base-100">
              <Zap class="h-6 w-6 text-base-content/60" />
            </div>
          {:else if subscriptionData?.plan === 'pro'}
            <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20">
              <Crown class="h-6 w-6 text-primary" />
            </div>
          {:else}
            <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/20">
              <Sparkles class="h-6 w-6 text-accent" />
            </div>
          {/if}
          <div>
            <h3 class="text-2xl font-bold capitalize">{subscriptionData?.plan || 'Free'} Plan</h3>
            {#if subscriptionData?.hasSubscription}
              <div class="flex items-center gap-2 mt-1">
                <span class="badge badge-success badge-sm">
                  {subscriptionData.status}
                </span>
                {#if subscriptionData.cancelAtPeriodEnd}
                  <span class="badge badge-warning badge-sm">Cancels at period end</span>
                {/if}
              </div>
            {/if}
          </div>
        </div>
        
        {#if !subscriptionData?.hasSubscription}
          <a href="#plans" class="btn btn-primary gap-2">
            <Crown class="h-4 w-4" />
            Upgrade
          </a>
        {:else}
          <form {...manageBilling}>
            <button
              type="submit"
              class="btn btn-outline gap-2"
              aria-busy={!!manageBilling.pending}
              disabled={!!manageBilling.pending}
            >
              {#if manageBilling.pending}
                <Loader2 class="h-4 w-4 animate-spin" />
              {:else}
                <Settings class="h-4 w-4" />
              {/if}
              {manageBilling.pending ? 'Opening Portal...' : 'Manage Billing'}
            </button>
          </form>
        {/if}
      </div>

      {#if subscriptionData?.hasSubscription && subscriptionData.currentPeriodEnd}
        <div class="flex items-center gap-2 text-sm text-base-content/70">
          <Calendar class="h-4 w-4" />
          <span>
            {subscriptionData.cancelAtPeriodEnd ? 'Access until' : 'Renews on'}
            {new Date(subscriptionData.currentPeriodEnd).toLocaleDateString('en-US', { 
              month: 'long', 
              day: 'numeric', 
              year: 'numeric' 
            })}
          </span>
        </div>
      {/if}

      {#if !subscriptionData?.hasSubscription}
        <div class="mt-4 p-4 bg-base-100 rounded-lg">
          <p class="text-sm text-base-content/70">
            Choose a plan below to unlock premium features tailored to your team.
          </p>
        </div>
      {/if}
    </div>
  </div>

  <!-- Plan Comparison -->
  {#if plansData.length > 0}
    <div id="plans" class="card bg-base-100 shadow-sm">
      <div class="card-body">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold">Choose Your Plan</h3>
          {#if subscriptionData?.hasSubscription}
            <span class="text-sm text-base-content/60">
              Current plan: {subscriptionData.planName || subscriptionData.plan}
            </span>
          {/if}
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          {#each plansData as plan, index}
            {@const monthlyPrice = plan.prices.find((p: any) => p.interval === 'month')}
            {@const primaryPrice = monthlyPrice ?? plan.prices[0]}
            {@const isPopular = index === 1}
            {@const isCurrentPlan = subscriptionData?.productId === plan.id}
            {@const isCurrentPrice = subscriptionData?.priceId === primaryPrice?.id}
            {@const borderClass = isCurrentPlan
              ? 'border border-success border-2'
              : isPopular
                ? 'border border-primary border-2'
                : 'border border-base-300'}
            <div class={`rounded-lg p-6 hover:border-primary transition-colors relative ${borderClass}`}>
              {#if isPopular}
                <div class="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span class="badge badge-primary">Most Popular</span>
                </div>
              {/if}
              {#if isCurrentPlan}
                <div class="absolute top-4 right-4">
                  <span class="badge badge-success gap-1">
                    <Check class="h-3 w-3" />
                    Current Plan
                  </span>
                </div>
              {/if}
              <div class="flex items-center gap-2 mb-2">
                {#if index === 0}
                  <Zap class="h-5 w-5 text-base-content/60" />
                {:else if index === 1}
                  <Crown class="h-5 w-5 text-primary" />
                {:else}
                  <Sparkles class="h-5 w-5 text-accent" />
                {/if}
                <h4 class="font-bold">{plan.name}</h4>
              </div>
              {#if primaryPrice}
                <div class="mb-4">
                  <span class="text-3xl font-bold">
                    {(primaryPrice.amount / 100).toLocaleString(undefined, {
                      style: 'currency',
                      currency: (primaryPrice.currency || 'usd').toUpperCase()
                    })}
                  </span>
                  {#if primaryPrice.interval === 'month'}
                    <span class="text-base-content/60">/month</span>
                  {:else if primaryPrice.interval === 'year'}
                    <span class="text-base-content/60">/year</span>
                  {:else}
                    <span class="text-base-content/60">/{primaryPrice.interval}</span>
                  {/if}
                </div>
              {/if}
              {#if plan.description}
                <p class="text-sm text-base-content/60 mb-4">{plan.description}</p>
              {/if}
              {#if plan.features.length > 0}
                <ul class="space-y-2 mb-6 text-sm">
                  {#each plan.features as feature}
                    <li class="flex items-start gap-2">
                      <Check class="h-4 w-4 text-success mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  {/each}
                </ul>
              {/if}
              {#if primaryPrice}
                <form {...upgradePlan}>
                  <input type="hidden" name="priceId" value={primaryPrice.id} />
                  <button
                    type="submit"
                    class={`btn w-full ${isCurrentPlan ? 'btn-disabled' : isPopular ? 'btn-primary' : 'btn-outline'}`}
                    disabled={isCurrentPrice || !!upgradePlan.pending}
                    aria-busy={pendingPriceId === primaryPrice.id && !!upgradePlan.pending}
                    on:click={() => handlePlanSubmit(primaryPrice.id)}
                  >
                    {#if isCurrentPrice}
                      <span class="flex items-center gap-2 justify-center">
                        <Check class="h-4 w-4" />
                        Current Plan
                      </span>
                    {:else if upgradePlan.pending && pendingPriceId === primaryPrice.id}
                      <span class="flex items-center gap-2 justify-center">
                        <Loader2 class="h-4 w-4 animate-spin" />
                        Processing...
                      </span>
                    {:else if subscriptionData?.hasSubscription}
                      Switch to {plan.name}
                    {:else}
                      Choose {plan.name}
                    {/if}
                  </button>
                </form>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>
  {:else}
    <div class="card bg-base-100 shadow-sm">
      <div class="card-body text-center py-8">
        <p class="text-base-content/60">No plans available. Create products in the Products page.</p>
        <a href="/products" class="btn btn-primary mx-auto mt-4">Manage Products</a>
      </div>
    </div>
  {/if}

  <!-- Billing Email -->
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body">
      <h3 class="text-lg font-bold mb-4">Billing Email</h3>
      <form {...updateBillingEmail} class="space-y-4">
        <div class="form-control">
          <label class="label" for="billing-email">
            <span class="label-text">Email for invoices and receipts</span>
          </label>
          <input
            id="billing-email"
            type="email"
            name="billingEmail"
            class="input input-bordered"
            bind:value={billingForm.billingEmail}
            required
          />
        </div>

        <div class="flex justify-end">
          <button type="submit" class="btn btn-primary">
            <Save class="h-4 w-4 mr-2" />
            Update Billing Email
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- Billing History -->
  {#if subscriptionData?.hasSubscription}
    <div class="card bg-base-100 shadow-sm">
      <div class="card-body">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold">Billing History</h3>
          <form {...manageBilling}>
            <button type="submit" class="btn btn-ghost btn-sm gap-2">
              <Receipt class="h-4 w-4" />
              View All Invoices
            </button>
          </form>
        </div>
        <div class="text-center py-8 text-base-content/60">
          <Receipt class="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>View your invoices in the billing portal</p>
        </div>
      </div>
    </div>
  {/if}
</div>
