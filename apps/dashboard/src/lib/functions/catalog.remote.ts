import { getRequestEvent, query, command } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db-context';

// Types
export interface CatalogVehicle {
  id: string;
  oemId: string;
  oemName: string;
  modelName: string;
  modelYear?: number;
  category: 'atv' | 'utv' | 'dirtbike' | 'pitbike' | 'motorcycle' | 'electric' | 'other';
  msrp?: number;
  currency: string;
  sourceUrl?: string;
  thumbnailUrl?: string;
  images: string[];
  specifications: Record<string, string>;
  features: string[];
  description?: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface CatalogOem {
  id: string;
  name: string;
  logoUrl?: string;
  websiteUrl?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// Helpers
const guardedQuery = <R>(fn: () => Promise<R>) => {
  return query(async () => {
    const { locals: { session } } = getRequestEvent();
    if (!session?.user) error(401, 'Unauthorized');
    return fn();
  });
};

const guardedCommand = <Schema extends v.BaseSchema<any, any, any>>(
  schema: Schema,
  fn: (data: v.InferOutput<Schema>) => Promise<any>
) => {
  return command(schema, async (data: v.InferOutput<Schema>) => {
    const { locals: { session } } = getRequestEvent();
    if (!session?.user) error(401, 'Unauthorized');
    return fn(data);
  });
};

// ============== QUERIES ==============

// Get all OEMs
export const getOems = guardedQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const db = await getDatabase(locals);
    if (!db) {
      console.log('[catalog.getOems] No database available');
      return [];
    }

    const oemsTable = db.catalogOems as any;
    if (!oemsTable) {
      console.log('[catalog.getOems] No catalogOems table');
      return [];
    }

    const result = await oemsTable.orderBy('name', 'asc').many();
    console.log('[catalog.getOems] Query result:', result);
    
    // Handle { success, data } pattern
    const oems = result?.data || result;
    return Array.isArray(oems) ? oems : [];
  } catch (err) {
    console.error('[catalog.getOems] error:', err);
    return [];
  }
});

// Get all vehicles with optional filtering
export const getVehicles = guardedQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const db = await getDatabase(locals);
    if (!db) return [];

    const vehiclesTable = db.catalogVehicles as any;
    if (!vehiclesTable) return [];

    const result = await vehiclesTable
      .orderBy('created_at', 'desc')
      .many();

    // Handle { success, data } pattern
    const vehicles = result?.data || result;
    return Array.isArray(vehicles) ? vehicles : [];
  } catch (err) {
    console.error('[catalog.getVehicles] error:', err);
    return [];
  }
});

// Get single vehicle by ID
export const getVehicle = guardedQuery(async () => {
  try {
    const { url, locals } = getRequestEvent();
    const vehicleId = url.searchParams.get('id');
    if (!vehicleId) return null;

    const db = await getDatabase(locals);
    if (!db) return null;

    const vehiclesTable = db.catalogVehicles as any;
    if (!vehiclesTable) return null;

    const result = await vehiclesTable.where({ id: vehicleId }).one();
    // Handle { success, data } pattern
    return result?.data || result || null;
  } catch (err) {
    console.error('[catalog.getVehicle] error:', err);
    return null;
  }
});

// ============== COMMANDS ==============

// Create OEM
export const createOem = guardedCommand(
  v.object({
    name: v.pipe(v.string(), v.nonEmpty()),
    logoUrl: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    description: v.optional(v.string())
  }),
  async ({ name, logoUrl, websiteUrl, description }) => {
    try {
      const { locals } = getRequestEvent();
      const db = await getDatabase(locals);
      if (!db) error(500, 'Database not available');

      const oemsTable = db.catalogOems as any;
      if (!oemsTable) error(500, 'OEMs table not available');

      const now = new Date().toISOString();
      const id = crypto.randomUUID();

      console.log('[catalog.createOem] Inserting OEM:', { id, name });

      const result = await oemsTable.insert({
        id,
        name,
        logo_url: logoUrl || null,
        website_url: websiteUrl || null,
        description: description || null,
        created_at: now,
        updated_at: now
      });

      console.log('[catalog.createOem] Insert result:', result);

      if (!result.success) {
        console.error('[catalog.createOem] Insert failed:', result.error);
        error(500, result.error || 'Failed to create OEM');
      }

      return { success: true, id };
    } catch (err: any) {
      console.error('[catalog.createOem] error:', err);
      error(500, err.message || 'Failed to create OEM');
    }
  }
);

