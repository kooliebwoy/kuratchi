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

const inferMimeTypeFromKey = (key: string) => {
  const extension = key?.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
    case 'svgz':
      return 'image/svg+xml';
    case 'bmp':
      return 'image/bmp';
    case 'avif':
      return 'image/avif';
    case 'mp4':
      return 'video/mp4';
    case 'mov':
    case 'qt':
      return 'video/quicktime';
    case 'webm':
      return 'video/webm';
    case 'ogg':
    case 'ogv':
      return 'video/ogg';
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default:
      return 'application/octet-stream';
  }
};

// Queries
export const getAllMedia = guardedQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const db = await (locals.kuratchi as any)?.orgDatabaseClient?.();
    if (!db?.storage) {
      console.warn('[storage.getAllMedia] Storage client not available');
      return [];
    }
    const result = await db.storage.list({ prefix: 'uploads/' });
    if (!result.success) {
      console.error('[storage.getAllMedia] List failed:', result.error);
      return [];
    }
    
    // Transform R2 objects to media format
    return result?.results?.objects?.map((obj: any) => {
      // Extract folder from key path
      // e.g., "uploads/folder-name/file.jpg" -> "uploads/folder-name/"
      const pathParts = obj.key.split('/');
      let folder = null;
      if (pathParts.length > 2) {
        // File is inside a folder
        folder = `${pathParts[0]}/${pathParts[1]}/`;
      }
      
      return {
        id: obj.key,
        filename: obj.key.split('/').pop() || obj.key,
        originalFilename: obj.key.split('/').pop() || obj.key,
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded,
        created_at: obj.uploaded,
        mimeType: obj.httpMetadata?.contentType || inferMimeTypeFromKey(obj.key),
        url: `/api/storage/${obj.key}`,
        folder: folder,
        alt: null
      };
    }).filter((obj: any) => !obj.filename.startsWith('.')) ?? [];
  } catch (err) {
    console.error('[storage.getAllMedia] error:', err);
    return [];
  }
});

export const getFolders = guardedQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const db = await (locals.kuratchi as any)?.orgDatabaseClient?.();
    if (!db?.storage) {
      console.warn('[storage.getFolders] Storage client not available');
      return [];
    }
    const result = await db.storage.list({ prefix: 'uploads/', delimiter: '/' });
    if (!result.success) {
      console.error('[storage.getFolders] List failed:', result.error);
      return [];
    }
    
    // Extract unique folder prefixes from delimitedPrefixes
    // R2's list with delimiter gives us the "virtual folders"
    const folders = (result?.results?.prefixes || []).map((prefix: string) => {
      // prefix will be like "uploads/folder-name/"
      const folderName = prefix.replace('uploads/', '').replace('/', '');
      return {
        id: prefix,
        name: folderName,
        slug: folderName,
        path: prefix
      };
    });
    
    return folders;
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
      const db = await (locals.kuratchi as any)?.orgDatabaseClient?.();
      if (!db?.storage) {
        error(500, 'Storage client not available');
      }
      
      // Handle multiple files
      const fileArray = Array.isArray(files) ? files : Array.from(files as FileList);
      
      for (const file of fileArray) {
        // Upload to R2 with custom key
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        
        // Build key with folder support
        let key: string;
        if (folder && folder !== '') {
          // folder is expected to be like "uploads/folder-name/"
          key = `${folder}${timestamp}-${sanitizedName}`;
        } else {
          key = `uploads/${timestamp}-${sanitizedName}`;
        }
        
        // Read file as base64
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const base64 = btoa(String.fromCharCode(...bytes));
        
        const result = await db.storage.put({
          key,
          data: base64,
          httpMetadata: { contentType: file.type },
          customMetadata: { originalName: file.name }
        });
        
        if (!result.success) {
          console.error('[storage.uploadMedia] Upload failed:', result.error);
          error(500, `Failed to upload ${file.name}`);
        }
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
      const db = await (locals.kuratchi as any)?.orgDatabaseClient?.();
      if (!db?.storage) {
        error(500, 'Storage client not available');
      }
      
      // Delete from R2 (id is the key)
      const result = await db.storage.delete(id);
      if (!result.success) {
        console.error('[storage.deleteMedia] Delete failed:', result.error);
        error(500, 'Failed to delete file');
      }
      
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
      const { locals } = getRequestEvent();
      const db = await (locals.kuratchi as any)?.orgDatabaseClient?.();
      if (!db?.storage) {
        error(500, 'Storage client not available');
      }
      
      // Create a folder by uploading a .keep file
      // This creates the folder structure in R2
      const folderPath = `uploads/${slug}/`;
      const base64 = btoa('');
      
      const result = await db.storage.put({
        key: `${folderPath}.keep`,
        data: base64,
        httpMetadata: { contentType: 'text/plain' },
        customMetadata: { folderName: name }
      });
      
      if (!result.success) {
        console.error('[storage.createFolder] Create failed:', result.error);
        error(500, 'Failed to create folder');
      }
      
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
      const { locals } = getRequestEvent();
      const db = await (locals.kuratchi as any)?.orgDatabaseClient?.();
      if (!db?.storage) {
        error(500, 'Storage client not available');
      }
      
      // For R2 prefix-based folders, renaming means moving all files
      // This is complex, so for now we'll just update the .keep file metadata
      if (slug) {
        const newFolderPath = `uploads/${slug}/`;
        const base64 = btoa('');
        
        // Delete old .keep
        await db.storage.delete(id + '.keep');
        
        // Create new .keep
        const result = await db.storage.put({
          key: `${newFolderPath}.keep`,
          data: base64,
          httpMetadata: { contentType: 'text/plain' },
          customMetadata: { folderName: name || slug }
        });
        
        if (!result.success) {
          console.error('[storage.updateFolder] Update failed:', result.error);
          error(500, 'Failed to update folder');
        }
      }
      
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
      const { locals } = getRequestEvent();
      const db = await (locals.kuratchi as any)?.orgDatabaseClient?.();
      if (!db?.storage) {
        error(500, 'Storage client not available');
      }
      
      // List all files in the folder
      const result = await db.storage.list({ prefix: id });
      if (!result.success) {
        console.error('[storage.deleteFolder] List failed:', result.error);
        error(500, 'Failed to list folder contents');
      }
      
      // Delete all files in the folder
      if (result?.results?.objects && result.results.objects.length > 0) {
        for (const obj of result.results.objects) {
          await db.storage.delete(obj.key);
        }
      }
      
      await getFolders().refresh();
      return { success: true };
    } catch (err) {
      console.error('[storage.deleteFolder] error:', err);
      error(500, 'Failed to delete folder');
    }
  }
);
