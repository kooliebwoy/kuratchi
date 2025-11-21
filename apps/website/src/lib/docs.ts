import MarkdownIt from 'markdown-it';

import authContent from '../../../../packages/kuratchi-sdk/src/docs/auth.md?raw';
import cliContent from '../../../../packages/kuratchi-sdk/src/docs/cli.md?raw';
import cloudContent from '../../../../packages/kuratchi-sdk/src/docs/cloud.md?raw';
import databaseContent from '../../../../packages/kuratchi-sdk/src/docs/database.md?raw';
import notificationsContent from '../../../../packages/kuratchi-sdk/src/docs/notifications.md?raw';
import ormContent from '../../../../packages/kuratchi-sdk/src/docs/orm.md?raw';
import overviewContent from '../../../../packages/kuratchi-sdk/src/docs/README.md?raw';
import spacesContent from '../../../../packages/kuratchi-sdk/src/docs/spaces.md?raw';
import storageContent from '../../../../packages/kuratchi-sdk/src/docs/storage.md?raw';
import stripeContent from '../../../../packages/kuratchi-sdk/src/docs/stripe.md?raw';

type DocSlug =
  | 'overview'
  | 'auth'
  | 'database'
  | 'orm'
  | 'storage'
  | 'notifications'
  | 'spaces'
  | 'stripe'
  | 'cloud'
  | 'cli';

type DocDefinition = {
  title: string;
  description: string;
  content: string;
};

export type DocContent = {
  title: string;
  description: string;
  html: string;
};

const markdown = new MarkdownIt({ html: true });

const docs: Record<DocSlug, DocDefinition> = {
  overview: {
    title: 'SDK Overview',
    description: 'Entry point to the Kuratchi SDK with links to Auth, Database, ORM, and CLI guides.',
    content: overviewContent
  },
  auth: {
    title: 'Auth Guide',
    description: 'Integrate Kuratchi auth, session handling, and organization management into SvelteKit.',
    content: authContent
  },
  database: {
    title: 'Database Guide',
    description: 'Durable Object-backed SQLite provisioning and typed runtime clients.',
    content: databaseContent
  },
  orm: {
    title: 'ORM Guide',
    description: 'Define schemas, query with includes, and manage migrations through the ORM layer.',
    content: ormContent
  },
  storage: {
    title: 'Storage',
    description: 'KV, R2, and D1 bindings exposed through the SvelteKit handle.',
    content: storageContent
  },
  notifications: {
    title: 'Notifications',
    description: 'In-app and email delivery with monitoring, templates, and queues.',
    content: notificationsContent
  },
  spaces: {
    title: 'Spaces',
    description: 'Durable Object chat clients, deployment helper, and token utilities.',
    content: spacesContent
  },
  stripe: {
    title: 'Stripe',
    description: 'Payments, subscriptions, checkout, and webhook handling.',
    content: stripeContent
  },
  cloud: {
    title: 'Kuratchi Cloud',
    description: 'Managed platform clients that run without Cloudflare credentials.',
    content: cloudContent
  },
  cli: {
    title: 'CLI Guide',
    description: 'Command-line tooling for admin provisioning and schema migrations.',
    content: cliContent
  }
};

const linkMap: Record<string, string> = {
  './README.md': '/docs',
  './auth.md': '/docs/auth',
  './database.md': '/docs/database',
  './orm.md': '/docs/orm',
  './storage.md': '/docs/storage',
  './notifications.md': '/docs/notifications',
  './spaces.md': '/docs/spaces',
  './stripe.md': '/docs/stripe',
  './cloud.md': '/docs/cloud',
  './cli.md': '/docs/cli'
};

function rewriteLinks(markdown: string) {
  return Object.entries(linkMap).reduce(
    (acc, [from, to]) => acc.replaceAll(`](${from})`, `](${to})`),
    markdown
  );
}

export function renderDoc(slug: DocSlug): DocContent | null {
  const doc = docs[slug];
  if (!doc) return null;

  const html = markdown.render(rewriteLinks(doc.content));

  return {
    title: doc.title,
    description: doc.description,
    html
  };
}

export const docNav = [
  { href: '/docs', label: 'Overview' },
  { href: '/docs/auth', label: 'Auth' },
  { href: '/docs/database', label: 'Database' },
  { href: '/docs/orm', label: 'ORM' },
  { href: '/docs/storage', label: 'Storage' },
  { href: '/docs/notifications', label: 'Notifications' },
  { href: '/docs/spaces', label: 'Spaces' },
  { href: '/docs/stripe', label: 'Stripe' },
  { href: '/docs/cloud', label: 'Kuratchi Cloud' },
  { href: '/docs/cli', label: 'CLI' }
];

export function isDocSlug(value: string): value is DocSlug {
  return value in docs;
}
