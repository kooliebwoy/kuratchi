<script lang="ts">
  import { Send } from 'lucide-svelte';

  interface Props {
    onSend: (message: string) => void;
  }

  let { onSend }: Props = $props();
  let newMessage = $state('');

  function sendMessage() {
    if (!newMessage.trim()) return;
    onSend(newMessage);
    newMessage = '';
  }

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }
</script>

<div class="border-t border-base-300 bg-base-200 p-4">
  <div class="mx-auto max-w-4xl">
    <form onsubmit={(e) => { e.preventDefault(); sendMessage(); }} class="flex gap-2">
      <textarea
        bind:value={newMessage}
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
</div>
