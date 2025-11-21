# AWS SES Event Tracking Setup

## Overview

Track email delivery, opens, clicks, and bounces using AWS SES Event Publishing to SNS/SQS or direct event destinations.

## Architecture Options

### Option 1: SNS + Webhook (Recommended for Cloudflare Workers)

```
SES → SNS Topic → HTTPS Subscription → Your API Endpoint
```

**Pros:**
- Real-time event delivery
- No polling required
- Works well with Cloudflare Workers
- Can handle high volume

**Cons:**
- Requires public HTTPS endpoint
- Need to verify SNS subscription

### Option 2: Event Destinations (SES V2 Feature)

```
SES Configuration Set → Event Destination → SNS/Kinesis/CloudWatch
```

**Pros:**
- Built into SES V2
- Granular event filtering
- Multiple destination types

**Cons:**
- More complex setup
- May need additional AWS services

### Option 3: Configuration Set + Kinesis Firehose → S3

```
SES → Configuration Set → Kinesis Firehose → S3 → Process with Worker
```

**Pros:**
- Batch processing
- Historical data storage
- Cost-effective for high volume

**Cons:**
- Not real-time
- Requires periodic processing

## Recommended Setup: SNS + Webhook

### Step 1: Create SNS Topic

```bash
# Create SNS topic for SES events
aws sns create-topic \
  --name kuratchi-ses-events \
  --region us-east-2

# Output will include TopicArn - save this
```

### Step 2: Create SES Configuration Set with Event Publishing

```typescript
// Add to kuratchi-sdk/src/lib/email/setup-ses-events.ts
import { 
  SESv2Client, 
  CreateConfigurationSetCommand,
  CreateConfigurationSetEventDestinationCommand 
} from '@aws-sdk/client-sesv2';

export async function setupSESEventTracking(options: {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  snsTopicArn: string;
  configurationSetName?: string;
}) {
  const client = new SESv2Client({
    region: options.region,
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey
    }
  });

  const configSetName = options.configurationSetName || 'kuratchi-email-tracking';

  // Create configuration set
  await client.send(new CreateConfigurationSetCommand({
    ConfigurationSetName: configSetName
  }));

  // Add event destination for all tracking events
  await client.send(new CreateConfigurationSetEventDestinationCommand({
    ConfigurationSetName: configSetName,
    EventDestinationName: 'sns-events',
    EventDestination: {
      Enabled: true,
      MatchingEventTypes: [
        'SEND',
        'DELIVERY',
        'BOUNCE',
        'COMPLAINT',
        'REJECT',
        'OPEN',
        'CLICK'
      ],
      SnsDestination: {
        TopicArn: options.snsTopicArn
      }
    }
  }));

  return { configurationSetName };
}
```

### Step 3: Create Webhook Endpoint

```typescript
// apps/dashboard/src/routes/api/webhooks/ses-events/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import crypto from 'crypto';

export const POST: RequestHandler = async ({ request, locals }) => {
  const body = await request.text();
  const signature = request.headers.get('x-amz-sns-message-type');
  
  try {
    const message = JSON.parse(body);
    
    // Step 1: Handle SNS subscription confirmation
    if (message.Type === 'SubscriptionConfirmation') {
      // Auto-confirm subscription
      const confirmUrl = message.SubscribeURL;
      await fetch(confirmUrl);
      return json({ message: 'Subscription confirmed' });
    }
    
    // Step 2: Verify SNS signature (production only)
    // TODO: Add SNS signature verification
    
    // Step 3: Process SES event
    if (message.Type === 'Notification') {
      const sesMessage = JSON.parse(message.Message);
      await processSESEvent(sesMessage, locals);
    }
    
    return json({ received: true });
  } catch (error) {
    console.error('[SES Webhook] Error processing event:', error);
    return json({ error: 'Failed to process event' }, { status: 500 });
  }
};

async function processSESEvent(event: any, locals: any) {
  const { eventType, mail } = event;
  const messageId = mail?.messageId;
  
  if (!messageId) return;
  
  // Get admin DB to lookup which org this email belongs to
  const adminDb = await locals.kuratchi?.getAdminDb?.();
  if (!adminDb?.emails) return;
  
  // Find email record by SES message ID
  const { data: emailRecord } = await adminDb.emails
    .where({ sesMessageId: messageId })
    .first();
  
  if (!emailRecord) {
    console.warn('[SES Event] Email not found:', messageId);
    return;
  }
  
  // Get org DB
  const orgDb = await locals.kuratchi?.orgDatabaseClient?.(emailRecord.organizationId);
  if (!orgDb?.emails) return;
  
  // Update email record based on event type
  const updates: any = {
    updated_at: new Date().toISOString()
  };
  
  switch (eventType) {
    case 'Delivery':
      updates.status = 'delivered';
      updates.deliveredAt = event.delivery?.timestamp;
      break;
      
    case 'Open':
      updates.openedAt = event.open?.timestamp;
      updates.openCount = (emailRecord.openCount || 0) + 1;
      break;
      
    case 'Click':
      updates.clickedAt = event.click?.timestamp;
      updates.clickCount = (emailRecord.clickCount || 0) + 1;
      updates.lastClickedLink = event.click?.link;
      break;
      
    case 'Bounce':
      updates.status = 'bounced';
      updates.bouncedAt = event.bounce?.timestamp;
      updates.bounceType = event.bounce?.bounceType;
      updates.bounceSubType = event.bounce?.bounceSubType;
      break;
      
    case 'Complaint':
      updates.status = 'complained';
      updates.complainedAt = event.complaint?.timestamp;
      break;
      
    case 'Reject':
      updates.status = 'rejected';
      updates.rejectedAt = event.reject?.timestamp;
      updates.rejectReason = event.reject?.reason;
      break;
  }
  
  await orgDb.emails
    .where({ sesMessageId: messageId })
    .update(updates);
  
  console.log(`[SES Event] Updated email ${messageId} - ${eventType}`);
}
```

