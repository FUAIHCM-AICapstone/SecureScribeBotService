# src/bots/ Context Guide

## Purpose

Bot implementation layer cho automated meeting joining và recording. Đây là core business logic để interact với meeting platforms thông qua browser automation.

## Key Files & Responsibilities

### `AbstractMeetBot.ts` - Base Interface
- **JoinParams interface** - Standard parameters cho all bots
- **BotLaunchParams interface** - Platform-specific launch configs
- **Abstract base class** defining bot contract

### `MeetBotBase.ts` - Common Bot Logic
- **Shared utilities** cho all platform bots
- **Error handling patterns** cho lobby waiting
- **WaitingAtLobbyError** processing
- **Common bot lifecycle** management

### `GoogleMeetBot.ts` - Google Meet Implementation
- **Playwright automation** cho Google Meet
- **Stealth plugin** integration cho anti-detection
- **UI interaction patterns** (join button, lobby handling)
- **Recording orchestration** với RecordingTask
- **Meeting end detection** (silence + presence)
- **Graceful shutdown** integration

## Architecture Pattern

```typescript
// Bot lifecycle
Browser Launch → Page Setup → Join Meeting → Wait Admit → Record → Cleanup
```

### Core Implementation Pattern

```typescript
class PlatformBot extends MeetBotBase {
  async join(params: JoinParams): Promise<void> {
    const _state: BotStatus[] = ['processing'];
    
    try {
      // 1. Launch browser với specific config
      const browser = await chromium.launch(browserConfig);
      
      // 2. Setup page với permissions
      const page = await context.newPage();
      await page.goto(params.url);
      
      // 3. Handle platform-specific UI
      await this.handleJoinFlow(page, params);
      
      // 4. Wait for admission với retry logic
      await this.waitForAdmission(page);
      
      // 5. Start recording
      await this.recordMeetingPage(params);
      
      _state.push('finished');
    } catch (error) {
      _state.push('failed');
      throw error;
    } finally {
      await patchBotStatus({ status: _state }, logger);
    }
  }
}
```

## Development Patterns

### Adding New Platform Support

1. **Create new bot class**:

```typescript
export class ZoomBot extends MeetBotBase {
  async join(params: JoinParams): Promise<void> {
    // Platform-specific implementation
  }
}
```

2. **Implement platform-specific UI interactions**:

```typescript
private async handleZoomJoinFlow(page: Page): Promise<void> {
  // Zoom-specific selectors và interactions
  await page.click('[data-testid="join-audio-button"]');
  await page.fill('#display-name-input', params.name);
}
```

3. **Add platform detection logic**:

```typescript
// Platform-specific meeting end detection
private detectZoomMeetingEnd(): boolean {
  // Zoom-specific UI patterns
  return page.locator('.meeting-ended-container').isVisible();
}
```

### Browser Configuration Patterns

```typescript
// Platform-optimized browser args
const getBrowserArgs = (platform: 'google' | 'zoom'): string[] => {
  const baseArgs = [
    '--enable-usermedia-screen-capturing',
    '--allow-http-screen-capture',
    '--no-sandbox'
  ];
  
  if (platform === 'google') {
    return [...baseArgs, '--auto-accept-this-tab-capture'];
  }
  
  return baseArgs;
};
```

## Using Tools

### Desktop Commander for Browser Testing

```bash
# Launch browser để test manually
mcp_desktop-comma_start_process "node -e \"
const { chromium } = require('playwright');
chromium.launch({ headless: false }).then(browser => {
  console.log('Browser launched for testing');
});
\""
```

### Context7 for Playwright Documentation

```typescript
// Get Playwright automation patterns
mcp_context7_resolve-library-id "playwright"
mcp_context7_get-library-docs "/microsoft/playwright" "browser automation selectors stealth"
```

## Error Handling Strategies

### Lobby Waiting Patterns

```typescript
// Retryable lobby errors
if (bodyText.includes('waiting for host')) {
  throw new WaitingAtLobbyRetryError(
    'Waiting for host admission', 
    bodyText, 
    true,  // retryable
    3      // max retries
  );
}

// Non-retryable errors
if (bodyText.includes('meeting ended')) {
  throw new KnownError('Meeting already ended', false);
}
```

### Graceful Shutdown Integration

```typescript
// In long-running browser operations
if (this.isShutdownRequested()) {
  this._logger.info('Shutdown requested, cleaning up browser');
  await page.context().browser()?.close();
  throw new Error('Shutdown requested');
}
```

## Integration Points

- **RecordingTask**: Delegates video recording logic
- **UploadService**: Streams recording chunks to cloud
- **BotService**: Updates bot status và logging
- **Config**: Platform-specific settings
- **GlobalJobStore**: Single-job execution enforcement

## Testing & Debugging

### Local Testing

```typescript
// Test specific bot functionality
const bot = new GoogleMeetBot(logger);
await bot.join({
  url: 'https://meet.google.com/test-url',
  name: 'Test Bot',
  // ... other params
});
```

### Debug Meeting Detection

```typescript
// Add debug logging cho UI detection
const participants = await page.locator('[aria-label="People"]').textContent();
console.log('Detected participants:', participants);
```

## Common Tasks

1. **Add new platform**: Extend AbstractMeetBot, implement UI patterns
2. **Fix UI detection**: Update selectors cho platform changes
3. **Improve recording**: Enhance detection algorithms
4. **Debug joining issues**: Add logging, test selectors manually
