CREATE TABLE IF NOT EXISTS users (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT,
  firstName TEXT,
  lastName TEXT,
  phone TEXT,
  email TEXT NOT NULL UNIQUE,
  emailVerified INTEGER,
  image TEXT,
  status INTEGER,
  role TEXT,
  password_hash TEXT,
  accessAttempts INTEGER,
  tenantId TEXT,
  organization TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS session (
  sessionToken TEXT NOT NULL PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS passwordResetTokens (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  email TEXT NOT NULL,
  expires INTEGER NOT NULL,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS emailVerificationToken (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  email TEXT NOT NULL,
  userId TEXT NOT NULL,
  expires INTEGER NOT NULL,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS magicLinkTokens (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  email TEXT NOT NULL,
  redirectTo TEXT,
  consumed_at INTEGER,
  expires INTEGER NOT NULL,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  userId TEXT,
  action TEXT NOT NULL,
  data TEXT DEFAULT (json_object()),
  status INTEGER,
  ip TEXT,
  userAgent TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  permissions TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS oauthAccounts (
  id TEXT PRIMARY KEY,
  userId TEXT REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  providerAccountId TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at INTEGER,
  scope TEXT,
  token_type TEXT,
  id_token TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);