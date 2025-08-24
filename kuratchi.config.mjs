export default {
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
  apiToken: process.env.CLOUDFLARE_API_TOKEN || '',
  workersSubdomain: process.env.CLOUDFLARE_WORKERS_SUBDOMAIN || '',
  adminSchemaFile: './schema/admin.ts',
  organizationSchemaFile: './schema/organization.ts'
};
