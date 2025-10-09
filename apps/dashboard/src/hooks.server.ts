import { 
  createAuthHandle,
  sessionPlugin,
  adminPlugin,
  organizationPlugin,
  credentialsPlugin,
  activityPlugin,
  rolesPlugin,
  storagePlugin
} from 'kuratchi-sdk/auth';
import { adminSchema } from '$lib/schemas/admin';
import { organizationSchema } from '$lib/schemas/organization';

export const handle = createAuthHandle({
  plugins: [
    sessionPlugin(),
    adminPlugin({ adminSchema, organizationSchema }), // Includes superadmin detection
    organizationPlugin({ organizationSchema }),
    credentialsPlugin(), // Enable email/password auth
    activityPlugin(), // Activity tracking with dual-logging
    storagePlugin({
      r2: {
        default: 'BUCKET'
      },
      defaultBucket: 'default'
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
});
