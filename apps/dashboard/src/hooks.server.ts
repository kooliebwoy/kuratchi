import { 
  createAuthHandle,
  sessionPlugin,
  adminPlugin,
  organizationPlugin,
  // superadminPlugin,
  // rolesPlugin
} from 'kuratchi-sdk/auth';
import { adminSchema } from '$lib/schemas/admin';
import { organizationSchema } from '$lib/schemas/organization';

export const handle = createAuthHandle({
  plugins: [
    sessionPlugin(),
    adminPlugin({ adminSchema }),
    organizationPlugin({ organizationSchema }),
    // superadminPlugin(),
    // rolesPlugin()
  ]
});
