/**
 * Notification Types and Interfaces
 * Comprehensive type definitions for the notifications system
 */

import type { RequestEvent } from '@sveltejs/kit';

/**
 * Notification priority levels
 */
export type NotificationPriority = 'urgent' | 'high' | 'normal' | 'low';

/**
 * Notification status
 */
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'cancelled';

/**
 * Notification channels
 */
export type NotificationChannel = 'in-app' | 'email' | 'both';

/**
 * Email provider types
 */
export type EmailProvider = 'ses' | 'cloudflare';

/**
 * Notification categories for organization and filtering
 */
export type NotificationCategory =
  | 'system'           // System-level notifications
  | 'database'         // Database-related notifications
  | 'security'         // Security alerts
  | 'billing'          // Billing and payment notifications
  | 'account'          // Account-related notifications
  | 'feature'          // Feature updates and announcements
  | 'monitoring'       // Platform monitoring alerts
  | 'custom';          // Custom user-defined notifications

/**
 * Platform monitoring alert types
 */
export type PlatformAlertType =
  | 'excessive_db_creation'
  | 'excessive_signups'
  | 'excessive_api_calls'
  | 'quota_exceeded'
  | 'rate_limit_exceeded'
  | 'suspicious_activity'
  | 'system_error'
  | 'performance_degradation';

/**
 * Base notification interface
 */
export interface BaseNotification {
  id?: string;
  title: string;
  message: string;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  channel?: NotificationChannel;
  metadata?: Record<string, any>;
  createdAt?: string;
}

/**
 * In-app notification record (stored in database)
 */
export interface InAppNotification extends BaseNotification {
  id: string;
  userId?: string;
  organizationId?: string;
  status: NotificationStatus;
  readAt?: string;
  actionUrl?: string;
  actionLabel?: string;
  iconUrl?: string;
  expiresAt?: string;
  groupKey?: string; // For grouping related notifications
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/**
 * Email notification record (stored in database for tracking)
 */
export interface EmailNotification {
  id: string;
  title?: string;
  message?: string;
  to: string | string[];
  from: string;
  subject: string;
  html?: string;
  text?: string;
  provider: EmailProvider;
  userId?: string;
  organizationId?: string;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  status: NotificationStatus;
  providerId?: string; // Email provider's tracking ID
  error?: string;
  sentAt?: string;
  deliveredAt?: string;
  openedAt?: string;
  clickedAt?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  tags?: { name: string; value: string }[];
  headers?: Record<string, string>;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/**
 * Platform alert notification
 */
export interface PlatformAlert {
  id: string;
  type: PlatformAlertType;
  severity: NotificationPriority;
  title: string;
  message: string;
  affectedResource?: string;
  affectedUserId?: string;
  affectedOrgId?: string;
  threshold?: number;
  currentValue?: number;
  timeWindow?: string; // e.g., "5 minutes", "1 hour"
  metadata?: Record<string, any>;
  resolvedAt?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Notification template
 */
export interface NotificationTemplate {
  id: string;
  name: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  subject?: string; // For email
  title: string;
  message: string;
  html?: string; // For email
  actionUrl?: string;
  actionLabel?: string;
  variables?: string[]; // List of variable names used in template
  isActive: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * User notification preferences
 */
export interface NotificationPreferences {
  id: string;
  userId: string;
  organizationId?: string;

  // Channel preferences
  enableInApp: boolean;
  enableEmail: boolean;

  // Category preferences
  categories: {
    [K in NotificationCategory]?: {
      enabled: boolean;
      channels: NotificationChannel[];
      minPriority?: NotificationPriority;
    };
  };

  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart?: string; // HH:MM format
  quietHoursEnd?: string;   // HH:MM format
  quietHoursTimezone?: string;

  // Digest preferences
  enableDigest: boolean;
  digestFrequency?: 'daily' | 'weekly' | 'monthly';
  digestTime?: string; // HH:MM format

  created_at: string;
  updated_at: string;
}

/**
 * Notification queue message
 */
export interface NotificationQueueMessage {
  id: string;
  type: 'in-app' | 'email' | 'platform-alert';
  priority: NotificationPriority;

  // Target recipients
  userId?: string;
  organizationId?: string;
  email?: string | string[];

  // Notification content
  notification: BaseNotification;

  // Email-specific data
  emailData?: {
    subject: string;
    html?: string;
    text?: string;
    from?: string;
    replyTo?: string;
    provider?: EmailProvider;
    tags?: { name: string; value: string }[];
    headers?: Record<string, string>;
  };

