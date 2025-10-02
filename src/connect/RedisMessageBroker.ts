import { EventEmitter } from 'stream';
import { createClient } from 'redis';
import config from '../config';

/**
 * This class must not have any instance/local state, and should only be used as a singleton.
 * Uses FIFO queue (RPUSH + BLPOP)
 */
export class RedisMessageBroker extends EventEmitter {
  private meetbot: ReturnType<typeof createClient> | null = null;

  constructor() {
    super();

    if (config.isRedisEnabled) {
      this.meetbot = createClient({
        url: config.redisUri,
        name: 'backend-meetbot',
      });
      this.meetbot.on('error', (err) =>
        console.error('meetbot redis client error', err)
      );
      Promise.all([
        this.meetbot.connect(),
      ]).then(() => {
        console.log('Redis message broker connected.');
      });

      console.log('Redis message broker initialized:', config.redisUri);
    } else {
      console.log('Redis message broker disabled - Redis is disabled');
    }
  }

  /**
   * Return a job to the head of the meetbot Redis queue.
   * **Client needs to actively pull items.**
   *
   *  This function returns a message to the head of the meetbot Redis queue
   *  This is useful when a job is rejected by the JobStore, and needs to be retried.
   *
   * @param {message} message - The publish message.
   */
  async returnMeetingbotJobs(message: string) {
    // Set/update data, even if the item is already in the queue.
    return await this.meetbot?.lPush(
      config.redisQueueName,
      message
    );
  }

  /**
   * Get a job from meetbot Redis queue with custom timeout.
   * **Client needs to actively pull items.**
   *
   * @param timeout - Timeout in seconds for blocking operation
   * @return The message acquired from meetbot Redis queue
   */
  async getMeetingbotJobsWithTimeout(timeout: number) {
    return await this.meetbot?.blPop(
      config.redisQueueName,
      timeout
    );
  }

  /**
   * Check if the Redis client is connected and ready
   * @return boolean indicating connection status
   */
  isConnected(): boolean {
    return this.meetbot?.isOpen ?? false;
  }

  /**
   * Check if a message has been processed (to avoid duplicates)
   * @param messageId - The message ID to check
   * @param botId - The bot ID for namespacing
   * @return boolean indicating if message was processed
   */
  async isMessageProcessed(messageId: string, botId: string): Promise<boolean> {
    try {
      if (!this.meetbot?.isOpen) {
        console.warn('Redis not connected, treating message as unprocessed');
        return false;
      }

      const key = `processed_messages:${botId}`;
      const exists = await this.meetbot.sIsMember(key, messageId);
      return exists === 1;
    } catch (error) {
      console.error('Error checking message processed status:', error);
      return false; // Fail safe - treat as unprocessed
    }
  }

  /**
   * Mark a message as processed (to avoid duplicates)
   * @param messageId - The message ID to mark
   * @param botId - The bot ID for namespacing
   * @param ttlMinutes - TTL in minutes (default: 24 hours)
   */
  async markMessageAsProcessed(messageId: string, botId: string, ttlMinutes?: number): Promise<void> {
    try {
      if (!this.meetbot?.isOpen) {
        console.warn('Redis not connected, cannot mark message as processed');
        return;
      }

      const key = `processed_messages:${botId}`;
      // Add to set with TTL
      await this.meetbot.sAdd(key, messageId);

      // Use config TTL if not provided
      const finalTTL = ttlMinutes || (config.processedMessagesTTLMinutes || 24 * 60);
      await this.meetbot.expire(key, finalTTL * 60); // Convert minutes to seconds

      console.log(`Message ${messageId} marked as processed for bot ${botId} with TTL ${finalTTL} minutes`);
    } catch (error) {
      console.error('Error marking message as processed:', error);
      // Don't throw - this is not critical functionality
    }
  }

  /**
   * Get all processed message IDs for a bot (for debugging)
   * @param botId - The bot ID for namespacing
   * @return Array of processed message IDs
   */
  async getProcessedMessages(botId: string): Promise<string[]> {
    try {
      if (!this.meetbot?.isOpen) {
        return [];
      }

      const key = `processed_messages:${botId}`;
      const members = await this.meetbot.sMembers(key);
      return members;
    } catch (error) {
      console.error('Error getting processed messages:', error);
      return [];
    }
  }

  /**
   * Clean up old processed messages (call this periodically)
   * @param botId - The bot ID for namespacing
   * @return Number of messages cleaned up
   */
  async cleanupProcessedMessages(botId: string): Promise<number> {
    try {
      if (!this.meetbot?.isOpen) {
        return 0;
      }

      const key = `processed_messages:${botId}`;
      // This will remove expired members automatically
      const size = await this.meetbot.sCard(key);
      return size; // Return current size after cleanup
    } catch (error) {
      console.error('Error cleaning up processed messages:', error);
      return 0;
    }
  }

  /**
   * This function accompanies container shutdown and closes redis connection to free up server resources
   * @return void
   */
  async quitClientGracefully() {
    try {
      if (this.meetbot?.isOpen) {
        await this.meetbot?.quit();
      }
      console.log('Closed redis connection');
    } catch (quitError) {
      console.error('Error while closing redis connection', quitError);
    }
  }
}
