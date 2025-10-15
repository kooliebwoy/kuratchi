# Kuratchi BaaS API Usage

## Authentication

All API requests require a platform API key. Create one in your dashboard under **Settings > API Keys**.

Include your API key in requests using either:
- Header: `Authorization: Bearer YOUR_API_KEY`
- Or: `x-api-key: YOUR_API_KEY`

## Database Queries

### Endpoint
```
POST https://your-kuratchi-instance.com/api/v1/databases
```

### Required Headers
- `Authorization: Bearer YOUR_API_KEY` - Your platform API key
- `x-database-id: YOUR_DATABASE_ID` - Your database ID (from dashboard)

### Optional Headers
- `x-endpoint: /api/run` - Worker endpoint (default: `/api/run`)
- `x-d1-bookmark: BOOKMARK` - D1 session bookmark for read consistency

### Available Endpoints

#### 1. Run Query (default)
Execute a parameterized query and get results.

```bash
curl -X POST https://your-instance.com/api/v1/databases \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "x-database-id: YOUR_DATABASE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT * FROM users WHERE id = ?",
    "params": [1]
  }'
```

#### 2. Execute SQL (`x-endpoint: /api/exec`)
Execute raw SQL (DDL, multiple statements).

```bash
curl -X POST https://your-instance.com/api/v1/databases \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "x-database-id: YOUR_DATABASE_ID" \
  -H "x-endpoint: /api/exec" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)"
  }'
```

#### 3. Batch Operations (`x-endpoint: /api/batch`)
Execute multiple queries in a single transaction.

```bash
curl -X POST https://your-instance.com/api/v1/databases \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "x-database-id: YOUR_DATABASE_ID" \
  -H "x-endpoint: /api/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "batch": [
      {
        "query": "INSERT INTO users (name, email) VALUES (?, ?)",
        "params": ["Alice", "alice@example.com"]
      },
      {
        "query": "INSERT INTO users (name, email) VALUES (?, ?)",
        "params": ["Bob", "bob@example.com"]
      }
    ]
  }'
```

#### 4. Get First Result (`x-endpoint: /api/first`)
Get a single value from the first row.

```bash
curl -X POST https://your-instance.com/api/v1/databases \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "x-database-id: YOUR_DATABASE_ID" \
  -H "x-endpoint: /api/first" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT COUNT(*) as count FROM users",
    "columnName": "count"
  }'
```

#### 5. Raw Results (`x-endpoint: /api/raw`)
Get results as arrays instead of objects.

```bash
curl -X POST https://your-instance.com/api/v1/databases \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "x-database-id: YOUR_DATABASE_ID" \
  -H "x-endpoint: /api/raw" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT id, name FROM users LIMIT 10"
  }'
```

### Response Format

```json
{
  "success": true,
  "results": [...],
  "d1Latency": 45,
  "servedByRegion": "WEUR",
  "servedByPrimary": true,
  "sessionBookmark": "v1-abc123..."
}
```

### Session Bookmarks (Read Consistency)

D1 uses session bookmarks to ensure read-after-write consistency. After a write operation, save the `sessionBookmark` from the response and include it in subsequent reads:

```bash
# 1. Write data
RESPONSE=$(curl -X POST https://your-instance.com/api/v1/databases \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "x-database-id: YOUR_DATABASE_ID" \
  -H "Content-Type: application/json" \
  -d '{"query": "INSERT INTO users (name) VALUES (?)", "params": ["Charlie"]}')

# Extract bookmark
BOOKMARK=$(echo $RESPONSE | jq -r '.sessionBookmark')

# 2. Read with bookmark for consistency
curl -X POST https://your-instance.com/api/v1/databases \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "x-database-id: YOUR_DATABASE_ID" \
  -H "x-d1-bookmark: $BOOKMARK" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT * FROM users WHERE name = ?", "params": ["Charlie"]}'
```

## JavaScript/TypeScript Example

```typescript
class KuratchiClient {
  constructor(
    private apiKey: string,
    private baseUrl: string = 'https://your-instance.com'
  ) {}

  async query(
    databaseId: string,
    query: string,
    params: any[] = [],
    options: { endpoint?: string; bookmark?: string } = {}
  ) {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'x-database-id': databaseId,
      'Content-Type': 'application/json'
    };

    if (options.endpoint) {
      headers['x-endpoint'] = options.endpoint;
    }

    if (options.bookmark) {
      headers['x-d1-bookmark'] = options.bookmark;
    }

    const response = await fetch(`${this.baseUrl}/api/v1/databases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, params })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  }

  async batch(databaseId: string, operations: Array<{ query: string; params?: any[] }>) {
    return this.query(databaseId, '', [], {
      endpoint: '/api/batch'
    }).then(res => {
      // Manually set body for batch
      return fetch(`${this.baseUrl}/api/v1/databases`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'x-database-id': databaseId,
          'x-endpoint': '/api/batch',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ batch: operations })
      }).then(r => r.json());
    });
  }
}

// Usage
const client = new KuratchiClient('YOUR_API_KEY');

// Simple query
const users = await client.query('db-123', 'SELECT * FROM users WHERE active = ?', [true]);

// Batch insert
await client.batch('db-123', [
  { query: 'INSERT INTO users (name) VALUES (?)', params: ['Alice'] },
  { query: 'INSERT INTO users (name) VALUES (?)', params: ['Bob'] }
]);
```

## Error Handling

### Common Error Codes

- **400** - Bad Request (missing required headers or invalid body)
- **401** - Unauthorized (invalid or missing API key)
- **404** - Database not found or access denied
- **500** - Internal server error

### Error Response Format

```json
{
  "success": false,
  "error": "Error message here"
}
```

## Best Practices

1. **Use parameterized queries** - Always use `params` array to prevent SQL injection
2. **Save bookmarks** - Store session bookmarks for read-after-write consistency
3. **Batch operations** - Use `/api/batch` for multiple inserts/updates
4. **Handle errors** - Always check `success` field in responses
5. **Rate limiting** - Implement exponential backoff for retries

## Security Notes

- **Never expose your API key** in client-side code
- **Use environment variables** to store API keys
- **Rotate keys regularly** using the dashboard
- **Use HTTPS** for all API requests
- **Validate input** on your application layer before sending to the API
