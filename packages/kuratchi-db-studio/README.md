# @kuratchi/db-studio

Reusable database browser component for D1/SQLite admin pages.

## Install

```bash
npm install @kuratchi/db-studio
```

## Usage

```html
<script>
  import DatabaseStudio from '@kuratchi/db-studio/src/lib/db-studio.html';
</script>
```

## Expected props

- `tables`, `activeTable`, `rows`, `columns`, `schema`
- `totalRows`, `page`, `totalPages`
- `sqlQuery`, `sqlResult`, `dbError`
- `baseHref`, `sqlPlaceholder`
- `runQueryAction`, `insertRowAction`, `updateRowAction`, `deleteRowAction`

## Notes

- Built to pair with `@kuratchi/ui` components.
- Ships as HTML source component.