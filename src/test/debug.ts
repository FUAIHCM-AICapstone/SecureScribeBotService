
import createBrowserContext from '../lib/chromium';
import { loggerFactory } from '../util/logger';
import { VirtualCamera } from '../util/virtualCamera';
import { v4 } from 'uuid';

async function mainDebug(userId: string, url: string, testVirtualCamera: boolean = false) {
  console.log('Launching browser...', { userId: userId, testVirtualCamera });

  const correlationId = v4();
  const logger = loggerFactory(correlationId, 'debug');

  const context = await createBrowserContext();
  await context.grantPermissions(['microphone', 'camera'], { origin: url });

  const page = await context.newPage();

  if (testVirtualCamera) {
    console.log('🎥 Testing virtual camera functionality...');

    // Initialize virtual camera
    const virtualCamera = new VirtualCamera(page, logger, 'assets/bg.png');
    await virtualCamera.initialize();
    await virtualCamera.start();

    console.log('✅ Virtual camera started successfully');

    // Test the virtual camera by trying getUserMedia
    const testResult = await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        return {
          success: true,
          videoTracks: stream.getVideoTracks().length,
          trackInfo: stream.getVideoTracks().map(track => ({
            id: track.id,
            label: track.label,
            readyState: track.readyState
          }))
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    console.log('📊 Virtual camera test result:', testResult);

    // Keep the virtual camera running for a bit
    await page.waitForTimeout(5000);

    // Stop virtual camera
    await virtualCamera.stop();
    console.log('⏹️ Virtual camera stopped');
  } else {
    console.log('Navigating to URL...');
    await page.goto(url, { waitUntil: 'networkidle' });

    console.log('Page loaded, waiting for manual testing...');
    // Wait for 30 seconds to allow manual testing
    await page.waitForTimeout(30000);
  }

  console.log('Closing the browser...');
  await page.context().browser()?.close();
}

export default mainDebug;
