<script lang="ts">
  import { Save, Crown, Zap, Sparkles, Calendar, Receipt, Settings, Check, Loader2 } from 'lucide-svelte';
  import { Button, Card, Badge, Loading, FormField, FormInput } from '@kuratchi/ui';
  import {
    getBillingInfo,
    getSubscriptionDetails,
    getAvailablePlans,
    updateBillingEmail,
    upgradePlan,
    manageBilling
  } from '$lib/functions/settings.remote';

  const billing = getBillingInfo();
  const subscription = getSubscriptionDetails();
  const plans = getAvailablePlans();

  const billingData = $derived(billing.current || null);
  const subscriptionData = $derived(subscription.current || null);
  const plansData = $derived(plans.current || []);

  let billingForm = $state({
    billingEmail: ''
  });

  let pendingPriceId = $state<string | null>(null);

  function handlePlanSubmit(priceId: string) {
    pendingPriceId = priceId;
  }

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

<div class="kui-billing">
  <header class="kui-billing__header">
    <div class="kui-inline">
      <div class="kui-icon-box">
        <Receipt />
      </div>
      <div>
        <p class="kui-eyebrow">Billing</p>
        <h1>Plans & Invoices</h1>
        <p class="kui-subtext">Manage your subscription, payment details, and billing history</p>
      </div>
    </div>
    {#if subscriptionData?.hasSubscription}
      <form {...manageBilling}>
        <Button type="submit" variant="outline" size="sm" disabled={!!manageBilling.pending} aria-busy={!!manageBilling.pending}>
          {#if manageBilling.pending}
            <Loader2 class="kui-icon spinning" />
            Opening Portal...
          {:else}
            <Settings class="kui-icon" />
            Manage Billing
          {/if}
        </Button>
      </form>
    {/if}
  </header>

  <Card class="kui-panel kui-current-plan">
    <div class="kui-current-plan__top">
      <div class="kui-inline">
        <div class="kui-plan-icon">
          {#if subscriptionData?.plan === 'free'}
            <Zap />
          {:else if subscriptionData?.plan === 'pro'}
            <Crown />
          {:else}
            <Sparkles />
          {/if}
        </div>
        <div>
          <h3 class="kui-plan-title">{subscriptionData?.planName || subscriptionData?.plan || 'Free'} Plan</h3>
          {#if subscriptionData?.hasSubscription}
            <div class="kui-inline">
              <Badge variant="success" size="xs">{subscriptionData.status}</Badge>
              {#if subscriptionData.cancelAtPeriodEnd}
                <Badge variant="warning" size="xs">Cancels at period end</Badge>
              {/if}
            </div>
          {/if}
        </div>
      </div>

      {#if !subscriptionData?.hasSubscription}
        <a href="#plans" class="kui-button kui-button--primary kui-button--size-sm">
          <Crown class="kui-icon" /> Upgrade
        </a>
      {/if}
    </div>

    {#if subscriptionData?.hasSubscription && subscriptionData.currentPeriodEnd}
      <div class="kui-inline">
        <Calendar class="kui-icon" />
        <span class="kui-subtext">
          {subscriptionData.cancelAtPeriodEnd ? 'Access until' : 'Renews on'}
          {new Date(subscriptionData.currentPeriodEnd).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          })}
        </span>
      </div>
    {:else}
      <p class="kui-subtext">Choose a plan below to unlock premium features tailored to your team.</p>
    {/if}
  </Card>

  {#if plansData.length > 0}
    <Card class="kui-panel" id="plans">
      <div class="kui-panel__header">
        <h3>Choose Your Plan</h3>
        {#if subscriptionData?.hasSubscription}
          <span class="kui-subtext">Current plan: {subscriptionData.planName || subscriptionData.plan}</span>
        {/if}
      </div>
      <div class="kui-plan-grid">
        {#each plansData as plan, index}
          {@const monthlyPrice = plan.prices.find((p: any) => p.interval === 'month')}
          {@const primaryPrice = monthlyPrice ?? plan.prices[0]}
          {@const isPopular = index === 1}
          {@const isCurrentPlan = subscriptionData?.productId === plan.id}
          {@const isCurrentPrice = subscriptionData?.priceId === primaryPrice?.id}
          <Card class={`kui-plan ${isPopular ? 'is-popular' : ''} ${isCurrentPlan ? 'is-current' : ''}`}>
            {#if isPopular}
              <Badge variant="primary" size="xs" class="kui-plan__badge">Most Popular</Badge>
            {/if}
            {#if isCurrentPlan}
              <Badge variant="success" size="xs" class="kui-plan__badge">Current Plan</Badge>
            {/if}
            <div class="kui-inline">
              {#if index === 0}
                <Zap class="kui-icon" />
              {:else if index === 1}
                <Crown class="kui-icon" />
              {:else}
                <Sparkles class="kui-icon" />
              {/if}
              <h4 class="kui-strong">{plan.name}</h4>
            </div>
            {#if primaryPrice}
              <div class="kui-price">
                <span class="kui-price__value">
                  {(primaryPrice.amount / 100).toLocaleString(undefined, {
                    style: 'currency',
                    currency: (primaryPrice.currency || 'usd').toUpperCase()
                  })}
                </span>
                <span class="kui-subtext">/{primaryPrice.interval}</span>
              </div>
            {/if}
            {#if plan.description}
              <p class="kui-subtext">{plan.description}</p>
            {/if}
            {#if plan.features.length > 0}
              <ul class="kui-feature-list">
                {#each plan.features as feature}
                  <li><Check class="kui-icon" /> {feature}</li>
                {/each}
              </ul>
            {/if}

            {#if primaryPrice}
              <form {...upgradePlan}>
                <input type="hidden" name="priceId" value={primaryPrice.id} />
                <Button
                  type="submit"
                  variant={isPopular ? 'primary' : 'outline'}
                  block
                  disabled={isCurrentPrice || !!upgradePlan.pending}
                  aria-busy={pendingPriceId === primaryPrice.id && !!upgradePlan.pending}
                  onclick={() => handlePlanSubmit(primaryPrice.id)}
                >
                  {#if isCurrentPrice}
                    <Check class="kui-icon" /> Current Plan
                  {:else if upgradePlan.pending && pendingPriceId === primaryPrice.id}
                    <Loader2 class="kui-icon spinning" /> Processing...
                  {:else if subscriptionData?.hasSubscription}
                    Switch to {plan.name}
                  {:else}
                    Choose {plan.name}
                  {/if}
                </Button>
              </form>
            {/if}
          </Card>
        {/each}
      </div>
    </Card>
  {:else}
    <Card class="kui-panel center">
      <p class="kui-subtext">No plans available. Create products in the Products page.</p>
      <a class="kui-button kui-button--primary" href="/products">Manage Products</a>
    </Card>
  {/if}

  <Card class="kui-panel">
    <h3>Billing Email</h3>
    <form {...updateBillingEmail} class="kui-stack">
      <FormField label="Email for invoices and receipts" issues={updateBillingEmail.fields.billingEmail.issues()}>
        <FormInput field={updateBillingEmail.fields.billingEmail} type="email" bind:value={billingForm.billingEmail} />
      </FormField>
      <div class="kui-inline end">
        <Button type="submit" variant="primary">
          <Save class="kui-icon" />
          Update Billing Email
        </Button>
      </div>
    </form>
  </Card>

  {#if subscriptionData?.hasSubscription}
    <Card class="kui-panel">
      <div class="kui-panel__header">
        <h3>Billing History</h3>
        <form {...manageBilling}>
          <Button variant="ghost" size="sm" type="submit">
            <Receipt class="kui-icon" />
            View All Invoices
          </Button>
        </form>
      </div>
      <div class="kui-center">
        <Receipt class="kui-empty__icon" />
        <p class="kui-subtext">View your invoices in the billing portal</p>
      </div>
    </Card>
  {/if}
</div>

<style>
  .kui-billing {
    display: grid;
    gap: var(--kui-spacing-md);
  }

  .kui-billing__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--kui-spacing-md);
    flex-wrap: wrap;
  }

  h1 {
    margin: 0.1rem 0 0.25rem;
  }

  .kui-icon-box {
    width: 3rem;
    height: 3rem;
    border-radius: var(--kui-radius-lg);
    display: grid;
    place-items: center;
    background: var(--kui-color-primary-weak);
    color: var(--kui-color-primary);
  }

  .kui-eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--kui-color-muted);
    font-weight: 700;
    margin: 0;
    font-size: 0.8rem;
  }

  .kui-subtext {
    color: var(--kui-color-muted);
    margin: 0;
  }

  .kui-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  .kui-inline.end {
    justify-content: flex-end;
  }

  .kui-panel .kui-card__body {
    gap: var(--kui-spacing-md);
  }

  .kui-current-plan {
    background: linear-gradient(135deg, rgba(88, 76, 217, 0.12), rgba(88, 76, 217, 0.05));
    border: 1px solid color-mix(in srgb, var(--kui-color-primary) 30%, var(--kui-color-border) 70%);
  }

  .kui-current-plan__top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--kui-spacing-md);
    flex-wrap: wrap;
  }

  .kui-plan-icon {
    width: 3rem;
    height: 3rem;
    border-radius: var(--kui-radius-lg);
    display: grid;
    place-items: center;
    background: var(--kui-color-surface);
    border: 1px solid var(--kui-color-border);
  }

  .kui-plan-title {
    margin: 0;
    font-size: 1.3rem;
  }

  .kui-plan-grid {
    display: grid;
    gap: var(--kui-spacing-sm);
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }

  .kui-plan {
    position: relative;
    min-height: 100%;
  }

  .kui-plan__badge {
    position: absolute;
    top: var(--kui-spacing-sm);
    right: var(--kui-spacing-sm);
  }

  .kui-plan.is-popular {
    border: 1px solid color-mix(in srgb, var(--kui-color-primary) 40%, var(--kui-color-border) 60%);
    box-shadow: var(--kui-shadow-sm);
  }

  .kui-plan.is-current {
    border: 1px solid color-mix(in srgb, var(--kui-color-success) 40%, var(--kui-color-border) 60%);
  }

  .kui-price {
    display: flex;
    align-items: baseline;
    gap: 0.2rem;
  }

  .kui-price__value {
    font-size: 1.6rem;
    font-weight: 800;
  }

  .kui-feature-list {
    list-style: none;
    padding: 0;
    margin: 0.75rem 0;
    display: grid;
    gap: 0.45rem;
  }

  .kui-feature-list li {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .kui-button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    padding: 0.45rem 0.75rem;
    text-decoration: none;
  }

  .kui-button--primary {
    background: var(--kui-color-primary);
    color: #fff;
    border-color: var(--kui-color-primary);
  }

  .kui-button--size-sm {
    padding: 0.35rem 0.65rem;
    font-size: 0.9rem;
  }

  .kui-center {
    display: grid;
    place-items: center;
    gap: 0.35rem;
    text-align: center;
    padding: var(--kui-spacing-lg);
  }

  .kui-empty__icon {
    width: 3rem;
    height: 3rem;
    color: var(--kui-color-muted);
  }

  .kui-icon {
    width: 1rem;
    height: 1rem;
  }

  .kui-icon.spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 720px) {
    .kui-current-plan__top {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
