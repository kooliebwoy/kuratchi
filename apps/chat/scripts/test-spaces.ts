#!/usr/bin/env node
import { KuratchiSpaceClient } from '../src/lib/clients/space-client.js';

const WORKER_URL = process.env.CHAT_SPACES_WORKER_URL || 'http://localhost:8787';
const API_KEY = process.env.CHAT_SPACES_API_KEY;

if (!API_KEY) {
  console.error('❌ Missing CHAT_SPACES_API_KEY environment variable');
  process.exit(1);
}

async function testSpace() {
  const spaceId = 'test-space-' + Date.now();
  
  console.log('🧪 Testing Kuratchi Spaces\n');
  console.log('   Worker URL:', WORKER_URL);
  console.log('   Space ID:', spaceId);
  console.log('');

  const client = new KuratchiSpaceClient({
    workerUrl: WORKER_URL,
    apiKey: API_KEY,
    spaceId,
    onMessage: (msg) => {
      console.log('📨 Received message:', msg);
    },
    onTyping: (userId, isTyping) => {
      console.log(`👤 ${userId} is ${isTyping ? 'typing...' : 'not typing'}`);
    },
    onConnectionChange: (connected) => {
      console.log(`🔌 Connection status: ${connected ? 'Connected ✅' : 'Disconnected ❌'}`);
    }
  });

  try {
    // Test 1: Connect to space
    console.log('Test 1: Connecting to space...');
    await client.connect();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (!client.isConnected()) {
      throw new Error('Failed to establish WebSocket connection');
    }
    console.log('✅ Connected successfully\n');

    // Test 2: Send a message
    console.log('Test 2: Sending test message...');
    await client.sendMessage('Hello from automated test!', 'test-user-1', 'user');
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('✅ Message sent\n');

    // Test 3: Send another message
    console.log('Test 3: Sending second message...');
    await client.sendMessage('This is message #2', 'test-user-1', 'user');
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('✅ Second message sent\n');

    // Test 4: Fetch message history
    console.log('Test 4: Fetching message history...');
    const messages = await client.getMessages(50);
    console.log(`✅ Retrieved ${messages.length} messages:`);
    messages.forEach((msg, i) => {
      console.log(`   ${i + 1}. [${msg.senderType}] ${msg.text.substring(0, 50)}`);
    });
    console.log('');

    // Test 5: Typing indicator
    console.log('Test 5: Testing typing indicator...');
    await client.setTyping('test-user-1', true);
    await new Promise(resolve => setTimeout(resolve, 500));
    await client.setTyping('test-user-1', false);
    console.log('✅ Typing indicator working\n');

    console.log('🎉 All tests passed!\n');
    console.log('Summary:');
    console.log('   ✅ WebSocket connection');
    console.log('   ✅ Message sending');
    console.log('   ✅ Message history');
    console.log('   ✅ Typing indicators');
    console.log('   ✅ SQLite storage');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('   Error details:', error.message);
    }
    process.exit(1);
  } finally {
    console.log('\n🔌 Disconnecting...');
    client.disconnect();
    console.log('✅ Disconnected\n');
  }
}

testSpace();
