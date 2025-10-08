# Activity Logging System

A dual-logging activity tracking system that records actions at both admin and organization levels with fine-grained control.

## Architecture

### Two-Level Logging

1. **Admin Activity** (`admin.activity` table)
   - **Always** logs ALL actions
   - Contains admin-level metadata: `organizationId`, `hidden` flag
   - Visible to superadmins in the dashboard
   
2. **Organization Activity** (`organization.activity` table in each tenant DB)
   - **Conditionally** logs actions (when `hidden: false` and `organizationId` provided)
   - Only shows non-hidden actions
   - Distinguishes admin actions with `isAdminAction` flag for UI styling

## Schema

### Admin Activity Schema
```typescript
activity: {
  id: 'text primary key',
  userId: 'text',
  action: 'text not null',
  data: 'json',
  status: 'boolean',
  isAdminAction: 'boolean default false',  // UI distinction
  isHidden: 'boolean default false',       // If true, only in admin
  organizationId: 'text',                   // Target org
  ip: 'text',
  userAgent: 'text',
  ...timestamps
}
```

### Organization Activity Schema
```typescript
activity: {
  id: 'text primary key',
  userId: 'text',
  action: 'text not null',
  data: 'json',
  status: 'boolean',
  isAdminAction: 'boolean default false',  // UI distinction only
  ip: 'text',
  userAgent: 'text',
  ...timestamps
}
```

## Usage

### Simple Activity Logging

```typescript
import { logActivity } from '../activity/activity.remote';

// Regular admin action (visible in org)
await logActivity('user.created', {
  data: { userId: '123', email: 'user@example.com' },
  isAdminAction: true,
  organizationId: 'org-abc'
});
```

### Hidden Activity (Admin-only)

```typescript
// Sensitive action (NOT visible in org)
await logActivity('organization.deleted', {
  data: { organizationId: 'org-abc' },
  isAdminAction: true,
  isHidden: true,  // ← Only in admin logs
  organizationId: 'org-abc'
});
```

### Regular Org Action

```typescript
// User action within org (not an admin action)
await logActivity('document.uploaded', {
  data: { documentId: 'doc-123', fileName: 'report.pdf' },
  isAdminAction: false,
  organizationId: 'org-abc'
});
```

## API Reference

### `logActivity(action, options)`

Dual-logs activity to admin and conditionally to org.

**Parameters:**
- `action` (string): Action identifier (e.g., `'user.created'`)
- `options` (object):
  - `data?` (object): Additional context data
  - `status?` (boolean): Success/failure (default: true)
  - `isAdminAction?` (boolean): UI distinction for admin actions (default: false)
  - `isHidden?` (boolean): If true, only logs to admin (default: false)
  - `organizationId?` (string): Target org for dual logging

**Behavior:**
1. **Always** logs to `admin.activity` table
2. **If NOT isHidden** and `organizationId` provided → also logs to `organization.activity`
3. Auto-captures: `userId`, `ip`, `userAgent`, `timestamp`

## UI Behavior

### Admin Activity View (`/activity`)
- Shows ALL activities from `admin.activity`
- Admin actions have **purple/primary badge**
- Shows organization context with org ID
- Displays "Hidden" badge for hidden activities

### Org Activity View (Future)
- Shows activities from `organization.activity` (org-scoped)
- Admin actions have **distinct styling** (purple badge + shield icon)
- Hidden activities are NOT shown
- Regular user actions use standard styling

## Examples

### Organization Management

```typescript
// Create org - visible to org users
await logActivity('organization.created', {
  data: { organizationName: 'Acme Corp', slug: 'acme' },
  isAdminAction: true,
  organizationId: orgId
});

// Update org - visible to org users
await logActivity('organization.updated', {
  data: { changes: { status: 'active' } },
  isAdminAction: true,
  organizationId: orgId
});

// Delete org - HIDDEN from org (they can't see their own deletion)
await logActivity('organization.deleted', {
  data: { organizationId: orgId },
  isAdminAction: true,
  isHidden: true,  // ← Not visible in org
  organizationId: orgId
});
```

### Database Operations

```typescript
// Admin creates database for org
await logActivity('database.created', {
  data: { databaseName: 'prod-db', organizationId: 'org-abc' },
  isAdminAction: true,
  organizationId: 'org-abc'
});

// Org user creates database
await logActivity('database.created', {
  data: { databaseName: 'staging-db' },
  isAdminAction: false,  // ← Regular user action
  organizationId: 'org-abc'
});
```

### Sensitive Operations (Hidden)

```typescript
// Billing investigation (don't alarm customer)
await logActivity('billing.audit_initiated', {
  data: { reason: 'fraud_check' },
  isAdminAction: true,
  isHidden: true,  // ← Admin-only
  organizationId: 'org-abc'
});

// Internal support escalation
await logActivity('support.ticket_escalated', {
  data: { ticketId: 'T123', priority: 'urgent' },
  isAdminAction: true,
  isHidden: true,
  organizationId: 'org-abc'
});
```

## Migration

After schema changes, generate and apply migrations:

```bash
cd apps/dashboard

# Admin DB
npx kuratchi-sdk generate-migrations --schema src/lib/schemas/admin.ts
# Apply via dev server or deployment

# Org DB template
npx kuratchi-sdk generate-migrations --schema src/lib/schemas/organization.ts
# New orgs get this schema automatically
```

## Best Practices

1. **Use `isAdminAction: true`** for all admin-initiated actions
2. **Use `isHidden: true`** for sensitive operations (billing, audits, deletions)
3. **Always provide `organizationId`** when action relates to an org
4. **Use descriptive action names** with dot notation: `resource.action`
   - ✅ `user.created`, `database.deleted`, `billing.updated`
   - ❌ `create`, `delete`, `update`
5. **Include relevant context** in `data` field for debugging

## Future Enhancements

- [ ] Org-scoped activity viewer at `/org/[id]/activity`
- [ ] Real-time activity streaming with WebSockets
- [ ] Activity search and filtering
- [ ] Activity retention policies
- [ ] Export activity logs
- [ ] Webhook notifications for critical actions
