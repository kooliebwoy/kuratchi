# Email Plugin

Standalone email service with tracking powered by Amazon SES V2 with tenant isolation.

## Features

- ✅ **Amazon SES V2 Integration** - Latest SES API with advanced features
- ✅ **Tenant Isolation** - Each organization gets isolated sending reputation and quotas
- ✅ **Multiple Domain Support** - Configure different sender domains per client/site
- ✅ **Email Tracking** - Track all sent emails in your database
- ✅ **Email History** - Query sent emails by user, org, type, status
- ✅ **Metadata Support** - Attach custom metadata to emails
- ✅ **SES V2 Features** - Configuration sets, email tags, identity ARNs
- ✅ **Type Safety** - Full TypeScript support

## Setup

### 1. Install Dependencies

```bash
npm install @aws-sdk/client-sesv2
```

### 2. Add Email Table to Schema

```typescript
// apps/dashboard/src/lib/schemas/admin.ts
import { emailsTableSchema } from 'kuratchi-sdk/email';

export const adminSchema = {
  name: 'admin',
  version: 5, // Increment version
  tables: {
    // ... your existing tables
    ...emailsTableSchema
  }
};
```

### 3. Set Up AWS SES V2

1. **Verify your domain(s)** programmatically through the dashboard
2. **Move out of SES sandbox** to send to any email address
3. **Create IAM credentials** with SES V2 permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail",
        "ses:CreateEmailIdentity",
        "ses:DeleteEmailIdentity",
        "ses:GetEmailIdentity",
        "ses:PutEmailIdentityDkimAttributes",
        "ses:CreateTenant",
        "ses:GetTenant",
        "ses:DeleteTenant"
      ],
      "Resource": "*"
    }
  ]
}
```

4. **Tenant isolation** - Each organization automatically gets its own SES tenant for isolated reputation

### 4. Configure in hooks.server.ts

```typescript
import { kuratchi } from 'kuratchi-sdk';

export const { handle } = kuratchi({
  auth: {
    plugins: [/* your auth plugins */]
  },
  email: {
    region: env.AWS_REGION, // e.g., 'us-east-1'
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    from: 'noreply@yourdomain.com',
    fromName: 'Your App',
    trackEmails: true, // Enable tracking (default: true)
    trackingDb: 'admin', // Store in admin DB (default: 'admin')
    trackingTable: 'emails', // Table name (default: 'emails')
    configurationSetName: 'my-config-set' // Optional SES configuration set
  }
});
```

## Usage

### Send an Email

```typescript
import { sendEmail } from 'kuratchi-sdk/email';

export const POST = async (event) => {
  const result = await sendEmail(event, {
    to: 'user@example.com',
    subject: 'Welcome!',
    html: '<h1>Welcome to our app!</h1>',
    emailType: 'welcome', // For filtering/tracking
    userId: event.locals.session?.userId,
    organizationId: event.locals.session?.organizationId,
    metadata: {
      source: 'signup_flow'
    }
  });

  if (result.success) {
    return json({ success: true, emailId: result.id });
  } else {
    return json({ error: result.error }, { status: 500 });
  }
};
```

### Get Email History

```typescript
import { getEmailHistory } from 'kuratchi-sdk/email';

export const load = async (event) => {
  // Get all emails for a user
  const userEmails = await getEmailHistory(event, {
    userId: event.locals.session?.userId,
    limit: 50
  });

  // Get magic link emails
  const magicLinks = await getEmailHistory(event, {
    emailType: 'magic_link',
    status: 'sent',
    limit: 10
  });

  // Get failed emails
  const failed = await getEmailHistory(event, {
    status: 'failed',
    organizationId: event.locals.session?.organizationId
  });

  return { userEmails, magicLinks, failed };
};
```

### Get Email by ID

```typescript
import { getEmailById } from 'kuratchi-sdk/email';

export const load = async (event) => {
  const email = await getEmailById(event, event.params.emailId);
  return { email };
};
```

## Email Options

```typescript
interface SendEmailOptions {
  // Required
  to: string | string[];
  subject: string;
  
  // Content (at least one required)
  html?: string;
  text?: string;
  
  // Sender (optional, uses defaults from config)
  from?: string; // Override default from email - useful for multi-domain
  fromName?: string;
  replyTo?: string | string[];
  
  // Recipients
  cc?: string | string[];
  bcc?: string | string[];
  
