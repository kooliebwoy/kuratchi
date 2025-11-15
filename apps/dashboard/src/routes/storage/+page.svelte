<script lang="ts">
  import { getAllBuckets } from '$lib/functions/buckets.remote';
  import { Badge, Button, InfoCard } from '@kuratchi/ui';
  import { Database, HardDrive, Globe, Calendar, MapPin, Package } from 'lucide-svelte';

  // Load buckets
  let bucketsQuery = getAllBuckets(undefined);
  let data = $derived(bucketsQuery.current);
  
  let buckets = $derived<any[]>(data?.buckets ?? []);
  let orgBuckets = $derived<any[]>(data?.orgBuckets ?? []);
  let siteBuckets = $derived<any[]>(data?.siteBuckets ?? []);
  let stats = $derived(data?.stats ?? { total: 0, managed: 0, unmanaged: 0, orgLevel: 0, siteLevel: 0 });
  
  // State
  let selectedTab = $state<'all' | 'org' | 'sites'>('all');
  
  // Computed
  let displayedBuckets = $derived(() => {
    if (selectedTab === 'org') return orgBuckets;
    if (selectedTab === 'sites') return siteBuckets;
    return buckets;
  });
  
  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  function getBucketTypeIcon(bucket: any) {
    if (bucket.metadata?.type === 'site') return Globe;
    if (bucket.metadata?.type === 'database') return Database;
    return Package;
  }
  
  function getBucketTypeBadge(bucket: any) {
    if (!bucket.isManaged) return { text: 'Unmanaged', variant: 'secondary' as const };
    if (bucket.metadata?.type === 'site') return { text: 'Site', variant: 'info' as const };
    if (bucket.metadata?.type === 'database') return { text: 'Database', variant: 'primary' as const };
    return { text: 'Unknown', variant: 'secondary' as const };
  }
</script>

<div class="container mx-auto py-8 px-4">
  <!-- Header -->
  <div class="mb-8">
    <h1 class="text-3xl font-bold mb-2">Storage</h1>
    <p class="text-muted-foreground">
      Manage your Organization and Site storage
    </p>
  </div>


  <!-- Tabs -->
  <div class="flex gap-2 mb-6 border-b">
    <button
      class="px-4 py-2 font-medium transition-colors {selectedTab === 'all' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}"
      onclick={() => selectedTab = 'all'}
    >
      All Buckets ({stats.total})
    </button>
    <button
      class="px-4 py-2 font-medium transition-colors {selectedTab === 'org' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}"
      onclick={() => selectedTab = 'org'}
    >
      Organization ({stats.orgLevel})
    </button>
    <button
      class="px-4 py-2 font-medium transition-colors {selectedTab === 'sites' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}"
      onclick={() => selectedTab = 'sites'}
    >
      Sites ({stats.siteLevel})
    </button>
  </div>

  <!-- Buckets List -->
  <div class="space-y-4">
    {#if displayedBuckets().length === 0}
      <div class="text-center py-12 text-muted-foreground">
        <Package class="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No buckets found</p>
      </div>
    {:else}
      {#each displayedBuckets() as bucket (bucket.name)}
        <div class="border rounded-lg p-6 hover:bg-accent/50 transition-colors">
          <div class="flex items-start justify-between">
            <div class="flex items-start gap-4 flex-1">
              <div class="p-3 bg-primary/10 rounded-lg">
                {#if bucket.metadata?.type === 'site'}
                  <Globe class="h-6 w-6 text-primary" />
                {:else if bucket.metadata?.type === 'database'}
                  <Database class="h-6 w-6 text-primary" />
                {:else}
                  <Package class="h-6 w-6 text-primary" />
                {/if}
              </div>
              
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                  <h3 class="text-lg font-semibold">{bucket.name}</h3>
                  <Badge variant={getBucketTypeBadge(bucket).variant}>
                    {getBucketTypeBadge(bucket).text}
                  </Badge>
                  {#if bucket.metadata}
                    <Badge variant="secondary">{bucket.metadata.binding || 'STORAGE'}</Badge>
                  {/if}
                </div>
                
                {#if bucket.metadata}
                  <p class="text-sm text-muted-foreground mb-3">
                    {#if bucket.metadata.type === 'site'}
                      Site: <span class="font-medium">{bucket.metadata.name}</span>
                      {#if bucket.metadata.subdomain}
                        · <span class="text-xs">{bucket.metadata.subdomain}.kuratchi.com</span>
                      {/if}
                    {:else if bucket.metadata.type === 'database'}
                      Database: <span class="font-medium">{bucket.metadata.name}</span>
                    {/if}
                  </p>
                {/if}
                
                <div class="flex items-center gap-4 text-sm text-muted-foreground">
                  <div class="flex items-center gap-1">
                    <MapPin class="h-4 w-4" />
                    <span>{bucket.location || 'Unknown'}</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <Calendar class="h-4 w-4" />
                    <span>Created {formatDate(bucket.creation_date)}</span>
                  </div>
                  {#if bucket.storage_class}
                    <Badge variant="secondary" class="text-xs">{bucket.storage_class}</Badge>
                  {/if}
                </div>
              </div>
            </div>
            
            <div class="flex gap-2">
              <a href="/storage/{bucket.name}">
                <Button variant="ghost" size="sm">
                  View Files
                </Button>
              </a>
              {#if !bucket.isManaged}
                <Button variant="ghost" size="sm">
                  Import
                </Button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>
