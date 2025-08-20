import { desc, asc, like, count, eq } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";

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
  private db: DrizzleD1Database<any>;
  private env: Env;
  private schema: any;
  private stripeService?: any;

  constructor(db: DrizzleD1Database<any>, env: Env, schema: any) {
    this.db = db;
    this.env = env;
    this.schema = schema;
    
    // Defer StripeService initialization to first billing use to keep 'stripe' optional
  }

  private async ensureStripeService(): Promise<void> {
    if (this.stripeService) return;
    if (!this.env.STRIPE_SECRET_KEY || !this.schema.Organizations) {
      throw new Error('Stripe not configured for this organization service');
    }
    const mod = await import('../stripe/StripeService.js');
    const StripeService = (mod as any).StripeService;
    this.stripeService = new StripeService(this.db, this.env, this.schema);
  }

  // Role Methods
  async createRole(roleData: any): Promise<any | undefined> {
    return this.db
      .insert(this.schema.Roles)
      .values({
        ...roleData,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .returning()
      .get();
  }

  async getRoles(): Promise<any[]> {
    return this.db.select().from(this.schema.Roles).all();
  }

  async getRole(id: string): Promise<any | undefined> {
    return this.db.select().from(this.schema.Roles).where(eq(this.schema.Roles.id, id)).get();
  }

  async updateRole(id: string, roleData: Partial<any>): Promise<any | undefined> {
    return this.db
      .update(this.schema.Roles)
      .set({ ...roleData, updated_at: Date.now().toString() })
      .where(eq(this.schema.Roles.id, id))
      .returning()
      .get();
  }

  async deleteRole(id: string): Promise<any | undefined> {
    return this.db.delete(this.schema.Roles).where(eq(this.schema.Roles.id, id)).returning().get();
  }

  // Activity Methods
  async createActivity(activity: any): Promise<any | undefined> {
    return this.db
      .insert(this.schema.Activity)
      .values({
        ...activity,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .returning()
      .get();
  }

  async getAllActivity(): Promise<any[]> {
    return await this.db
      .select()
      .from(this.schema.Activity)
      .orderBy(desc(this.schema.Activity.created_at))
      .all();
  }

  async getPaginatedActivity(
    limit = 10,
    page = 1,
    search = '',
    _filter = '',
    order: 'asc' | 'desc' = 'desc'
  ): Promise<{ data: any[]; total: number }> {
    let whereOptions: any = undefined;
    if (search && search.trim() !== '') {
      whereOptions = like(this.schema.Activity.action, `%${search}%`);
    }

    const [total] = await (this.db as any)
      .select({ count: count() })
      .from(this.schema.Activity)
      .where(whereOptions as any);

    const activity = await (this.db as any).query.Activity.findMany({
      where: whereOptions as any,
      with: {
        User: {
          columns: {
            password_hash: false,
          },
        },
      },
      limit: limit,
      offset: (page - 1) * limit,
      orderBy: order === 'asc' ? asc(this.schema.Activity.created_at) : desc(this.schema.Activity.created_at),
    });

    return {
      data: activity,
      total: total?.count ?? 0,
    };
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
    if (!this.env.STRIPE_SECRET_KEY || !this.schema.Organizations) {
      // Return organization without billing data if Stripe not configured
      return this.db
        .select()
        .from(this.schema.Organizations)
        .where(eq(this.schema.Organizations.id, organizationId))
        .get();
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
