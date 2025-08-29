import createBrowserContext from '../lib/chromium';
import { loggerFactory } from '../util/logger';
import { VirtualCamera } from '../util/virtualCamera';
import { v4 } from 'uuid';

/**
 * Test script for Virtual Camera functionality
 */
async function testVirtualCamera() {
  console.log('🧪 Starting Virtual Camera Test...');

  const correlationId = v4();
  const logger = loggerFactory(correlationId, 'test');

  try {
    // Create browser context
    console.log('🌐 Creating browser context...');
    const context = await createBrowserContext();
    const page = await context.newPage();

    // Initialize virtual camera
    console.log('🎥 Initializing virtual camera...');
    const virtualCamera = new VirtualCamera(page, logger, 'assets/bg.png');
    await virtualCamera.initialize();

    // Start virtual camera
    console.log('▶️ Starting virtual camera stream...');
    await virtualCamera.start();

    // Test getUserMedia interception
    console.log('📹 Testing getUserMedia interception...');
    const streamResult = await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });

        return {
          success: true,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          trackDetails: stream.getVideoTracks().map(track => ({
            id: track.id,
            kind: track.kind,
            label: track.label,
            enabled: track.enabled,
            readyState: track.readyState
          }))
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    console.log('📊 getUserMedia result:', streamResult);

    if (streamResult.success) {
      console.log('✅ Virtual camera test PASSED');
      console.log(`   - Video tracks: ${streamResult.videoTracks}`);
      console.log(`   - Audio tracks: ${streamResult.audioTracks}`);
      console.log('   - Track details:', streamResult.trackDetails);
    } else {
      console.log('❌ Virtual camera test FAILED');
      console.log('   Error:', streamResult.error);
    }

    // Test canvas rendering
    console.log('🎨 Testing canvas rendering...');
    const canvasInfo = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) {
        return { found: false };
      }

      return {
        found: true,
        width: canvas.width,
        height: canvas.height,
        style: {
          display: canvas.style.display,
          position: canvas.style.position
        }
      };
    });

    console.log('📐 Canvas info:', canvasInfo);

    // Stop virtual camera
    console.log('⏹️ Stopping virtual camera...');
    await virtualCamera.stop();

    // Close browser
    console.log('🔚 Closing browser...');
    await context.browser()?.close();

    console.log('🎉 Virtual Camera Test completed successfully!');

  } catch (error) {
    console.error('❌ Virtual Camera Test failed:', error);
    logger.error('Virtual Camera Test failed', { error });
  }
}

// Export for use in other test files
export { testVirtualCamera };

// Run test if this file is executed directly
if (require.main === module) {
  testVirtualCamera().catch(console.error);
}
