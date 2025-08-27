# Queues Guide

This guide covers provisioning Cloudflare Queues with Kuratchi and using them at runtime via a minimal HTTP producer Worker.

- Kuratchi Queues class: `src/lib/queues/kuratchi-queues.ts`

## Prerequisites

- Cloudflare account with Queues enabled
- API Token with Queues + Workers permissions
- Your Workers subdomain, e.g. `example.workers.dev`

## Instantiate Kuratchi

```ts
import { Kuratchi } from 'kuratchi-sdk';

const kuratchi = new Kuratchi({
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  workersSubdomain: process.env.CLOUDFLARE_WORKERS_SUBDOMAIN!,
});
```

## Create a Queue

```ts
const { queue, apiToken } = await kuratchi.queues.createQueue('acme-queue');
```

- Returns the created Queue object and an API token injected as a Worker secret bound to the queue binding.
- Kuratchi deploys a producer Worker named after the queue and waits until its endpoint is responsive.

## Connect to an existing Queue (producer)

```ts
const q = kuratchi.queues.queue({
  queueName: queue?.name || 'acme-queue',
  apiToken, // token returned above or previously stored
});
```

Exposed methods on `q`:
- `send(body, { contentType?, delaySeconds? })`
- `sendBatch([{ body, contentType?, delaySeconds? }, ...])`
- `health()`

### Examples

```ts
// send string
await q.send('hello');

// send JSON with content type
await q.send({ id: 1, email: 'a@acme.com' }, { contentType: 'json' });

// delayed message
await q.send('process-later', { delaySeconds: 30 });

// batch
await q.sendBatch([
  { body: 'a' },
  { body: { b: 2 }, contentType: 'json' },
]);
```

## Deleting a Queue

```ts
await kuratchi.queues.deleteQueue('acme-queue'); // id or name
```

## Notes
- Keep API tokens secret. Do not expose in browser bundles.
- The producer Worker endpoint is `https://<queueName>.<workersSubdomain>`.
- The HTTP API is intentionally minimal (send/send-batch/health) and protected by the `API_KEY` secret.

## Consume messages (pull, with acknowledgements)

Kuratchi provides a minimal HTTP client for pull-based consumers that lets you pull batches and explicitly acknowledge or retry messages via the Cloudflare Queues REST API.

- Helper: `kuratchi.queues.pull({ queueId })`
  - `pull({ batchSize?, visibilityTimeoutMs? })`
  - `ack({ acks?: (string|{ lease_id })[], retries?: { lease_id, delay_seconds? }[] })`

You will need your Queue ID (not name) for pull consumers. Obtain it from the Cloudflare dashboard or via `CloudflareClient.listQueues()`.

### Example: pull and ack

```ts
// Build the pull consumer client for a queue by ID
const consumer = kuratchi.queues.pull({ queueId: 'xxxxxxxxxxxxxxxx' });

// Pull up to 50 messages with 6s visibility timeout
const pulled = await consumer.pull({ batchSize: 50, visibilityTimeoutMs: 6000 });
const messages = pulled?.result?.messages ?? [];

// Process messages and collect lease_ids to ack or retry
const acks: string[] = [];
const retries: Array<{ lease_id: string; delay_seconds?: number }> = [];

for (const m of messages) {
  try {
    // m.body may be string/bytes/json depending on how it was published
    // ... your processing logic ...
    acks.push(m.lease_id);
  } catch (err) {
    // Put message back with optional delay
    retries.push({ lease_id: m.lease_id, delay_seconds: 60 });
  }
}

// Acknowledge successes and mark failures for retry
if (acks.length || retries.length) {
  await consumer.ack({ acks, retries });
}
```

### Push consumers (Worker-based)

If you prefer a push-based consumer (Cloudflare Worker), the runtime exposes ack helpers:

```ts
export default {
  async queue(batch, env, ctx) {
    for (const msg of batch.messages) {
      try {
        // process msg.body
        msg.ack(); // acknowledge this message
      } catch {
        msg.retry({ delaySeconds: 60 }); // retry this message
      }
    }
    // Or, batch-level helpers:
    // batch.ackAll();
    // batch.retryAll({ delaySeconds: 60 });
  }
}
```

To deploy a push consumer Worker via Wrangler, bind the queue as a consumer in your Wrangler config. Kuratchi currently focuses on a minimal producer Worker + pull consumer HTTP client; a push consumer template can be added later if desired.

#### Wrangler configuration (attach queue to Worker as consumer)

Add a consumer entry so your Worker receives messages. This avoids using the REST ack API and rate limits by letting Workers handle ack/retry.

```toml
name = "acme-queue-worker"
main = "src/index.ts"
compatibility_date = "2024-03-20"

[[queues.producers]]
queue = "acme-queue"   # used by HTTP /api/send endpoints via env.QUEUE
binding = "QUEUE"

[[queues.consumers]]
queue = "acme-queue"   # deliver messages to this Worker

[vars]
# API key protecting HTTP endpoints
API_KEY = "<your-random-secret>"
```

After configuring, run `wrangler deploy` to apply producer + consumer configuration.
