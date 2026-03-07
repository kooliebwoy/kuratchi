import { defineConfig } from '@kuratchi/js';
import { kuratchiUiConfig } from '@kuratchi/ui/adapter';
import { kuratchiOrmConfig } from '@kuratchi/orm/adapter';
import { kuratchiAuthConfig } from '@kuratchi/auth/adapter';
import { adminSchema } from './src/schemas/admin';

export default defineConfig({
  ui: kuratchiUiConfig({ theme: 'default' }),
  orm: kuratchiOrmConfig({ databases: { DB: { schema: adminSchema } } }),
  auth: kuratchiAuthConfig({
    cookieName: 'kuratchi-db-session',
    sessionEnabled: true,
    guards: {
      paths: ['/*'],
      exclude: [
        '/auth/signin',
        '/auth/signup',
        '/api/v1/*',
      ],
      redirectTo: '/auth/signin',
    },
    rateLimit: {
      defaultWindowMs: 60_000,
      defaultMaxRequests: 10,
      kvBinding: 'RATE_LIMIT',
      routes: [
        {
          id: 'auth-signin',
          path: '/auth/signin',
          methods: ['POST'],
          maxRequests: 5,
          windowMs: 60_000,
          message: 'Too many sign-in attempts. Please wait a minute and try again.',
        },
        {
          id: 'auth-signup',
          path: '/auth/signup',
          methods: ['POST'],
          maxRequests: 3,
          windowMs: 60_000,
          message: 'Too many sign-up attempts. Please wait a minute and try again.',
        },
      ],
    },
    turnstile: {
      secretEnv: 'TURNSTILE_SECRET',
      siteKeyEnv: 'TURNSTILE_SITE_KEY',
      routes: [
        {
          id: 'auth-signin',
          path: '/auth/signin',
          methods: ['POST'],
          expectedAction: 'signin',
          message: 'Please complete the bot check before signing in.',
        },
        {
          id: 'auth-signup',
          path: '/auth/signup',
          methods: ['POST'],
          expectedAction: 'signup',
          message: 'Please complete the bot check before creating an account.',
        },
      ],
    },
  }),
});