  // SES features
  tags?: Record<string, string>; // For categorization and filtering
  headers?: Record<string, string>;
  configurationSetName?: string; // Override default configuration set
  returnPath?: string; // Email address for bounces
  
  // Tracking metadata
  userId?: string;
  organizationId?: string;
  emailType?: string; // e.g., 'magic_link', 'password_reset'
  metadata?: Record<string, any>;
}
```

## Email Types

Common email types for filtering:

- `magic_link` - Magic link authentication
- `password_reset` - Password reset emails
- `verification` - Email verification
- `notification` - User notifications
- `welcome` - Welcome emails
- `invoice` - Billing/invoices
- `alert` - System alerts

## Database Schema

The emails table stores:

```typescript
{
  id: string;              // UUID
  to: string;              // Recipient email(s)
  from: string;            // Sender email
  subject: string;         // Email subject
  emailType?: string;      // Type for filtering
  status: 'sent' | 'failed' | 'pending';
  sesMessageId?: string;   // SES Message ID
  error?: string;          // Error message if failed
  userId?: string;         // Associated user
  organizationId?: string; // Associated organization
  metadata?: object;       // Custom metadata (JSON)
  sentAt: string;          // ISO timestamp
  createdAt: string;       // ISO timestamp
}
```

## Example: Magic Link with Tracking

```typescript
import { sendEmail } from 'kuratchi-sdk/email';

async function sendMagicLink(event, email: string, token: string) {
  const magicLink = `${event.url.origin}/auth/magic/callback?token=${token}`;
  
  const result = await sendEmail(event, {
    to: email,
    subject: 'Sign in to Your App',
    html: `
      <h1>Sign in to Your App</h1>
      <p>Click the link below to sign in:</p>
      <a href="${magicLink}">Sign In</a>
      <p>This link expires in 15 minutes.</p>
    `,
    emailType: 'magic_link',
    metadata: {
      tokenId: token,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    }
  });
  
  return result;
}
```

## Multi-Domain Email Marketing

Amazon SES allows you to verify and send from multiple domains, making it perfect for multi-tenant applications. Here's how to implement per-site domain configuration:

### 1. Verify Multiple Domains in SES

Each site can have its own verified domain for sending emails.

### 2. Store Domain Configuration Per Site

```typescript
// In your site/organization settings
interface SiteEmailConfig {
  fromEmail: string;      // e.g., 'hello@clientdomain.com'
  fromName: string;       // e.g., 'Client Company'
  replyTo?: string;       // Optional reply-to address
  returnPath?: string;    // For bounce handling
}
```

### 3. Override From Address Per Email

```typescript
import { sendEmail } from 'kuratchi-sdk/email';

export const POST = async (event) => {
  // Get site-specific email config
  const site = await getSiteConfig(event.params.siteId);
  
  const result = await sendEmail(event, {
    from: site.emailConfig.fromEmail,     // Override with site's domain
    fromName: site.emailConfig.fromName,
    replyTo: site.emailConfig.replyTo,
    to: 'customer@example.com',
    subject: 'Newsletter from ' + site.name,
    html: emailTemplate,
    tags: {
      site: site.id,
      campaign: 'weekly-newsletter'
    },
    organizationId: site.organizationId,
    emailType: 'newsletter'
  });
  
  return json(result);
};
```

### 4. Centralized Email for All Sites

You can still use a central email configuration and override only when needed:

```typescript
// Default: uses global config from hooks.server.ts
await sendEmail(event, {
  to: user.email,
  subject: 'System notification',
  html: template
});

// Override: use site-specific domain
await sendEmail(event, {
  from: `noreply@${site.domain}`,
  fromName: site.name,
  to: user.email,
  subject: 'Welcome!',
  html: template
});
```

## SES Best Practices

1. **Monitor Bounce and Complaint Rates** - Use SES configuration sets
2. **Implement Bounce Handling** - Set up SNS notifications for bounces
3. **Use DKIM and SPF** - Improve deliverability with proper DNS records
4. **Warm Up New Domains** - Gradually increase sending volume
5. **Track Email Engagement** - Use SES event publishing to CloudWatch
6. **Handle Unsubscribes** - Implement List-Unsubscribe headers

## Future Enhancements

- [ ] Email templates system
- [ ] Batch email sending with SES SendBulkTemplatedEmail
- [ ] Email scheduling
- [ ] SNS webhook handling (delivery, bounce, complaint status)
- [ ] Email analytics dashboard
- [ ] Domain reputation tracking per site
- [ ] Email queue system
- [ ] Automatic bounce list management
