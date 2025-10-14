CREATE TABLE IF NOT EXISTS emails (
  id TEXT NOT NULL PRIMARY KEY,
  to TEXT NOT NULL,
  from TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT,
  text TEXT,
  emailType TEXT,
  status TEXT DEFAULT 'pending',
  error TEXT,
  resendId TEXT,
  sentAt INTEGER,
  userId TEXT,
  organizationId TEXT,
  metadata TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);