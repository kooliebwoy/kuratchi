# kuratchi Syntax

Syntax highlighting for KuratchiJS `.html` templates in VS Code-compatible editors (including Windsurf).

## What this adds

- kuratchi-specific syntax highlighting (`{expr}`, `{@html expr}`, `{@raw expr}`, `attr={expr}`, `style={prop}`)
- Control-flow highlighting (`for (...) {}`, `if/else` blocks)
- Component-tag highlighting (`<my-component ... />`)
- A real language id: `kuratchi-html`
- Comment shortcuts (`Ctrl+/`, `Shift+Alt+A`) via language configuration

## Install for local development

From `packages/kuratchi-js/vscode-extension`:

```powershell
# Option 1: symlink into extensions (recommended for active development)
New-Item -ItemType Junction -Path "$env:USERPROFILE\.vscode\extensions\kuratchi-syntax" -Target (Resolve-Path .)

# Option 2: build a VSIX and install it
bunx @vscode/vsce package
code --install-extension .\kuratchi-syntax-0.1.0.vsix
```

Then reload Windsurf/VS Code (`Ctrl+Shift+P` -> `Developer: Reload Window`).

## Language association

The extension sets default associations so these files open as `kuratchi-html`:

- `**/src/routes/**/*.html`
- `**/packages/kuratchi-ui/src/lib/**/*.html`

You can confirm in the status bar that the language mode is `kuratchi HTML`.



