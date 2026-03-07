import { defineConfig } from '@kuratchi/js';
import { kuratchiUiConfig } from '@kuratchi/ui/adapter';
import { kuratchiOrmConfig } from '@kuratchi/orm/adapter';
import { kuratchiAuthConfig } from '@kuratchi/auth/adapter';
import { adminSchema } from './src/schemas/admin';

export default defineConfig({
  ui: kuratchiUiConfig({ theme: 'default' }),
  orm: kuratchiOrmConfig({ databases: { DB: { schema: adminSchema } } }),
  auth: kuratchiAuthConfig({ cookieName: 'kuratchi-db-session', sessionEnabled: true }),
});
