<script lang="ts">
  import { MessageSquare, User } from 'lucide-svelte';

  interface Props {
    id: string;
    text: string;
    sender: 'user' | 'support';
    timestamp: Date;
  }

  let { id, text, sender, timestamp }: Props = $props();
</script>

<div class="chat {sender === 'user' ? 'chat-end' : 'chat-start'}">
  <div class="chat-image avatar">
    <div class="w-10 rounded-full bg-base-300 flex items-center justify-center">
      {#if sender === 'user'}
        <User class="h-5 w-5" />
      {:else}
        <MessageSquare class="h-5 w-5 text-primary" />
      {/if}
    </div>
  </div>
  <div class="chat-header mb-1">
    {sender === 'user' ? 'You' : 'Support'}
    <time class="text-xs opacity-50 ml-2">
      {timestamp.toLocaleTimeString()}
    </time>
  </div>
  <div class="chat-bubble {sender === 'user' ? 'chat-bubble-primary' : 'chat-bubble-secondary'}">
    {text}
  </div>
</div>
