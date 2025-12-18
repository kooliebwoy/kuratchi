import { getRequestEvent, query, form } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';

// Helpers
const guardedQuery = <R>(fn: () => Promise<R>) => {
  return query(async () => {
    const { locals: { session } } = getRequestEvent();
    if (!session?.user) error(401, 'Unauthorized');
    return fn();
  });
};

const guardedForm = <R>(
  schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
  fn: (data: any) => Promise<R>
) => {
  return form(schema as any, async (data: any) => {
    const { locals: { session } } = getRequestEvent();
    if (!session?.user) error(401, 'Unauthorized');

    return fn(data);
  });
};

// Queries
export const getProducts = guardedQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const adminDb = await (locals.kuratchi as any)?.getAdminDb?.();
    if (!adminDb) return [];

    // Get products from database
    const productsTable = adminDb.stripeProducts as any;
    const pricesTable = adminDb.stripePrices as any;

    if (!productsTable || !pricesTable) return [];

    const products = await productsTable
      .where({ active: true })
      .orderBy('created_at', 'desc')
      .many();

    // Ensure products is an array
    const productsList = Array.isArray(products) ? products : [];

    // Get prices for each product
    const productsWithPrices = await Promise.all(
      productsList.map(async (product: any) => {
        const prices = await pricesTable
          .where({ stripeProductId: product.stripeProductId, active: true })
          .many();

        const pricesList = Array.isArray(prices) ? prices : [];

        return {
          id: product.stripeProductId,
          name: product.name,
          description: product.description,
          active: product.active,
          metadata: product.metadata || {},
          features: product.features || [],
          prices: pricesList.map((price: any) => ({
            id: price.stripePriceId,
            unitAmount: price.unitAmount,
            currency: price.currency,
            recurring: price.recurringInterval ? {
              interval: price.recurringInterval,
              interval_count: price.recurringIntervalCount || 1
            } : null,
            active: price.active,
            metadata: price.metadata || {}
          })),
          createdAt: product.created_at
        };
      })
    );

    return productsWithPrices;
  } catch (err) {
    console.error('[products.getProducts] error:', err);
    return [];
  }
});

// Forms
export const createProduct = guardedForm(
  v.object({
    name: v.pipe(v.string(), v.nonEmpty()),
    description: v.optional(v.string()),
    features: v.optional(v.string()) // Newline-separated features
  }),
  async ({ name, description, features }) => {
    try {
      const { stripe } = await import('kuratchi-sdk');
      const { locals } = getRequestEvent();
      const event = getRequestEvent();
      
      // Parse features from newline-separated string to array
      const featuresArray = features 
        ? features.split('\n').map(f => f.trim()).filter(f => f.length > 0)
        : [];
      
      // Create in Stripe
      const product = await stripe.createProduct(event, {
        name,
        description,
        features: featuresArray,
        active: true
      });

      // Save to database
      const adminDb = await (locals.kuratchi as any)?.getAdminDb?.();
      if (adminDb) {
        const productsTable = adminDb.stripeProducts as any;
        if (productsTable) {
          const now = new Date().toISOString();
          await productsTable.insert({
            id: crypto.randomUUID(),
            stripeProductId: product.id,
            name: product.name,
            description: product.description || null,
            active: product.active,
            features: featuresArray,
            metadata: product.metadata || {},
            created_at: now,
            updated_at: now
          });
        }
      }

      await getProducts().refresh();
      return { success: true, productId: product.id };
    } catch (err: any) {
      console.error('[products.createProduct] error:', err);
      error(500, err.message || 'Failed to create product');
    }
  }
);

