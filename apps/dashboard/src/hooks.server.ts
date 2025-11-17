import {
  sessionPlugin,
  adminPlugin,
  organizationPlugin,
  credentialsPlugin,
  activityPlugin,
  rolesPlugin,
  oauthPlugin
} from 'kuratchi-sdk/auth';
import { adminSchema } from '$lib/schemas/admin';
import { organizationSchema } from '$lib/schemas/organization';
import { activityTypes } from '$lib/config/activity-types';
import { roles } from '$lib/config/roles';
import { kuratchi } from 'kuratchi-sdk';
import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const { handle }: { handle: Handle } = kuratchi({
  auth: {
    plugins: [
      sessionPlugin(),
      adminPlugin({
        adminSchema,
        organizationSchema,
        adminDatabase: 'ADMIN_DB'  // Binding name from wrangler.toml (defaults to 'DB' if omitted)
      }),
      organizationPlugin({ organizationSchema }),
      credentialsPlugin(), // Enable email/password auth
      oauthPlugin({
        providers: [
          {
            name: 'google',
            clientId: env.GOOGLE_CLIENT_ID || '',
            clientSecret: env.GOOGLE_CLIENT_SECRET || ''
          },
          {
            name: 'github',
            clientId: env.GITHUB_CLIENT_ID || '',
            clientSecret: env.GITHUB_CLIENT_SECRET || ''
          }
        ]
        // SDK default onProfile handler already implements the logic:
        // 1. If OAuth account exists → sign in
        // 2. If email exists (from credentials or other OAuth) → link account and sign in
        // 3. If new email → create user and sign in
      }),
      activityPlugin({ define: activityTypes }),
      rolesPlugin({
        // Dashboard uses code-only roles (Free Tier approach)
        // We're developers - we manage our own roles via code
        // The database/API is for our CUSTOMERS to manage THEIR roles
        define: roles,
        default: 'viewer'
      })
    ]
  },
  email: {
    region: env.AWS_SES_REGION || 'us-east-1',
    accessKeyId: env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY || '',
    from: env.RESEND_FROM_EMAIL || 'noreply@kuratchi.dev',
    fromName: 'Kuratchi',
    trackEmails: true,
    trackingDb: 'admin',
    trackingTable: 'emails'
  },
  storage: {
    kv: { default: 'KV', KV: 'KV' },
    r2: { default: 'BUCKET', R2: 'BUCKET' }
  },
  stripe: {
    apiKey: env.STRIPE_SECRET_KEY,
    trackEvents: true,
    trackingDb: 'admin'
  },
  notifications: {
    // Resend for user emails
    resendApiKey: env.RESEND_API_KEY,
    resendFrom: env.RESEND_FROM_EMAIL,
    resendFromName: 'Kuratchi',

    // Cloudflare Email for system emails
    cloudflareEmail: {
      from: 'system@kuratchi.dev',
    },

    // System admin email for platform monitoring
    systemEmail: env.ADMIN_EMAIL || 'admin@kuratchi.dev',

    // Enable features
    enableInApp: true,
    enableEmail: true,
    enableMonitoring: true,
    enableQueue: true,

    // Platform monitoring thresholds
    monitoringThresholds: {
      maxDatabasesPerHour: 10,
      maxDatabasesPerDay: 50,
      maxSignupsPerMinute: 5,
      maxSignupsPerHour: 50,
      maxApiCallsPerMinute: 100,
      maxApiCallsPerHour: 5000,
    },

    // Storage settings
    storageDb: 'admin',
    batchSize: 10,
    defaultExpiryDays: 30,
  }
});
