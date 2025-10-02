/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger } from 'winston';
import config from '../../config';
import { getWaitingPromise } from '../../lib/promise';
import { vp9MimeType, webmMimeType } from '../../lib/recording';
import { IUploader } from '../../middleware/disk-uploader';
import { IGoogleMeetChatHandler, IGoogleMeetInactivityHandler, IGoogleMeetRecordingHandler } from '../../types';
import { browserLogCaptureCallback } from '../../util/logger';

export class GoogleMeetRecordingHandler implements IGoogleMeetRecordingHandler {
  private context: any;
  private logger: Logger;
  private chatHandler: IGoogleMeetChatHandler;
  private inactivityHandler: IGoogleMeetInactivityHandler;

  constructor(
    context: any,
    logger: Logger,
    chatHandler: IGoogleMeetChatHandler,
    inactivityHandler: IGoogleMeetInactivityHandler
  ) {
    this.context = context;
    this.logger = logger;
    this.chatHandler = chatHandler;
    this.inactivityHandler = inactivityHandler;
    this.logger.info('RECORDING: RecordingHandler initialized');
  }

  async recordMeetingPage({
    teamId,
    userId,
    eventId,
    botId,
    uploader
  }: {
    teamId: string;
    userId: string;
    eventId?: string;
    botId?: string;
    uploader: IUploader;
  }): Promise<void> {
    this.logger.info('🎥 RecordingHandler.recordMeetingPage STARTED', { teamId, userId, eventId, botId });
    this.logger.info('Recording process starting...', { teamId, userId, eventId, botId });

    const duration = config.maxRecordingDuration * 60 * 1000;
    const inactivityLimit = config.inactivityLimit * 60 * 1000;

    this.logger.info('Recording configuration:', {
      duration,
      inactivityLimit,
      maxRecordingDuration: config.maxRecordingDuration,
      inactivityLimitConfig: config.inactivityLimit
    });

    // Setup browser console logging
    this.logger.info('Setting up browser console logging...');
    this.setupBrowserLogging();

    // Setup data upload functionality
    this.logger.info('Setting up data upload functionality...');
    await this.setupDataUpload(uploader);

    // Create waiting promise
    this.logger.info('Waiting for recording duration', config.maxRecordingDuration, 'minutes...');
    const processingTime = 0.2 * 60 * 1000;
    const waitingPromise = getWaitingPromise(processingTime + duration);

    waitingPromise.promise.then(async () => {
      this.logger.info('Closing the browser...');
      await this.context.page.context().browser()?.close();

      this.logger.info('All done ✨', { eventId, botId, userId, teamId });
    });

    // Setup meeting end handler with resolveEarly
    this.logger.info('Setting up meeting end handler...');
    await this.setupMeetingEndHandler(waitingPromise.resolveEarly);

    // Setup chat reply handler
    this.logger.info('Setting up chat reply handler...');
    await this.setupChatReplyHandler();

    // Send initial chat message
    this.logger.info('Sending initial chat message...');
    await this.chatHandler.sendChatMessage();

    // Inject recording code into browser
    this.logger.info('Injecting recording code into browser...');
    await this.injectRecordingCode(teamId, duration, inactivityLimit, userId);
    this.logger.info('Recording code injection completed');

    await waitingPromise.promise;
  }

  private setupBrowserLogging(): void {
    this.context.page?.on('console', async (msg: any) => {
      try {
        await browserLogCaptureCallback(this.logger, msg);
      } catch (err) {
        this.logger.info('Playwright chrome logger: Failed to log browser messages...', err?.message);
      }
    });
  }

  private async setupDataUpload(uploader: IUploader): Promise<void> {
    await this.context.page.exposeFunction('screenAppSendData', async (slightlySecretId: string, data: string) => {
      if (slightlySecretId !== this.context.slightlySecretId) return;

      const buffer = Buffer.from(data, 'base64');
      await uploader.saveDataToTempFile(buffer);
    });
  }

  private async setupMeetingEndHandler(resolveEarly: () => void): Promise<void> {
    await this.context.page.exposeFunction('screenAppMeetEnd', (slightlySecretId: string) => {
      if (slightlySecretId !== this.context.slightlySecretId) return;
      try {
        this.logger.info('Attempt to end meeting early - resolving waiting promise...');
        // Resolve the waiting promise early to continue the flow
        resolveEarly();
      } catch (error) {
        console.error('Could not process meeting end event', error);
      }
    });
  }

  private async setupChatReplyHandler(): Promise<void> {
    await this.context.page.exposeFunction('screenAppSendChatReply', async (slightlySecretId: string, replyText: string) => {
      if (slightlySecretId !== this.context.slightlySecretId) return;
      try {
        // Call sendReplyMessage with replyText as messageContent
        // Message ID will be tracked internally by ChatHandler
        await this.chatHandler.sendReplyMessage(replyText);
      } catch (error) {
        console.error('Could not send chat reply:', error);
      }
    });
  }

