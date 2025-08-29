# Virtual Camera Implementation for Google Meet Bot

## Overview

This implementation adds virtual camera support to the Google Meet Bot, allowing it to use a custom background image (`assets/bg.png`) as the camera feed instead of requiring a physical camera or microphone.

## Features

- ✅ **Canvas-based Virtual Camera**: Creates a real-time video stream from a background image
- ✅ **getUserMedia Interception**: Automatically intercepts browser camera requests
- ✅ **Real-time Rendering**: 30 FPS video stream with timestamp overlay
- ✅ **Aspect Ratio Handling**: Automatically scales and centers the background image
- ✅ **Error Handling**: Comprehensive error handling and cleanup
- ✅ **Browser Integration**: Seamlessly integrates with Playwright browser automation

## Architecture

### Components

1. **VirtualCamera Class** (`src/util/virtualCamera.ts`)

   - Main virtual camera implementation
   - Handles image loading, canvas creation, and stream generation
   - Intercepts `navigator.mediaDevices.getUserMedia()`

2. **Browser-side JavaScript**

   - Injected into the page via Playwright
   - Creates canvas element and MediaStream
   - Handles real-time rendering loop

3. **Google Meet Bot Integration** (`src/bots/GoogleMeetBot.ts`)
   - Automatically initializes virtual camera during meeting join
   - Proper cleanup on errors and completion

## How It Works

### 1. Image Loading

- Converts `assets/bg.png` to base64 data URL
- Loads image in browser context (no CORS issues)
- Scales image to fit canvas while maintaining aspect ratio

### 2. Canvas Rendering

- Creates 1280x720 canvas element
- Renders background image with proper scaling
- Adds "Virtual Camera" text overlay and timestamp
- Updates at 30 FPS using `requestAnimationFrame`

### 3. MediaStream Creation

- Uses `canvas.captureStream(30)` to create MediaStream
- Intercepts `getUserMedia` calls to return virtual stream
- Provides video-only stream (audio uses original implementation)

### 4. Google Meet Integration

- Virtual camera starts before Google Meet UI interaction
- Google Meet sees the virtual stream as a normal camera
- Bot can join meetings with custom background image

## Usage

### Basic Testing

```bash
# Test virtual camera functionality
npm run build
node dist/test/virtualCameraTest.js
```

### Debug Mode with Virtual Camera

```typescript
// In your application code
import mainDebug from './dist/test/debug';

// Test virtual camera
await mainDebug('test-user', 'https://meet.google.com/test', true);
```

### Production Usage

The virtual camera is automatically enabled when using the Google Meet Bot:

```typescript
import { GoogleMeetBot } from './dist/bots/GoogleMeetBot';

const bot = new GoogleMeetBot(logger);
await bot.join({
  url: 'https://meet.google.com/abc-defg-hij',
  name: 'Virtual Bot',
  bearerToken: 'your-token',
  teamId: 'team-123',
  userId: 'user-456',
  timezone: 'UTC',
  // Virtual camera will be automatically used
});
```

## Configuration

### Background Image

- **Location**: `assets/bg.png`
- **Supported formats**: PNG, JPEG, GIF, BMP, WebP
- **Recommended size**: 1280x720 or higher for best quality
- **Aspect ratio**: Any (automatically handled)

### Virtual Camera Settings

```typescript
// In VirtualCamera constructor
const virtualCamera = new VirtualCamera(page, logger, 'assets/bg.png');
```

### Canvas Settings (Browser-side)

- **Resolution**: 1280x720 (HD)
- **Frame rate**: 30 FPS
- **Video codec**: VP8 (via WebRTC)

## Testing

### Automated Test

```bash
# Run virtual camera test
npm run test:virtual-camera
```

### Manual Testing

1. Start the application with debug mode
2. Navigate to a page that requests camera access
3. Check browser console for virtual camera logs
4. Verify canvas element is created and streaming

### Integration Testing

1. Use Google Meet Bot with a test meeting
2. Verify bot joins with virtual camera
3. Check that other participants see the background image
4. Confirm recording captures the virtual camera feed

## Browser Compatibility

