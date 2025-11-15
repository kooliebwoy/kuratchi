# Platform API Directory Structure

```
/api/v1/platform/
├── +server.ts                              # Main platform endpoint (databases CRUD)
├── README.md                               # Complete API documentation
├── IMPLEMENTATION.md                       # Implementation summary
│
├── databases/
│   └── [id]/
│       ├── +server.ts                      # Database detail (GET, PATCH)
│       └── analytics/
│           └── +server.ts                  # Database analytics
│
├── permissions/
│   ├── +server.ts                          # Permissions list/create (GET, POST)
│   └── [id]/
│       └── +server.ts                      # Permission detail (GET, PATCH, DELETE)
│
└── roles/
    ├── +server.ts                          # Roles list/create (GET, POST)
    └── [id]/
        ├── +server.ts                      # Role detail (GET, PATCH, DELETE)
        ├── permissions/
        │   ├── +server.ts                  # Role permissions (GET, POST)
        │   └── [permissionId]/
        │       └── +server.ts              # Detach permission (DELETE)
        └── organizations/
            ├── +server.ts                  # Role organizations (GET, POST)
            └── [organizationId]/
                └── +server.ts              # Detach from org (DELETE)
```

## Endpoint Summary

### Database Management (3 endpoints)
- `GET    /api/v1/platform` - List databases
- `POST   /api/v1/platform` - Create database
- `DELETE /api/v1/platform` - Delete database
- `GET    /api/v1/platform/databases/:id` - Get database
- `PATCH  /api/v1/platform/databases/:id` - Update database
- `GET    /api/v1/platform/databases/:id/analytics` - Get analytics

### Permissions Management (4 endpoints)
- `GET    /api/v1/platform/permissions` - List permissions
- `POST   /api/v1/platform/permissions` - Create permission
- `GET    /api/v1/platform/permissions/:id` - Get permission
- `PATCH  /api/v1/platform/permissions/:id` - Update permission
- `DELETE /api/v1/platform/permissions/:id` - Archive permission

### Roles Management (5 endpoints)
- `GET    /api/v1/platform/roles` - List roles
- `POST   /api/v1/platform/roles` - Create role
- `GET    /api/v1/platform/roles/:id` - Get role
- `PATCH  /api/v1/platform/roles/:id` - Update role
- `DELETE /api/v1/platform/roles/:id` - Archive role

### Role-Permission Associations (3 endpoints)
- `GET    /api/v1/platform/roles/:id/permissions` - Get role permissions
- `POST   /api/v1/platform/roles/:id/permissions` - Attach permission
- `DELETE /api/v1/platform/roles/:id/permissions/:permissionId` - Detach permission

### Role-Organization Assignments (3 endpoints)
- `GET    /api/v1/platform/roles/:id/organizations` - Get role organizations
- `POST   /api/v1/platform/roles/:id/organizations` - Attach to organization
- `DELETE /api/v1/platform/roles/:id/organizations/:organizationId` - Detach from org

## Total: 24 API Endpoints

## File Count
- 11 TypeScript route files
- 2 Documentation files (README.md, IMPLEMENTATION.md)
- 13 total files

## Remote Functions Source
All routes call functions in: `/lib/api/roles.remote.ts`

Functions follow naming pattern:
- SvelteKit forms: `getPermissions`, `createRole`, etc. (for UI)
- API functions: `apiGetPermissions`, `apiCreateRole`, etc. (for API routes)

## Authentication
All routes protected by `authenticateApiRequest(event)` which validates:
- `x-api-key` header, or
- `Authorization: Bearer <token>` header
