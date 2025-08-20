import type Stripe from 'stripe';

// Organization-focused Stripe types
export interface OrganizationBilling {
  organizationId: string;
  customerId?: string;
  subscriptionId?: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid';
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd?: boolean;
}

export interface BillingUsage {
  organizationId: string;
  subscriptionItemId: string;
  quantity: number;
  timestamp: Date;
  metadata?: Record<string, string>;
}

export interface WebhookEventContext {
  organizationId?: string;
  eventType: string;
  processed: boolean;
  createdAt: Date;
  data: any;
}

// Stripe webhook event types we handle
export type SupportedWebhookEvents = 
  | 'customer.subscription.created'
  | 'customer.subscription.updated' 
  | 'customer.subscription.deleted'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed'
  | 'checkout.session.completed'
  | 'customer.created'
  | 'customer.updated';

// Plan configuration
export interface StripePlan {
  id: string;
  name: string;
  description?: string;
  priceId: string;
  amount: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  isPopular?: boolean;
  trialDays?: number;
}
