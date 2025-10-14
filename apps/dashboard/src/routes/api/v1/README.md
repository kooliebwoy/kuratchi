# Kuratchi REST API v1

This directory contains the REST API endpoints that allow the Kuratchi SDK to communicate with the backend.

**Architecture**: These endpoints are **thin proxy layers** that authenticate requests and forward them to the Kuratchi database workers. The actual database logic is handled by the workers (see `kuratchi-sdk/src/lib/database/worker-template.ts`).

## Authentication

All API requests must include authentication via one of the following methods:

1. **API Key Header**: `x-api-key: your_api_key_here`
2. **Bearer Token**: `Authorization: Bearer your_api_key_here`

API keys are organization-scoped and can be managed through the dashboard.

## Endpoints

### Database SQL Operations

#### `POST /api/v1/databases/query`

Proxy endpoint for executing SQL queries on organization databases. Forwards to the database worker's SQL endpoints.

**Headers:**
- `x-api-key` or `Authorization: Bearer <key>` - Your organization API key (required)
- `x-database-id` - The database ID to query (required)
- `x-endpoint` - The worker endpoint to call (optional, default: `/do/api/run`)

**Available Endpoints:**
- `/do/api/run` - Execute query with parameters (default)
- `/do/api/exec` - Execute query without parameters
- `/do/api/batch` - Execute multiple queries in a transaction
- `/do/api/raw` - Execute query and return raw results
- `/do/api/first` - Execute query and return first row

**Request Body (for `/do/api/run`):**
```json
{
  "query": "SELECT * FROM users WHERE status = ?",
  "params": ["active"]
}
```

**Request Body (for `/do/api/batch`):**
```json
{
  "batch": [
    { "query": "INSERT INTO users (name, email) VALUES (?, ?)", "params": ["John", "john@example.com"] },
    { "query": "UPDATE users SET status = ? WHERE id = ?", "params": ["active", 1] }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "results": [...]
}
```

**Example cURL:**
```bash
curl -X POST https://your-app.com/api/v1/databases/query \
  -H "x-api-key: your_api_key" \
  -H "x-database-id: db_123" \
  -H "x-endpoint: /do/api/run" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT * FROM users WHERE status = ?", "params": ["active"]}'
```

### Database KV Operations

#### `POST /api/v1/databases/kv`

Proxy endpoint for KV (key-value) operations on database storage.

**Headers:**
- `x-api-key` or `Authorization: Bearer <key>` - Your organization API key (required)
- `x-database-id` - The database ID (required)
- `x-kv-operation` - The operation: `get`, `put`, `delete`, or `list` (required)

**Request Body (for `get`):**
```json
{
  "key": "user:123",
  "type": "json",
  "withMetadata": false
}
```

**Request Body (for `put`):**
```json
{
  "key": "user:123",
  "value": { "name": "John", "email": "john@example.com" },
  "encoding": "json",
  "metadata": { "created": "2024-01-01" },
  "expirationTtl": 3600
}
```

**Request Body (for `delete`):**
```json
{
  "key": "user:123"
}
```

**Request Body (for `list`):**
```json
{
  "prefix": "user:",
  "limit": 100,
  "reverse": false
}
```

**Example cURL:**
```bash
curl -X POST https://your-app.com/api/v1/databases/kv \
  -H "x-api-key: your_api_key" \
  -H "x-database-id: db_123" \
  -H "x-kv-operation: get" \
  -H "Content-Type: application/json" \
  -d '{"key": "user:123", "type": "json"}'
```

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

**Common HTTP Status Codes:**
- `400` - Bad Request (missing required fields, invalid operation)
- `401` - Unauthorized (missing or invalid API key)
- `404` - Not Found (database or resource not found)
- `500` - Internal Server Error

## Architecture

### Proxy Pattern

These API endpoints are **thin authentication proxies**. They:

1. **Authenticate** the request using API keys
2. **Authorize** access by verifying the database belongs to the organization
3. **Forward** the request to the Kuratchi database worker with proper credentials
4. **Return** the worker's response unchanged

This architecture ensures:
- **No duplication** - Database logic lives in one place (the worker)
- **Consistency** - SDK and API use the same underlying worker
- **Flexibility** - Direct bindings in production, HTTP in development
- **Security** - Organization-scoped access control

### Development vs Production

**Development** (2 HTTP calls):
```
Client → API Proxy → Database Worker → Response
```

**Production** (1 call with direct binding):
```
Client → Your App (with DO binding) → Response
```

In production, your app will have direct access to the Durable Object bindings, eliminating the extra HTTP hop.

## Security

- All requests are authenticated via API keys
- API keys are validated against the organization
- Database access is scoped to the authenticated organization
- Database tokens are signed and validated by the worker
- Gateway key protects the worker endpoints

## Future Enhancements

- [ ] Add rate limiting per API key
- [ ] API key usage analytics and monitoring
- [ ] Webhook endpoints for real-time database events
- [ ] GraphQL endpoint as alternative to REST
- [ ] Support for R2 (object storage) operations
- [ ] Support for email sending operations
- [ ] Support for Stripe operations
