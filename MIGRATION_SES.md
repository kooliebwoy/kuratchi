# AWS SES Migration Guide

## Overview

We've migrated from Resend to Amazon SES for email sending. This enables:

- ✅ **Multi-tenant domain verification** - Each client can have their own verified domain(s)
- ✅ **Programmatic domain management** - Add, verify, and manage domains through the dashboard
- ✅ **Email marketing per site** - Send branded emails from client domains
- ✅ **Better control & scaling** - Direct AWS SES integration
- ✅ **Cost efficiency** - Pay for what you use with AWS pricing

## Required AWS Credentials

You need **3 pieces of information**:

1. **AWS_SES_REGION** - AWS region (e.g., `us-east-1`, `us-west-2`, `eu-west-1`)
2. **AWS_ACCESS_KEY_ID** - IAM access key with SES permissions
3. **AWS_SECRET_ACCESS_KEY** - IAM secret key

## AWS Setup Steps

### 1. Create IAM User with SES Permissions

1. Go to **AWS Console** → **IAM** → **Users** → **Create User**
2. Choose "Programmatic access"
3. Create and attach this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail",
        "ses:VerifyDomainIdentity",
        "ses:VerifyDomainDkim",
        "ses:GetIdentityVerificationAttributes",
        "ses:GetIdentityDkimAttributes",
        "ses:DeleteIdentity"
      ],
      "Resource": "*"
    }
  ]
}
```

4. Save the **Access Key ID** and **Secret Access Key**

### 2. Request Production Access

By default, AWS SES is in **sandbox mode** (can only send to verified emails).

1. Go to **AWS Console** → **SES** → **Account Dashboard**
2. Click **Request production access**
3. Fill out the form (describe your use case as multi-tenant email platform)
4. Wait for approval (usually 24-48 hours)

### 3. Configure Environment Variables

Add these to your `.env` file or Cloudflare Workers secrets:

```bash
# AWS SES Configuration
AWS_SES_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Email Configuration
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

### 4. Update Database Schema

The schema has been updated to replace Resend fields with SES fields:

**Before:**
- `resendDomainId: text`

**After:**
- `sesVerificationToken: text` - SES domain verification token
- `sesDkimTokens: json` - DKIM tokens for email authentication
- `siteId: text` - Optional: link domain to a specific site

Run a migration to update your database schema:

```sql
-- Add new columns
ALTER TABLE domains ADD COLUMN sesVerificationToken TEXT;
ALTER TABLE domains ADD COLUMN sesDkimTokens TEXT DEFAULT '[]';
ALTER TABLE domains ADD COLUMN siteId TEXT;

-- Optional: Remove old column if no longer needed
-- ALTER TABLE domains DROP COLUMN resendDomainId;
```

## How It Works

### 1. Client Adds Domain via Dashboard

When a client adds a domain (e.g., `clientdomain.com`):

1. Dashboard calls AWS SES `VerifyDomainIdentity` API
2. SES returns a verification token
3. Dashboard calls `VerifyDomainDkim` API for DKIM tokens
4. System stores domain + DNS records in database

### 2. DNS Records Returned

Client receives 4 DNS records to configure:

**TXT Record** (Domain Verification):
```
Name: _amazonses.clientdomain.com
Value: [verification-token]
```

**CNAME Records** (DKIM - 3 records):
```
Name: token1._domainkey.clientdomain.com
Value: token1.dkim.amazonses.com

Name: token2._domainkey.clientdomain.com
Value: token2.dkim.amazonses.com

Name: token3._domainkey.clientdomain.com
Value: token3.dkim.amazonses.com
```

### 3. Client Verifies Domain

1. Client adds DNS records to their domain provider (Cloudflare, Namecheap, etc.)
2. Client clicks "Verify" in dashboard
3. System checks SES verification status
4. If verified, domain is marked as ready for sending

### 4. Sending Emails

Once verified, clients can send emails from their domain:

```typescript
import { sendEmail } from 'kuratchi-sdk/email';

// Send from client's verified domain
await sendEmail(event, {
  from: 'hello@clientdomain.com',
  fromName: 'Client Company',
  to: 'customer@example.com',
  subject: 'Welcome!',
  html: emailTemplate,
  organizationId: site.organizationId
});
```

## Migration Checklist

- [ ] Create IAM user with SES permissions
- [ ] Request SES production access
- [ ] Add AWS credentials to environment variables
- [ ] Update database schema (add new columns)
- [ ] Test domain verification flow
- [ ] Migrate existing domains (if any)
- [ ] Update email sending code to use client domains
- [ ] Monitor SES sending quotas and reputation

## Per-Client Domain Management

Each organization can now:

1. **Add multiple domains** - Different domains for different brands/sites
2. **Verify programmatically** - No manual AWS console access needed
3. **Send branded emails** - Use client's domain in from address
4. **Track per domain** - Email analytics per domain/organization

## Benefits Over Resend

| Feature | Resend | AWS SES |
|---------|--------|---------|
| Domain verification | Manual or API | Fully automated via API |
| Multi-tenant | Limited | Native support |
| Cost | $0.10/1k emails | $0.10/1k emails (first 62k free on EC2) |
| Reputation | Shared | Per-domain control |
| Scaling | Automatic | Automatic with quotas |
| Analytics | Built-in | Via Configuration Sets |

## Monitoring & Limits

### Default SES Limits
- **Sandbox**: 200 emails/day, 1 email/sec
- **Production**: 50k emails/day initially (auto-scales)

### Monitor These Metrics
- Bounce rate (should be < 5%)
- Complaint rate (should be < 0.1%)
- Daily sending quota
- Verification status per domain

### Handling Bounces & Complaints

Set up SNS notifications for:
- Bounces
- Complaints
- Delivery notifications

Add to your SES configuration set for automatic handling.

## Troubleshooting

### Domain Not Verifying
- Check DNS propagation (use `dig` or online tools)
- Wait up to 72 hours for DNS to propagate
- Verify TXT record is exact match (no extra quotes)

### Emails Not Sending
- Check if domain is verified
- Verify you're out of SES sandbox
- Check daily sending quota
- Verify IAM permissions are correct

### Rate Limits
- Implement queue for bulk sends
- Use SES batch sending (50 emails per call)
- Monitor and increase quotas as needed

## Next Steps

1. Set up SES Configuration Sets for tracking
2. Implement SNS webhooks for bounce handling
3. Add email templates in SES
4. Set up dedicated IP (optional, for high volume)
5. Configure DMARC for better deliverability
