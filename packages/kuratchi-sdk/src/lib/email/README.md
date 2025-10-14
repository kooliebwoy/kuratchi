# Email Plugin

Standalone email service with tracking powered by Resend.

## Features

- ✅ **Resend Integration** - 100% powered by Resend SDK
- ✅ **Email Tracking** - Track all sent emails in your database
- ✅ **Email History** - Query sent emails by user, org, type, status
- ✅ **Metadata Support** - Attach custom metadata to emails
- ✅ **Type Safety** - Full TypeScript support

## Setup

### 1. Install Dependencies

```bash
npm install resend
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

### 3. Configure in hooks.server.ts

```typescript
import { kuratchi } from 'kuratchi-sdk';

export const { handle } = kuratchi({
  auth: {
    plugins: [/* your auth plugins */]
  },
  email: {
    apiKey: env.RESEND_API_KEY,
    from: 'noreply@yourdomain.com',
    fromName: 'Your App',
    trackEmails: true, // Enable tracking (default: true)
    trackingDb: 'admin', // Store in admin DB (default: 'admin')
    trackingTable: 'emails' // Table name (default: 'emails')
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
  from?: string;
  fromName?: string;
  replyTo?: string;
  
  // Recipients
  cc?: string | string[];
  bcc?: string | string[];
  
  // Resend features
  tags?: { name: string; value: string }[];
  headers?: Record<string, string>;
  
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
  resendId?: string;       // Resend email ID
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

## Future Enhancements

- [ ] Email templates system
- [ ] Batch email sending
- [ ] Email scheduling
- [ ] Webhook handling (delivery status)
- [ ] Email analytics dashboard
- [ ] Multiple provider support (SendGrid, Mailgun, etc.)
- [ ] Email queue system
