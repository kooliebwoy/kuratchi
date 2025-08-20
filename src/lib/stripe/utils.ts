import type Stripe from 'stripe';
import type { OrganizationBilling, StripePlan } from './types.js';

/**
 * Convert Stripe subscription to OrganizationBilling
 */
export function subscriptionToBilling(subscription: Stripe.Subscription): OrganizationBilling {
  return {
    organizationId: subscription.metadata?.organizationId || '',
    customerId: subscription.customer as string,
    subscriptionId: subscription.id,
    status: subscription.status as OrganizationBilling['status'],
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}

/**
 * Format currency amount for display
 */
export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

/**
 * Calculate proration amount
 */
export function calculateProration(
  oldAmount: number,
  newAmount: number,
  daysRemaining: number,
  totalDays: number
): number {
  const dailyOldAmount = oldAmount / totalDays;
  const dailyNewAmount = newAmount / totalDays;
  const dailyDifference = dailyNewAmount - dailyOldAmount;
  
  return Math.round(dailyDifference * daysRemaining);
}

/**
 * Get subscription status display text
 */
export function getSubscriptionStatusText(status: OrganizationBilling['status']): string {
  const statusMap = {
    active: 'Active',
    trialing: 'Trial',
    past_due: 'Past Due',
    canceled: 'Canceled',
    unpaid: 'Unpaid',
  };
  
  return statusMap[status] || status;
}

/**
 * Check if subscription is in good standing
 */
export function isSubscriptionActive(billing: OrganizationBilling): boolean {
  return ['active', 'trialing'].includes(billing.status);
}

/**
 * Get days until subscription ends
 */
export function getDaysUntilPeriodEnd(billing: OrganizationBilling): number {
  if (!billing.currentPeriodEnd) return 0;
  
  const now = new Date();
  const periodEnd = billing.currentPeriodEnd;
  const diffTime = periodEnd.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

/**
 * Validate webhook signature timing
 */
export function isWebhookTimingValid(timestamp: number, tolerance = 300): boolean {
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - timestamp) <= tolerance;
}

/**
 * Extract organization ID from Stripe metadata
 */
export function extractOrganizationId(stripeObject: any): string | null {
  if (stripeObject.metadata?.organizationId) {
    return stripeObject.metadata.organizationId;
  }
  
  // Try to get from customer metadata if it's a subscription/invoice
  if (stripeObject.customer && typeof stripeObject.customer === 'object') {
    return stripeObject.customer.metadata?.organizationId || null;
  }
  
  return null;
}

/**
 * Create plan configuration helper
 */
export function createPlanConfig(
  priceId: string,
  name: string,
  amount: number,
  currency: string,
  interval: 'month' | 'year',
  options: {
    description?: string;
    features?: string[];
    isPopular?: boolean;
    trialDays?: number;
  } = {}
): StripePlan {
  return {
    id: priceId,
    name,
    description: options.description,
    priceId,
    amount,
    currency,
    interval,
    features: options.features || [],
    isPopular: options.isPopular || false,
    trialDays: options.trialDays,
  };
}
