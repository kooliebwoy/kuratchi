import {
	sessionPlugin,
	adminPlugin,
	organizationPlugin,
	credentialsPlugin,
	activityPlugin,
	rolesPlugin,
	oauthPlugin,
	rateLimitPlugin,
	turnstilePlugin,
	guardsPlugin,
	requireAuth,
	emailVerificationPlugin,
} from 'kuratchi-sdk/auth';
import { d1Adapter, rpcAdapter } from 'kuratchi-sdk/adapters';
import type { KuratchiSDK } from 'kuratchi-sdk';
import { kuratchi } from 'kuratchi-sdk';
import { adminSchema } from '$lib/schemas/admin';
import { organizationSchema } from '$lib/schemas/organization';
import { activityTypes } from '$lib/config/activity-types';
import { roles } from '$lib/config/roles';
import { env } from '$env/dynamic/private';

/**
 * Central Kuratchi SDK instance for the dashboard application.
 * Extend this file as new plugins/services are added.
 */
export const kuratchiHandle: KuratchiSDK = kuratchi({
	// Enable caching for improved performance
	database: {
		rpcBinding: 'KURATCHI_DATABASE' // Enable RPC mode
	},
	cache: {
		enabled: true,
		kvNamespace: 'KV', // Use the default KV namespace for caching
		metadataTtlSeconds: 3600, // Cache org metadata for 1 hour
		schemaSyncTtlSeconds: 86400, // Cache schema sync status for 24 hours
		debug: false // Set to true to see cache hit/miss logs
	},
	auth: {
		plugins: [
			rateLimitPlugin({
				defaultWindowMs: 60_000,
				defaultMaxRequests: 10,
				includeDefaultRoutes: true
			}),
			turnstilePlugin({
				includeDefaultRoutes: true,
				disableInDev: true
			}),
			sessionPlugin(),
			adminPlugin({
				adminSchema,
				organizationSchema,
				adapter: d1Adapter({ binding: 'ADMIN_DB' })
			}),
			organizationPlugin({
				organizationSchema,
				skipMigrations: false, // Temporarily enabled to apply menus/menuSites tables migration
				adapter: rpcAdapter({ binding: 'KURATCHI_DATABASE' })
			}),
			credentialsPlugin(),
			oauthPlugin({
				providers: [
					{
						name: 'google',
						clientId: env.GOOGLE_CLIENT_ID || '',
						clientSecret: env.GOOGLE_CLIENT_SECRET || ''
					},
					{
						name: 'github',
						clientId: env.GITHUB_CLIENT_ID || '',
						clientSecret: env.GITHUB_CLIENT_SECRET || ''
					}
				]
			}),
			emailVerificationPlugin(),
			activityPlugin({ define: activityTypes }),
			rolesPlugin({
				define: roles,
				default: 'viewer'
			}),
			guardsPlugin(
				requireAuth({
					paths: ['*'],
					exclude: ['/auth/*', '/api/*'],
					redirectTo: '/auth/signin'
				})
			)
		]
	},
	email: {
		region: env.AWS_SES_REGION || env.AWS_REGION || 'us-east-2',
		accessKeyId: env.AWS_ACCESS_KEY_ID || '',
		secretAccessKey: env.AWS_SECRET_ACCESS_KEY || '',
		from: env.RESEND_FROM_EMAIL || 'noreply@kuratchi.dev',
		fromName: 'Kuratchi',
		trackEmails: true,
		trackingDb: 'org',
		trackingTable: 'email_logs',
		configurationSetName: 'kuratchi-email-tracking'
	},
	storage: {
		kv: { default: 'KV', KV: 'KV' },
		r2: { default: 'BUCKET', R2: 'BUCKET' }
	},
	stripe: {
		apiKey: env.STRIPE_SECRET_KEY,
		trackEvents: true,
		trackingDb: 'admin'
	},
	notifications: {
		// Amazon SES for user emails
		sesRegion: env.AWS_SES_REGION || env.AWS_REGION || 'us-east-1',
		sesAccessKeyId: env.AWS_ACCESS_KEY_ID || '',
		sesSecretAccessKey: env.AWS_SECRET_ACCESS_KEY || '',
		sesFrom: env.SES_FROM_EMAIL || env.RESEND_FROM_EMAIL || 'noreply@kuratchi.dev',
		sesFromName: 'Kuratchi',
		sesConfigurationSetName: env.SES_CONFIGURATION_SET,

		// Cloudflare Email for system emails
		cloudflareEmail: {
			from: 'system@kuratchi.dev'
		},

		// System admin email for platform monitoring
		systemEmail: env.ADMIN_EMAIL || 'admin@kuratchi.dev',

		// Enable features
		enableInApp: true,
		enableEmail: true,
		enableMonitoring: true,
		enableQueue: true,

		// Platform monitoring thresholds
		monitoringThresholds: {
			maxDatabasesPerHour: 10,
			maxDatabasesPerDay: 50,
			maxSignupsPerMinute: 5,
			maxSignupsPerHour: 50,
			maxApiCallsPerMinute: 100,
			maxApiCallsPerHour: 5000
		},

		// Storage settings
		storageDb: 'admin',
		batchSize: 10,
		defaultExpiryDays: 30
	}
});

export const kuratchiConfig = kuratchiHandle.handle;