<script lang="ts">
  import { Users, Plus, Trash2, Mail, Loader2, Search } from 'lucide-svelte';
  import {
    listAudiences,
    createAudience,
    deleteAudience,
    listAudienceContacts,
    addAudienceContact,
    removeAudienceContact,
    type AudienceSummary,
    type AudienceContact
  } from '$lib/api/newsletter.remote';

  const audiencesResource = listAudiences();
  const audiences = $derived(Array.isArray(audiencesResource.current) ? audiencesResource.current : []);

  let showCreateModal = $state(false);
  let newAudienceName = $state('');
  let creating = $state(false);
  let createError = $state<string | null>(null);

  let selectedAudience = $state<AudienceSummary | null>(null);
  let showContactsModal = $state(false);
  let contacts = $state<AudienceContact[]>([]);
  let loadingContacts = $state(false);
  let contactsError = $state<string | null>(null);

  let newContactEmail = $state('');
  let newContactFirstName = $state('');
  let newContactLastName = $state('');
  let addingContact = $state(false);
  let addContactError = $state<string | null>(null);

  let searchQuery = $state('');
  let deletingId = $state<string | null>(null);

  const filteredAudiences = $derived.by(() => {
    if (!searchQuery) return audiences;
    const q = searchQuery.toLowerCase();
    return audiences.filter((a) => a.name.toLowerCase().includes(q));
  });

  async function handleCreateAudience() {
    if (!newAudienceName.trim()) {
      createError = 'Audience name is required';
      return;
    }
    creating = true;
    createError = null;
    try {
      await createAudience({ name: newAudienceName.trim() });
      await audiencesResource.refresh();
      newAudienceName = '';
      showCreateModal = false;
    } catch (err) {
      console.error(err);
      createError = err instanceof Error ? err.message : 'Failed to create audience';
    } finally {
      creating = false;
    }
  }

  async function handleDeleteAudience(id: string) {
    if (!confirm('Delete this audience? This cannot be undone.')) return;
    deletingId = id;
    try {
      await deleteAudience({ audienceId: id });
      await audiencesResource.refresh();
    } finally {
      deletingId = null;
    }
  }

  async function openContactsModal(audience: AudienceSummary) {
    selectedAudience = audience;
    showContactsModal = true;
    loadingContacts = true;
    contactsError = null;
    try {
      const result = await listAudienceContacts({ audienceId: audience.id, limit: 100 });
      contacts = result.contacts;
    } catch (err) {
      console.error(err);
      contactsError = err instanceof Error ? err.message : 'Failed to load contacts';
    } finally {
      loadingContacts = false;
    }
  }

  async function handleAddContact() {
    if (!newContactEmail.trim()) {
      addContactError = 'Email is required';
      return;
    }
    if (!selectedAudience) return;

    addingContact = true;
    addContactError = null;
    try {
      await addAudienceContact({
        audienceId: selectedAudience.id,
        email: newContactEmail.trim(),
        firstName: newContactFirstName.trim() || undefined,
        lastName: newContactLastName.trim() || undefined
      });
      const result = await listAudienceContacts({ audienceId: selectedAudience.id, limit: 100 });
      contacts = result.contacts;
      newContactEmail = '';
      newContactFirstName = '';
      newContactLastName = '';
    } catch (err) {
      console.error(err);
      addContactError = err instanceof Error ? err.message : 'Failed to add contact';
    } finally {
      addingContact = false;
    }
  }

  async function handleRemoveContact(contact: AudienceContact) {
    if (!confirm(`Remove ${contact.email}?`)) return;
    if (!selectedAudience) return;

    try {
      await removeAudienceContact({
        audienceId: selectedAudience.id,
        email: contact.email
      });
      const result = await listAudienceContacts({ audienceId: selectedAudience.id, limit: 100 });
      contacts = result.contacts;
    } catch (err) {
      console.error(err);
    }
  }
</script>

<svelte:head>
  <title>Audiences - Kuratchi Dashboard</title>
</svelte:head>