export const updateProduct = guardedForm(
  v.object({
    productId: v.pipe(v.string(), v.nonEmpty()),
    name: v.optional(v.pipe(v.string(), v.nonEmpty())),
    description: v.optional(v.string()),
    active: v.optional(v.boolean()),
    features: v.optional(v.string()) // JSON string
  }),
  async ({ productId, name, description, active, features }) => {
    try {
      const { stripe } = await import('kuratchi-sdk');
      const event = getRequestEvent();
      
      const featuresArray = features ? JSON.parse(features) : undefined;
      
      await stripe.updateProduct(event, productId, {
        name,
        description,
        active,
        features: featuresArray
      });

      await getProducts().refresh();
      return { success: true };
    } catch (err: any) {
      console.error('[products.updateProduct] error:', err);
      error(500, err.message || 'Failed to update product');
    }
  }
);

export const archiveProduct = guardedForm(
  v.object({
    productId: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ productId }) => {
    try {
      const { stripe } = await import('kuratchi-sdk');
      const { locals } = getRequestEvent();
      const event = getRequestEvent();
      
      // Archive in Stripe
      await stripe.archiveProduct(event, productId);

      // Update database
      const adminDb = await (locals.kuratchi as any)?.getAdminDb?.();
      if (adminDb) {
        const productsTable = adminDb.stripeProducts as any;
        if (productsTable) {
          await productsTable
            .where({ stripeProductId: productId })
            .update({ 
              active: false,
              updated_at: new Date().toISOString()
            });
        }
      }

      await getProducts().refresh();
      return { success: true };
    } catch (err: any) {
      console.error('[products.archiveProduct] error:', err);
      error(500, err.message || 'Failed to archive product');
    }
  }
);

export const createPrice = guardedForm(
  v.object({
    productId: v.pipe(v.string(), v.nonEmpty()),
    amount: v.pipe(v.number(), v.minValue(0)), // In dollars
    currency: v.optional(v.pipe(v.string(), v.nonEmpty())),
    interval: v.optional(v.picklist(['month', 'year', 'week', 'day'])),
    intervalCount: v.optional(v.pipe(v.number(), v.minValue(1)))
  }),
  async ({ productId, amount, currency, interval, intervalCount }) => {
    try {
      const { stripe } = await import('kuratchi-sdk');
      const { locals } = getRequestEvent();
      const event = getRequestEvent();
      
      const unitAmount = Math.round(amount * 100); // Convert to cents
      
      // Create in Stripe
      const price = await stripe.createPrice(event, {
        productId,
        unitAmount,
        currency: currency || 'usd',
        recurring: interval ? {
          interval,
          intervalCount: intervalCount || 1
        } : undefined,
        active: true
      });

      // Save to database
      const adminDb = await (locals.kuratchi as any)?.getAdminDb?.();
      if (adminDb) {
        const pricesTable = adminDb.stripePrices as any;
        if (pricesTable) {
          const now = new Date().toISOString();
          await pricesTable.insert({
            id: crypto.randomUUID(),
            stripePriceId: price.id,
            stripeProductId: productId,
            unitAmount,
            currency: currency || 'usd',
            recurringInterval: interval || null,
            recurringIntervalCount: intervalCount || null,
            active: true,
            metadata: {},
            created_at: now,
            updated_at: now
          });
        }
      }

      await getProducts().refresh();
      return { success: true, priceId: price.id };
    } catch (err: any) {
      console.error('[products.createPrice] error:', err);
      error(500, err.message || 'Failed to create price');
    }
  }
);

export const archivePrice = guardedForm(
  v.object({
    priceId: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ priceId }) => {
    try {
      const { stripe } = await import('kuratchi-sdk');
      const { locals } = getRequestEvent();
      const event = getRequestEvent();
      
      // Archive in Stripe
      await stripe.archivePrice(event, priceId);

      // Update database
      const adminDb = await (locals.kuratchi as any)?.getAdminDb?.();
      if (adminDb) {
        const pricesTable = adminDb.stripePrices as any;
        if (pricesTable) {
          await pricesTable
            .where({ stripePriceId: priceId })
            .update({ 
              active: false,
              updated_at: new Date().toISOString()
            });
        }
      }

      await getProducts().refresh();
      return { success: true };
    } catch (err: any) {
      console.error('[products.archivePrice] error:', err);
      error(500, err.message || 'Failed to archive price');
    }
  }
);
