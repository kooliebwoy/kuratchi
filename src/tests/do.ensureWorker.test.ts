import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock CloudflareClient so we can assert calls
const uploadSpy = vi.fn(async () => {});
const enableSpy = vi.fn(async () => {});

vi.mock('../lib/cloudflare.js', () => {
  return {
    CloudflareClient: class {
      constructor(_: any) {}
      uploadWorkerModule = uploadSpy;
      enableWorkerSubdomain = enableSpy;
    }
  };
});

import { KuratchiDO } from '../lib/do/kuratchi-do.js';
import { DEFAULT_DO_WORKER_SCRIPT } from '../lib/do/worker-template.js';

describe('KuratchiDO.ensureWorker (via createDatabase)', () => {
  beforeEach(() => { uploadSpy.mockClear(); enableSpy.mockClear(); });

  it('uploads worker with DO binding and API_KEY secret, then enables subdomain', async () => {
    const doSvc = new KuratchiDO({
      apiToken: 'cf_test',
      accountId: 'acc_test',
      workersSubdomain: 'example.workers.dev',
      scriptName: 'my-do-internal'
    });

    // Short-circuit endpoint readiness wait to avoid test timeout
    // @ts-expect-error accessing private method for test shim
    doSvc.waitForWorkerEndpoint = async () => true;

    const gatewayKey = 'MASTER_KEY_123';
    await doSvc.createDatabase({ databaseName: 'org_acme', gatewayKey });

    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(enableSpy).toHaveBeenCalledTimes(1);

    const firstCall = uploadSpy.mock.calls[0] as unknown as [string, string, any[]];
    if (!firstCall) throw new Error('uploadWorkerModule was not called');
    const scriptName = firstCall[0];
    const script = firstCall[1];
    const bindings = firstCall[2];
    expect(scriptName).toBe('my-do-internal');
    expect(script).toBe(DEFAULT_DO_WORKER_SCRIPT);

    // bindings should include DO namespace and API_KEY secret
    expect(Array.isArray(bindings)).toBe(true);
    const arr = bindings as any[];
    const doBinding = arr.find((b: any) => b.type === 'durable_object_namespace');
    const secret = arr.find((b: any) => b.type === 'secret_text' && b.name === 'API_KEY');

    expect(doBinding).toBeTruthy();
    expect(doBinding.name).toBe('DO');
    expect(doBinding.class_name).toBe('KuratchiDoInternal');

    expect(secret).toBeTruthy();
    expect(secret.text).toBe(gatewayKey);
  });
});
