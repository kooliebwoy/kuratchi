import Stripe from 'stripe';
import { subscriptionToBilling } from './utils.js';
import type { OrganizationBilling } from './types.js';
import type { TableApi } from '../orm/runtime.js';

interface Env {
  ADMIN_DB: any;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  ORIGIN: string;
  RESEND_CLUTCHCMS_AUDIENCE: string;
  KURATCHI_AUTH_SECRET: string;
}

export interface BillingSetupOptions {
  organizationId: string;
  email: string;
  organizationName?: string;
  priceId?: string;
  trialDays?: number;
}

export interface CheckoutSessionOptions {
  organizationId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
  allowPromotionCodes?: boolean;
}

/**
 * StripeService integrates deeply with our organization schema and database.
 * Manages billing for organizations using our existing admin schema structure.
 * Works specifically with our Organizations table that has stripeCustomerId and stripeSubscriptionId.
 */
export class StripeService {
  private stripe: Stripe;
  private client: Record<string, TableApi>;
  private env: Env;

  constructor(client: Record<string, TableApi>, env: Env) {
    this.client = client;
    this.env = env;
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
      typescript: true,
    });
  }

  /**
   * Setup billing for an organization - creates Stripe customer and updates our database
   */
  async setupOrganizationBilling(options: BillingSetupOptions): Promise<{
    organization: any;
    customer: Stripe.Customer;
    subscription?: Stripe.Subscription;
  }> {
    // Get organization from our database (runtime ORM)
    const orgRes = await this.client.organizations.findFirst({ where: { id: options.organizationId } as any });
    const organization = (orgRes as any)?.data;

    if (!organization) {
      throw new Error('Organization not found');
    }

    // Create Stripe customer if not exists
    let customer: Stripe.Customer;
    if (organization.stripeCustomerId) {
      customer = await this.stripe.customers.retrieve(organization.stripeCustomerId) as Stripe.Customer;
    } else {
      customer = await this.stripe.customers.create({
        email: options.email,
        name: options.organizationName || organization.organizationName,
        metadata: {
          organizationId: options.organizationId,
          organizationSlug: organization.organizationSlug,
        },
      });

      // Update organization with Stripe customer ID
      await this.client.organizations.update(
        { id: options.organizationId },
        { stripeCustomerId: customer.id, updated_at: new Date().toISOString() }
      );
    }

    let subscription: Stripe.Subscription | undefined;
    if (options.priceId) {
      subscription = await this.createSubscriptionForOrganization(options.organizationId, options.priceId, options.trialDays);
    }

    return {
      organization: await this.getOrganizationWithBilling(options.organizationId),
      customer,
      subscription,
    };
  }

  /**
   * Get organization with billing information from our database
   */
  async getOrganizationWithBilling(organizationId: string): Promise<any> {
    const orgRes = await this.client.organizations.findFirst({ where: { id: organizationId } as any });
    const organization = (orgRes as any)?.data;

    if (!organization) {
      return null;
    }

    let stripeData: any = {};
    if (organization.stripeCustomerId) {
      try {
        const customer = await this.stripe.customers.retrieve(organization.stripeCustomerId);
        stripeData.customer = customer;

        if (organization.stripeSubscriptionId) {
          const subscription = await this.stripe.subscriptions.retrieve(organization.stripeSubscriptionId, {
            expand: ['latest_invoice', 'items.data.price.product'],
          });
          stripeData.subscription = subscription;
        }
      } catch (error) {
        console.error('Error fetching Stripe data:', error);
      }
    }

    return {
      ...organization,
      billing: stripeData,
    };
  }

  /**
   * Create subscription for organization and update our database
   */
  async createSubscriptionForOrganization(
    organizationId: string,
    priceId: string,
    trialDays?: number
  ): Promise<Stripe.Subscription> {
    const orgRes = await this.client.organizations.findFirst({ where: { id: organizationId } as any });
    const organization = (orgRes as any)?.data;

    if (!organization || !organization.stripeCustomerId) {
      throw new Error('Organization must have Stripe customer setup first');
    }

    const subscriptionData: Stripe.SubscriptionCreateParams = {
      customer: organization.stripeCustomerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        organizationId,
        organizationSlug: organization.organizationSlug,
      },
    };

    if (trialDays) {
      subscriptionData.trial_period_days = trialDays;
    }

    const subscription = await this.stripe.subscriptions.create(subscriptionData);

    // Update organization with subscription ID
    await this.client.organizations.update(
      { id: organizationId },
      { stripeSubscriptionId: subscription.id, updated_at: new Date().toISOString() }
    );

    return subscription;
  }

  /**
   * Create checkout session for organization billing
   */
  async createCheckoutSession(options: CheckoutSessionOptions): Promise<Stripe.Checkout.Session> {
    const orgRes = await this.client.organizations.findFirst({ where: { id: options.organizationId } as any });
    const organization = (orgRes as any)?.data;

    if (!organization) {
      throw new Error('Organization not found');
    }

    const sessionData: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      success_url: options.successUrl,
      cancel_url: options.cancelUrl,
      allow_promotion_codes: options.allowPromotionCodes ?? true,
      line_items: [{
        price: options.priceId,
        quantity: 1,
      }],
      metadata: {
        organizationId: options.organizationId,
        organizationSlug: organization.organizationSlug,
      },
    };

    if (organization.stripeCustomerId) {
      sessionData.customer = organization.stripeCustomerId;
    } else {
      sessionData.customer_creation = 'always';
      sessionData.customer_email = organization.email;
    }

    if (options.trialDays) {
      sessionData.subscription_data = {
        trial_period_days: options.trialDays,
        metadata: {
          organizationId: options.organizationId,
          organizationSlug: organization.organizationSlug,
        },
      };
    }

    return await this.stripe.checkout.sessions.create(sessionData);
  }

  /**
   * Create billing portal session for organization
   */
  async createBillingPortalSession(organizationId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    const orgRes = await this.client.organizations.findFirst({ where: { id: organizationId } as any });
    const organization = (orgRes as any)?.data;

    if (!organization || !organization.stripeCustomerId) {
      throw new Error('Organization must have Stripe customer setup first');
    }

    return await this.stripe.billingPortal.sessions.create({
      customer: organization.stripeCustomerId,
      return_url: returnUrl,
    });
  }

  /**
   * Cancel organization subscription
   */
  async cancelOrganizationSubscription(organizationId: string, immediately = false): Promise<Stripe.Subscription> {
    const orgRes = await this.client.organizations.findFirst({ where: { id: organizationId } as any });
    const organization = (orgRes as any)?.data;

    if (!organization || !organization.stripeSubscriptionId) {
      throw new Error('Organization subscription not found');
    }

    let subscription: Stripe.Subscription;
    if (immediately) {
      subscription = await this.stripe.subscriptions.cancel(organization.stripeSubscriptionId);
      // Clear subscription ID from our database
      await this.client.organizations.update(
        { id: organizationId },
        { stripeSubscriptionId: null as any, updated_at: new Date().toISOString() }
      );
    } else {
      subscription = await this.stripe.subscriptions.update(organization.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    }

    return subscription;
  }

  /**
   * Update organization subscription (change plan, etc.)
   */
  async updateOrganizationSubscription(
    organizationId: string,
    priceId: string,
    prorationBehavior: Stripe.SubscriptionUpdateParams.ProrationBehavior = 'create_prorations'
  ): Promise<Stripe.Subscription> {
    const orgRes = await this.client.organizations.findFirst({ where: { id: organizationId } as any });
    const organization = (orgRes as any)?.data;

    if (!organization || !organization.stripeSubscriptionId) {
      throw new Error('Organization subscription not found');
    }

    const subscription = await this.stripe.subscriptions.retrieve(organization.stripeSubscriptionId);
    
    return await this.stripe.subscriptions.update(organization.stripeSubscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: priceId,
      }],
      proration_behavior: prorationBehavior,
    });
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, immediately = false): Promise<Stripe.Subscription> {
    if (immediately) {
      return await this.stripe.subscriptions.cancel(subscriptionId);
    } else {
      return await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }
  }

  /**
   * Get all subscriptions for a customer
   */
  async getCustomerSubscriptions(customerId: string): Promise<Stripe.Subscription[]> {
    const subscriptions = await this.stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      expand: ['data.latest_invoice'],
    });
    return subscriptions.data;
  }

  /**
   * Get a concise billing summary for an organization
   */
  async getOrganizationBillingSummary(organizationId: string): Promise<{
    organization: any;
    billing: OrganizationBilling | null;
  }> {
    const orgRes = await this.client.organizations.findFirst({ where: { id: organizationId } as any });
    const organization = (orgRes as any)?.data;

    if (!organization) {
      return { organization: null, billing: null } as any;
    }

    if (!organization.stripeSubscriptionId) {
      return { organization, billing: null };
    }

    try {
      const subscription = await this.stripe.subscriptions.retrieve(
        organization.stripeSubscriptionId,
        { expand: ['latest_invoice', 'items.data.price.product'] }
      );
      return {
        organization,
        billing: subscriptionToBilling(subscription),
      };
    } catch (e) {
      console.error('Failed to fetch subscription for billing summary:', e);
      return { organization, billing: null };
    }
  }

  // Webhook Handling
  /**
   * Construct and verify webhook event
   */
  constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
    if (!this.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }

    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      this.env.STRIPE_WEBHOOK_SECRET
    );
  }

  /**
   * Handle common webhook events with organization context
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<{
    handled: boolean;
    organizationId?: string;
    data?: any;
  }> {
    let organizationId: string | undefined;
    let data: any;

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object as Stripe.Subscription;
        organizationId = subscription.metadata?.organizationId;
        data = { subscription };
        // Sync subscription ID to Organizations table if orgId is present
        if (organizationId) {
          try {
            if (event.type === 'customer.subscription.deleted') {
              await this.client.organizations.update(
                { id: organizationId },
                { stripeSubscriptionId: null as any, updated_at: new Date().toISOString() }
              );
            } else {
              await this.client.organizations.update(
                { id: organizationId },
                { stripeSubscriptionId: subscription.id, updated_at: new Date().toISOString() }
              );
            }
          } catch (e) {
            console.error('Failed to sync subscription to DB:', e);
          }
        }
        break;

      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed':
        const invoice = event.data.object as Stripe.Invoice;
        organizationId = invoice.metadata?.organizationId;
        data = { invoice };
        break;

      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        organizationId = session.metadata?.organizationId;
        data = { session };
        // Persist customer and subscription IDs to Organizations when available
        if (organizationId) {
          try {
            const customerId = (session.customer as string) || undefined;
            const subscriptionId = (session.subscription as string) || undefined;
            if (customerId || subscriptionId) {
              await this.client.organizations.update(
                { id: organizationId },
                {
                  stripeCustomerId: customerId ?? undefined,
                  stripeSubscriptionId: subscriptionId ?? undefined,
                  updated_at: new Date().toISOString(),
                } as any
              );
            }
          } catch (e) {
            console.error('Failed to persist checkout.session IDs:', e);
          }
        }
        break;

      case 'customer.created':
      case 'customer.updated':
        const customer = event.data.object as Stripe.Customer;
        organizationId = customer.metadata?.organizationId;
        data = { customer };
        if (organizationId) {
          try {
            await this.client.organizations.update(
              { id: organizationId },
              { stripeCustomerId: customer.id, updated_at: new Date().toISOString() }
            );
          } catch (e) {
            console.error('Failed to sync customer to DB:', e);
          }
        }
        break;

      default:
        return { handled: false };
    }

    return {
      handled: true,
      organizationId,
      data,
    };
  }

  

  // Price and Product Management
  /**
   * List all active prices
   */
  async listPrices(productId?: string): Promise<Stripe.Price[]> {
    const params: Stripe.PriceListParams = {
      active: true,
      expand: ['data.product'],
    };

    if (productId) {
      params.product = productId;
    }

    const prices = await this.stripe.prices.list(params);
    return prices.data;
  }

  /**
   * Get price by ID
   */
  async getPrice(priceId: string): Promise<Stripe.Price | null> {
    try {
      return await this.stripe.prices.retrieve(priceId, {
        expand: ['product'],
      });
    } catch (error) {
      if ((error as Stripe.StripeError).code === 'resource_missing') {
        return null;
      }
      throw error;
    }
  }

  // Usage Records (for metered billing)
  /**
   * Create usage record for metered billing
   */
  async createUsageRecord(
    subscriptionItemId: string,
    quantity: number,
    timestamp?: number
  ): Promise<Stripe.UsageRecord> {
    return await this.stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
      quantity,
      timestamp: timestamp || Math.floor(Date.now() / 1000),
      action: 'set', // or 'increment'
    });
  }

  // Payment Methods
  /**
   * Get customer's payment methods
   */
  async getCustomerPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    const paymentMethods = await this.stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
    return paymentMethods.data;
  }

  /**
   * Set default payment method for customer
   */
  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<Stripe.Customer> {
    return await this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  }
}
