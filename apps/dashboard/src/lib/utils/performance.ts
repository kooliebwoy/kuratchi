/**
 * Performance Monitoring Utility
 * Helps measure and track execution time for async operations
 */

export class PerformanceTimer {
  private startTime: number;
  private checkpoints: Map<string, number>;
  private label: string;

  constructor(label: string) {
    this.label = label;
    this.startTime = performance.now();
    this.checkpoints = new Map();
    console.log(`[${this.label}] 🚀 Started at ${new Date().toISOString()}`);
  }

  /**
   * Mark a checkpoint and log the time since the last checkpoint (or start)
   */
  checkpoint(name: string): void {
    const now = performance.now();
    const lastCheckpointName = Array.from(this.checkpoints.keys()).pop();
    const lastTime = lastCheckpointName 
      ? this.checkpoints.get(lastCheckpointName)! 
      : this.startTime;
    
    const elapsed = now - lastTime;
    this.checkpoints.set(name, now);
    
    console.log(`[${this.label}] ⚡ ${name}: ${elapsed.toFixed(2)}ms`);
  }

  /**
   * Log total elapsed time and return it
   */
  end(): number {
    const totalTime = performance.now() - this.startTime;
    console.log(`[${this.label}] ✅ TOTAL TIME: ${totalTime.toFixed(2)}ms (${(totalTime / 1000).toFixed(2)}s)`);
    return totalTime;
  }

  /**
   * Log error with timing information
   */
  error(err: any): void {
    const totalTime = performance.now() - this.startTime;
    console.error(`[${this.label}] ❌ ERROR after ${totalTime.toFixed(2)}ms:`, err);
  }

  /**
   * Get summary of all checkpoints
   */
  getSummary(): { total: number; checkpoints: Record<string, number> } {
    const total = performance.now() - this.startTime;
    const checkpoints: Record<string, number> = {};
    
    let lastTime = this.startTime;
    for (const [name, time] of this.checkpoints) {
      checkpoints[name] = time - lastTime;
      lastTime = time;
    }
    
    return { total, checkpoints };
  }
}

/**
 * Simple wrapper to measure async function execution time
 */
export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const timer = new PerformanceTimer(label);
  try {
    const result = await fn();
    const duration = timer.end();
    return { result, duration };
  } catch (err) {
    timer.error(err);
    throw err;
  }
}

/**
 * Measure time for a synchronous operation
 */
export function measureSync<T>(
  label: string,
  fn: () => T
): { result: T; duration: number } {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  console.log(`[${label}] ${duration.toFixed(2)}ms`);
  return { result, duration };
}