### Step 4: Update Email Schema to Support Tracking

```typescript
// In organization.ts schema
emails: {
  id: 'text primary key not null',
  to: 'text not null',
  from: 'text not null',
  subject: 'text not null',
  emailType: 'text',
  status: 'enum(sent,delivered,bounced,complained,rejected,failed,pending) default pending',
  sesMessageId: 'text',
  error: 'text',
  userId: 'text -> users.id',
  metadata: 'json',
  
  // Delivery tracking
  sentAt: 'text',
  deliveredAt: 'text',
  
  // Engagement tracking
  openedAt: 'text',
  openCount: 'integer default 0',
  clickedAt: 'text',
  clickCount: 'integer default 0',
  lastClickedLink: 'text',
  
  // Bounce/complaint tracking
  bouncedAt: 'text',
  bounceType: 'text',
  bounceSubType: 'text',
  complainedAt: 'text',
  rejectedAt: 'text',
  rejectReason: 'text',
  
  '...timestamps': true,
}
```

### Step 5: Subscribe SNS to Webhook

```bash
# Subscribe your webhook endpoint to SNS topic
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-2:YOUR_ACCOUNT_ID:kuratchi-ses-events \
  --protocol https \
  --notification-endpoint https://yourdomain.com/api/webhooks/ses-events \
  --region us-east-2

# The first POST to your endpoint will be a subscription confirmation
# Your webhook code above will auto-confirm it
```

### Step 6: Update Email Sending to Use Configuration Set

```typescript
// In kuratchi-sdk/src/lib/email/index.ts sendEmail() function
const command = new SendEmailCommand({
  FromEmailAddress: fromAddress,
  Destination: { ToAddresses },
  Content: emailContent,
  ConfigurationSetName: pluginOptions.configurationSetName, // Add this
  EmailTags: tags ? Object.entries(tags).map(([Name, Value]) => ({ Name, Value })) : undefined,
  // ... rest of options
});
```

## Alternative: Direct Polling (Simpler but Less Efficient)

If you don't want webhooks, you can poll SES for events:

```typescript
// Not recommended - webhooks are better
import { SESv2Client, ListEmailEventsCommand } from '@aws-sdk/client-sesv2';

async function pollEmailEvents() {
  const client = new SESv2Client({ region: 'us-east-2', credentials: {...} });
  
  const response = await client.send(new ListEmailEventsCommand({
    FromDate: new Date(Date.now() - 3600000), // Last hour
    ToDate: new Date()
  }));
  
  // Process events
  for (const event of response.Events || []) {
    // Update database based on event
  }
}
```

## Testing

1. Send test email with configuration set enabled
2. Check SNS topic for message delivery
3. Verify webhook receives event
4. Confirm database updated with tracking data
5. Open email in browser (if open tracking enabled)
6. Click link (if click tracking enabled)

## Dashboard Display

Update email log to show tracking status:

```svelte
<td>
  <div class="flex gap-1">
    {#if email.deliveredAt}
      <div class="tooltip" data-tip="Delivered">
        <CheckCircle class="h-4 w-4 text-success" />
      </div>
    {/if}
    {#if email.openedAt}
      <div class="tooltip" data-tip="Opened {email.openCount}x">
        <Eye class="h-4 w-4 text-info" />
      </div>
    {/if}
    {#if email.clickedAt}
      <div class="tooltip" data-tip="Clicked {email.clickCount}x">
        <MousePointer class="h-4 w-4 text-primary" />
      </div>
    {/if}
    {#if email.bouncedAt}
      <div class="tooltip" data-tip="Bounced: {email.bounceType}">
        <AlertTriangle class="h-4 w-4 text-warning" />
      </div>
    {/if}
  </div>
</td>
```

## Cost Considerations

- SNS: $0.50 per 1M requests
- SES events: Included with SES
- Webhook processing: Included in your Cloudflare Workers plan
- Total: ~$0.50 per 1M emails (just SNS cost)

## Next Steps

1. Create SNS topic in AWS console
2. Implement webhook endpoint
3. Update email schema with tracking fields
4. Enable configuration set in email sending
5. Test with sample emails
6. Update UI to display tracking data
