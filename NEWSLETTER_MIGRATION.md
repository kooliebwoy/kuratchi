# Newsletter Module - Amazon SES Migration

The newsletter module has been completely rebuilt to use Amazon SES instead of Resend, with all marketing automation features (segments, contacts, templates, broadcasts, drip campaigns) now stored in your own database.

## What Changed

### Removed
- ❌ Resend SDK dependency
- ❌ All Resend API calls
- ❌ Dependence on external marketing platform

### Added
- ✅ Complete newsletter module in `kuratchi-sdk/newsletter`
- ✅ Database-backed segment and contact management
- ✅ Email template system with database storage
- ✅ Broadcast functionality using Amazon SES
- ✅ Drip campaign system with conditional branching
- ✅ Email tracking and analytics in your database
- ✅ Full control over your subscriber data

## Installation & Setup

### 1. Create Database Tables

You need to create the following tables in your database (either admin or organization database):

```sql
-- Segments
CREATE TABLE newsletter_segments (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  subscriberCount INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

-- Contacts
CREATE TABLE newsletter_contacts (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL,
  email TEXT NOT NULL,
  firstName TEXT,
  lastName TEXT,
  unsubscribed INTEGER DEFAULT 0,
  unsubscribedAt TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

-- Segment-Contact relationship
CREATE TABLE newsletter_segment_contacts (
  segmentId TEXT NOT NULL,
  contactId TEXT NOT NULL,
  added_at TEXT NOT NULL,
  PRIMARY KEY (segmentId, contactId)
);

-- Templates
CREATE TABLE newsletter_templates (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  text TEXT,
  previewText TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

-- Broadcasts
CREATE TABLE newsletter_broadcasts (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL,
  segmentId TEXT NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT,
  text TEXT,
  previewText TEXT,
  status TEXT NOT NULL,
  scheduledAt TEXT,
  sentAt TEXT,
  recipientCount INTEGER DEFAULT 0,
  successCount INTEGER DEFAULT 0,
  failureCount INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

-- Campaigns
CREATE TABLE newsletter_campaigns (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL,
  segmentId TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  startAt TEXT,
  lastLaunchAt TEXT,
  contactsTargeted INTEGER DEFAULT 0,
  totalScheduled INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

-- Campaign Steps
CREATE TABLE newsletter_campaign_steps (
  id TEXT PRIMARY KEY,
  campaignId TEXT NOT NULL,
  organizationId TEXT NOT NULL,
  stepOrder INTEGER NOT NULL,
  label TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT,
  text TEXT,
  previewText TEXT,
  scheduleMode TEXT NOT NULL,
  sendAt TEXT,
  delayMinutes INTEGER DEFAULT 0,
  status TEXT NOT NULL,
  monitorEvent TEXT,
  successStepId TEXT,
  fallbackStepId TEXT,
  evaluateAfterMinutes INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

-- Sent Email Tracking
CREATE TABLE newsletter_sent_emails (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL,
  contactId TEXT NOT NULL,
  email TEXT NOT NULL,
  type TEXT NOT NULL,
  broadcastId TEXT,
  campaignId TEXT,
  campaignStepId TEXT,
  subject TEXT NOT NULL,
  sesMessageId TEXT,
  status TEXT NOT NULL,
  scheduledAt TEXT,
  sentAt TEXT,
  deliveredAt TEXT,
  openedAt TEXT,
  clickedAt TEXT,
  failedAt TEXT,
  error TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Branch Checks (for campaign conditional logic)
CREATE TABLE newsletter_branch_checks (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL,
  campaignId TEXT NOT NULL,
  stepId TEXT NOT NULL,
  contactId TEXT NOT NULL,
  sentEmailId TEXT NOT NULL,
  monitorEvent TEXT NOT NULL,
  successStepId TEXT,
  fallbackStepId TEXT,
  evaluateAt TEXT NOT NULL,
  baseTime TEXT NOT NULL,
  processed INTEGER DEFAULT 0,
  processedAt TEXT,
  created_at TEXT NOT NULL
);
```

See `packages/kuratchi-sdk/src/lib/newsletter/SCHEMA.md` for complete schema with indexes.

### 2. Configure Environment Variables

Update your `.env` file to use AWS SES credentials instead of Resend:

```bash
# Remove these:
# RESEND_API_KEY=...
# RESEND_FROM_EMAIL=...

# Add these:
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
SES_FROM_EMAIL=noreply@yourdomain.com
SES_FROM_NAME="Your Company Name"
```

### 3. Initialize the Newsletter Module

In your `hooks.server.ts`, initialize the newsletter module:

```typescript
import { kuratchi } from 'kuratchi-sdk';
import { initNewsletterPlugin } from 'kuratchi-sdk/newsletter';

// Initialize during server startup
initNewsletterPlugin({
  sesRegion: process.env.AWS_REGION,
  sesAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  sesSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sesFrom: process.env.SES_FROM_EMAIL,
  sesFromName: process.env.SES_FROM_NAME,
  sesConfigurationSetName: process.env.SES_CONFIGURATION_SET, // optional
  storageDb: 'org', // or 'admin' depending on your setup
  enableTracking: true,
  maxContactsPerLaunch: 1000
});
```

