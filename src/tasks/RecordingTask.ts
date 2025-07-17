import { Page } from 'playwright';
import { ContentType } from '../types';
import { Task } from '../lib/Task';
import config from '../config';
import { Logger } from 'winston';
import WebSocket from 'ws';
import { LocalWhisperService } from '../services/localWhisperService';

// Type definition for browser window with exposed functions
interface WindowWithExposedFunctions extends Window {
  screenAppSendData?: (id: string, data: string) => Promise<void>;
  sendAudioChunk?: (data: string) => Promise<boolean>;
  connectToAudioStream?: (sessionId: string) => Promise<string>;
  closeAudioStream?: () => Promise<void>;
  transcribeAudioChunk?: (data: string) => Promise<string | null>;
  screenAppMeetEnd?: (id: string) => void;
}

// MediaDevices interface with proper display capture
interface MediaDevicesWithDisplayCapture extends MediaDevices {
  getDisplayMedia(constraints?: MediaStreamConstraints): Promise<MediaStream>;
}

// Extended audio constraints for recording
interface ExtendedAudioConstraints extends MediaTrackConstraints {
  channels?: number;
  channelCount?: number;
  sampleRate?: number;
}

// Web Speech API interfaces - cleaned up
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

interface SpeechRecognitionResult {
  0: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

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
  private async connectToAudioStream(
    sessionId?: string
  ): Promise<string | null> {
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
        console.log(
          `⚙️ Audio config: ${config.audioStreaming.sampleRate}Hz, ${config.audioStreaming.channels}ch, ${config.audioStreaming.format}`
        );
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
            wsUrl: wsUrl,
          });
          resolve(sessionId || 'new-session');
        });

        this.audioWs.on('message', (data: Buffer) => {
          console.log(
            '📩 Received message from SecureScribe WebSocket:',
            data.toString()
          );
          try {
            const response = JSON.parse(data.toString());
            console.log('📋 Parsed response:', response);
            if (response.session_id && !sessionId) {
              this.audioSessionId = response.session_id;
              console.log(
                `🔑 Audio session ID assigned: ${this.audioSessionId}`
              );
              this._logger.info('Audio session created', {
                sessionId: this.audioSessionId,
                userId: this.userId,
                teamId: this.teamId,
              });
            }
          } catch (error) {
            console.error('⚠️ Failed to parse WebSocket response:', error);
            this._logger.warn('Failed to parse audio streaming response', {
              error,
            });
          }
        });

        this.audioWs.on('error', (error: Error) => {
          console.error('🚨 Audio streaming WebSocket error:', error.message);
          this._logger.error('Audio streaming WebSocket error', {
            error: error.message,
            userId: this.userId,
            teamId: this.teamId,
          });
          reject(error);
        });

        this.audioWs.on('close', () => {
          this._logger.info('Audio streaming WebSocket closed', {
            userId: this.userId,
            teamId: this.teamId,
          });
        });
      });
    } catch (error) {
      console.error('🚨 Failed to connect to audio streaming service:', error);
      this._logger.error('Failed to connect to audio streaming service', {
        error: error instanceof Error ? error.message : error,
        userId: this.userId,
        teamId: this.teamId,
      });
      return null;
    }
  }

  private async sendAudioChunk(audioData: string): Promise<boolean> {
    if (!this.audioWs || this.audioWs.readyState !== WebSocket.OPEN) {
      console.log('⚠️ Cannot send audio chunk - WebSocket not ready');
      console.log(
        `WebSocket state: ${this.audioWs ? 'exists' : 'null'}, readyState: ${
          this.audioWs?.readyState
        }`
      );
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
        teamId: this.teamId,
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
        action: 'close_session',
      };

      if (this.audioWs.readyState === WebSocket.OPEN) {
        console.log('📤 Sending close message to SecureScribe');
        this.audioWs.send(JSON.stringify(closeMessage));
        console.log('✅ Close message sent');
      } else {
        console.log(
          `⚠️ WebSocket not open (state: ${this.audioWs.readyState}), skipping close message`
        );
      }

      // Close the WebSocket connection
      console.log('🔌 Closing WebSocket connection');
      this.audioWs.close();
      this.audioWs = undefined;
      console.log('✅ Audio streaming session closed successfully');

      this._logger.info('Audio streaming session closed', {
        sessionId: this.audioSessionId,
        userId: this.userId,
        teamId: this.teamId,
      });
    } catch (error) {
      console.error('❌ Error closing audio stream:', error);
      this._logger.error('Error closing audio stream', {
        error: error instanceof Error ? error.message : error,
        userId: this.userId,
        teamId: this.teamId,
      });
    }
  }

  // Hugging Face Transformers.js transcription method - using local model
  private async transcribeAudioChunk(
    base64AudioData: string
  ): Promise<string | null> {
    if (!config.transcription.enabled) {
      console.log('🔇 Local transcription is disabled');
      return null;
    }

    console.log('🎤 [NODE] Processing audio chunk for local transcription...');

    try {
      // Initialize the LocalWhisperService if needed
      const whisperService = LocalWhisperService.getInstance(this._logger);

      if (!whisperService.isReady()) {
        console.log('⏳ Whisper model not ready yet, initializing...');
        await whisperService.initialize();
      }

      // Convert base64 to audio buffer
      console.log(
        `📊 Received audio chunk: ${base64AudioData.length} base64 characters`
      );
      const audioBuffer = Buffer.from(base64AudioData, 'base64');
      console.log(`🎧 Audio buffer size: ${audioBuffer.length} bytes`);

      // Convert buffer to Float32Array format expected by Whisper
      // Note: This is a simplified conversion - in real implementation you might need
      // to properly decode the audio format (e.g., WebM, MP4) to PCM
      const audioFloat32 = new Float32Array(audioBuffer.length / 4);
      for (let i = 0; i < audioFloat32.length; i++) {
        audioFloat32[i] = audioBuffer.readFloatLE(i * 4);
      }

      console.log(
        `📈 Converted to Float32Array: ${audioFloat32.length} samples`
      );

      // For now, we'll return a placeholder since the actual transcription
      // needs to happen in the browser context where Transformers.js can run
      console.log(
        '🔄 [NODE] Audio chunk prepared for browser-side Transformers.js'
      );

      // Return null to indicate that transcription should happen in browser
      // The actual transcription logic will be implemented in the browser evaluate function
      return null;
    } catch (error) {
      console.error('❌ Error in local transcription:', error);
      this._logger.error('Failed to transcribe audio chunk locally', {
        error: error instanceof Error ? error.message : error,
        userId: this.userId,
        teamId: this.teamId,
      });
      return null;
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

    console.log(
      '🎵 Audio streaming config:',
      JSON.stringify(config.audioStreaming, null, 2)
    );
    console.log('🔧 Individual config values:');
    console.log(
      `   enabled: ${config.audioStreaming.enabled} (type: ${typeof config
        .audioStreaming.enabled})`
    );
    console.log(
      `   wsEndpoint: ${config.audioStreaming.wsEndpoint} (type: ${typeof config
        .audioStreaming.wsEndpoint})`
    );
    console.log(
      `   sampleRate: ${config.audioStreaming.sampleRate} (type: ${typeof config
        .audioStreaming.sampleRate})`
    );
    console.log(
      `   channels: ${config.audioStreaming.channels} (type: ${typeof config
        .audioStreaming.channels})`
    );
    console.log(
      `   format: ${config.audioStreaming.format} (type: ${typeof config
        .audioStreaming.format})`
    );
    console.log(
      `   chunkDuration: ${
        config.audioStreaming.chunkDuration
      } (type: ${typeof config.audioStreaming.chunkDuration})`
    );
    console.log('🌍 Environment variables:');
    console.log(
      `   ENABLE_AUDIO_STREAMING: ${process.env.ENABLE_AUDIO_STREAMING}`
    );
    console.log(
      `   AUDIO_STREAMING_WS_ENDPOINT: ${process.env.AUDIO_STREAMING_WS_ENDPOINT}`
    );
    console.log(`   AUDIO_SAMPLE_RATE: ${process.env.AUDIO_SAMPLE_RATE}`);
    console.log(`   AUDIO_CHANNELS: ${process.env.AUDIO_CHANNELS}`);
    console.log(`   AUDIO_FORMAT: ${process.env.AUDIO_FORMAT}`);
    console.log(`   AUDIO_CHUNK_DURATION: ${process.env.AUDIO_CHUNK_DURATION}`);
    console.log('🔍 ==============================================');

    if (config.audioStreaming.enabled) {
      console.log(
        '🔧 ✅ Audio streaming is ENABLED - exposing functions to browser context...'
      );
      await this.page.exposeFunction(
        'connectToAudioStream',
        this.connectToAudioStream.bind(this)
      );
      await this.page.exposeFunction(
        'sendAudioChunk',
        this.sendAudioChunk.bind(this)
      );
      await this.page.exposeFunction(
        'closeAudioStream',
        this.closeAudioStream.bind(this)
      );
      await this.page.exposeFunction(
        'transcribeAudioChunk',
        this.transcribeAudioChunk.bind(this)
      );
      console.log('✅ Audio streaming functions exposed successfully');
    } else {
      console.log('🔇 ❌ Audio streaming is DISABLED - no functions to expose');
      console.log(
        '💡 To enable audio streaming, set ENABLE_AUDIO_STREAMING=true in your .env file'
      );
    } // Configure Hugging Face Transformers.js for local transcription
    if (process.env.ENABLE_LOCAL_TRANSCRIPTION === 'true') {
      console.log(
        '🎤 ✅ Hugging Face Transformers.js transcription will be enabled in browser context'
      );
    } else {
      console.log('🔇 ❌ Local transcription is disabled');
    }

    // Prepare configuration for browser context
    const activateInactivityDetectionAfterMinutes =
      config.activateInactivityDetectionAfter;
    const activateInactivityDetectionAfter = new Date(
      new Date().getTime() + config.activateInactivityDetectionAfter * 60 * 1000
    ).toISOString();

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
        transcriptionConfig,
      }: {
        teamId: string;
        duration: number;
        inactivityLimit: number;
        userId: string;
        slightlySecretId: string;
        activateInactivityDetectionAfter: string;
        activateInactivityDetectionAfterMinutes: number;
        audioStreamingConfig: any; // eslint-disable-line @typescript-eslint/no-explicit-any
        audioSessionId?: string;
        transcriptionConfig: {
          enabled: boolean;
          model: string;
          language: string;
        };
      }) => {
        let timeoutId: NodeJS.Timeout;
        let inactivityDetectionTimeout: NodeJS.Timeout;
        const audioStreamSessionId: string | null = audioSessionId || null;

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
          const windowWithFunctions = window as WindowWithExposedFunctions;
          if (windowWithFunctions.screenAppSendData) {
            await windowWithFunctions.screenAppSendData(
              slightlySecretId,
              base64
            );
          }
        };
        /**
         * @summary Transcription function using Hugging Face Transformers.js
         * @param chunk Audio buffer to transcribe
         * @returns void
         */
        const transcribeAudioChunk = async (chunk: ArrayBuffer) => {
          if (!transcriptionConfig.enabled) {
            console.log('🔇 Transcription disabled - skipping chunk');
            return;
          }

          console.log(
            `🎤 Processing audio chunk for transcription - Size: ${chunk.byteLength} bytes`
          );

          try {
            // Check if we have a whisper pipeline available
            const windowWithPipeline = window as typeof window & {
              whisperPipeline?: unknown;
              whisperLanguage?: string;
              transformersLoaded?: boolean;
              transformersPipeline?: any;
              transformersEnv?: any;
            };

            if (!windowWithPipeline.whisperPipeline) {
              console.log(
                '🔄 Initializing local Vietnamese Whisper pipeline...'
              );

              try {
                // Load Transformers.js from CDN using ES module approach
                console.log('📦 Loading Transformers.js as ES module...');

                // Use dynamic import with ES modules
                const script = document.createElement('script');
                script.type = 'module';
                script.innerHTML = `
                  import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
                  window.transformersPipeline = pipeline;
                  window.transformersEnv = env;
                  window.transformersLoaded = true;
                  console.log('✅ Transformers.js loaded successfully as module');
                `;

                document.head.appendChild(script);

                // Wait for module to load with timeout
                let attempts = 0;
                const maxAttempts = 60; // 30 seconds

                while (
                  !windowWithPipeline.transformersLoaded &&
                  attempts < maxAttempts
                ) {
                  await new Promise((resolve) => setTimeout(resolve, 500));
                  attempts++;
                }

                if (!windowWithPipeline.transformersLoaded) {
                  throw new Error('Transformers.js module loading timeout');
                }

                console.log('✅ Transformers.js module loaded successfully');

                const { transformersPipeline, transformersEnv } =
                  windowWithPipeline;

                // Configure environment for local model
                console.log(
                  '🔧 Configuring environment for local Vietnamese model...'
                );
                transformersEnv.allowRemoteModels = true; // Allow Hugging Face models
                transformersEnv.allowLocalModels = true;

                console.log(
                  '� Loading Vietnamese Whisper model from local directory...'
                );
                console.log(
                  '📂 Model URL: http://localhost:3000/finetuned_vivos_noisy/'
                );

                // Create pipeline with fallback strategy for Vietnamese transcription
                const modelAttempts = [
                  {
                    name: 'Xenova Whisper Small (Vietnamese optimized)',
                    model: 'Xenova/whisper-small',
                    language: 'vi'
                  },
                  {
                    name: 'OpenAI Whisper Small',
                    model: 'openai/whisper-small',
                    language: 'vi'
                  },
                  {
                    name: 'Xenova Whisper Base',
                    model: 'Xenova/whisper-base',
                    language: 'vi'
                  }
                ];

                let pipelineLoaded = false;
                for (const attempt of modelAttempts) {
                  try {
                    console.log(`🔄 Trying ${attempt.name}...`);

                    windowWithPipeline.whisperPipeline = await transformersPipeline(
                      'automatic-speech-recognition',
                      attempt.model,
                      {
                        dtype: 'fp32',
                        device: 'cpu',
                      }
                    );

                    // Store language preference for transcription
                    windowWithPipeline.whisperLanguage = attempt.language;

                    console.log(`✅ Successfully loaded ${attempt.name}!`);
                    console.log(`🇻🇳 Vietnamese transcription ready with ${attempt.model}`);
                    pipelineLoaded = true;
                    break;

                  } catch (modelError) {
                    console.log(`⚠️ ${attempt.name} failed: ${modelError.message}`);
                    continue;
                  }
                }

                if (!pipelineLoaded) {
                  throw new Error('All Whisper model loading attempts failed');
                }

                console.log('✅ Vietnamese Whisper pipeline ready!');
                console.log('🇻🇳 Model loaded and configured for Vietnamese transcription');
              } catch (initError) {
                console.error(
                  '❌ Failed to initialize local Whisper model:',
                  initError
                );
                console.log('🔄 Using audio chunk logging fallback...');
                return;
              }
            }

            // Decode audio from container format (WebM/etc) to raw audio data
            console.log('🎵 Decoding audio container format to raw audio...');

            try {
              // Create AudioContext for proper audio decoding
              const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
                sampleRate: 16000 // Whisper expects 16kHz
              });

              // Decode the audio data from container format
              const audioBuffer = await audioContext.decodeAudioData(chunk.slice(0));

              // Get the first channel (mono) as Float32Array
              let audioData = audioBuffer.getChannelData(0);

              console.log('✅ Audio decoded successfully:');
              console.log(`   Duration: ${audioBuffer.duration.toFixed(2)}s`);
              console.log(`   Sample Rate: ${audioBuffer.sampleRate}Hz`);
              console.log(`   Samples: ${audioData.length}`);
              console.log(`   Channels: ${audioBuffer.numberOfChannels}`);

              // Resample to 16kHz if needed (Whisper requirement)
              if (audioBuffer.sampleRate !== 16000) {
                console.log(`🔄 Resampling from ${audioBuffer.sampleRate}Hz to 16000Hz...`);

                const resampleRatio = audioBuffer.sampleRate / 16000;
                const resampledLength = Math.floor(audioData.length / resampleRatio);
                const resampledAudio = new Float32Array(resampledLength);

                for (let i = 0; i < resampledLength; i++) {
                  const sourceIndex = Math.floor(i * resampleRatio);
                  resampledAudio[i] = audioData[sourceIndex] || 0;
                }

                audioData = resampledAudio;
                console.log(`✅ Resampled to ${audioData.length} samples`);
              }

              // Clean up AudioContext
              await audioContext.close();

              // Perform transcription using the Vietnamese Whisper pipeline
              console.log('🤗 Running Vietnamese Whisper transcription...');

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const result = await (windowWithPipeline.whisperPipeline as any)(
                audioData,
                {
                  language: windowWithPipeline.whisperLanguage || 'vi', // Use stored language or default to Vietnamese
                  return_timestamps: false,
                  chunk_length_s: 30, // Longer chunks for better Vietnamese recognition
                  stride_length_s: 5,
                }
              );

              if (result && result.text && result.text.trim()) {
                console.log(
                  '📝 🎯 VIETNAMESE WHISPER TRANSCRIPTION:',
                  result.text
                );
                console.log('✅ Vietnamese transcription completed successfully');
              } else {
                console.log(
                  '🔇 No Vietnamese speech detected in this audio chunk'
                );
              }

            } catch (decodeError) {
              console.error('❌ Audio decoding failed:', decodeError);
              console.log('🔄 Attempting fallback direct conversion...');

              // Fallback: Try direct conversion for debugging
              const audioData = new Float32Array(chunk.byteLength / 4);
              const dataView = new DataView(chunk);

              for (let i = 0; i < audioData.length; i++) {
                try {
                  audioData[i] = dataView.getFloat32(i * 4, true) || 0;
                } catch {
                  audioData[i] = 0;
                }
              }

              console.log(`📊 Fallback audio data: ${audioData.length} samples`);

              // Try transcription with fallback data
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await (windowWithPipeline.whisperPipeline as any)(
                  audioData,
                  {
                    language: windowWithPipeline.whisperLanguage || 'vi',
                    return_timestamps: false,
                    chunk_length_s: 30,
                    stride_length_s: 5,
                  }
                );

                if (result && result.text && result.text.trim()) {
                  console.log('📝 🎯 FALLBACK TRANSCRIPTION:', result.text);
                } else {
                  console.log('🔇 No speech detected (fallback method)');
                }
              } catch (fallbackError) {
                console.error('❌ Fallback transcription also failed:', fallbackError);
              }
            }
          } catch (error) {
            console.error('❌ Error in transcription placeholder:', error);
            // Don't break the recording if transcription fails
          }
        };

        async function startRecording() {
          console.log('🎬 ==========BROWSER CONTEXT CONFIG==========');
          console.log(
            '📊 Audio streaming config received in browser:',
            JSON.stringify(audioStreamingConfig, null, 2)
          );
          console.log('🔧 Audio streaming config details:');
          console.log(
            `   enabled: ${
              audioStreamingConfig.enabled
            } (type: ${typeof audioStreamingConfig.enabled})`
          );
          console.log(
            `   wsEndpoint: ${
              audioStreamingConfig.wsEndpoint
            } (type: ${typeof audioStreamingConfig.wsEndpoint})`
          );
          console.log(
            `   sampleRate: ${
              audioStreamingConfig.sampleRate
            } (type: ${typeof audioStreamingConfig.sampleRate})`
          );
          console.log(
            `   channels: ${
              audioStreamingConfig.channels
            } (type: ${typeof audioStreamingConfig.channels})`
          );
          console.log(
            `   format: ${
              audioStreamingConfig.format
            } (type: ${typeof audioStreamingConfig.format})`
          );
          console.log(
            `   chunkDuration: ${
              audioStreamingConfig.chunkDuration
            } (type: ${typeof audioStreamingConfig.chunkDuration})`
          );
          console.log('🎵 Other parameters:');
          console.log(`   audioSessionId: ${audioSessionId}`);
          console.log(`   userId: ${userId}`);
          console.log(`   teamId: ${teamId}`);
          console.log('🎬 ==========================================');

          console.log(
            'Will activate the inactivity detection after',
            activateInactivityDetectionAfter
          );

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
          console.log(
            `   Audio sample rate: ${audioStreamingConfig.sampleRate}`
          );
          console.log(
            '   Audio settings: autoGainControl=false, echoCancellation=false, noiseSuppression=false'
          );

          console.log('🚀 Calling getDisplayMedia...');
          const stream: MediaStream = await (
            navigator.mediaDevices as MediaDevicesWithDisplayCapture
          ).getDisplayMedia({
            video: true,
            audio: {
              autoGainControl: false,
              channelCount: audioStreamingConfig.channels,
              echoCancellation: false,
              noiseSuppression: false,
              sampleRate: audioStreamingConfig.sampleRate,
            } as ExtendedAudioConstraints,
            preferCurrentTab: true,
          });
          console.log('✅ getDisplayMedia completed successfully');

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
              console.error(
                'Error uploading video chunk:',
                error.message,
                error
              );
            }
          };

          // Create separate audio recorder for Hugging Face transcription if enabled
          let audioRecorder: MediaRecorder | null = null;
          if (transcriptionConfig.enabled) {
            console.log(
              '🎙️ ==========HUGGING FACE AUDIO RECORDER SETUP=========='
            );
            console.log(
              '🎙️ Setting up audio recorder for Hugging Face transcription...'
            );

            try {
              // Create audio-only options for transcription
              const audioOptions: MediaRecorderOptions = {
                mimeType: 'audio/webm',
              };

              // Check for better audio codec support
              console.log(
                '🔍 Checking MediaRecorder codec support for transcription:'
              );
              const codecTests = [
                'audio/webm; codecs=opus',
                'audio/wav',
                'audio/webm',
              ];

              codecTests.forEach((codec) => {
                const supported = MediaRecorder.isTypeSupported(codec);
                console.log(
                  `   ${codec}: ${
                    supported ? '✅ Supported' : '❌ Not supported'
                  }`
                );
              });

              if (MediaRecorder.isTypeSupported('audio/webm; codecs=opus')) {
                audioOptions.mimeType = 'audio/webm; codecs=opus';
                console.log(
                  '🎧 ✅ Using audio/webm with Opus codec for transcription'
                );
              } else if (MediaRecorder.isTypeSupported('audio/wav')) {
                audioOptions.mimeType = 'audio/wav';
                console.log('🎧 ✅ Using audio/wav for transcription');
              } else {
                console.log('🎧 ⚠️ Using default audio/webm for transcription');
              }

              console.log(
                `🔧 Creating MediaRecorder for transcription with mimeType: ${audioOptions.mimeType}`
              );
              audioRecorder = new MediaRecorder(stream, audioOptions);
              console.log(
                '✅ MediaRecorder for transcription created successfully'
              );

              // Add event listeners for debugging
              audioRecorder.addEventListener('start', () => {
                console.log(
                  '🎵 🟢 Transcription AudioRecorder STARTED event fired'
                );
              });

              audioRecorder.addEventListener('stop', () => {
                console.log(
                  '🎵 🔴 Transcription AudioRecorder STOPPED event fired'
                );
              });

              audioRecorder.addEventListener('error', (event) => {
                console.error(
                  '🎵 ❌ Transcription AudioRecorder ERROR event:',
                  event
                );
              });

              audioRecorder.ondataavailable = async (event: BlobEvent) => {
                console.log(
                  '🎵 ======== TRANSCRIPTION AUDIO CHUNK EVENT TRIGGERED ========'
                );
                console.log(
                  `📊 Event details - Size: ${event.data.size} bytes, Type: ${event.data.type}`
                );
                console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
                console.log(`🔧 AudioRecorder state: ${audioRecorder?.state}`);

                if (!event.data.size) {
                  console.warn(
                    '⚠️ Received empty audio chunk for transcription - SIZE IS ZERO!'
                  );
                  return;
                }

                console.log('🎵 Audio chunk received for transcription:');
                console.log(`   Size: ${event.data.size} bytes`);
                console.log(`   Type: ${event.data.type}`);

                try {
                  console.log(
                    '🔄 Converting blob to ArrayBuffer for transcription...'
                  );
                  const arrayBuffer = await event.data.arrayBuffer();
                  console.log(
                    `✅ Conversion successful - ArrayBuffer size: ${arrayBuffer.byteLength} bytes`
                  );

                  // Convert to base64 for transcription
                  function arrayBufferToBase64(buffer: ArrayBuffer) {
                    let binary = '';
                    const bytes = new Uint8Array(buffer);
                    for (let i = 0; i < bytes.byteLength; i++) {
                      binary += String.fromCharCode(bytes[i]);
                    }
                    return btoa(binary);
                  }

                  const base64 = arrayBufferToBase64(arrayBuffer);
                  console.log(
                    `📊 Base64 audio size for transcription: ${base64.length} characters`
                  );

                  // Transcribe audio chunk using Hugging Face
                  try {
                    const windowWithFunctions =
                      window as WindowWithExposedFunctions;
                    if (windowWithFunctions.transcribeAudioChunk) {
                      console.log(
                        '🎤 Transcribing audio chunk with Hugging Face...'
                      );
                      const transcription =
                        await windowWithFunctions.transcribeAudioChunk(base64);
                      if (transcription) {
                        console.log(
                          '📝 🤗 HUGGING FACE TRANSCRIPTION:',
                          transcription
                        );
                      } else {
                        console.log(
                          '🔇 No Hugging Face transcription result (silent audio chunk)'
                        );
                      }
                    } else {
                      console.log(
                        '⚠️ transcribeAudioChunk function not available'
                      );
                    }
                  } catch (transcribeError) {
                    console.warn(
                      '⚠️ Hugging Face transcription error:',
                      transcribeError
                    );
                  }
                } catch (error) {
                  console.error(
                    '❌ Error processing audio chunk for transcription:',
                    error.message,
                    error
                  );
                }
                console.log(
                  '🎵 ======== TRANSCRIPTION AUDIO CHUNK EVENT COMPLETED ========'
                );
              };

              // Start audio recording for transcription with 3-second chunks
              const audioChunkDuration = 3000; // 3 seconds for better transcription quality
              console.log(
                `⏱️ Starting transcription audio recording with ${audioChunkDuration}ms chunks`
              );
              console.log('🔧 Audio recorder details before start:');
              console.log(`   State: ${audioRecorder.state}`);
              console.log(`   MimeType: ${audioRecorder.mimeType}`);

              // Check audio track status
              stream.getAudioTracks().forEach((track, index) => {
                console.log(
                  `🎵 Audio track ${index + 1} status for transcription:`,
                  {
                    id: track.id,
                    enabled: track.enabled,
                    muted: track.muted,
                    readyState: track.readyState,
                    label: track.label,
                  }
                );
              });

              console.log(
                '🚀 Calling audioRecorder.start() for transcription...'
              );
              audioRecorder.start(audioChunkDuration);
              console.log(
                '✅ audioRecorder.start() called successfully for transcription'
              );

              // Wait a bit and check state
              setTimeout(() => {
                console.log(
                  `🔍 Transcription audio recorder state after start: ${audioRecorder?.state}`
                );
              }, 1000);

              console.log('🎙️ =======================================');
            } catch (error) {
              console.error(
                '❌ Failed to start audio recording for transcription:',
                error
              );
              console.log('🎙️ =======================================');
            }
          } else if (audioStreamingConfig.enabled) {
            console.log('🎙️ ==========AUDIO RECORDER SETUP==========');
            console.log(
              '🎙️ Setting up separate audio recorder for SecureScribe...'
            );
            console.log('🔧 Using audio streaming config:');
            console.log(
              `   Chunk duration: ${audioStreamingConfig.chunkDuration}ms`
            );
            console.log(
              `   WebSocket endpoint: ${audioStreamingConfig.wsEndpoint}`
            );

            try {
              // Create audio-only options for better compatibility with SecureScribe
              const audioOptions: MediaRecorderOptions = {
                mimeType: 'audio/webm',
              };

              // Check for better audio codec support
              console.log('🔍 Checking MediaRecorder codec support:');
              const codecTests = [
                'audio/webm; codecs=opus',
                'audio/wav',
                'audio/webm',
              ];

              codecTests.forEach((codec) => {
                const supported = MediaRecorder.isTypeSupported(codec);
                console.log(
                  `   ${codec}: ${
                    supported ? '✅ Supported' : '❌ Not supported'
                  }`
                );
              });

              if (MediaRecorder.isTypeSupported('audio/webm; codecs=opus')) {
                audioOptions.mimeType = 'audio/webm; codecs=opus';
                console.log(
                  '🎧 ✅ Using audio/webm with Opus codec for audio streaming'
                );
              } else if (MediaRecorder.isTypeSupported('audio/wav')) {
                audioOptions.mimeType = 'audio/wav';
                console.log('🎧 ✅ Using audio/wav for audio streaming');
              } else {
                console.log(
                  '🎧 ⚠️ Using default audio/webm for audio streaming'
                );
              }

              console.log(
                `🔧 Creating MediaRecorder with mimeType: ${audioOptions.mimeType}`
              );
              audioRecorder = new MediaRecorder(stream, audioOptions);
              console.log('✅ MediaRecorder created successfully');

              // Add event listeners for debugging
              audioRecorder.addEventListener('start', () => {
                console.log('🎵 🟢 AudioRecorder STARTED event fired');
              });

              audioRecorder.addEventListener('stop', () => {
                console.log('🎵 🔴 AudioRecorder STOPPED event fired');
              });

              audioRecorder.addEventListener('pause', () => {
                console.log('🎵 ⏸️ AudioRecorder PAUSED event fired');
              });

              audioRecorder.addEventListener('resume', () => {
                console.log('🎵 ▶️ AudioRecorder RESUMED event fired');
              });

              audioRecorder.addEventListener('error', (event) => {
                console.error('🎵 ❌ AudioRecorder ERROR event:', event);
              });

              audioRecorder.ondataavailable = async (event: BlobEvent) => {
                console.log('🎵 ======== AUDIO CHUNK EVENT TRIGGERED ========');
                console.log(
                  `📊 Event details - Size: ${event.data.size} bytes, Type: ${event.data.type}`
                );
                console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
                console.log(`🔧 AudioRecorder state: ${audioRecorder?.state}`);
                console.log(`📡 AudioStreamSessionId: ${audioStreamSessionId}`);

                if (!event.data.size) {
                  console.warn(
                    '⚠️ Received empty audio chunk from MediaRecorder - SIZE IS ZERO!'
                  );
                  console.log('🔍 This might indicate:');
                  console.log(
                    '   - No audio is being captured from the stream'
                  );
                  console.log('   - MediaRecorder is not receiving audio data');
                  console.log('   - Audio tracks might be muted or inactive');
                  return;
                }

                console.log('🎵 Audio chunk received from MediaRecorder:');
                console.log(`   Size: ${event.data.size} bytes`);
                console.log(`   Type: ${event.data.type}`);
                console.log(`   Timestamp: ${new Date().toISOString()}`);

                try {
                  console.log('🔄 Converting blob to ArrayBuffer...');
                  const arrayBuffer = await event.data.arrayBuffer();
                  console.log(
                    `✅ Conversion successful - ArrayBuffer size: ${arrayBuffer.byteLength} bytes`
                  );

                  console.log('📤 Calling transcribeAudioChunk...');
                  await transcribeAudioChunk(arrayBuffer);
                  console.log('✅ transcribeAudioChunk completed');
                } catch (error) {
                  console.error(
                    '❌ Error processing audio chunk:',
                    error.message,
                    error
                  );
                }
                console.log('🎵 ======== AUDIO CHUNK EVENT COMPLETED ========');
              };

              // Start audio recording with shorter intervals for better streaming
              const audioChunkDuration = audioStreamingConfig.chunkDuration;
              console.log(
                `⏱️ Starting audio recording with ${audioChunkDuration}ms chunks`
              );
              console.log('🔧 Audio recorder details before start:');
              console.log(`   State: ${audioRecorder.state}`);
              console.log(`   MimeType: ${audioRecorder.mimeType}`);
              console.log(
                `   Stream tracks: Video=${
                  stream.getVideoTracks().length
                }, Audio=${stream.getAudioTracks().length}`
              );

              // Check audio track status
              stream.getAudioTracks().forEach((track, index) => {
                console.log(`🎵 Audio track ${index + 1} status:`, {
                  id: track.id,
                  enabled: track.enabled,
                  muted: track.muted,
                  readyState: track.readyState,
                  label: track.label,
                });
              });

              console.log('🚀 Calling audioRecorder.start()...');
              audioRecorder.start(audioChunkDuration);
              console.log('✅ audioRecorder.start() called successfully');

              // Wait a bit and check state
              setTimeout(() => {
                console.log(
                  `🔍 Audio recorder state after start: ${audioRecorder?.state}`
                );
                console.log('🎵 Checking if audio tracks are still active...');
                stream.getAudioTracks().forEach((track, index) => {
                  console.log(
                    `   Track ${index + 1}: enabled=${track.enabled}, muted=${
                      track.muted
                    }, readyState=${track.readyState}`
                  );
                });
              }, 1000);

              console.log('🎙️ =======================================');
            } catch (error) {
              console.error(
                '❌ Failed to start audio recording for SecureScribe:',
                error
              );
              console.log('🎙️ =======================================');
            }
          } else {
            console.log(
              '🔇 Audio streaming disabled - no separate audio recorder needed'
            );
          }

          // Setup Hugging Face Transformers.js transcription if enabled
          let transcriber: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
          let speechRecognition: SpeechRecognition | undefined;

          if (transcriptionConfig.enabled) {
            console.log(
              '🤗 ==========HUGGING FACE TRANSFORMERS.JS SETUP=========='
            );
            console.log(
              '🤗 Setting up Transformers.js for local transcription...'
            );

            try {
              // Import Transformers.js from node_modules (installed locally)
              const transformers = await import('@huggingface/transformers');
              const { pipeline, env } = transformers;

              // Configure environment for local models
              env.allowLocalModels = false; // Always download from Hugging Face Hub

              console.log(
                '� Loading Whisper model for Vietnamese transcription...'
              );
              console.log(`🎯 Model: ${transcriptionConfig.model}`);

              // Create automatic speech recognition pipeline
              transcriber = await pipeline(
                'automatic-speech-recognition',
                transcriptionConfig.model
              );

              console.log(
                '✅ Hugging Face Transformers.js Whisper model loaded successfully'
              );
              console.log('🤗 =======================================');

              // Expose transcription function to browser context
              (window as WindowWithExposedFunctions).transcribeAudioChunk =
                async (base64Data: string): Promise<string | null> => {
                  try {
                    console.log(
                      '🎤 [BROWSER] Transcribing audio chunk with Hugging Face Transformers.js...'
                    );

                    // Convert base64 to Uint8Array for Transformers.js
                    const binaryString = atob(base64Data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                      bytes[i] = binaryString.charCodeAt(i);
                    }

                    // Transcribe using the pipeline
                    const result = await transcriber(bytes);
                    const transcription = result?.text || null;

                    if (transcription) {
                      console.log(
                        '📝 [BROWSER] Transformers.js Transcription:',
                        transcription
                      );
                    } else {
                      console.log(
                        '🔇 [BROWSER] No transcription result (silent audio chunk)'
                      );
                    }

                    return transcription;
                  } catch (error) {
                    console.error(
                      '❌ [BROWSER] Transformers.js transcription error:',
                      error
                    );
                    return null;
                  }
                };

              console.log(
                '✅ Hugging Face Transformers.js Whisper model loaded successfully'
              );
              console.log('🤗 =======================================');
            } catch (error) {
              console.error(
                '❌ Failed to setup Hugging Face Transformers.js:',
                error
              );
              console.log('🤗 =======================================');
            }
          } else {
            console.log(
              '🔇 Hugging Face Transformers.js transcription disabled'
            );
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
              console.log('🎙️ Stopping transcription audio MediaRecorder...');
              audioRecorder.stop();
              console.log('✅ Transcription audio recording stopped');
            } else if (audioRecorder) {
              console.log(
                `⚠️ Transcription audio recorder exists but state is: ${audioRecorder.state}`
              );
            } else {
              console.log('ℹ️ No transcription audio recorder to stop');
            }

            // Stop all tracks
            console.log('🔌 Stopping all media tracks...');
            stream.getTracks().forEach((track) => {
              console.log(`🔇 Stopping ${track.kind} track`);
              track.stop();
            });

            // Stop Web Speech API if running
            if (speechRecognition) {
              console.log('🗣️ Stopping Web Speech API recognition...');
              try {
                speechRecognition.stop();
                console.log('✅ Web Speech API stopped successfully');
              } catch (error) {
                console.error('❌ Error stopping Web Speech API:', error);
              }
            }

            // Close transcription resources if needed
            if (transcriptionConfig.enabled) {
              console.log('🤗 Cleaning up transcription resources...');
              console.log('✅ Transcription cleanup completed');
            }

            // Cleanup recording timer
            clearTimeout(timeoutId);

            // Cancel the perpetual checks
            if (inactivityDetectionTimeout) {
              clearTimeout(inactivityDetectionTimeout);
            }

            // Begin browser cleanup
            (window as WindowWithExposedFunctions).screenAppMeetEnd?.(
              slightlySecretId
            );
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
                console.error('Meeting presence detection failed on team:', {
                  userId,
                  teamId,
                  message: error.message,
                  error,
                });
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
          activateInactivityDetectionAfterMinutes,
        activateInactivityDetectionAfter: activateInactivityDetectionAfter,
        audioStreamingConfig: config.audioStreaming,
        audioSessionId: this.audioSessionId,
        transcriptionConfig: config.transcription,
      }
    );
  }
}
