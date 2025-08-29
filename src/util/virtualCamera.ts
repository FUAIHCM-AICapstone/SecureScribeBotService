import { Page } from 'playwright';
import { Logger } from 'winston';
import path from 'path';
import fs from 'fs';

// Extend Window interface to include virtualCamera
declare global {
  interface Window {
    virtualCamera?: {
      start(bgImageDataUrl: string): Promise<void>;
      stop(): void;
      isActive(): boolean;
      getStream(): MediaStream;
    };
  }
}

/**
 * Virtual Camera utility for creating fake webcam streams from images
 * Replaces browser's getUserMedia with a canvas-based stream
 */
export class VirtualCamera {
  private page: Page;
  private logger: Logger;
  private bgImagePath: string;
  private bgImageDataUrl: string | null = null;
  private isActive = false;

  constructor(page: Page, logger: Logger, bgImagePath: string = 'assets/bg.png') {
    this.page = page;
    this.logger = logger;
    this.bgImagePath = path.resolve(process.cwd(), bgImagePath);
  }

  /**
   * Convert image file to base64 data URL
   */
  private async convertImageToDataUrl(): Promise<string> {
    try {
      const imageBuffer = fs.readFileSync(this.bgImagePath);
      const mimeType = this.getImageMimeType(this.bgImagePath);
      const base64 = imageBuffer.toString('base64');
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      this.logger.error('Failed to convert image to data URL', { error, bgImagePath: this.bgImagePath });
      throw error;
    }
  }

