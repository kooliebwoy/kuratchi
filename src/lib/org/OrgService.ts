import type { TableApi } from "../orm/kuratchi-orm.js";

interface Env {
  ADMIN_DB: any;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  ORIGIN: string;
  RESEND_CLUTCHCMS_AUDIENCE: string;
  KURATCHI_AUTH_SECRET: string;
}

/**
 * OrgService encapsulates organization-level concerns such as roles, activity logs, and billing.
 * It is schema-agnostic and works with either admin or organization schemas.
 * Integrates with StripeService for organization billing management.
 */
export class OrgService {
  // Runtime client (required)
  private client: Record<string, TableApi>;
  // Stripe-only deps (temporary until StripeService is refactored)
  private env: Env;
  private stripeService?: any;

  /**
   * Construct with a runtime client.
   */
  constructor(
    client: Record<string, TableApi>,
    env: Env
  ) {
    this.client = client;
    this.env = env;
    // Defer StripeService initialization to first billing use
  }

  private async ensureStripeService(): Promise<void> {
    if (this.stripeService) return;
    if (!this.env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe not configured for this organization service');
    }
    const mod = await import('../stripe/StripeService.js');
    const StripeService = (mod as any).StripeService;
    this.stripeService = new StripeService(this.client, this.env);
  }

  // Role Methods
  async createRole(roleData: any): Promise<any | undefined> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.client.roles.insert({ ...roleData, id, created_at: now, updated_at: now });
    const res = await this.client.roles.where({ id }).first();
    return (res as any)?.data;
  }

  async getRoles(): Promise<any[]> {
    const res = await this.client.roles.many();
    return ((res as any).data ?? []) as any[];
  }

  async getRole(id: string): Promise<any | undefined> {
    const res = await this.client.roles.where({ id }).first();
    return (res as any)?.data;
  }

  async updateRole(id: string, roleData: Partial<any>): Promise<any | undefined> {
    const now = new Date().toISOString();
    await this.client.roles.update({ id }, { ...roleData, updated_at: now });
    const res = await this.client.roles.where({ id }).first();
    return (res as any)?.data;
  }

  async deleteRole(id: string): Promise<any | undefined> {
    const before = await this.getRole(id);
    await this.client.roles.delete({ id });
    return before as any;
  }

  // Activity Methods
  async createActivity(activity: any): Promise<any | undefined> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.client.activity.insert({ ...activity, id, created_at: now, updated_at: now });
    const res = await this.client.activity.where({ id }).first();
    return (res as any)?.data;
  }

  async getAllActivity(): Promise<any[]> {
    const res = await this.client.activity.orderBy({ created_at: 'desc' }).many();
    return ((res as any).data ?? []) as any[];
  }

  async getPaginatedActivity(
    limit = 10,
    page = 1,
    search = '',
    _filter = '',
    order: 'asc' | 'desc' = 'desc'
  ): Promise<{ data: any[]; total: number }> {
    const where = search && search.trim() !== '' ? ({ action: { like: `%${search}%` } } as any) : undefined;
    const cnt = await this.client.activity.count(where as any);
    const total = Number(((cnt as any).data?.[0]?.count ?? 0) as any) || 0;
    const qb = where ? this.client.activity.where(where as any) : this.client.activity;
    const res = await qb
      .orderBy({ created_at: order })
      .limit(limit)
      .offset(page)
      .many();
    const rows = ((res as any).data ?? []) as any[];
    return { data: rows, total };
  }

  // Organization Billing Methods (if StripeService is available)
  /**
   * Setup billing for an organization
   */
  async setupOrganizationBilling(options: {
    organizationId: string;
    email: string;
    organizationName?: string;
    priceId?: string;
    trialDays?: number;
  }) {
    await this.ensureStripeService();
    return this.stripeService.setupOrganizationBilling(options);
  }

  /**
   * Get organization with billing information
   */
  async getOrganizationWithBilling(organizationId: string) {
    if (!this.env.STRIPE_SECRET_KEY) {
      // Return organization without billing data if Stripe not configured, using runtime client if available
      if ((this.client as any).organizations) {
        const res = await (this.client as any).organizations.where({ id: organizationId } as any).first();
        return (res as any)?.data;
      }
      throw new Error('organizations table not available on runtime client and Stripe not configured');
    }
    await this.ensureStripeService();
    return this.stripeService.getOrganizationWithBilling(organizationId);
  }

  /**
   * Create checkout session for organization
   */
  async createCheckoutSession(options: {
    organizationId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    trialDays?: number;
    allowPromotionCodes?: boolean;
  }) {
    await this.ensureStripeService();
    return this.stripeService.createCheckoutSession(options);
  }

  /**
   * Create billing portal session
   */
  async createBillingPortalSession(organizationId: string, returnUrl: string) {
    await this.ensureStripeService();
    return this.stripeService.createBillingPortalSession(organizationId, returnUrl);
  }

  /**
   * Cancel organization subscription
   */
  async cancelOrganizationSubscription(organizationId: string, immediately = false) {
    await this.ensureStripeService();
    return this.stripeService.cancelOrganizationSubscription(organizationId, immediately);
  }

  /**
   * Handle Stripe webhook events
   */
  async handleStripeWebhook(event: any) {
    await this.ensureStripeService();
    return this.stripeService.handleWebhookEvent(event);
  }

  /**
   * Get billing summary for organization
   */
  async getOrganizationBillingSummary(organizationId: string) {
    await this.ensureStripeService();
    return this.stripeService.getOrganizationBillingSummary(organizationId);
  }
}
