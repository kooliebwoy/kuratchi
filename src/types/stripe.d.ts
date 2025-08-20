// Minimal ambient module declaration for 'stripe' to satisfy TS during SDK dev without installing stripe
// This mirrors the commonjs style of the official types enough for our local usage
declare module 'stripe' {
  // Value export
  class Stripe {
    constructor(apiKey: string, config?: any);
    webhooks: any;
    customers: any;
    subscriptions: any;
    checkout: { sessions: any };
    billingPortal: { sessions: any };
    prices: any;
    subscriptionItems: any;
    paymentMethods: any;
  }

  // Namespace types like Stripe.Subscription
  namespace Stripe {
    type Customer = any;
    type Subscription = any;
    type Price = any;
    type Invoice = any;
    type UsageRecord = any;
    type PaymentMethod = any;
    interface StripeError {
      code?: string;
      [k: string]: any;
    }
    interface PriceListParams { [k: string]: any }
    interface SubscriptionCreateParams { [k: string]: any }
    namespace SubscriptionUpdateParams {
      type ProrationBehavior = any;
    }
    namespace Checkout {
      type Session = any;
      type SessionCreateParams = any;
    }
    namespace BillingPortal {
      type Session = any;
    }
  }

  export = Stripe;
}
