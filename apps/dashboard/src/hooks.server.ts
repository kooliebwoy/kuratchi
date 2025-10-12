import {
  sessionPlugin,
  adminPlugin,
  organizationPlugin,
  credentialsPlugin,
  activityPlugin,
  rolesPlugin
} from 'kuratchi-sdk/auth';
import { adminSchema } from '$lib/schemas/admin';
import { organizationSchema } from '$lib/schemas/organization';
import { kuratchi } from 'kuratchi-sdk';
import type { Handle } from '@sveltejs/kit';

export const { handle }: { handle: Handle } = kuratchi({
  auth: {
    plugins: [
      sessionPlugin(),
      adminPlugin({ adminSchema, organizationSchema }), // Includes superadmin detection
      organizationPlugin({ organizationSchema }),
      credentialsPlugin(), // Enable email/password auth
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
  storage: {
    r2: { R2: 'BUCKET' },
    kv: { KV: 'KV' }
  }
});
