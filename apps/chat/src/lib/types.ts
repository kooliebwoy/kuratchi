export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'user' | 'support' | 'system';
  text: string;
  attachments?: Attachment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Attachment {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface Conversation {
  id: string;
  userId: string;
  organizationId: string;
  subject: string;
  status: 'open' | 'waiting' | 'resolved' | 'closed';
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  role: 'customer' | 'agent';
  joinedAt: Date;
}

export interface ChatStore {
  messages: Message[];
  currentConversation: Conversation | null;
  isTyping: boolean;
  isConnected: boolean;
}
