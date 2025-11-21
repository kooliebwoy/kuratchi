# Email Event Tracking Setup Guide

## Overview

Email event tracking is now **batteries-included** in the Kuratchi SDK! The webhook endpoint is automatically mounted at `/.well-known/kuratchi/email-events`.

## Quick Setup (5 minutes)

### Step 1: Create SNS Topic

```bash
aws sns create-topic \
  --name kuratchi-ses-events \
  --region us-east-2
```

**Save the TopicArn** from the output (e.g., `arn:aws:sns:us-east-2:123456789:kuratchi-ses-events`)

### Step 2: Subscribe Your Webhook

```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-2:YOUR_ACCOUNT_ID:kuratchi-ses-events \
  --protocol https \
  --notification-endpoint https://yourdomain.com/.well-known/kuratchi/email-events \
  --region us-east-2
```

The webhook will **automatically confirm** the subscription!

### Step 3: Create SES Configuration Set

```bash
# Create configuration set
aws sesv2 create-configuration-set \
  --configuration-set-name kuratchi-tracking \
  --region us-east-2

# Add event destination for tracking
aws sesv2 create-configuration-set-event-destination \
  --configuration-set-name kuratchi-tracking \
  --event-destination-name sns-events \
  --event-destination '{
    "Enabled": true,
    "MatchingEventTypes": ["SEND","DELIVERY","BOUNCE","COMPLAINT","REJECT","OPEN","CLICK"],
    "SnsDestination": {
      "TopicArn": "arn:aws:sns:us-east-2:YOUR_ACCOUNT_ID:kuratchi-ses-events"
    }
  }' \
  --region us-east-2
```

### Step 4: Enable in Your App

Add the configuration set name to your hooks.server.ts:

```typescript
export const { handle } = kuratchi({
  email: {
    region: env.AWS_SES_REGION || 'us-east-2',
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    from: 'noreply@yourdomain.com',
    fromName: 'Your App',
    trackEmails: true,
    trackingDb: 'org',
    trackingTable: 'email_logs',
    configurationSetName: 'kuratchi-tracking', // ← Add this!
  },
  // ... rest of config
});
```

### Step 5: Test It!

1. Send a test email from your dashboard
2. Open the email in your inbox
3. Click a link in the email
4. Refresh the email log - you'll see:
   - ✅ Delivered badge
   - 👁️ Opened badge with count
   - 🖱️ Clicked badge with count

## What Gets Tracked

| Event | Status | Fields Updated |
|-------|--------|----------------|
| **Send** | `sent` | `sentAt` |
| **Delivery** | `delivered` | `deliveredAt`, `deliveryDelay` |
| **Open** | - | `openedAt`, `openCount`, `userAgent` |
| **Click** | - | `clickedAt`, `clickCount`, `lastClickedLink` |
| **Bounce** | `bounced` | `bouncedAt`, `bounceType`, `bounceSubType` |
| **Complaint** | `complained` | `complainedAt`, `complaintFeedbackType` |
| **Reject** | `rejected` | `rejectedAt`, `rejectReason` |

## Architecture

```
┌─────────────┐
│   Your App  │
│  SvelteKit  │
└─────┬───────┘
      │ 1. Send email via SES
      ▼
┌─────────────┐     2. Forward events     ┌─────────┐
│  Amazon SES │ ───────────────────────▶ │   SNS   │
│             │                           │  Topic  │
└─────────────┘                           └────┬────┘
                                               │ 3. Webhook POST
                                               ▼
                                    /.well-known/kuratchi/email-events
                                               │
                                               ▼
                                    ┌──────────────────────┐
                                    │  Kuratchi SDK        │
                                    │  Auto-handler        │
                                    │  (batteries-included)│
                                    └──────────┬───────────┘
                                               │ 4. Update email_logs
                                               ▼
                                    ┌──────────────────────┐
                                    │  Organization DB     │
                                    │  email_logs table    │
                                    └──────────────────────┘
```

## Dashboard Display

The email log now shows:

- **Status badges**: Sent, Delivered, Bounced, Complained, Rejected, Failed
- **Engagement metrics**: Delivery ✓, Opens 👁️, Clicks 🖱️
- **Counts**: Shows how many times opened/clicked
- **Tooltips**: Hover for detailed info

## Costs

- SNS: **$0.50 per 1M requests**
- SES events: **Included**
- Webhook processing: **Included in Cloudflare Workers**

**Total: ~$0.50 per 1M emails** (essentially free for most apps)

## Custom Webhook Path

Default path: `/.well-known/kuratchi/email-events`

To customize:

```typescript
email: {
  // ... other config
  eventsPath: '/api/my-custom-path',
}
```

Then update SNS subscription endpoint accordingly.

## Troubleshooting

### Webhook not receiving events

1. Check SNS subscription is confirmed (Status: "Confirmed" in AWS Console)
2. Verify webhook is publicly accessible
3. Check CloudFlare/Vercel logs for incoming requests
4. Test with: `curl -X POST https://yourdomain.com/.well-known/kuratchi/email-events`

### Events received but not updating database

1. Check console logs for `[Email Events]` messages
2. Verify `configurationSetName` is set in email config
3. Confirm table name matches (`email_logs` by default)
4. Check organizationId is available in session

### Open/Click tracking not working

SES requires:
- HTML emails (not plain text)
- Links must be proper `<a href="...">` tags
- Enable open/click tracking in Configuration Set

## Next Steps

- Set up **bounce suppression list** to avoid repeat bounces
- Configure **complaint feedback** to remove complainers
- Add **unsubscribe link** handling
- Monitor **engagement rates** per campaign
