CREATE TABLE IF NOT EXISTS sites (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT,
  subdomain TEXT,
  description TEXT,
  status INTEGER,
  domain TEXT,
  environment TEXT,
  theme TEXT,
  databaseId TEXT,
  dbuuid TEXT,
  workerName TEXT,
  metadata TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS userSites (
  userId TEXT REFERENCES users(id) ON DELETE CASCADE,
  siteId TEXT REFERENCES sites(id) ON DELETE CASCADE,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

ALTER TABLE activity ADD COLUMN isAdminAction INTEGER DEFAULT 'false';