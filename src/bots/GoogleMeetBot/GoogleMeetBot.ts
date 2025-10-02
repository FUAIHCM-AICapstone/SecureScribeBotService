/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import { v4 } from 'uuid';
import { Logger } from 'winston';
import { UnsupportedMeetingError, WaitingAtLobbyRetryError } from '../../error';
import { patchBotStatus } from '../../services/botService';
import { callWebhook, WebhookPayload } from '../../services/webhookService';
import { BotStatus, GoogleMeetHandlerContext } from '../../types';
import { JoinParams } from '../AbstractMeetBot';
import { handleUnsupportedMeetingError, handleWaitingAtLobbyError, MeetBotBase } from '../MeetBotBase';

// Import all handlers
import { GoogleMeetChatHandler } from './ChatHandler';
import { GoogleMeetInactivityHandler } from './InactivityHandler';
import { GoogleMeetJoinHandler } from './JoinHandler';
import { GoogleMeetLobbyHandler } from './LobbyHandler';
import { GoogleMeetModalHandler } from './ModalHandler';
import { GoogleMeetPageValidator } from './PageValidator';
import { GoogleMeetRecordingHandler } from './RecordingHandler';

export class GoogleMeetBot extends MeetBotBase {
  private _logger: Logger;
  private _correlationId: string;
  private context: GoogleMeetHandlerContext;
  private handlers: {
    joinHandler: GoogleMeetJoinHandler;
    chatHandler: GoogleMeetChatHandler;
    recordingHandler: GoogleMeetRecordingHandler;
    pageValidator: GoogleMeetPageValidator;
    lobbyHandler: GoogleMeetLobbyHandler;
    modalHandler: GoogleMeetModalHandler;
    inactivityHandler: GoogleMeetInactivityHandler;
  };

