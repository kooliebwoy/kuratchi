# AWS SES Tenant Separation Implementation

## Overview

We've implemented **AWS SES V2 tenant isolation** to provide true multi-tenancy for email sending. Each organization gets its own isolated SES tenant with:

- ✅ **Isolated sending reputation** - One client's bounces don't affect others
- ✅ **Separate quotas** - Each tenant has independent sending limits
- ✅ **Organization-level metrics** - Track email performance per organization
- ✅ **Seamless onboarding** - Tenants created automatically when adding first domain

## How It Works

### 1. Automatic Tenant Creation

When an organization adds their first email domain:

```typescript
// User adds domain "clientdomain.com" in dashboard
// System automatically:
1. Checks if organization has a SES tenant
2. Creates tenant if it doesn't exist (tenant name: org-{id}-{timestamp})
3. Creates email identity under that tenant
4. Returns DNS records for domain verification
```

### 2. Tenant Structure

```
AWS SES Account
├── Tenant: org-abc12345-1731801234
│   ├── Domain: clienta.com (verified)
│   ├── Domain: shop.clienta.com (verified)
│   └── Reputation: Isolated
│
├── Tenant: org-xyz67890-1731802345
│   ├── Domain: clientb.com (verified)
│   └── Reputation: Isolated
│
└── Tenant: org-def45678-1731803456
    ├── Domain: clientc.com (pending)
    └── Reputation: Isolated
```

### 3. Database Schema

**organizations table:**
```sql
- sesTenantId: text unique           -- SES tenant identifier
- sesTenantEngagementMetrics: json   -- Cached metrics from SES
```

**domains table:**
```sql
- sesTenantId: text                  -- Links domain to tenant
- sesVerificationToken: text         -- Verification token
- sesDkimTokens: json                -- DKIM signing tokens
- emailDnsRecords: json              -- DNS records for client
```

## User Flow: Create Site → Email Marketing

### Step 1: Organization Created
```typescript
// When organization is created
{
  id: "org-abc123",
  organizationName: "Client Company",
  sesTenantId: null  // No tenant yet
}
```

### Step 2: Add First Domain
```typescript
// Client adds domain in dashboard
POST /api/domains/add { name: "clientdomain.com" }

// Backend automatically:
1. Creates SES tenant "org-abc123-1731801234"
2. Updates organization.sesTenantId
3. Creates email identity in that tenant
4. Returns DNS records:
   - 3 DKIM CNAME records
```

### Step 3: Client Configures DNS
```
Client adds DNS records in their domain provider:
- token1._domainkey.clientdomain.com → token1.dkim.amazonses.com
- token2._domainkey.clientdomain.com → token2.dkim.amazonses.com
- token3._domainkey.clientdomain.com → token3.dkim.amazonses.com
```

### Step 4: Verify Domain
```typescript
// Client clicks "Verify" button
POST /api/domains/verify { domainId: "..." }

// Backend checks:
1. DKIM status in SES
2. Verified for sending status
3. Updates domain.emailVerified = true
```

### Step 5: Send Emails!
```typescript
// Client can now send from their domain
await sendEmail(event, {
  from: 'hello@clientdomain.com',
  to: 'customer@example.com',
  subject: 'Welcome!',
  html: emailTemplate,
  organizationId: 'org-abc123'  // Auto-routed to correct tenant
});
```

## Benefits of Tenant Isolation

### 1. Reputation Isolation
- Client A's spam complaints don't affect Client B
- Each organization builds their own sending reputation
- Better deliverability for well-behaved tenants

### 2. Independent Quotas
- Each tenant gets separate sending limits
- High-volume clients don't consume shared quota
- Easier to scale per-organization

### 3. Monitoring & Analytics
- Track bounce/complaint rates per organization
- Identify problematic tenants
- Better support and debugging

### 4. Compliance & Security
- Clear data separation
- Organization-level access control
- Audit trail per tenant

## API Integration

### Creating Tenant (Automatic)

```typescript
import { CreateTenantCommand } from '@aws-sdk/client-sesv2';

const command = new CreateTenantCommand({
  TenantName: `org-${organizationId.slice(0, 8)}-${Date.now()}`,
  EngagementEventDestinations: [],
  EmailSendingEnabled: true
});

await sesClient.send(command);
```

### Adding Domain to Tenant

```typescript
import { CreateEmailIdentityCommand } from '@aws-sdk/client-sesv2';

const command = new CreateEmailIdentityCommand({
  EmailIdentity: 'clientdomain.com',
  DkimSigningAttributes: {
    DomainSigningSelector: 'ses'
  },
  Tags: [
    { Key: 'OrganizationId', Value: organizationId },
    { Key: 'TenantId', Value: tenantId }
  ]
});

await sesClient.send(command);
```