  private async injectRecordingCode(teamId: string, duration: number, inactivityLimit: number, userId: string): Promise<void> {
    await this.context.page.evaluate(
      async ({ teamId, duration, inactivityLimit, userId, slightlySecretId, activateInactivityDetectionAfterMinutes, activateInactivityDetectionAfter, primaryMimeType, secondaryMimeType }:
        { teamId: string, userId: string, duration: number, inactivityLimit: number, slightlySecretId: string, activateInactivityDetectionAfter: string, activateInactivityDetectionAfterMinutes: number, primaryMimeType: string, secondaryMimeType: string }) => {
        let timeoutId: NodeJS.Timeout;
        let inactivityParticipantDetectionTimeout: NodeJS.Timeout;
        let inactivitySilenceDetectionTimeout: NodeJS.Timeout;
        let isOnValidGoogleMeetPageInterval: NodeJS.Timeout | null = null;
        let chatScanInterval: NodeJS.Timeout;
        let isRecordingStopped = false;
        const processedMessageIds = new Set();
        const processedMessageContents = new Set();
        const processedContainers = new Set();

        // Reset tracking every 10 minutes to avoid memory buildup
        setInterval(() => {
          processedMessageIds.clear();
          processedMessageContents.clear();
          processedContainers.clear();
        }, 10 * 60 * 1000);

        const sendChunkToServer = async (chunk: ArrayBuffer) => {
          function arrayBufferToBase64(buffer: ArrayBuffer) {
            let binary = '';
            const bytes = new Uint8Array(buffer);
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
          }
          const base64 = arrayBufferToBase64(chunk);
          await (window as any).screenAppSendData(slightlySecretId, base64);
        };

        async function startRecording() {
          console.log('Will activate the inactivity detection after', activateInactivityDetectionAfter);

          if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            console.error('MediaDevices or getDisplayMedia not supported in this browser.');
            return;
          }

          const stream: MediaStream = await (navigator.mediaDevices as any).getDisplayMedia({
            video: true,
            audio: {
              autoGainControl: false,
              channels: 2,
              channelCount: 2,
              echoCancellation: false,
              noiseSuppression: false,
            },
            preferCurrentTab: true,
          });

          const audioTracks = stream.getAudioTracks();
          const hasAudioTracks = audioTracks.length > 0;

          if (!hasAudioTracks) {
            console.warn('No audio tracks available for silence detection. Will rely only on presence detection.');
          }

          let options: MediaRecorderOptions = {};
          if (MediaRecorder.isTypeSupported(primaryMimeType)) {
            console.log(`Media Recorder will use ${primaryMimeType} codecs...`);
            options = { mimeType: primaryMimeType };
          }
          else {
            console.warn(`Media Recorder did not find primary mime type codecs ${primaryMimeType}, Using fallback codecs ${secondaryMimeType}`);
            options = { mimeType: secondaryMimeType };
          }

          const mediaRecorder = new MediaRecorder(stream, { ...options });

          mediaRecorder.ondataavailable = async (event: BlobEvent) => {
            if (!event.data.size) {
              console.warn('Received empty chunk...');
              return;
            }
            try {
              const arrayBuffer = await event.data.arrayBuffer();
              sendChunkToServer(arrayBuffer);
            } catch (error) {
              console.error('Error uploading chunk:', error);
            }
          };

          const chunkDuration = 2000;
          mediaRecorder.start(chunkDuration);

          // Setup modal dismissal
          const setupModalDismissal = () => {
            let dismissModalErrorCount = 0;
            const maxDismissModalErrorCount = 10;
            const dismissModalsInterval = setInterval(() => {
              try {
                const buttons = document.querySelectorAll('button');
                const dismissButtons = Array.from(buttons).filter((button) => button?.offsetParent !== null && button?.innerText?.includes('Got it'));
                if (dismissButtons.length > 0) {
                  dismissButtons[0].click();
                }
              } catch (error) {
                dismissModalErrorCount += 1;
                if (dismissModalErrorCount > maxDismissModalErrorCount) {
                  clearInterval(dismissModalsInterval);
                }
              }
            }, 2000);
          };

          // Setup page validation
          const setupPageValidation = () => {
            const isOnValidGoogleMeetPage = () => {
              try {
                const currentUrl = window.location.href;
                if (!currentUrl.includes('meet.google.com')) {
                  console.warn('No longer on Google Meet page - URL changed to:', currentUrl);
                  return false;
                }

                const currentBodyText = document.body.innerText;
                if (currentBodyText.includes('You\'ve been removed from the meeting')) {
                  console.warn('Bot was removed from the meeting - ending recording on team:', userId, teamId);
                  return false;
                }

                if (currentBodyText.includes('No one responded to your request to join the call')) {
                  console.warn('Bot was not admitted to the meeting - ending recording on team:', userId, teamId);
                  return false;
                }

                const hasMeetElements = document.querySelector('button[aria-label="People"]') !== null ||
                  document.querySelector('button[aria-label="Leave call"]') !== null;

                if (!hasMeetElements) {
                  console.warn('Google Meet UI elements not found - page may have changed state');
                  return false;
                }

                return true;
              } catch (error) {
                console.error('Error checking page validity:', error);
                return false;
              }
            };

            isOnValidGoogleMeetPageInterval = setInterval(() => {
              if (!isOnValidGoogleMeetPage()) {
                console.log('Google Meet page state changed - ending recording on team:', userId, teamId);
                clearInterval(isOnValidGoogleMeetPageInterval!);
                (window as any).screenAppMeetEnd(slightlySecretId);
              }
            }, 10000);
          };

          // Setup chat scanning
          const setupChatScanning = () => {
            const scanAndReplyChatMessages = async () => {
              try {
                const userContainers = document.querySelectorAll('div.Ss4fHf > div.beTDc');

                for (const userContainer of userContainers) {
                  const parentContainer = userContainer.parentElement;
                  const senderElement = parentContainer?.querySelector('div[class*="poVWob"]');
                  const senderName = senderElement?.textContent?.trim();
                  const safeSenderName = senderName || 'Unknown';
                  const containerSignature = parentContainer?.outerHTML + '|' + userContainer.outerHTML;

                  if (safeSenderName === 'You') {
                    processedContainers.add(containerSignature);
                    continue;
                  }

                  const messageElements = userContainer.querySelectorAll('div[data-message-id]');
                  for (const messageElement of messageElements) {
                    const messageId = messageElement.getAttribute('data-message-id');
                    const contentElement = messageElement.querySelector('div[jsname="dTKtvb"] div');
                    const messageContent = contentElement?.textContent?.trim();

                    if (!messageId || !messageContent || processedMessageIds.has(messageId) || processedMessageContents.has(messageContent) || processedContainers.has(containerSignature)) {
                      continue;
                    }

                    // Only process user messages that mention @Meobeo
                    if (messageContent &&
                      !messageContent.includes('tôi đã nhận được tin nhắn') &&
                      !messageContent.includes('Đã bắt đầu ghi hình') &&
                      safeSenderName !== 'You' &&
                      messageContent.includes('@Meobeo')) { // Only respond to messages containing @Meobeo

                      const replyText = `tôi đã nhận được tin nhắn "${messageContent}" từ "${safeSenderName}"`;

                      // Mark as processed BEFORE sending reply to prevent duplicate processing
                      processedMessageIds.add(messageId);
                      processedMessageContents.add(messageContent);
                      processedContainers.add(containerSignature);

                      try {
                        await (window as any).screenAppSendChatReply(slightlySecretId, replyText);
                      } catch (replyError) {
                        // Remove from processed sets if reply failed, so it can be retried
                        processedMessageIds.delete(messageId);
                        processedMessageContents.delete(messageContent);
                        processedContainers.delete(containerSignature);
                      }
                    }
                  }
                }
              } catch (error) {
                console.error('CHAT_SCAN: Error scanning messages', error);
              }
            };

            chatScanInterval = setInterval(scanAndReplyChatMessages, 5000);
          };

          const stopTheRecording = async () => {
            if (isRecordingStopped) {
              return;
            }

            isRecordingStopped = true;

            try {
              // Stop media recorder if it exists and is recording
              if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
              }
            } catch (error) {
              console.error('RECORDING_STOP: Error stopping media recorder:', error);
            }

            try {
              // Stop all stream tracks if stream exists
              if (stream) {
                stream.getTracks().forEach((track) => {
                  if (track.readyState !== 'ended') {
                    track.stop();
                  }
                });
              }
            } catch (error) {
              console.error('RECORDING_STOP: Error stopping stream tracks:', error);
            }

            // Clear timeouts and intervals
            try {
              if (timeoutId) clearTimeout(timeoutId);
              if (inactivityParticipantDetectionTimeout) clearTimeout(inactivityParticipantDetectionTimeout);
              if (inactivitySilenceDetectionTimeout) clearTimeout(inactivitySilenceDetectionTimeout);
              if (isOnValidGoogleMeetPageInterval) clearInterval(isOnValidGoogleMeetPageInterval);
              if (chatScanInterval) clearInterval(chatScanInterval);
            } catch (error) {
              console.error('RECORDING_STOP: Error clearing timeouts/intervals:', error);
            }

            // Notify parent about meeting end
            try {
              (window as any).screenAppMeetEnd(slightlySecretId);
            } catch (error) {
              console.error('RECORDING_STOP: Error sending meeting end notification:', error);
            }
          };

          // Setup participant detection
          const setupParticipantDetection = () => {
            const detectLoneParticipantResilient = (): void => {
              const re = /^[0-9]+$/;

              const getContributorsCount = (): number | undefined => {
                const findPeopleButton = () => {
                  let btn: Element | null | undefined = document.querySelector('button[aria-label^="People -"]');
                  if (btn) return btn;

                  btn = document.querySelector('button[aria-label*="People"]');
                  if (btn) return btn;

                  const allBtns = Array.from(document.querySelectorAll('button[aria-label]'));
                  btn = allBtns.find(b => {
                    const label = b.getAttribute('aria-label');
                    return label && /^People - \d+ joined$/.test(label);
                  });
                  if (btn) return btn;

                  btn = allBtns.find(b =>
                    Array.from(b.querySelectorAll('i')).some(i =>
                      i.textContent && i.textContent.trim() === 'people'
                    )
                  );
                  if (btn) return btn;

                  return null;
                };

                try {
                  const peopleBtn = findPeopleButton();
                  if (peopleBtn) {
                    const divs = Array.from((peopleBtn.parentNode as HTMLElement)?.parentNode?.querySelectorAll('div') ?? []);
                    for (const node of divs) {
                      if (typeof (node as HTMLElement).innerText === 'string' && re.test((node as HTMLElement).innerText.trim())) {
                        return Number((node as HTMLElement).innerText.trim());
                      }
                    }
                  }
                } catch {
                  console.log('1 Error getting contributors count:', { bodyText: `${document.body.innerText?.toString()}` });
                }

                return undefined;
              };

              const retryWithBackoff = (): void => {
                setTimeout(function check() {
                  let contributors: number | undefined;
                  try {
                    contributors = getContributorsCount();
                    if (typeof contributors === 'undefined') {
                      retryWithBackoff();
                      return;
                    }
                    if (contributors < 2) {
                      stopTheRecording();
                      return;
                    }
                  } catch (err) {
                    retryWithBackoff();
                    return;
                  }
                  retryWithBackoff();
                }, 5000);
              };

              retryWithBackoff();
            };

            inactivityParticipantDetectionTimeout = setTimeout(() => {
              detectLoneParticipantResilient();
            }, activateInactivityDetectionAfterMinutes * 60 * 1000);
          };

          // Setup silence detection
          const setupSilenceDetection = () => {
            if (!hasAudioTracks) {
              console.warn('Skipping silence detection - no audio tracks available.');
              return;
            }

            try {
              const audioContext = new AudioContext();
              const mediaSource = audioContext.createMediaStreamSource(stream);
              const analyser = audioContext.createAnalyser();
              analyser.fftSize = 256;
              mediaSource.connect(analyser);

              const dataArray = new Uint8Array(analyser.frequencyBinCount);
              let silenceDuration = 0;
              const silenceThreshold = 10;
              let monitor = true;

              const monitorSilence = () => {
                try {
                  analyser.getByteFrequencyData(dataArray);
                  const audioActivity = dataArray.reduce((a, b) => a + b) / dataArray.length;
                  if (audioActivity < silenceThreshold) {
                    silenceDuration += 100;
                    if (silenceDuration >= inactivityLimit) {
                      monitor = false;
                      stopTheRecording();
                    }
                  } else {
                    silenceDuration = 0;
                  }

                  if (monitor) {
                    setTimeout(monitorSilence, 100);
                  }
                } catch (error) {
                  console.error('Error in silence monitoring:', error);
                  monitor = false;
                }
              };

              inactivitySilenceDetectionTimeout = setTimeout(() => {
                monitorSilence();
              }, activateInactivityDetectionAfterMinutes * 60 * 1000);
            } catch (error) {
              console.error('Failed to initialize silence detection:', error);
            }
          };

          setupModalDismissal();
          setupPageValidation();
          setupChatScanning();
          setupParticipantDetection();
          setupSilenceDetection();

          timeoutId = setTimeout(async () => {
            stopTheRecording();
          }, duration);
        }

        await startRecording();
      },
      {
        teamId,
        duration,
        inactivityLimit,
        userId,
        slightlySecretId: this.context.slightlySecretId,
        activateInactivityDetectionAfterMinutes: config.activateInactivityDetectionAfter,
        activateInactivityDetectionAfter: new Date(new Date().getTime() + config.activateInactivityDetectionAfter * 60 * 1000).toISOString(),
        primaryMimeType: webmMimeType,
        secondaryMimeType: vp9MimeType
      }
    );
  }
}
