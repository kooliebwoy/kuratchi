# Spaces (Real-time chat)

Spaces provides Durable Object–backed chat rooms with WebSocket delivery, token generation, and a deployable worker template. The API in `src/lib/spaces` exposes clients, deployment helpers, and token utilities.

## Client usage

```ts
import { spaces } from 'kuratchi-sdk';

const client = spaces.client({
  spaceId: 'general',
  spaceToken: process.env.SPACE_TOKEN, // or omit to generate on the server
  gatewayKey: process.env.KURATCHI_GATEWAY_KEY,
  workerUrl: process.env.KURATCHI_SPACES_WORKER_URL,
  onMessage: (msg) => console.log('message', msg),
  onTyping: (userId, typing) => console.log(userId, typing),
  onConnectionChange: (connected) => console.log('connected', connected)
});

await client.connect();
await client.sendMessage({ body: 'Hello' });
```

If you omit `spaceToken`, generate it server-side with `spaces.generateToken(spaceId, { gatewayKey, expiryMs })` and pass it to the client.

## Deploy the worker

Use the bundled worker template and deployment helper to launch a Spaces worker on Cloudflare.

```ts
import { spaces } from 'kuratchi-sdk';

await spaces.deploy({
  workerName: 'kuratchi-spaces',
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  gatewayKey: process.env.KURATCHI_GATEWAY_KEY!,
  scriptName: 'kuratchi-spaces'
});
```

Environment variables used by the runtime helpers are defined in `src/lib/spaces/core/config.ts` (`KURATCHI_SPACES_WORKER_URL`, `KURATCHI_GATEWAY_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`).