<!-- Navigation Tabs -->
<div class="border-b border-base-200 bg-base-100">
  <div class="flex gap-0 px-8">
    <a href="/emails/drip" class="tab tab-bordered">
      <span class="font-medium">Drip Campaigns</span>
    </a>
    <a href="/emails/audiences" class="tab tab-active tab-bordered">
      <span class="font-medium">Audiences</span>
    </a>
    <a href="/emails" class="tab tab-bordered">
      <span class="font-medium">Email History</span>
    </a>
  </div>
</div>

<section class="space-y-8 p-8">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <p class="text-xs font-semibold uppercase tracking-wide text-primary/70">Contacts</p>
      <h1 class="text-2xl font-semibold">Audiences</h1>
      <p class="text-sm text-base-content/70">Create and manage contact audiences for your campaigns.</p>
    </div>
    <button class="btn btn-primary btn-sm" onclick={() => (showCreateModal = true)}>
      <Plus class="h-4 w-4" />
      New audience
    </button>
  </div>

  <!-- Stats -->
  <div class="grid gap-4 md:grid-cols-2">
    <div class="rounded-2xl border border-base-200 bg-base-100/80 p-4 shadow-sm">
      <p class="text-sm text-base-content/70">Total audiences</p>
      <div class="mt-2 flex items-center gap-3">
        <span class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Users class="h-5 w-5" />
        </span>
        <span class="text-3xl font-semibold">{audiences.length}</span>
      </div>
    </div>
    <div class="rounded-2xl border border-base-200 bg-base-100/80 p-4 shadow-sm">
      <p class="text-sm text-base-content/70">Total contacts</p>
      <div class="mt-2 flex items-center gap-3">
        <span class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10 text-secondary">
          <Mail class="h-5 w-5" />
        </span>
        <span class="text-3xl font-semibold">
          {audiences.reduce((total, a) => total + (a.subscriberCount ?? 0), 0)}
        </span>
      </div>
    </div>
  </div>

  <!-- Search & List -->
  <div class="space-y-4">
    <div class="form-control">
      <label class="input input-bordered flex items-center gap-2">
        <Search class="h-4 w-4 opacity-50" />
        <input type="text" class="grow" bind:value={searchQuery} placeholder="Search audiences..." />
      </label>
    </div>

    {#if audiencesResource.loading}
      <div class="rounded-2xl border border-base-200 bg-base-100 p-10 text-center shadow-sm">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>
    {:else if filteredAudiences.length === 0}
      <div class="rounded-2xl border border-dashed border-base-300 bg-base-100 p-8 text-center shadow-sm">
        <p class="text-lg font-semibold">No audiences yet</p>
        <p class="text-sm text-base-content/70">Create your first audience to start building contact lists.</p>
        <button class="btn btn-primary btn-sm mt-4" onclick={() => (showCreateModal = true)}>Create audience</button>
      </div>
    {:else}
      <div class="space-y-3">
        {#each filteredAudiences as audience}
          <div class="rounded-2xl border border-base-200 bg-base-100/90 p-6 shadow-sm transition hover:border-primary/40">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="flex-1">
                <h3 class="text-lg font-semibold">{audience.name}</h3>
                <p class="text-sm text-base-content/70">
                  {audience.subscriberCount ?? 0} contact{audience.subscriberCount !== 1 ? 's' : ''}
                </p>
              </div>
              <div class="flex gap-2">
                <button
                  class="btn btn-outline btn-sm"
                  onclick={() => openContactsModal(audience)}
                >
                  <Users class="h-4 w-4" />
                  Manage
                </button>
                <button
                  class="btn btn-ghost btn-sm text-error"
                  onclick={() => handleDeleteAudience(audience.id)}
                  disabled={deletingId === audience.id}
                >
                  {#if deletingId === audience.id}
                    <Loader2 class="h-4 w-4 animate-spin" />
                  {:else}
                    <Trash2 class="h-4 w-4" />
                  {/if}
                  Delete
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</section>

<!-- Create Audience Modal -->
{#if showCreateModal}
  <div class="modal modal-open">
    <div class="modal-box w-full max-w-md">
      <h3 class="text-lg font-semibold">Create new audience</h3>
      <div class="mt-4 space-y-4">
        <label class="input input-bordered flex items-center gap-2">
          <input
            type="text"
            class="grow"
            bind:value={newAudienceName}
            placeholder="Audience name"
            onkeydown={(e) => e.key === 'Enter' && handleCreateAudience()}
          />
        </label>
        {#if createError}
          <div class="alert alert-error alert-sm">
            <span>{createError}</span>
          </div>
        {/if}
      </div>
      <div class="modal-action mt-6">
        <button class="btn btn-ghost" onclick={() => (showCreateModal = false)}>Cancel</button>
        <button class="btn btn-primary" onclick={handleCreateAudience} disabled={creating}>
          {#if creating}
            <Loader2 class="h-4 w-4 animate-spin" />
          {:else}
            Create
          {/if}
        </button>
      </div>
    </div>
    <button class="modal-backdrop" onclick={() => (showCreateModal = false)} aria-label="Close modal"></button>
  </div>
{/if}

<!-- Contacts Modal -->
{#if showContactsModal && selectedAudience}
  <div class="modal modal-open">
    <div class="modal-box w-full max-w-2xl">
      <h3 class="text-lg font-semibold">{selectedAudience.name} - Contacts</h3>

      <!-- Add Contact Form -->
      <div class="mt-4 space-y-3 rounded-lg bg-base-200/30 p-4">
        <p class="text-sm font-semibold">Add contact</p>
        <div class="grid gap-2 md:grid-cols-3">
          <label class="input input-bordered input-sm flex items-center gap-2">
            <input
              type="email"
              class="grow"
              bind:value={newContactEmail}
              placeholder="Email"
              onkeydown={(e) => e.key === 'Enter' && handleAddContact()}
            />
          </label>
          <label class="input input-bordered input-sm flex items-center gap-2">
            <input
              type="text"
              class="grow"
              bind:value={newContactFirstName}
              placeholder="First name"
              onkeydown={(e) => e.key === 'Enter' && handleAddContact()}
            />
          </label>
          <label class="input input-bordered input-sm flex items-center gap-2">
            <input
              type="text"
              class="grow"
              bind:value={newContactLastName}
              placeholder="Last name"
              onkeydown={(e) => e.key === 'Enter' && handleAddContact()}
            />
          </label>
        </div>
        {#if addContactError}
          <div class="alert alert-error alert-sm">
            <span>{addContactError}</span>
          </div>
        {/if}
        <button class="btn btn-primary btn-sm w-full" onclick={handleAddContact} disabled={addingContact}>
          {#if addingContact}
            <Loader2 class="h-4 w-4 animate-spin" />
            Adding...
          {:else}
            Add contact
          {/if}
        </button>
      </div>

      <!-- Contacts List -->
      <div class="mt-4 space-y-2 max-h-96 overflow-y-auto">
        {#if loadingContacts}
          <div class="text-center py-8">
            <span class="loading loading-spinner loading-sm text-primary"></span>
          </div>
        {:else if contactsError}
          <div class="alert alert-error alert-sm">
            <span>{contactsError}</span>
          </div>
        {:else if contacts.length === 0}
          <div class="text-center py-8 text-base-content/70">
            <p class="text-sm">No contacts yet</p>
          </div>
        {:else}
          {#each contacts as contact}
            <div class="flex items-center justify-between rounded-lg bg-base-200/30 p-3">
              <div>
                <p class="text-sm font-medium">{contact.email}</p>
                {#if contact.first_name || contact.last_name}
                  <p class="text-xs text-base-content/60">
                    {contact.first_name} {contact.last_name}
                  </p>
                {/if}
              </div>
              <button
                class="btn btn-ghost btn-xs text-error"
                onclick={() => handleRemoveContact(contact)}
              >
                <Trash2 class="h-3 w-3" />
              </button>
            </div>
          {/each}
        {/if}
      </div>

      <div class="modal-action mt-6">
        <button class="btn btn-ghost" onclick={() => (showContactsModal = false)}>Close</button>
      </div>
    </div>
    <button class="modal-backdrop" onclick={() => (showContactsModal = false)} aria-label="Close modal"></button>
  </div>
{/if}
