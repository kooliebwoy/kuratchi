<script lang="ts">
  import { Button, Card, Dialog, Badge, Alert, Loading } from '@kuratchi/ui';
  import { Users, Trash2, X } from 'lucide-svelte';
  import { getAllUsers, deleteSuperadmin } from '$lib/functions/superadmin.remote';

  const usersQuery = getAllUsers();

  let deleteConfirmEmail = $state<string | null>(null);

  function confirmDelete(email: string) {
    deleteConfirmEmail = email;
  }

  function cancelDelete() {
    deleteConfirmEmail = null;
  }

  function roleBadge(user: any) {
    return user.isSuperAdmin ? { label: 'Superadmin', variant: 'primary' } : { label: 'User', variant: 'outline' };
  }
</script>

<div class="kui-users">
  <header class="kui-users__header">
    <div class="kui-inline">
      <div class="kui-icon-box">
        <Users />
      </div>
      <div>
        <p class="kui-eyebrow">Superadmin</p>
        <h1>Users</h1>
        <p class="kui-subtext">View and manage platform users.</p>
      </div>
    </div>
  </header>

  <Card class="kui-panel">
    {#if usersQuery.loading}
      <div class="kui-center"><Loading /></div>
    {:else}
      <div class="kui-table-scroll">
        <table class="kui-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Organizations</th>
              <th>Status</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#if usersQuery.current && usersQuery.current.length > 0}
              {#each usersQuery.current as user}
                {@const badge = roleBadge(user)}
                <tr>
                  <td class="kui-strong">{user.name}</td>
                  <td class="kui-subtext">{user.email}</td>
                  <td><Badge variant={badge.variant} size="xs">{badge.label}</Badge></td>
                  <td>
                    {#if user.organizations && user.organizations.length > 0}
                      <div class="kui-chip-row">
                        {#each user.organizations as org}
                          <Badge variant="outline" size="xs">{org.name || org.organizationName}</Badge>
                        {/each}
                      </div>
                    {:else}
                      <span class="kui-subtext">No organizations</span>
                    {/if}
                  </td>
                  <td>
                    {#if user.status}
                      <Badge variant="primary" size="xs">Active</Badge>
                    {:else}
                      <Badge variant="outline" size="xs">Suspended</Badge>
                    {/if}
                  </td>
                  <td class="text-right">
                    <Button
                      variant="ghost"
                      size="xs"
                      class="danger"
                      onclick={() => confirmDelete(user.email)}
                      aria-label="Delete superadmin"
                    >
                      <Trash2 class="kui-icon" />
                    </Button>
                  </td>
                </tr>
              {/each}
            {:else}
              <tr>
                <td colspan="6">
                  <div class="kui-empty">
                    <Users class="kui-empty__icon" />
                    <p class="kui-subtext">No users found</p>
                  </div>
                </td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    {/if}
  </Card>
</div>

{#if deleteConfirmEmail}
  {@const isDeleteDialogOpen = !!deleteConfirmEmail}
  <Dialog open={isDeleteDialogOpen} size="sm" onClose={cancelDelete}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3 class="danger-text">Delete superadmin</h3>
        <Button variant="ghost" size="xs" onclick={cancelDelete} aria-label="Close">
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <form {...deleteSuperadmin} class="kui-stack" onsubmit={() => { deleteConfirmEmail = null; }}>
        <input type="hidden" name="email" value={deleteConfirmEmail} />
        
        <Alert type="warning">This action cannot be undone.</Alert>
        
        <p class="kui-subtext">
          Delete the superadmin account for <strong>{deleteConfirmEmail}</strong>?
        </p>
        
        <ul class="kui-list">
          <li>Remove the user from the admin database</li>
          <li>Delete their organization and data</li>
          <li>Remove their organization’s database and worker</li>
        </ul>

        {#snippet actions(close)}
          <Button variant="ghost" type="button" onclick={cancelDelete}>Cancel</Button>
          <Button
            type="submit"
            variant="primary"
            class="danger"
            disabled={!!deleteSuperadmin.pending}
          >
            {deleteSuperadmin.pending ? 'Deleting...' : 'Delete permanently'}
          </Button>
        {/snippet}
      </form>
    {/snippet}
  </Dialog>
{/if}

<style>
  .kui-users {
    display: grid;
    gap: 14px;
  }

  .kui-users__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .kui-inline {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .kui-icon-box {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #fee2e2, #fecdd3);
    color: #b91c1c;
  }

  h1 {
    margin: 0;
    font-size: 26px;
  }

  .kui-eyebrow {
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #6b7280;
    margin: 0 0 6px;
  }

  .kui-subtext {
    color: #6b7280;
    margin: 0;
  }

  .kui-panel {
    padding: 16px;
  }

  .kui-table-scroll {
    overflow: auto;
  }

  .kui-table {
    width: 100%;
    border-collapse: collapse;
  }

  .kui-table th,
  .kui-table td {
    padding: 12px;
    border-bottom: 1px solid #f1f1f3;
    text-align: left;
    vertical-align: middle;
  }

  .kui-table th {
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 13px;
    color: #6b7280;
  }

  .kui-strong {
    font-weight: 600;
  }

  .kui-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .kui-empty {
    padding: 28px 12px;
    display: grid;
    gap: 8px;
    justify-items: center;
  }

  .kui-empty__icon {
    width: 40px;
    height: 40px;
    color: #d4d4d8;
  }

  .kui-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .kui-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .kui-list {
    margin: 0;
    padding-left: 18px;
    color: #b91c1c;
    display: grid;
    gap: 4px;
    font-size: 14px;
  }

  .kui-icon {
    width: 16px;
    height: 16px;
  }

  .danger {
    color: #b91c1c;
    border-color: rgba(239, 68, 68, 0.35);
  }

  .danger-text {
    color: #b91c1c;
    margin: 0;
  }
</style>
