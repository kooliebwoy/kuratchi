import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// POST /api/messages - Send a new message
export const POST: RequestHandler = async ({ request, platform }) => {
  try {
    const { conversationId, text, senderId, senderType } = await request.json();

    // Validate input
    if (!conversationId || !text || !senderId || !senderType) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    // TODO: Store message in D1 database
    // const db = platform?.env.CHAT_DB;
    // await db.prepare('INSERT INTO messages ...').bind(...).run();

    const message = {
      id: crypto.randomUUID(),
      conversationId,
      senderId,
      senderType,
      text,
      attachments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // TODO: Broadcast message via WebSocket/SSE to all participants
    // TODO: Send notification using kuratchi-sdk

    return json({ message }, { status: 201 });
  } catch (error) {
    console.error('Error creating message:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

// GET /api/messages?conversationId=xxx - Get messages for a conversation
export const GET: RequestHandler = async ({ url, platform }) => {
  try {
    const conversationId = url.searchParams.get('conversationId');

    if (!conversationId) {
      return json({ error: 'conversationId is required' }, { status: 400 });
    }

    // TODO: Fetch messages from D1 database
    // const db = platform?.env.CHAT_DB;
    // const messages = await db.prepare('SELECT * FROM messages WHERE conversation_id = ?').bind(conversationId).all();

    // Mock data for now
    const messages = [
      {
        id: '1',
        conversationId,
        senderId: 'system',
        senderType: 'system',
        text: 'Hello! How can we help you today?',
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    return json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
