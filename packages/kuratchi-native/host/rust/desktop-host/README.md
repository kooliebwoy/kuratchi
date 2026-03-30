# workerd-desktop-host

Rust native desktop host for Kuratchi desktop mode.

## Responsibility

This binary owns only desktop-native behavior:

- native window creation
- embedded WebView2 bootstrap
- local desktop API server
- command execution
- notifications
- file open dialog

It does **not** own Worker execution or Cloudflare binding semantics. Those remain with Wrangler/workerd.

## CLI Contract

The host is launched with:

- `--manifest <path>`
- `--app-url <url>`
- `--desktop-api-origin <url>`

It also supports a smoke-test command path:

- `--run-command <command>`
- optional `--cwd <path>`
- optional `--timeout-ms <number>`

## Desktop API Surface

Current local HTTP endpoints:

- `GET /health`
- `POST /commands/run`
- `POST /notifications/show`
- `POST /files/open`

## Build

Use `C:\Users\kryst\Documents\workerd-desktop-runtime\tools\build-windows-host.cmd`.

The current build targets the machine's native Windows ARM64 Rust toolchain and emits:

- `C:\Users\kryst\Documents\workerd-desktop-runtime\out\windows-host\workerd-desktop-host.exe`

The build script currently adds a local SDK shim for `windows.lib` because this machine's installed Windows SDK exposes `WindowsApp.lib` but not `windows.lib` directly.

## Architectural Boundary

Kuratchi desktop mode should continue to follow this split:

- `@kuratchi/js`: Workers-native framework
- `@kuratchi/native`: desktop adapter and launch orchestration
- Wrangler/workerd: Worker execution and Cloudflare bindings
- `workerd-desktop-host`: native desktop host
