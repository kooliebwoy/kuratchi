/**
 * Stripe Plugin Types
 */

import type { RequestEvent } from '@sveltejs/kit';
import type Stripe from 'stripe';

export interface StripePluginOptions {
	/** Stripe secret API key */
	apiKey: string;

	/** Webhook signing secret for verifying Stripe events */
	webhookSecret?: string;

	/** Enable event tracking in database (default: true) */
	trackEvents?: boolean;

	/** Database source for tracking (default: 'admin') */
	trackingDb?: 'admin' | 'org';

	/** Table names for Stripe data */
	tables?: {
		customers?: string; // default: 'stripeCustomers'
		subscriptions?: string; // default: 'stripeSubscriptions'
		events?: string; // default: 'stripeEvents'
		invoices?: string; // default: 'stripeInvoices'
	};

	/** Callback route path (default: '/kuratchi/stripe/callback') */
	callbackPath?: string;
}

export interface CreateCustomerOptions {
	email: string;
	name?: string;
	phone?: string;
	metadata?: Record<string, string>;
	userId?: string;
	organizationId?: string;
}

export interface CreateCheckoutOptions {
	priceId: string;
	customerId?: string;
	customerEmail?: string;
	successPath: string;
	cancelPath: string;
	mode?: 'payment' | 'subscription' | 'setup';
	quantity?: number;
	metadata?: Record<string, string>;
	allowPromotionCodes?: boolean;
	trialPeriodDays?: number;
}

export interface CreateSubscriptionOptions {
	customerId: string;
	priceId: string;
	quantity?: number;
	trialPeriodDays?: number;
	metadata?: Record<string, string>;
	prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
}

export interface UpdateSubscriptionOptions {
	priceId?: string;
	quantity?: number;
	cancelAtPeriodEnd?: boolean;
	metadata?: Record<string, string>;
	prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
}

export interface CreatePortalSessionOptions {
	customerId: string;
	returnPath: string;
}

export interface StripeCustomerRecord {
	id: string;
	stripeCustomerId: string;
	email: string;
	name?: string;
	userId?: string;
	organizationId?: string;
	metadata?: Record<string, any>;
	createdAt: string;
	updatedAt: string;
}

export interface StripeSubscriptionRecord {
	id: string;
	stripeSubscriptionId: string;
	stripeCustomerId: string;
	status: string;
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
}

export interface StripeEventRecord {
	id: string;
	stripeEventId: string;
	type: string;
	data: Record<string, any>;
	processed: boolean;
	error?: string;
	createdAt: string;
}

export interface StripeInvoiceRecord {
	id: string;
	stripeInvoiceId: string;
	stripeCustomerId: string;
	stripeSubscriptionId?: string;
	status: string;
	amountDue: number;
	amountPaid: number;
	currency: string;
	hostedInvoiceUrl?: string;
	invoicePdf?: string;
	metadata?: Record<string, any>;
	createdAt: string;
	updatedAt: string;
}
