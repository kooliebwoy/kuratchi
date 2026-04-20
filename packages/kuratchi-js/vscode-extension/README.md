# KuratchiJS Syntax

Syntax highlighting for KuratchiJS `.kuratchi` route files in VS Code-compatible editors (VS Code, Windsurf, Cursor).

## What this adds

- Language id: `kuratchi` (file extension: `.kuratchi`)
- Expression highlighting: `{expr}`, `{@html expr}`, `{@raw expr}`, `{=html expr}`
- Attribute binding: `attr={expr}`, `style={prop}`, bare `{ident}`
- Native JS control flow in template bodies: `for (...) { }`, `if (...) { }`, `} else if (...) { }`, `} else { }`, bare `}` — **multi-line and nested-paren safe** (e.g. `for (const c of xs.filter((x) => x))`)
- Embedded `<script>` → JavaScript grammar
- Embedded `<script lang="ts">` → TypeScript grammar
- Embedded `<style>` → CSS grammar
- Component tags `<my-component attr={expr} />`
- Comment shortcuts (`Ctrl+/`, `Shift+Alt+A`)

## Install

From this directory:

```bash
# Build the VSIX
bunx @vscode/vsce package --no-dependencies

# Install it
code --install-extension ./kuratchi-syntax-0.2.0.vsix
# or for Windsurf/Cursor/etc.:
windsurf --install-extension ./kuratchi-syntax-0.2.0.vsix
```

Then reload the editor (`Ctrl+Shift+P` → `Developer: Reload Window`).

## Development loop

Symlink this folder into your editor's extensions dir:

```bash
# macOS / Linux
ln -s "$(pwd)" ~/.vscode/extensions/kuratchi-syntax

# Windows (PowerShell)
New-Item -ItemType Junction -Path "$env:USERPROFILE\.vscode\extensions\kuratchi-syntax" -Target (Resolve-Path .)
```

Edit `syntaxes/kuratchi.tmLanguage.json` → reload window → changes apply.

## Migration from 0.1.x

0.1.x targeted `.kuratchi.html` and injected file-association defaults for route folders. 0.2.0 targets `.kuratchi` directly — no file associations needed. If you previously had `files.associations` entries forcing `kuratchi-html`, remove them.
