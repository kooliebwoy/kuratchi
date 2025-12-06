/**
 * Catalog Image Management
 * Handles downloading scraped images and uploading to R2 storage with SEO-friendly paths
 */

import { r2 } from 'kuratchi-sdk';
import { getAdminDatabase } from '$lib/server/db-context';
import { env } from '$env/dynamic/private';

/**
 * Storage path structure for catalog images:
 * catalog/{oem-slug}/{category}/{model-slug}/{image-type}-{index}.{ext}
 * 
 * Examples:
 * catalog/honda/atv/trx420-rancher/thumbnail.webp
 * catalog/honda/atv/trx420-rancher/gallery-1.webp
 * catalog/polaris/utv/rzr-xp-1000/gallery-2.jpg
 */

export interface CatalogImageUploadResult {
  success: boolean;
  cdnUrl?: string;
  key?: string;
  error?: string;
}

export interface CatalogImageUploadOptions {
  oemSlug: string;
  modelSlug: string;
  category: string;
  imageType: 'thumbnail' | 'gallery';
  index?: number;
}

interface BucketConfig {
  bucketName: string;
  binding: string;
  storageDomain: string | null;
  workerConfig: WorkerConfig | null;
}

interface WorkerConfig {
  workerName: string;
  gatewayKey: string;
  token: string;
  databaseName: string;
  workersSubdomain?: string;
}

/**
 * Slugify a string for URL-safe paths
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')    // Remove non-word chars
    .replace(/[\s_-]+/g, '-')     // Replace spaces/underscores with hyphens
    .replace(/^-+|-+$/g, '');     // Trim leading/trailing hyphens
}

/**
 * Get file extension from URL or content type
 */
function getExtension(url: string, contentType?: string): string {
  // Try to get from content type first
  if (contentType) {
    const typeMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/avif': 'avif',
      'image/svg+xml': 'svg',
    };
    if (typeMap[contentType]) {
      return typeMap[contentType];
    }
  }

  // Fall back to URL extension
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split('.').pop()?.toLowerCase();
    if (ext && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg'].includes(ext)) {
      return ext === 'jpeg' ? 'jpg' : ext;
    }
  } catch {
    // Invalid URL, continue
  }

  // Default to jpg
  return 'jpg';
}

/**
 * Get bucket configuration for catalog uploads
 * Uses the organization-level R2 bucket from primary database
 */
async function getBucketConfig(locals: any): Promise<BucketConfig | null> {
  try {
    const adminDb = await getAdminDatabase(locals);
    const session = locals.session;
    const activeOrgId = session?.organizationId;
    
    if (!activeOrgId) {
      console.error('[catalog-images] No organization ID in session');
      return null;
    }
    
    // Get the primary database record for this organization (has the R2 bucket)
    let dbResult = await adminDb.databases
      .where({ 
        organizationId: activeOrgId, 
        isPrimary: true,
        deleted_at: { isNullish: true } 
      })
      .first();

    // Fallback: try to get any database with R2 bucket for this org
    if (!dbResult.success || !dbResult.data) {
      const anyDbResult = await adminDb.databases
        .where({ 
          organizationId: activeOrgId,
          deleted_at: { isNullish: true }
        })
        .many();
      
      const dbWithBucket = anyDbResult.data?.find((db: any) => db.r2BucketName);
      
      if (!dbWithBucket) {
        console.error('[catalog-images] No storage bucket configured for this organization');
        return null;
      }
      
      dbResult = { success: true, data: dbWithBucket };
    }
    
    const dbRecord = dbResult.data;
    
    if (!dbRecord.r2BucketName) {
      console.error('[catalog-images] Organization database has no R2 bucket configured');
      return null;
    }

    const binding = dbRecord.r2Binding || 'STORAGE';
    const storageDomain = dbRecord.r2StorageDomain || null;
    
    // Get worker config
    let workerConfig: WorkerConfig | null = null;
    
    try {
      const workerName = dbRecord.workerName;
      
      if (workerName) {
        const tokenResult = await adminDb.dbApiTokens
          .where({
            databaseId: dbRecord.id,
            revoked: false,
            deleted_at: { isNullish: true }
          })
          .first();
        
        if (tokenResult.success && tokenResult.data) {
          const gatewayKey = env.KURATCHI_GATEWAY_KEY;
          const workersSubdomain = env.CLOUDFLARE_WORKERS_SUBDOMAIN;
          
          if (gatewayKey) {
            workerConfig = {
              workerName,
              gatewayKey,
              token: tokenResult.data.token,
              databaseName: dbRecord.name || dbRecord.dbuuid,
              workersSubdomain
            };
          } else {
            console.warn('[catalog-images] Missing KURATCHI_GATEWAY_KEY');
          }
        } else {
          console.warn('[catalog-images] No API token found for database');
        }
      } else {
        console.warn('[catalog-images] No worker name configured');
      }
    } catch (err) {
      console.error('[catalog-images] Error getting worker config:', err);
    }
    
    console.log('[catalog-images] Bucket config:', {
      bucketName: dbRecord.r2BucketName,
      binding,
      storageDomain,
      hasWorkerConfig: !!workerConfig,
      workerName: workerConfig?.workerName
    });
    
    return {
      bucketName: dbRecord.r2BucketName,
      binding,
      storageDomain,
      workerConfig
    };
  } catch (err) {
    console.error('[catalog-images] Failed to get bucket config:', err);
    return null;
  }
}

