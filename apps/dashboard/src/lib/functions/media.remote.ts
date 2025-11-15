import { getRequestEvent, command } from '$app/server';
import { getDatabase } from '$lib/server/db-context';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';

const UploadMediaSchema = v.object({
	siteId: v.pipe(v.string(), v.nonEmpty()),
	file: v.any(), // File object
	folder: v.optional(v.string())
});

type UploadMediaPayload = v.InferOutput<typeof UploadMediaSchema>;

/**
 * Upload media to site's R2 bucket
 */
export const uploadSiteMedia = command(UploadMediaSchema, async ({ siteId, file, folder }: UploadMediaPayload) => {
	const { locals } = getRequestEvent();
	const session = locals.session;

	if (!siteId) {
		error(400, 'Site ID required');
	}

	// Get site and verify it has an R2 bucket
	const db = await getDatabase(locals);
	const siteResult = await db.sites
		.where({ id: siteId, deleted_at: { isNullish: true } })
		.one();

	if (!siteResult.success || !siteResult.data) {
		error(404, 'Site not found');
	}

	const site = siteResult.data;

	if (!site.r2BucketName) {
		error(500, 'Site does not have an R2 bucket configured');
	}

	// Use folder or default to 'uploads'
	const uploadFolder = folder || 'uploads';

	if (!file) {
		error(400, 'No file provided');
	}

	// Generate unique filename
	const timestamp = Date.now();
	const randomStr = Math.random().toString(36).substring(2, 8);
	const ext = file.name.split('.').pop();
	const filename = `${timestamp}-${randomStr}.${ext}`;
	const key = `${uploadFolder}/${filename}`;

	// Get R2 bucket binding from platform
	const platform = getCurrentPlatform();
	const bucket = platform?.env?.[site.r2Binding || 'STORAGE'];

	if (!bucket) {
		error(500, 'R2 bucket binding not available');
	}

	// Upload file to R2
	const arrayBuffer = await file.arrayBuffer();
	await bucket.put(key, arrayBuffer, {
		httpMetadata: {
			contentType: file.type || 'application/octet-stream',
		},
		customMetadata: {
			originalName: file.name,
			uploadedBy: session?.userId || 'unknown',
			uploadedAt: new Date().toISOString(),
		}
	});

	// Generate public URL
	// TODO: Use custom domain when configured
	const publicUrl = `https://pub-${site.r2BucketName}.r2.dev/${key}`;

	console.log('[Media Upload] File uploaded:', {
		siteId,
		bucket: site.r2BucketName,
		key,
		size: file.size,
		type: file.type
	});

	return {
		success: true,
		url: publicUrl,
		key,
		filename,
		size: file.size,
		contentType: file.type
	};
});

// Helper to get platform context
function getCurrentPlatform() {
	try {
		return (globalThis as any).__platform__;
	} catch {
		return null;
	}
}
