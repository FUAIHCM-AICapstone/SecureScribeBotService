/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger } from 'winston';
import { IGoogleMeetChatHandler } from '../../types';
import messageBroker from '../../connect/messageBroker';
import config from '../../config';

export class GoogleMeetChatHandler implements IGoogleMeetChatHandler {
  private context: any;
  private logger: Logger;
  private botId?: string;

  constructor(context: any, logger: Logger) {
    this.logger.info('CHAT: ChatHandler initialized');
    this.context = context;
    this.logger = logger;
    this.botId = context.botId;
  }

  async sendChatMessage(): Promise<void> {
    try {
      this.logger.info('CHAT: Attempting to open chat panel...');

      // Click the "Chat with everyone" button
      const chatButton = await this.context.page.getByRole('button', { name: /Chat with everyone/i });
      if (await chatButton.count() > 0) {
        await chatButton.click();
        this.logger.info('CHAT: Clicked "Chat with everyone" button');
        await this.context.page.waitForTimeout(1000); // Wait for chat panel to open
      } else {
        this.logger.warn('CHAT: "Chat with everyone" button not found');
        return;
      }

      this.logger.info('CHAT: Attempting to send message...');

      // Wait for and fill the chat textarea
      const chatInput = await this.context.page.locator('textarea[aria-label="Send a message"]');
      await chatInput.waitFor({ timeout: 5000 });

      // Clear any existing content first
      await chatInput.fill('');
      await this.context.page.waitForTimeout(500);

      // Fill with our message
      await chatInput.fill('Đã bắt đầu ghi hình các bạn nhé! 🫨');
      this.logger.info('CHAT: Filled chat input with message');

      // Wait a bit to ensure the input is ready
      await this.context.page.waitForTimeout(1000);

      // Click the "Send a message" button
      const sendButton = await this.context.page.getByRole('button', { name: 'Send a message' });
      const sendButtonCount = await sendButton.count();
      const isDisabled = await sendButton.isDisabled();

      this.logger.info('CHAT: Send button status:', { count: sendButtonCount, disabled: isDisabled });

      if (sendButtonCount > 0 && !isDisabled) {
        await sendButton.click();
        this.logger.info('CHAT: Clicked "Send a message" button');
        await this.context.page.waitForTimeout(2000); // Wait for message to send and avoid duplicate
      } else {
        this.logger.warn('CHAT: "Send a message" button not clickable or disabled', { count: sendButtonCount, disabled: isDisabled });
      }

      this.logger.info('CHAT: Chat message sent successfully');

    } catch (error) {
      // Log and continue - chat is not critical to recording functionality
      this.logger.info('CHAT: Failed to send chat message, continuing with recording...', { error: error.message });
    }
  }

  async sendReplyMessage(messageContent: string): Promise<void> {
    try {
      this.logger.info('CHAT_REPLY: Starting reply process', { messageContent });

      // Generate message ID from content for tracking
      const messageId = this.generateMessageId(messageContent);

      // Check Redis to avoid duplicate processing
      if (this.botId && config.redisMessageTrackingEnabled) {
        const isProcessed = await messageBroker.isMessageProcessed(messageId, this.botId);
        if (isProcessed) {
          this.logger.info('CHAT_REPLY: Message already processed, skipping reply', { messageId });
          return;
        }
      }

      // Open chat panel with retry logic


      // Retry opening chat panel up to 3 times
      let chatOpened = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const chatInput = this.context.page.locator('textarea[aria-label="Send a message"]');
          const isVisible = await chatInput.isVisible({ timeout: 2000 }).catch(() => false);

          if (isVisible) {
            // Additional check - try to focus on the textarea to ensure it's accessible
            try {
              await chatInput.focus();
              await this.context.page.waitForTimeout(500);
              this.logger.info(`CHAT_REPLY: Chat panel opened on attempt ${attempt}`);
              chatOpened = true;
              break;
            } catch (focusError) {
              this.logger.info(`CHAT_REPLY: Chat panel visible but cannot focus on attempt ${attempt}`);
            }
          } else {
            this.logger.info(`CHAT_REPLY: Chat panel not visible after attempt ${attempt}`);
          }
        } catch (error) {
          this.logger.info(`CHAT_REPLY: Error on attempt ${attempt}`, { error: error.message });
        }
      }

      if (!chatOpened) {
        this.logger.warn('CHAT_REPLY: Failed to open chat panel after retries');
        return;
      }

      const chatInput = await this.context.page.locator('textarea[aria-label="Send a message"]');
      await chatInput.waitFor({ timeout: 3000 });

      // Final check before filling - ensure chat input is still accessible
      const isStillVisible = await chatInput.isVisible().catch(() => false);
      if (!isStillVisible) {
        this.logger.warn('CHAT_REPLY: Chat input became hidden before sending');
        return;
      }

      // Clear existing content first to avoid duplicate
      await chatInput.fill('');
      await this.context.page.waitForTimeout(500);

      await chatInput.fill(messageContent);
      this.logger.info('CHAT_REPLY: Filled reply message');

      // Click send button (same as initial message)
      const sendButton = await this.context.page.getByRole('button', { name: 'Send a message' });
      const sendButtonCount = await sendButton.count();
      const isDisabled = await sendButton.isDisabled();

      this.logger.info('CHAT_REPLY: Clicking send button', { count: sendButtonCount, disabled: isDisabled });
      await sendButton.click();

      // Mark message as processed in Redis (only if messageId provided and Redis tracking enabled)
      if (messageId && this.botId && config.redisMessageTrackingEnabled) {
        await messageBroker.markMessageAsProcessed(messageId, this.botId);
        this.logger.info('CHAT_REPLY: Message marked as processed in Redis');
      }

      this.logger.info('CHAT_REPLY: Reply process completed');

    } catch (error) {
      this.logger.warn('CHAT_REPLY: Failed to send reply message', {
        error: error.message,
        messageContent
      });
    }
  }

  private generateMessageId(messageContent: string): string {
    // Simple hash function to generate consistent message ID from content
    let hash = 0;
    for (let i = 0; i < messageContent.length; i++) {
      const char = messageContent.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}
