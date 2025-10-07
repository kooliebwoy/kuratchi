<script lang="ts">
  import type { UserInsight } from '$lib/data/dashboard';

  export let users: UserInsight[];
</script>

<div class="card border border-base-200 bg-base-200/30">
  <div class="card-body gap-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold">User Directory</h3>
        <p class="text-xs text-base-content/60">Federated across organizations with org-aware permissions</p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm">Invite User</button>
        <button class="btn btn-primary btn-sm text-primary-content">Create Role</button>
      </div>
    </div>
    <div class="overflow-hidden rounded-xl border border-base-200/60">
      <table class="table">
        <thead class="bg-base-200/50 text-xs uppercase tracking-widest text-base-content/40">
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Organization</th>
            <th>Role</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {#each users as user}
            <tr>
              <td>
                <div class="flex items-center gap-3">
                  <div class="h-8 w-8 rounded-full bg-primary/20 text-center text-xs font-semibold leading-8 text-primary">
                    {user.avatar}
                  </div>
                  <span class="font-medium">{user.name}</span>
                </div>
              </td>
              <td>{user.email}</td>
              <td>Orbit Suite</td>
              <td>
                <span class="badge badge-outline badge-sm text-primary">{user.role}</span>
              </td>
              <td>
                <span class="badge badge-success badge-sm">Active</span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