  // Platform alert specific data
  alertData?: Partial<PlatformAlert>;

  // Queue metadata
  retryCount?: number;
  maxRetries?: number;
  scheduledFor?: string; // ISO timestamp for delayed delivery
  created_at: string;
}

/**
 * Options for sending in-app notifications
 */
export interface SendInAppNotificationOptions extends BaseNotification {
  userId?: string;
  organizationId?: string;
  actionUrl?: string;
  actionLabel?: string;
  iconUrl?: string;
  expiresAt?: string;
  groupKey?: string;
  sendImmediately?: boolean; // If false, queue for batch processing
}

/**
 * Options for sending email notifications
 */
export interface SendEmailNotificationOptions extends BaseNotification {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  fromName?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  provider?: EmailProvider; // 'ses' for users, 'cloudflare' for system
  userId?: string;
  organizationId?: string;
  tags?: { name: string; value: string }[];
  headers?: Record<string, string>;
  templateId?: string; // Use a predefined template
  templateVars?: Record<string, any>; // Variables for template
  sendImmediately?: boolean; // If false, queue for batch processing
}

/**
 * Options for creating platform alerts
 */
export interface CreatePlatformAlertOptions {
  type: PlatformAlertType;
  severity?: NotificationPriority;
  title: string;
  message: string;
  affectedResource?: string;
  affectedUserId?: string;
  affectedOrgId?: string;
  threshold?: number;
  currentValue?: number;
  timeWindow?: string;
  metadata?: Record<string, any>;
  notifySystemEmail?: boolean; // Send to system admin email
  systemEmail?: string;
}

/**
 * Notification query filters
 */
export interface NotificationFilters {
  userId?: string;
  organizationId?: string;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  status?: NotificationStatus;
  channel?: NotificationChannel;
  startDate?: string;
  endDate?: string;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Platform monitoring thresholds
 */
export interface MonitoringThresholds {
  // Database creation limits
  maxDatabasesPerHour?: number;
  maxDatabasesPerDay?: number;

  // Signup limits
  maxSignupsPerMinute?: number;
  maxSignupsPerHour?: number;

  // API call limits
  maxApiCallsPerMinute?: number;
  maxApiCallsPerHour?: number;

  // Error thresholds
  maxErrorRatePercent?: number;
  maxErrorsPerMinute?: number;
}

/**
 * Notification plugin options
 */
export interface NotificationPluginOptions {
	/**
	 * Amazon SES configuration for user emails
	 */
	sesRegion?: string;
	sesAccessKeyId?: string;
	sesSecretAccessKey?: string;
	sesFrom?: string;
	sesFromName?: string;
	sesConfigurationSetName?: string;

	/**
	 * Cloudflare Email Routing configuration for system emails
	 */
	cloudflareEmail?: {
		from: string; // e.g., 'noreply@yourdomain.com'
		apiToken?: string;
		accountId?: string;
	};  /**
   * System admin email for platform alerts
   */
  systemEmail?: string;

  /**
   * Enable in-app notifications (default: true)
   */
  enableInApp?: boolean;

  /**
   * Enable email notifications (default: true)
   */
  enableEmail?: boolean;

  /**
   * Enable platform monitoring (default: true)
   */
  enableMonitoring?: boolean;

  /**
   * Platform monitoring thresholds
   */
  monitoringThresholds?: MonitoringThresholds;

  /**
   * Database source for notification storage (default: 'admin')
   */
  storageDb?: 'admin' | 'org';

  /**
   * Queue name for Cloudflare Workers Queue
   */
  queueName?: string;

  /**
   * Enable queue-based processing (default: true)
   */
  enableQueue?: boolean;

  /**
   * Batch size for processing notifications (default: 10)
   */
  batchSize?: number;

  /**
   * Default notification expiry (in days, default: 30)
   */
  defaultExpiryDays?: number;
}

/**
 * Notification result
 */
export interface NotificationResult {
  success: boolean;
  id?: string;
  error?: string;
  queuedForBatch?: boolean;
}

/**
 * Batch notification result
 */
export interface BatchNotificationResult {
  total: number;
  successful: number;
  failed: number;
  results: NotificationResult[];
  errors?: string[];
}

/**
 * Notification statistics
 */
export interface NotificationStats {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  pending: number;
  byCategory: Record<NotificationCategory, number>;
  byPriority: Record<NotificationPriority, number>;
  byChannel: Record<NotificationChannel, number>;
}
