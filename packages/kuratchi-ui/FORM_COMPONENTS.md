# Form Components for Remote Functions

Reusable form components designed to work seamlessly with SvelteKit's remote functions (`$app/server`).

## Components

### FormField
Wrapper component that provides consistent styling, labels, hints, and error display.

```svelte
<FormField 
  label="Email" 
  issues={form.fields.email.issues()}
  hint="We'll never share your email"
>
  <FormInput field={form.fields.email} type="email" />
</FormField>
```

### FormInput
Input field that automatically spreads remote function field props.

```svelte
<FormInput 
  field={form.fields.name} 
  type="text"
  placeholder="Enter name"
  disabled={false}
/>
```

**Props:**
- `field` - Remote function field (required)
- `type` - Input type: `text`, `email`, `password`, `number`, `url`, `tel` (default: `text`)
- `placeholder` - Placeholder text
- `disabled` - Disable input
- `class` - Additional CSS classes

### FormSelect
Select dropdown for remote functions.

```svelte
<FormSelect field={form.fields.status}>
  <option value="active">Active</option>
  <option value="inactive">Inactive</option>
</FormSelect>
```

### FormTextarea
Textarea field for longer text input.

```svelte
<FormTextarea 
  field={form.fields.description} 
  placeholder="Enter description..."
  rows={4}
/>
```

### FormCheckbox
Checkbox with label.

```svelte
<FormCheckbox 
  field={form.fields.isAdmin} 
  label="Admin User"
/>
```

## Usage Pattern

### 1. Define Remote Function
```typescript
// $lib/api/users.remote.ts
export const createUser = guardedForm(
  v.object({
    name: v.pipe(v.string(), v.nonEmpty()),
    email: v.pipe(v.string(), v.email()),
    role: v.picklist(['admin', 'user']),
    bio: v.optional(v.string()),
    isActive: v.optional(v.boolean())
  }),
  async (data) => {
    // Create user logic
  }
);
```

### 2. Use in Component
```svelte
<script lang="ts">
  import { Dialog, FormField, FormInput, FormSelect, FormTextarea, FormCheckbox } from '@kuratchi/ui';
  import { createUser } from '$lib/api/users.remote';
  
  let showModal = $state(false);
</script>

{#if showModal}
  <Dialog bind:open={showModal}>
    {#snippet header()}
      <h3>Create User</h3>
    {/snippet}
    {#snippet children()}
      <form {...createUser} onsubmit={() => showModal = false} class="space-y-4">
        <FormField label="Name" issues={createUser.fields.name.issues()}>
          <FormInput field={createUser.fields.name} placeholder="John Doe" />
        </FormField>

        <FormField label="Email" issues={createUser.fields.email.issues()}>
          <FormInput field={createUser.fields.email} type="email" />
        </FormField>

        <FormField label="Role" issues={createUser.fields.role.issues()}>
          <FormSelect field={createUser.fields.role}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </FormSelect>
        </FormField>

        <FormField label="Bio" issues={createUser.fields.bio.issues()}>
          <FormTextarea field={createUser.fields.bio} rows={3} />
        </FormField>

        <FormCheckbox field={createUser.fields.isActive} label="Active" />

        <div class="modal-action">
          <button type="button" class="btn" onclick={() => showModal = false}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" 
            aria-busy={!!createUser.pending} 
            disabled={!!createUser.pending}
          >
            Create
          </button>
        </div>
      </form>
    {/snippet}
  </Dialog>
{/if}
```

## Benefits

1. **Automatic Validation**: Field props are spread automatically, including validation attributes
2. **Error Display**: Issues are displayed consistently below each field
3. **Type Safety**: Full TypeScript support with remote function types
4. **Consistent Styling**: DaisyUI classes applied consistently
5. **Reusable**: Use across all forms in your application
6. **Accessible**: Proper labels and ARIA attributes

## Edit Mode Pattern

For edit forms, use a const to reference the correct form:

```svelte
{@const formRef = mode === 'create' ? createUser : updateUser}
<form {...formRef} class="space-y-4">
  {#if mode === 'edit' && editingUser}
    <input type="hidden" name="id" value={editingUser.id} />
  {/if}
  
  <FormField label="Name" issues={formRef.fields.name.issues()}>
    <FormInput field={formRef.fields.name} />
  </FormField>
  
  <!-- More fields -->
</form>
```

## Styling

All components use DaisyUI classes by default. You can extend with additional classes:

```svelte
<FormInput field={form.fields.name} class="input-lg" />
<FormSelect field={form.fields.role} class="select-primary" />
```
