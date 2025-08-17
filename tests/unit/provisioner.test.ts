import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KuratchiProvisioner } from '../../src/lib/provisioner.js';
import type { CloudflareClientConfig } from '../../src/lib/cloudflare.js';

// We will spy on methods of the real provisioner, but stub out network via CloudflareClient instance methods

describe('KuratchiProvisioner', () => {
  const cfg: CloudflareClientConfig = {
    apiToken: 't',
    accountId: 'a',
    endpointBase: 'https://api.cloudflare.com/client/v4'
  };

  let provisioner: KuratchiProvisioner;

  beforeEach(() => {
    vi.restoreAllMocks();
    // KuratchiProvisioner is a singleton per process; get a fresh instance
    provisioner = (KuratchiProvisioner as any).getInstance(cfg) as KuratchiProvisioner;
  });

  it('provisionDatabase polls DB and Worker until available', async () => {
    // Arrange: stub CloudflareClient methods used by provisioner through instance access
    const cf: any = (provisioner as any).cf;

    // createDatabase returns wrapped envelope with result
    vi.spyOn(cf, 'createDatabase').mockResolvedValue({ result: { uuid: 'db_uuid', name: 'mydb' } });
    // enable read replication, upload + subdomain succeed
    const enableRR = vi.spyOn(cf, 'enableReadReplication').mockResolvedValue({ success: true });
    vi.spyOn(cf, 'uploadWorkerModule').mockResolvedValue({ success: true });
    vi.spyOn(cf, 'enableWorkerSubdomain').mockResolvedValue({ success: true });

    // getDatabase: fail twice then succeed
    const getDatabase = vi
      .spyOn(cf, 'getDatabase')
      .mockRejectedValueOnce(new Error('not yet'))
      .mockRejectedValueOnce(new Error('not yet'))
      .mockResolvedValue({ result: { id: 'db_uuid' } });

    // getWorkerScript: fail once then succeed
    const getWorkerScript = vi
      .spyOn(cf, 'getWorkerScript')
      .mockRejectedValueOnce(new Error('not yet'))
      .mockResolvedValue({ id: 'mydb' });

    // Act
    const { database, apiToken } = await provisioner.provisionDatabase('mydb');

    // Assert
    expect(database.uuid).toBe('db_uuid');
    expect(typeof apiToken).toBe('string');
    expect(enableRR).toHaveBeenCalledTimes(1);
    expect(enableRR).toHaveBeenCalledWith('db_uuid');
    expect(getDatabase).toHaveBeenCalledTimes(3);
    expect(getWorkerScript).toHaveBeenCalledTimes(2);
  });
});
