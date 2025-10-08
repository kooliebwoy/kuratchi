CREATE TABLE IF NOT EXISTS roles (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions TEXT,
  isArchived INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS organizationRoles (
  id TEXT NOT NULL PRIMARY KEY,
  organizationId TEXT REFERENCES organizations(id),
  roleId TEXT REFERENCES roles(id),
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

ALTER TABLE activity ADD COLUMN isAdminAction INTEGER DEFAULT 'false';

ALTER TABLE activity ADD COLUMN isHidden INTEGER DEFAULT 'false';

ALTER TABLE activity ADD COLUMN organizationId TEXT;