# Changelog

All notable changes to this project will be documented in this file.

## [0.0.2] - 2025-08-26

- Removed legacy D1 clients and references (d1Legacy, v2) from the codebase.
- Admin DB HTTP client now uses the internal router HTTP client (`src/lib/d1/internal-http-client.ts`).
- Updated `KuratchiAuth` to construct the Admin DB client with `dbToken` and `gatewayKey`.
- Added `KURATCHI_GATEWAY_KEY` to `.env.example` and documentation; fallback to `GATEWAY_KEY` may be supported at runtime.
- Cleaned up `Kuratchi.toJSON()` to remove `d1Legacy` label.
- Docs review and updates across `src/docs/` to reflect the modern internal client and env requirements.
- Build packaging validated with `publint`.

### Notes
- Ensure your `kuratchi-d1-internal` router Worker is deployed and accessible on your Workers subdomain.
- Required environment variables for Auth and Admin DB client include: `KURATCHI_AUTH_SECRET`, `CLOUDFLARE_WORKERS_SUBDOMAIN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `KURATCHI_ADMIN_DB_NAME`, `KURATCHI_ADMIN_DB_TOKEN`, `KURATCHI_GATEWAY_KEY`.
