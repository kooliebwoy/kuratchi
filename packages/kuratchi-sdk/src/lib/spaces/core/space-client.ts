/**
 * Kuratchi Spaces - Main Client
 * Unified client for HTTP and WebSocket communication with Spaces
 */

import { SpaceHttpClient } from '../clients/http-client.js';
import { SpaceWebSocketClient } from '../clients/websocket-client.js';
import type {
  Message,
  SendMessageOptions,
  GetMessagesOptions,
  Participant,
  SpaceMetadata,
  SpaceEventHandlers,
  SpaceClientConfig
} from './types.js';

export class KuratchiSpaceClient {
  private httpClient: SpaceHttpClient;
  private wsClient: SpaceWebSocketClient | null = null;
  private config: SpaceClientConfig & SpaceEventHandlers;

  constructor(config: SpaceClientConfig & SpaceEventHandlers) {
    this.config = config;
    this.httpClient = new SpaceHttpClient(config);
    
    // Only create WebSocket client in browser environment
    if (typeof WebSocket !== 'undefined') {
      this.wsClient = new SpaceWebSocketClient(config);
    }
  }

  /**
   * Connect via WebSocket for real-time updates
   */
  async connect(): Promise<void> {
    if (!this.wsClient) {
      throw new Error('WebSocket not available in this environment');
    }
    await this.wsClient.connect();
  }

  /**
   * Disconnect WebSocket connection
   */
  disconnect(): void {
    this.wsClient?.disconnect();
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.wsClient?.isConnected() ?? false;
  }

  /**
   * Send a message (uses WebSocket if connected, falls back to HTTP)
   */
  async sendMessage(options: SendMessageOptions): Promise<Message | void> {
    if (this.wsClient?.isConnected()) {
      await this.wsClient.sendMessage(options);
    } else {
      return this.httpClient.sendMessage(options);
    }
  }

  /**
   * Get message history via HTTP
   */
  async getMessages(options?: GetMessagesOptions): Promise<Message[]> {
    return this.httpClient.getMessages(options);
  }

  /**
   * Get participants in the space
   */
  async getParticipants(): Promise<Participant[]> {
    return this.httpClient.getParticipants();
  }

  /**
   * Update typing status
   */
  async setTyping(userId: string, isTyping: boolean): Promise<void> {
    if (this.wsClient?.isConnected()) {
      await this.wsClient.setTyping(userId, isTyping);
    } else {
      await this.httpClient.setTyping(userId, isTyping);
    }
  }

  /**
   * Get space metadata
   */
  async getMetadata(): Promise<SpaceMetadata> {
    return this.httpClient.getMetadata();
  }
}
