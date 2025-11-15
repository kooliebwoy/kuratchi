// Chat Store for managing real-time chat state
import { writable, derived } from 'svelte/store';
import type { Message, Conversation, ChatStore } from '../types';

function createChatStore() {
  const { subscribe, set, update } = writable<ChatStore>({
    messages: [],
    currentConversation: null,
    isTyping: false,
    isConnected: false
  });

  return {
    subscribe,
    
    // Add a new message
    addMessage: (message: Message) => {
      update(state => ({
        ...state,
        messages: [...state.messages, message]
      }));
    },
    
    // Set all messages (e.g., when loading conversation history)
    setMessages: (messages: Message[]) => {
      update(state => ({
        ...state,
        messages
      }));
    },
    
    // Set current conversation
    setConversation: (conversation: Conversation | null) => {
      update(state => ({
        ...state,
        currentConversation: conversation
      }));
    },
    
    // Set typing indicator
    setTyping: (isTyping: boolean) => {
      update(state => ({
        ...state,
        isTyping
      }));
    },
    
    // Set connection status
    setConnected: (isConnected: boolean) => {
      update(state => ({
        ...state,
        isConnected
      }));
    },
    
    // Clear all data
    clear: () => {
      set({
        messages: [],
        currentConversation: null,
        isTyping: false,
        isConnected: false
      });
    }
  };
}

export const chatStore = createChatStore();

// Derived stores
export const messages = derived(chatStore, $store => $store.messages);
export const currentConversation = derived(chatStore, $store => $store.currentConversation);
export const isTyping = derived(chatStore, $store => $store.isTyping);
export const isConnected = derived(chatStore, $store => $store.isConnected);
