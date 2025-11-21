# Database Platform Overview

Kuratchi's database stack combines Durable Objects (DOs), D1, and a JSON-schema driven ORM so every organization receives its own logical database with identical guarantees. The `database` namespace exposes the entire control plane:

- **KuratchiDatabase orchestrator** – provisions databases, deploys/updates the DO worker, waits for readiness, and wires credentials.
- **Runtime clients** – HTTP + KV clients, the typed ORM, and direct SQL helpers that all talk to the DO worker through signed requests.
- **Migration engine** – snapshot-based SQL generation (`kuratchi-sdk generate-migrations`) plus a runtime runner that loads bundled migrations and tracks history inside every database.
- **Admin helpers** – bootstrap and query the shared admin database so you can keep per-org metadata (name, slug, API tokens, schema tags, etc.).

Why the split? It lets you:

1. Deploy changes to the DO worker independently of your SvelteKit routes.
2. Generate repeatable migrations in CI/CD and ship them with your Worker bundle.
3. Scale to thousands of orgs without giving each one a dedicated DO – a single worker multiplexes logical databases, while tokens + gateway keys isolate access.

The remaining pages walk through environment setup, provisioning, client usage, migrations, and day‑2 operations.
