import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { JoinParams } from './AbstractMeetBot';
import { BotStatus } from '../types';
import config from '../config';
import { WaitingAtLobbyRetryError } from '../error';
import { patchBotStatus } from '../services/botService';
import { handleWaitingAtLobbyError, MeetBotBase } from './MeetBotBase';
import { v4 } from 'uuid';
import { Logger } from 'winston';
import { retryActionWithWait } from '../util/resilience';
import { RecordingTask } from '../tasks/RecordingTask';
import { VirtualCamera } from '../util/virtualCamera';

const stealthPlugin = StealthPlugin();
stealthPlugin.enabledEvasions.delete('iframe.contentWindow');
stealthPlugin.enabledEvasions.delete('media.codecs');
chromium.use(stealthPlugin);

// Detect these dynamically and leave the meeting when necessary...
export const GOOGLE_REQUEST_DENIED = 'Someone in the call denied your request to join';
export const GOOGLE_REQUEST_TIMEOUT = 'No one responded to your request to join the call';

export class GoogleMeetBot extends MeetBotBase {
  private _logger: Logger;
  private virtualCamera: VirtualCamera | null = null;

  constructor(logger: Logger) {
    super();
    this.slightlySecretId = v4();
    this._logger = logger;
  }

  async join({ url, name, bearerToken, teamId, timezone, userId, eventId, botId }: JoinParams): Promise<void> {
    const _state: BotStatus[] = ['processing'];

    try {
      const pushState = (st: BotStatus) => _state.push(st);
      await this.joinMeeting({ url, name, bearerToken, teamId, timezone, userId, eventId, botId, pushState });
      await patchBotStatus({ botId, eventId, provider: 'google', status: _state, token: bearerToken }, this._logger);

    } catch (error) {
      if (!_state.includes('finished'))
        _state.push('failed');

      await patchBotStatus({ botId, eventId, provider: 'google', status: _state, token: bearerToken }, this._logger);

      // Stop virtual camera on error
      if (this.virtualCamera) {
        await this.virtualCamera.stop();
      }

      if (error instanceof WaitingAtLobbyRetryError) {
        await handleWaitingAtLobbyError({ token: bearerToken, botId, eventId, provider: 'google', error }, this._logger);
      }

      throw error;
    }
  }

