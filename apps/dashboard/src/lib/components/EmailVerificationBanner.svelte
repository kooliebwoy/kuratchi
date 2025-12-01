<script lang="ts">
  import { Mail, X, RefreshCw, CheckCircle, AlertCircle } from '@lucide/svelte';
  
  interface Props {
    email?: string;
    /** Use SES verification mode (sandbox) instead of app-sent emails */
    useSesVerification?: boolean;
    onResend?: () => Promise<{ success: boolean; error?: string; alreadyVerified?: boolean }>;
    /** Callback to check if email is now verified in SES */
    onCheckStatus?: () => Promise<{ verified: boolean }>;
    onDismiss?: () => void;
    dismissable?: boolean;
  }
  
  let { 
    email,
    useSesVerification = false,
    onResend,
    onCheckStatus,
    onDismiss,
    dismissable = false
  }: Props = $props();
  
  let isResending = $state(false);
  let isChecking = $state(false);
  let resendMessage = $state<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  let cooldownSeconds = $state(0);
  
  const handleResend = async () => {
    if (isResending || cooldownSeconds > 0 || !onResend) return;
    
    isResending = true;
    resendMessage = null;
    
    try {
      const result = await onResend();
      
      if (result.success) {
        if (result.alreadyVerified) {
          resendMessage = { type: 'success', text: 'Your email is already verified! Refreshing...' };
          // Reload page to update status
          setTimeout(() => window.location.reload(), 1500);
        } else if (useSesVerification) {
          resendMessage = { 
            type: 'info', 
            text: 'Verification request sent! Check your inbox for an email from Amazon Web Services.' 
          };
        } else {
          resendMessage = { type: 'success', text: 'Verification email sent! Check your inbox.' };
        }
        // Start cooldown
        cooldownSeconds = 60;
        const interval = setInterval(() => {
          cooldownSeconds--;
          if (cooldownSeconds <= 0) {
            clearInterval(interval);
          }
        }, 1000);
      } else {
        // Check for cooldown error
        const waitMatch = result.error?.match(/please_wait_(\d+)_seconds/);
        if (waitMatch) {
          cooldownSeconds = parseInt(waitMatch[1], 10);
          resendMessage = { type: 'error', text: `Please wait ${cooldownSeconds} seconds before resending.` };
          const interval = setInterval(() => {
            cooldownSeconds--;
            if (cooldownSeconds <= 0) {
              clearInterval(interval);
              resendMessage = null;
            }
          }, 1000);
        } else {
          resendMessage = { type: 'error', text: result.error || 'Failed to send verification email.' };
        }
      }
    } catch (e: any) {
      resendMessage = { type: 'error', text: e?.message || 'Failed to send verification email.' };
    } finally {
      isResending = false;
    }
  };

  const handleCheckStatus = async () => {
    console.log('[EmailVerificationBanner] handleCheckStatus called, onCheckStatus:', !!onCheckStatus);
    if (isChecking || !onCheckStatus) return;
    
    isChecking = true;
    resendMessage = null;
    
    try {
      console.log('[EmailVerificationBanner] Calling onCheckStatus...');
      const result = await onCheckStatus();
      console.log('[EmailVerificationBanner] Check result:', result);
      
      if (result.verified) {
        resendMessage = { type: 'success', text: 'Email verified! Refreshing...' };
        setTimeout(() => window.location.reload(), 1500);
      } else {
        resendMessage = { type: 'info', text: 'Not verified yet. Please check your inbox and click the link in the AWS email.' };
      }
    } catch (e: any) {
      console.error('[EmailVerificationBanner] Check error:', e);
      resendMessage = { type: 'error', text: e?.message || 'Failed to check status.' };
    } finally {
      isChecking = false;
    }
  };
</script>