## API Usage

The API remains the same from your dashboard perspective. The `newsletter.remote.ts` file now uses the kuratchi-sdk newsletter module instead of Resend.

### Segments

```typescript
import * as newsletter from 'kuratchi-sdk/newsletter';

// List segments
const segments = await newsletter.listSegments(event);

// Create segment
const result = await newsletter.createSegment(event, { 
  name: 'Newsletter Subscribers' 
});

// Delete segment
await newsletter.deleteSegment(event, segmentId);
```

### Contacts

```typescript
// List contacts in a segment
const { contacts, hasMore } = await newsletter.listSegmentContacts(event, segmentId, 50);

// Add contact to segment
await newsletter.addContactToSegment(event, {
  segmentId,
  email: 'user@example.com',
  firstName: 'John',
  lastName: 'Doe'
});

// Remove contact from segment
await newsletter.removeContactFromSegment(event, segmentId, contactId);
```

### Templates

```typescript
// List templates
const templates = await newsletter.listTemplates(event);

// Get template
const template = await newsletter.getTemplate(event, templateId);

// Create template
await newsletter.createTemplate(event, {
  name: 'Welcome Email',
  subject: 'Welcome to {{company}}!',
  html: '<h1>Welcome!</h1>'
});
```

### Broadcasts

```typescript
// List broadcasts
const broadcasts = await newsletter.listBroadcasts(event);

// Create broadcast
await newsletter.createBroadcast(event, {
  segmentId,
  name: 'Product Launch',
  subject: 'New Product Available!',
  html: '<p>Check out our new product...</p>',
  scheduledAt: '2025-12-01T10:00:00Z' // optional
});

// Send broadcast
await newsletter.sendBroadcast(event, broadcastId);
```

### Drip Campaigns

```typescript
// List campaigns
const campaigns = await newsletter.listCampaigns(event);

// Get campaign with steps
const campaign = await newsletter.getCampaign(event, campaignId);

// Save campaign
await newsletter.saveCampaign(event, {
  segmentId,
  name: 'Onboarding Series',
  steps: [
    {
      label: 'Welcome Email',
      subject: 'Welcome!',
      html: '<p>Welcome...</p>',
      scheduleMode: 'relative',
      delayMinutes: 0
    },
    {
      label: 'Follow-up',
      subject: 'Getting Started',
      html: '<p>Here\'s how to get started...</p>',
      scheduleMode: 'relative',
      delayMinutes: 1440 // 1 day
    }
  ]
});

// Launch campaign
await newsletter.launchCampaign(event, campaignId);

// Process branch checks (run via cron)
await newsletter.processCampaignBranches(event, 25);
```

## Features

### ✅ Segments & Contacts
- Create and manage audience segments
- Add/remove contacts from segments
- Track subscription status
- Store custom metadata per contact

### ✅ Templates
- Create reusable email templates
- Store in your database
- Support for HTML and plain text

### ✅ Broadcasts
- Send one-time emails to segments
- Schedule broadcasts for future sending
- Track delivery success/failure rates
- All emails sent via Amazon SES

### ✅ Drip Campaigns
- Multi-step email sequences
- Relative or absolute scheduling
- Conditional branching based on opens/clicks
- Automatic step progression
- Campaign pause/resume capability

### ✅ Email Tracking
- All sent emails tracked in database
- Status tracking (sent, delivered, opened, clicked, failed)
- SES message ID for reference
- Custom metadata support

## Migration from Resend

If you were using Resend before:

1. **Export your data** from Resend (contacts, segments)
2. **Create the database tables** as shown above
3. **Import your contacts** into the new `newsletter_contacts` table
4. **Update environment variables** to use AWS SES
5. **Test with a small segment** before full migration

## Benefits

✅ **Own your data** - All subscriber data in your database  
✅ **Cost effective** - SES pricing is typically lower than Resend  
✅ **Full control** - Customize every aspect of the system  
✅ **No vendor lock-in** - Your data, your infrastructure  
✅ **Scalable** - SES scales automatically  
✅ **Tenant isolation** - Per-organization data separation  

## Notes

- **No scheduled sending in SES**: Unlike Resend, SES doesn't support native scheduled sending. Emails are sent immediately. For scheduling, you'll need to implement a queue system or use CloudFlare Queues.
- **Email tracking**: Opens and clicks require additional setup with SES (tracking pixels, link wrappers)
- **Drip campaigns**: Branch evaluation is manual - call `processCampaignBranches()` periodically via cron

## Support

For issues or questions:
- Check the schema documentation: `packages/kuratchi-sdk/src/lib/newsletter/SCHEMA.md`
- Review the types: `packages/kuratchi-sdk/src/lib/newsletter/types.ts`
- See the implementation: `packages/kuratchi-sdk/src/lib/newsletter/index.ts`
