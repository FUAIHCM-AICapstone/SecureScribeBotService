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

      const wanderingTime = config.joinWaitTime * 60 * 1000; // Give some time to admit the bot

      let waitTimeout: NodeJS.Timeout;
      let waitInterval: NodeJS.Timeout;

      const waitAtLobbyPromise = new Promise<boolean>((resolveWaiting) => {
        waitTimeout = setTimeout(() => {
          this.logger.warn('Lobby wait timeout reached, resolving as false');
          clearInterval(waitInterval);
          resolveWaiting(false);
        }, wanderingTime);

        waitInterval = setInterval(async () => {
          try {
            const lobbyModeStatus = await this.detectLobbyMode();

            if (lobbyModeStatus === 'WAITING_FOR_HOST_TO_ADMIT_BOT') {
            } else if (lobbyModeStatus === 'WAITING_REQUEST_TIMEOUT') {
              clearInterval(waitInterval);
              clearTimeout(waitTimeout);
              resolveWaiting(false);
              return;
            } else if (lobbyModeStatus === 'LOBBY_MODE_NOT_ACTIVE') {
              clearInterval(waitInterval);
              clearTimeout(waitTimeout);
              resolveWaiting(true);
              return;
            } else {
            }

            // Check if bot was denied access
            const botWasDeniedAccess = await this.checkAccessDenied();
            if (botWasDeniedAccess) {
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
