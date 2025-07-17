# src/test/ Context Guide

## Purpose

Testing utilities và debug helpers cho development, troubleshooting, và manual testing của browser automation features. Provides isolated testing environment cho bot functionality without full system integration.

## Key Files & Responsibilities

### `debug.ts` - Browser Debug Utilities
- **Simplified browser launching** cho manual testing
- **Basic page navigation** và screenshot capture
- **Chromium context setup** testing
- **Development debugging** workflows

## Architecture Patterns

### Debug Testing Pattern

```typescript
// Simple browser test function
async function mainDebug(userId: string, url: string) {
  console.log('Launching browser...', { userId });
  
  // 1. Create browser context
  const context = await createBrowserContext();
  await context.grantPermissions(['microphone', 'camera'], { origin: url });
  
  // 2. Navigate và test
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  
  // 3. Perform debug operations
  await performDebugOperations(page);
  
  // 4. Cleanup
  await page.context().browser()?.close();
}
```

### Isolated Testing Pattern

```typescript
// Test specific functionality without full bot lifecycle
const testSpecificFeature = async () => {
  const context = await createBrowserContext();
  const page = await context.newPage();
  
  try {
    // Test specific browser automation
    await testUIInteraction(page);
    await testRecordingSetup(page);
    await testMeetingDetection(page);
  } finally {
    await page.context().browser()?.close();
  }
};
```

## Development Patterns

### Adding New Debug Functions

1. **Create specific test function**:

```typescript
export const debugGoogleMeetJoin = async (url: string) => {
  const logger = loggerFactory('debug-correlation', 'debug');
  const context = await createBrowserContext();
  
  try {
    const page = await context.newPage();
    await page.goto(url);
    
    // Test specific Google Meet interactions
    await testNameInput(page);
    await testJoinButton(page);
    await testLobbyDetection(page);
    
    logger.info('Debug test completed successfully');
  } catch (error) {
    logger.error('Debug test failed:', error);
  } finally {
    await context.browser()?.close();
  }
};
```

2. **Add UI testing helpers**:

```typescript
export const debugUISelectors = async (page: Page) => {
  // Test if selectors are working
  const selectors = [
    'input[aria-label="Your name"]',
    'button:has-text("Ask to join")',
    'button[aria-label="People"]'
  ];
  
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      console.log(`✓ Selector found: ${selector}`);
    } catch (error) {
      console.log(`✗ Selector not found: ${selector}`);
    }
  }
};
```

### Browser Automation Testing

```typescript
// Test browser permissions
export const testBrowserPermissions = async () => {
  const context = await createBrowserContext();
  const page = await context.newPage();
  
  // Test camera/microphone permissions
  await context.grantPermissions(['camera', 'microphone']);
  
  const permissions = await page.evaluate(async () => {
    const cameraPermission = await navigator.permissions.query({ name: 'camera' });
    const micPermission = await navigator.permissions.query({ name: 'microphone' });
    
    return {
      camera: cameraPermission.state,
      microphone: micPermission.state
    };
  });
  
  console.log('Browser permissions:', permissions);
  await context.browser()?.close();
};
```

## Using Tools

### Desktop Commander for Debug Testing

```bash
# Run debug function directly
mcp_desktop-comma_start_process "node -e \"
const { default: mainDebug } = require('./dist/test/debug');
mainDebug('test-user', 'https://meet.google.com/test-url')
  .then(() => console.log('Debug completed'))
  .catch(console.error);
\""

# Test browser context creation
mcp_desktop-comma_start_process "node -e \"
const createBrowserContext = require('./dist/lib/chromium').default;
createBrowserContext()
  .then(context => {
    console.log('Browser context created successfully');
    return context.browser()?.close();
  })
  .catch(console.error);
\""

# Run specific debug tests
mcp_desktop-comma_start_process "npm run debug -- --url=https://meet.google.com/test"
```

### Context7 for Testing Patterns

```typescript
// Get testing best practices
mcp_context7_resolve-library-id "playwright testing"
mcp_context7_get-library-docs "/microsoft/playwright" "testing patterns debugging"

// Browser automation testing
mcp_context7_resolve-library-id "browser automation testing"
mcp_context7_get-library-docs "/microsoft/playwright" "page testing selectors"
```

## Debug Workflows

### Testing New Platform Support

