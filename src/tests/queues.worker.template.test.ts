import { describe, it, expect } from 'vitest';
import { DEFAULT_QUEUES_PRODUCER_WORKER_SCRIPT } from '../lib/queues/worker-template.js';

describe('Queues Worker template (producer + consumer)', () => {
  it('includes a queue() handler', () => {
    expect(DEFAULT_QUEUES_PRODUCER_WORKER_SCRIPT).toContain('async queue(');
  });

  it('demonstrates explicit ack and retry', () => {
    expect(DEFAULT_QUEUES_PRODUCER_WORKER_SCRIPT).toContain('msg.ack(');
    expect(DEFAULT_QUEUES_PRODUCER_WORKER_SCRIPT).toContain('msg.retry(');
  });
});
