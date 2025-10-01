import { Logger } from 'winston';
import { KnownError } from '../error';
import { getErrorType } from '../util/logger';

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

export class JobStore {
  private isRunning: boolean = false;
  private shutdownRequested: boolean = false;

  async addJob<T>(
    task: () => Promise<T>,
    logger: Logger,
    retryCount: number = 0
  ): Promise<{ accepted: boolean }> {
    if (this.isRunning || this.shutdownRequested) {
      return { accepted: false };
    }

    this.isRunning = true;

    // Execute the task asynchronously without waiting for completion
    this.executeTaskWithRetry(task, logger, retryCount).then(() => {
      logger.info('LogBasedMetric Bot has finished recording meeting successfully.');
    }).catch((error) => {
      // Ensure error is properly formatted for logging
      const safeError = error instanceof Error ? error : new Error(String(error || 'Unknown error'));
      const errorType = getErrorType(safeError);

      if (safeError instanceof KnownError) {
        logger.error('KnownError JobStore is permanently exiting:', { error: safeError });
      } else {
        logger.error('Error executing task after multiple retries:', { error: safeError });
      }
      logger.error(`LogBasedMetric Bot has permanently failed. [errorType: ${errorType}]`);
    }).finally(() => {
      this.isRunning = false;
    });

    logger.info('LogBasedMetric Bot job has been queued and started recording meeting.');
    return { accepted: true };
  }

  private async executeTaskWithRetry<T>(
    task: () => Promise<T>,
    logger: Logger,
    retryCount: number
  ): Promise<void> {
    try {
      await task();
    } catch (error) {
      // Ensure error is properly formatted before processing
      const safeError = error instanceof Error ? error : new Error(String(error || 'Unknown error'));

      if (safeError instanceof KnownError && !safeError.retryable) {
        logger.error('KnownError is not retryable:', safeError.name, safeError.message);
        throw safeError;
      }

      if (safeError instanceof KnownError && safeError.retryable && (retryCount + 1) >= safeError.maxRetries) {
        logger.error(`KnownError: ${safeError.maxRetries} tries consumed:`, safeError.name, safeError.message);
        throw safeError;
      }

      retryCount += 1;
      await sleep(retryCount * 30000);
      if (retryCount < 3) {
        if (retryCount) {
          logger.warn(`Retry count: ${retryCount}`);
        }
        await this.executeTaskWithRetry(task, logger, retryCount);
      } else {
        throw safeError;
      }
    }
  }

  isBusy(): boolean {
    return this.isRunning;
  }

  /**
   * Check if shutdown has been requested
   */
  isShutdownRequested(): boolean {
    return this.shutdownRequested;
  }

  /**
   * Request graceful shutdown - prevents new jobs from being accepted
   */
  requestShutdown(): void {
    this.shutdownRequested = true;
  }

  /**
   * Wait for ongoing tasks to complete
   * @returns Promise that resolves when all tasks are complete
   */
  async waitForCompletion(): Promise<void> {
    if (!this.isRunning) {
      return; // No tasks running, can shutdown immediately
    }

    console.log('Waiting for ongoing tasks to complete...');

    return new Promise<void>((resolve) => {
      const checkCompletion = () => {
        if (!this.isRunning) {
          console.log('All tasks completed successfully');
          resolve();
        } else {
          setTimeout(checkCompletion, 1000); // Check every 1 second
        }
      };
      checkCompletion();
    });
  }
}
