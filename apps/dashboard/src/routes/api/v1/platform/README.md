# Platform API Documentation

Base URL: `/api/v1/platform`

## Authentication

All endpoints require authentication via platform API key. Include the key in one of the following ways:

**Option 1: x-api-key header**
```bash
curl -H "x-api-key: your-api-key-here" https://your-domain.com/api/v1/platform/databases
```

**Option 2: Authorization Bearer token**
```bash
curl -H "Authorization: Bearer your-api-key-here" https://your-domain.com/api/v1/platform/databases
```

## Table of Contents

- [Database Management](#database-management)
- [Roles Management](#roles-management)
- [Permissions Management](#permissions-management)

---

## Database Management

#### List Databases
`GET /databases`

List all databases with optional filtering.

**Query Parameters:**
- `organizationId` (optional): Filter by organization ID
- `includeArchived` (optional): Include archived databases (default: false)

**Example Request:**
```bash
curl -H "x-api-key: your-key" \
  "https://your-domain.com/api/v1/platform/databases?organizationId=org-123&includeArchived=true"
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "db-uuid",
      "name": "org-123-my-database",
      "dbuuid": "cloudflare-d1-id",
      "organizationId": "org-123",
      "isActive": true,
      "isArchived": false,
      "schemaVersion": 1,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 1,
  "meta": {
    "organizationId": "org-123",
    "includeArchived": true
  }
}
```

---

#### Create Database
`POST /databases`

Create a new database.

**Request Body:**
```json
{
  "name": "my-database",
  "description": "My database description",
  "organizationId": "org-123"
}
```

**Field Requirements:**
- `name`: Required. Lowercase letters, numbers, and hyphens only. Pattern: `^[a-z0-9-]+$`
- `description`: Required. Non-empty string
- `organizationId`: Optional. If omitted, creates a system-level database

**Example Request:**
```bash
curl -X POST \
  -H "x-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-database","description":"Production database","organizationId":"org-123"}' \
  https://your-domain.com/api/v1/platform/databases
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "db-uuid",
    "name": "org-123-my-database",
    "databaseId": "cloudflare-d1-id",
    "workerName": "worker-name",
    "organizationId": "org-123",
    "created_at": "2024-01-01T00:00:00.000Z"
  },
  "message": "Database created successfully"
}
```

---

#### Delete Database
`DELETE /databases`

Delete or archive a database.

**Query Parameters:**
- `hard` (optional): If true, permanently delete from Cloudflare (default: false)

**Request Body:**
```json
{
  "id": "database-uuid"
}
```

**Soft Delete (default):**
- Marks database as archived
- Sets `isActive` to false
- Sets `deleted_at` timestamp
- Database remains in admin DB

**Hard Delete (`?hard=true`):**
- Deletes D1 database from Cloudflare
- Removes all tokens
- Removes database record from admin DB

**Example Request (Soft Delete):**
```bash
curl -X DELETE \
  -H "x-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"id":"db-uuid"}' \
  https://your-domain.com/api/v1/platform/databases
```

**Example Request (Hard Delete):**
```bash
curl -X DELETE \
  -H "x-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"id":"db-uuid"}' \
  "https://your-domain.com/api/v1/platform/databases?hard=true"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Database archived successfully",
  "data": {
    "id": "db-uuid",
    "name": "org-123-my-database",
    "archivedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

#### Get Database Details
`GET /databases/:id`

Get detailed information about a specific database.

**Example Request:**
```bash
curl -H "x-api-key: your-key" \
  https://your-domain.com/api/v1/platform/databases/db-uuid
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "db-uuid",
    "name": "org-123-my-database",
    "dbuuid": "cloudflare-d1-id",
    "organizationId": "org-123",
    "isActive": true,
    "isArchived": false,
    "schemaVersion": 1,
    "needsSchemaUpdate": false,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z",
    "deleted_at": null
  }
}
```

---

#### Update Database
`PATCH /databases/:id`

Update database details.

**Request Body:**
```json
{
  "isActive": true,
  "isArchived": false,
  "needsSchemaUpdate": false,
  "schemaVersion": 2
}
```

**Allowed Fields:**
- `isActive`: boolean
- `isArchived`: boolean
- `needsSchemaUpdate`: boolean
- `schemaVersion`: number

**Example Request:**
```bash
curl -X PATCH \
  -H "x-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"isActive":false}' \
  https://your-domain.com/api/v1/platform/databases/db-uuid
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "db-uuid",
    "name": "org-123-my-database",
    "isActive": false,
    "updated_at": "2024-01-01T00:00:00.000Z"
  },
  "message": "Database updated successfully"
}
```

---

#### Get Database Analytics
`GET /databases/:id/analytics`

Get analytics for a specific database from Cloudflare.

**Query Parameters:**
- `days` (optional): Number of days to fetch (default: 7, max: 30)

**Example Request:**
```bash
curl -H "x-api-key: your-key" \
  "https://your-domain.com/api/v1/platform/databases/db-uuid/analytics?days=14"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "readQueries": 12345,
    "writeQueries": 5678,
    "rowsRead": 456789,
    "rowsWritten": 123456,
    "period": {
      "start": "2024-01-01",
      "end": "2024-01-14",
      "days": 14
    }
  }
}
```

---

## Roles Management

### List Roles
`GET /roles`

List all roles with optional filtering.

**Query Parameters:**
- `organizationId` (optional): Filter by organization ID
- `includeArchived` (optional): Include archived roles (default: false)
- `includePermissions` (optional): Include permission objects (default: false)

**Example Request:**
```bash
curl -H "x-api-key: your-key" \
  "https://your-domain.com/api/v1/platform/roles?organizationId=org-123&includePermissions=true"
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "role-uuid",
      "name": "editor",
      "description": "Content editor role",
      "permissions": ["posts.create", "posts.edit"],
      "isArchived": false,
      "created_at": "2024-01-01T00:00:00.000Z",
      "permissionObjects": [
        {
          "id": "perm-uuid",
          "value": "posts.create",
          "label": "Create Posts",
          "description": "Ability to create new posts"
        }
      ]
    }
  ],
  "count": 1,
  "meta": {
    "organizationId": "org-123",
    "includeArchived": false,
    "includePermissions": true
  }
}
```

---

### Get Role Details
`GET /roles/:id`

Get detailed information about a specific role.

**Query Parameters:**
- `includePermissions` (optional): Include permission objects (default: false)
- `includeOrganizations` (optional): Include organization objects (default: false)

**Example Request:**
```bash
curl -H "x-api-key: your-key" \
  "https://your-domain.com/api/v1/platform/roles/role-uuid?includePermissions=true&includeOrganizations=true"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "role-uuid",
    "name": "editor",
    "description": "Content editor role",
    "permissions": ["posts.create", "posts.edit"],
    "permissionObjects": [
      {
        "id": "perm-uuid",
        "value": "posts.create",
        "label": "Create Posts"
      }
    ],
    "organizations": ["org-123", "org-456"]
  }
}
```

---

### Create Role
`POST /roles`

Create a new role.

**Request Body:**
```json
{
  "name": "editor",
  "description": "Content editor role",
  "permissions": [
    { "value": "posts.create", "label": "Create Posts" },
    { "value": "posts.edit", "label": "Edit Posts" }
  ]
}
```

**Example Request:**
```bash
curl -X POST \
  -H "x-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"name":"editor","description":"Content editor","permissions":[{"value":"posts.create"}]}' \
  https://your-domain.com/api/v1/platform/roles
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "role-uuid",
    "name": "editor",
    "description": "Content editor role",
    "created_at": "2024-01-01T00:00:00.000Z"
  },
  "message": "Role created successfully"
}
```

---

### Update Role
`PATCH /roles/:id`

Update role details.

**Request Body:**
```json
{
  "name": "senior-editor",
  "description": "Updated description",
  "permissions": [
    { "value": "posts.*", "label": "All Post Permissions" }
  ]
}
```

**Example Request:**
```bash
curl -X PATCH \
  -H "x-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"description":"Updated description"}' \
  https://your-domain.com/api/v1/platform/roles/role-uuid
