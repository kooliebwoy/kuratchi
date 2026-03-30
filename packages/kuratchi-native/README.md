# @kuratchi/native

Native desktop adapter for Kuratchi.

This package owns:

- desktop launch orchestration
- the packaged Rust native host and its build scripts
- desktop bridge runtime helpers
- desktop manifest generation and desktop config parsing

It intentionally keeps desktop-specific concerns out of `@kuratchi/js`, which remains the Workers-native web framework.

## Runtime Boundary

`@kuratchi/native` is the integration layer between:

- `@kuratchi/js`
- Wrangler
- the Rust desktop host embedded in this package

The boundary is:

- Worker execution and Cloudflare bindings stay with Wrangler
- native OS features stay with the Rust host
- desktop helpers exposed to app code live in this package
- application projects should not need a second host repo checkout

## Current Desktop APIs

- `showDesktopNotification()`
- `runDesktopCommand()`

The embedded host also exposes browser-side helpers through `window.__kuratchiDesktop`, currently including:

- `runCommand()`
- `openFile()`
