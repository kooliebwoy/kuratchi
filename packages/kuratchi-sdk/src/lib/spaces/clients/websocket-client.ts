/**
 * Kuratchi Spaces - WebSocket Client
 * Handles real-time WebSocket connections to Spaces
 */

import type {
  Message,
  SendMessageOptions,
  SpaceEventHandlers,
  SpaceClientConfig
} from '../core/types';

export class SpaceWebSocketClient {
  private ws: WebSocket | null = null;
  private workerUrl: string;
  private spaceId: string;
  private spaceToken: string;
  private gatewayKey: string;
  private handlers: SpaceEventHandlers;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: SpaceClientConfig & SpaceEventHandlers) {
    this.workerUrl = config.workerUrl || '';
    this.spaceId = config.spaceId;
    this.spaceToken = config.spaceToken;
    this.gatewayKey = config.gatewayKey;
    this.handlers = {
      onMessage: config.onMessage,
      onTyping: config.onTyping,
      onConnectionChange: config.onConnectionChange,
      onError: config.onError
    };
  }

  /**
   * Connect to the space via WebSocket
   */
  async connect(): Promise<void> {
    try {
      const url = new URL(this.workerUrl);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      url.searchParams.set('spaceId', this.spaceId);

      this.ws = new WebSocket(url.toString());

      this.ws.onopen = () => {
        console.log('Connected to Kuratchi Space:', this.spaceId);
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.handlers.onConnectionChange?.(true);

        // Send authentication
        this.ws?.send(JSON.stringify({
          type: 'auth',
          spaceToken: this.spaceToken,
          gatewayKey: this.gatewayKey
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'message') {
            this.handlers.onMessage?.(data.message);
          } else if (data.type === 'typing') {
            this.handlers.onTyping?.(data.userId, data.isTyping);
          } else if (data.type === 'error') {
            this.handlers.onError?.(new Error(data.error));
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
          this.handlers.onError?.(error as Error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.handlers.onError?.(new Error('WebSocket error'));
      };

      this.ws.onclose = () => {
        console.log('Disconnected from Kuratchi Space');
        this.handlers.onConnectionChange?.(false);
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Failed to connect to space:', error);
      this.handlers.onError?.(error as Error);
      this.attemptReconnect();
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.handlers.onError?.(new Error('Failed to reconnect after maximum attempts'));
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  /**
   * Send a message via WebSocket
   */
  async sendMessage(options: SendMessageOptions): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'message',
        ...options
      }));
    } else {
      throw new Error('WebSocket is not connected');
    }
  }

  /**
   * Update typing status via WebSocket
   */
  async setTyping(userId: string, isTyping: boolean): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'typing',
        userId,
        isTyping
      }));
    }
  }

  /**
   * Disconnect from the space
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