// Update OEM
export const updateOem = guardedCommand(
  v.object({
    id: v.pipe(v.string(), v.nonEmpty()),
    name: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    description: v.optional(v.string())
  }),
  async ({ id, name, logoUrl, websiteUrl, description }) => {
    try {
      const { locals } = getRequestEvent();
      const db = await getDatabase(locals);
      if (!db) error(500, 'Database not available');

      const oemsTable = db.catalogOems as any;
      if (!oemsTable) error(500, 'OEMs table not available');

      const updates: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      if (name !== undefined) updates.name = name;
      if (logoUrl !== undefined) updates.logo_url = logoUrl;
      if (websiteUrl !== undefined) updates.website_url = websiteUrl;
      if (description !== undefined) updates.description = description;

      const result = await oemsTable.where({ id }).update(updates);

      if (!result.success) {
        error(500, result.error || 'Failed to update OEM');
      }

      // Also update oem_name in vehicles if name changed
      if (name) {
        const vehiclesTable = db.catalogVehicles as any;
        if (vehiclesTable) {
          await vehiclesTable.where({ oem_id: id }).update({ oem_name: name });
        }
      }

      return { success: true };
    } catch (err: any) {
      console.error('[catalog.updateOem] error:', err);
      error(500, err.message || 'Failed to update OEM');
    }
  }
);

// Delete OEM
export const deleteOem = guardedCommand(
  v.object({
    id: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ id }) => {
    try {
      const { locals } = getRequestEvent();
      const db = await getDatabase(locals);
      if (!db) error(500, 'Database not available');

      const oemsTable = db.catalogOems as any;
      const vehiclesTable = db.catalogVehicles as any;
      if (!oemsTable) error(500, 'OEMs table not available');

      // Check if OEM has vehicles
      if (vehiclesTable) {
        const vehiclesResult = await vehiclesTable.where({ oem_id: id }).many();
        const vehicles = vehiclesResult?.data || vehiclesResult || [];
        if (vehicles.length > 0) {
          error(400, `Cannot delete OEM with ${vehicles.length} vehicle(s). Delete vehicles first.`);
        }
      }

      const result = await oemsTable.delete({ id });

      if (!result.success) {
        error(500, result.error || 'Failed to delete OEM');
      }

      return { success: true };
    } catch (err: any) {
      console.error('[catalog.deleteOem] error:', err);
      error(500, err.message || 'Failed to delete OEM');
    }
  }
);

// Get vehicles by OEM
export const getVehiclesByOem = guardedQuery(async () => {
  try {
    const { url, locals } = getRequestEvent();
    const oemId = url.searchParams.get('oemId');
    if (!oemId) return [];

    const db = await getDatabase(locals);
    if (!db) return [];

    const vehiclesTable = db.catalogVehicles as any;
    if (!vehiclesTable) return [];

    const result = await vehiclesTable
      .where({ oem_id: oemId })
      .orderBy('model_name', 'asc')
      .many();

    const vehicles = result?.data || result;
    return Array.isArray(vehicles) ? vehicles : [];
  } catch (err) {
    console.error('[catalog.getVehiclesByOem] error:', err);
    return [];
  }
});

