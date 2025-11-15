<script lang="ts">
  import { goto } from '$app/navigation';
  import { Mail, Zap, Users, FileText, BarChart3, ArrowRight, Globe } from 'lucide-svelte';
  import { getEmails, getEmailStats } from '$lib/functions/emails.remote';
  import { listDripCampaigns, listSegments } from '$lib/functions/newsletter.remote';

  const emails = getEmails();
  const stats = getEmailStats();
  const dripResource = listDripCampaigns();
  const segmentsResource = listSegments();

  const statsData = $derived(stats.current || { total: 0, sent: 0, failed: 0, pending: 0, last24h: 0 });
  const campaigns = $derived(Array.isArray(dripResource.current) ? dripResource.current : []);
  const segments = $derived(Array.isArray(segmentsResource.current) ? segmentsResource.current : []);
  
  const activeCampaigns = $derived(campaigns.filter((c: any) => c.status === 'active').length);
  const totalContacts = $derived(segments.reduce((sum: number, seg: any) => sum + (seg.contactCount ?? 0), 0));
</script>

<svelte:head>
  <title>Email Dashboard - Kuratchi</title>
</svelte:head>

<div class="p-8 space-y-8">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold">Email Dashboard</h1>
      <p class="text-base-content/70 mt-1">Welcome, let's dive into your email marketing.</p>
    </div>
    <a href="/emails/drip" class="btn btn-primary">
      <Zap class="h-4 w-4" />
      Create Campaign
    </a>
  </div>

  <!-- Key Metrics -->
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
    <div class="card bg-base-100 shadow-sm border border-base-200">
      <div class="card-body p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-base-content/60 uppercase font-semibold tracking-wide">Emails Sent</p>
            <p class="text-3xl font-bold mt-2">{statsData.sent.toLocaleString()}</p>
            <p class="text-xs text-success mt-1">+12% vs last month</p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
            <Mail class="h-6 w-6 text-success" />
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-200">
      <div class="card-body p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-base-content/60 uppercase font-semibold tracking-wide">Active Campaigns</p>
            <p class="text-3xl font-bold mt-2">{activeCampaigns}</p>
            <p class="text-xs text-base-content/50 mt-1">{campaigns.length} total</p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap class="h-6 w-6 text-primary" />
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-200">
      <div class="card-body p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-base-content/60 uppercase font-semibold tracking-wide">Total Contacts</p>
            <p class="text-3xl font-bold mt-2">{totalContacts.toLocaleString()}</p>
            <p class="text-xs text-base-content/50 mt-1">{segments.length} segments</p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-info/10 flex items-center justify-center">
            <Users class="h-6 w-6 text-info" />
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-200">
      <div class="card-body p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-base-content/60 uppercase font-semibold tracking-wide">Failed</p>
            <p class="text-3xl font-bold mt-2">{statsData.failed}</p>
            <p class="text-xs text-error mt-1">-2% vs last month</p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-error/10 flex items-center justify-center">
            <BarChart3 class="h-6 w-6 text-error" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Navigation Cards -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
    <!-- Drip Campaigns -->
    <a href="/emails/drip" class="card bg-base-100 shadow-sm border border-base-200 hover:shadow-md hover:border-primary transition-all cursor-pointer group">
      <div class="card-body">
        <div class="flex items-start justify-between">
          <div>
            <h3 class="card-title text-lg flex items-center gap-2">
              <Zap class="h-5 w-5 text-primary" />
              Drip Campaigns
            </h3>
            <p class="text-sm text-base-content/70 mt-2">Build automated email sequences and nurture your audience.</p>
          </div>
          <ArrowRight class="h-5 w-5 text-base-content/30 group-hover:text-primary transition-colors" />
        </div>
        <div class="mt-4 pt-4 border-t border-base-200">
          <p class="text-xs text-base-content/60">{activeCampaigns} active • {campaigns.length} total</p>
        </div>
      </div>
    </a>

    <!-- Broadcasts -->
    <a href="/emails/broadcast" class="card bg-base-100 shadow-sm border border-base-200 hover:shadow-md hover:border-primary transition-all cursor-pointer group">
      <div class="card-body">
        <div class="flex items-start justify-between">
          <div>
            <h3 class="card-title text-lg flex items-center gap-2">
              <Mail class="h-5 w-5 text-success" />
              Broadcasts
            </h3>
            <p class="text-sm text-base-content/70 mt-2">Send direct emails to your audiences instantly.</p>
          </div>
          <ArrowRight class="h-5 w-5 text-base-content/30 group-hover:text-primary transition-colors" />
        </div>
        <div class="mt-4 pt-4 border-t border-base-200">
          <p class="text-xs text-base-content/60">One-time campaigns</p>
        </div>
      </div>
    </a>

    <!-- Segments -->
    <a href="/emails/segments" class="card bg-base-100 shadow-sm border border-base-200 hover:shadow-md hover:border-primary transition-all cursor-pointer group">
      <div class="card-body">
        <div class="flex items-start justify-between">
          <div>
            <h3 class="card-title text-lg flex items-center gap-2">
              <Users class="h-5 w-5 text-info" />
              Segments
            </h3>
            <p class="text-sm text-base-content/70 mt-2">Organize and manage your contact lists and audiences.</p>
          </div>
          <ArrowRight class="h-5 w-5 text-base-content/30 group-hover:text-primary transition-colors" />
        </div>
        <div class="mt-4 pt-4 border-t border-base-200">
          <p class="text-xs text-base-content/60">{segments.length} segments • {totalContacts.toLocaleString()} contacts</p>
        </div>
      </div>
    </a>

    <!-- Templates -->
    <a href="/emails/templates" class="card bg-base-100 shadow-sm border border-base-200 hover:shadow-md hover:border-primary transition-all cursor-pointer group">
      <div class="card-body">
        <div class="flex items-start justify-between">
          <div>
            <h3 class="card-title text-lg flex items-center gap-2">
              <FileText class="h-5 w-5 text-warning" />
              Templates
            </h3>
            <p class="text-sm text-base-content/70 mt-2">Create and manage reusable email templates.</p>
          </div>
          <ArrowRight class="h-5 w-5 text-base-content/30 group-hover:text-primary transition-colors" />
        </div>
        <div class="mt-4 pt-4 border-t border-base-200">
          <p class="text-xs text-base-content/60">Ready to use in campaigns</p>
        </div>
      </div>
    </a>

    <!-- Domains -->
    <a href="/emails/domains" class="card bg-base-100 shadow-sm border border-base-200 hover:shadow-md hover:border-primary transition-all cursor-pointer group">
      <div class="card-body">
        <div class="flex items-start justify-between">
          <div>
            <h3 class="card-title text-lg flex items-center gap-2">
              <Globe class="h-5 w-5 text-secondary" />
              Domains
            </h3>
            <p class="text-sm text-base-content/70 mt-2">Verify domains for sending emails from your own domain.</p>
          </div>
          <ArrowRight class="h-5 w-5 text-base-content/30 group-hover:text-primary transition-colors" />
        </div>
        <div class="mt-4 pt-4 border-t border-base-200">
          <p class="text-xs text-base-content/60">DNS verification required</p>
        </div>
      </div>
    </a>
  </div>

  <!-- Quick Stats -->
  <div class="card bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
    <div class="card-body">
      <h3 class="card-title">Performance Overview</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        <div>
          <p class="text-xs text-base-content/60 uppercase font-semibold">Total Emails</p>
          <p class="text-2xl font-bold mt-1">{statsData.total.toLocaleString()}</p>
        </div>
        <div>
          <p class="text-xs text-base-content/60 uppercase font-semibold">Last 24h</p>
          <p class="text-2xl font-bold mt-1">{statsData.last24h.toLocaleString()}</p>
        </div>
        <div>
          <p class="text-xs text-base-content/60 uppercase font-semibold">Success Rate</p>
          <p class="text-2xl font-bold mt-1">{statsData.total > 0 ? Math.round((statsData.sent / statsData.total) * 100) : 0}%</p>
        </div>
        <div>
          <p class="text-xs text-base-content/60 uppercase font-semibold">Pending</p>
          <p class="text-2xl font-bold mt-1">{statsData.pending.toLocaleString()}</p>
        </div>
      </div>
    </div>
  </div>
</div>
