# Stripe Integration

Complete payment and subscription management for your SvelteKit app.

## Features

- **Customer Management** - Create, update, retrieve customers
- **Subscriptions** - Full lifecycle management (create, update, cancel, resume)
- **Checkout Sessions** - Redirect users to Stripe Checkout
- **Billing Portal** - Customer self-service portal
- **Automatic Callback Handling** - SDK handles Stripe redirects automatically
- **Database Syncing** - All Stripe data synced to local database
- **Event Tracking** - Audit trail of all Stripe events

## Configuration

```typescript
// hooks.server.ts
import { kuratchi } from 'kuratchi-sdk';
import { env } from '$env/dynamic/private';

export const { handle } = kuratchi({
  stripe: {
    apiKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET, // Optional, for webhook verification
    trackEvents: true, // Track all events in DB (default: true)
    trackingDb: 'admin', // Store in admin or org DB (default: 'admin')
    callbackPath: '/kuratchi/stripe/callback', // Callback route (default shown)
    tables: {
      customers: 'stripeCustomers', // Customize table names
      subscriptions: 'stripeSubscriptions',
      events: 'stripeEvents',
      invoices: 'stripeInvoices'
    }
  }
});
```

## Usage

### Create a Customer

```typescript
import { stripe } from 'kuratchi-sdk';

// In a server route or action
const customer = await stripe.createCustomer(event, {
  email: user.email,
  name: user.name,
  userId: user.id,
  metadata: { source: 'signup' }
});
```

### Create Checkout Session

```typescript
import { stripe } from 'kuratchi-sdk';
import { redirect } from '@sveltejs/kit';

// In a form action
export const actions = {
  subscribe: async (event) => {
    const checkoutUrl = await stripe.createCheckout(event, {
      priceId: 'price_xxx', // Your Stripe price ID
      customerId: customer.stripeCustomerId,
      successPath: '/dashboard', // Where to redirect after success
      cancelPath: '/pricing', // Where to redirect if canceled
      mode: 'subscription',
      trialPeriodDays: 14,
      allowPromotionCodes: true
    });
    
    // Redirect user to Stripe Checkout
    throw redirect(303, checkoutUrl);
  }
};
```

**The SDK automatically handles the callback!** When the user completes payment:
1. Stripe redirects to `/kuratchi/stripe/callback`
2. SDK verifies the session
3. SDK saves customer & subscription to your database
4. SDK redirects to your `successPath`

### Query Subscriptions

```typescript
import { stripe } from 'kuratchi-sdk';

// Get all subscriptions for a customer
const subscriptions = await stripe.getCustomerSubscriptions(event, customerId);

// Get active subscription
const active = await stripe.getActiveSubscription(event, customerId);

// Get specific subscription
const sub = await stripe.getSubscription(event, subscriptionId);
```

### Update Subscription (Change Plan)

```typescript
import { stripe } from 'kuratchi-sdk';

// Change to a different price
await stripe.updateSubscription(event, subscriptionId, {
  priceId: 'price_new_plan',
  prorationBehavior: 'create_prorations' // Prorate the difference
});
```

### Cancel Subscription

```typescript
import { stripe } from 'kuratchi-sdk';

// Cancel at period end (user keeps access until end of billing period)
await stripe.cancelSubscription(event, subscriptionId, false);

// Cancel immediately
await stripe.cancelSubscription(event, subscriptionId, true);
```

### Resume Canceled Subscription

```typescript
import { stripe } from 'kuratchi-sdk';

// Resume a subscription that was set to cancel at period end
await stripe.resumeSubscription(event, subscriptionId);
```

### Billing Portal

```typescript
import { stripe } from 'kuratchi-sdk';
import { redirect } from '@sveltejs/kit';

// Let customers manage their subscription
export const actions = {
  portal: async (event) => {
    const portalUrl = await stripe.createPortalSession(event, {
      customerId: customer.stripeCustomerId,
      returnPath: '/settings/billing'
    });
    
    throw redirect(303, portalUrl);
  }
};
```

## Database Schema

The SDK expects these tables in your database:

### stripeCustomers
```typescript
{
  id: string;
  stripeCustomerId: string;
  email: string;
  name?: string;
  userId?: string;
  organizationId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  deleted_at?: string;
}
```

### stripeSubscriptions
```typescript
{
  id: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: string; // active, canceled, past_due, etc.
  priceId: string;
  productId: string;
  quantity: number;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialStart?: string;
  trialEnd?: string;
  canceledAt?: string;
  endedAt?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  deleted_at?: string;
}
```

### stripeEvents
```typescript
{
  id: string;
  stripeEventId: string;
  type: string; // checkout.session.completed, etc.
  data: Record<string, any>;
  processed: boolean;
  error?: string;
  createdAt: string;
}
```

## Example: Complete Subscription Flow

```typescript
// routes/pricing/+page.server.ts
import { stripe } from 'kuratchi-sdk';
import { redirect } from '@sveltejs/kit';

export const actions = {
  subscribe: async (event) => {
    const user = event.locals.user;
    
    // Get or create customer
    let customer = await stripe.getCustomerByUserId(event, user.id);
    if (!customer) {
      customer = await stripe.createCustomer(event, {
        email: user.email,
        name: user.name,
        userId: user.id
      });
    }
    
    // Create checkout session
    const checkoutUrl = await stripe.createCheckout(event, {
      priceId: 'price_xxx',
      customerId: customer.stripeCustomerId,
      successPath: '/dashboard?subscribed=true',
      cancelPath: '/pricing?canceled=true',
      mode: 'subscription',
      trialPeriodDays: 14
    });
    
    throw redirect(303, checkoutUrl);
  }
};
```

```typescript
// routes/dashboard/+page.server.ts
import { stripe } from 'kuratchi-sdk';

export const load = async (event) => {
  const user = event.locals.user;
  
  // Get customer
  const customer = await stripe.getCustomerByUserId(event, user.id);
  if (!customer) {
    return { subscription: null };
  }
  
  // Get active subscription
  const subscription = await stripe.getActiveSubscription(event, customer.stripeCustomerId);
  
  return {
    subscription
  };
};
```

## Type Safety

All methods are fully typed:

```typescript
import type {
  StripeCustomerRecord,
  StripeSubscriptionRecord,
  CreateCheckoutOptions,
  UpdateSubscriptionOptions
} from 'kuratchi-sdk';
```

## Notes

- The SDK uses the latest Stripe API version
- All Stripe operations are automatically tracked in your database
- The callback route is handled internally - no manual endpoint needed
- Type errors about `event.locals.kuratchi` are expected and safe (runtime types)
