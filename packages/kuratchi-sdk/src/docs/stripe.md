# Stripe

The Stripe plugin handles customers, subscriptions, checkout, portal sessions, products/prices, and webhook callbacks. Enable it through the `stripe` block when you call `kuratchi()` so the SvelteKit handle can intercept the callback route.

## Configure

```ts
import { kuratchi } from 'kuratchi-sdk';
import { sessionPlugin } from 'kuratchi-sdk/auth';

const app = kuratchi({
  auth: { plugins: [sessionPlugin()] },
  stripe: {
    apiKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    callbackPath: '/kuratchi/stripe/callback',
    trackEvents: true,
    trackingDb: 'admin'
  }
});

export const handle = app.handle;
```

`StripePluginOptions` (see `src/lib/stripe/types.ts`) also lets you override table names for stored records.

## Create customers and subscriptions

```ts
import { stripe } from 'kuratchi-sdk';

export const POST = async (event) => {
  const customer = await stripe.createCustomer(event, {
    email: event.locals.user!.email,
    userId: event.locals.user!.id
  });

  const subscription = await stripe.createSubscription(event, {
    customerId: customer.stripeCustomerId,
    priceId: process.env.STRIPE_PRICE_ID!
  });

  return new Response(JSON.stringify(subscription));
};
```

## Checkout and portal

```ts
// Start a checkout session
const checkout = await stripe.createCheckout(event, {
  priceId: process.env.STRIPE_PRICE_ID!,
  customerId: customer.stripeCustomerId,
  successPath: '/billing/success',
  cancelPath: '/billing'
});

// Direct link to the hosted billing portal
const portal = await stripe.createPortalSession(event, {
  customerId: customer.stripeCustomerId,
  returnPath: '/billing'
});
```

Webhook callbacks are routed through the SvelteKit handle. If you customize `callbackPath`, keep it in sync with your Stripe webhook configuration.
