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
