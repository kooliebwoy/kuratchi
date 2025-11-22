<script lang="ts">
  import { Button, Card, Dialog, FormField, FormInput, Alert } from '@kuratchi/ui';
  import { UserPlus, X } from '@lucide/svelte';
  import { getAllOrganizations, getAllUsers, createSuperadminUser } from '$lib/functions/superadmin.remote';

  const organizationsQuery = getAllOrganizations();
  const usersQuery = getAllUsers();

  let showCreateDialog = $state(false);

  function openCreateDialog() {
    showCreateDialog = true;
  }

  function closeCreateDialog() {
    showCreateDialog = false;
  }</script>

<div class="kui-superadmin">
  <div class="kui-stats">
    {#if organizationsQuery.loading || usersQuery.loading}
      <Card class="kui-stat loading" />
      <Card class="kui-stat loading" />
      <Card class="kui-stat loading" />
    {:else if organizationsQuery.error || usersQuery.error}
      <Card class="kui-stat error">
        <Alert type="error">Failed to load dashboard data</Alert>
      </Card>
    {:else}
      <Card class="kui-stat">
        <p class="kui-subtext">Total organizations</p>
        <p class="kui-number">{organizationsQuery.current?.length || 0}</p>
      </Card>
      <Card class="kui-stat">
        <p class="kui-subtext">Total users</p>
        <p class="kui-number">{usersQuery.current?.length || 0}</p>
      </Card>
      <Card class="kui-stat">
        <p class="kui-subtext">Active superadmins</p>
        <p class="kui-number">
          {usersQuery.current?.filter((u) => u.isSuperAdmin).length || 0}
        </p>
      </Card>
    {/if}
  </div>

  <Card class="kui-actions">
    <div>
      <p class="kui-eyebrow">Superadmin</p>
      <h3>Quick actions</h3>
      <p class="kui-subtext">Manage organizations, users, and invite new administrators.</p>
    </div>
    <div class="kui-inline">
      <Button variant="outline" href="/superadmin/organizations">View organizations</Button>
      <Button variant="outline" href="/superadmin/users">View users</Button>
      <Button variant="primary" onclick={openCreateDialog}>
        <UserPlus class="kui-icon" />
        Create superadmin
      </Button>
    </div>
  </Card>
</div>

{#if showCreateDialog}
  <Dialog bind:open={showCreateDialog} size="md" onClose={closeCreateDialog}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3>Create superadmin</h3>
        <Button variant="ghost" size="xs" onclick={closeCreateDialog} aria-label="Close">
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <form {...createSuperadminUser} class="kui-stack">
        <FormField label="Full name" issues={createSuperadminUser.fields.name.issues()}>
          <FormInput
            field={createSuperadminUser.fields.name}
            placeholder="John Doe"
          />
        </FormField>

        <FormField label="Email" issues={createSuperadminUser.fields.email.issues()}>
          <FormInput
            field={createSuperadminUser.fields.email}
            type="email"
            placeholder="admin@example.com"
          />
        </FormField>

        <FormField
          label="Password"
          issues={createSuperadminUser.fields.password.issues()}
          hint="Minimum 8 characters"
        >
          <FormInput
            field={createSuperadminUser.fields.password}
            type="password"
            placeholder="••••••••"
          />
        </FormField>

        <FormField
          label="Organization Name (Optional)"
          issues={createSuperadminUser.fields.organizationName.issues()}
          hint="Defaults to [Name]'s Workspace"
        >
          <FormInput
            field={createSuperadminUser.fields.organizationName}
            placeholder="Admin Workspace"
          />
        </FormField>

        {#snippet actions(close)}
          <Button variant="ghost" type="button" onclick={close}>Cancel</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!!createSuperadminUser.pending}
          >
            {createSuperadminUser.pending ? 'Creating...' : 'Create superadmin'}
          </Button>
        {/snippet}
      </form>
    {/snippet}
  </Dialog>
{/if}

<style>
  .kui-superadmin {
    display: grid;
    gap: 16px;
  }

  .kui-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }

  .kui-stat {
    padding: 14px;
  }

  .kui-stat.loading {
    min-height: 80px;
    background: linear-gradient(90deg, #f5f5f5 25%, #f0f0f0 50%, #f5f5f5 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s ease infinite;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .kui-number {
    margin: 4px 0 0;
    font-size: 28px;
    font-weight: 700;
  }

  .kui-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px;
  }

  .kui-inline {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  h3 {
    margin: 0 0 4px;
    font-size: 18px;
  }

  .kui-eyebrow {
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #6b7280;
    margin: 0 0 6px;
  }

  .kui-subtext {
    margin: 0;
    color: #6b7280;
  }

  .kui-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .kui-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .kui-icon {
    width: 16px;
    height: 16px;
  }
</style>
