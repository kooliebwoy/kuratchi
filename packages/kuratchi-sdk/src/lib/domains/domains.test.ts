/**
 * Basic tests for the domains module
 * These tests verify the module structure and error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeGetClient, resetClient } from './client.js';
import * as zones from './zones.js';

// Mock process.env for testing
const originalEnv = process.env;

describe('Domains Module', () => {
  beforeEach(() => {
    // Reset client before each test
    resetClient();
  });

  afterEach(() => {
    // Reset environment
    process.env = originalEnv;
    resetClient();
  });

  describe('Client Configuration', () => {
    it('should return null when no credentials are provided', () => {
      // Ensure no CF credentials in env
      delete process.env.CF_API_TOKEN;
      delete process.env.CLOUDFLARE_API_TOKEN;
      delete process.env.CF_ACCOUNT_ID;
      delete process.env.CLOUDFLARE_ACCOUNT_ID;
      
      const client = safeGetClient();
      expect(client).toBeNull();
    });

    it('should create client when valid credentials are provided', () => {
      process.env.CF_API_TOKEN = 'test-token';
      process.env.CF_ACCOUNT_ID = 'test-account-id';
      
      // Mock globalThis to avoid platform context issues in test
      const mockPlatform = {
        env: {
          CF_API_TOKEN: 'test-token',
          CF_ACCOUNT_ID: 'test-account-id'
        }
      };
      (globalThis as any).__sveltekit_platform = mockPlatform;
      
      const client = safeGetClient();
      expect(client).not.toBeNull();
      expect(client).toBeDefined();
    });
  });

  describe('Zone Operations', () => {
    beforeEach(() => {
      // Mock environment for zone tests
      process.env.CF_API_TOKEN = 'test-token';
      process.env.CF_ACCOUNT_ID = 'test-account-id';
      
      const mockPlatform = {
        env: {
          CF_API_TOKEN: 'test-token',
          CF_ACCOUNT_ID: 'test-account-id'
        }
      };
      (globalThis as any).__sveltekit_platform = mockPlatform;
    });

    it('should handle listZones gracefully when client unavailable', async () => {
      // Remove credentials to simulate unavailable client
      delete process.env.CF_API_TOKEN;
      delete (globalThis as any).__sveltekit_platform;
      resetClient();
      
      const result = await zones.listZones();
      expect(result).toBeNull();
    });

    it('should handle createZone gracefully when client unavailable', async () => {
      // Remove credentials to simulate unavailable client
      delete process.env.CF_API_TOKEN;
      delete (globalThis as any).__sveltekit_platform;
      resetClient();
      
      const result = await zones.createZone('example.com');
      expect(result).toBeNull();
    });

    it('should handle deleteZone gracefully when client unavailable', async () => {
      // Remove credentials to simulate unavailable client  
      delete process.env.CF_API_TOKEN;
      delete (globalThis as any).__sveltekit_platform;
      resetClient();
      
      const result = await zones.deleteZone('test-zone-id');
      expect(result).toBe(false);
    });

    it('should handle DNS record operations gracefully when client unavailable', async () => {
      // Remove credentials to simulate unavailable client
      delete process.env.CF_API_TOKEN;
      delete (globalThis as any).__sveltekit_platform;
      resetClient();
      
      const listResult = await zones.listDnsRecords('test-zone-id');
      expect(listResult).toBeNull();
      
      const createResult = await zones.createDnsRecord('test-zone-id', {
        type: 'A',
        name: 'test',
        content: '192.0.2.1'
      });
      expect(createResult).toBeNull();
      
      const updateResult = await zones.updateDnsRecord('test-zone-id', 'test-record-id', {
        type: 'A', 
        name: 'test',
        content: '192.0.2.2'
      });
      expect(updateResult).toBeNull();
      
      const deleteResult = await zones.deleteDnsRecord('test-zone-id', 'test-record-id');
      expect(deleteResult).toBe(false);
    });
  });

  describe('Module Exports', () => {
    it('should export all expected functions from zones', () => {
      expect(typeof zones.listZones).toBe('function');
      expect(typeof zones.getZone).toBe('function');
      expect(typeof zones.findZoneByName).toBe('function');
      expect(typeof zones.createZone).toBe('function');
      expect(typeof zones.deleteZone).toBe('function');
      expect(typeof zones.pauseZone).toBe('function');
      expect(typeof zones.unpauseZone).toBe('function');
      expect(typeof zones.purgeZoneCache).toBe('function');
      expect(typeof zones.listDnsRecords).toBe('function');
      expect(typeof zones.createDnsRecord).toBe('function');
      expect(typeof zones.updateDnsRecord).toBe('function');
      expect(typeof zones.deleteDnsRecord).toBe('function');
      expect(typeof zones.getZoneSettings).toBe('function');
      expect(typeof zones.updateZoneSetting).toBe('function');
    });
  });
});

// Integration test placeholder - would need real API credentials
describe('Integration Tests (requires credentials)', () => {
  it.skip('should list zones with real API', async () => {
    // This test would require real CF_API_TOKEN and CF_ACCOUNT_ID
    // Skip by default to avoid failing in CI
    const zones = await zones.listZones();
    expect(Array.isArray(zones)).toBe(true);
  });
});