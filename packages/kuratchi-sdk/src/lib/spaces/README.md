# Kuratchi Spaces

Real-time chat rooms powered by Cloudflare Durable Objects with SQLite storage (up to 10GB per space).

## Overview

Kuratchi Spaces provides a complete chat infrastructure where each conversation gets its own isolated Durable Object instance with SQLite storage. Perfect for:
- Customer support chat
- Team messaging
- Real-time collaboration
- Chat rooms
- Comments systems

## Installation

```bash
pnpm add kuratchi-sdk
```

## Quick Start

### 1. Server-Side Setup

Generate a space token (this should be done server-side):

```typescript
import * as spaces from 'kuratchi-sdk/spaces';

// In your API route or server action
export async function createChatSession(userId: string) {
  const spaceId = `support-${userId}-${Date.now()}`;
  
  // Generate a secure token (expires in 1 hour by default)
  const spaceToken = await spaces.generateToken(spaceId, {
    gatewayKey: process.env.KURATCHI_GATEWAY_KEY!
  });
  
  return {
    spaceId,
    spaceToken,
    workerUrl: process.env.KURATCHI_SPACES_WORKER_URL!
  };
}
```

### 2. Client-Side Usage

Connect to the space and start chatting:

```typescript
import * as spaces from 'kuratchi-sdk/spaces';

// Create a space client
const client = spaces.client({
  spaceId: 'support-user123-1699999999',
  spaceToken: 'conversation-abc123.x7k2m9p1.1700000000000.signature',
  gatewayKey: process.env.KURATCHI_GATEWAY_KEY!,
  workerUrl: 'https://chat-spaces.yourdomain.com',
  
  // Event handlers
  onMessage: (message) => {
    console.log('New message:', message);
  },
  onTyping: (userId, isTyping) => {
    console.log(`${userId} is ${isTyping ? 'typing...' : 'idle'}`);
  },
  onConnectionChange: (connected) => {
    console.log('Connection status:', connected);
  }
});

// Connect via WebSocket
await client.connect();

// Send a message
await client.sendMessage({
  senderId: 'user123',
  senderType: 'user',
  text: 'Hello, I need help!'
});

// Get message history
const messages = await client.getMessages({ limit: 50 });

// Update typing status
await client.setTyping('user123', true);

// Disconnect when done
client.disconnect();
```

## API Reference

### `client(config)`

Creates a space client instance.

**Parameters:**
- `spaceId` - Unique identifier for the space
- `spaceToken` - Secure token for authentication
- `gatewayKey` - API key for the gateway
- `workerUrl` - URL of the deployed spaces worker
- `onMessage?` - Callback for new messages
- `onTyping?` - Callback for typing indicators
- `onConnectionChange?` - Callback for connection status
- `onError?` - Callback for errors

**Returns:** `KuratchiSpaceClient`

### `generateToken(spaceId, options?)`

Generates a secure space token.

**Parameters:**
- `spaceId` - Space identifier
- `options.gatewayKey?` - API key (or use env var)
- `options.expiryMs?` - Token expiry in milliseconds (default: 1 hour)

**Returns:** `Promise<string>`

### Client Methods

#### `client.connect(): Promise<void>`
Connect to the space via WebSocket for real-time updates.

#### `client.disconnect(): void`
Disconnect from the space.

#### `client.isConnected(): boolean`
Check if WebSocket is connected.

#### `client.sendMessage(options): Promise<Message | void>`
Send a message to the space.

**Parameters:**
- `senderId` - ID of the sender
- `senderType` - 'user' | 'support' | 'system'
- `text` - Message text
- `attachments?` - Array of attachments

#### `client.getMessages(options?): Promise<Message[]>`
Get message history.

**Parameters:**
- `limit?` - Number of messages to fetch (default: 50)
- `before?` - Get messages before this timestamp

#### `client.setTyping(userId, isTyping): Promise<void>`
Update typing status.

#### `client.getParticipants(): Promise<Participant[]>`
Get list of participants in the space.

#### `client.getMetadata(): Promise<SpaceMetadata>`
Get space metadata.

## Types

```typescript
interface Message {
  id: string;
  senderId: string;
  senderType: 'user' | 'support' | 'system';
  text: string;
  attachments?: Attachment[];
  createdAt: number;
  updatedAt: number;
}

interface Attachment {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
}

interface Participant {
  userId: string;
  role: 'customer' | 'agent';
  joinedAt: number;
}
```

## Environment Variables

```bash
# Required for client usage
KURATCHI_GATEWAY_KEY=your_secure_key                    # Standard Kuratchi key
KURATCHI_SPACES_WORKER_URL=https://kuratchi-spaces.your-subdomain.workers.dev

# Required for deployment only
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
```

