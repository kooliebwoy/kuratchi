// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			// Exposed KuratchiAuth instance for this request
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			kuratchi?: any;
			// Organization-scoped AuthService, set when a valid session is present
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			auth: any | null;
			// Current authenticated user (shape depends on your schema)
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			user: any | null;
			// Session data parsed from cookie
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			session: any | null;
			setSessionCookie: (value: string, opts?: { expires?: Date }) => void;
			clearSessionCookie: () => void;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Ambient Buffer declarations to satisfy TypeScript when Node types
	// aren't available (e.g., Cloudflare Workers). These are type-only
	// fallbacks; at runtime we always guard with `typeof Buffer !== 'undefined'`.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const Buffer: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type Buffer = any;
}

// Minimal ambient module declaration for 'stripe' so TS doesn't require the stripe package/types during SDK dev
declare module 'stripe' {
  // A minimal class shape used at runtime. Methods are typed as any.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  class Stripe {
    constructor(apiKey: string, config?: any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webhooks: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    customers: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subscriptions: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    checkout: { sessions: any };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    billingPortal: { sessions: any };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prices: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subscriptionItems: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paymentMethods: any;
  }

  // Namespace to support type references like Stripe.Subscription
  namespace Stripe {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Customer = any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Subscription = any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Price = any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Invoice = any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type UsageRecord = any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type PaymentMethod = any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Event = any;
    interface StripeError {
      code?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [k: string]: any;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    interface PriceListParams { [k: string]: any }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    interface SubscriptionCreateParams { [k: string]: any }
    namespace SubscriptionUpdateParams {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type ProrationBehavior = any;
    }
    namespace Checkout {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type Session = any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type SessionCreateParams = any;
    }
    namespace BillingPortal {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type Session = any;
    }
  }

  export = Stripe;
}

export {};
