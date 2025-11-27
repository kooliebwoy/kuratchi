<script lang="ts">
    import { Button, Loading, Card, Badge } from '@kuratchi/ui';
    import { getForm, getLeads, updateLeadStatus, exportLeads } from '$lib/functions/forms.remote';
    import { getSites } from '$lib/functions/sites.remote';
    import { ChevronLeft, Download, Filter, RefreshCw } from '@lucide/svelte';

    let { data } = $props();
    const { formId } = data;

    interface Lead {
        id: string;
        formId: string;
        siteId: string | null;
        data: Record<string, any>;
        status: string;
        source: string;
        created_at: string;
    }

    interface Form {
        id: string;
        name: string;
        fields: { id: string; label: string; name: string }[];
    }

    interface Site {
        id: string;
        name: string;
        subdomain: string;
    }

    // State
    let form = $state<Form | null>(null);
    let leads = $state<Lead[]>([]);
    let sites = $state<Site[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);
    let successMessage = $state<string | null>(null);

    // Filters
    let filterSite = $state<string>('');
    let filterStatus = $state<string>('');

    // Load data on mount
    $effect(() => {
        loadData();
    });

    async function loadData() {
        loading = true;
        error = null;
        try {
            const [formData, leadsData, sitesData] = await Promise.all([
                getForm(),
                getLeads(),
                getSites()
            ]);
            form = formData;
            leads = leadsData;
            sites = sitesData;
        } catch (err) {
            console.error('Failed to load data:', err);
            error = 'Failed to load leads';
        } finally {
            loading = false;
        }
    }

    async function handleStatusChange(leadId: string, newStatus: string) {
        try {
            const result = await updateLeadStatus({ id: leadId, status: newStatus as any });
            if (result.success) {
                leads = leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l);
                showSuccess('Lead status updated');
            }
        } catch (err) {
            console.error('Failed to update lead:', err);
            error = 'Failed to update lead status';
        }
    }

    async function handleExport() {
        try {
            const result = await exportLeads();
            if (result.success && result.csv) {
                const blob = new Blob([result.csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = result.filename || 'leads.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('Failed to export leads:', err);
            error = 'Failed to export leads';
        }
    }

    function showSuccess(message: string) {
        successMessage = message;
        setTimeout(() => {
            successMessage = null;
        }, 3000);
    }

    function getSiteName(siteId: string | null): string {
        if (!siteId) return 'Unknown';
        const site = sites.find(s => s.id === siteId);
        return site?.name || site?.subdomain || 'Unknown';
    }

    function formatDate(dateString: string): string {
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    const filteredLeads = $derived(() => {
        return leads.filter(lead => {
            if (filterSite && lead.siteId !== filterSite) return false;
            if (filterStatus && lead.status !== filterStatus) return false;
            return true;
        });
    });

    const statusColors: Record<string, string> = {
        new: 'info',
        contacted: 'warning',
        qualified: 'success',
        converted: 'success',
        archived: 'ghost'
    };
</script>

<svelte:head>
    <title>Leads - {form?.name || 'Form'} - Kuratchi Dashboard</title>
</svelte:head>

<div class="leads-page">
    <header class="leads-page__header">
        <Button variant="ghost" href={`/forms/${formId}`}>
            <ChevronLeft size={20} />
            Back to Form
        </Button>
        <div class="leads-page__headerContent">
            <div>
                <h1>{form?.name || 'Loading...'} - Leads</h1>
                <p class="leads-page__count">{filteredLeads().length} submissions</p>
            </div>
            <div class="leads-page__actions">
                <Button variant="outline" onclick={loadData}>
                    <RefreshCw size={16} />
                    Refresh
                </Button>
                <Button onclick={handleExport}>
                    <Download size={16} />
                    Export CSV
                </Button>
            </div>
        </div>
    </header>

    {#if error}
        <div class="leads-page__error">{error}</div>
    {/if}

    {#if successMessage}
        <div class="leads-page__success">{successMessage}</div>
    {/if}

    <!-- Filters -->
    <div class="leads-page__filters">
        <div class="leads-page__filter">
            <Filter size={16} />
            <select bind:value={filterSite}>
                <option value="">All Sites</option>
                {#each sites as site}
                    <option value={site.id}>{site.name || site.subdomain}</option>
                {/each}
            </select>
        </div>
        <div class="leads-page__filter">
            <select bind:value={filterStatus}>
                <option value="">All Statuses</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="converted">Converted</option>
                <option value="archived">Archived</option>
            </select>
        </div>
    </div>

    {#if loading}
        <div class="leads-page__loading">
            <Loading />
        </div>
    {:else if filteredLeads().length === 0}
        <Card class="leads-page__empty">
            <p>No leads found</p>
            {#if filterSite || filterStatus}
                <Button variant="ghost" onclick={() => { filterSite = ''; filterStatus = ''; }}>
                    Clear Filters
                </Button>
            {/if}
        </Card>
    {:else}
        <div class="leads-page__table">
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Site</th>
                        <th>Status</th>
                        {#if form}
                            {#each form.fields.slice(0, 4) as field}
                                <th>{field.label}</th>
                            {/each}
                        {/if}
                    </tr>
                </thead>
                <tbody>
                    {#each filteredLeads() as lead}
                        <tr>
                            <td class="leads-page__date">{formatDate(lead.created_at)}</td>
                            <td>
                                <span class="leads-page__site">{getSiteName(lead.siteId)}</span>
                            </td>
                            <td>
                                <select 
                                    class="leads-page__status leads-page__status--{lead.status}"
                                    value={lead.status}
                                    onchange={(e) => handleStatusChange(lead.id, e.currentTarget.value)}
                                >
                                    <option value="new">New</option>
                                    <option value="contacted">Contacted</option>
                                    <option value="qualified">Qualified</option>
                                    <option value="converted">Converted</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </td>
                            {#if form}
                                {#each form.fields.slice(0, 4) as field}
                                    <td>{lead.data[field.name] || '-'}</td>
                                {/each}
                            {/if}
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</div>

<style>
    .leads-page {
        padding: 2rem;
        max-width: 1400px;
        margin: 0 auto;
    }

    .leads-page__header {
        margin-bottom: 1.5rem;
    }

    .leads-page__headerContent {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-top: 0.5rem;
    }

    .leads-page__headerContent h1 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 600;
    }

    .leads-page__count {
        margin: 0.25rem 0 0;
        font-size: 0.875rem;
        color: var(--color-text-secondary, #64748b);
    }

    .leads-page__actions {
        display: flex;
        gap: 0.75rem;
    }

    .leads-page__error {
        padding: 1rem;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 0.5rem;
        color: #dc2626;
        margin-bottom: 1rem;
    }

    .leads-page__success {
        padding: 1rem;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 0.5rem;
        color: #16a34a;
        margin-bottom: 1rem;
    }

    .leads-page__filters {
        display: flex;
        gap: 0.75rem;
        margin-bottom: 1rem;
    }

    .leads-page__filter {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--color-text-secondary, #64748b);
    }

    .leads-page__filter select {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 0.375rem;
        font-size: 0.875rem;
        background: white;
    }

    .leads-page__loading {
        display: flex;
        justify-content: center;
        padding: 4rem;
    }

    .leads-page__empty {
        text-align: center;
        padding: 3rem;
        color: var(--color-text-secondary, #64748b);
    }

    .leads-page__empty p {
        margin: 0 0 1rem;
    }

    .leads-page__table {
        overflow-x: auto;
        background: white;
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 0.75rem;
    }

    .leads-page__table table {
        width: 100%;
        border-collapse: collapse;
    }

    .leads-page__table th,
    .leads-page__table td {
        padding: 0.75rem 1rem;
        text-align: left;
        border-bottom: 1px solid var(--color-border, #e2e8f0);
    }

    .leads-page__table th {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-secondary, #64748b);
        background: var(--color-surface, #f8fafc);
    }

    .leads-page__table td {
        font-size: 0.875rem;
    }

    .leads-page__table tr:last-child td {
        border-bottom: none;
    }

    .leads-page__date {
        white-space: nowrap;
        color: var(--color-text-secondary, #64748b);
        font-size: 0.8125rem;
    }

    .leads-page__site {
        font-size: 0.8125rem;
        background: var(--color-surface, #f1f5f9);
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
    }

    .leads-page__status {
        padding: 0.25rem 0.5rem;
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 0.25rem;
        font-size: 0.75rem;
        background: white;
        cursor: pointer;
    }

    .leads-page__status--new {
        background: #dbeafe;
        border-color: #93c5fd;
        color: #1d4ed8;
    }

    .leads-page__status--contacted {
        background: #fef3c7;
        border-color: #fcd34d;
        color: #b45309;
    }

    .leads-page__status--qualified,
    .leads-page__status--converted {
        background: #dcfce7;
        border-color: #86efac;
        color: #15803d;
    }

    .leads-page__status--archived {
        background: #f1f5f9;
        border-color: #cbd5e1;
        color: #64748b;
    }

    @media (max-width: 768px) {
        .leads-page {
            padding: 1rem;
        }

        .leads-page__headerContent {
            flex-direction: column;
            gap: 1rem;
        }

        .leads-page__filters {
            flex-direction: column;
        }
    }
</style>
