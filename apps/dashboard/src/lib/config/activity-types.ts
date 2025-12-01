/**
 * Activity Type Definitions
 * 
 * Central configuration for all activity types tracked in the system.
 * Organized by category for easy maintenance.
 */

import type { ActivityTypeDefinition } from 'kuratchi-sdk/auth';

export const activityTypes: Record<string, ActivityTypeDefinition> = {
  // ============================================================================
  // Authentication & Session
  // ============================================================================
  'auth.login': {
    label: 'User Login',
    category: 'auth',
    severity: 'info',
    description: 'User successfully logged in',
    isAdminAction: false,
    isHidden: false
  },
  'auth.logout': {
    label: 'User Logout',
    category: 'auth',
    severity: 'info',
    description: 'User logged out',
    isAdminAction: false,
    isHidden: false
  },
  'auth.failed_login': {
    label: 'Failed Login',
    category: 'auth',
    severity: 'warning',
    description: 'Login attempt failed',
    isAdminAction: false,
    isHidden: false
  },
  'auth.signup': {
    label: 'User Signup',
    category: 'auth',
    severity: 'info',
    description: 'New user signed up',
    isAdminAction: false,
    isHidden: false
  },
  'auth.password_reset': {
    label: 'Password Reset',
    category: 'auth',
    severity: 'info',
    description: 'Password reset requested',
    isAdminAction: false,
    isHidden: false
  },
  'auth.password_changed': {
    label: 'Password Changed',
    category: 'auth',
    severity: 'info',
    description: 'User changed their password',
    isAdminAction: false,
    isHidden: false
  },
  'auth.email_verified': {
    label: 'Email Verified',
    category: 'auth',
    severity: 'info',
    description: 'User verified their email address',
    isAdminAction: false,
    isHidden: false
  },
  'auth.oauth_connected': {
    label: 'OAuth Connected',
    category: 'auth',
    severity: 'info',
    description: 'OAuth provider connected to account',
    isAdminAction: false,
    isHidden: false
  },
  'auth.oauth_disconnected': {
    label: 'OAuth Disconnected',
    category: 'auth',
    severity: 'info',
    description: 'OAuth provider disconnected from account',
    isAdminAction: false,
    isHidden: false
  },

  // ============================================================================
  // User Management
  // ============================================================================
  'user.created': {
    label: 'User Created',
    category: 'users',
    severity: 'info',
    description: 'New user account created',
    isAdminAction: true,
    isHidden: false
  },
  'user.updated': {
    label: 'User Updated',
    category: 'users',
    severity: 'info',
    description: 'User account updated',
    isAdminAction: false,
    isHidden: false
  },
  'user.deleted': {
    label: 'User Deleted',
    category: 'users',
    severity: 'warning',
    description: 'User account deleted',
    isAdminAction: true,
    isHidden: false
  },
  'user.role_changed': {
    label: 'Role Changed',
    category: 'users',
    severity: 'warning',
    description: 'User role was modified',
    isAdminAction: true,
    isHidden: false
  },
  'user.suspended': {
    label: 'User Suspended',
    category: 'users',
    severity: 'warning',
    description: 'User account suspended',
    isAdminAction: true,
    isHidden: false
  },
  'user.unsuspended': {
    label: 'User Unsuspended',
    category: 'users',
    severity: 'info',
    description: 'User account reactivated',
    isAdminAction: true,
    isHidden: false
  },
  'user.invited': {
    label: 'User Invited',
    category: 'users',
    severity: 'info',
    description: 'User invited to organization',
    isAdminAction: true,
    isHidden: false
  },
  'user.invite_accepted': {
    label: 'Invite Accepted',
    category: 'users',
    severity: 'info',
    description: 'User accepted invitation',
    isAdminAction: false,
    isHidden: false
  },
  'user.invite_resent': {
    label: 'Invite Resent',
    category: 'users',
    severity: 'info',
    description: 'Invitation email resent to user',
    isAdminAction: true,
    isHidden: false
  },
  'user.email_verification_sent': {
    label: 'Verification Email Sent',
    category: 'users',
    severity: 'info',
    description: 'Email verification request sent',
    isAdminAction: false,
    isHidden: false
  },
  'user.email_verified': {
    label: 'Email Verified',
    category: 'users',
    severity: 'info',
    description: 'User email address verified',
    isAdminAction: false,
    isHidden: false
  },

  // ============================================================================
  // Organization Management
  // ============================================================================
  'organization.created': {
    label: 'Organization Created',
    category: 'organizations',
    severity: 'info',
    description: 'New organization created',
    isAdminAction: false,
    isHidden: false
  },
  'organization.updated': {
    label: 'Organization Updated',
    category: 'organizations',
    severity: 'info',
    description: 'Organization details updated',
    isAdminAction: false,
    isHidden: false
  },
  'organization.deleted': {
    label: 'Organization Deleted',
    category: 'organizations',
    severity: 'critical',
    description: 'Organization deleted',
    isAdminAction: true,
    isHidden: false
  },
  'organization.member_added': {
    label: 'Member Added',
    category: 'organizations',
    severity: 'info',
    description: 'New member added to organization',
    isAdminAction: false,
    isHidden: false
  },
  'organization.member_removed': {
    label: 'Member Removed',
    category: 'organizations',
    severity: 'warning',
    description: 'Member removed from organization',
    isAdminAction: false,
    isHidden: false
  },
  'organization.settings_changed': {
    label: 'Settings Changed',
    category: 'organizations',
    severity: 'info',
    description: 'Organization settings modified',
    isAdminAction: false,
    isHidden: false
  },

  // ============================================================================
  // Database Management
  // ============================================================================
  'database.created': {
    label: 'Database Created',
    category: 'databases',
    severity: 'info',
    description: 'New database provisioned',
    isAdminAction: false,
    isHidden: false
  },
  'database.deleted': {
    label: 'Database Deleted',
    category: 'databases',
    severity: 'critical',
    description: 'Database removed',
    isAdminAction: false,
    isHidden: false
  },
  'database.migrated': {
    label: 'Database Migrated',
    category: 'databases',
    severity: 'warning',
    description: 'Database schema migrated',
    isAdminAction: false,
    isHidden: false
  },
  'database.backup_created': {
    label: 'Backup Created',
    category: 'databases',
    severity: 'info',
    description: 'Database backup created',
    isAdminAction: false,
    isHidden: false
  },
  'database.restored': {
    label: 'Database Restored',
    category: 'databases',
    severity: 'critical',
    description: 'Database restored from backup',
    isAdminAction: false,
    isHidden: false
  },

  // ============================================================================
  // Domain Management
  // ============================================================================
  'domain.created': {
    label: 'Domain Created',
    category: 'domains',
    severity: 'info',
    description: 'New domain added',
    isAdminAction: false,
    isHidden: false
  },
  'domain.deleted': {
    label: 'Domain Deleted',
    category: 'domains',
    severity: 'warning',
    description: 'Domain removed',
    isAdminAction: false,
    isHidden: false
  },
  'domain.verified': {
    label: 'Domain Verified',
    category: 'domains',
    severity: 'info',
    description: 'Domain ownership verified',
    isAdminAction: false,
    isHidden: false
  },
  'domain.ssl_enabled': {
    label: 'SSL Enabled',
    category: 'domains',
    severity: 'info',
    description: 'SSL certificate activated',
    isAdminAction: false,
    isHidden: false
  },

  // ============================================================================
  // Site & Content
  // ============================================================================
  'sites.viewed': {
    label: 'Sites Viewed',
    category: 'sites',
    severity: 'info',
    description: 'User accessed sites list',
    isAdminAction: false,
    isHidden: true
  },
  'sites.created': {
    label: 'Site Created',
    category: 'sites',
    severity: 'info',
    description: 'New site created',
    isAdminAction: false,
    isHidden: false
  },
  'sites.updated': {
    label: 'Site Updated',
    category: 'sites',
    severity: 'info',
    description: 'Site settings updated',
    isAdminAction: false,
    isHidden: false
  },
  'sites.deleted': {
    label: 'Site Deleted',
    category: 'sites',
    severity: 'warning',
    description: 'Site removed',
    isAdminAction: false,
    isHidden: false
  },
  'site.created': {
    label: 'Site Created',
    category: 'sites',
    severity: 'info',
    description: 'New site created',
    isAdminAction: false,
    isHidden: false
  },
  'site.updated': {
    label: 'Site Updated',
    category: 'sites',
    severity: 'info',
    description: 'Site settings updated',
    isAdminAction: false,
    isHidden: false
  },
  'site.deleted': {
    label: 'Site Deleted',
    category: 'sites',
    severity: 'warning',
    description: 'Site removed',
    isAdminAction: false,
    isHidden: false
  },
  'site.published': {
    label: 'Site Published',
    category: 'sites',
    severity: 'info',
    description: 'Site published live',
    isAdminAction: false,
    isHidden: false
  },
  'site.unpublished': {
    label: 'Site Unpublished',
    category: 'sites',
    severity: 'warning',
    description: 'Site taken offline',
    isAdminAction: false,
    isHidden: false
  },

  // ============================================================================
  // Forms & Leads
  // ============================================================================
  'forms.create': {
    label: 'Form Created',
    category: 'forms',
    severity: 'info',
    description: 'New form created',
    isAdminAction: false,
    isHidden: false
  },
  'forms.update': {
    label: 'Form Updated',
    category: 'forms',
    severity: 'info',
    description: 'Form settings updated',
    isAdminAction: false,
    isHidden: false
  },
  'forms.delete': {
    label: 'Form Deleted',
    category: 'forms',
    severity: 'warning',
    description: 'Form removed',
    isAdminAction: false,
    isHidden: false
  },
  'forms.attach': {
    label: 'Form Attached',
    category: 'forms',
    severity: 'info',
    description: 'Form attached to site',
    isAdminAction: false,
    isHidden: false
  },
  'forms.detach': {
    label: 'Form Detached',
    category: 'forms',
    severity: 'info',
    description: 'Form detached from site',
    isAdminAction: false,
    isHidden: false
  },
  'leads.created': {
    label: 'Lead Created',
    category: 'leads',
    severity: 'info',
    description: 'New form submission received',
    isAdminAction: false,
    isHidden: false
  },
  'leads.update': {
    label: 'Lead Updated',
    category: 'leads',
    severity: 'info',
    description: 'Lead status updated',
    isAdminAction: false,
    isHidden: false
  },
  'leads.exported': {
    label: 'Leads Exported',
    category: 'leads',
    severity: 'info',
    description: 'Leads exported to CSV',
    isAdminAction: false,
    isHidden: false
  },

  // ============================================================================
  // Storage & Media
  // ============================================================================
  'storage.file_uploaded': {
    label: 'File Uploaded',
    category: 'storage',
    severity: 'info',
    description: 'File uploaded to storage',
    isAdminAction: false,
    isHidden: false
  },
  'storage.file_deleted': {
    label: 'File Deleted',
    category: 'storage',
    severity: 'info',
    description: 'File removed from storage',
    isAdminAction: false,
    isHidden: false
  },
  'storage.quota_exceeded': {
    label: 'Quota Exceeded',
    category: 'storage',
    severity: 'warning',
    description: 'Storage quota limit reached',
    isAdminAction: false,
    isHidden: false
  },

  // ============================================================================
  // Billing & Subscriptions
  // ============================================================================
  'billing.subscription_created': {
    label: 'Subscription Created',
    category: 'billing',
    severity: 'info',
    description: 'New subscription started',
    isAdminAction: false,
    isHidden: false
  },
  'billing.subscription_updated': {
    label: 'Subscription Updated',
    category: 'billing',
    severity: 'info',
    description: 'Subscription plan changed',
    isAdminAction: false,
    isHidden: false
  },
  'billing.subscription_cancelled': {
    label: 'Subscription Cancelled',
    category: 'billing',
    severity: 'warning',
    description: 'Subscription cancelled',
    isAdminAction: false,
    isHidden: false
  },
  'billing.payment_succeeded': {
    label: 'Payment Succeeded',
    category: 'billing',
    severity: 'info',
    description: 'Payment processed successfully',
    isAdminAction: false,
    isHidden: false
  },
  'billing.payment_failed': {
    label: 'Payment Failed',
    category: 'billing',
    severity: 'critical',
    description: 'Payment processing failed',
    isAdminAction: false,
    isHidden: false
  },
  'billing.invoice_created': {
    label: 'Invoice Created',
    category: 'billing',
    severity: 'info',
    description: 'New invoice generated',
    isAdminAction: false,
    isHidden: false
  },

  // ============================================================================
  // Email
  // ============================================================================
  'email.sent': {
    label: 'Email Sent',
    category: 'email',
    severity: 'info',
    description: 'Email sent successfully',
    isAdminAction: false,
    isHidden: true
  },
  'email.failed': {
    label: 'Email Failed',
    category: 'email',
    severity: 'warning',
    description: 'Email delivery failed',
    isAdminAction: false,
    isHidden: true
  },
  'email.bounced': {
    label: 'Email Bounced',
    category: 'email',
    severity: 'warning',
    description: 'Email bounced back',
    isAdminAction: false,
    isHidden: true
  },

  // ============================================================================
  // Editor & Pages
  // ============================================================================
  'editor.page_created': {
    label: 'Page Created',
    category: 'editor',
    severity: 'info',
    description: 'New page created',
    isAdminAction: false,
    isHidden: false
  },
  'editor.page_updated': {
    label: 'Page Updated',
    category: 'editor',
    severity: 'info',
    description: 'Page content updated',
    isAdminAction: false,
    isHidden: false
  },
  'editor.page_deleted': {
    label: 'Page Deleted',
    category: 'editor',
    severity: 'warning',
    description: 'Page removed',
    isAdminAction: false,
    isHidden: false
  },
  'editor.page_published': {
    label: 'Page Published',
    category: 'editor',
    severity: 'info',
    description: 'Page published live',
    isAdminAction: false,
    isHidden: false
  },
  'editor.site_settings_updated': {
    label: 'Site Settings Updated',
    category: 'editor',
    severity: 'info',
    description: 'Site settings modified in editor',
    isAdminAction: false,
    isHidden: false
  },

  // ============================================================================
  // Newsletter & Subscribers
  // ============================================================================
  'newsletter.subscriber_added': {
    label: 'Subscriber Added',
    category: 'newsletter',
    severity: 'info',
    description: 'New subscriber added',
    isAdminAction: false,
    isHidden: false
  },
  'newsletter.subscriber_removed': {
    label: 'Subscriber Removed',
    category: 'newsletter',
    severity: 'info',
    description: 'Subscriber removed',
    isAdminAction: false,
    isHidden: false
  },
  'newsletter.subscriber_imported': {
    label: 'Subscribers Imported',
    category: 'newsletter',
    severity: 'info',
    description: 'Subscribers imported from file',
    isAdminAction: false,
    isHidden: false
  },
  'newsletter.list_created': {
    label: 'List Created',
    category: 'newsletter',
    severity: 'info',
    description: 'New subscriber list created',
    isAdminAction: false,
    isHidden: false
  },
  'newsletter.list_deleted': {
    label: 'List Deleted',
    category: 'newsletter',
    severity: 'warning',
    description: 'Subscriber list deleted',
    isAdminAction: false,
    isHidden: false
  },

  // ============================================================================
  // Broadcasts & Campaigns
  // ============================================================================
  'broadcast.created': {
    label: 'Broadcast Created',
    category: 'broadcasts',
    severity: 'info',
    description: 'New broadcast created',
    isAdminAction: false,
    isHidden: false
  },
  'broadcast.updated': {
    label: 'Broadcast Updated',
    category: 'broadcasts',
    severity: 'info',
    description: 'Broadcast updated',
    isAdminAction: false,
    isHidden: false
  },
  'broadcast.sent': {
    label: 'Broadcast Sent',
    category: 'broadcasts',
    severity: 'info',
    description: 'Broadcast sent to subscribers',
    isAdminAction: false,
    isHidden: false
  },
  'broadcast.scheduled': {
    label: 'Broadcast Scheduled',
    category: 'broadcasts',
    severity: 'info',
    description: 'Broadcast scheduled for future delivery',
    isAdminAction: false,
    isHidden: false
  },
  'broadcast.deleted': {
    label: 'Broadcast Deleted',
    category: 'broadcasts',
    severity: 'warning',
    description: 'Broadcast deleted',
    isAdminAction: false,
    isHidden: false
  },

  // ============================================================================
  // API Keys
  // ============================================================================
  'apikey.created': {
    label: 'API Key Created',
    category: 'api',
    severity: 'info',
    description: 'New API key generated',
    isAdminAction: false,
    isHidden: false
  },
  'apikey.revoked': {
    label: 'API Key Revoked',
    category: 'api',
    severity: 'warning',
    description: 'API key revoked',
    isAdminAction: false,
    isHidden: false
  },
  'apikey.deleted': {
    label: 'API Key Deleted',
    category: 'api',
    severity: 'warning',
    description: 'API key deleted',
    isAdminAction: false,
    isHidden: false
  },

  // ============================================================================
  // Roles & Permissions
  // ============================================================================
  'role.created': {
    label: 'Role Created',
    category: 'roles',
    severity: 'info',
    description: 'New role created',
    isAdminAction: true,
    isHidden: false
  },
  'role.updated': {
    label: 'Role Updated',
    category: 'roles',
    severity: 'warning',
    description: 'Role permissions updated',
    isAdminAction: true,
    isHidden: false
  },
  'role.deleted': {
    label: 'Role Deleted',
    category: 'roles',
    severity: 'warning',
    description: 'Role deleted',
    isAdminAction: true,
    isHidden: false
  },

  // ============================================================================
  // Custom Domains
  // ============================================================================
  'customdomain.added': {
    label: 'Custom Domain Added',
    category: 'domains',
    severity: 'info',
    description: 'Custom domain added to site',
    isAdminAction: false,
    isHidden: false
  },
  'customdomain.removed': {
    label: 'Custom Domain Removed',
    category: 'domains',
    severity: 'warning',
    description: 'Custom domain removed from site',
    isAdminAction: false,
    isHidden: false
  },
  'customdomain.verified': {
    label: 'Custom Domain Verified',
    category: 'domains',
    severity: 'info',
    description: 'Custom domain ownership verified',
    isAdminAction: false,
    isHidden: false
  },

  // ============================================================================
  // Products
  // ============================================================================
  'product.created': {
    label: 'Product Created',
    category: 'products',
    severity: 'info',
    description: 'New product created',
    isAdminAction: false,
    isHidden: false
  },
  'product.updated': {
    label: 'Product Updated',
    category: 'products',
    severity: 'info',
    description: 'Product updated',
    isAdminAction: false,
    isHidden: false
  },
  'product.deleted': {
    label: 'Product Deleted',
    category: 'products',
    severity: 'warning',
    description: 'Product deleted',
    isAdminAction: false,
    isHidden: false
  },

  // ============================================================================
  // System & Admin
  // ============================================================================
  'system.error': {
    label: 'System Error',
    category: 'system',
    severity: 'critical',
    description: 'System error occurred',
    isAdminAction: true,
    isHidden: true
  },
  'system.maintenance_started': {
    label: 'Maintenance Started',
    category: 'system',
    severity: 'warning',
    description: 'System maintenance mode enabled',
    isAdminAction: true,
    isHidden: false
  },
  'system.maintenance_ended': {
    label: 'Maintenance Ended',
    category: 'system',
    severity: 'info',
    description: 'System maintenance mode disabled',
    isAdminAction: true,
    isHidden: false
  },
  'admin.settings_changed': {
    label: 'Admin Settings Changed',
    category: 'admin',
    severity: 'warning',
    description: 'System settings modified by admin',
    isAdminAction: true,
    isHidden: false
  },
  'admin.user_impersonated': {
    label: 'User Impersonated',
    category: 'admin',
    severity: 'critical',
    description: 'Admin impersonated a user account',
    isAdminAction: true,
    isHidden: false
  }
};
