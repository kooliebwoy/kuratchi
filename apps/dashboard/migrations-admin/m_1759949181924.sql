CREATE TABLE IF NOT EXISTS permissions (
  id TEXT NOT NULL PRIMARY KEY,
  value TEXT NOT NULL UNIQUE,
  label TEXT,
  description TEXT,
  isArchived INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS rolePermissions (
  id TEXT NOT NULL PRIMARY KEY,
  roleId TEXT REFERENCES roles(id),
  permissionId TEXT REFERENCES permissions(id),
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);