```

---

### Archive Role
`DELETE /roles/:id`

Archive a role (soft delete).

**Example Request:**
```bash
curl -X DELETE \
  -H "x-api-key: your-key" \
  https://your-domain.com/api/v1/platform/roles/role-uuid
```

---

### Get Role Permissions
`GET /roles/:id/permissions`

Get all permissions assigned to a role.

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "perm-uuid",
      "value": "posts.create",
      "label": "Create Posts"
    }
  ],
  "count": 1
}
```

---

### Attach Permission to Role
`POST /roles/:id/permissions`

Attach a permission to a role.

**Request Body:**
```json
{
  "permissionId": "perm-uuid"
}
```

---

### Detach Permission from Role
`DELETE /roles/:id/permissions/:permissionId`

Remove a permission from a role.

**Example Request:**
```bash
curl -X DELETE \
  -H "x-api-key: your-key" \
  https://your-domain.com/api/v1/platform/roles/role-uuid/permissions/perm-uuid
```

---

### Get Role Organizations
`GET /roles/:id/organizations`

Get all organizations that have this role assigned.

**Example Response:**
```json
{
  "success": true,
  "data": ["org-123", "org-456"],
  "count": 2
}
```

---

### Attach Role to Organization
`POST /roles/:id/organizations`

Assign a role to an organization.

