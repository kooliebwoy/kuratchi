import type { TableApi } from "../orm/kuratchi-orm.js";

/**
 * OrgService encapsulates organization-level concerns such as roles, activity logs, and billing.
 * It is schema-agnostic and works with either admin or organization schemas.
 */
export class OrgService {
  // Runtime client (required)
  private client: Record<string, TableApi>;

  /**
   * Construct with a runtime client.
   */
  constructor(
    client: Record<string, TableApi>
  ) {
    this.client = client;
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
}
