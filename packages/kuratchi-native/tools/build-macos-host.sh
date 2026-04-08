#!/bin/sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PACKAGE_ROOT="$(dirname "$SCRIPT_DIR")"
HOST_SRC="$PACKAGE_ROOT/host/rust/desktop-host"
OUT_DIR="$PACKAGE_ROOT/out/macos-host"

echo "[build-macos-host] Building desktop host for macOS..."

if ! command -v cargo >/dev/null 2>&1; then
  echo "[build-macos-host] Error: Rust/Cargo not found. Install from https://rustup.rs"
  exit 1
fi

mkdir -p "$OUT_DIR"

cd "$HOST_SRC"

ARCH="$(uname -m)"
if [ "$ARCH" = "arm64" ]; then
  TARGET="aarch64-apple-darwin"
else
  TARGET="x86_64-apple-darwin"
fi

echo "[build-macos-host] Target: $TARGET"

cargo build --release --target "$TARGET"

BINARY_PATH="$HOST_SRC/target/$TARGET/release/workerd-desktop-host"

if [ ! -f "$BINARY_PATH" ]; then
  echo "[build-macos-host] Error: Build succeeded but binary not found at $BINARY_PATH"
  exit 1
fi

cp "$BINARY_PATH" "$OUT_DIR/workerd-desktop-host"
chmod +x "$OUT_DIR/workerd-desktop-host"

echo "[build-macos-host] Built -> $OUT_DIR/workerd-desktop-host"
