import type { DashboardView } from '$lib/stores/view';
import {
  Activity,
  BarChart3,
  Cloud,
  Globe,
  KeyRound,
  Layers,
  Lock,
  Server,
  ShieldCheck,
  Users
} from '@lucide/svelte';

export type OverviewCard = {
  title: string;
  value: string;
  change: string;
  icon: typeof Globe;
  accent: string;
};

export const overviewCards: OverviewCard[] = [
  {
    title: 'Active Projects',
    value: '12',
    change: '+18% MoM',
    icon: Globe,
    accent: 'bg-primary/20 text-primary'
  },
  {
    title: 'Daily Requests',
    value: '483k',
    change: '+6.3% today',
    icon: Activity,
    accent: 'bg-success/20 text-success'
  },
  {
    title: 'Storage Used',
    value: '2.8 TB',
    change: '+348 GB this week',
    icon: Cloud,
    accent: 'bg-accent/20 text-accent'
  },
  {
    title: 'Latency (p95)',
    value: '92 ms',
    change: '-11% week over week',
    icon: BarChart3,
    accent: 'bg-warning/20 text-warning'
  }
];

export type DatabaseTable = {
  name: string;
  rows: string;
  writes: string;
  status: 'Online' | 'Optimizing';
  replication: string;
};

export const databaseTables: DatabaseTable[] = [
  { name: 'users', rows: '142,491', writes: '321/min', status: 'Online', replication: 'Multi-region' },
  { name: 'organizations', rows: '8,931', writes: '38/min', status: 'Online', replication: 'US/EU' },
  { name: 'sessions', rows: '1.2M', writes: '812/min', status: 'Optimizing', replication: 'Primary region' },
  { name: 'events', rows: '14.7M', writes: '5.8k/min', status: 'Online', replication: 'Global edge' }
];

export type AuthProvider = {
  name: string;
  status: string;
  success: string;
  icon: typeof KeyRound;
};

export const authProviders: AuthProvider[] = [
  { name: 'Magic Links', status: 'Enabled', success: '99.2%', icon: KeyRound },
  { name: 'OAuth (GitHub)', status: 'Enabled', success: '98.4%', icon: ShieldCheck },
  { name: 'Email OTP', status: 'Enabled', success: '97.3%', icon: Lock }
];

export type ActivityItem = {
  time: string;
  action: string;
  project: string;
  status: string;
};

export const recentActivity: ActivityItem[] = [
  { time: '2 minutes ago', action: 'New user registered', project: 'Platform', status: 'Success' },
  { time: '24 minutes ago', action: 'Database migration applied', project: 'Aurora CMS', status: 'Completed' },
  { time: '1 hour ago', action: 'API key rotated', project: 'Orbit Analytics', status: 'Security' },
  { time: '3 hours ago', action: 'Organization created', project: 'Pulse Media', status: 'Active' },
  { time: '5 hours ago', action: 'Role permissions updated', project: 'Platform', status: 'Updated' }
];

export type UserInsight = {
  avatar: string;
  name: string;
  email: string;
  role: string;
  activity: string;
};

export const userInsights: UserInsight[] = [
  { avatar: 'EI', name: 'Emily Ito', email: 'emily@orbit.dev', role: 'Owner', activity: '29 minutes ago' },
  { avatar: 'JL', name: 'Jamal Lee', email: 'jamal@aurora.dev', role: 'Developer', activity: '58 minutes ago' },
  { avatar: 'MV', name: 'Maya Voss', email: 'maya@pulse.dev', role: 'Analyst', activity: '1 hour ago' },
  { avatar: 'RA', name: 'Ravi Anand', email: 'ravi@nebula.dev', role: 'Security', activity: '2 hours ago' }
];

export type StorageBucket = {
  name: string;
  region: string;
  size: string;
  objects: string;
  status: string;
};

