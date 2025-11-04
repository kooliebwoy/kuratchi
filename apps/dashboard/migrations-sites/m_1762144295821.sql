CREATE TABLE IF NOT EXISTS pages (
  id TEXT NOT NULL PRIMARY KEY,
  title TEXT,
  data TEXT DEFAULT (json_object()),
  seoTitle TEXT,
  seoDescription TEXT,
  slug TEXT UNIQUE,
  isSpecialPage INTEGER,
  pageType TEXT,
  status INTEGER,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT NOT NULL PRIMARY KEY,
  key TEXT,
  url TEXT,
  fileName TEXT,
  alt TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS slides (
  id TEXT NOT NULL PRIMARY KEY,
  title TEXT,
  alt TEXT,
  src TEXT,
  key TEXT,
  status INTEGER,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS menu (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT,
  menuItems TEXT DEFAULT (json_array()),
  status INTEGER,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS popups (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT,
  formId TEXT,
  data TEXT DEFAULT (json_object()),
  image TEXT DEFAULT (json_array()),
  status INTEGER,
  deliveryMethod TEXT,
  deliveryPage TEXT,
  deliveryDelay INTEGER,
  deliveryRepeat INTEGER,
  deliveryStyle TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT,
  description TEXT,
  price TEXT,
  slug TEXT UNIQUE,
  sku TEXT,
  ctaText TEXT,
  featureText TEXT,
  featureImage TEXT,
  images TEXT DEFAULT (json_array()),
  features TEXT DEFAULT (json_array()),
  category TEXT,
  subcategory TEXT,
  tags TEXT DEFAULT (json_array()),
  status TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT,
  entity TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS subcategories (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT,
  categoryId TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT,
  entity TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS entityTags (
  id TEXT NOT NULL PRIMARY KEY,
  tagId TEXT,
  entityId TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS entityCategories (
  id TEXT NOT NULL PRIMARY KEY,
  categoryId TEXT,
  entityId TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS entitySubcategories (
  id TEXT NOT NULL PRIMARY KEY,
  subcategoryId TEXT,
  entityId TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT,
  description TEXT,
  price TEXT,
  slug TEXT,
  ctaText TEXT,
  featureText TEXT,
  featureImage TEXT,
  images TEXT DEFAULT (json_array()),
  features TEXT DEFAULT (json_array()),
  category TEXT,
  subcategory TEXT,
  tags TEXT DEFAULT (json_array()),
  status TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT NOT NULL PRIMARY KEY,
  seoTitle TEXT,
  seoDescription TEXT,
  content TEXT DEFAULT (json_array()),
  slug TEXT,
  status TEXT,
  authorId TEXT REFERENCES users(id),
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT,
  email TEXT,
  comment TEXT,
  postId TEXT REFERENCES posts(id) ON DELETE CASCADE,
  status TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS forms (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT,
  description TEXT,
  responseMessage TEXT,
  fields TEXT DEFAULT (json_array()),
  ctaButton TEXT DEFAULT (json_array()),
  status INTEGER,
  timestamp TEXT DEFAULT (CURRENT_TIMESTAMP),
  recipients TEXT DEFAULT (json_array()),
  deliveryMethod TEXT,
  deliveryPage TEXT,
  deliveryDelay INTEGER,
  deliveryRepeat INTEGER,
  deliveryStyle TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT NOT NULL PRIMARY KEY,
  formId TEXT REFERENCES forms(id) ON DELETE CASCADE,
  data TEXT DEFAULT (json_array()),
  status INTEGER,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS redirects (
  id TEXT NOT NULL PRIMARY KEY,
  source TEXT,
  destination TEXT,
  code TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS newsletter (
  id TEXT NOT NULL PRIMARY KEY,
  domain TEXT,
  status INTEGER,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT NOT NULL PRIMARY KEY,
  email TEXT,
  status INTEGER,
  audienceId TEXT,
  contactResendId TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT,
  subject TEXT,
  body TEXT,
  status INTEGER,
  audienceId TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS audiences (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT,
  description TEXT,
  audienceResendId TEXT,
  status INTEGER,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS scripts (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT,
  attributes TEXT DEFAULT (json_array()),
  isEnabled INTEGER,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);