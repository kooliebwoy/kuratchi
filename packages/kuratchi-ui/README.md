# @kuratchi/ui

Server-rendered HTML component library for Kuratchi.

## Install

```bash
npm install @kuratchi/ui
```

## Configure in `kuratchi.config.ts`

```ts
import { defineConfig } from '@kuratchi/js';
import { kuratchiUiConfig } from '@kuratchi/ui/adapter';

export default defineConfig({
  ui: kuratchiUiConfig({ theme: 'default' }),
});
```

Tailwind CSS can be enabled through the same adapter:

```ts
import { defineConfig } from '@kuratchi/js';
import { kuratchiUiConfig } from '@kuratchi/ui/adapter';

export default defineConfig({
  ui: kuratchiUiConfig({
    library: 'tailwindcss',
    plugins: ['daisyui', 'forms'],
  }),
});
```

Kuratchi owns the Tailwind CLI build step internally. No Vite or PostCSS setup is required.

## Component usage

```html
<script>
  import Badge from '@kuratchi/ui/badge.html';
  import Card from '@kuratchi/ui/card.html';
  import AuthCard from '@kuratchi/ui/auth-card.html';
  import Alert from '@kuratchi/ui/alert.html';
  import EmptyState from '@kuratchi/ui/empty-state.html';
</script>
```

## Notes

- Components are `.html` templates imported directly into route files.
- Theme CSS is shipped at `src/styles/theme.css`.