### Supported Browsers

- ✅ Chrome/Chromium (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge

### Requirements

- **Canvas API**: Supported in all modern browsers
- **MediaStream API**: Required for WebRTC functionality
- **getUserMedia**: Intercepted and replaced with virtual stream

## Troubleshooting

### Common Issues

1. **Image not loading**

   ```
   Error: Failed to convert image to data URL
   ```

   - Check that `assets/bg.png` exists
   - Verify file permissions
   - Ensure image format is supported

2. **Canvas not created**

   ```
   Error: Canvas not initialized
   ```

   - Check browser console for JavaScript errors
   - Verify page context is valid
   - Ensure script injection succeeded

3. **getUserMedia fails**

   ```
   Error: getUserMedia not supported
   ```

   - Virtual camera not properly initialized
   - Page context lost
   - Browser doesn't support MediaDevices API

4. **Google Meet doesn't see camera**
   - Virtual camera not started before page navigation
   - Timing issue with getUserMedia interception
   - Browser permissions not granted

### Debug Steps

1. **Enable verbose logging**

   ```typescript
   const logger = loggerFactory(correlationId, 'debug');
   ```

2. **Check browser console**

   - Look for virtual camera initialization logs
   - Verify canvas creation and image loading
   - Check for MediaStream creation success

3. **Test individual components**

   ```typescript
   // Test image conversion
   const virtualCamera = new VirtualCamera(page, logger);
   await virtualCamera.initialize();

   // Test stream creation
   await virtualCamera.start();
   ```

4. **Verify browser compatibility**
   - Test in Chrome/Chromium first
   - Check for MediaDevices API support
   - Ensure canvas.captureStream is available

## Performance Considerations

### Memory Usage

- Canvas element: ~3.5MB (1280x720 RGBA)
- Image data: Varies by image size
- Base64 overhead: ~33% increase

### CPU Usage

- Rendering loop: ~30 FPS
- Image scaling: Minimal overhead
- Canvas operations: Hardware accelerated

### Network Impact

- No additional network requests
- Image loaded once at initialization
- Real-time stream processing only

## Security Considerations

### Browser Permissions

- Virtual camera requests camera permission
- Intercepts legitimate getUserMedia calls
- No actual camera hardware access

### Data Privacy

- Background image processed locally
- No external transmission of image data
- Canvas content stays in browser memory

### Anti-Detection

- Uses legitimate browser APIs
- Mimics real camera behavior
- Canvas-based approach is undetectable

## Future Enhancements

### Planned Features

- [ ] **Multiple background images** with rotation
- [ ] **Video file support** for animated backgrounds
- [ ] **Real-time image manipulation** (filters, overlays)
- [ ] **Audio stream support** for virtual microphone
- [ ] **Dynamic resolution** based on meeting requirements

### Integration Improvements

- [ ] **Configuration file** for virtual camera settings
- [ ] **Hot-reload** of background images
- [ ] **Performance monitoring** and optimization
- [ ] **Error recovery** and automatic restart

## API Reference

### VirtualCamera Class

```typescript
class VirtualCamera {
  constructor(page: Page, logger: Logger, bgImagePath?: string);

  // Initialize virtual camera
  async initialize(): Promise<void>;

  // Start video stream
  async start(): Promise<void>;

  // Stop video stream and cleanup
  async stop(): Promise<void>;

  // Check if virtual camera is active
  get isActiveStatus(): boolean;
}
```

### Browser API (Injected)

```javascript
// Available in page context after initialization
window.virtualCamera = {
  start(bgImageDataUrl: string): Promise<void>
  stop(): void
  isActive(): boolean
  getStream(): MediaStream
}
```

## Contributing

### Code Style

- Follow existing TypeScript patterns
- Use async/await for all async operations
- Include comprehensive error handling
- Add JSDoc comments for all public methods

### Testing

- Add unit tests for VirtualCamera class
- Include integration tests with Google Meet Bot
- Test different image formats and sizes
- Verify browser compatibility

### Documentation

- Update this README for new features
- Add code examples and usage patterns
- Document troubleshooting steps
- Include performance benchmarks
