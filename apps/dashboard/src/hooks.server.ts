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
      activityPlugin({
        // Static core activity types (fallbacks)
        define: {
          'auth.login': { label: 'User Login', category: 'auth', severity: 'info', isAdminAction: false, isHidden: false },
          'auth.logout': { label: 'User Logout', category: 'auth', severity: 'info', isAdminAction: false, isHidden: false },
          'auth.failed_login': { label: 'Failed Login', category: 'auth', severity: 'warning', isAdminAction: false, isHidden: false },
          'system.error': { label: 'System Error', category: 'system', severity: 'critical', isAdminAction: true, isHidden: true }
        },
        // Load activity types from admin DB
        db: {
          source: 'admin',
          table: 'activityTypes',
          actionColumn: 'action',
          labelColumn: 'label',
          categoryColumn: 'category',
          severityColumn: 'severity',
          descriptionColumn: 'description',
          isAdminActionColumn: 'isAdminAction',
          isHiddenColumn: 'isHidden'
        }
      }),
      rolesPlugin({
        // Static defaults (fallbacks)
        define: {
          editor: [
            { value: 'posts.create', label: 'Post Create' },
            { value: 'posts.edit', label: 'Post Edit' },
            { value: 'posts.delete', label: 'Post Delete' },
            { value: 'media.upload', label: 'Media Upload' }
          ],
          viewer: [{ value: 'posts.read', label: 'Post Read' }],
          moderator: [
            { value: 'posts.*', label: 'All Post Permissions' },
            { value: 'comments.delete', label: 'Delete Comments' }
          ]
        },
        // Load roles from admin DB table 'roles' (JSON permissions with labels)
        db: {
          source: 'admin',
          table: 'roles',
          nameColumn: 'name',
          permissionsColumn: 'permissions'
        },
        // Also load via join tables when available (permissions registry)
        dbJoin: {
          source: 'admin',
          rolesTable: 'roles',
          roleIdColumn: 'id',
          roleNameColumn: 'name',
          rolePermissionsTable: 'rolePermissions',
          rpRoleIdColumn: 'roleId',
          rpPermissionIdColumn: 'permissionId',
          permissionsTable: 'permissions',
          permIdColumn: 'id',
          permValueColumn: 'value',
          permLabelColumn: 'label',
          permDescriptionColumn: 'description'
        },
        default: 'viewer'
      })
    ]
  },
  email: {
    apiKey: env.RESEND_API_KEY,
    from: env.RESEND_FROM_EMAIL,
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
  }
});