// Create Vehicle manually
export const createVehicle = guardedCommand(
  v.object({
    oemId: v.pipe(v.string(), v.nonEmpty()),
    modelName: v.pipe(v.string(), v.nonEmpty()),
    modelYear: v.optional(v.number()),
    category: v.picklist(['atv', 'utv', 'dirtbike', 'pitbike', 'motorcycle', 'electric', 'other']),
    msrp: v.optional(v.number()),
    currency: v.optional(v.pipe(v.string(), v.nonEmpty())),
    sourceUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    images: v.optional(v.string()), // JSON string array
    specifications: v.optional(v.string()), // JSON object
    features: v.optional(v.string()), // Newline-separated
    description: v.optional(v.string()),
    status: v.optional(v.picklist(['draft', 'published', 'archived']))
  }),
  async (data) => {
    try {
      const { locals } = getRequestEvent();
      const db = await getDatabase(locals);
      if (!db) error(500, 'Database not available');

      const vehiclesTable = db.catalogVehicles as any;
      const oemsTable = db.catalogOems as any;
      if (!vehiclesTable || !oemsTable) error(500, 'Tables not available');

      // Get OEM name
      const oemResult = await oemsTable.where({ id: data.oemId }).first();
      const oem = oemResult?.data || oemResult;
      if (!oem || !oem.name) error(400, 'OEM not found');

      const now = new Date().toISOString();
      const id = crypto.randomUUID();

      // Parse arrays and objects
      const images = data.images ? JSON.parse(data.images) : [];
      const specifications = data.specifications ? JSON.parse(data.specifications) : {};
      const features = data.features
        ? data.features.split('\n').map(f => f.trim()).filter(f => f.length > 0)
        : [];

      console.log('[catalog.createVehicle] Inserting vehicle:', { id, modelName: data.modelName, oemId: data.oemId });

      const result = await vehiclesTable.insert({
        id,
        oem_id: data.oemId,
        oem_name: oem.name,
        model_name: data.modelName,
        model_year: data.modelYear || null,
        category: data.category,
        msrp: data.msrp || null,
        currency: data.currency || 'USD',
        source_url: data.sourceUrl || null,
        thumbnail_url: data.thumbnailUrl || null,
        images: JSON.stringify(images),
        specifications: JSON.stringify(specifications),
        features: JSON.stringify(features),
        description: data.description || null,
        status: data.status || 'draft',
        created_at: now,
        updated_at: now
      });

      if (!result.success) {
        console.error('[catalog.createVehicle] Insert failed:', result.error);
        error(500, result.error || 'Failed to create vehicle');
      }

      return { success: true, id };
    } catch (err: any) {
      console.error('[catalog.createVehicle] error:', err);
      error(500, err.message || 'Failed to create vehicle');
    }
  }
);

// Update Vehicle
export const updateVehicle = guardedCommand(
  v.object({
    id: v.pipe(v.string(), v.nonEmpty()),
    oemId: v.optional(v.string()),
    modelName: v.optional(v.string()),
    modelYear: v.optional(v.number()),
    category: v.optional(v.string()), // Dynamic categories - accepts any slug
    msrp: v.optional(v.number()),
    currency: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    images: v.optional(v.string()),
    specifications: v.optional(v.string()),
    features: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.picklist(['draft', 'published', 'archived']))
  }),
  async (data) => {
    try {
      const { locals } = getRequestEvent();
      const db = await getDatabase(locals);
      if (!db) error(500, 'Database not available');

      const vehiclesTable = db.catalogVehicles as any;
      if (!vehiclesTable) error(500, 'Vehicles table not available');

      const updates: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      if (data.modelName) updates.model_name = data.modelName;
      if (data.modelYear !== undefined) updates.model_year = data.modelYear;
      if (data.category) updates.category = data.category;
      if (data.msrp !== undefined) updates.msrp = data.msrp;
      if (data.currency) updates.currency = data.currency;
      if (data.sourceUrl !== undefined) updates.source_url = data.sourceUrl;
      if (data.thumbnailUrl !== undefined) updates.thumbnail_url = data.thumbnailUrl;
      if (data.images) updates.images = data.images;
      if (data.specifications) updates.specifications = data.specifications;
      if (data.features) {
        const features = data.features.split('\n').map(f => f.trim()).filter(f => f.length > 0);
        updates.features = JSON.stringify(features);
      }
      if (data.description !== undefined) updates.description = data.description;
      if (data.status) updates.status = data.status;

      await vehiclesTable.where({ id: data.id }).update(updates);

      await getVehicles().refresh();
      return { success: true };
    } catch (err: any) {
      console.error('[catalog.updateVehicle] error:', err);
      error(500, err.message || 'Failed to update vehicle');
    }
  }
);

