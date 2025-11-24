<script lang="ts">
  import { onMount } from 'svelte';
  import { Users, Plus, Trash2, Mail, Loader2, Search, X, Edit, UserMinus, UserPlus, BarChart3, TrendingUp, Calendar } from '@lucide/svelte';
  import { Button, Card, Dialog, Loading, FormField, FormInput, Badge } from '@kuratchi/ui';
  import {
    listAudienceContacts,
    loadAudienceContacts,
    addAudienceContact,
    updateAudienceContact,
    deleteAudienceContact,
    addContactToSegments,
    removeContactFromSegments,
    getAudienceStats,
    type AudienceContact,
    type AudienceStats
  } from '$lib/functions/newsletter.remote';
  import { listSegments, type SegmentSummary } from '$lib/functions/newsletter.remote';

  // Data resources
  const contactsResource = listAudienceContacts();
  const statsResource = getAudienceStats();
  const segmentsResource = listSegments();

  // Local contacts state
  let contactsData = $state<{ contacts: AudienceContact[]; total: number; hasMore: boolean }>({
    contacts: [],
    total: 0,
    hasMore: false
  });

  const contacts = $derived(contactsData.contacts);
  const totalContacts = $derived(contactsData.total);
  const hasMore = $derived(contactsData.hasMore);
  const stats = $derived(statsResource.current || {
    totalContacts: 0,
    activeContacts: 0,
    unsubscribedContacts: 0,
    segmentsCount: 0,
    avgContactsPerSegment: 0,
    recentGrowth: {
      newThisWeek: 0,
      newThisMonth: 0
    }
  });
  const segments = $derived(Array.isArray(segmentsResource.current) ? segmentsResource.current : []);

  // UI state
  let searchQuery = $state('');
  let currentPage = $state(0);
  const pageSize = 25;
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Modal states
  let showAddModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let showSegmentsModal = $state(false);

  // Form states
  let newContactEmail = $state('');
  let newContactFirstName = $state('');
  let newContactLastName = $state('');
  let selectedSegments = $state<string[]>([]);
  let submitting = $state(false);
  let formError = $state<string | null>(null);

  // Selected contact for actions
  let selectedContact = $state<AudienceContact | null>(null);

  // Load contacts with pagination and search
  async function loadContacts(reset = false) {
    if (reset) {
      currentPage = 0;
    }
    
    loading = true;
    error = null;
    
    try {
      const offset = reset ? 0 : currentPage * pageSize;
      const result = await loadAudienceContacts({
        limit: pageSize,
        offset,
        search: searchQuery || undefined
      });
      contactsData = result;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load contacts';
    } finally {
      loading = false;
    }
  }

  // Search handler
  async function handleSearch() {
    await loadContacts(true);
  }

  // Pagination handlers
  async function loadNextPage() {
    if (hasMore && !loading) {
      currentPage++;
      await loadContacts();
    }
  }

  async function loadPrevPage() {
    if (currentPage > 0 && !loading) {
      currentPage--;
      await loadContacts();
    }
  }

  // Add contact handler
  async function handleAddContact() {
    if (!newContactEmail.trim()) {
      formError = 'Email is required';
      return;
    }

    submitting = true;
    formError = null;
    
    try {
      await addAudienceContact({
        email: newContactEmail.trim(),
        firstName: newContactFirstName.trim() || undefined,
        lastName: newContactLastName.trim() || undefined,
        segmentIds: selectedSegments.length > 0 ? selectedSegments : undefined
      });
      
      // Reset form
      newContactEmail = '';
      newContactFirstName = '';
      newContactLastName = '';
      selectedSegments = [];
      showAddModal = false;
      
      // Reload contacts
      await loadContacts(true);
      await statsResource.refresh();
    } catch (err) {
      formError = err instanceof Error ? err.message : 'Failed to add contact';
    } finally {
      submitting = false;
    }
  }

  // Edit contact handler
  async function handleEditContact() {
    if (!selectedContact) return;

    submitting = true;
    formError = null;
    
    try {
      await updateAudienceContact({
        contactId: selectedContact.id,
        firstName: newContactFirstName.trim() || undefined,
        lastName: newContactLastName.trim() || undefined,
        unsubscribed: selectedContact.unsubscribed
      });
      
      showEditModal = false;
      selectedContact = null;
      await loadContacts(true);
      await statsResource.refresh();
    } catch (err) {
      formError = err instanceof Error ? err.message : 'Failed to update contact';
    } finally {
      submitting = false;
    }
  }

  // Delete contact handler
  async function handleDeleteContact() {
    if (!selectedContact) return;

    submitting = true;
    
    try {
      await deleteAudienceContact({ contactId: selectedContact.id });
      showDeleteModal = false;
      selectedContact = null;
      await loadContacts(true);
      await statsResource.refresh();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to delete contact';
    } finally {
      submitting = false;
    }
  }

  // Open edit modal
  function openEditModal(contact: AudienceContact) {
    selectedContact = contact;
    newContactFirstName = contact.first_name || '';
    newContactLastName = contact.last_name || '';
    showEditModal = true;
    formError = null;
  }

  // Open delete modal
  function openDeleteModal(contact: AudienceContact) {
    selectedContact = contact;
    showDeleteModal = true;
  }

  // Toggle subscription status
  async function toggleSubscription(contact: AudienceContact) {
    try {
      await updateAudienceContact({
        contactId: contact.id,
        unsubscribed: !contact.unsubscribed
      });
      await loadContacts(true);
      await statsResource.refresh();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to update subscription';
    }
  }

  // Format date
  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString();
  }

  // Initial load
  onMount(async () => {
    await loadContacts(true);
  });