  constructor(logger: Logger, correlationId: string) {
    super();
    this.slightlySecretId = v4();
    this._logger = logger;
    this._correlationId = correlationId;

    // Test logger
    this._logger.info('GoogleMeetBot constructor called', { correlationId, slightlySecretId: this.slightlySecretId });

    // Initialize context for handlers
    this.context = {
      page: null,
      logger: this._logger,
      correlationId: this._correlationId,
      slightlySecretId: this.slightlySecretId,
      userId: '',
      teamId: '',
      botId: undefined,
      eventId: undefined,
    };

    // Initialize all handlers
    this._logger.info('🔧 Initializing handlers...');

    try {
      this._logger.info('🔧 Creating PageValidator...');
      this.handlers = {} as any; // Initialize empty first
      this.handlers.pageValidator = new GoogleMeetPageValidator(this.context, this._logger);
      this._logger.info('✅ PageValidator created');

      this._logger.info('🔧 Creating LobbyHandler...');
      this.handlers.lobbyHandler = new GoogleMeetLobbyHandler(this.context, this._logger);
      this._logger.info('✅ LobbyHandler created');

      this._logger.info('🔧 Creating ModalHandler...');
      this.handlers.modalHandler = new GoogleMeetModalHandler(this.context, this._logger);
      this._logger.info('✅ ModalHandler created');

      this._logger.info('🔧 Creating ChatHandler...');
      this.handlers.chatHandler = new GoogleMeetChatHandler(this.context, this._logger);
      this._logger.info('✅ ChatHandler created');

      this._logger.info('🔧 Creating InactivityHandler...');
      this.handlers.inactivityHandler = new GoogleMeetInactivityHandler(this.context);
      this._logger.info('✅ InactivityHandler created');

      this._logger.info('🔧 Creating JoinHandler...');
      this.handlers.joinHandler = new GoogleMeetJoinHandler(
        this.context,
        this._logger,
        this.handlers.pageValidator,
        this.handlers.lobbyHandler,
        this.handlers.modalHandler
      );
      this._logger.info('✅ JoinHandler created');

      this._logger.info('🔧 Creating RecordingHandler...');
      this.handlers.recordingHandler = new GoogleMeetRecordingHandler(
        this.context,
        this._logger,
        this.handlers.chatHandler,
        this.handlers.inactivityHandler
      );
      this._logger.info('✅ RecordingHandler created');

      this._logger.info('🎉 All handlers initialized successfully');
    } catch (error) {
      this._logger.error('❌ Error initializing handlers:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  async join({
    url,
    name,
    bearerToken,
    teamId,
    timezone,
    userId,
    eventId,
    botId,
    uploader,
    webhookUrl
  }: JoinParams): Promise<void> {
    this._logger.info('🚀 GoogleMeetBot.join() method called');
    this._logger.info('📋 Join parameters received:', {
      url: url?.substring(0, 50) + '...',
      name,
      userId,
      teamId,
      botId,
      eventId,
      hasUploader: !!uploader,
      hasWebhookUrl: !!webhookUrl
    });

    this._logger.info('GOOGLE MEET BOT JOIN STARTED', {
      url: url?.substring(0, 50) + '...',
      userId,
      teamId,
      botId,
      eventId,
      hasUploader: !!uploader,
      hasWebhookUrl: !!webhookUrl
    });

    const _state: BotStatus[] = ['processing'];

    const handleUpload = async () => {
      this._logger.info('UPLOAD: Starting recording upload to server', { userId, teamId, botId, eventId });
      const uploadResult = await uploader.uploadRecordingToRemoteStorage();
      this._logger.info('UPLOAD: Recording upload result', { uploadResult, userId, teamId, botId, eventId });
      return uploadResult;
    };

    try {
      // Update context with current request info
      this.context.userId = userId;
      this.context.teamId = teamId;
      this.context.botId = botId;
      this.context.eventId = eventId;

      const pushState = (st: BotStatus) => _state.push(st);

      this._logger.info('JOIN: Initiating meeting join process', {
        url,
        name,
        userId,
        botId,
        eventId,
        teamId,
        timezone
      });

      // Use the join handler to handle the meeting join process
      this._logger.info('🔗 Calling JoinHandler.joinMeeting()...');
      try {
        await this.handlers.joinHandler.joinMeeting({
          url,
          name,
          bearerToken,
          teamId,
          timezone,
          userId,
          eventId,
          botId,
          uploader,
          pushState
        });
        this._logger.info('✅ JoinHandler.joinMeeting() completed successfully');
      } catch (error) {
        this._logger.error('❌ Error in JoinHandler.joinMeeting():', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
      }

      this._logger.info('JOIN: Meeting join completed, proceeding to recording', {
        userId,
        botId,
        eventId
      });

      // Start recording the meeting
      this._logger.info('Starting recording process...');
      await this.handlers.recordingHandler.recordMeetingPage({
        teamId,
        userId,
        eventId,
        botId,
        uploader
      });
      this._logger.info('Recording process completed');

      // Update state to finished before upload
      pushState('finished');

      this._logger.info('Starting upload process...');
      const uploadResult = await handleUpload();
      this._logger.info('Upload process completed', { uploadSuccess: uploadResult.success });
      const uploadSuccess = uploadResult.success;

      if (_state.includes('finished') && !uploadSuccess) {
        _state.splice(_state.indexOf('finished'), 1, 'failed');
        this._logger.warn('UPLOAD: Upload failed after meeting finished', {
          userId,
          botId,
          eventId
        });
      }

      await patchBotStatus({
        botId,
        eventId,
        provider: 'google',
        status: _state,
        token: bearerToken
      }, this._logger);

      // Handle webhook call
      if (webhookUrl) {
        await this.handleWebhookCall({
          webhookUrl,
          bearerToken,
          uploadResult,
          uploadSuccess,
          _state,
          url,
          userId,
          teamId,
          botId,
          eventId
        });
      } else {
        await this.handleNoWebhookCleanup(uploadResult, uploadSuccess);
      }
    } catch (error) {
      // Ensure error is properly formatted before handling
      const safeError = error instanceof Error ? error : new Error(String(error || 'Unknown error occurred during meeting join'));
      await this.handleJoinError(safeError, {
        bearerToken,
        webhookUrl,
        _state,
        url,
        userId,
        teamId,
        botId,
        eventId
      });
    }
  }

  private async handleWebhookCall({
    webhookUrl,
    bearerToken,
    uploadResult,
    uploadSuccess,
    _state,
    url,
    userId,
    teamId,
    botId,
    eventId
  }: {
    webhookUrl: string;
    bearerToken: string;
    uploadResult: any;
    uploadSuccess: boolean;
    _state: BotStatus[];
    url: string;
    userId: string;
    teamId: string;
    botId?: string;
    eventId?: string;
  }): Promise<void> {
    this._logger.info('WEBHOOK: Preparing to call webhook', {
      webhookUrl,
      userId,
      teamId,
      botId,
      eventId,
      uploadSuccess,
      finalState: _state
    });

    let fileData: Buffer | undefined;
    let fileName: string | undefined;

    if (uploadResult.filePath && uploadResult.fileName) {
      try {
        fileData = await fs.promises.readFile(uploadResult.filePath);
        fileName = uploadResult.fileName;
        this._logger.info('WEBHOOK: File read successfully for webhook', {
          filePath: uploadResult.filePath,
          fileName,
          fileSize: fileData.length
        });
      } catch (fileReadError) {
        this._logger.error('WEBHOOK: Failed to read file for webhook', {
          filePath: uploadResult.filePath,
          error: fileReadError.message
        });
      }
    }

    const webhookPayload: WebhookPayload = {
      status: _state.includes('failed') ? 'failed' : 'completed',
      userId,
      teamId,
      botId,
      eventId,
      meetingUrl: url,
      timestamp: new Date().toISOString(),
      fileData,
      fileName,
      error: !uploadSuccess ? 'Upload failed or file missing' : undefined
    };

    this._logger.info('WEBHOOK: Sending payload', {
      hasFileData: !!fileData,
      fileName,
      fileSize: fileData?.length,
      status: webhookPayload.status
    });

    const webhookSuccess = await callWebhook(webhookUrl, bearerToken, webhookPayload, this._logger);

    if (webhookSuccess) {
      this._logger.info('WEBHOOK: Successfully called webhook', {
        webhookUrl,
        userId,
        teamId,
        botId,
        eventId
      });

      if (uploadResult.filePath) {
        try {
          await fs.promises.unlink(uploadResult.filePath);
          this._logger.info('CLEANUP: Temp file deleted after webhook', {
            filePath: uploadResult.filePath
          });
        } catch (deleteError) {
          this._logger.warn('CLEANUP: Failed to delete temp file after webhook', {
            filePath: uploadResult.filePath,
            error: deleteError.message
          });
        }
      }
    } else {
      this._logger.error('WEBHOOK: Failed to call webhook', {
        webhookUrl,
        userId,
        teamId,
        botId,
        eventId
      });
    }
  }

  private async handleNoWebhookCleanup(uploadResult: any, uploadSuccess: boolean): Promise<void> {
    this._logger.info('WEBHOOK: No webhook URL provided, skipping webhook call');

    if (uploadSuccess && uploadResult.filePath) {
      try {
        await fs.promises.unlink(uploadResult.filePath);
        this._logger.info('CLEANUP: Temp file deleted (no webhook)', {
          filePath: uploadResult.filePath
        });
      } catch (deleteError) {
        this._logger.warn('CLEANUP: Failed to delete temp file (no webhook)', {
          filePath: uploadResult.filePath,
          error: deleteError.message
        });
      }
    }
  }

  private async handleJoinError(
    error: any,
    {
      bearerToken,
      webhookUrl,
      _state,
      url,
      userId,
      teamId,
      botId,
      eventId
    }: {
      bearerToken: string;
      webhookUrl?: string;
      _state: BotStatus[];
      url: string;
      userId: string;
      teamId: string;
      botId?: string;
      eventId?: string;
    }
  ): Promise<void> {
    if (!_state.includes('finished')) _state.push('failed');

    this._logger.error('JOIN: Error during join process', {
      error: error.message,
      userId,
      botId,
      eventId
    });

    await patchBotStatus({
      botId,
      eventId,
      provider: 'google',
      status: _state,
      token: bearerToken
    }, this._logger);

    if (webhookUrl) {
      const webhookPayload: WebhookPayload = {
        status: 'failed',
        userId,
        teamId,
        botId,
        eventId,
        meetingUrl: url,
        timestamp: new Date().toISOString(),
        error: error.message
      };

      this._logger.info('WEBHOOK: Sending failure payload', webhookPayload);

      const webhookSuccess = await callWebhook(webhookUrl, bearerToken, webhookPayload, this._logger);

      if (webhookSuccess) {
        this._logger.info('WEBHOOK: Successfully called webhook for failure', {
          webhookUrl,
          userId,
          teamId,
          botId,
          eventId
        });
      } else {
        this._logger.error('WEBHOOK: Failed to call webhook for failure', {
          webhookUrl,
          userId,
          teamId,
          botId,
          eventId
        });
      }
    }

    if (error instanceof WaitingAtLobbyRetryError) {
      await handleWaitingAtLobbyError({ token: bearerToken, botId, eventId, provider: 'google', error }, this._logger);
    }

    if (error instanceof UnsupportedMeetingError) {
      await handleUnsupportedMeetingError({ token: bearerToken, botId, eventId, provider: 'google', error }, this._logger);
    }

    throw error;
  }
}
