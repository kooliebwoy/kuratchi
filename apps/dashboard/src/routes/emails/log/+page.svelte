<script lang="ts">
  import { Mail, Send, CheckCircle, XCircle, Clock, RefreshCw, AlertCircle, ExternalLink, Eye, MousePointer, AlertTriangle, Check, Trash2, Copy } from 'lucide-svelte';
  import { Button, Card, Badge, Dialog, Loading } from '@kuratchi/ui';
  import { getEmails, sendTestEmail } from '$lib/functions/emails.remote';
  import { getEmailDomains } from '$lib/functions/emailDomains.remote';

  const emails = getEmails();
  const domainsResource = getEmailDomains();

  const domains = $derived(Array.isArray(domainsResource.current) ? domainsResource.current : []);
  const verifiedDomains = $derived(domains.filter(d => d.emailVerified));
  const hasVerifiedDomain = $derived(verifiedDomains.length > 0);

  let showTestEmailModal = $state(false);
  let testEmailTo = $state('');
  let testEmailFrom = $state('');
  let testEmailSubject = $state('Test Email from Kuratchi');
  let testEmailBody = $state('<p>This is a test email sent from your Kuratchi dashboard.</p><p>If you received this, your email configuration is working correctly!</p>');
  let isHtml = $state(true);
  let isSending = $state(false);
  let toast = $state<{ message: string; type: 'success' | 'error' } | null>(null);

  $effect(() => {
    if (verifiedDomains.length > 0) {
      testEmailFrom = `info@${verifiedDomains[0].name}`;
    }
  });

  async function handleSendTestEmail() {
    if (!testEmailTo || !testEmailFrom || !testEmailSubject || !testEmailBody || isSending) return;
    isSending = true;
    try {
      const result = await sendTestEmail({
        to: testEmailTo,
        from: testEmailFrom,
        subject: testEmailSubject,
        body: testEmailBody,
        isHtml
      });
      
      if (result.success) {
        showToast(`Test email sent successfully! Message ID: ${result.messageId}`, 'success');
        showTestEmailModal = false;
        testEmailTo = '';
        emails.refresh();
      } else {
        showToast(result.error || 'Failed to send test email', 'error');
      }
    } catch (err) {
      showToast('Failed to send test email', 'error');
    } finally {
      isSending = false;
    }
  }

  function showToast(message: string, type: 'success' | 'error') {
    toast = { message, type };
    setTimeout(() => toast = null, 5000);
  }

  function copyMessageId(messageId?: string) {
    if (!messageId) return;
    navigator.clipboard.writeText(messageId);
    showToast('Message ID copied to clipboard', 'success');
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'sent':
        return { variant: 'info', icon: Send, text: 'Sent' };
      case 'delivered':
        return { variant: 'success', icon: CheckCircle, text: 'Delivered' };
      case 'bounced':
        return { variant: 'warning', icon: AlertTriangle, text: 'Bounced' };
      case 'complained':
      case 'rejected':
      case 'failed':
        return { variant: 'error', icon: XCircle, text: status };
      case 'pending':
        return { variant: 'warning', icon: Clock, text: 'Pending' };
      default:
        return { variant: 'neutral', icon: AlertCircle, text: status };
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
</script>

<svelte:head>
  <title>Email Log - Kuratchi</title>
</svelte:head>

{#if toast}
  <div class="kui-toast {toast.type}">
    {#if toast.type === 'success'}
      <CheckCircle class="kui-icon" />
    {:else}
      <XCircle class="kui-icon" />
    {/if}
    <span>{toast.message}</span>
  </div>
{/if}

<div class="kui-email-log">
  <header class="kui-email-log__header">
    <div>
      <p class="kui-eyebrow">Email Delivery</p>
      <h1>Email Logs</h1>
      <p class="kui-subtext">Track all emails sent from your account</p>
    </div>
    <div class="kui-inline end">
      <Button variant="ghost" size="sm" onclick={() => emails.refresh()}>
        <RefreshCw class="kui-icon" /> Refresh
      </Button>
      {#if hasVerifiedDomain}
        <Button variant="primary" size="sm" onclick={() => showTestEmailModal = true}>
          <Send class="kui-icon" /> Send Test Email
        </Button>
      {/if}
    </div>
  </header>

  {#if Array.isArray(emails.current) && emails.current.length > 0}
    {@const emailList = emails.current}
    {@const sentCount = emailList.filter((e: any) => e.status === 'sent').length}
    {@const failedCount = emailList.filter((e: any) => e.status === 'failed').length}
    {@const pendingCount = emailList.filter((e: any) => e.status === 'pending').length}
    <div class="kui-stats">
      <Card class="kui-panel center">
        <p class="kui-subtext">Total Emails</p>
        <h3 class="kui-strong">{emailList.length}</h3>
      </Card>
      <Card class="kui-panel center">
        <p class="kui-subtext">Sent</p>
        <h3 class="kui-strong text-success">{sentCount}</h3>
      </Card>
      <Card class="kui-panel center">
        <p class="kui-subtext">Failed</p>
        <h3 class="kui-strong text-error">{failedCount}</h3>
      </Card>
      <Card class="kui-panel center">
        <p class="kui-subtext">Pending</p>
        <h3 class="kui-strong text-warning">{pendingCount}</h3>
      </Card>
    </div>
  {/if}

  <Card class="kui-panel">
    {#if !emails.current || emails.current.length === 0}
      <div class="kui-center">
        <div class="kui-empty__icon-box"><Mail class="kui-icon" /></div>
        <p class="kui-strong">No emails sent yet</p>
        <p class="kui-subtext">Send your first test email to get started</p>
        {#if hasVerifiedDomain}
          <Button variant="primary" size="sm" onclick={() => showTestEmailModal = true}>
            <Send class="kui-icon" /> Send Test Email
          </Button>
        {:else}
          <Button variant="primary" size="sm" href="/domains">
            <Mail class="kui-icon" /> Setup Email Domain First
          </Button>
        {/if}
      </div>
    {:else}
      <div class="kui-table-scroll">
        <table class="kui-table">
          <thead>
            <tr>
              <th>Recipient</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Provider</th>
              <th>Sent</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each emails.current as email}
              {@const badge = getStatusBadge(email.status)}
              <tr>
                <td class="kui-strong">{email.to}</td>
                <td class="kui-subtext">{email.subject}</td>
                <td>
                  <Badge variant={badge.variant} size="xs">
                    <badge.icon class="kui-icon" />
                    {badge.text}
                  </Badge>
                </td>
                <td class="kui-subtext">{email.provider || 'unknown'}</td>
                <td class="kui-subtext">{formatDate(email.created_at)}</td>
                <td class="text-right">
                  <div class="kui-inline end">
                    {#if email.previewUrl}
                      <Button variant="ghost" size="xs" href={email.previewUrl} target="_blank" rel="noreferrer">
                        <ExternalLink class="kui-icon" />
                      </Button>
                    {/if}
                    {#if email.opens}
                      <Badge variant="ghost" size="xs"><MousePointer class="kui-icon" /> {email.opens} opens</Badge>
                    {/if}
                    <Button variant="ghost" size="xs" onclick={() => copyMessageId(email.messageId)} aria-label="Copy message id">
                      <Copy class="kui-icon" />
                    </Button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </Card>
</div>

{#if showTestEmailModal}
  <Dialog bind:open={showTestEmailModal} size="lg" onClose={() => showTestEmailModal = false}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3>Send Test Email</h3>
        <Button variant="ghost" size="xs" onclick={() => showTestEmailModal = false}>
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="kui-stack">
        {#if !hasVerifiedDomain}
          <div class="kui-callout error">
            <AlertCircle class="kui-icon" />
            <p class="kui-subtext">Verify a sending domain before sending test emails.</p>
          </div>
        {/if}

        <FormField label="To">
          <FormInput field={{ name: 'to', bind: { value: testEmailTo } } as any} type="email" placeholder="recipient@example.com" required />
        </FormField>

        <FormField label="From">
          <FormInput field={{ name: 'from', bind: { value: testEmailFrom } } as any} type="email" placeholder="info@example.com" required />
        </FormField>

        <FormField label="Subject">
          <FormInput field={{ name: 'subject', bind: { value: testEmailSubject } } as any} placeholder="Subject" required />
        </FormField>

        <FormField label="Body">
          <textarea class="kui-textarea font-mono text-sm" rows="8" bind:value={testEmailBody}></textarea>
          <label class="kui-inline">
            <input type="checkbox" bind:checked={isHtml} />
            <span class="kui-subtext">Content is HTML</span>
          </label>
        </FormField>

        <div class="kui-modal-actions">
          <Button variant="ghost" onclick={() => showTestEmailModal = false}>Cancel</Button>
          <Button variant="primary" onclick={handleSendTestEmail} disabled={!hasVerifiedDomain || isSending}>
            {#if isSending}
              <Loading size="sm" /> Sending...
            {:else}
              Send Test Email
            {/if}
          </Button>
        </div>
      </div>
    {/snippet}
  </Dialog>
{/if}

<style>
  .kui-email-log {
    display: grid;
    gap: var(--kui-spacing-md);
  }

  .kui-email-log__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--kui-spacing-md);
    flex-wrap: wrap;
  }

  h1 {
    margin: 0.1rem 0 0.2rem;
    font-size: 1.6rem;
  }

  .kui-eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--kui-color-muted);
    font-weight: 700;
    margin: 0;
    font-size: 0.8rem;
  }

  .kui-subtext {
    color: var(--kui-color-muted);
    margin: 0;
  }

  .kui-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .kui-inline.end {
    justify-content: flex-end;
  }

  .kui-icon {
    width: 1rem;
    height: 1rem;
  }

  .kui-icon.spinning {
    animation: spin 1s linear infinite;
  }

  .kui-panel .kui-card__body {
    gap: var(--kui-spacing-md);
  }

  .kui-stats {
    display: grid;
    gap: var(--kui-spacing-sm);
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }

  .kui-table-scroll {
    overflow: auto;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-lg);
    background: var(--kui-color-surface);
  }

  .kui-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 100%;
  }

  .kui-table th,
  .kui-table td {
    padding: 0.65rem;
    border-bottom: 1px solid var(--kui-color-border);
    text-align: left;
    vertical-align: top;
  }

  .kui-table thead th {
    background: var(--kui-color-surface-muted);
    font-weight: 700;
    font-size: 0.9rem;
  }

  .kui-center {
    display: grid;
    place-items: center;
    gap: 0.35rem;
    text-align: center;
    padding: var(--kui-spacing-lg);
  }

  .kui-empty__icon-box {
    width: 3rem;
    height: 3rem;
    border-radius: var(--kui-radius-lg);
    background: var(--kui-color-surface-muted);
    display: grid;
    place-items: center;
  }

  .kui-empty__icon-box .kui-icon {
    width: 1.5rem;
    height: 1.5rem;
    color: var(--kui-color-muted);
  }

  .kui-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--kui-spacing-sm);
  }

  .kui-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--kui-spacing-sm);
  }

  .kui-stack {
    display: grid;
    gap: var(--kui-spacing-sm);
  }

  .kui-callout {
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    padding: var(--kui-spacing-sm);
    background: var(--kui-color-surface);
    display: inline-flex;
    gap: 0.35rem;
    align-items: center;
  }

  .kui-callout.error {
    border-color: color-mix(in srgb, var(--kui-color-error) 40%, var(--kui-color-border) 60%);
    background: rgba(239, 68, 68, 0.08);
  }

  .kui-textarea {
    width: 100%;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    padding: 0.65rem 0.8rem;
    background: var(--kui-color-surface);
    color: var(--kui-color-text);
    font-size: 0.95rem;
  }

  .kui-toast {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 60;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.75rem 1rem;
    border-radius: var(--kui-radius-lg);
    box-shadow: var(--kui-shadow-md);
    color: #fff;
  }

  .kui-toast.success {
    background: var(--kui-color-success);
  }

  .kui-toast.error {
    background: var(--kui-color-error);
  }

  .text-right {
    text-align: right;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 720px) {
    .kui-segment-card {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
