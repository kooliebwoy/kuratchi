# @kuratchi/native

Native desktop adapter for Kuratchi.

This package owns:

- desktop launch orchestration
- the packaged Rust native host and its build scripts
- desktop bridge runtime helpers
- desktop manifest generation and desktop config parsing
- **macOS app bundling** (`.app` and `.dmg` generation)

It intentionally keeps desktop-specific concerns out of `@kuratchi/js`, which remains the Workers-native web framework.

## Quick Start

### Development Mode

```bash
# In your Kuratchi project
kuratchi-native desktop
```

This starts wrangler + the native host for local development.

### Production Build (macOS)

```bash
# Build the .app bundle and .dmg installer
kuratchi-native build
```

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "desktop": "kuratchi-native desktop",
    "build:app": "kuratchi-native build",
    "build:app:no-dmg": "kuratchi-native build --no-dmg"
  }
}
```

**Output:**
- `dist/YourApp.app` - macOS application bundle
- `dist/YourApp.dmg` - Disk image for distribution

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

## macOS App Build

### How It Works

The `kuratchi-native build` command creates a macOS `.app` bundle that:

1. Launches wrangler to run the Worker runtime locally
2. Opens a native window (via the Rust host) pointing to the local server
3. Provides full access to D1, Durable Objects, AI bindings, etc.

### Current Limitations (Linked Mode)

The current build creates a "linked" app that runs wrangler from your **original project directory**. This means:

- ✅ Small app size (~1.5MB DMG)
- ✅ Full Worker runtime with all bindings
- ✅ No complex bundling issues
- ⚠️ Requires the project directory to exist at the build-time path
- ⚠️ Requires Node.js installed on the target machine
- ⚠️ Not suitable for distribution to other users

### For True Production Persistence

To get persistent data across app restarts, configure your `wrangler.jsonc` to use remote resources:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "your-db",
      "database_id": "<real-d1-database-id>"  // from `wrangler d1 list`
    }
  ],
  "ai": {
    "binding": "AI",
    "remote": true
  }
}
```

This gives you:
- Persistent D1 data synced to Cloudflare's edge
- Persistent Durable Object state
- The desktop app becomes a local-first client with cloud sync

### Future: Standalone Distribution

For distributing to end users without requiring the project directory or Node.js, we need:

1. **Bundle node_modules** - Include wrangler and all dependencies (~300MB+)
2. **Or use workerd directly** - Embed the workerd binary and run the pre-bundled worker without wrangler
3. **Code signing** - Sign the app for macOS Gatekeeper

The workerd approach is preferred for size and simplicity but requires solving Node.js compatibility issues in the bundled worker (AsyncLocalStorage, etc.).

## Configuration

### kuratchi.config.ts

```typescript
export default {
  desktop: {
    appName: 'My App',
    bundleId: 'com.example.myapp',
    icon: './assets/icon.png',  // 1024x1024 PNG recommended
  },
};
```

### Requirements

- **Node.js** - Required on the target machine (for wrangler)
- **macOS** - Currently only macOS builds are supported
- **Xcode Command Line Tools** - For `hdiutil` (DMG creation)
