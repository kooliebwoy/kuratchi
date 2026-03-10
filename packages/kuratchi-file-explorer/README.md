# @kuratchi/file-explorer

Reusable object storage explorer component for Kuratchi dashboards.

## Install

```bash
npm install @kuratchi/file-explorer
```

## Usage

```html
<script>
  import FileExplorer from '@kuratchi/file-explorer/file-explorer.html';
</script>
```

## Expected props

- `resourceLabel`, `baseHref`, `downloadBaseHref`, `currentPrefix`
- `directories`, `objects`, `selectedObject`
- `selectedPreview`, `selectedPreviewKind`, `listError`
- `nextCursor`, `uploadAction`, `saveTextAction`, `deleteAction`

## Notes

- Built to pair with `@kuratchi/ui` components.
- Ships as an HTML source component.
