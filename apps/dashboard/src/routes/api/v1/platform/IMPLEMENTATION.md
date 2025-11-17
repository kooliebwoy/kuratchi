# Platform API Routes - Implementation Summary

## Overview

Implemented complete REST API for roles and permissions management in the Kuratchi platform. These routes follow the established pattern of being thin shims that call the source-of-truth remote functions.

## Architecture

```
API Routes (Thin Shims)
    ↓
Remote Functions (lib/api/roles.remote.ts)
    ↓
Kuratchi SDK Roles Plugin
    ↓
Admin Database
```

## Implemented Routes

### Permissions API

```
GET    /api/v1/platform/permissions              - List all permissions
POST   /api/v1/platform/permissions              - Create permission
GET    /api/v1/platform/permissions/:id          - Get permission details
PATCH  /api/v1/platform/permissions/:id          - Update permission
DELETE /api/v1/platform/permissions/:id          - Archive permission
```

**Files:**
- `/routes/api/v1/platform/permissions/+server.ts`
- `/routes/api/v1/platform/permissions/[id]/+server.ts`

### Roles API

```
GET    /api/v1/platform/roles                    - List all roles
POST   /api/v1/platform/roles                    - Create role
GET    /api/v1/platform/roles/:id                - Get role details
PATCH  /api/v1/platform/roles/:id                - Update role
DELETE /api/v1/platform/roles/:id                - Archive role
```

**Files:**
- `/routes/api/v1/platform/roles/+server.ts`
- `/routes/api/v1/platform/roles/[id]/+server.ts`

### Role-Permission Associations

```
GET    /api/v1/platform/roles/:id/permissions              - Get role permissions
POST   /api/v1/platform/roles/:id/permissions              - Attach permission to role
DELETE /api/v1/platform/roles/:id/permissions/:permissionId - Detach permission from role
```

**Files:**
- `/routes/api/v1/platform/roles/[id]/permissions/+server.ts`
- `/routes/api/v1/platform/roles/[id]/permissions/[permissionId]/+server.ts`

### Role-Organization Assignments

```
GET    /api/v1/platform/roles/:id/organizations                - Get role organizations
POST   /api/v1/platform/roles/:id/organizations                - Attach role to org
DELETE /api/v1/platform/roles/:id/organizations/:organizationId - Detach role from org
```

**Files:**
- `/routes/api/v1/platform/roles/[id]/organizations/+server.ts`
- `/routes/api/v1/platform/roles/[id]/organizations/[organizationId]/+server.ts`

## Remote Functions

Added API-callable functions in `lib/api/roles.remote.ts`:

### Permissions
- `apiGetPermissions()` - Get all permissions
- `apiCreatePermission(data)` - Create permission
- `apiUpdatePermission(id, data)` - Update permission
- `apiArchivePermission(id)` - Archive permission
- `apiAttachPermissionToRole(roleId, permissionId)` - Attach to role
- `apiDetachPermissionFromRole(roleId, permissionId)` - Detach from role

### Roles
- `apiGetRoles()` - Get all roles
- `apiGetRolePermissions()` - Get role-permission mappings
- `apiGetRoleAttachments()` - Get role-organization attachments
- `apiCreateRole(data)` - Create role
- `apiUpdateRole(id, data)` - Update role
- `apiArchiveRole(id)` - Archive role
- `apiAttachRoleToOrganization(roleId, orgId)` - Attach to org
- `apiDetachRoleFromOrganization(roleId, orgId)` - Detach from org

## Features

### Authentication
- All routes protected by `authenticateApiRequest(event)`
- Supports both `x-api-key` header and `Authorization: Bearer` token

### Query Parameters
- **Permissions**: `category`, `includeArchived`
- **Roles**: `organizationId`, `includeArchived`, `includePermissions`, `includeOrganizations`

### Response Format
All responses follow consistent format:
```json
{
  "success": true,
  "data": {...},
  "message": "...",
  "count": 10,
  "meta": {...}
}
```

### Error Handling
- Consistent error responses with proper HTTP status codes
- Validation errors include field-level details
- All errors logged with context

## Documentation

- Updated `/routes/api/v1/platform/README.md` with complete documentation
- Includes curl examples for all endpoints
- Documents query parameters, request/response formats
- Error response formats documented

## Testing Examples

### Create Permission
```bash
curl -X POST \
  -H "x-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "value": "posts.create",
    "label": "Create Posts",
    "description": "Ability to create new posts",
    "category": "content"
  }' \
  https://your-domain.com/api/v1/platform/permissions
```

### Create Role with Permissions
```bash
curl -X POST \
  -H "x-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "editor",
    "description": "Content editor role",
    "permissions": [
      {"value": "posts.create", "label": "Create Posts"},
      {"value": "posts.edit", "label": "Edit Posts"}
    ]
  }' \
  https://your-domain.com/api/v1/platform/roles
```

### List Roles with Permissions
```bash
curl -H "x-api-key: your-key" \
  "https://your-domain.com/api/v1/platform/roles?includePermissions=true"
```

### Attach Role to Organization
```bash
curl -X POST \
  -H "x-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"organizationId": "org-123"}' \
  https://your-domain.com/api/v1/platform/roles/role-uuid/organizations
```

## Integration with SDK

These API routes power the cloud platform SDK:

```typescript
import { cloud } from 'kuratchi-sdk';

const platform = cloud.createPlatform({
  apiKey: 'your-api-key'
});

// List permissions
await platform.permissions.list({ category: 'content' });

// Create role
await platform.roles.create({
  name: 'editor',
  permissions: [{ value: 'posts.create' }]
});

// Attach to organization
await platform.roles.attachToOrganization('role-id', 'org-id');
```

## Status

✅ All routes implemented
✅ All remote functions created
✅ Documentation complete
✅ No TypeScript errors
✅ Follows established patterns
✅ Ready for testing

## Next Steps

1. Test API endpoints with actual requests
2. Implement roles plugin in Kuratchi SDK (if not already done)
3. Add rate limiting (if needed)
4. Add webhook support for role/permission changes (optional)
5. Create Settings UI for Cloud tier role management