  private async joinMeeting({ url, name, teamId, userId, eventId, botId, pushState }: JoinParams & { pushState(state: BotStatus): void }): Promise<void> {
    // Log the meeting details for debugging
    this._logger.info('Starting Google Meet session', { url, name, teamId, userId, eventId, botId });
    this._logger.info('Launching browser...');

    const browserArgs: string[] = [
      '--enable-usermedia-screen-capturing',
      '--allow-http-screen-capture',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--use-gl=egl',
      '--window-size=${width},${height}',
      '--auto-accept-this-tab-capture',
      '--enable-features=MediaRecorder',
    ];
    const size = { width: 1280, height: 720 };

    const browser = await chromium.launch({
      headless: false,
      args: browserArgs,
      ignoreDefaultArgs: ['--mute-audio'],
      executablePath: config.chromeExecutablePath,
    });

    const context = await browser.newContext({
      permissions: ['camera', 'microphone'],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
      viewport: size,
    });
    await context.grantPermissions(['microphone', 'camera'], { origin: url });

    this.page = await context.newPage();

    // Initialize virtual camera
    this.virtualCamera = new VirtualCamera(this.page, this._logger);
    await this.virtualCamera.initialize();
    await this.virtualCamera.start();

    this._logger.info('Navigating to Google Meet URL...');
    await this.page.goto(url, { waitUntil: 'networkidle' });

    this._logger.info('Waiting for 10 seconds...');
    await this.page.waitForTimeout(3000);

    const dismissDeviceCheck = async () => {
      try {
        this._logger.info('Clicking Continue without microphone and camera button...');
        await retryActionWithWait(
          'Clicking the "Continue without microphone and camera" button',
          async () => {
            await this.page.getByRole('button', { name: 'Continue without microphone and camera' }).waitFor({ timeout: 30000 });
            await this.page.getByRole('button', { name: 'Continue without microphone and camera' }).click();
          },
          this._logger,
          1,
          15000,
        );
      } catch (dismissError) {
        this._logger.info('Continue without microphone and camera button is probably missing!...');
      }
    };

    await dismissDeviceCheck();

    this._logger.info('Waiting for the input field to be visible...');
    await retryActionWithWait(
      'Waiting for the input field',
      async () => await this.page.waitForSelector('input[type="text"][aria-label="Your name"]', { timeout: 10000 }),
      this._logger,
      3,
      15000,
    );

    this._logger.info('Waiting for 10 seconds...');
    await this.page.waitForTimeout(3000);

    this._logger.info('Filling the input field with the name...');
    await this.page.fill('input[type="text"][aria-label="Your name"]', name ? name : 'ScreenApp Notetaker');

    this._logger.info('Waiting for 10 seconds...');
    await this.page.waitForTimeout(3000);

    await retryActionWithWait(
      'Clicking the "Ask to join" button',
      async () => {
        // Using the Order of most probable detection
        const possibleTexts = [
          'Ask to join',
          'Join now',
          'Join anyway',
        ];

        let buttonClicked = false;

        for (const text of possibleTexts) {
          try {
            const button = await this.page.locator('button', { hasText: new RegExp(text.toLocaleLowerCase(), 'i') }).first();
            if (await button.count() > 0) {
              await button.click({ timeout: 5000 });
              buttonClicked = true;
              this._logger.info(`Success clicked using "${text}" action...`);
              break;
            }
          } catch (err) {
            this._logger.warn(`Unable to click using "${text}" action...`);
          }
        }

        // Throws to initiate retries
        if (!buttonClicked) {
          throw new Error('Unable to complete the join action...');
        }
      },
      this._logger,
      3,
      15000,
    );

    // Do this to ensure meeting bot has joined the meeting

    try {
      const wanderingTime = config.joinWaitTime * 60 * 1000; // Give some time to admit the bot

      let waitTimeout: NodeJS.Timeout;
      let waitInterval: NodeJS.Timeout;

      const waitAtLobbyPromise = new Promise<boolean>((resolveWaiting) => {
        waitTimeout = setTimeout(() => {
          clearInterval(waitInterval);
          resolveWaiting(false);
        }, wanderingTime);

        waitInterval = setInterval(async () => {
          try {
            let peopleElement;
            let callButtonElement;

            try {
              peopleElement = await this.page.waitForSelector('button[aria-label="People"]', { timeout: 5000 });
            } catch (e) {
              this._logger.error(
                'wait error', { error: e }
              );
              //do nothing
            }

            try {
              callButtonElement = await this.page.waitForSelector('button[aria-label="Leave call"]', { timeout: 5000 });
            } catch (e) {
              this._logger.error(
                'wait error', { error: e }
              );
              //do nothing
            }

            if (peopleElement || callButtonElement) {
              this._logger.info('Google Meet Bot is entering the meeting...', { userId, teamId });
              clearInterval(waitInterval);
              clearTimeout(waitTimeout);
              resolveWaiting(true);
            }
          } catch (e) {
            this._logger.error(
              'wait error', { error: e }
            );
            // Do nothing
          }
        }, 20000);
      });

      const waitingAtLobbySuccess = await waitAtLobbyPromise;
      if (!waitingAtLobbySuccess) {
        const bodyText = await this.page.evaluate(() => document.body.innerText);

        const userDenied = (bodyText || '')?.includes(GOOGLE_REQUEST_DENIED);

        this._logger.error('Cant finish wait at the lobby check', { userDenied, waitingAtLobbySuccess, bodyText });

        throw new WaitingAtLobbyRetryError('Google Meet bot could not enter the meeting...', bodyText ?? '', !userDenied, 2);
      }
    } catch (lobbyError) {
      this._logger.info('Closing the browser on error...', lobbyError);

      // Stop virtual camera
      if (this.virtualCamera) {
        await this.virtualCamera.stop();
      }

      await this.page.context().browser()?.close();

      throw lobbyError;
    }

    pushState('joined');

    try {
      this._logger.info('Waiting for the "Got it" button...');
      await this.page.waitForSelector('button:has-text("Got it")', { timeout: 15000 });

      this._logger.info('Going to click all visible "Got it" buttons...');

      let gotItButtonsClicked = 0;
      let previousButtonCount = -1;
      let consecutiveNoChangeCount = 0;
      const maxConsecutiveNoChange = 2; // Stop if button count doesn't change for 2 consecutive iterations

      while (true) {
        const visibleButtons = await this.page.locator('button:visible', {
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
            this._logger.warn(`Button count hasn't changed for ${maxConsecutiveNoChange} iterations, stopping`);
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
            this._logger.info(`Clicked a "Got it" button #${gotItButtonsClicked}`);

            await this.page.waitForTimeout(2000);
          } catch (err) {
            this._logger.warn('Click failed, possibly already dismissed', { error: err });
          }
        }

        await this.page.waitForTimeout(2000);
      }
    } catch (error) {
      // Log and ignore this error
      this._logger.info('"Got it" modals might be missing...', { error });
    }

    // Recording the meeting page
    this._logger.info('Begin recording...');
    console.log('🎬 Starting recording with RecordingTask...');

    // Use RecordingTask for both video and audio recording
    const recordingTask = new RecordingTask(
      userId,
      teamId,
      this.page,
      config.maxRecordingDuration * 60 * 1000, // Convert to milliseconds
      this.slightlySecretId,
      this._logger
    );

    await recordingTask.runAsync(null);

    pushState('finished');
  }
}
