/**
 * Kuratchi Spaces - Core Types
 */

export interface SpaceConfig {
  workersSubdomain?: string;
  accountId: string;
  apiToken: string;
  scriptName?: string;
}

export interface SpaceClientConfig {
  spaceId: string;
  spaceToken: string;
  gatewayKey: string;
  workerUrl?: string;
}

export interface CreateSpaceOptions {
  spaceId: string;
  gatewayKey: string;
  metadata?: Record<string, string>;
}

export interface SpaceInstanceConfig {
  spaceId: string;
  spaceToken: string;
  gatewayKey: string;
  workerUrl: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderType: 'user' | 'support' | 'system';
  text: string;
  attachments?: Attachment[];
  createdAt: number;
  updatedAt: number;
}

export interface Attachment {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface Participant {
  userId: string;
  role: 'customer' | 'agent';
  joinedAt: number;
}

export interface TypingStatus {
  userId: string;
  lastTypedAt: number;
}

export interface SendMessageOptions {
  senderId: string;
  senderType: 'user' | 'support' | 'system';
  text: string;
  attachments?: Attachment[];
}

export interface GetMessagesOptions {
  limit?: number;
  before?: number;
}

export interface SpaceMetadata {
  [key: string]: string;
}

export interface SpaceEventHandlers {
  onMessage?: (message: Message) => void;
  onTyping?: (userId: string, isTyping: boolean) => void;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Error) => void;
}
