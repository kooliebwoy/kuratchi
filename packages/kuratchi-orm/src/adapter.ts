export interface kuratchiOrmDatabaseConfig {
  schema: any;
  type?: 'd1' | 'do';
  skipMigrations?: boolean;
  remote?: boolean;
}

export interface kuratchiOrmAdapterConfig {
  databases?: Record<string, kuratchiOrmDatabaseConfig>;
}

export function kuratchiOrmConfig(config: kuratchiOrmAdapterConfig = {}): kuratchiOrmAdapterConfig {
  return {
    databases: {},
    ...config,
  };
}



