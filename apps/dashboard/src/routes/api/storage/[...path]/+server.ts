import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';

/**
 * API endpoint to serve files from R2 storage
 * GET /api/storage/uploads/123-image.jpg -> fetches from R2 and streams back
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    const { path } = params;
    
    if (!path) {
      error(400, 'Path is required');
    }

    // Get the file from R2 using the storage plugin
    const file = await locals.kuratchi?.storage?.getFile?.(path, 'default');
    
    if (!file) {
      error(404, 'File not found');
    }

    // Convert the R2 object body to a ReadableStream
    const body = file.body;
    
    // Get content type from R2 metadata or infer from file extension
    const contentType = file.httpMetadata?.contentType || inferMimeType(path);
    
    // Return the file with appropriate headers
    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': file.size.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': file.httpEtag
      }
    });
  } catch (err) {
    console.error('[api/storage] Error fetching file:', err);
    
    if ((err as any)?.status) {
      throw err;
    }
    
    error(500, 'Failed to fetch file from storage');
  }
};

/**
 * Infer MIME type from file extension
 */
function inferMimeType(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'svgz': 'image/svg+xml',
    'bmp': 'image/bmp',
    'avif': 'image/avif',
    // Videos
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'qt': 'video/quicktime',
    'webm': 'video/webm',
    'ogg': 'video/ogg',
    'ogv': 'video/ogg',
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  
  return mimeTypes[extension || ''] || 'application/octet-stream';
}
