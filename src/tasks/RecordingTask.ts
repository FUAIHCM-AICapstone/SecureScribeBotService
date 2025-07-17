import { Page } from 'playwright';
import { ContentType } from '../types';
import { Task } from '../lib/Task';
import config from '../config';
import { Logger } from 'winston';
import WebSocket from 'ws';

export class RecordingTask extends Task<null, void> {
  private userId: string;
  private teamId: string;
  private page: Page;
  private duration: number;
  private inactivityLimit: number;
  private slightlySecretId: string;
  private audioWs?: WebSocket; // WebSocket connection for audio streaming
  private audioSessionId?: string;

  constructor(
    userId: string,
    teamId: string,
    page: Page,
    duration: number,
    slightlySecretId: string,
    logger: Logger,
    audioSessionId?: string
  ) {
    super(logger);
    this.userId = userId;
    this.teamId = teamId;
    this.duration = duration;
    this.inactivityLimit = config.inactivityLimit * 60 * 1000;
    this.page = page;
    this.slightlySecretId = slightlySecretId;
    this.audioSessionId = audioSessionId;
  }

  // Audio streaming methods
  private async connectToAudioStream(sessionId?: string): Promise<string | null> {
    if (!config.audioStreaming.enabled) {
      console.log('🔇 Audio streaming is disabled in configuration');
      return null;
    }

    console.log('🎵 Starting audio streaming connection...');
    console.log(`📋 Session ID: ${sessionId || 'new session'}`);
    console.log(`👤 User ID: ${this.userId}`);
    console.log(`🏢 Team ID: ${this.teamId}`);

    try {
      let wsUrl = config.audioStreaming.wsEndpoint;

      if (sessionId) {
        // Connect to existing session
        wsUrl = `${config.audioStreaming.wsEndpoint}/${sessionId}?user_id=${this.userId}`;
        console.log(`🔗 Connecting to existing session: ${wsUrl}`);
      } else {
        // Create new session
        const params = new URLSearchParams({
          user_id: this.userId,
          sample_rate: config.audioStreaming.sampleRate.toString(),
          channels: config.audioStreaming.channels.toString(),
          format: config.audioStreaming.format,
        });
        wsUrl = `${config.audioStreaming.wsEndpoint}?${params.toString()}`;
        console.log(`🆕 Creating new session: ${wsUrl}`);
        console.log(`⚙️ Audio config: ${config.audioStreaming.sampleRate}Hz, ${config.audioStreaming.channels}ch, ${config.audioStreaming.format}`);
      }

      console.log('🚀 Initializing WebSocket connection...');
      this.audioWs = new WebSocket(wsUrl);

      return new Promise((resolve, reject) => {
        if (!this.audioWs) {
          reject(new Error('WebSocket not initialized'));
          return;
        }

        this.audioWs.on('open', () => {
          console.log('🎵 ✅ Audio streaming WebSocket connection established');
          console.log(`📡 Connected to: ${wsUrl}`);
          this._logger.info('Audio streaming WebSocket connected', {
            userId: this.userId,
            teamId: this.teamId,
            sessionId: sessionId,
            wsUrl: wsUrl
          });
          resolve(sessionId || 'new-session');
        });

        this.audioWs.on('message', (data: Buffer) => {
          console.log('📩 Received message from SecureScribe WebSocket:', data.toString());
          try {
            const response = JSON.parse(data.toString());
            console.log('📋 Parsed response:', response);
            if (response.session_id && !sessionId) {
              this.audioSessionId = response.session_id;
              console.log(`🔑 Audio session ID assigned: ${this.audioSessionId}`);
              this._logger.info('Audio session created', {
                sessionId: this.audioSessionId,
                userId: this.userId,
                teamId: this.teamId
              });
            }
          } catch (error) {
            console.error('⚠️ Failed to parse WebSocket response:', error);
            this._logger.warn('Failed to parse audio streaming response', { error });
          }
        });

        this.audioWs.on('error', (error: Error) => {
          console.error('🚨 Audio streaming WebSocket error:', error.message);
          this._logger.error('Audio streaming WebSocket error', {
            error: error.message,
            userId: this.userId,
            teamId: this.teamId
          });
          reject(error);
        });

        this.audioWs.on('close', () => {
          this._logger.info('Audio streaming WebSocket closed', {
            userId: this.userId,
            teamId: this.teamId
          });
        });
      });
    } catch (error) {
      console.error('🚨 Failed to connect to audio streaming service:', error);
      this._logger.error('Failed to connect to audio streaming service', {
        error: error instanceof Error ? error.message : error,
        userId: this.userId,
        teamId: this.teamId
      });
      return null;
    }
  }