**Note:** Kuratchi Spaces uses the standard `KURATCHI_GATEWAY_KEY` that you already use for database, notifications, and other Kuratchi SDK features. No need for a separate key!

## Deployment

Deploy the Spaces worker to Cloudflare in one command:

```bash
# From workspace root
pnpm deploy:spaces

# Or from SDK package
cd packages/kuratchi-sdk
pnpm deploy:spaces
```

**Environment variables needed:**
```bash
export CLOUDFLARE_ACCOUNT_ID=your-account-id
export CLOUDFLARE_API_TOKEN=your-api-token
export KURATCHI_GATEWAY_KEY=your-key
```

Or programmatically:

```typescript
import * as spaces from 'kuratchi-sdk/spaces';

const result = await spaces.deploy({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  apiToken: process.env.CLOUDFLARE_API_TOKEN,
  gatewayKey: process.env.KURATCHI_GATEWAY_KEY
});

console.log('Worker URL:', result.workerUrl);
```

See the [full deployment guide](../../KURATCHI_SPACES_DEPLOYMENT.md) for detailed instructions.

## Features

- **Isolated Storage**: Each space has up to 10GB SQLite database
- **Real-time**: WebSocket support for instant updates
- **Secure**: HMAC-SHA256 token authentication
- **Scalable**: Unlimited number of spaces
- **Fast**: Local SQLite queries < 1ms
- **Cost-effective**: ~$25-35/month for 1000 active chats

## Examples

### Svelte Component

```svelte
<script lang="ts">
  import * as spaces from 'kuratchi-sdk/spaces';
  import type { Message } from 'kuratchi-sdk/spaces';
  import { onMount, onDestroy } from 'svelte';
  
  let client: ReturnType<typeof spaces.client> | null = null;
  let messages = $state<Message[]>([]);
  let newMessage = $state('');
  
  onMount(async () => {
    // Get space config from your API
    const { spaceId, spaceToken, workerUrl } = await fetch('/api/chat/init').then(r => r.json());
    
    client = spaces.client({
      spaceId,
      spaceToken,
      gatewayKey: import.meta.env.VITE_SPACES_KEY,
      workerUrl,
      onMessage: (msg) => messages = [...messages, msg]
    });
    
    await client.connect();
    messages = await client.getMessages();
  });
  
  onDestroy(() => client?.disconnect());
  
  async function send() {
    await client?.sendMessage({
      senderId: 'current-user-id',
      senderType: 'user',
      text: newMessage
    });
    newMessage = '';
  }
</script>

{#each messages as message}
  <div>{message.text}</div>
{/each}

<input bind:value={newMessage} />
<button onclick={send}>Send</button>
```

### React Component

```tsx
import * as spaces from 'kuratchi-sdk/spaces';
import type { Message } from 'kuratchi-sdk/spaces';
import { useEffect, useState } from 'react';

export function ChatRoom() {
  const [client, setClient] = useState<ReturnType<typeof spaces.client> | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  
  useEffect(() => {
    async function init() {
      const { spaceId, spaceToken, workerUrl } = await fetch('/api/chat/init').then(r => r.json());
      
      const c = spaces.client({
        spaceId,
        spaceToken,
        gatewayKey: process.env.NEXT_PUBLIC_SPACES_KEY!,
        workerUrl,
        onMessage: (msg) => setMessages(prev => [...prev, msg])
      });
      
      await c.connect();
      const history = await c.getMessages();
      setMessages(history);
      setClient(c);
    }
    
    init();
    return () => client?.disconnect();
  }, []);
  
  const send = async () => {
    await client?.sendMessage({
      senderId: 'current-user-id',
      senderType: 'user',
      text: input
    });
    setInput('');
  };
  
  return (
    <div>
      {messages.map(m => <div key={m.id}>{m.text}</div>)}
      <input value={input} onChange={e => setInput(e.target.value)} />
      <button onClick={send}>Send</button>
    </div>
  );
}
```

## Architecture

Each space is a Durable Object instance with:
- SQLite database (up to 10GB)
- WebSocket connections for real-time
- Message history
- Typing indicators
- Participant tracking
- Custom metadata

Perfect for chat, comments, collaborative features, and more!

## Learn More

- [Full Architecture Guide](../../apps/chat/SPACES_ARCHITECTURE.md)
- [Deployment Guide](../../apps/chat/DEPLOYMENT_GUIDE.md)
- [Quick Start](../../apps/chat/QUICK_START.md)
