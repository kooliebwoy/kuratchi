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

CREATE TABLE IF NOT EXISTS magicLinkTokens (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  redirectTo TEXT,
  consumed_at INTEGER,
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

CREATE TABLE IF NOT EXISTS organizationUsers (
  id TEXT NOT NULL PRIMARY KEY,
  email TEXT,
  organizationId TEXT,
  organizationSlug TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT NOT NULL PRIMARY KEY,
  organizationName TEXT,
  email TEXT UNIQUE,
  organizationSlug TEXT UNIQUE,
  notes TEXT,
  stripeCustomerId TEXT,
  stripeSubscriptionId TEXT,
  status TEXT,
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

CREATE TABLE IF NOT EXISTS session (
  sessionToken TEXT NOT NULL PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL,
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

CREATE TABLE IF NOT EXISTS databases (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT UNIQUE,
  dbuuid TEXT UNIQUE,
  isArchived INTEGER,
  isActive INTEGER,
  lastBackup INTEGER,
  schemaVersion INTEGER DEFAULT 1,
  needsSchemaUpdate INTEGER DEFAULT 0,
  lastSchemaSync INTEGER,
  organizationId TEXT REFERENCES organizations(id),
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS dbApiTokens (
  id TEXT NOT NULL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  name TEXT,
  databaseId TEXT REFERENCES databases(id),
  expires INTEGER,
  revoked INTEGER,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);