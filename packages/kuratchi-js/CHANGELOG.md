# @kuratchi/js

## 0.0.10

### Patch Changes

- Publish latest framework and ORM for LLM docs compatibility

## 0.0.9

### Patch Changes

- Add `@kuratchi/js/environment` with a compile-time `dev` flag for server route scripts and reject it in client reactive scripts.

## 0.0.8

### Patch Changes

- Keep compiler code out of the root runtime entry so Worker bundles do not pull in Node-only build tooling.

## 0.0.7

### Patch Changes

- Remove the internal global Cloudflare env bridge and keep request env scoped to framework runtime context.

## 0.0.6

### Patch Changes

- Allow Cloudflare env access in route top-level server scripts while continuing to block env access in client and component scripts.
