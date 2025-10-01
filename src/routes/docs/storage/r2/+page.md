---
layout: docs
---

# R2 (Object Storage)

S3-compatible object storage with batteries-included access via `locals.kuratchi.r2`.

## Batteries-Included Setup

Configure R2 buckets once in your auth handle:

```typescript
// src/hooks.server.ts
import { auth } from 'kuratchi-sdk';

export const handle = auth.handle({
  r2Buckets: {
    default: 'MY_BUCKET',       // Maps 'default' to MY_BUCKET binding
    uploads: 'UPLOADS_BUCKET',  // Multiple buckets
    assets: 'STATIC_ASSETS'
  }
});
```

## Access in Routes

```typescript
// src/routes/+page.server.ts
export async function load({ locals }) {
  const bucket = locals.kuratchi.r2.default;
  
  if (bucket) {
    const object = await bucket.get('my-file.txt');
    if (object) {
      const text = await object.text();
      return { content: text };
    }
  }
}
```

## Basic Operations

### Get

```typescript
const bucket = locals.kuratchi.r2.default;
if (bucket) {
  const object = await bucket.get('file.txt');
  
  if (object) {
    // Get as text
    const text = await object.text();
    
    // Get as array buffer
    const buffer = await object.arrayBuffer();
    
    // Get as stream
    const stream = object.body;
  }
}
```

### Put

```typescript
// Upload text
await bucket.put('file.txt', 'Hello, World!', {
  httpMetadata: {
    contentType: 'text/plain'
  }
});

// Upload buffer
await bucket.put('image.jpg', imageBuffer, {
  httpMetadata: {
    contentType: 'image/jpeg',
    cacheControl: 'public, max-age=31536000'
  },
  customMetadata: {
    uploadedBy: 'user123'
  }
});
```

### Delete

```typescript
await bucket.delete('file.txt');
```

### List

```typescript
// List all objects
const { objects } = await bucket.list();

// List with prefix
const { objects } = await bucket.list({ prefix: 'uploads/' });

// List with limit
const { objects, truncated, cursor } = await bucket.list({ limit: 100 });
```

### Head (Metadata Only)

```typescript
const metadata = await bucket.head('file.txt');
if (metadata) {
  console.log(metadata.size);
  console.log(metadata.uploaded);
}
```

## File Upload (Form Action)

```typescript
// src/routes/upload/+page.server.ts
import type { Actions } from './$types';

export const actions: Actions = {
  upload: async ({ request, locals }) => {
    const bucket = locals.kuratchi.r2.uploads;
    if (!bucket) {
      return { success: false, error: 'R2 not available' };
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return { success: false, error: 'No file provided' };
    }

    const key = `uploads/${Date.now()}-${file.name}`;
    await bucket.put(
      key,
      await file.arrayBuffer(),
      {
        httpMetadata: {
          contentType: file.type
        },
        customMetadata: {
          originalName: file.name,
          uploadedBy: locals.session?.user?.id || 'anonymous'
        }
      }
    );

    return { success: true, key };
  }
};
```

## Serve Files

```typescript
// src/routes/files/[key]/+server.ts
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
  const bucket = locals.kuratchi.r2.uploads;
  if (!bucket) {
    return new Response('R2 not available', { status: 503 });
  }

  const object = await bucket.get(params.key);
  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);

  return new Response(object.body, { headers });
};
```

## Multiple Buckets

```typescript
const main = locals.kuratchi.r2.default;
const uploads = locals.kuratchi.r2.uploads;
const assets = locals.kuratchi.r2.assets;

if (uploads) {
  await uploads.put('user-file.jpg', fileData);
}

if (assets) {
  await assets.put('logo.png', logoData, {
    httpMetadata: {
      contentType: 'image/png',
      cacheControl: 'public, max-age=31536000'
    }
  });
}
```

## wrangler.toml

```toml
[[r2_buckets]]
binding = "MY_BUCKET"
bucket_name = "my-production-bucket"

[[r2_buckets]]
binding = "UPLOADS_BUCKET"
bucket_name = "user-uploads"

[[r2_buckets]]
binding = "STATIC_ASSETS"
bucket_name = "static-assets"
```

## Error Handling

Always check for `null`:

```typescript
const bucket = locals.kuratchi.r2.uploads;
if (bucket) {
  await bucket.put('key', data);
} else {
  console.log('R2 not available, skipping upload');
}
```

## Use Cases

- ✅ File uploads
- ✅ Image storage
- ✅ Video hosting
- ✅ Backups
- ✅ Static assets
- ✅ User-generated content

## Best Practices

- ✅ Use prefixes for organization (`uploads/user123/`)
- ✅ Set content types
- ✅ Add custom metadata
- ✅ Implement access control
- ✅ Use cache headers for static assets
- ❌ Don't store sensitive data unencrypted

[Learn about D1 →](/docs/storage/d1)
