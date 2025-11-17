# Database Migrations

This directory contains SQL migration files for the Kuratchi Chat D1 database.

## Running Migrations

### Create a D1 Database

```bash
# Create the database
wrangler d1 create kuratchi-chat-db

# Update wrangler.jsonc with the database_id from the output
```

### Apply Migrations

```bash
# Apply all migrations
wrangler d1 migrations apply kuratchi-chat-db --local

# Apply migrations to production
wrangler d1 migrations apply kuratchi-chat-db --remote
```

### Create a New Migration

```bash
# Create a new migration file
wrangler d1 migrations create kuratchi-chat-db <migration_name>
```

## Migration Files

- `0001_initial_schema.sql` - Initial database schema with conversations, messages, and participants tables

## Schema Overview

### conversations
- Stores conversation metadata
- Links to users and organizations
- Tracks conversation status (open, waiting, resolved, closed)

### messages
- Stores individual chat messages
- Links to conversations and senders
- Supports attachments (stored as JSON)

### conversation_participants
- Tracks who is participating in each conversation
- Supports both customers and support agents

### typing_indicators
- Real-time typing status for conversations
- Automatically cleaned up after inactivity

## Querying the Database

```bash
# Execute a query on local database
wrangler d1 execute kuratchi-chat-db --local --command="SELECT * FROM conversations LIMIT 10"

# Execute a query on remote database
wrangler d1 execute kuratchi-chat-db --remote --command="SELECT * FROM conversations LIMIT 10"
```

## Backup

```bash
# Export database
wrangler d1 export kuratchi-chat-db --local --output=backup.sql

# Import database
wrangler d1 execute kuratchi-chat-db --local --file=backup.sql
```
