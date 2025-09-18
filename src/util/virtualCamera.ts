import { Page } from 'playwright';

export interface VirtualCameraOptions {
    width?: number;           // Canvas width (default: 640)
    height?: number;          // Canvas height (default: 480)
    backgroundColor?: string; // Background color (default: '#0066cc')
    text?: string;           // Display text (default: 'Virtual Camera')
    textColor?: string;      // Text color (default: 'white')
    fps?: number;            // Frame rate (default: 30)
}

export class VirtualCamera {
    static async inject(page: Page, options?: VirtualCameraOptions): Promise<void> {
        const opts = {
            width: 640,
            height: 480,
            backgroundColor: '#0066cc',
            text: 'Virtual Camera',
            textColor: 'white',
            fps: 30,
            ...options
        };

        await page.evaluate((config) => {
            // Create hidden canvas
            const canvas = document.createElement('canvas');
            canvas.width = config.width;
            canvas.height = config.height;
            canvas.style.display = 'none';
            document.body.appendChild(canvas);

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('Failed to get 2D rendering context');
            }

            // Draw background
            ctx.fillStyle = config.backgroundColor;
            ctx.fillRect(0, 0, config.width, config.height);

            // Draw text
            ctx.fillStyle = config.textColor;
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(config.text, config.width / 2, config.height / 2);

            // Create MediaStream from canvas
            const stream = canvas.captureStream(config.fps);

            // Override getUserMedia
            const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
            navigator.mediaDevices.getUserMedia = async (constraints) => {
                if (constraints && constraints.video) {
                    return stream;
                }
                return originalGetUserMedia.call(navigator.mediaDevices, constraints);
            };
        }, opts);
    }
}

