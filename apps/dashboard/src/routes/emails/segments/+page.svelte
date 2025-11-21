<script lang="ts">
  import { Users, Plus, Trash2, Mail, Loader2, Search } from 'lucide-svelte';
  import { Button, Card, Dialog, Loading, FormField, FormInput, Badge } from '@kuratchi/ui';
  import {
    listSegments,
    createSegment,
    deleteSegment,
    listSegmentContacts,
    addSegmentContact,
    removeSegmentContact,
    type SegmentSummary,
    type SegmentContact
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
    loadingContacts = true;
    contactsError = null;
    try {
      const result = await listSegmentContacts({ segmentId: segment.id, limit: 100 });
      contacts = result.contacts;
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
</script>

<svelte:head>
  <title>Segments - Kuratchi Dashboard</title>
</svelte:head>

<div class="kui-segments">
  <nav class="kui-tabs">
    <a href="/emails/drip" class="kui-tab">Drip Campaigns</a>
    <a href="/emails/segments" class="kui-tab is-active">Segments</a>
    <a href="/emails/templates" class="kui-tab">Templates</a>
    <a href="/emails" class="kui-tab">Email History</a>
  </nav>

  <header class="kui-segments__header">
    <div>
      <p class="kui-eyebrow">Audiences</p>
      <h1>Segments</h1>
      <p class="kui-subtext">Organize contacts into reusable audiences.</p>
    </div>
    <Button variant="primary" onclick={() => (showCreateModal = true)}>
      <Plus class="kui-icon" />
      New segment
    </Button>
  </header>

  <Card class="kui-panel">
    <div class="kui-filters">
      <div class="kui-input-group">
        <Search class="kui-icon" />
        <input type="text" class="kui-input" placeholder="Search segments..." bind:value={searchQuery} />
      </div>
    </div>

    {#if segmentsResource.loading}
      <div class="kui-center"><Loading size="md" /></div>
    {:else if filteredSegments.length === 0}
      <div class="kui-center">
        <Users class="kui-empty__icon" />
        <p class="kui-subtext">No segments yet</p>
        <Button variant="primary" size="sm" onclick={() => (showCreateModal = true)}>Create segment</Button>
      </div>
    {:else}
      <div class="kui-grid">
        {#each filteredSegments as segment}
          <Card class="kui-panel">
            <div class="kui-segment-card">
              <div>
                <h3>{segment.name}</h3>
                <p class="kui-subtext">{segment.contactCount || 0} contacts</p>
              </div>
              <div class="kui-inline end">
                <Button variant="outline" size="sm" onclick={() => openContactsModal(segment)}>
                  <Mail class="kui-icon" /> Contacts
                </Button>
                <Button variant="ghost" size="sm" onclick={() => handleDeleteSegment(segment.id)} disabled={deletingId === segment.id}>
                  {#if deletingId === segment.id}
                    <Loader2 class="kui-icon spinning" />
                  {:else}
                    <Trash2 class="kui-icon error" />
                  {/if}
                </Button>
              </div>
            </div>
          </Card>
        {/each}
      </div>
    {/if}
  </Card>
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
          <FormInput field={{ name: 'segmentName', bind: { value: newSegmentName } } as any} placeholder="Customers" />
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
                          <td>{contact.firstName} {contact.lastName}</td>
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

        <div class="kui-divider">Add Contact</div>
        <div class="kui-grid">
          <FormField label="Email">
            <FormInput field={{ name: 'email', bind: { value: newContactEmail } } as any} placeholder="user@example.com" />
          </FormField>
          <FormField label="First Name (optional)">
            <FormInput field={{ name: 'firstName', bind: { value: newContactFirstName } } as any} />
          </FormField>
          <FormField label="Last Name (optional)">
            <FormInput field={{ name: 'lastName', bind: { value: newContactLastName } } as any} />
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
              <Plus class="kui-icon" /> Add Contact
            {/if}
          </Button>
        </div>
      </div>
    {/snippet}
  </Dialog>
{/if}

<style>
  .kui-segments {
    display: grid;
    gap: var(--kui-spacing-md);
  }

  .kui-tabs {
    display: flex;
    gap: 0.75rem;
    border-bottom: 1px solid var(--kui-color-border);
  }

  .kui-tab {
    padding: 0.55rem 0.9rem;
    border-radius: var(--kui-radius-md);
    text-decoration: none;
    color: var(--kui-color-muted);
    border: 1px solid transparent;
  }

  .kui-tab.is-active {
    border-color: var(--kui-color-border);
    background: var(--kui-color-surface);
    color: var(--kui-color-text);
    box-shadow: var(--kui-shadow-xs);
  }

  .kui-segments__header {
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

  .kui-filters {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--kui-spacing-sm);
  }

  .kui-input-group {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    padding: 0.45rem 0.6rem;
    background: var(--kui-color-surface);
  }

  .kui-input {
    border: none;
    outline: none;
    width: 100%;
    background: transparent;
    font-size: 0.95rem;
    color: var(--kui-color-text);
  }

  .kui-list {
    display: grid;
    gap: var(--kui-spacing-sm);
  }

  .kui-grid {
    display: grid;
    gap: var(--kui-spacing-sm);
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .kui-segment-card {
    display: flex;
    justify-content: space-between;
    gap: var(--kui-spacing-md);
    align-items: center;
  }

  .kui-segment-contacts {
    display: grid;
    gap: var(--kui-spacing-sm);
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
  }

  .kui-table th,
  .kui-table td {
    padding: 0.65rem;
    border-bottom: 1px solid var(--kui-color-border);
    text-align: left;
  }

  .kui-table thead th {
    background: var(--kui-color-surface-muted);
    font-weight: 700;
  }

  .kui-divider {
    text-align: center;
    font-weight: 700;
    color: var(--kui-color-muted);
  }

  .kui-callout {
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    padding: var(--kui-spacing-sm);
    background: var(--kui-color-surface);
  }

  .kui-callout.error {
    border-color: color-mix(in srgb, var(--kui-color-error) 40%, var(--kui-color-border) 60%);
    background: rgba(239, 68, 68, 0.08);
  }

  .kui-empty__icon {
    width: 3rem;
    height: 3rem;
    color: var(--kui-color-muted);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
}
</style>
