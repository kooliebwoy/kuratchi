// Kuratchi Spaces - Durable Object Worker for Chat Rooms
// Each chat conversation gets its own Durable Object instance with SQLite storage (up to 10GB)
// Provides real-time messaging with WebSocket support and persistent message history

export const CHAT_SPACE_WORKER_SCRIPT = `import { DurableObject } from 'cloudflare:workers';

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-space-id, x-space-token',
      'Access-Control-Expose-Headers': ''
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Enforce master gateway key
    const auth = request.headers.get('Authorization');
    const expected = \`Bearer \${env.API_KEY}\`;
    if (!auth || auth !== expected) {
      return new Response(JSON.stringify({ error: 'Invalid or missing gateway key' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get space ID (conversation ID)
    const spaceId = request.headers.get('x-space-id');
    if (!spaceId) {
      return new Response(JSON.stringify({ error: 'x-space-id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Validate space token
    const spaceToken = request.headers.get('x-space-token');
    if (!spaceToken) {
      return new Response(JSON.stringify({ error: 'Missing x-space-token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Validate token: format space.rnd.exp.sig
    const parts = spaceToken.split('.');
    if (parts.length !== 4) {
      return new Response(JSON.stringify({ error: 'Invalid token format' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    const [tSpace, rnd, expStr, sigB64] = parts;
    if (tSpace !== spaceId) {
      return new Response(JSON.stringify({ error: 'Token space mismatch' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    const expNum = Number(expStr);
    if (!Number.isFinite(expNum) || expNum < Date.now()) {
      return new Response(JSON.stringify({ error: 'Token expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Verify token signature
    const payload = tSpace + '.' + rnd + '.' + expNum;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(env.API_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
    
    const bytes = new Uint8Array(sig);
    let str = '';
    for (let i = 0; i < bytes.length; i++) {
      str += String.fromCharCode(bytes[i]);
    }
    let b64 = btoa(str);
    b64 = b64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    if (b64 !== sigB64) {
      return new Response(JSON.stringify({ error: 'Invalid token signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    try {
      // Route to Durable Object instance (one per space/conversation)
      const id = env.CHAT_SPACES.idFromName(spaceId);
      const stub = env.CHAT_SPACES.get(id);
      const url = new URL(request.url);
      url.pathname = '/space' + url.pathname;
      const forwarded = new Request(url.toString(), request);
      const resp = await stub.fetch(forwarded);

      const headers = new Headers(resp.headers);
      for (const [k, v] of Object.entries(corsHeaders)) {
        headers.set(k, v);
      }
      
      // Handle WebSocket upgrade
      if (resp.webSocket) {
        return new Response(null, {
          status: 101,
          webSocket: resp.webSocket,
          headers
        });
      }
      
      const body = await resp.text();
      return new Response(body, { status: resp.status, headers });
    } catch (error) {
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }
};

export class KuratchiChatSpace extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;
    this.sessions = new Set(); // WebSocket connections
    this.initializeSchema();
  }

  initializeSchema() {
    // Create tables for this space if they don't exist
    this.sql.exec(\`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL,
        sender_type TEXT NOT NULL,
        message_text TEXT NOT NULL,
        attachments TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    \`);
    
    this.sql.exec(\`
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)
    \`);
    
    this.sql.exec(\`
      CREATE TABLE IF NOT EXISTS participants (
        user_id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        joined_at INTEGER NOT NULL
      )
    \`);
    
    this.sql.exec(\`
      CREATE TABLE IF NOT EXISTS typing_status (
        user_id TEXT PRIMARY KEY,
        last_typed_at INTEGER NOT NULL
      )
    \`);
    
    this.sql.exec(\`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    \`);
  }

  async fetch(request) {
    const url = new URL(request.url);
    
    // Handle WebSocket upgrades
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    if (request.method !== 'POST' && request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      switch (url.pathname) {
        case '/space/messages':
          return request.method === 'POST' 
            ? await this.sendMessage(request)
            : await this.getMessages(request);
        case '/space/participants':
          return await this.getParticipants(request);
        case '/space/typing':
          return await this.updateTypingStatus(request);
        case '/space/metadata':
          return await this.getMetadata(request);
        default:
          return new Response(JSON.stringify({ error: 'Invalid endpoint' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async handleWebSocket(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);
    this.sessions.add(server);

    server.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'message') {
          // Store and broadcast message
          const message = await this.storeMessage(data);
          this.broadcast({ type: 'message', message });
        } else if (data.type === 'typing') {
          // Broadcast typing status
          this.broadcast({ type: 'typing', userId: data.userId, isTyping: data.isTyping });
        }
      } catch (err) {
        server.send(JSON.stringify({ error: String(err) }));
      }
    });

    server.addEventListener('close', () => {
      this.sessions.delete(server);
    });

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  broadcast(message) {
    const msg = JSON.stringify(message);
    for (const session of this.sessions) {
      try {
        session.send(msg);
      } catch (err) {
        this.sessions.delete(session);
      }
    }
  }

  async sendMessage(request) {
    const { senderId, senderType, text, attachments } = await request.json();
    
    if (!senderId || !senderType || !text) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const message = await this.storeMessage({ senderId, senderType, text, attachments });
    
    // Broadcast to all connected clients
    this.broadcast({ type: 'message', message });
    
    return new Response(JSON.stringify({ success: true, message }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async storeMessage(data) {
    const id = crypto.randomUUID();
    const now = Date.now();
    
    this.sql.exec(
      \`INSERT INTO messages (id, sender_id, sender_type, message_text, attachments, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)\`,
      id,
      data.senderId,
      data.senderType,
      data.text,
      data.attachments ? JSON.stringify(data.attachments) : null,
      now,
      now
    );

    return {
      id,
      senderId: data.senderId,
      senderType: data.senderType,
      text: data.text,
      attachments: data.attachments || null,
      createdAt: now,
      updatedAt: now
    };
  }

  async getMessages(request) {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const before = url.searchParams.get('before');
    
    let query = 'SELECT * FROM messages';
    const params = [];
    
    if (before) {
      query += ' WHERE created_at < ?';
      params.push(parseInt(before));
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    
    const cursor = this.sql.exec(query, ...params);
    const rows = cursor.toArray();
    
    const messages = rows.map(row => ({
      id: row.id,
      senderId: row.sender_id,
      senderType: row.sender_type,
      text: row.message_text,
      attachments: row.attachments ? JSON.parse(row.attachments) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    return new Response(JSON.stringify({ success: true, messages }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async getParticipants(request) {
    const cursor = this.sql.exec('SELECT * FROM participants');
    const rows = cursor.toArray();
    
    return new Response(JSON.stringify({ success: true, participants: rows }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async updateTypingStatus(request) {
    const { userId, isTyping } = await request.json();
    
    if (isTyping) {
      this.sql.exec(
        'INSERT OR REPLACE INTO typing_status (user_id, last_typed_at) VALUES (?, ?)',
        userId,
        Date.now()
      );
    } else {
      this.sql.exec('DELETE FROM typing_status WHERE user_id = ?', userId);
    }
    
    // Broadcast typing status
    this.broadcast({ type: 'typing', userId, isTyping });
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async getMetadata(request) {
    const cursor = this.sql.exec('SELECT * FROM metadata');
    const rows = cursor.toArray();
    const metadata = {};
    
    for (const row of rows) {
      metadata[row.key] = row.value;
    }
    
    return new Response(JSON.stringify({ success: true, metadata }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
`;
