import { env } from 'cloudflare:workers';
import { kuratchiORM } from '@kuratchi/orm';

export const db = kuratchiORM(() => (env as any).DB);
