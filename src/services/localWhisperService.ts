import { Logger } from 'winston';
import config from '../config';

/**
 * Service for managing local Hugging Face Transformers.js Whisper model
 * This service handles model downloading, caching, and transcription
 */
export class LocalWhisperService {
  private static instance: LocalWhisperService;
  private logger: Logger;
  private modelPath: string;
  private isModelReady = false;

  private constructor(logger: Logger) {
    this.logger = logger;
    this.modelPath = `./models/${config.transcription.model}`;
  }

  public static getInstance(logger: Logger): LocalWhisperService {
    if (!LocalWhisperService.instance) {
      LocalWhisperService.instance = new LocalWhisperService(logger);
    }
    return LocalWhisperService.instance;
  }

  /**
   * Download and cache the Hugging Face model locally
   */
  public async downloadModel(): Promise<void> {
    if (this.isModelReady) {
      this.logger.info('🎤 Whisper model already ready');
      return;
    }

    try {
      this.logger.info(
        `🔄 Downloading Whisper model: ${config.transcription.model}`
      );

      // Use Hugging Face Hub API to download model files
      const modelFiles = [
        'config.json',
        'generation_config.json',
        'model.onnx',
        'tokenizer.json',
        'tokenizer_config.json',
        'normalizer.json',
        'preprocessor_config.json',
      ];

      const fs = await import('fs-extra');
      await fs.ensureDir(this.modelPath);

      for (const file of modelFiles) {
        const url = `${config.transcription.model}/resolve/main/${file}`;
        const localPath = `${this.modelPath}/${file}`;

        if (await fs.pathExists(localPath)) {
          this.logger.info(`📁 ${file} already exists, skipping download`);
          continue;
        }

        this.logger.info(`📥 Downloading ${file}...`);

        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(
              `Failed to download ${file}: ${response.statusText}`
            );
          }

          const buffer = await response.arrayBuffer();
          await fs.writeFile(localPath, new Uint8Array(buffer));
          this.logger.info(`✅ Downloaded ${file}`);
        } catch (error) {
          this.logger.error(`❌ Failed to download ${file}:`, error);
          throw error;
        }
      }

      this.isModelReady = true;
      this.logger.info(
        `🎯 Whisper model ${config.transcription.model} ready for use`
      );
    } catch (error) {
      this.logger.error('❌ Failed to download Whisper model:', error);
      throw error;
    }
  }

  /**
   * Get the local model path for use in browser context
   */
  public getModelPath(): string {
    return this.modelPath;
  }

  /**
   * Check if model is ready for transcription
   */
  public isReady(): boolean {
    return this.isModelReady;
  }

  /**
   * Initialize the service and download model if needed
   */
  public async initialize(): Promise<void> {
    if (!config.transcription.enabled) {
      this.logger.info('🔇 Local transcription is disabled');
      return;
    }

    this.logger.info('🎤 Initializing Local Whisper Service...');
    await this.downloadModel();
  }
}
