<script lang="ts">
  import { Bell, Search, Command, UserCircle } from 'lucide-svelte';
  export let workspace: string;
  export let user: { name: string; email: string };
</script>

<header class="flex items-center justify-between border-b border-base-200/60 bg-base-100/60 px-8 py-4 backdrop-blur">
  <div class="flex items-center gap-3">
    <Command class="h-5 w-5" />
    <h2 class="text-lg font-semibold">{workspace}</h2>
  </div>

  <div class="flex items-center gap-3">
    <!-- <label class="input input-bordered flex items-center gap-2 bg-base-200/40">
      <Search class="h-4 w-4 opacity-60" />
      <input class="min-w-[220px] bg-transparent text-sm outline-none" placeholder="Search projects, members, activity" />
    </label> -->

    <button class="btn btn-circle btn-ghost text-base-content/70">
      <Bell class="h-5 w-5" />
    </button>

    <div class="flex items-center gap-3 rounded-xl border border-base-200/80 bg-base-200/40 px-3 py-2">
      <div class="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary">
        <UserCircle class="h-6 w-6" />
      </div>
      <div>
        <p class="text-sm font-medium">{user.name}</p>
        <p class="text-xs text-base-content/50">{user.email}</p>
      </div>
    </div>
  </div>
</header>
