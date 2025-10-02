/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger } from 'winston';
import { GOOGLE_REQUEST_DENIED } from '../../constants';
import { UnsupportedMeetingError, WaitingAtLobbyRetryError } from '../../error';
import createBrowserContext from '../../lib/chromium';
import { uploadDebugImage } from '../../services/bugService';
import { BotStatus, IGoogleMeetJoinHandler, IGoogleMeetLobbyHandler, IGoogleMeetModalHandler, IGoogleMeetPageValidator } from '../../types';
import { retryActionWithWait } from '../../util/resilience';
import { JoinParams } from '../AbstractMeetBot';

export class GoogleMeetJoinHandler implements IGoogleMeetJoinHandler {
  private context: any;
  private logger: Logger;
  private pageValidator: IGoogleMeetPageValidator;
  private lobbyHandler: IGoogleMeetLobbyHandler;
  private modalHandler: IGoogleMeetModalHandler;

  constructor(
    context: any,
    logger: Logger,
    pageValidator: IGoogleMeetPageValidator,
    lobbyHandler: IGoogleMeetLobbyHandler,
    modalHandler: IGoogleMeetModalHandler
  ) {
    console.log('🔧 JoinHandler constructor called');
    this.context = context;
    this.logger = logger;
    this.pageValidator = pageValidator;
    this.lobbyHandler = lobbyHandler;
    this.modalHandler = modalHandler;
    console.log('✅ JoinHandler constructor completed');
  }

  async joinMeeting({ url, name, teamId, userId, botId, pushState }: JoinParams & { pushState(state: BotStatus): void }): Promise<void> {
    console.log('🚀 JoinHandler.joinMeeting STARTED', { url, name, userId, teamId, botId });

    this.context.page = await createBrowserContext(url, this.context.correlationId);

    await this.context.page.goto(url, { waitUntil: 'networkidle' });

    await this.context.page.waitForTimeout(3000);

    // Dismiss device check modal
    await this.modalHandler.dismissDeviceCheck();

    // Verify we're on the correct Google Meet page
    const googleMeetPageStatus = await this.pageValidator.verifyGoogleMeetPage();
    if (googleMeetPageStatus === 'SIGN_IN_PAGE') {
      throw new UnsupportedMeetingError('Meeting requires sign in', googleMeetPageStatus);
    }

    if (googleMeetPageStatus === 'UNSUPPORTED_PAGE') {
    }

    // Wait for and fill the name input field
    await retryActionWithWait(
      'Waiting for the input field',
      async () => await this.context.page.waitForSelector('input[type="text"][aria-label="Your name"]', { timeout: 10000 }),
      this.logger,
      3,
      15000,
      async () => {
        await uploadDebugImage(await this.context.page.screenshot({ type: 'png', fullPage: true }), 'text-input-field-wait', userId, this.logger, botId);
      }
    );

    await this.context.page.waitForTimeout(3000);

    await this.context.page.fill('input[type="text"][aria-label="Your name"]', name ? name : 'ScreenApp Notetaker');

    // Click the join button
    await this.clickJoinButton(userId, botId);

    // Wait at lobby for admission
    const waitingAtLobbySuccess = await this.lobbyHandler.waitAtLobby();

    if (!waitingAtLobbySuccess) {
      const bodyText = await this.context.page.evaluate(() => document.body.innerText);

      const userDenied = (bodyText || '')?.includes(GOOGLE_REQUEST_DENIED);

      this.logger.error('Cannot finish wait at the lobby check', {
        userDenied,
        waitingAtLobbySuccess,
        bodyTextLength: bodyText?.length || 0,
        bodyTextPreview: bodyText?.substring(0, 500) || 'No body text'
      });
      throw new WaitingAtLobbyRetryError('Google Meet bot could not enter the meeting...', bodyText ?? '', !userDenied, 2);
    }

    pushState('joined');

    // Dismiss any "Got it" modals
    await this.modalHandler.dismissGotItModals();
  }

  private async clickJoinButton(userId: string, botId?: string): Promise<void> {
    await retryActionWithWait(
      'Clicking the "Ask to join" button',
      async () => {
        const possibleTexts = [
          'Ask to join',
          'Join now',
          'Join anyway',
        ];

        let buttonClicked = false;

        for (const text of possibleTexts) {
          try {
            const button = await this.context.page.locator('button', { hasText: new RegExp(text.toLocaleLowerCase(), 'i') }).first();
            const buttonCount = await button.count();

            if (buttonCount > 0) {
              await button.click({ timeout: 5000 });
              buttonClicked = true;
              break;
            } else {
              this.logger.warn(`No buttons found for text "${text}"`);
            }
          } catch (err) {
            this.logger.error(`Error clicking "${text}" button:`, {
              error: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined
            });
          }
        }

        if (!buttonClicked) {
          throw new Error('Unable to complete the join action...');
        }
      },
      this.logger,
      3,
      15000,
      async () => {
        await uploadDebugImage(await this.context.page.screenshot({ type: 'png', fullPage: true }), 'ask-to-join-button-click', userId, this.logger, botId);
      }
    );
  }
}
