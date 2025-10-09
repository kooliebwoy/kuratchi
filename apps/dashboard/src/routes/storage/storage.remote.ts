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
  return form('unchecked', async (data: any) => {
    const { locals: { session } } = getRequestEvent();
    if (!session?.user) error(401, 'Unauthorized');

    const result = v.safeParse(schema, data);
    if (!result.success) {
      console.error('[guardedForm] Validation failed:', result.issues);
      error(400, `Validation failed: ${result.issues.map((i: any) => `${i.path?.map((p: any) => p.key).join('.')}: ${i.message}`).join(', ')}`);
    }

    return fn(result.output);
  });
};

// Queries
export const getAllMedia = guardedQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const result = await locals.kuratchi?.storage?.listFiles?.({
      bucket: 'default',
      prefix: 'uploads/'
    });
    
    // Transform R2 objects to media format
    return result?.objects?.map((obj: any) => ({
      id: obj.key,
      filename: obj.key.split('/').pop() || obj.key,
      originalFilename: obj.key.split('/').pop() || obj.key,
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded,
      created_at: obj.uploaded,
      mimeType: obj.httpMetadata?.contentType || 'application/octet-stream',
      url: `/api/storage/${obj.key}`,
      folder: null,
      alt: null
    })) ?? [];
  } catch (err) {
    console.error('[storage.getAllMedia] error:', err);
    return [];
  }
});

export const getFolders = guardedQuery(async () => {
  try {
    // For now, return empty array since we're not using folders
    // You can implement folder logic later if needed
    return [];
  } catch (err) {
    console.error('[storage.getFolders] error:', err);
    return [];
  }
});

// Forms - Media
export const uploadMedia = guardedForm(
  v.object({
    files: v.any(), // FileList or File array
    folder: v.optional(v.string())
  }),
  async ({ files, folder }) => {
    try {
      const { locals } = getRequestEvent();
      
      // Handle multiple files
      const fileArray = Array.isArray(files) ? files : Array.from(files as FileList);
      
      for (const file of fileArray) {
        // Upload to R2 with custom key
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const key = `uploads/${timestamp}-${sanitizedName}`;
        
        await locals.kuratchi?.storage?.uploadFile?.(file, {
          bucket: 'default',
          key,
          metadata: {
            contentType: file.type,
            originalName: file.name
          }
        });
      }
      
      await getAllMedia().refresh();
      return { success: true };
    } catch (err) {
      console.error('[storage.uploadMedia] error:', err);
      error(500, 'Failed to upload media');
    }
  }
);

export const updateMedia = guardedForm(
  v.object({
    id: v.pipe(v.string(), v.nonEmpty()), // id is the R2 key
    filename: v.optional(v.string()),
    alt: v.optional(v.string()),
    folder: v.optional(v.string())
  }),
  async ({ id, filename, alt, folder }) => {
    try {
      // For now, R2 doesn't support easy metadata updates without re-uploading
      // You could implement this by copying the object with new metadata
      // For simplicity, we'll just refresh the list
      await getAllMedia().refresh();
      return { success: true };
    } catch (err) {
      console.error('[storage.updateMedia] error:', err);
      error(500, 'Failed to update media');
    }
  }
);

export const deleteMedia = guardedForm(
  v.object({
    id: v.pipe(v.string(), v.nonEmpty()) // id is the R2 key
  }),
  async ({ id }) => {
    try {
      const { locals } = getRequestEvent();
      
      // Delete from R2 (id is the key)
      await locals.kuratchi?.storage?.deleteFile?.(id, 'default');
      
      await getAllMedia().refresh();
      return { success: true };
    } catch (err) {
      console.error('[storage.deleteMedia] error:', err);
      error(500, 'Failed to delete media');
    }
  }
);

// Forms - Folders (simplified - not using database)
export const createFolder = guardedForm(
  v.object({
    name: v.pipe(v.string(), v.nonEmpty()),
    slug: v.pipe(v.string(), v.nonEmpty()),
    parentId: v.optional(v.string())
  }),
  async ({ name, slug, parentId }) => {
    try {
      // Folders are not implemented yet - would need database or prefix-based organization
      await getFolders().refresh();
      return { success: true };
    } catch (err) {
      console.error('[storage.createFolder] error:', err);
      error(500, 'Failed to create folder');
    }
  }
);

export const updateFolder = guardedForm(
  v.object({
    id: v.pipe(v.string(), v.nonEmpty()),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    parentId: v.optional(v.string())
  }),
  async ({ id, name, slug, parentId }) => {
    try {
      // Folders are not implemented yet
      await getFolders().refresh();
      return { success: true };
    } catch (err) {
      console.error('[storage.updateFolder] error:', err);
      error(500, 'Failed to update folder');
    }
  }
);

export const deleteFolder = guardedForm(
  v.object({
    id: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ id }) => {
    try {
      // Folders are not implemented yet
      await getFolders().refresh();
      return { success: true };
    } catch (err) {
      console.error('[storage.deleteFolder] error:', err);
      error(500, 'Failed to delete folder');
    }
  }
);