  /**
   * Get MIME type from file extension
   */
  private getImageMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.png': return 'image/png';
      case '.jpg':
      case '.jpeg': return 'image/jpeg';
      case '.gif': return 'image/gif';
      case '.bmp': return 'image/bmp';
      case '.webp': return 'image/webp';
      default: return 'image/png'; // fallback
    }
  }

  /**
   * Initialize virtual camera by injecting JavaScript into the page
   */
  async initialize(): Promise<void> {
    if (this.isActive) {
      this.logger.warn('Virtual camera is already active');
      return;
    }

    this.logger.info('Initializing virtual camera with background image', { bgImagePath: this.bgImagePath });

    try {
      // Convert image to data URL
      this.bgImageDataUrl = await this.convertImageToDataUrl();
      this.logger.info('Image converted to data URL successfully');

      // Inject virtual camera script into the page
      await this.page.addScriptTag({ content: this.getVirtualCameraScript() });

      // Wait for the script to be ready
      await this.page.waitForFunction(() => {
        return typeof window.virtualCamera !== 'undefined';
      });

      this.isActive = true;
      this.logger.info('Virtual camera initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize virtual camera', { error });
      throw error;
    }
  }

  /**
   * Start the virtual camera stream
   */
  async start(): Promise<void> {
    if (!this.isActive) {
      throw new Error('Virtual camera not initialized');
    }

    if (!this.bgImageDataUrl) {
      throw new Error('Background image not loaded');
    }

    this.logger.info('Starting virtual camera stream');

    try {
      await this.page.evaluate(async (bgImageDataUrl) => {
        if (!window.virtualCamera) {
          throw new Error('Virtual camera not initialized in browser context');
        }
        await window.virtualCamera.start(bgImageDataUrl);
      }, this.bgImageDataUrl);

      this.logger.info('Virtual camera stream started successfully');
    } catch (error) {
      this.logger.error('Failed to start virtual camera stream', { error });
      throw error;
    }
  }

  /**
   * Stop the virtual camera stream
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    this.logger.info('Stopping virtual camera stream');

    try {
      await this.page.evaluate(() => {
        if (window.virtualCamera) {
          window.virtualCamera.stop();
        }
      });

      this.isActive = false;
      this.logger.info('Virtual camera stream stopped successfully');
    } catch (error) {
      this.logger.error('Failed to stop virtual camera stream', { error });
    }
  }

  /**
   * Get the JavaScript code for virtual camera functionality
   */
  private getVirtualCameraScript(): string {
    return `
      (function() {
        class VirtualCamera {
          constructor() {
            this.canvas = null;
            this.context = null;
            this.stream = null;
            this.animationId = null;
            this.isRunning = false;
            this.originalGetUserMedia = null;
            this.bgImage = null;
          }

          async start(bgImagePath) {
            if (this.isRunning) {
              console.log('Virtual camera is already running');
              return;
            }

            try {
              console.log('🎥 Starting virtual camera with image:', bgImagePath);

              // Create canvas element
              this.canvas = document.createElement('canvas');
              this.canvas.width = 1280;
              this.canvas.height = 720;
              this.canvas.style.display = 'none';
              document.body.appendChild(this.canvas);

              this.context = this.canvas.getContext('2d');

              // Load background image
              await this.loadBackgroundImage(bgImagePath);

              // Intercept getUserMedia
              this.interceptGetUserMedia();

              // Start rendering loop
              this.startRendering();

              this.isRunning = true;
              console.log('✅ Virtual camera started successfully');
            } catch (error) {
              console.error('❌ Failed to start virtual camera:', error);
              throw error;
            }
          }

          async loadBackgroundImage(imageDataUrl) {
            return new Promise((resolve, reject) => {
              this.bgImage = new Image();

              this.bgImage.onload = () => {
                console.log('🖼️ Background image loaded successfully', {
                  width: this.bgImage.width,
                  height: this.bgImage.height,
                  naturalWidth: this.bgImage.naturalWidth,
                  naturalHeight: this.bgImage.naturalHeight
                });
                resolve();
              };

              this.bgImage.onerror = (error) => {
                console.error('❌ Failed to load background image:', error);
                reject(error);
              };

              // Use the data URL directly (no CORS issues with data URLs)
              this.bgImage.src = imageDataUrl;
            });
          }

          interceptGetUserMedia() {
            // Store original getUserMedia
            this.originalGetUserMedia = navigator.mediaDevices.getUserMedia;

            // Replace with our virtual implementation
            navigator.mediaDevices.getUserMedia = async (constraints) => {
              console.log('🎥 getUserMedia intercepted with constraints:', constraints);

              // If video is requested, return our virtual stream
              if (constraints && constraints.video) {
                console.log('📹 Returning virtual camera stream');
                return this.createVirtualStream();
              }

              // For audio or other constraints, use original
              if (this.originalGetUserMedia) {
                return this.originalGetUserMedia.call(navigator.mediaDevices, constraints);
              }

              throw new Error('getUserMedia not supported');
            };

            console.log('🎯 getUserMedia interception successful');
          }

          createVirtualStream() {
            if (!this.canvas) {
              throw new Error('Canvas not initialized');
            }

            // Create MediaStream from canvas
            this.stream = this.canvas.captureStream(30); // 30 FPS

            console.log('🎬 Virtual MediaStream created:', {
              videoTracks: this.stream.getVideoTracks().length,
              audioTracks: this.stream.getAudioTracks().length
            });

            return Promise.resolve(this.stream);
          }

          startRendering() {
            const render = () => {
              if (!this.context || !this.bgImage || !this.isRunning) {
                return;
              }

              try {
                // Clear canvas
                this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

                // Calculate scaling to fit image in canvas while maintaining aspect ratio
                const imageAspect = this.bgImage.width / this.bgImage.height;
                const canvasAspect = this.canvas.width / this.canvas.height;

                let drawWidth, drawHeight, drawX, drawY;

                if (imageAspect > canvasAspect) {
                  // Image is wider than canvas aspect ratio
                  drawWidth = this.canvas.width;
                  drawHeight = this.canvas.width / imageAspect;
                  drawX = 0;
                  drawY = (this.canvas.height - drawHeight) / 2;
                } else {
                  // Image is taller than canvas aspect ratio
                  drawHeight = this.canvas.height;
                  drawWidth = this.canvas.height * imageAspect;
                  drawX = (this.canvas.width - drawWidth) / 2;
                  drawY = 0;
                }

                // Draw the background image
                this.context.drawImage(this.bgImage, drawX, drawY, drawWidth, drawHeight);

                // Add a subtle timestamp or indicator that this is virtual
                this.context.fillStyle = 'rgba(255, 255, 255, 0.8)';
                this.context.font = '16px Arial';
                this.context.fillText('Virtual Camera', 10, 30);

                // Add current timestamp
                const now = new Date();
                this.context.fillText(now.toLocaleTimeString(), 10, 55);

              } catch (error) {
                console.error('❌ Error in rendering loop:', error);
              }

              // Continue rendering if still running
              if (this.isRunning) {
                this.animationId = requestAnimationFrame(render);
              }
            };

            // Start the rendering loop
            this.animationId = requestAnimationFrame(render);
            console.log('🎨 Rendering loop started');
          }

          stop() {
            if (!this.isRunning) {
              console.log('Virtual camera is not running');
              return;
            }

            console.log('🛑 Stopping virtual camera');

            // Stop rendering loop
            if (this.animationId) {
              cancelAnimationFrame(this.animationId);
              this.animationId = null;
            }

            // Stop all tracks in the stream
            if (this.stream) {
              this.stream.getTracks().forEach(track => {
                track.stop();
                console.log('🔇 Stopped track:', track.kind);
              });
              this.stream = null;
            }

            // Restore original getUserMedia
            if (this.originalGetUserMedia) {
              navigator.mediaDevices.getUserMedia = this.originalGetUserMedia;
              this.originalGetUserMedia = null;
            }

            // Remove canvas from DOM
            if (this.canvas && this.canvas.parentNode) {
              this.canvas.parentNode.removeChild(this.canvas);
              this.canvas = null;
              this.context = null;
            }

            this.isRunning = false;
            console.log('✅ Virtual camera stopped successfully');
          }

          // Method to check if virtual camera is active
          isActive() {
            return this.isRunning;
          }

          // Method to get current stream
          getStream() {
            return this.stream;
          }
        }

        // Make VirtualCamera available globally
        window.virtualCamera = new VirtualCamera();
        console.log('🎥 VirtualCamera class loaded and instantiated');
      })();
    `;
  }

  /**
   * Check if virtual camera is currently active
   */
  get isActiveStatus(): boolean {
    return this.isActive;
  }
}