### Verifying Domain

```typescript
import { GetEmailIdentityCommand } from '@aws-sdk/client-sesv2';

const command = new GetEmailIdentityCommand({
  EmailIdentity: 'clientdomain.com'
});

const response = await sesClient.send(command);

// Check status
const verified = 
  response.DkimAttributes?.Status === 'SUCCESS' &&
  response.VerifiedForSendingStatus === true;
```

## Migration from SES V1

We've migrated from SES V1 to V2 for tenant support:

| Feature | SES V1 | SES V2 |
|---------|--------|--------|
| API | `@aws-sdk/client-ses` | `@aws-sdk/client-sesv2` |
| Tenant Support | ❌ No | ✅ Yes |
| Email Identity | `VerifyDomainIdentity` | `CreateEmailIdentity` |
| DKIM | `VerifyDomainDkim` | Built into identity creation |
| Verification | Separate TXT record | DKIM-based only |
| Tags | Limited | Full tagging support |

## Database Migration

Add new columns to existing tables:

```sql
-- Add to organizations table
ALTER TABLE organizations ADD COLUMN sesTenantId TEXT UNIQUE;
ALTER TABLE organizations ADD COLUMN sesTenantEngagementMetrics TEXT DEFAULT '{}';

-- Add to domains table  
ALTER TABLE domains ADD COLUMN sesTenantId TEXT;

-- Optional: Clean up old V1 fields
-- ALTER TABLE domains DROP COLUMN resendDomainId;
```

## Monitoring & Alerts

### Track Per-Tenant Metrics

```typescript
// Get tenant engagement metrics
import { GetTenantCommand } from '@aws-sdk/client-sesv2';

const tenant = await ses.send(new GetTenantCommand({ 
  TenantName: organization.sesTenantId 
}));

// Store metrics in database
await db.update.organizations({
  sesTenantEngagementMetrics: JSON.stringify(tenant.EngagementAttributes)
}, org.id);
```

### Alert on Issues

```typescript
// Monitor tenant health
if (metrics.bounceRate > 0.05) {
  // Alert: Bounce rate too high
  await notifyAdmin({
    type: 'high_bounce_rate',
    organizationId: org.id,
    tenantId: org.sesTenantId,
    bounceRate: metrics.bounceRate
  });
}

if (metrics.complaintRate > 0.001) {
  // Alert: Spam complaints
  await pauseTenantSending(org.sesTenantId);
}
```

## Tenant Lifecycle

### Creation
- Automatic on first domain add
- Tenant naming: `org-{shortId}-{timestamp}`
- Email sending enabled by default

### Active Use
- Domains verified under tenant
- Emails sent through tenant
- Metrics collected and cached

### Suspension
- If bounce/complaint rates too high
- Can disable sending via `EmailSendingEnabled: false`
- Client notified to clean their lists

### Deletion
- When organization is deleted
- All domains removed first
- Tenant deleted from SES
- Database records soft-deleted

## Best Practices

### 1. Verify Domains Promptly
- Unverified domains can't send
- DNS propagation can take 24-72 hours
- Provide clear instructions to clients

### 2. Monitor Reputation
- Check bounce/complaint rates weekly
- Alert clients when rates are concerning
- Pause sending if rates too high

### 3. Warm Up New Domains
- Start with small sending volumes
- Gradually increase over 2-4 weeks
- Better deliverability long-term

### 4. Handle Bounces
- Set up SNS notifications
- Automatically remove hard bounces
- Track and display in dashboard

### 5. Configuration Sets
- Create per-tenant or per-campaign
- Track opens, clicks, bounces
- Feed data back to dashboard

## Troubleshooting

### Tenant Not Found
```typescript
// If org.sesTenantId exists but SES returns not found:
// Recreate tenant
await ensureTenant(db, organizationId, organizationName);
```

### Domain Won't Verify
```
1. Check DNS propagation (use dig or online tools)
2. Ensure exact match on DKIM records
3. Wait up to 72 hours
4. Check for typos in DNS values
```

### Sending Paused
```
1. Check tenant metrics for bounce/complaint rates
2. Review recent email sending patterns
3. Contact AWS Support if needed
4. Clean email lists and retry
```

### Quota Limits
```
1. Each tenant starts with default SES quotas
2. Request increases per-tenant if needed
3. Monitor daily sending quota
4. Implement queue for bulk sends
```

## Future Enhancements

- [ ] Dashboard UI for tenant metrics
- [ ] Automated bounce handling per tenant
- [ ] Per-tenant configuration sets
- [ ] Tenant-level sending quotas display
- [ ] Email reputation score per organization
- [ ] Automated domain warm-up sequences
- [ ] Tenant-based email analytics
- [ ] Multi-region tenant support