// Delete Vehicle
export const deleteVehicle = guardedCommand(
  v.object({
    id: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ id }) => {
    try {
      const { locals } = getRequestEvent();
      const db = await getDatabase(locals);
      if (!db) error(500, 'Database not available');

      const vehiclesTable = db.catalogVehicles as any;
      if (!vehiclesTable) error(500, 'Vehicles table not available');

      await vehiclesTable.where({ id }).delete();

      await getVehicles().refresh();
      return { success: true };
    } catch (err: any) {
      console.error('[catalog.deleteVehicle] error:', err);
      error(500, err.message || 'Failed to delete vehicle');
    }
  }
);

// Scrape URL for vehicle data
export const scrapeVehicleUrl = guardedCommand(
  v.object({
    url: v.pipe(v.string(), v.url())
  }),
  async ({ url }) => {
    try {
      const event = getRequestEvent();
      const platform = event.platform as any;
      const browserBinding = platform?.env?.BROWSER;
      
      // Use server utility for scraping
      const { scrapeUrl } = await import('$lib/server/scraper');
      return await scrapeUrl(url, browserBinding);
    } catch (err: any) {
      console.error('[catalog.scrapeVehicleUrl] error:', err);
      error(500, err.message || 'Failed to scrape URL');
    }
  }
);

// Import vehicle from scraped data
export const importScrapedVehicle = guardedCommand(
  v.object({
    oemId: v.pipe(v.string(), v.nonEmpty()),
    scrapedData: v.pipe(v.string(), v.nonEmpty()) // JSON string of scraped data
  }),
  async ({ oemId, scrapedData }) => {
    try {
      const { locals } = getRequestEvent();
      const db = await getDatabase(locals);
      if (!db) error(500, 'Database not available');

      const vehiclesTable = db.catalogVehicles as any;
      const oemsTable = db.catalogOems as any;
      if (!vehiclesTable || !oemsTable) error(500, 'Tables not available');

      // Get OEM
      const oemResult = await oemsTable.where({ id: oemId }).first();
      const oem = oemResult?.data || oemResult;
      if (!oem || !oem.name) error(400, 'OEM not found');

      const data = JSON.parse(scrapedData);
      const now = new Date().toISOString();
      const id = crypto.randomUUID();

      const result = await vehiclesTable.insert({
        id,
        oem_id: oemId,
        oem_name: oem.name,
        model_name: data.modelName || 'Unknown Model',
        model_year: data.modelYear || null,
        category: data.category || 'other',
        msrp: data.msrp || null,
        currency: data.currency || 'USD',
        source_url: data.sourceUrl || null,
        thumbnail_url: data.thumbnailUrl || null,
        images: JSON.stringify(data.images || []),
        specifications: JSON.stringify(data.specifications || {}),
        features: JSON.stringify(data.features || []),
        description: data.description || null,
        status: 'draft',
        created_at: now,
        updated_at: now
      });

      if (!result.success) {
        console.error('[catalog.importScrapedVehicle] Insert failed:', result.error);
        error(500, result.error || 'Failed to import vehicle');
      }

      return { success: true, id };
    } catch (err: any) {
      console.error('[catalog.importScrapedVehicle] error:', err);
      error(500, err.message || 'Failed to import vehicle');
    }
  }
);

// ============== CATEGORIES ==============

// Types
export interface CatalogCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  icon: string;
  vehicle_count: number;
  created_at: string;
  updated_at: string;
}

// Helper to create slug from name
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Get all categories with vehicle counts
export const getCategories = guardedQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const db = await getDatabase(locals);
    if (!db) {
      console.log('[catalog.getCategories] No database available');
      return [];
    }

    const categoriesTable = db.catalogCategories as any;
    if (!categoriesTable) {
      console.log('[catalog.getCategories] No catalogCategories table');
      return [];
    }

    const result = await categoriesTable.orderBy('sort_order', 'asc').many();
    console.log('[catalog.getCategories] Query result:', result);
    
    const categories = result?.data || result;
    if (!Array.isArray(categories)) return [];

    // Get vehicle counts per category
    const vehiclesTable = db.catalogVehicles as any;
    const vehicleCounts: Record<string, number> = {};
    
    if (vehiclesTable) {
      const vehicles = await vehiclesTable.many();
      const vehicleList = vehicles?.data || vehicles || [];
      for (const v of vehicleList) {
        if (v.category) {
          vehicleCounts[v.category] = (vehicleCounts[v.category] || 0) + 1;
        }
      }
    }

    return categories.map((cat: any) => ({
      ...cat,
      vehicle_count: vehicleCounts[cat.slug] || 0
    }));
  } catch (err) {
    console.error('[catalog.getCategories] error:', err);
    return [];
  }
});

