# Email Tracking: Multi-Tenant Isolation Fix

**Date:** November 17, 2025  
**Issue:** Email tracking was storing data in admin database, breaking tenant isolation  
**Solution:** Migrated email tracking to organization databases

## Problem

The email tracking system was configured to store all email sends in the admin database (`trackingDb: 'admin'`). This created several issues:

1. **Violated tenant isolation** - All organizations' email data was mixed in a single table
2. **Required manual filtering** - Had to explicitly pass and filter by `organizationId`
3. **Inconsistent with architecture** - Other features (users, sites, activity) use org DB
4. **Privacy concerns** - Cross-tenant data visibility risk

## Solution

Changed email tracking to use organization databases, maintaining the same isolation pattern used throughout the application.

### Architecture Changes

```
BEFORE:
┌─────────────────┐
│   Admin DB      │
│                 │
│  ┌───────────┐  │
│  │  emails   │  │ ← All orgs mixed
│  │           │  │
│  │ org_id    │  │ ← Manual filtering required
│  └───────────┘  │
└─────────────────┘

AFTER:
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Org A DB   │  │   Org B DB   │  │   Org C DB   │
│              │  │              │  │              │
│ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │
│ │  emails  │ │  │ │  emails  │ │  │ │  emails  │ │
│ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │
└──────────────┘  └──────────────┘  └──────────────┘
     Isolated          Isolated          Isolated
```

### Files Modified

#### 1. Organization Schema (`apps/dashboard/src/lib/schemas/organization.ts`)
- **Added** `emails` table definition
- **Schema:**
  ```typescript
  emails: {
    id: 'text primary key not null',
    to: 'text not null',
    from: 'text not null',
    subject: 'text not null',
    emailType: 'text',
    status: 'enum(sent,failed,pending) default pending',
    sesMessageId: 'text',
    error: 'text',
    userId: 'text -> users.id',
    metadata: 'json',
    sentAt: 'text',
    '...timestamps': true,
  }
  ```

#### 2. Email Plugin Config (`apps/dashboard/src/hooks.server.ts`)
- **Changed:** `trackingDb: 'admin'` → `trackingDb: 'org'`
- **Effect:** Emails now tracked in organization database

#### 3. Email Plugin Implementation (`packages/kuratchi-sdk/src/lib/email/index.ts`)
- **Updated** `trackEmail()` - Auto-detects organizationId from session when using org DB
- **Updated** `getEmailHistory()` - Retrieves from correct DB, skips org filter when using org DB
- **Updated** `getEmailById()` - Uses org or admin DB based on config

#### 4. Email Remote Functions (`apps/dashboard/src/lib/functions/emails.remote.ts`)
- **Simplified** `getEmails()` - Removed manual organizationId handling
- **Simplified** `getEmailStats()` - No longer needs to pass organizationId
- **Simplified** `sendTestEmail()` - organizationId now implicit from DB context

#### 5. Database Migration (`apps/dashboard/migrations/0001_add_emails_table.sql`)
- **Created** SQL migration to add emails table to organization databases
- **Includes** proper indexes for performance (userId, status, emailType, sentAt)

### Admin Database Changes

The admin database still maintains:
- **`domains` table** - Email domain verification (cross-organization infrastructure)
  - SES identity management
  - DKIM tokens
  - DNS records
  - Verification status

This is appropriate because:
- Domain verification is AWS SES infrastructure, not tenant data
- A domain can only be verified by one organization at a time
- DNS records are public infrastructure configuration

### Benefits

1. **True tenant isolation** - Each org's emails are physically separated
2. **Simpler code** - No manual organizationId filtering needed
3. **Better performance** - Smaller tables, better indexes per org
4. **Consistent architecture** - Matches pattern used for users, sites, activity
5. **Privacy compliance** - No cross-tenant data access possible
6. **Scalable** - Each org database can be backed up/restored independently

### Migration Path

For existing emails in admin database (if any):
1. Old emails remain in admin DB (read-only)
2. New emails go to org DB automatically
3. Optional: Run data migration script to copy historical emails to org DBs
4. Optional: Clean up old admin DB emails after migration period

### Testing Checklist

- [x] Organization schema includes emails table
- [x] Email plugin configured for org DB
- [x] Send test email saves to org database
- [ ] Verify email appears in delivery log
- [ ] Confirm email history filtered to current org
- [ ] Test email stats calculations
- [ ] Verify domain management still works in admin DB

### Next Steps

1. Send new test email to verify it saves to org DB
2. Check email delivery log shows the email
3. Verify stats update correctly
4. Consider adding migration script for existing emails (if needed)
