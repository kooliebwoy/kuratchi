/**
 * Kuratchi Spaces - HTTP Client
 * Handles HTTP requests to the Spaces Durable Object worker
 */

import type {
  Message,
  SendMessageOptions,
  GetMessagesOptions,
  Participant,
  SpaceMetadata,
  SpaceClientConfig
} from '../core/types';

export class SpaceHttpClient {
  private workerUrl: string;
  private spaceId: string;
  private spaceToken: string;
  private gatewayKey: string;

  constructor(config: SpaceClientConfig) {
    this.workerUrl = config.workerUrl || '';
    this.spaceId = config.spaceId;
    this.spaceToken = config.spaceToken;
    this.gatewayKey = config.gatewayKey;
  }

  /**
   * Get common headers for all requests
   */
  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.gatewayKey}`,
      'x-space-id': this.spaceId,
      'x-space-token': this.spaceToken
    };
  }

  /**
   * Send a message to the space
   */
  async sendMessage(options: SendMessageOptions): Promise<Message> {
    const response = await fetch(`${this.workerUrl}/messages`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(options)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send message: ${error}`);
    }

    const data = await response.json();
    return data.message;
  }

  /**
   * Get message history
   */
  async getMessages(options: GetMessagesOptions = {}): Promise<Message[]> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.before) params.set('before', options.before.toString());

    const response = await fetch(`${this.workerUrl}/messages?${params}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get messages: ${error}`);
    }

    const data = await response.json();
    return data.messages;
  }

  /**
   * Get participants in the space
   */
  async getParticipants(): Promise<Participant[]> {
    const response = await fetch(`${this.workerUrl}/participants`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get participants: ${error}`);
    }

    const data = await response.json();
    return data.participants;
  }

  /**
   * Update typing status
   */
  async setTyping(userId: string, isTyping: boolean): Promise<void> {
    const response = await fetch(`${this.workerUrl}/typing`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ userId, isTyping })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update typing status: ${error}`);
    }
  }

  /**
   * Get space metadata
   */
  async getMetadata(): Promise<SpaceMetadata> {
    const response = await fetch(`${this.workerUrl}/metadata`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get metadata: ${error}`);
    }

    const data = await response.json();
    return data.metadata;
  }
}
