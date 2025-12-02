/// <reference types="svelte" />
/// <reference types="vite/client" />

import type { ActivityLogOptions } from 'kuratchi-sdk/auth';

declare global {
  namespace App {
    interface Locals {
      session?: {
        userId: string;
        email: string;
        organizationId: string;
        user: {
          id: string;
          email: string;
          name?: string | null;
          role?: string | null;
          organizationId?: string;
        };
      } | null;
      kuratchi?: {
        superadmin?: {
          __isSuperadmin?: boolean;
          __orgOverride?: string | null;
          isSuperadmin?: () => boolean;
          getActiveOrgId?: () => string | null;
          setOrganization?: (orgId: string | null, persist?: boolean) => void;
          clearOrganization?: () => void;
        };
        activity?: {
          logActivity: (options: ActivityLogOptions) => Promise<{ success: boolean; id?: string; error?: string }>;
          log?: (options: ActivityLogOptions) => Promise<{ success: boolean; id?: string; error?: string }>;
          logAdminActivity?: (options: ActivityLogOptions) => Promise<unknown>;
          logOrgActivity?: (orgDbClient: unknown, options: ActivityLogOptions) => Promise<unknown>;
          getAdminActivity?: (options?: { limit?: number; userId?: string; action?: string }) => Promise<unknown>;
          getOrgActivity?: (orgDbClient: unknown, options?: { limit?: number; userId?: string; action?: string }) => Promise<unknown>;
        };
        storage?: {
          listFiles?: (options: { bucket: string; prefix?: string; delimiter?: string }) => Promise<{ objects?: Array<Record<string, unknown>>; delimitedPrefixes?: string[] } | undefined>;
          uploadFile?: (file: File | Blob, options: { bucket: string; key: string; metadata?: Record<string, unknown> }) => Promise<unknown>;
          deleteFile?: (key: string, bucket: string) => Promise<unknown>;
        };
      };
    }
  }
}

export {};
