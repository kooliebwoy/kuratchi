# Newsletter Database Schema

This document describes the database tables required for the newsletter module.

## Tables

### newsletter_segments

Audience segments for organizing subscribers.

```sql
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

CREATE INDEX idx_newsletter_segments_org ON newsletter_segments(organizationId);
```

### newsletter_contacts

Individual email contacts.

```sql
CREATE TABLE newsletter_contacts (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL,
  email TEXT NOT NULL,
  firstName TEXT,
  lastName TEXT,
  unsubscribed INTEGER DEFAULT 0,
  unsubscribedAt TEXT,
  metadata TEXT, -- JSON
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX idx_newsletter_contacts_org ON newsletter_contacts(organizationId);
CREATE INDEX idx_newsletter_contacts_email ON newsletter_contacts(organizationId, email);
CREATE UNIQUE INDEX idx_newsletter_contacts_org_email ON newsletter_contacts(organizationId, email) WHERE deleted_at IS NULL;
```

### newsletter_segment_contacts

Many-to-many relationship between segments and contacts.

```sql
CREATE TABLE newsletter_segment_contacts (
  segmentId TEXT NOT NULL,
  contactId TEXT NOT NULL,
  added_at TEXT NOT NULL,
  PRIMARY KEY (segmentId, contactId)
);

CREATE INDEX idx_newsletter_segment_contacts_segment ON newsletter_segment_contacts(segmentId);
CREATE INDEX idx_newsletter_segment_contacts_contact ON newsletter_segment_contacts(contactId);
```

### newsletter_templates

Email templates for reusable content.

```sql
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

CREATE INDEX idx_newsletter_templates_org ON newsletter_templates(organizationId);
```

### newsletter_broadcasts

One-time broadcasts to a segment.

```sql
CREATE TABLE newsletter_broadcasts (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL,
  segmentId TEXT NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT,
  text TEXT,
  previewText TEXT,
  status TEXT NOT NULL, -- 'draft', 'scheduled', 'sending', 'sent', 'failed'
  scheduledAt TEXT,
  sentAt TEXT,
  recipientCount INTEGER DEFAULT 0,
  successCount INTEGER DEFAULT 0,
  failureCount INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX idx_newsletter_broadcasts_org ON newsletter_broadcasts(organizationId);
CREATE INDEX idx_newsletter_broadcasts_segment ON newsletter_broadcasts(segmentId);
```

### newsletter_campaigns

Drip campaigns with multiple steps.

```sql
CREATE TABLE newsletter_campaigns (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL,
  segmentId TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL, -- 'draft', 'active', 'paused', 'completed'
  startAt TEXT,
  lastLaunchAt TEXT,
  contactsTargeted INTEGER DEFAULT 0,
  totalScheduled INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX idx_newsletter_campaigns_org ON newsletter_campaigns(organizationId);
CREATE INDEX idx_newsletter_campaigns_segment ON newsletter_campaigns(segmentId);
```

### newsletter_campaign_steps

Individual steps in a drip campaign.

```sql
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
  scheduleMode TEXT NOT NULL, -- 'relative', 'absolute'
  sendAt TEXT, -- For absolute scheduling
  delayMinutes INTEGER DEFAULT 0, -- For relative scheduling
  status TEXT NOT NULL, -- 'draft', 'scheduled', 'completed'
  -- Branching logic
  monitorEvent TEXT, -- 'opened', 'clicked'
  successStepId TEXT,
  fallbackStepId TEXT,
  evaluateAfterMinutes INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX idx_newsletter_campaign_steps_campaign ON newsletter_campaign_steps(campaignId);
CREATE INDEX idx_newsletter_campaign_steps_order ON newsletter_campaign_steps(campaignId, stepOrder);
```

### newsletter_sent_emails

Tracking for all sent emails.

```sql
CREATE TABLE newsletter_sent_emails (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL,
  contactId TEXT NOT NULL,
  email TEXT NOT NULL,
  type TEXT NOT NULL, -- 'broadcast', 'campaign'
  broadcastId TEXT,
  campaignId TEXT,
  campaignStepId TEXT,
  subject TEXT NOT NULL,
  sesMessageId TEXT,
  status TEXT NOT NULL, -- 'scheduled', 'sent', 'delivered', 'opened', 'clicked', 'failed'
  scheduledAt TEXT,
  sentAt TEXT,
  deliveredAt TEXT,
  openedAt TEXT,
  clickedAt TEXT,
  failedAt TEXT,
  error TEXT,
  metadata TEXT, -- JSON
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_newsletter_sent_emails_org ON newsletter_sent_emails(organizationId);
CREATE INDEX idx_newsletter_sent_emails_contact ON newsletter_sent_emails(contactId);
CREATE INDEX idx_newsletter_sent_emails_broadcast ON newsletter_sent_emails(broadcastId);
CREATE INDEX idx_newsletter_sent_emails_campaign ON newsletter_sent_emails(campaignId);
CREATE INDEX idx_newsletter_sent_emails_ses ON newsletter_sent_emails(sesMessageId);
```

### newsletter_branch_checks

Queue for processing campaign step branching logic.

```sql
CREATE TABLE newsletter_branch_checks (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL,
  campaignId TEXT NOT NULL,
  stepId TEXT NOT NULL,
  contactId TEXT NOT NULL,
  sentEmailId TEXT NOT NULL,
  monitorEvent TEXT NOT NULL, -- 'opened', 'clicked'
  successStepId TEXT,
  fallbackStepId TEXT,
  evaluateAt TEXT NOT NULL,
  baseTime TEXT NOT NULL,
  processed INTEGER DEFAULT 0,
  processedAt TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_newsletter_branch_checks_org ON newsletter_branch_checks(organizationId);
CREATE INDEX idx_newsletter_branch_checks_evaluate ON newsletter_branch_checks(processed, evaluateAt);
CREATE INDEX idx_newsletter_branch_checks_campaign ON newsletter_branch_checks(campaignId);
```

## Usage

These tables should be created in your organization database (or admin database if you configure `storageDb: 'admin'`).

For Cloudflare D1, you can create a migration file with these schemas. For PostgreSQL or other databases, adjust the types accordingly (e.g., `INTEGER DEFAULT 0` for boolean fields should be `BOOLEAN DEFAULT false`).