export const storageBuckets: StorageBucket[] = [
  { name: 'app-uploads', region: 'Global Edge', size: '428 GB', objects: '2.3M', status: 'Healthy' },
  { name: 'media-cdn', region: 'EU Central', size: '812 GB', objects: '6.7M', status: 'Increasing' },
  { name: 'logs-archive', region: 'US East', size: '3.8 TB', objects: '84M', status: 'Cold Storage' }
];

export const trafficGraph = [72, 68, 81, 94, 87, 96, 104, 88];

export type RegionStatus = {
  name: string;
  description: string;
  status: 'Healthy' | 'Provisioning';
};

export const projectRegions: RegionStatus[] = [
  { name: 'US East (Primary)', description: 'Workers + D1 + R2', status: 'Healthy' },
  { name: 'EU Central', description: 'Workers + KV', status: 'Healthy' },
  { name: 'AP Southeast', description: 'Workers (scheduled for R2)', status: 'Provisioning' }
];

export const quickActions = [
  {
    icon: Layers,
    label: 'Create Organization',
    variant: 'btn-primary',
    emphasis: 'text-primary-content'
  },
  {
    icon: Users,
    label: 'Invite Users',
    variant: 'btn-outline',
    emphasis: 'text-primary'
  }
];

export type AuthTimelineItem = {
  title: string;
  description: string;
  icon: typeof ShieldCheck;
};

export const authTimeline: AuthTimelineItem[] = [
  {
    title: 'Multi-factor challenge',
    description: 'Adaptive risk scoring and passkeys fallback',
    icon: ShieldCheck
  },
  {
    title: 'Magic link delivery',
    description: 'Edge-signed email with session plug-ins',
    icon: KeyRound
  },
  {
    title: 'Session enrichment',
    description: 'Full user context mirrored to `locals.session`',
    icon: Lock
  }
];

export type AuthMetric = {
  label: string;
  value: string;
  description: string;
  icon: typeof ShieldCheck;
};

export const authMetrics: AuthMetric[] = [
  {
    label: 'Verified Sessions',
    value: '38,204',
    description: '92% session reuse',
    icon: ShieldCheck
  },
  {
    label: 'Magic Links',
    value: '12,930',
    description: '+8.4% success rate',
    icon: KeyRound
  },
  {
    label: 'Active Users',
    value: '82.4k',
    description: '24h retention 67%',
    icon: Users
  }
];

export type EnvironmentKey = {
  label: string;
  value: string;
  tone: 'primary' | 'warning' | 'error';
};

export const environmentKeys: EnvironmentKey[] = [
  {
    label: 'Public API URL',
    value: 'https://kuratchi.dev/api/project/nebula',
    tone: 'primary'
  },
  {
    label: 'Service Role Key',
    value: 'kuratchi-service-••••-7g3f',
    tone: 'warning'
  },
  {
    label: 'JWT Secret',
    value: 'set via dashboard',
    tone: 'error'
  }
];

export type EdgeLog = {
  timestamp: string;
  message: string;
  tone: 'success' | 'warning' | 'info' | 'error';
};

export const edgeLogs: EdgeLog[] = [
  {
    timestamp: '09:24:18',
    message: 'worker.log edge:cache HIT for /api/projects',
    tone: 'success'
  },
  {
    timestamp: '09:24:22',
    message: 'd1.query latency=82ms query="SELECT * FROM users WHERE id = ?"',
    tone: 'warning'
  },
  {
    timestamp: '09:24:35',
    message: 'kv.audit rotation scheduled for namespace auth-secrets',
    tone: 'info'
  },
  {
    timestamp: '09:24:40',
    message: 'worker.error retrying fetch cloudflare kv stale key=org:9283',
    tone: 'error'
  }
];

export const viewTitles: Record<DashboardView, string> = {
  overview: 'Cloud Control Center',
  database: 'Database Overview',
  auth: 'Authentication Insights',
  users: 'User Directory',
  storage: 'Storage Buckets',
  logs: 'Edge Logs',
  settings: 'Project Settings'
};
