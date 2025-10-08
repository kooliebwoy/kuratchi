-- Drop foreign key constraint from databases.organizationId
-- SQLite doesn't support DROP CONSTRAINT, so we recreate the table

PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;

-- Create new table without FK constraint
CREATE TABLE databases_new (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT UNIQUE,
  dbuuid TEXT UNIQUE,
  isArchived INTEGER,
  isActive INTEGER,
  lastBackup INTEGER,
  schemaVersion INTEGER DEFAULT 1,
  needsSchemaUpdate INTEGER DEFAULT 0,
  lastSchemaSync INTEGER,
  organizationId TEXT,  -- No FK constraint
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

-- Copy data from old table
INSERT INTO databases_new SELECT * FROM databases;

-- Drop old table
DROP TABLE databases;

-- Rename new table
ALTER TABLE databases_new RENAME TO databases;

COMMIT;

PRAGMA foreign_keys=ON;
