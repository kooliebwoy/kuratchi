<script lang="ts">
  import { Users, Plus, Trash2, Mail, Loader2, Search, X, UserPlus } from '@lucide/svelte';
  import { Button, Card, Dialog, Loading, FormField, Badge } from '@kuratchi/ui';
  import {
    listSegments,
    createSegment,
    deleteSegment,
    listSegmentContacts,
    addSegmentContact,
    removeSegmentContact,
    loadAudienceContacts,
    addContactToSegments,
    type SegmentSummary,
    type SegmentContact,
    type AudienceContact
  } from '$lib/functions/newsletter.remote';

  const segmentsResource = listSegments();
  const segments = $derived(Array.isArray(segmentsResource.current) ? segmentsResource.current : []);

  let showCreateModal = $state(false);
  let newSegmentName = $state('');
  let creating = $state(false);
  let createError = $state<string | null>(null);

  let selectedSegment = $state<SegmentSummary | null>(null);
  let showContactsModal = $state(false);
  let contacts = $state<SegmentContact[]>([]);
  let loadingContacts = $state(false);
  let contactsError = $state<string | null>(null);

  let newContactEmail = $state('');
  let newContactFirstName = $state('');
  let newContactLastName = $state('');
  let addingContact = $state(false);
  let addContactError = $state<string | null>(null);

  let searchQuery = $state('');
  let deletingId = $state<string | null>(null);

  // Add existing contacts state
  let showAddExistingModal = $state(false);
  let audienceContacts = $state<AudienceContact[]>([]);
  let audienceSearchQuery = $state('');
  let loadingAudience = $state(false);
  let selectedContactIds = $state<string[]>([]);
  let addingExistingContacts = $state(false);
  let showNewContactForm = $state(false); // Toggle between existing/new contact modes

  const filteredSegments = $derived.by(() => {
    if (!searchQuery) return segments;
    const q = searchQuery.toLowerCase();
    return segments.filter((s) => s.name.toLowerCase().includes(q));
  });

  async function handleCreateSegment() {
    if (!newSegmentName.trim()) {
      createError = 'Segment name is required';
      return;
    }
    creating = true;
    createError = null;
    try {
      await createSegment({ name: newSegmentName.trim() });
      await segmentsResource.refresh();
      newSegmentName = '';
      showCreateModal = false;
    } catch (err) {
      createError = err instanceof Error ? err.message : 'Failed to create segment';
    } finally {
      creating = false;
    }
  }

  async function handleDeleteSegment(id: string) {
    if (!confirm('Delete this segment? This cannot be undone.')) return;
    deletingId = id;
    try {
      await deleteSegment({ segmentId: id });
      await segmentsResource.refresh();
    } finally {
      deletingId = null;
    }
  }

  async function openContactsModal(segment: SegmentSummary) {
    selectedSegment = segment;
    showContactsModal = true;
    showNewContactForm = false; // Default to existing contacts
    loadingContacts = true;
    contactsError = null;
    selectedContactIds = [];
    audienceSearchQuery = '';
    try {
      const result = await listSegmentContacts({ segmentId: segment.id, limit: 100 });
      contacts = result.contacts;
      // Also load audience contacts for inline selection
      await loadAudienceList();
    } catch (err) {
      contactsError = err instanceof Error ? err.message : 'Failed to load contacts';
    } finally {
      loadingContacts = false;
    }
  }

  async function handleAddContact() {
    if (!newContactEmail.trim() || !selectedSegment) {
      addContactError = 'Email is required';
      return;
    }

    addingContact = true;
    addContactError = null;
    try {
      await addSegmentContact({
        segmentId: selectedSegment.id,
        email: newContactEmail.trim(),
        firstName: newContactFirstName.trim() || undefined,
        lastName: newContactLastName.trim() || undefined
      });
      const result = await listSegmentContacts({ segmentId: selectedSegment.id, limit: 100 });
      contacts = result.contacts;
      newContactEmail = '';
      newContactFirstName = '';
      newContactLastName = '';
      // Switch back to existing contacts view and refresh list
      showNewContactForm = false;
      await loadAudienceList();
      await segmentsResource.refresh();
    } catch (err) {
      addContactError = err instanceof Error ? err.message : 'Failed to add contact';
    } finally {
      addingContact = false;
    }
  }

  async function handleRemoveContact(contact: SegmentContact) {
    if (!selectedSegment) return;
    if (!confirm(`Remove ${contact.email}?`)) return;
    try {
      await removeSegmentContact({ segmentId: selectedSegment.id, email: contact.email });
      contacts = contacts.filter((c) => c.email !== contact.email);
    } catch (err) {
      contactsError = err instanceof Error ? err.message : 'Failed to remove contact';
    }
  }

  // Load audience contacts for selection
  async function loadAudienceList() {
    loadingAudience = true;
    try {
      const result = await loadAudienceContacts({
        limit: 50,
        offset: 0,
        search: audienceSearchQuery || undefined
      });
      // Filter out contacts already in the segment
      const contactEmails = new Set(contacts.map(c => c.email));
      audienceContacts = result.contacts.filter(c => !contactEmails.has(c.email));
    } catch (err) {
      console.error('Failed to load audience:', err);
      audienceContacts = [];
    } finally {
      loadingAudience = false;
    }
  }

  // Handle search in add existing modal
  async function handleAudienceSearch() {
    await loadAudienceList();
  }

  // Add selected existing contacts to segment
  async function handleAddExistingContacts() {
    if (!selectedSegment || selectedContactIds.length === 0) return;

    addingExistingContacts = true;
    addContactError = null;
    try {
      // Add all selected contacts to the segment
      for (const contactId of selectedContactIds) {
        await addContactToSegments({
          contactId,
          segmentIds: [selectedSegment.id]
        });
      }

      // Refresh contacts list and audience list
      const result = await listSegmentContacts({ segmentId: selectedSegment.id, limit: 100 });
      contacts = result.contacts;
      await segmentsResource.refresh();
      await loadAudienceList(); // Refresh to remove added contacts from list

      selectedContactIds = [];
    } catch (err) {
      addContactError = err instanceof Error ? err.message : 'Failed to add contacts';
    } finally {
      addingExistingContacts = false;
    }
  }

  // Toggle contact selection
  function toggleContactSelection(contactId: string) {
    if (selectedContactIds.includes(contactId)) {
      selectedContactIds = selectedContactIds.filter(id => id !== contactId);
    } else {
      selectedContactIds = [...selectedContactIds, contactId];
    }
  }
