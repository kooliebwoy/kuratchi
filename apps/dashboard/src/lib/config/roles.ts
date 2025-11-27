/**
 * Dashboard Role Definitions
 * 
 * These are OUR roles for managing OUR dashboard.
 * We're developers - we manage roles via code (Free Tier approach).
 * 
 * The Platform API and database are for OUR CUSTOMERS to manage THEIR roles.
 * When customers use Kuratchi:
 * - Free Tier: They create their own config file like this
 * - Cloud Tier: They use our Platform API to manage roles in their databases
 * 
 * Structure:
 * - Each role has an array of permissions
 * - Permissions can be strings or objects with labels/descriptions
 * - Supports wildcards: 'posts.*' matches 'posts.create', 'posts.edit', etc.
 * - Supports global wildcard: '*' grants all permissions
 */

import type { RoleDefinitions } from 'kuratchi-sdk/auth';

export const roles: RoleDefinitions = {
  // ============================================================================
  // Superadmin (Full System Access)
  // ============================================================================
  superadmin: [
    {
      value: '*',
      label: 'All Permissions',
      description: 'Full system access - use with caution'
    }
  ],

  // ============================================================================
  // Owner (Organization Admin)
  // ============================================================================
  owner: [
    // Organization Management
    { value: 'organization.read', label: 'View Organization', description: 'View organization details' },
    { value: 'organization.update', label: 'Update Organization', description: 'Modify organization settings' },
    { value: 'organization.delete', label: 'Delete Organization', description: 'Remove organization' },
    
    // Member Management
    { value: 'members.*', label: 'All Member Permissions', description: 'Full control over team members' },
    
    // Billing & Subscriptions
    { value: 'billing.*', label: 'All Billing Permissions', description: 'Manage subscriptions and payments' },
    
    // Settings
    { value: 'settings.*', label: 'All Settings', description: 'Manage all organization settings' },
    
    // Content (inherited from editor)
    { value: 'posts.*', label: 'All Post Permissions' },
    { value: 'media.*', label: 'All Media Permissions' },
    { value: 'sites.*', label: 'All Site Permissions' },
    
    // Forms & Leads
    { value: 'forms.*', label: 'All Form Permissions', description: 'Full control over forms' },
    { value: 'leads.*', label: 'All Lead Permissions', description: 'Full control over leads' },
    
    // Databases
    { value: 'databases.*', label: 'All Database Permissions' },
    
    // Domains
    { value: 'domains.*', label: 'All Domain Permissions' },
  ],

  // ============================================================================
  // Editor (Content Manager)
  // ============================================================================
  editor: [
    // Posts
    { value: 'posts.create', label: 'Create Posts', description: 'Create new posts' },
    { value: 'posts.read', label: 'Read Posts', description: 'View all posts' },
    { value: 'posts.update', label: 'Update Posts', description: 'Edit existing posts' },
    { value: 'posts.delete', label: 'Delete Posts', description: 'Remove posts' },
    { value: 'posts.publish', label: 'Publish Posts', description: 'Publish posts live' },
    
    // Media
    { value: 'media.upload', label: 'Upload Media', description: 'Upload images and files' },
    { value: 'media.read', label: 'View Media', description: 'Browse media library' },
    { value: 'media.delete', label: 'Delete Media', description: 'Remove media files' },
    
    // Sites
    { value: 'sites.read', label: 'View Sites', description: 'View site configurations' },
    { value: 'sites.update', label: 'Update Sites', description: 'Modify site settings' },
    
    // Forms & Leads
    { value: 'forms.read', label: 'View Forms', description: 'View form configurations' },
    { value: 'forms.write', label: 'Manage Forms', description: 'Create and edit forms' },
    { value: 'leads.read', label: 'View Leads', description: 'View form submissions' },
    { value: 'leads.write', label: 'Manage Leads', description: 'Update lead status' },
    
    // Comments (moderation)
    { value: 'comments.read', label: 'Read Comments', description: 'View comments' },
    { value: 'comments.moderate', label: 'Moderate Comments', description: 'Approve/reject comments' },
    { value: 'comments.delete', label: 'Delete Comments', description: 'Remove comments' },
    
    // Organization (read-only)
    { value: 'organization.read', label: 'View Organization', description: 'View organization details' },
  ],

  // ============================================================================
  // Member (Basic Team Member)
  // ============================================================================
  member: [
    // Posts (limited)
    { value: 'posts.create', label: 'Create Posts', description: 'Create new posts' },
    { value: 'posts.read', label: 'Read Posts', description: 'View all posts' },
    { value: 'posts.update.own', label: 'Update Own Posts', description: 'Edit own posts only' },
    
    // Media
    { value: 'media.upload', label: 'Upload Media', description: 'Upload images and files' },
    { value: 'media.read', label: 'View Media', description: 'Browse media library' },
    
    // Sites (read-only)
    { value: 'sites.read', label: 'View Sites', description: 'View site configurations' },
    
    // Forms & Leads (read-only)
    { value: 'forms.read', label: 'View Forms', description: 'View form configurations' },
    { value: 'leads.read', label: 'View Leads', description: 'View form submissions' },
    
    // Comments
    { value: 'comments.read', label: 'Read Comments', description: 'View comments' },
    
    // Organization (read-only)
    { value: 'organization.read', label: 'View Organization', description: 'View organization details' },
  ],

  // ============================================================================
  // Viewer (Read-Only Access)
  // ============================================================================
  viewer: [
    { value: 'posts.read', label: 'Read Posts', description: 'View all posts' },
    { value: 'media.read', label: 'View Media', description: 'Browse media library' },
    { value: 'sites.read', label: 'View Sites', description: 'View site configurations' },
    { value: 'comments.read', label: 'Read Comments', description: 'View comments' },
    { value: 'organization.read', label: 'View Organization', description: 'View organization details' },
  ],

  // ============================================================================
  // Moderator (Content Moderation)
  // ============================================================================
  moderator: [
    // Posts (full access)
    { value: 'posts.*', label: 'All Post Permissions', description: 'Full post management' },
    
    // Comments (full moderation)
    { value: 'comments.*', label: 'All Comment Permissions', description: 'Full comment moderation' },
    
    // Media (read + delete)
    { value: 'media.read', label: 'View Media', description: 'Browse media library' },
    { value: 'media.delete', label: 'Delete Media', description: 'Remove inappropriate media' },
    
    // Users (moderation)
    { value: 'users.read', label: 'View Users', description: 'View user profiles' },
    { value: 'users.suspend', label: 'Suspend Users', description: 'Temporarily suspend users' },
    
    // Organization (read-only)
    { value: 'organization.read', label: 'View Organization', description: 'View organization details' },
  ],

  // ============================================================================
  // Developer (Technical Access)
  // ============================================================================
  developer: [
    // Databases
    { value: 'databases.create', label: 'Create Databases', description: 'Provision new databases' },
    { value: 'databases.read', label: 'Read Databases', description: 'View database configurations' },
    { value: 'databases.update', label: 'Update Databases', description: 'Modify database settings' },
    { value: 'databases.migrate', label: 'Run Migrations', description: 'Execute schema migrations' },
    { value: 'databases.backup', label: 'Backup Databases', description: 'Create database backups' },
    
    // API Tokens
    { value: 'api-tokens.create', label: 'Create API Tokens', description: 'Generate API access tokens' },
    { value: 'api-tokens.read', label: 'Read API Tokens', description: 'View API tokens' },
    { value: 'api-tokens.revoke', label: 'Revoke API Tokens', description: 'Revoke API access' },
    
    // Domains
    { value: 'domains.create', label: 'Add Domains', description: 'Add new domains' },
    { value: 'domains.read', label: 'View Domains', description: 'View domain configurations' },
    { value: 'domains.update', label: 'Update Domains', description: 'Modify domain settings' },
    { value: 'domains.verify', label: 'Verify Domains', description: 'Verify domain ownership' },
    
    // Sites
    { value: 'sites.*', label: 'All Site Permissions', description: 'Full site management' },
    
    // Activity Logs
    { value: 'activity.read', label: 'View Activity Logs', description: 'View system activity' },
    
    // Organization (read-only)
    { value: 'organization.read', label: 'View Organization', description: 'View organization details' },
  ],

  // ============================================================================
  // Billing Manager (Finance Role)
  // ============================================================================
  billing: [
    // Billing
    { value: 'billing.read', label: 'View Billing', description: 'View invoices and payments' },
    { value: 'billing.update', label: 'Update Billing', description: 'Manage payment methods' },
    { value: 'billing.subscriptions', label: 'Manage Subscriptions', description: 'Change plans' },
    
    // Organization (read-only)
    { value: 'organization.read', label: 'View Organization', description: 'View organization details' },
    
    // Reports
    { value: 'reports.read', label: 'View Reports', description: 'View usage reports' },
  ],
};

/**
 * Permission Categories (for UI organization)
 */
export const permissionCategories = {
  organization: 'Organization Management',
  members: 'Team & Members',
  posts: 'Content & Posts',
  media: 'Media Library',
  sites: 'Site Management',
  comments: 'Comments & Moderation',
  users: 'User Management',
  databases: 'Database Management',
  domains: 'Domain Management',
  'api-tokens': 'API Access',
  billing: 'Billing & Subscriptions',
  settings: 'Settings',
  activity: 'Activity & Logs',
  reports: 'Reports & Analytics',
  forms: 'Forms Management',
  leads: 'Leads & Submissions',
};