</script>

<svelte:head>
  <title>Audience - Kuratchi Dashboard</title>
</svelte:head>

<div class="kui-audience">
  <!-- Header with Stats -->
  <div class="kui-audience__header">
    <div>
      <h2>Audience</h2>
      <p class="kui-audience__subtitle">Manage your email subscribers and contacts</p>
    </div>
    <Button variant="primary" onclick={() => (showAddModal = true)}>
      <Plus class="kui-icon" />
      Add Contact
    </Button>
  </div>

  <!-- Stats Cards -->
  <div class="kui-stats-grid">
    <div class="kui-stat-card">
      <div class="kui-stat-icon">
        <Users />
      </div>
      <div class="kui-stat-content">
        <h3>{stats.totalContacts.toLocaleString()}</h3>
        <p>Total Contacts</p>
      </div>
    </div>

    <div class="kui-stat-card">
      <div class="kui-stat-icon kui-stat-icon--active">
        <Mail />
      </div>
      <div class="kui-stat-content">
        <h3>{stats.activeContacts.toLocaleString()}</h3>
        <p>Active Subscribers</p>
      </div>
    </div>

    <div class="kui-stat-card">
      <div class="kui-stat-icon kui-stat-icon--unsubscribed">
        <UserMinus />
      </div>
      <div class="kui-stat-content">
        <h3>{stats.unsubscribedContacts.toLocaleString()}</h3>
        <p>Unsubscribed</p>
      </div>
    </div>

    <div class="kui-stat-card">
      <div class="kui-stat-icon kui-stat-icon--growth">
        <TrendingUp />
      </div>
      <div class="kui-stat-content">
        <h3>+{stats.recentGrowth.newThisWeek}</h3>
        <p>New This Week</p>
      </div>
    </div>
  </div>

  <!-- Search and Filters -->
  <div class="kui-controls">
    <div class="kui-search-box">
      <Search class="kui-search-icon" />
      <input 
        type="text" 
        class="kui-search-input" 
        placeholder="Search contacts by email..." 
        bind:value={searchQuery}
        onkeydown={(e) => e.key === 'Enter' && handleSearch()}
      />
      <Button variant="ghost" size="sm" onclick={handleSearch}>
        Search
      </Button>
    </div>

    <div class="kui-pagination-info">
      {#if loading}
        <Loading size="sm" />
      {:else}
        <span class="kui-text-muted">
          Showing {contacts.length} of {totalContacts.toLocaleString()} contacts
        </span>
      {/if}
    </div>
  </div>

  <!-- Error Display -->
  {#if error}
    <div class="kui-callout error">{error}</div>
  {/if}

  <!-- Contacts Table -->
  {#if loading && contacts.length === 0}
    <div class="kui-center"><Loading size="md" /></div>
  {:else if contacts.length === 0}
    <div class="kui-empty">
      <Users class="kui-empty__icon" />
      <p class="kui-empty__text">No contacts found</p>
      <p class="kui-empty__subtext">Add your first contact to get started</p>
    </div>
  {:else}
    <div class="kui-table-scroll">
      <table class="kui-table">
        <thead>
          <tr>
            <th>Contact</th>
            <th>Segments</th>
            <th>Status</th>
            <th>Added</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each contacts as contact}
            <tr class:unsubscribed={contact.unsubscribed}>
              <td>
                <div class="kui-contact-info">
                  <div class="kui-contact-email">{contact.email}</div>
                  {#if contact.first_name || contact.last_name}
                    <div class="kui-contact-name">
                      {contact.first_name} {contact.last_name}
                    </div>
                  {/if}
                </div>
              </td>
              <td>
                {#if contact.segments.length > 0}
                  <div class="kui-segments-list">
                    {#each contact.segments.slice(0, 2) as segment}
                      <Badge variant="neutral" size="sm">{segment}</Badge>
                    {/each}
                    {#if contact.segments.length > 2}
                      <Badge variant="neutral" size="sm">+{contact.segments.length - 2}</Badge>
                    {/if}
                  </div>
                {:else}
                  <span class="kui-text-muted">No segments</span>
                {/if}
              </td>
              <td>
                <Badge variant={contact.unsubscribed ? 'error' : 'success'} size="sm">
                  {contact.unsubscribed ? 'Unsubscribed' : 'Active'}
                </Badge>
              </td>
              <td>
                <span class="kui-text-muted">{formatDate(contact.created_at)}</span>
              </td>
              <td class="text-right">
                <div class="kui-actions">
                  <Button 
                    variant="ghost" 
                    size="xs" 
                    onclick={() => toggleSubscription(contact)}
                    title={contact.unsubscribed ? 'Resubscribe' : 'Unsubscribe'}
                  >
                    {#if contact.unsubscribed}
                      <UserPlus class="kui-icon" />
                    {:else}
                      <UserMinus class="kui-icon" />
                    {/if}
                  </Button>
                  <Button variant="ghost" size="xs" onclick={() => openEditModal(contact)} title="Edit">
                    <Edit class="kui-icon" />
                  </Button>
                  <Button variant="ghost" size="xs" onclick={() => openDeleteModal(contact)} title="Delete">
                    <Trash2 class="kui-icon error" />
                  </Button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="kui-pagination">
      <Button 
        variant="neutral" 
        onclick={loadPrevPage} 
        disabled={currentPage === 0 || loading}
      >
        Previous
      </Button>
      <span class="kui-page-info">
        Page {currentPage + 1}
      </span>
      <Button 
        variant="neutral" 
        onclick={loadNextPage} 
        disabled={!hasMore || loading}
      >
        Next
      </Button>
    </div>
  {/if}
</div>

<!-- Add Contact Modal -->
{#if showAddModal}
  <Dialog bind:open={showAddModal} size="sm" onClose={() => { showAddModal = false; formError = null; }}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3>Add Contact</h3>
        <Button variant="ghost" size="xs" onclick={() => { showAddModal = false; formError = null; }}>
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="kui-stack">
        <FormField label="Email">
          <FormInput field={{ name: 'email', bind: { value: newContactEmail } } as any} placeholder="user@example.com" />
        </FormField>
        <div class="kui-grid">
          <FormField label="First Name (optional)">
            <FormInput field={{ name: 'firstName', bind: { value: newContactFirstName } } as any} />
          </FormField>
          <FormField label="Last Name (optional)">
            <FormInput field={{ name: 'lastName', bind: { value: newContactLastName } } as any} />
          </FormField>
        </div>
        
        {#if segments.length > 0}
          <FormField label="Segments">
            <div class="kui-segment-selector">
              {#each segments as segment}
                <label class="kui-checkbox-label">
                  <input 
                    type="checkbox" 
                    bind:group={selectedSegments} 
                    value={segment.id}
                  />
                  <span>{segment.name}</span>
                </label>
              {/each}
            </div>
          </FormField>
        {/if}

        {#if formError}
          <div class="kui-callout error">{formError}</div>
        {/if}

        <div class="kui-modal-actions">
          <Button variant="ghost" onclick={() => { showAddModal = false; formError = null; }}>Cancel</Button>
          <Button variant="primary" onclick={handleAddContact} disabled={submitting}>
            {#if submitting}
              <Loading size="sm" /> Adding...
            {:else}
              Add Contact
            {/if}
          </Button>
        </div>
      </div>
    {/snippet}
  </Dialog>
{/if}

<!-- Edit Contact Modal -->
{#if showEditModal && selectedContact}
  <Dialog bind:open={showEditModal} size="sm" onClose={() => { showEditModal = false; selectedContact = null; }}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3>Edit Contact</h3>
        <Button variant="ghost" size="xs" onclick={() => { showEditModal = false; selectedContact = null; }}>
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="kui-stack">
        <div class="kui-contact-summary">
          <strong>{selectedContact.email}</strong>
        </div>
        
        <div class="kui-grid">
          <FormField label="First Name">
            <FormInput field={{ name: 'firstName', bind: { value: newContactFirstName } } as any} />
          </FormField>
          <FormField label="Last Name">
            <FormInput field={{ name: 'lastName', bind: { value: newContactLastName } } as any} />
          </FormField>
        </div>

        <div class="kui-form-field">
          <label class="kui-checkbox-label">
            <input 
              type="checkbox" 
              bind:checked={selectedContact.unsubscribed}
            />
            <span>Unsubscribed</span>
          </label>
          <p class="kui-field-help">Unsubscribed contacts won't receive emails</p>
        </div>

        {#if formError}
          <div class="kui-callout error">{formError}</div>
        {/if}

        <div class="kui-modal-actions">
          <Button variant="ghost" onclick={() => { showEditModal = false; selectedContact = null; }}>Cancel</Button>
          <Button variant="primary" onclick={handleEditContact} disabled={submitting}>
            {#if submitting}
              <Loading size="sm" /> Saving...
            {:else}
              Save Changes
            {/if}
          </Button>
        </div>
      </div>
    {/snippet}
  </Dialog>
{/if}

<!-- Delete Contact Modal -->
{#if showDeleteModal && selectedContact}
  <Dialog bind:open={showDeleteModal} size="sm" onClose={() => { showDeleteModal = false; selectedContact = null; }}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3>Delete Contact</h3>
        <Button variant="ghost" size="xs" onclick={() => { showDeleteModal = false; selectedContact = null; }}>
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="kui-stack">
        <p>Are you sure you want to delete <strong>{selectedContact.email}</strong>?</p>
        <p class="kui-text-muted">This action cannot be undone. The contact will be removed from all segments.</p>

        <div class="kui-modal-actions">
          <Button variant="ghost" onclick={() => { showDeleteModal = false; selectedContact = null; }}>Cancel</Button>
          <Button variant="error" onclick={handleDeleteContact} disabled={submitting}>
            {#if submitting}
              <Loading size="sm" /> Deleting...
            {:else}
              Delete Contact
            {/if}
          </Button>
        </div>
      </div>
    {/snippet}
  </Dialog>
{/if}

<style>
  .kui-audience {
    display: grid;
    gap: 1.5rem;
  }

  .kui-audience__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .kui-audience__header h2 {
    margin: 0 0 0.25rem 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .kui-audience__subtitle {
    margin: 0;
    font-size: 0.9rem;
    color: var(--kui-color-muted);
  }

  /* Stats Grid */
  .kui-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .kui-stat-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    background: var(--kui-color-surface);
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
  }

  .kui-stat-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--kui-radius-md);
    background: var(--kui-color-primary);
    color: white;
  }

  .kui-stat-icon--active {
    background: var(--kui-color-success);
  }

  .kui-stat-icon--unsubscribed {
    background: var(--kui-color-destructive);
  }

  .kui-stat-icon--growth {
    background: var(--kui-color-warning);
  }

  .kui-stat-content h3 {
    margin: 0 0 0.25rem 0;
    font-size: 1.5rem;
    font-weight: 700;
  }

  .kui-stat-content p {
    margin: 0;
    font-size: 0.85rem;
    color: var(--kui-color-muted);
  }

  /* Controls */
  .kui-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .kui-search-box {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 1rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    background: var(--kui-color-surface);
    flex: 1;
    min-width: 300px;
  }

  .kui-search-icon {
    width: 1rem;
    height: 1rem;
    color: var(--kui-color-muted);
    flex-shrink: 0;
  }

  .kui-search-input {
    border: none;
    outline: none;
    width: 100%;
    background: transparent;
    font-size: 0.9rem;
    color: var(--kui-color-text);
  }

  .kui-search-input::placeholder {
    color: var(--kui-color-muted);
  }

  .kui-pagination-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .kui-text-muted {
    color: var(--kui-color-muted);
    font-size: 0.85rem;
  }

  /* Table */
  .kui-table-scroll {
    overflow: auto;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    background: var(--kui-color-surface);
  }

  .kui-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  .kui-table th,
  .kui-table td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--kui-color-border);
    text-align: left;
  }

  .kui-table thead th {
    background: var(--kui-color-surface-muted);
    font-weight: 600;
    color: var(--kui-color-muted);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .kui-table tbody tr:hover {
    background: var(--kui-color-surface-muted);
  }

  .kui-table tbody tr.unsubscribed {
    opacity: 0.6;
  }

  .kui-table .text-right {
    text-align: right;
  }

  .kui-contact-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .kui-contact-email {
    font-weight: 600;
    color: var(--kui-color-text);
  }

  .kui-contact-name {
    font-size: 0.85rem;
    color: var(--kui-color-muted);
  }

  .kui-segments-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .kui-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.25rem;
  }

  /* Pagination */
  .kui-pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 1rem;
  }

  .kui-page-info {
    font-size: 0.9rem;
    color: var(--kui-color-muted);
  }

  /* Empty State */
  .kui-empty {
    display: grid;
    gap: 0.75rem;
    justify-items: center;
    text-align: center;
    padding: 3rem 1.5rem;
    background: var(--kui-color-surface);
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-lg);
  }

  .kui-empty__icon {
    width: 3rem;
    height: 3rem;
    color: var(--kui-color-muted);
  }

  .kui-empty__text {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--kui-color-text);
  }

  .kui-empty__subtext {
    margin: 0;
    font-size: 0.85rem;
    color: var(--kui-color-muted);
  }

  /* Modal Styles */
  .kui-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .kui-modal-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .kui-stack {
    display: grid;
    gap: 1rem;
  }

  .kui-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }

  .kui-modal-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .kui-contact-summary {
    padding: 0.75rem;
    background: var(--kui-color-surface-muted);
    border-radius: var(--kui-radius-md);
    font-size: 0.9rem;
  }

  .kui-segment-selector {
    display: grid;
    gap: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
    padding: 0.5rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
  }

  .kui-checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: var(--kui-radius-sm);
  }

  .kui-checkbox-label:hover {
    background: var(--kui-color-surface-muted);
  }

  .kui-checkbox-label input[type="checkbox"] {
    margin: 0;
  }

  .kui-form-field {
    display: grid;
    gap: 0.5rem;
  }

  .kui-field-help {
    margin: 0;
    font-size: 0.8rem;
    color: var(--kui-color-muted);
  }

  .kui-callout {
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    padding: 1rem;
    background: var(--kui-color-surface-muted);
    color: var(--kui-color-text);
    font-size: 0.9rem;
  }

  .kui-callout.error {
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.08);
  }

  .kui-center {
    display: grid;
    place-items: center;
    min-height: 200px;
    gap: 1rem;
    text-align: center;
  }

  .kui-icon {
    width: 1rem;
    height: 1rem;
  }

  .kui-icon.error {
    color: var(--kui-color-destructive);
  }

  @media (max-width: 768px) {
    .kui-audience__header {
      flex-direction: column;
      align-items: flex-start;
    }

    .kui-controls {
      flex-direction: column;
      align-items: stretch;
    }

    .kui-search-box {
      min-width: auto;
    }

    .kui-stats-grid {
      grid-template-columns: 1fr;
    }

    .kui-actions {
      flex-direction: column;
      align-items: stretch;
    }

    .kui-grid {
      grid-template-columns: 1fr;
    }
  }
</style>