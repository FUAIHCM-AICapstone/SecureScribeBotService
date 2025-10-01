/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger } from 'winston';
import config from '../../config';
import { GOOGLE_LOBBY_MODE_HOST_TEXT, GOOGLE_REQUEST_DENIED, GOOGLE_REQUEST_TIMEOUT } from '../../constants';
import { IGoogleMeetLobbyHandler } from '../../types';

export class GoogleMeetLobbyHandler implements IGoogleMeetLobbyHandler {
  private context: any;
  private logger: Logger;

  constructor(context: any, logger: Logger) {
    console.log('🎭 LobbyHandler constructor called');
    this.context = context;
    this.logger = logger;
    console.log('✅ LobbyHandler constructor completed');
  }

  async waitAtLobby(): Promise<boolean> {
    try {
      this.logger.info('Starting lobby wait process...', {
        userId: this.context.userId,
        teamId: this.context.teamId,
        joinWaitTime: config.joinWaitTime
      });

      const wanderingTime = config.joinWaitTime * 60 * 1000; // Give some time to admit the bot
      this.logger.info('Lobby wait timeout set to:', { wanderingTime });

      let waitTimeout: NodeJS.Timeout;
      let waitInterval: NodeJS.Timeout;

      const waitAtLobbyPromise = new Promise<boolean>((resolveWaiting) => {
        this.logger.info('Setting up lobby wait timeout...');
        waitTimeout = setTimeout(() => {
          this.logger.warn('Lobby wait timeout reached, resolving as false');
          clearInterval(waitInterval);
          resolveWaiting(false);
        }, wanderingTime);

        waitInterval = setInterval(async () => {
          try {
            this.logger.info('Checking lobby mode status in interval...');
            const lobbyModeStatus = await this.detectLobbyMode();
            this.logger.info('Lobby mode detection result:', { lobbyModeStatus });

            if (lobbyModeStatus === 'WAITING_FOR_HOST_TO_ADMIT_BOT') {
              this.logger.info('Lobby Mode: Google Meet Bot is waiting for the host to admit it...', { userId: this.context.userId, teamId: this.context.teamId });
            } else if (lobbyModeStatus === 'WAITING_REQUEST_TIMEOUT') {
              this.logger.info('Lobby Mode: Google Meet Bot join request timed out...', { userId: this.context.userId, teamId: this.context.teamId });
              clearInterval(waitInterval);
              clearTimeout(waitTimeout);
              resolveWaiting(false);
              return;
            } else if (lobbyModeStatus === 'LOBBY_MODE_NOT_ACTIVE') {
              this.logger.info('Lobby Mode: Bot successfully entered the meeting', { userId: this.context.userId, teamId: this.context.teamId });
              clearInterval(waitInterval);
              clearTimeout(waitTimeout);
              resolveWaiting(true);
              return;
            } else {
              this.logger.info('Lobby Mode: Unknown status, continuing to wait...', { lobbyModeStatus });
            }

            // Check if bot was denied access
            const botWasDeniedAccess = await this.checkAccessDenied();
            if (botWasDeniedAccess) {
              this.logger.info('Google Meet Bot is denied access to the meeting...', { userId: this.context.userId, teamId: this.context.teamId });
              clearInterval(waitInterval);
              clearTimeout(waitTimeout);
              resolveWaiting(false);
            }
          } catch (e) {
            this.logger.error('wait error', { error: e });
          }
        }, 20000);
      });

      return await waitAtLobbyPromise;
    } catch (lobbyError) {
      this.logger.info('Closing the browser on error...', lobbyError);
      await this.context.page.context().browser()?.close();
      throw lobbyError;
    }
  }

  private async detectLobbyMode(): Promise<'WAITING_FOR_HOST_TO_ADMIT_BOT' | 'WAITING_REQUEST_TIMEOUT' | 'LOBBY_MODE_NOT_ACTIVE' | 'UNABLE_TO_DETECT_LOBBY_MODE'> {
    try {
      const lobbyModeHostWaitingText = await this.context.page.getByText(GOOGLE_LOBBY_MODE_HOST_TEXT);
      if (await lobbyModeHostWaitingText.count() > 0 && await lobbyModeHostWaitingText.isVisible()) {
        return 'WAITING_FOR_HOST_TO_ADMIT_BOT';
      }

      const lobbyModeRequestTimeoutText = await this.context.page.getByText(GOOGLE_REQUEST_TIMEOUT);
      if (await lobbyModeRequestTimeoutText.count() > 0 && await lobbyModeRequestTimeoutText.isVisible()) {
        return 'WAITING_REQUEST_TIMEOUT';
      }

      return 'LOBBY_MODE_NOT_ACTIVE';
    } catch (e) {
      this.logger.error('Error detecting lobby mode host waiting text...', { error: e, message: e?.message });
      return 'UNABLE_TO_DETECT_LOBBY_MODE';
    }
  }

  private async checkAccessDenied(): Promise<boolean> {
    try {
      const deniedText = await this.context.page.getByText(GOOGLE_REQUEST_DENIED);
      return await deniedText.count() > 0 && await deniedText.isVisible();
    } catch (e) {
      return false;
    }
  }
}
