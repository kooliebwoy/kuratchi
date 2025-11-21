# Kuratchi SDK Documentation

This is the in-repo, source-of-truth documentation for the Kuratchi SDK. Every guide mirrors the current exports in `src/lib` and is organized by capability so you can wire the SDK into new or existing SvelteKit apps quickly.

## Navigation

- [Auth](./auth.md) — SvelteKit handle, plugins, and organization-aware helpers.
- [Database](./database.md) — Durable Object database provisioning and clients.
- [ORM](./orm.md) — JSON schema model, queries, includes, and migrations.
- [Storage](./storage.md) — KV, R2, and D1 bindings surfaced through the SDK.
- [Notifications](./notifications.md) — In-app, email, and monitoring alerts.
- [Spaces](./spaces.md) — Real-time chat rooms powered by Durable Objects.
- [Stripe](./stripe.md) — Subscription lifecycle hooks, checkout, and billing data.
- [Kuratchi Cloud](./cloud.md) — Managed platform access with a single API key.
- [CLI](./cli.md) — Provisioning and migration tooling for admin and org databases.

## Prerequisites

- Node.js 18+
- Cloudflare Workers (with D1) deployed for the Kuratchi Durable Object worker
- `.env` containing your auth secret plus any provider keys you choose to enable (see each guide)
- `pnpm run build` or `npm run build` to generate `dist/` before publishing the SDK

## Picking the Right Entry Point

| Goal | Guide to Read |
| --- | --- |
| Add authentication/session handling to SvelteKit | [Auth](./auth.md)
| Provision the admin database and issue org DB tokens | [CLI](./cli.md) → `init-admin-db`
| Query an org DB with type-safe helpers | [Auth](./auth.md) → `locals.kuratchi.orgDatabaseClient()` or [Database](./database.md)
| Use KV/R2/D1 bindings in routes | [Storage](./storage.md)
| Send notifications or platform alerts | [Notifications](./notifications.md)
| Deploy real-time chat spaces | [Spaces](./spaces.md)
| Accept payments and manage subscriptions | [Stripe](./stripe.md)
| Use Kuratchi-managed infrastructure without Cloudflare keys | [Kuratchi Cloud](./cloud.md)

Each guide favors explicit, typed clients over dynamic schema usage and documents only the non-deprecated APIs currently available in `src/lib`.