<div class="email-verification-banner">
  <div class="banner-content">
    <div class="banner-icon">
      <Mail size={20} />
    </div>
    <div class="banner-text">
      <strong>Verify your email address</strong>
      {#if useSesVerification}
        <p>
          {#if email}
            To verify <strong>{email}</strong>, click the button below.
          {:else}
            Please verify your email address to access all features.
          {/if}
          You'll receive a verification email from <strong>Amazon Web Services</strong> (not from us directly).
          This is required while we're in development mode.
        </p>
      {:else}
        <p>
          {#if email}
            We sent a verification email to <strong>{email}</strong>.
          {:else}
            Please verify your email address to access all features.
          {/if}
          Check your inbox and click the verification link.
        </p>
      {/if}
      {#if resendMessage}
        <p class="banner-message" class:success={resendMessage.type === 'success'} class:error={resendMessage.type === 'error'} class:info={resendMessage.type === 'info'}>
          {resendMessage.text}
        </p>
      {/if}
    </div>
  </div>
  
  <div class="banner-actions">
    {#if useSesVerification && onCheckStatus}
      <button 
        class="check-button"
        onclick={handleCheckStatus}
        disabled={isChecking}
      >
        <CheckCircle size={16} class={isChecking ? 'spinning' : ''} />
        {#if isChecking}
          Checking...
        {:else}
          I've verified
        {/if}
      </button>
    {/if}
    
    {#if onResend}
      <button 
        class="resend-button"
        onclick={handleResend}
        disabled={isResending || cooldownSeconds > 0}
      >
        <RefreshCw size={16} class={isResending ? 'spinning' : ''} />
        {#if cooldownSeconds > 0}
          Resend in {cooldownSeconds}s
        {:else if isResending}
          Sending...
        {:else if useSesVerification}
          Send verification
        {:else}
          Resend email
        {/if}
      </button>
    {/if}
    
    {#if dismissable && onDismiss}
      <button class="dismiss-button" onclick={onDismiss} aria-label="Dismiss">
        <X size={18} />
      </button>
    {/if}
  </div>
</div>

<style>
  .email-verification-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.875rem 1.25rem;
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border-bottom: 1px solid #f59e0b;
    color: #92400e;
  }
  
  .banner-content {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    flex: 1;
  }
  
  .banner-icon {
    flex-shrink: 0;
    padding: 0.5rem;
    background: rgba(245, 158, 11, 0.2);
    border-radius: 0.5rem;
    color: #d97706;
  }
  
  .banner-text {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .banner-text strong {
    font-weight: 600;
    color: #78350f;
  }
  
  .banner-text p {
    margin: 0;
    font-size: 0.875rem;
    color: #92400e;
    line-height: 1.4;
  }
  
  .banner-message {
    font-size: 0.8125rem !important;
    font-weight: 500;
    margin-top: 0.25rem !important;
  }
  
  .banner-message.success {
    color: #166534 !important;
  }
  
  .banner-message.error {
    color: #dc2626 !important;
  }
  
  .banner-message.info {
    color: #1d4ed8 !important;
  }
  
  .banner-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }
  
  .resend-button {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    background: #f59e0b;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
  }
  
  .resend-button:hover:not(:disabled) {
    background: #d97706;
  }
  
  .resend-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .resend-button :global(.spinning),
  .check-button :global(.spinning) {
    animation: spin 1s linear infinite;
  }
  
  .check-button {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
  }
  
  .check-button:hover:not(:disabled) {
    background: #059669;
  }
  
  .check-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .dismiss-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.375rem;
    background: transparent;
    border: none;
    border-radius: 0.375rem;
    color: #92400e;
    cursor: pointer;
    transition: all 150ms ease;
  }
  
  .dismiss-button:hover {
    background: rgba(146, 64, 14, 0.1);
  }
  
  @media (max-width: 640px) {
    .email-verification-banner {
      flex-direction: column;
      align-items: stretch;
      gap: 0.75rem;
    }
    
    .banner-actions {
      justify-content: flex-end;
    }
  }
</style>