/**
 * Download an image from a URL
 */
async function downloadImage(url: string): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  try {
    console.log('[catalog-images] Downloading:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': new URL(url).origin,
      }
    });

    if (!response.ok) {
      console.error(`[catalog-images] Failed to download: ${response.status} ${response.statusText}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const data = await response.arrayBuffer();

    console.log('[catalog-images] Downloaded:', { size: data.byteLength, contentType });

    // Validate it's actually an image (basic check)
    if (data.byteLength < 100) {
      console.warn(`[catalog-images] Image too small (${data.byteLength} bytes)`);
      return null;
    }

    return { data, contentType };
  } catch (err) {
    console.error(`[catalog-images] Download error:`, err);
    return null;
  }
}

/**
 * Generate SEO-friendly storage key for catalog image
 */
export function generateCatalogImageKey(options: CatalogImageUploadOptions): string {
  const { oemSlug, modelSlug, category, imageType, index } = options;
  const categorySlug = slugify(category || 'other');
  
  // Base path: catalog/{oem}/{category}/{model}/
  const basePath = `catalog/${oemSlug}/${categorySlug}/${modelSlug}`;
  
  if (imageType === 'thumbnail') {
    return `${basePath}/thumbnail`;
  }
  
  return `${basePath}/gallery-${index || 1}`;
}

/**
 * Upload a catalog image to R2 storage
 */
export async function uploadCatalogImage(
  bucketConfig: BucketConfig,
  imageUrl: string,
  options: CatalogImageUploadOptions
): Promise<CatalogImageUploadResult> {
  console.log('[catalog-images] uploadCatalogImage:', { imageUrl: imageUrl.substring(0, 100), options });

  // Check we have worker config
  if (!bucketConfig.workerConfig) {
    console.error('[catalog-images] No worker config available - cannot upload');
    return { success: false, error: 'Storage not configured (missing worker config)' };
  }

  // Download the image
  const imageData = await downloadImage(imageUrl);
  if (!imageData) {
    return { success: false, error: 'Failed to download image from source' };
  }

  // Generate SEO-friendly key
  const ext = getExtension(imageUrl, imageData.contentType);
  const baseKey = generateCatalogImageKey(options);
  const key = `${baseKey}.${ext}`;

  console.log('[catalog-images] Uploading to R2:', {
    binding: bucketConfig.binding,
    key,
    size: imageData.data.byteLength,
    contentType: imageData.contentType
  });

  try {
    // Upload to R2 via worker
    const putResult = await r2.put(
      bucketConfig.binding,
      key,
      imageData.data,
      {
        httpMetadata: {
          contentType: imageData.contentType,
          cacheControl: 'public, max-age=31536000', // 1 year cache
        },
        customMetadata: {
          sourceUrl: imageUrl,
          uploadedAt: new Date().toISOString(),
          imageType: options.imageType,
          oem: options.oemSlug,
          model: options.modelSlug,
          category: options.category,
        }
      },
      bucketConfig.workerConfig
    );

    if (!putResult) {
      console.error('[catalog-images] R2 put returned null');
      return { success: false, error: 'R2 upload failed (null result)' };
    }

    // Construct CDN URL
    let cdnUrl: string | undefined;
    if (bucketConfig.storageDomain) {
      cdnUrl = `https://${bucketConfig.storageDomain}/${key}`;
    } else {
      // Try to get public domain
      try {
        const domainStatus = await r2.getPublicDomain(bucketConfig.bucketName);
        if (domainStatus?.success && domainStatus?.result?.enabled && domainStatus?.result?.domain) {
          cdnUrl = `https://${domainStatus.result.domain}/${key}`;
        }
      } catch {
        // Ignore
      }
    }

    console.log('[catalog-images] Upload successful:', { key, cdnUrl });

    return {
      success: true,
      cdnUrl,
      key
    };
  } catch (err: any) {
    console.error('[catalog-images] Upload error:', err);
    return { success: false, error: err.message || 'Upload failed' };
  }
}

