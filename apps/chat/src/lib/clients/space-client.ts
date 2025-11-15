// Client SDK for Kuratchi Spaces (Chat Rooms with Durable Objects)
import type { Message } from '../types';

export interface SpaceClientConfig {
  workerUrl: string;
  apiKey: string;
  spaceId: string;
  onMessage?: (message: Message) => void;
  onTyping?: (userId: string, isTyping: boolean) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export class KuratchiSpaceClient {
  private ws: WebSocket | null = null;
  private spaceToken: string = '';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(private config: SpaceClientConfig) {}

  /**
   * Generate a space token (should be done server-side in production)
   */
  private async generateSpaceToken(): Promise<string> {
    const rnd = crypto.randomUUID().substring(0, 8);
    const exp = Date.now() + 3600000; // 1 hour from now
    const payload = `${this.config.spaceId}.${rnd}.${exp}`;
    
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(this.config.apiKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
    const bytes = new Uint8Array(sig);
    let str = '';
    for (let i = 0; i < bytes.length; i++) {
      str += String.fromCharCode(bytes[i]);
    }
    let b64 = btoa(str);
    b64 = b64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    return `${payload}.${b64}`;
  }

  /**
   * Connect to the space via WebSocket
   */
  async connect() {
    try {
      this.spaceToken = await this.generateSpaceToken();
      
      const url = new URL(this.config.workerUrl);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      url.searchParams.set('spaceId', this.config.spaceId);
      
      this.ws = new WebSocket(url.toString());

      this.ws.onopen = () => {
        console.log('Connected to Kuratchi Space:', this.config.spaceId);
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.config.onConnectionChange?.(true);
        
        // Send authentication
        this.ws?.send(JSON.stringify({
          type: 'auth',
          spaceToken: this.spaceToken,
          apiKey: this.config.apiKey
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'message') {
            this.config.onMessage?.(data.message);
          } else if (data.type === 'typing') {
            this.config.onTyping?.(data.userId, data.isTyping);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('Disconnected from Kuratchi Space');
        this.config.onConnectionChange?.(false);
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Failed to connect to space:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  /**
   * Send a message to the space
   */
  async sendMessage(text: string, senderId: string, senderType: 'user' | 'support' | 'system', attachments?: any[]) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'message',
        senderId,
        senderType,
        text,
        attachments
      }));
    } else {
      // Fallback to HTTP if WebSocket is not connected
      return this.sendMessageHTTP(text, senderId, senderType, attachments);
    }
  }

  /**
   * Send a message via HTTP (fallback)
   */
  private async sendMessageHTTP(text: string, senderId: string, senderType: string, attachments?: any[]) {
    if (!this.spaceToken) {
      this.spaceToken = await this.generateSpaceToken();
    }

    const response = await fetch(`${this.config.workerUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'x-space-id': this.config.spaceId,
        'x-space-token': this.spaceToken
      },
      body: JSON.stringify({
        senderId,
        senderType,
        text,
        attachments
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get message history
   */
  async getMessages(limit = 50, before?: number): Promise<Message[]> {
    if (!this.spaceToken) {
      this.spaceToken = await this.generateSpaceToken();
    }

    const url = new URL(`${this.config.workerUrl}/messages`);
    url.searchParams.set('limit', limit.toString());
    if (before) {
      url.searchParams.set('before', before.toString());
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'x-space-id': this.config.spaceId,
        'x-space-token': this.spaceToken
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get messages: ${response.statusText}`);
    }

    const data = await response.json();
    return data.messages;
  }

  /**
   * Update typing status
   */
  async setTyping(userId: string, isTyping: boolean) {
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
  disconnect() {
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
