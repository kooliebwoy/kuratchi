<script lang="ts">
  import '../app.css';
  import AppShell from '$components/app-shell/AppShell.svelte';
  import EmailVerificationBanner from '$components/EmailVerificationBanner.svelte';
  import type { LayoutData } from './$types';
  import type { Snippet } from 'svelte';
	import { getOrganizationNameById } from '$lib/functions/organizations.remote';
	import HelpWidget from '$components/HelpWidget.svelte';
  import { page } from '$app/state';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();

  // Make these reactive to data changes
  const isAuthenticated = $derived(data.isAuthenticated);
  const isSuperadmin = $derived(data.isSuperadmin);
  const isEmailVerified = $derived(data.isEmailVerified);
  const user = $derived(data.user);
  const skipRootLayout = $derived(page.data.skipRootLayout);
  
  const workspace = $derived(user?.organizationId ? await getOrganizationNameById(user.organizationId) : 'Unknown Organization');
  
  // Show verification banner for authenticated users with unverified email
  const showVerificationBanner = $derived(isAuthenticated && !isEmailVerified && !skipRootLayout);
  
  // Use SES verification in development/sandbox mode
  // Set to false when SES is in production mode
  const useSesVerification = true;
  
  const handleResendVerification = async () => {
    // Use SES verification endpoint in sandbox mode
    const endpoint = useSesVerification 
      ? '/auth/verify-email/ses-request' 
      : '/auth/verify-email/resend';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return response.json();
  };
  
  const handleCheckVerificationStatus = async () => {
    const response = await fetch('/auth/verify-email/ses-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return response.json();
  };
</script>

{#if isAuthenticated && !skipRootLayout}
  {#if showVerificationBanner}
    <EmailVerificationBanner 
      email={user?.email}
      useSesVerification={true}
      onResend={handleResendVerification}
      onCheckStatus={handleCheckVerificationStatus}
    />
  {/if}
  <AppShell {workspace} {user} {isSuperadmin}>
    {@render children()}
  </AppShell>
  <HelpWidget />
{:else}
  {@render children()}
{/if}