/**
 * Process and upload all images for a vehicle
 * Returns only CDN URLs - never returns source URLs
 */
export async function processVehicleImages(
  locals: any,
  oemName: string,
  modelName: string,
  category: string,
  thumbnailUrl: string | null,
  imageUrls: string[]
): Promise<{
  cdnThumbnailUrl: string | null;
  cdnImages: string[];
  errors: string[];
}> {
  console.log('[catalog-images] processVehicleImages:', {
    oemName,
    modelName,
    category,
    thumbnailUrl: thumbnailUrl?.substring(0, 50),
    imageCount: imageUrls.length
  });

  const oemSlug = slugify(oemName);
  const modelSlug = slugify(modelName);
  const errors: string[] = [];
  
  let cdnThumbnailUrl: string | null = null;
  const cdnImages: string[] = [];

  // Get bucket config once
  const bucketConfig = await getBucketConfig(locals);
  if (!bucketConfig) {
    errors.push('Storage not configured');
    return { cdnThumbnailUrl: null, cdnImages: [], errors };
  }

  if (!bucketConfig.workerConfig) {
    errors.push('Worker not configured for storage uploads');
    return { cdnThumbnailUrl: null, cdnImages: [], errors };
  }

  // Process thumbnail
  if (thumbnailUrl) {
    console.log('[catalog-images] Processing thumbnail...');
    const result = await uploadCatalogImage(bucketConfig, thumbnailUrl, {
      oemSlug,
      modelSlug,
      category,
      imageType: 'thumbnail'
    });
    
    if (result.success && result.cdnUrl) {
      cdnThumbnailUrl = result.cdnUrl;
      console.log('[catalog-images] Thumbnail uploaded:', cdnThumbnailUrl);
    } else {
      errors.push(`Thumbnail: ${result.error || 'Unknown error'}`);
      console.error('[catalog-images] Thumbnail upload failed:', result.error);
    }
  }

  // Process gallery images (limit to prevent excessive uploads)
  const maxGalleryImages = 10;
  const imagesToProcess = imageUrls.slice(0, maxGalleryImages);
  
  for (let i = 0; i < imagesToProcess.length; i++) {
    const imageUrl = imagesToProcess[i];
    
    // Skip if same as thumbnail (already processed)
    if (imageUrl === thumbnailUrl && cdnThumbnailUrl) {
      cdnImages.push(cdnThumbnailUrl);
      continue;
    }

    console.log(`[catalog-images] Processing gallery image ${i + 1}/${imagesToProcess.length}...`);
    const result = await uploadCatalogImage(bucketConfig, imageUrl, {
      oemSlug,
      modelSlug,
      category,
      imageType: 'gallery',
      index: i + 1
    });
    
    if (result.success && result.cdnUrl) {
      cdnImages.push(result.cdnUrl);
    } else {
      errors.push(`Image ${i + 1}: ${result.error || 'Unknown error'}`);
      // DO NOT fall back to source URL - only CDN URLs allowed
    }
  }

  // Use first CDN gallery image as thumbnail if thumbnail upload failed but we have gallery images
  if (!cdnThumbnailUrl && cdnImages.length > 0) {
    cdnThumbnailUrl = cdnImages[0];
  }

  console.log('[catalog-images] processVehicleImages complete:', {
    cdnThumbnailUrl,
    cdnImagesCount: cdnImages.length,
    errorsCount: errors.length
  });

  return {
    cdnThumbnailUrl,
    cdnImages,
    errors
  };
}