</script>

<svelte:head>
  <title>Segments - Kuratchi Dashboard</title>
</svelte:head>

<div class="kui-segments">
  <div class="kui-segments__header">
    <div>
      <h2>Segments</h2>
      <p class="kui-segments__subtitle">Organize contacts into reusable audiences</p>
    </div>
    <Button variant="primary" onclick={() => (showCreateModal = true)}>
      <Plus class="kui-icon" />
      New Segment
    </Button>
  </div>

  {#if segmentsResource.loading}
    <div class="kui-center"><Loading size="md" /></div>
  {:else if segments.length === 0}
    <div class="kui-empty">
      <Users class="kui-empty__icon" />
      <p class="kui-empty__text">No segments yet</p>
      <p class="kui-empty__subtext">Create your first segment to organize contacts</p>
    </div>
  {:else}
    <div class="kui-search-box">
      <Search class="kui-search-icon" />
      <input type="text" class="kui-search-input" placeholder="Search segments..." bind:value={searchQuery} />
    </div>

    <div class="kui-list">
      {#each filteredSegments as segment}
        <div class="kui-segment-item">
          <div class="kui-segment-item__content">
            <h3 class="kui-segment-item__name">{segment.name}</h3>
            <p class="kui-segment-item__count">{segment.subscriberCount || 0} contacts</p>
          </div>
          <div class="kui-segment-item__actions">
            <Button variant="neutral" size="sm" onclick={() => openContactsModal(segment)}>
              <Mail class="kui-icon" />
            </Button>
            <Button variant="ghost" size="sm" onclick={() => handleDeleteSegment(segment.id)} disabled={deletingId === segment.id}>
              {#if deletingId === segment.id}
                <Loader2 class="kui-icon spinning" />
              {:else}
                <Trash2 class="kui-icon" />
              {/if}
            </Button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if showCreateModal}
  <Dialog bind:open={showCreateModal} size="sm" onClose={() => { showCreateModal = false; createError = null; }}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3>Create segment</h3>
        <Button variant="ghost" size="xs" onclick={() => { showCreateModal = false; createError = null; }}>
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="kui-stack">
        <FormField label="Segment name">
          <input 
            type="text" 
            class="kui-input" 
            placeholder="Customers" 
            bind:value={newSegmentName}
          />
        </FormField>
        {#if createError}
          <div class="kui-callout error">{createError}</div>
        {/if}
        <div class="kui-modal-actions">
          <Button variant="ghost" onclick={() => { showCreateModal = false; createError = null; }}>Cancel</Button>
          <Button variant="primary" onclick={handleCreateSegment} disabled={creating}>
            {#if creating}
              <Loading size="sm" /> Creating...
            {:else}
              Create Segment
            {/if}
          </Button>
        </div>
      </div>
    {/snippet}
  </Dialog>
{/if}

{#if showContactsModal && selectedSegment}
  <Dialog bind:open={showContactsModal} size="lg" onClose={() => { showContactsModal = false; selectedSegment = null; }}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3>Contacts in {selectedSegment.name}</h3>
        <Button variant="ghost" size="xs" onclick={() => { showContactsModal = false; selectedSegment = null; }}>
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="kui-stack">
        {#if loadingContacts}
          <div class="kui-center"><Loading size="md" /></div>
        {:else}
          {#if contactsError}
            <div class="kui-callout error">{contactsError}</div>
          {:else}
            <div class="kui-segment-contacts">
              {#if contacts.length > 0}
                <div class="kui-table-scroll">
                  <table class="kui-table">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Name</th>
                        <th class="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each contacts as contact}
                        <tr>
                          <td>{contact.email}</td>
                          <td>{contact.first_name} {contact.last_name}</td>
                          <td class="text-right">
                            <Button variant="ghost" size="xs" onclick={() => handleRemoveContact(contact)}>
                              <Trash2 class="kui-icon error" />
                            </Button>
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {:else}
                <p class="kui-subtext">No contacts yet.</p>
              {/if}
            </div>
          {/if}
        {/if}

        <div class="kui-divider">Add Contacts</div>
        
        <!-- Tab toggle for add mode -->
        <div class="kui-add-tabs">
          <button 
            class="kui-add-tab" 
            class:active={!showNewContactForm}
            onclick={() => showNewContactForm = false}
          >
            <Users class="kui-icon" /> Existing Contacts
          </button>
          <button 
            class="kui-add-tab" 
            class:active={showNewContactForm}
            onclick={() => showNewContactForm = true}
          >
            <UserPlus class="kui-icon" /> New Contact
          </button>
        </div>

        {#if showNewContactForm}
          <!-- Add New Contact Form -->
          <div class="kui-new-contact-form">
            <p class="kui-form-hint">Create a new contact and add them to this segment. They'll also be added to your audience.</p>
            <div class="kui-grid">
              <FormField label="Email">
                <input 
                  type="email" 
                  class="kui-input" 
                  placeholder="user@example.com" 
                  bind:value={newContactEmail}
                />
              </FormField>
              <FormField label="First Name (optional)">
                <input 
                  type="text" 
                  class="kui-input" 
                  bind:value={newContactFirstName}
                />
              </FormField>
              <FormField label="Last Name (optional)">
                <input 
                  type="text" 
                  class="kui-input" 
                  bind:value={newContactLastName}
                />
              </FormField>
            </div>
            {#if addContactError}
              <div class="kui-callout error">{addContactError}</div>
            {/if}
            <div class="kui-inline end">
              <Button variant="primary" size="sm" onclick={handleAddContact} disabled={addingContact}>
                {#if addingContact}
                  <Loading size="sm" /> Adding...
                {:else}
                  <UserPlus class="kui-icon" /> Add to Segment & Audience
                {/if}
              </Button>
            </div>
          </div>
        {:else}
          <!-- Select from Existing Contacts -->
          <div class="kui-existing-contacts">
            <div class="kui-search-box-inline">
              <Search class="kui-search-icon" />
              <input 
                type="text" 
                class="kui-search-input" 
                placeholder="Search by email..." 
                bind:value={audienceSearchQuery}
                onkeydown={(e) => e.key === 'Enter' && handleAudienceSearch()}
              />
              <Button variant="ghost" size="sm" onclick={handleAudienceSearch}>
                Search
              </Button>
            </div>

            {#if loadingAudience}
              <div class="kui-center-sm"><Loading size="sm" /></div>
            {:else if audienceContacts.length === 0}
              <p class="kui-subtext">No contacts found. Try searching or add a new contact.</p>
            {:else}
              <div class="kui-contact-list">
                {#each audienceContacts as contact}
                  <label class="kui-contact-checkbox" class:selected={selectedContactIds.includes(contact.id)}>
                    <input 
                      type="checkbox" 
                      checked={selectedContactIds.includes(contact.id)}
                      onchange={() => toggleContactSelection(contact.id)}
                    />
                    <div class="kui-contact-info">
                      <span class="kui-contact-email">{contact.email}</span>
                      {#if contact.first_name || contact.last_name}
                        <span class="kui-contact-name">{contact.first_name} {contact.last_name}</span>
                      {/if}
                    </div>
                  </label>
                {/each}
              </div>
            {/if}

            {#if selectedContactIds.length > 0}
              <div class="kui-inline end">
                <Button variant="primary" size="sm" onclick={handleAddExistingContacts} disabled={addingExistingContacts}>
                  {#if addingExistingContacts}
                    <Loading size="sm" /> Adding...
                  {:else}
                    <Plus class="kui-icon" /> Add {selectedContactIds.length} Contact{selectedContactIds.length !== 1 ? 's' : ''}
                  {/if}
                </Button>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/snippet}
  </Dialog>
{/if}

<style>
  .kui-segments {
    display: grid;
    gap: 1.5rem;
  }

  .kui-segments__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .kui-segments__header h2 {
    margin: 0 0 0.25rem 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .kui-segments__subtitle {
    margin: 0;
    font-size: 0.9rem;
    color: var(--kui-color-muted);
  }

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

  .kui-search-box {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 1rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    background: var(--kui-color-surface);
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

  .kui-list {
    display: grid;
    gap: 0.75rem;
  }

  .kui-segment-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem;
    background: var(--kui-color-surface);
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    transition: all 150ms ease;
  }

  .kui-segment-item:hover {
    border-color: var(--kui-color-primary);
    box-shadow: var(--kui-shadow-xs);
  }

  .kui-segment-item__content {
    flex: 1;
    min-width: 0;
  }

  .kui-segment-item__name {
    margin: 0 0 0.25rem 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--kui-color-text);
  }

  .kui-segment-item__count {
    margin: 0;
    font-size: 0.85rem;
    color: var(--kui-color-muted);
  }

  .kui-segment-item__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .kui-center {
    display: grid;
    place-items: center;
    min-height: 200px;
    gap: 1rem;
    text-align: center;
  }

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

  .kui-modal-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .kui-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }

  .kui-segment-contacts {
    display: grid;
    gap: 1rem;
  }

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

  .kui-table .text-right {
    text-align: right;
  }

  .kui-divider {
    text-align: center;
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--kui-color-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 1rem 0;
    border-top: 1px solid var(--kui-color-border);
    border-bottom: 1px solid var(--kui-color-border);
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

  .kui-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .kui-inline.end {
    justify-content: flex-end;
  }

  .kui-add-tabs {
    display: flex;
    gap: 0.5rem;
    border-bottom: 1px solid var(--kui-color-border);
    margin-bottom: 1rem;
  }

  .kui-add-tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--kui-color-muted);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .kui-add-tab:hover {
    color: var(--kui-color-text);
  }

  .kui-add-tab.active {
    color: var(--kui-color-primary);
    border-bottom-color: var(--kui-color-primary);
  }

  .kui-new-contact-form,
  .kui-existing-contacts {
    display: grid;
    gap: 1rem;
  }

  .kui-form-hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--kui-color-muted);
    padding: 0.75rem;
    background: var(--kui-color-surface-muted);
    border-radius: var(--kui-radius-md);
  }

  .kui-search-box-inline {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 1rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    background: var(--kui-color-surface);
  }

  .kui-add-buttons {
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .kui-contact-list {
    display: grid;
    gap: 0.5rem;
    max-height: 300px;
    overflow-y: auto;
    padding: 0.5rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
  }

  .kui-contact-checkbox {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem;
    border-radius: var(--kui-radius-sm);
    cursor: pointer;
    transition: background-color 150ms ease;
  }

  .kui-contact-checkbox:hover {
    background: var(--kui-color-surface-muted);
  }

  .kui-contact-checkbox.selected {
    background: rgba(59, 130, 246, 0.08);
  }

  .kui-contact-checkbox input[type="checkbox"] {
    margin: 0;
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  .kui-contact-checkbox .kui-contact-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .kui-contact-checkbox .kui-contact-email {
    font-weight: 500;
    color: var(--kui-color-text);
  }

  .kui-contact-checkbox .kui-contact-name {
    font-size: 0.85rem;
    color: var(--kui-color-muted);
  }

  .kui-selection-info {
    margin: 0;
    font-size: 0.85rem;
    color: var(--kui-color-primary);
    font-weight: 500;
    text-align: center;
  }

  .kui-center-sm {
    display: grid;
    place-items: center;
    min-height: 100px;
    gap: 1rem;
  }

  .kui-icon {
    width: 1rem;
    height: 1rem;
  }

  .kui-icon.spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 768px) {
    .kui-segment-item {
      flex-direction: column;
      align-items: flex-start;
    }

    .kui-segment-item__actions {
      width: 100%;
      justify-content: flex-start;
    }

    .kui-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