// Create category
export const createCategory = guardedCommand(
  v.object({
    name: v.pipe(v.string(), v.nonEmpty()),
    description: v.optional(v.string()),
    color: v.pipe(v.string(), v.nonEmpty()),
    icon: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ name, description, color, icon }) => {
    try {
      const { locals } = getRequestEvent();
      const db = await getDatabase(locals);
      if (!db) error(500, 'Database not available');

      const categoriesTable = db.catalogCategories as any;
      if (!categoriesTable) error(500, 'Categories table not available');

      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const slug = slugify(name);

      console.log('[catalog.createCategory] Inserting category:', { id, name, slug });

      const result = await categoriesTable.insert({
        id,
        name,
        slug,
        description: description || null,
        color,
        icon,
        sort_order: 0,
        created_at: now,
        updated_at: now
      });

      console.log('[catalog.createCategory] Insert result:', result);

      if (!result.success) {
        console.error('[catalog.createCategory] Insert failed:', result.error);
        error(500, result.error || 'Failed to create category');
      }

      return { success: true, id };
    } catch (err: any) {
      console.error('[catalog.createCategory] error:', err);
      error(500, err.message || 'Failed to create category');
    }
  }
);

// Update category
export const updateCategory = guardedCommand(
  v.object({
    id: v.pipe(v.string(), v.nonEmpty()),
    name: v.optional(v.pipe(v.string(), v.nonEmpty())),
    description: v.optional(v.string()),
    color: v.optional(v.pipe(v.string(), v.nonEmpty())),
    icon: v.optional(v.pipe(v.string(), v.nonEmpty()))
  }),
  async ({ id, name, description, color, icon }) => {
    try {
      const { locals } = getRequestEvent();
      const db = await getDatabase(locals);
      if (!db) error(500, 'Database not available');

      const categoriesTable = db.catalogCategories as any;
      if (!categoriesTable) error(500, 'Categories table not available');

      const updates: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      if (name !== undefined) {
        updates.name = name;
        updates.slug = slugify(name);
      }
      if (description !== undefined) updates.description = description;
      if (color !== undefined) updates.color = color;
      if (icon !== undefined) updates.icon = icon;

      console.log('[catalog.updateCategory] Updating category:', { id, updates });

      const result = await categoriesTable.where({ id }).update(updates);

      if (!result.success) {
        console.error('[catalog.updateCategory] Update failed:', result.error);
        error(500, result.error || 'Failed to update category');
      }

      return { success: true };
    } catch (err: any) {
      console.error('[catalog.updateCategory] error:', err);
      error(500, err.message || 'Failed to update category');
    }
  }
);

// Delete category
export const deleteCategory = guardedCommand(
  v.object({ id: v.pipe(v.string(), v.nonEmpty()) }),
  async ({ id }) => {
    try {
      const { locals } = getRequestEvent();
      const db = await getDatabase(locals);
      if (!db) error(500, 'Database not available');

      const categoriesTable = db.catalogCategories as any;
      if (!categoriesTable) error(500, 'Categories table not available');

      console.log('[catalog.deleteCategory] Deleting category:', { id });

      const result = await categoriesTable.where({ id }).delete();

      if (!result.success) {
        console.error('[catalog.deleteCategory] Delete failed:', result.error);
        error(500, result.error || 'Failed to delete category');
      }

      return { success: true };
    } catch (err: any) {
      console.error('[catalog.deleteCategory] error:', err);
      error(500, err.message || 'Failed to delete category');
    }
  }
);
