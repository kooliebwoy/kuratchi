CREATE TABLE IF NOT EXISTS activityTypes (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  category TEXT,
  severity TEXT DEFAULT 'info',
  description TEXT,
  isAdminAction INTEGER DEFAULT 'false',
  isHidden INTEGER DEFAULT 'false',
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);