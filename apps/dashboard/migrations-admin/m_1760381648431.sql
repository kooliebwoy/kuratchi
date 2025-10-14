CREATE TABLE IF NOT EXISTS stripeCustomers (
  id TEXT NOT NULL PRIMARY KEY,
  stripeCustomerId TEXT NOT NULL UNIQUE,
  email TEXT,
  name TEXT,
  organizationId TEXT REFERENCES organizations(id),
  metadata TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS stripeSubscriptions (
  id TEXT NOT NULL PRIMARY KEY,
  stripeSubscriptionId TEXT NOT NULL UNIQUE,
  stripeCustomerId TEXT NOT NULL,
  stripePriceId TEXT NOT NULL,
  stripeProductId TEXT NOT NULL,
  status TEXT NOT NULL,
  currentPeriodStart INTEGER,
  currentPeriodEnd INTEGER,
  cancelAtPeriodEnd INTEGER DEFAULT 0,
  canceledAt INTEGER,
  metadata TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS stripeProducts (
  id TEXT NOT NULL PRIMARY KEY,
  stripeProductId TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  active INTEGER DEFAULT 1,
  features TEXT,
  metadata TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS stripePrices (
  id TEXT NOT NULL PRIMARY KEY,
  stripePriceId TEXT NOT NULL UNIQUE,
  stripeProductId TEXT NOT NULL,
  unitAmount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  recurringInterval TEXT,
  recurringIntervalCount INTEGER,
  active INTEGER DEFAULT 1,
  metadata TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS stripeEvents (
  id TEXT NOT NULL PRIMARY KEY,
  stripeEventId TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  data TEXT NOT NULL,
  processed INTEGER DEFAULT 0,
  processedAt INTEGER,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS stripeInvoices (
  id TEXT NOT NULL PRIMARY KEY,
  stripeInvoiceId TEXT NOT NULL UNIQUE,
  stripeCustomerId TEXT NOT NULL,
  stripeSubscriptionId TEXT,
  amountDue INTEGER NOT NULL,
  amountPaid INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  hostedInvoiceUrl TEXT,
  invoicePdf TEXT,
  metadata TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);