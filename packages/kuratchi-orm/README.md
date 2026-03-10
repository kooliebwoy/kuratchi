# @kuratchi/orm

Workers-native ORM for Cloudflare D1 and Durable Object SQLite.

## Install

```bash
npm install @kuratchi/orm
```

## D1 usage

```ts
import { kuratchiORM } from '@kuratchi/orm';
import { env } from 'cloudflare:workers';

const db = kuratchiORM(() => (env as Env).DB);
// or: const db = kuratchiORM(env.DB);

await db.todos.insert({ title: 'Hello' });
const todos = await db.todos.orderBy({ created_at: 'desc' }).many();
```

## Durable Object usage

```ts
import { initDO } from '@kuratchi/orm';

const db = initDO(ctx.storage.sql, appSchema);
```

## Schema DSL

```ts
import type { SchemaDsl } from '@kuratchi/orm';

export const appSchema: SchemaDsl = {
  name: 'app',
  version: 1,
  tables: {
    todos: {
      id: 'integer primary key',
      title: 'text not null',
      done: 'integer not null default 0',
    },
  },
};
```

## Configure in `kuratchi.config.ts`

```ts
import { defineConfig } from '@kuratchi/js';
import { kuratchiOrmConfig } from '@kuratchi/orm/adapter';

export default defineConfig({
  orm: kuratchiOrmConfig({
    databases: {
      DB: { schema: appSchema },
    },
  }),
});
```