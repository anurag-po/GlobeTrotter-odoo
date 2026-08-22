import type { JobService } from '../../application/ports/services.js';
import { logger } from '../../shared/logger.js';

export class JobRegistry implements JobService {
  private handlers = new Map<string, (payload: Record<string, unknown>) => Promise<void>>();

  registerHandler(jobName: string, handler: (payload: Record<string, unknown>) => Promise<void>): void {
    this.handlers.set(jobName, handler);
  }

  async enqueue(jobName: string, payload: Record<string, unknown>): Promise<void> {
    logger.info(`Enqueued background job: ${jobName}`, { payload });

    // Execute asynchronously (fire-and-forget point-to-point worker)
    const handler = this.handlers.get(jobName);
    if (handler) {
      setImmediate(async () => {
        try {
          await handler(payload);
          logger.info(`Completed background job: ${jobName}`);
        } catch (err) {
          logger.error(`Failed background job: ${jobName}`, { error: String(err) });
        }
      });
    }
  }
}