```typescript
export const debugNewPlatform = async (platformUrl: string) => {
  const context = await createBrowserContext();
  const page = await context.newPage();
  
  try {
    // 1. Test navigation
    console.log('Testing navigation...');
    await page.goto(platformUrl);
    
    // 2. Test UI detection
    console.log('Testing UI elements...');
    await debugUIElements(page);
    
    // 3. Test join flow
    console.log('Testing join flow...');
    await debugJoinFlow(page);
    
    // 4. Test recording setup
    console.log('Testing recording...');
    await debugRecordingSetup(page);
    
  } finally {
    await context.browser()?.close();
  }
};
```

### Recording Feature Testing

```typescript
export const debugRecordingFeatures = async () => {
  const context = await createBrowserContext();
  const page = await context.newPage();
  
  try {
    // Test MediaRecorder API
    const recordingSupported = await page.evaluate(() => {
      return typeof MediaRecorder !== 'undefined';
    });
    
    console.log('MediaRecorder supported:', recordingSupported);
    
    // Test getDisplayMedia
    const displayMediaSupported = await page.evaluate(() => {
      return navigator.mediaDevices && 
             typeof navigator.mediaDevices.getDisplayMedia === 'function';
    });
    
    console.log('getDisplayMedia supported:', displayMediaSupported);
    
    // Test codecs
    const codecs = await page.evaluate(() => {
      return {
        webm: MediaRecorder.isTypeSupported('video/webm'),
        webmH264: MediaRecorder.isTypeSupported('video/webm; codecs="h264"'),
        mp4: MediaRecorder.isTypeSupported('video/mp4')
      };
    });
    
    console.log('Supported codecs:', codecs);
    
  } finally {
    await context.browser()?.close();
  }
};
```

### UI Selector Validation

```typescript
export const validateSelectors = async (url: string, selectors: Record<string, string>) => {
  const context = await createBrowserContext();
  const page = await context.newPage();
  
  try {
    await page.goto(url);
    await page.waitForTimeout(5000); // Wait for page load
    
    const results: Record<string, boolean> = {};
    
    for (const [name, selector] of Object.entries(selectors)) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        results[name] = true;
        console.log(`✓ ${name}: ${selector}`);
      } catch (error) {
        results[name] = false;
        console.log(`✗ ${name}: ${selector}`);
      }
    }
    
    return results;
  } finally {
    await context.browser()?.close();
  }
};
```

## Integration with Main System

### Debug Endpoint Usage

```typescript
// Debug endpoint in main app
app.get('/debug', async (req, res) => {
  if (NODE_ENV !== 'development') {
    return res.status(404).json({ error: 'Debug endpoint not available' });
  }
  
  try {
    const { url, userId } = req.query;
    await mainDebug(userId as string, url as string);
    
    res.json({ success: true, message: 'Debug completed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Test Data Generation

```typescript
// Generate test data cho debugging
export const generateTestData = () => {
  return {
    userId: 'debug-user-' + Date.now(),
    teamId: 'debug-team',
    botId: 'debug-bot-' + Math.random().toString(36).substring(7),
    url: 'https://meet.google.com/debug-meeting',
    name: 'Debug Bot',
    bearerToken: 'debug-token',
    timezone: 'UTC'
  };
};
```

## Common Debug Tasks

### Browser Issues

```typescript
// Debug browser launch issues
export const debugBrowserLaunch = async () => {
  try {
    const context = await createBrowserContext();
    console.log('✓ Browser launched successfully');
    
    const page = await context.newPage();
    console.log('✓ Page created successfully');
    
    await page.goto('https://www.google.com');
    console.log('✓ Navigation successful');
    
    await context.browser()?.close();
  } catch (error) {
    console.error('✗ Browser debug failed:', error);
  }
};
```

### Permission Issues

```typescript
// Debug permission problems
export const debugPermissions = async () => {
  const context = await createBrowserContext();
  const page = await context.newPage();
  
  try {
    await context.grantPermissions(['camera', 'microphone']);
    
    const hasPermissions = await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch (error) {
        return false;
      }
    });
    
    console.log('Permissions granted:', hasPermissions);
  } finally {
    await context.browser()?.close();
  }
};
```

## Common Tasks

1. **Debug new platform**: Create platform-specific debug functions
2. **Test UI changes**: Validate selectors after platform updates
3. **Debug recording**: Test MediaRecorder functionality
4. **Test permissions**: Verify camera/microphone access
5. **Debug navigation**: Test page loading và routing
6. **Performance testing**: Measure browser automation speed
