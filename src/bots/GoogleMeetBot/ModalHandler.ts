/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger } from 'winston';
import { IGoogleMeetModalHandler } from '../../types';
import { retryActionWithWait } from '../../util/resilience';

export class GoogleMeetModalHandler implements IGoogleMeetModalHandler {
  private context: any;
  private logger: Logger;

  constructor(context: any, logger: Logger) {
    console.log('🎯 ModalHandler constructor called');
    this.context = context;
    this.logger = logger;
    console.log('✅ ModalHandler constructor completed');
  }

  async dismissDeviceCheck(): Promise<void> {
    try {
      await retryActionWithWait(
        'Clicking the "Continue without microphone and camera" button',
        async () => {
          await this.context.page.getByRole('button', { name: 'Continue without microphone and camera' }).waitFor({ timeout: 30000 });
          await this.context.page.getByRole('button', { name: 'Continue without microphone and camera' }).click();
        },
        this.logger,
        1,
        15000,
      );
    } catch (dismissError) {
    }
  }

  async dismissGotItModals(): Promise<void> {
    try {
      await this.context.page.waitForSelector('button:has-text("Got it")', { timeout: 15000 });


      let gotItButtonsClicked = 0;
      let previousButtonCount = -1;
      let consecutiveNoChangeCount = 0;
      const maxConsecutiveNoChange = 2; // Stop if button count doesn't change for 2 consecutive iterations

      while (true) {
        const visibleButtons = await this.context.page.locator('button:visible', {
          hasText: 'Got it',
        }).all();

        const currentButtonCount = visibleButtons.length;

        if (currentButtonCount === 0) {
          break;
        }

        // Check if button count hasn't changed (indicating we might be stuck)
        if (currentButtonCount === previousButtonCount) {
          consecutiveNoChangeCount++;
          if (consecutiveNoChangeCount >= maxConsecutiveNoChange) {
            this.logger.warn(`Button count hasn't changed for ${maxConsecutiveNoChange} iterations, stopping`);
            break;
          }
        } else {
          consecutiveNoChangeCount = 0;
        }

        previousButtonCount = currentButtonCount;

        for (const btn of visibleButtons) {
          try {
            await btn.click({ timeout: 5000 });
            gotItButtonsClicked++;

            await this.context.page.waitForTimeout(2000);
          } catch (err) {
            this.logger.warn('Click failed, possibly already dismissed', { error: err });
          }
        }

        await this.context.page.waitForTimeout(2000);
      }
    } catch (error) {
      // Log and ignore this error
    }
  }
}