**Request Body:**
```json
{
  "organizationId": "org-123"
}
```

---

### Detach Role from Organization
`DELETE /roles/:id/organizations/:organizationId`

Remove a role from an organization.

---

## Permissions Management

### List Permissions
`GET /permissions`

List all permissions with optional filtering.

**Query Parameters:**
- `category` (optional): Filter by category (auth, users, content, etc.)
- `includeArchived` (optional): Include archived permissions (default: false)

**Example Request:**
```bash
curl -H "x-api-key: your-key" \
  "https://your-domain.com/api/v1/platform/permissions?category=content"
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "perm-uuid",
      "value": "posts.create",
      "label": "Create Posts",
      "description": "Ability to create new posts",
      "category": "content",
      "isArchived": false,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 1,
  "meta": {
    "category": "content",
    "includeArchived": false
  }
}
```

---

### Get Permission Details
`GET /permissions/:id`

Get detailed information about a specific permission.

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "perm-uuid",
    "value": "posts.create",
    "label": "Create Posts",
    "description": "Ability to create new posts",
    "category": "content"
  }
}
```

---

### Create Permission
`POST /permissions`

Create a new permission.

**Request Body:**
```json
{
  "value": "posts.create",
  "label": "Create Posts",
  "description": "Ability to create new posts",
  "category": "content"
}
```

**Example Request:**
```bash
curl -X POST \
  -H "x-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"value":"posts.create","label":"Create Posts","category":"content"}' \
  https://your-domain.com/api/v1/platform/permissions
```

---

### Update Permission
`PATCH /permissions/:id`

Update permission details.

**Request Body:**
```json
{
  "label": "Create Blog Posts",
  "description": "Updated description",
  "category": "content"
}
```

---

### Archive Permission
`DELETE /permissions/:id`

Archive a permission (soft delete).

**Example Request:**
```bash
curl -X DELETE \
  -H "x-api-key: your-key" \
  https://your-domain.com/api/v1/platform/permissions/perm-uuid
```

---

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

**Common HTTP Status Codes:**
- `400` - Bad Request (validation failed)
- `401` - Unauthorized (missing or invalid API key)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error
- `502` - Bad Gateway (Cloudflare API error)
- `503` - Service Unavailable (missing configuration)

**Validation Error Response:**
```json
{
  "success": false,
  "error": "Validation failed",
  "issues": [
    {
      "field": "name",
      "message": "Invalid length: Expected !0 but received 0"
    }
  ]
}
```

---

## SDK Usage Examples

### JavaScript/TypeScript

```typescript
import { Kuratchi } from 'kuratchi-sdk';

const client = new Kuratchi({
  apiKey: 'your-api-key-here',
  baseUrl: 'https://your-domain.com'
});

// List databases
const databases = await client.platform.databases.list({
  organizationId: 'org-123',
  includeArchived: false
});

// Create database
const newDb = await client.platform.databases.create({
  name: 'my-database',
  description: 'Production database',
  organizationId: 'org-123'
});

// Get database details
const db = await client.platform.databases.get('db-uuid');

// Update database
await client.platform.databases.update('db-uuid', {
  isActive: false
});

// Get analytics
const analytics = await client.platform.databases.analytics('db-uuid', {
  days: 14
});

// Delete database (soft)
await client.platform.databases.delete('db-uuid');

// Delete database (hard)
await client.platform.databases.delete('db-uuid', { hard: true });
```

---

## Rate Limiting

Currently, there are no rate limits enforced. This may change in the future.

---

## Changelog

### v1 (2024-01-01)
- Initial release
- Database CRUD operations
- Analytics integration
- Soft and hard delete support
