/// <reference types="svelte" />
/// <reference types="vite/client" />

declare namespace App {
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
    };
  }
}