  private async sendAudioChunk(audioData: string): Promise<boolean> {
    if (!this.audioWs || this.audioWs.readyState !== WebSocket.OPEN) {
      console.log('⚠️ Cannot send audio chunk - WebSocket not ready');
      console.log(`WebSocket state: ${this.audioWs ? 'exists' : 'null'}, readyState: ${this.audioWs?.readyState}`);
      return false;
    }

    try {
      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audioData, 'base64');
      console.log(`🎧 Sending audio chunk - Size: ${audioBuffer.length} bytes`);
      this.audioWs.send(audioBuffer);
      console.log('✅ Audio chunk sent successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to send audio chunk:', error);
      this._logger.error('Failed to send audio chunk', {
        error: error instanceof Error ? error.message : error,
        userId: this.userId,
        teamId: this.teamId
      });
      return false;
    }
  }

  private async closeAudioStream(): Promise<void> {
    if (!this.audioWs) {
      console.log('🔇 No audio WebSocket to close');
      return;
    }

    console.log('🔚 Closing audio streaming session...');
    try {
      // Send close control message
      const closeMessage = {
        type: 'control',
        action: 'close_session'
      };

      if (this.audioWs.readyState === WebSocket.OPEN) {
        console.log('📤 Sending close message to SecureScribe');
        this.audioWs.send(JSON.stringify(closeMessage));
        console.log('✅ Close message sent');
      } else {
        console.log(`⚠️ WebSocket not open (state: ${this.audioWs.readyState}), skipping close message`);
      }

      // Close the WebSocket connection
      console.log('🔌 Closing WebSocket connection');
      this.audioWs.close();
      this.audioWs = undefined;
      console.log('✅ Audio streaming session closed successfully');

      this._logger.info('Audio streaming session closed', {
        sessionId: this.audioSessionId,
        userId: this.userId,
        teamId: this.teamId
      });
    } catch (error) {
      console.error('❌ Error closing audio stream:', error);
      this._logger.error('Error closing audio stream', {
        error: error instanceof Error ? error.message : error,
        userId: this.userId,
        teamId: this.teamId
      });
    }
  }

  protected async execute(): Promise<void> {
    // Expose audio streaming functions to the browser context
    console.log('🔍 ==========DETAILED CONFIG INSPECTION==========');
    
    // Log safe config values to avoid circular references
    console.log('📊 Basic config values:');
    console.log(`   port: ${config.port}`);
    console.log(`   maxRecordingDuration: ${config.maxRecordingDuration}`);
    console.log(`   chromeExecutablePath: ${config.chromeExecutablePath}`);
    console.log(`   inactivityLimit: ${config.inactivityLimit}`);
    console.log(`   joinWaitTime: ${config.joinWaitTime}`);
    
    console.log('🎵 Audio streaming config:', JSON.stringify(config.audioStreaming, null, 2));
    console.log('🔧 Individual config values:');
    console.log(`   enabled: ${config.audioStreaming.enabled} (type: ${typeof config.audioStreaming.enabled})`);
    console.log(`   wsEndpoint: ${config.audioStreaming.wsEndpoint} (type: ${typeof config.audioStreaming.wsEndpoint})`);
    console.log(`   sampleRate: ${config.audioStreaming.sampleRate} (type: ${typeof config.audioStreaming.sampleRate})`);
    console.log(`   channels: ${config.audioStreaming.channels} (type: ${typeof config.audioStreaming.channels})`);
    console.log(`   format: ${config.audioStreaming.format} (type: ${typeof config.audioStreaming.format})`);
    console.log(`   chunkDuration: ${config.audioStreaming.chunkDuration} (type: ${typeof config.audioStreaming.chunkDuration})`);
    console.log('🌍 Environment variables:');
    console.log(`   ENABLE_AUDIO_STREAMING: ${process.env.ENABLE_AUDIO_STREAMING}`);
    console.log(`   AUDIO_STREAMING_WS_ENDPOINT: ${process.env.AUDIO_STREAMING_WS_ENDPOINT}`);
    console.log(`   AUDIO_SAMPLE_RATE: ${process.env.AUDIO_SAMPLE_RATE}`);
    console.log(`   AUDIO_CHANNELS: ${process.env.AUDIO_CHANNELS}`);
    console.log(`   AUDIO_FORMAT: ${process.env.AUDIO_FORMAT}`);
    console.log(`   AUDIO_CHUNK_DURATION: ${process.env.AUDIO_CHUNK_DURATION}`);
    console.log('🔍 ==============================================');
    
    if (config.audioStreaming.enabled) {
      console.log('🔧 ✅ Audio streaming is ENABLED - exposing functions to browser context...');
      await this.page.exposeFunction('connectToAudioStream', this.connectToAudioStream.bind(this));
      await this.page.exposeFunction('sendAudioChunk', this.sendAudioChunk.bind(this));
      await this.page.exposeFunction('closeAudioStream', this.closeAudioStream.bind(this));
      console.log('✅ Audio streaming functions exposed successfully');
    } else {
      console.log('🔇 ❌ Audio streaming is DISABLED - no functions to expose');
      console.log('💡 To enable audio streaming, set ENABLE_AUDIO_STREAMING=true in your .env file');
    }

    await this.page.evaluate(
      async ({
        teamId,
        duration,
        inactivityLimit,
        userId,
        slightlySecretId,
        activateInactivityDetectionAfter,
        activateInactivityDetectionAfterMinutes,
        audioStreamingConfig,
        audioSessionId,
      }: {
        teamId: string;
        duration: number;
        inactivityLimit: number;
        userId: string;
        slightlySecretId: string;
        activateInactivityDetectionAfter: string;
        activateInactivityDetectionAfterMinutes: number;
        audioStreamingConfig: {
          enabled: boolean;
          wsEndpoint: string;
          sampleRate: number;
          channels: number;
          format: string;
          chunkDuration: number;
        };
        audioSessionId?: string;
      }) => {
        let timeoutId: NodeJS.Timeout;
        let inactivityDetectionTimeout: NodeJS.Timeout;
        let audioStreamSessionId: string | null = audioSessionId || null;

        /**
         * @summary A simple method to reliably send chunks over exposeFunction
         * @param chunk Array buffer to send
         * @returns void
         */
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

        /**
         * @summary Send audio chunk to SecureScribe streaming API
         * @param chunk Audio buffer to send
         * @returns void
         */
        const sendAudioToSecureScribe = async (chunk: ArrayBuffer) => {
          if (!audioStreamingConfig.enabled) {
            console.log('🔇 Audio streaming disabled - skipping chunk');
            return;
          }

          console.log(`🎧 Processing audio chunk - Size: ${chunk.byteLength} bytes`);

          function arrayBufferToBase64(buffer: ArrayBuffer) {
            let binary = '';
            const bytes = new Uint8Array(buffer);
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
          }

          try {
            console.log('🔄 Converting audio buffer to base64...');
            const base64 = arrayBufferToBase64(chunk);
            console.log(`📊 Base64 audio size: ${base64.length} characters`);

            console.log('📤 Sending audio chunk to SecureScribe...');
            const success = await (window as any).sendAudioChunk(base64);

            if (success) {
              console.log('✅ Audio chunk sent successfully to SecureScribe');
            } else {
              console.warn('⚠️ Failed to send audio chunk to SecureScribe API - sendAudioChunk returned false');
            }
          } catch (error) {
            console.error('❌ Error sending audio to SecureScribe:', error);
          }
        };

        async function startRecording() {
          console.log('🎬 ==========BROWSER CONTEXT CONFIG==========');
          console.log('📊 Audio streaming config received in browser:', JSON.stringify(audioStreamingConfig, null, 2));
          console.log('🔧 Audio streaming config details:');
          console.log(`   enabled: ${audioStreamingConfig.enabled} (type: ${typeof audioStreamingConfig.enabled})`);
          console.log(`   wsEndpoint: ${audioStreamingConfig.wsEndpoint} (type: ${typeof audioStreamingConfig.wsEndpoint})`);
          console.log(`   sampleRate: ${audioStreamingConfig.sampleRate} (type: ${typeof audioStreamingConfig.sampleRate})`);
          console.log(`   channels: ${audioStreamingConfig.channels} (type: ${typeof audioStreamingConfig.channels})`);
          console.log(`   format: ${audioStreamingConfig.format} (type: ${typeof audioStreamingConfig.format})`);
          console.log(`   chunkDuration: ${audioStreamingConfig.chunkDuration} (type: ${typeof audioStreamingConfig.chunkDuration})`);
          console.log('🎵 Other parameters:');
          console.log(`   audioSessionId: ${audioSessionId}`);
          console.log(`   userId: ${userId}`);
          console.log(`   teamId: ${teamId}`);
          console.log('🎬 ==========================================');
          
          console.log(
            'Will activate the inactivity detection after',
            activateInactivityDetectionAfter
          );

          // Initialize audio streaming connection if enabled
          if (audioStreamingConfig.enabled) {
            console.log('🎵 ✅ Audio streaming is ENABLED in browser context - initializing connection...');
            console.log(`🔗 WebSocket endpoint: ${audioStreamingConfig.wsEndpoint}`);
            console.log(`⚙️ Audio config: ${audioStreamingConfig.sampleRate}Hz, ${audioStreamingConfig.channels}ch, ${audioStreamingConfig.format}`);
            console.log(`⏱️ Chunk duration: ${audioStreamingConfig.chunkDuration}ms`);

            try {
              console.log('🚀 Connecting to SecureScribe audio streaming...');
              audioStreamSessionId = await (window as any).connectToAudioStream(audioSessionId);

              if (audioStreamSessionId) {
                console.log(`✅ Audio streaming session established: ${audioStreamSessionId}`);
              } else {
                console.log('⚠️ Audio streaming connection failed - session ID is null');
              }
            } catch (error) {
              console.error('❌ Failed to connect to audio streaming:', error);
            }
          } else {
            console.log('🔇 ❌ Audio streaming is DISABLED in browser context');
            console.log('💡 audioStreamingConfig.enabled =', audioStreamingConfig.enabled);
          }

          // Check for the availability of the mediaDevices API
          if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getDisplayMedia
          ) {
            console.error(
              '❌ MediaDevices or getDisplayMedia not supported in this browser.'
            );
            return;
          }

          console.log('🎥 MediaDevices API is available');
          const contentType: ContentType = 'video/webm';
          const mimeType = `${contentType}; codecs="h264"`;

          console.log('🔧 Requesting display media with audio config:');
          console.log(`   Audio channels: ${audioStreamingConfig.channels}`);
          console.log(`   Audio sample rate: ${audioStreamingConfig.sampleRate}`);
          console.log('   Audio settings: autoGainControl=false, echoCancellation=false, noiseSuppression=false');

          const stream: MediaStream = await (
            navigator.mediaDevices as any
          ).getDisplayMedia({
            video: true,
            audio: {
              autoGainControl: false,
              channels: audioStreamingConfig.channels,
              channelCount: audioStreamingConfig.channels,
              echoCancellation: false,
              noiseSuppression: false,
              sampleRate: audioStreamingConfig.sampleRate,
            },
            preferCurrentTab: true,
          });

          console.log('🎵 Stream acquired - analyzing tracks:');
          console.log(`   Video tracks: ${stream.getVideoTracks().length}`);
          console.log(`   Audio tracks: ${stream.getAudioTracks().length}`);
          
          stream.getAudioTracks().forEach((track, index) => {
            console.log(`   Audio track ${index + 1}:`, {
              id: track.id,
              kind: track.kind,
              label: track.label,
              enabled: track.enabled,
              muted: track.muted,
              readyState: track.readyState,
            });
            
            const settings = track.getSettings();
            console.log(`   Audio track ${index + 1} settings:`, settings);
          });

          stream.getVideoTracks().forEach((track, index) => {
            console.log(`   Video track ${index + 1}:`, {
              id: track.id,
              kind: track.kind,
              label: track.label,
              enabled: track.enabled,
              muted: track.muted,
              readyState: track.readyState,
            });
          });

          let options: MediaRecorderOptions = { mimeType: contentType };
          if (MediaRecorder.isTypeSupported(mimeType)) {
            console.log(`Media Recorder will use ${mimeType} codecs...`);
            options = { mimeType };
          } else {
            console.warn(
              'Media Recorder did not find codecs, Using webm default'
            );
          }

          // Create main video recorder for ScreenApp
          const mediaRecorder = new MediaRecorder(stream, { ...options });

          mediaRecorder.ondataavailable = async (event: BlobEvent) => {
            if (!event.data.size) {
              console.warn('Received empty video chunk...');
              return;
            }
            try {
              const arrayBuffer = await event.data.arrayBuffer();
              await sendChunkToServer(arrayBuffer);
            } catch (error) {
              console.error('Error uploading video chunk:', error.message, error);
            }
          };

          // Create separate audio recorder for SecureScribe if enabled
          let audioRecorder: MediaRecorder | null = null;
          if (audioStreamingConfig.enabled) {
            console.log('🎙️ ==========AUDIO RECORDER SETUP==========');
            console.log('🎙️ Setting up separate audio recorder for SecureScribe...');
            console.log('🔧 Using audio streaming config:');
            console.log(`   Chunk duration: ${audioStreamingConfig.chunkDuration}ms`);
            console.log(`   WebSocket endpoint: ${audioStreamingConfig.wsEndpoint}`);

            try {
              // Create audio-only options for better compatibility with SecureScribe
              const audioOptions: MediaRecorderOptions = {
                mimeType: 'audio/webm'
              };

              // Check for better audio codec support
              console.log('🔍 Checking MediaRecorder codec support:');
              const codecTests = [
                'audio/webm; codecs=opus',
                'audio/wav',
                'audio/webm'
              ];
              
              codecTests.forEach(codec => {
                const supported = MediaRecorder.isTypeSupported(codec);
                console.log(`   ${codec}: ${supported ? '✅ Supported' : '❌ Not supported'}`);
              });

              if (MediaRecorder.isTypeSupported('audio/webm; codecs=opus')) {
                audioOptions.mimeType = 'audio/webm; codecs=opus';
                console.log('🎧 ✅ Using audio/webm with Opus codec for audio streaming');
              } else if (MediaRecorder.isTypeSupported('audio/wav')) {
                audioOptions.mimeType = 'audio/wav';
                console.log('🎧 ✅ Using audio/wav for audio streaming');
              } else {
                console.log('🎧 ⚠️ Using default audio/webm for audio streaming');
              }

              console.log(`🔧 Creating MediaRecorder with mimeType: ${audioOptions.mimeType}`);
              audioRecorder = new MediaRecorder(stream, audioOptions);
              console.log('✅ MediaRecorder created successfully');

              audioRecorder.ondataavailable = async (event: BlobEvent) => {
                if (!event.data.size) {
                  console.warn('⚠️ Received empty audio chunk from MediaRecorder');
                  return;
                }

                console.log('🎵 Audio chunk received from MediaRecorder:');
                console.log(`   Size: ${event.data.size} bytes`);
                console.log(`   Type: ${event.data.type}`);
                console.log(`   Timestamp: ${new Date().toISOString()}`);

                try {
                  const arrayBuffer = await event.data.arrayBuffer();
                  console.log(`🔄 Converted blob to ArrayBuffer - Size: ${arrayBuffer.byteLength} bytes`);
                  await sendAudioToSecureScribe(arrayBuffer);
                } catch (error) {
                  console.error('❌ Error processing audio chunk:', error.message, error);
                }
              };

              // Start audio recording with shorter intervals for better streaming
              const audioChunkDuration = audioStreamingConfig.chunkDuration;
              console.log(`⏱️ Starting audio recording with ${audioChunkDuration}ms chunks`);
              audioRecorder.start(audioChunkDuration);
              console.log('✅ Audio recording started successfully');
              console.log('🎙️ =======================================');
            } catch (error) {
              console.error('❌ Failed to start audio recording for SecureScribe:', error);
              console.log('🎙️ =======================================');
            }
          } else {
            console.log('🔇 Audio streaming disabled - no separate audio recorder needed');
          }

          // Start main video recording with 2-second intervals
          const chunkDuration = 2000;
          mediaRecorder.start(chunkDuration);

          const stopTheRecording = async () => {
            console.log('🛑 -------- TRIGGER stop the recording');

            // Stop video recording
            console.log('📹 Stopping video MediaRecorder...');
            mediaRecorder.stop();

            // Stop audio recording if it exists
            if (audioRecorder && audioRecorder.state === 'recording') {
              console.log('🎙️ Stopping audio MediaRecorder...');
              audioRecorder.stop();
              console.log('✅ Audio recording stopped for SecureScribe');
            } else if (audioRecorder) {
              console.log(`⚠️ Audio recorder exists but state is: ${audioRecorder.state}`);
            } else {
              console.log('ℹ️ No audio recorder to stop');
            }

            // Stop all tracks
            console.log('🔌 Stopping all media tracks...');
            stream.getTracks().forEach((track) => {
              console.log(`🔇 Stopping ${track.kind} track`);
              track.stop();
            });

            // Close audio streaming connection
            if (audioStreamingConfig.enabled && audioStreamSessionId) {
              console.log('🔚 Closing audio streaming connection...');
              try {
                await (window as any).closeAudioStream();
                console.log('✅ SecureScribe audio streaming connection closed successfully');
              } catch (error) {
                console.error('❌ Error closing audio stream:', error);
              }
            } else if (audioStreamingConfig.enabled) {
              console.log('⚠️ Audio streaming enabled but no session ID found - nothing to close');
            } else {
              console.log('ℹ️ Audio streaming disabled - no connection to close');
            }

            // Cleanup recording timer
            clearTimeout(timeoutId);

            // Cancel the perpetual checks
            if (inactivityDetectionTimeout) {
              clearTimeout(inactivityDetectionTimeout);
            }

            // Begin browser cleanup
            (window as any).screenAppMeetEnd(slightlySecretId);
          };

          let loneTest: NodeJS.Timeout;
          let monitor = true;

          // TODO Create standard detection lib
          const detectLoneParticipant = () => {
            let dom: Document = document;
            const iframe: HTMLIFrameElement | null =
              document.querySelector('iframe#webclient');
            if (iframe && iframe.contentDocument) {
              console.log('Using iframe for participants detection...');
              dom = iframe.contentDocument;
            }

            loneTest = setInterval(() => {
              try {
                // Detect and click blocking "OK" buttons
                const okButton = Array.from(
                  dom.querySelectorAll('button')
                ).filter((el) => el?.innerText?.trim()?.match(/^OK/i));
                if (okButton && okButton[0]) {
                  console.log(
                    'It appears that meeting has been ended. Click "OK" and verify if meeting is still in progress...',
                    { userId }
                  );
                  let shouldEndMeeting = false;
                  const meetingEndLabel = dom.querySelector(
                    '[aria-label="Meeting is end now"]'
                  );
                  if (meetingEndLabel) {
                    shouldEndMeeting = true;
                  } else {
                    const endText = 'This meeting has been ended by host';
                    const divs = dom.querySelectorAll('div');
                    for (const modal of divs) {
                      if (modal.innerText.includes(endText)) {
                        shouldEndMeeting = true;
                        break;
                      }
                    }
                  }
                  okButton[0].click();
                  if (shouldEndMeeting) {
                    console.log(
                      'Detected meeting has been ended by host. End Recording...',
                      { userId }
                    );
                    clearInterval(loneTest);
                    monitor = false;
                    stopTheRecording();
                  }
                }

                // Detect number of participants
                const participantsMatch = Array.from(
                  dom.querySelectorAll('button')
                ).filter((el) => el?.innerText?.trim()?.match(/^\d+/));
                const text =
                  participantsMatch && participantsMatch.length > 0
                    ? participantsMatch[0].innerText.trim()
                    : null;
                if (!text) {
                  console.error(
                    'Meeting presence detection is probably not working on user:',
                    userId,
                    teamId
                  );
                  return;
                }

                const regex = new RegExp(/\d+/);
                const participants = text.match(regex);
                if (!participants || participants.length === 0) {
                  console.error(
                    'Meeting participants detection is probably not working on user:',
                    { userId, teamId }
                  );
                  return;
                }
                if (Number(participants[0]) > 1) {
                  return;
                }

                console.log(
                  'Detected meeting bot is alone in meeting, ending recording on team:',
                  { userId, teamId }
                );
                clearInterval(loneTest);
                monitor = false;
                stopTheRecording();
              } catch (error) {
                console.error(
                  'Meeting presence detection failed on team:',
                  { userId, teamId, message: error.message, error }
                );
              }
            }, 2000); // Detect every 2 seconds
          };

          const detectIncrediblySilentMeeting = () => {
            const audioContext = new AudioContext();
            const mediaSource = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();

            /* Use a value suitable for the given use case of silence detection
               |
               |____ Relatively smaller FFT size for faster processing and less sampling
            */
            analyser.fftSize = 256;

            mediaSource.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            // Sliding silence period
            let silenceDuration = 0;

            // Audio gain/volume
            const silenceThreshold = 10;

            const monitorSilence = () => {
              analyser.getByteFrequencyData(dataArray);

              const audioActivity =
                dataArray.reduce((a, b) => a + b) / dataArray.length;

              if (audioActivity < silenceThreshold) {
                silenceDuration += 100; // Check every 100ms
                if (silenceDuration >= inactivityLimit) {
                  console.warn(
                    'Detected silence in Meeting and ending the recording on team:',
                    userId,
                    teamId
                  );
                  monitor = false;
                  clearInterval(loneTest);
                  stopTheRecording();
                }
              } else {
                silenceDuration = 0;
              }

              if (monitor) {
                // Recursively queue the next check
                setTimeout(monitorSilence, 100);
              }
            };

            // Go silence monitor
            monitorSilence();
          };

          /**
           * Perpetual checks for inactivity detection
           */
          inactivityDetectionTimeout = setTimeout(() => {
            detectLoneParticipant();
            detectIncrediblySilentMeeting();
          }, activateInactivityDetectionAfterMinutes * 60 * 1000);

          // Cancel this timeout when stopping the recording
          // Stop recording after `duration` minutes upper limit
          timeoutId = setTimeout(async () => {
            stopTheRecording();
          }, duration);
        }

        // Start the recording
        await startRecording();
      },
      {
        teamId: this.teamId,
        duration: this.duration,
        inactivityLimit: this.inactivityLimit,
        userId: this.userId,
        slightlySecretId: this.slightlySecretId,
        activateInactivityDetectionAfterMinutes:
          config.activateInactivityDetectionAfter,
        activateInactivityDetectionAfter: new Date(
          new Date().getTime() +
            config.activateInactivityDetectionAfter * 60 * 1000
        ).toISOString(),
        audioStreamingConfig: config.audioStreaming,
        audioSessionId: this.audioSessionId,
      }
    );
  }
}
