<script lang="ts">
  import { MessageSquare, Send, User, Wifi, WifiOff } from '@lucide/svelte';
  import type { PageData } from './$types';
  import * as spaces from 'kuratchi-sdk/spaces';
  import type { Message } from 'kuratchi-sdk/spaces';
  import { onMount, onDestroy } from 'svelte';

  let { data }: { data: PageData } = $props();

  let spaceClient: ReturnType<typeof spaces.client> | null = null;
  let messages = $state<Message[]>([]);
  let newMessage = $state('');
  let isConnected = $state(false);
  let isTyping = $state(false);
  let currentUserId = 'user-' + Math.random().toString(36).substring(7); // TODO: Get from auth

  onMount(async () => {
    // TODO: Get these from server-side data
    const spaceId = `demo-space-${Date.now()}`;
    const gatewayKey = 'demo-key'; // TODO: Get from env
    const workerUrl = 'http://localhost:8787'; // TODO: Update for production

    // Generate a space token server-side in production
    const spaceToken = await spaces.generateToken(spaceId, { gatewayKey });

    spaceClient = spaces.client({
      spaceId,
      spaceToken,
      gatewayKey,
      workerUrl,
      onMessage: (msg) => {
        messages = [...messages, msg];
      },
      onTyping: (userId, typing) => {
        if (userId !== currentUserId) {
          isTyping = typing;
        }
      },
      onConnectionChange: (connected) => {
        isConnected = connected;
      }
    });

    try {
      await spaceClient.connect();
      // Load message history
      const history = await spaceClient.getMessages({ limit: 50 });
      messages = history.reverse(); // Show oldest first
    } catch (error) {
      console.error('Failed to connect to space:', error);
      // Add a system message as fallback
      messages = [{
        id: '1',
        senderId: 'system',
        senderType: 'system',
        text: 'Unable to connect to chat server. Please refresh the page.',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }];
    }
  });

  onDestroy(() => {
    spaceClient?.disconnect();
  });

  async function sendMessage() {
    if (!newMessage.trim() || !spaceClient) return;

    const text = newMessage;
    newMessage = '';

    try {
      await spaceClient.sendMessage({
        senderId: currentUserId,
        senderType: 'user',
        text
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      // Add the message locally as fallback
      messages = [...messages, {
        id: crypto.randomUUID(),
        senderId: currentUserId,
        senderType: 'user',
        text,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }];
    }
  }

  let typingTimeout: ReturnType<typeof setTimeout> | null = null;

  function handleInput() {
    if (!spaceClient) return;
    
    // Send typing indicator
    spaceClient.setTyping(currentUserId, true);
    
    // Clear existing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    // Stop typing after 2 seconds of inactivity
    typingTimeout = setTimeout(() => {
      spaceClient?.setTyping(currentUserId, false);
    }, 2000);
  }

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      spaceClient?.setTyping(currentUserId, false);
    }
  }
</script>

<div class="flex h-screen flex-col">
  <!-- Header -->
  <header class="border-b border-base-300 bg-base-200 px-6 py-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <MessageSquare class="h-6 w-6 text-primary" />
        <h1 class="text-xl font-semibold">Kuratchi Support Chat</h1>
      </div>
      <div class="flex items-center gap-2">
        {#if isConnected}
          <Wifi class="h-5 w-5 text-success" />
          <span class="text-sm text-success">Connected</span>
        {:else}
          <WifiOff class="h-5 w-5 text-error" />
          <span class="text-sm text-error">Disconnected</span>
        {/if}
      </div>
    </div>
  </header>

  <!-- Messages Container -->
  <main class="flex-1 overflow-y-auto p-6">
    <div class="mx-auto max-w-4xl space-y-4">
      {#each messages as message (message.id)}
        <div class="chat {message.senderType === 'user' ? 'chat-end' : 'chat-start'}">
          <div class="chat-image avatar">
            <div class="w-10 rounded-full bg-base-300 flex items-center justify-center">
              {#if message.senderType === 'user'}
                <User class="h-5 w-5" />
              {:else}
                <MessageSquare class="h-5 w-5 text-primary" />
              {/if}
            </div>
          </div>
          <div class="chat-header mb-1">
            {message.senderType === 'user' ? 'You' : message.senderType === 'system' ? 'System' : 'Support'}
            <time class="text-xs opacity-50 ml-2">
              {new Date(message.createdAt).toLocaleTimeString()}
            </time>
          </div>
          <div class="chat-bubble {message.senderType === 'user' ? 'chat-bubble-primary' : 'chat-bubble-secondary'}">
            {message.text}
          </div>
        </div>
      {/each}
      
      {#if isTyping}
        <div class="chat chat-start">
          <div class="chat-image avatar">
            <div class="w-10 rounded-full bg-base-300 flex items-center justify-center">
              <MessageSquare class="h-5 w-5 text-primary" />
            </div>
          </div>
          <div class="chat-bubble chat-bubble-secondary">
            <span class="loading loading-dots loading-sm"></span>
          </div>
        </div>
      {/if}
    </div>
  </main>

  <!-- Message Input -->
  <footer class="border-t border-base-300 bg-base-200 p-4">
    <div class="mx-auto max-w-4xl">
      <form onsubmit={(e) => { e.preventDefault(); sendMessage(); }} class="flex gap-2">
        <textarea
          bind:value={newMessage}
          oninput={handleInput}
          onkeypress={handleKeyPress}
          placeholder="Type your message..."
          class="textarea textarea-bordered flex-1 resize-none"
          rows="1"
        ></textarea>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={!newMessage.trim()}
        >
          <Send class="h-5 w-5" />
        </button>
      </form>
    </div>
  </footer>
</div>
