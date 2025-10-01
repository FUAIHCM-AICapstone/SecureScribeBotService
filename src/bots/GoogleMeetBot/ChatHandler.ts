/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger } from 'winston';
import { IGoogleMeetChatHandler } from '../../types';

export class GoogleMeetChatHandler implements IGoogleMeetChatHandler {
  private context: any;
  private logger: Logger;

  constructor(context: any, logger: Logger) {
    console.log('💬 ChatHandler constructor called');
    this.context = context;
    this.logger = logger;
    console.log('✅ ChatHandler constructor completed');
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
      console.log('CHAT_REPLY: === STARTING REPLY PROCESS ===');
      this.logger.info('CHAT_REPLY: Sending reply message...', { messageContent });

      // Open chat panel (same as initial message)
      console.log('CHAT_REPLY: Looking for chat button...');
      const chatButton = await this.context.page.getByRole('button', { name: /Chat with everyone/i });
      const buttonCount = await chatButton.count();
      console.log('CHAT_REPLY: Chat button count:', buttonCount);

      if (buttonCount > 0) {
        console.log('CHAT_REPLY: Clicking chat button...');
        await chatButton.click();
        await this.context.page.waitForTimeout(1000);
        this.logger.info('CHAT_REPLY: Opened chat panel');
      } else {
        console.log('CHAT_REPLY: Chat button not found');
        this.logger.warn('CHAT_REPLY: Chat button not found');
        return;
      }

      const chatInput = await this.context.page.locator('textarea[aria-label="Send a message"]');
      console.log('CHAT_REPLY: Chat input found, filling message...');
      await chatInput.waitFor({ timeout: 5000 });

      // Clear existing content first to avoid duplicate
      await chatInput.fill('');
      await this.context.page.waitForTimeout(500);

      await chatInput.fill(messageContent);
      this.logger.info('CHAT_REPLY: Filled reply message');
      console.log('CHAT_REPLY: Message filled successfully');

      // Click send button (same as initial message)
      console.log('CHAT_REPLY: Looking for send button...');
      const sendButton = await this.context.page.getByRole('button', { name: 'Send a message' });
      const sendButtonCount = await sendButton.count();
      const isDisabled = await sendButton.isDisabled();
      console.log('CHAT_REPLY: Send button count:', sendButtonCount, 'disabled:', isDisabled);


      console.log('CHAT_REPLY: Clicking send button...');
      await sendButton.click();

      console.log('CHAT_REPLY: === REPLY PROCESS COMPLETED ===');

    } catch (error) {
      console.error('CHAT_REPLY: ERROR in sendReplyMessage:', error);
      this.logger.warn('CHAT_REPLY: Failed to send reply message', {
        error: error.message,
        messageContent
      });
    }
  }
}
