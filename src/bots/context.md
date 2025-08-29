# Meeting Bot - Bot Implementations

## Overview

The `bots/` directory contains platform-specific bot implementations that handle the automation logic for joining and recording meetings on different platforms. Each bot extends the `AbstractMeetBot` base class and implements platform-specific automation using Playwright.

## Directory Structure

```
bots/
├── AbstractMeetBot.ts        # Base bot class
├── GoogleMeetBot.ts         # Google Meet automation
├── MicrosoftTeamsBot.ts     # Microsoft Teams automation
├── ZoomBot.ts              # Zoom meeting automation
├── MeetBotBase.ts          # Shared base functionality
└── context.md              # This file
```

## Architecture

### Abstract Base Class (`AbstractMeetBot.ts`)

**Purpose**: Defines the contract for all platform bots

**Key Interface**:

```typescript
export interface BotLaunchParams {
  provider: 'google' | 'microsoft' | 'zoom';
  url: string;
  name: string;
  teamId: string;
  userId: string;
  bearerToken: string;
  timezone: string;
  botId?: string;
  eventId?: string;
}

export interface JoinParams {
  url: string;
  name: string;
  bearerToken: string;
  teamId: string;
  timezone: string;
  userId: string;
  botId?: string;
  eventId?: string;
  uploader: IUploader; // File upload interface
}

export abstract class AbstractMeetBot {
  abstract join(params: JoinParams): Promise<void>;
}
```

### Shared Base Class (`MeetBotBase.ts`)

**Purpose**: Common functionality shared across all bots

**Key Features**:

- Browser context management
- Recording task coordination
- Error handling and retry logic
- Resource cleanup

## Platform-Specific Bots

### Google Meet Bot (`GoogleMeetBot.ts`)

**Purpose**: Automates joining and recording Google Meet meetings

**Key Features**:

- Google Meet URL validation and parsing
- Authentication handling (guest access)
- **Virtual camera integration** (canvas-based fake video stream) **[NEW]**
- Lobby waiting and admission detection
- Meeting recording with screen capture
- Error detection for unsupported scenarios

**Supported Meeting Types**:

- ✅ Public meeting links
- ✅ Meetings with waiting rooms (no auth required)
- ❌ Sign-in required meetings
- ❌ Password-protected meetings

**Detection Logic**:

- Page status detection (SIGN_IN_PAGE, GOOGLE_MEET_PAGE, UNSUPPORTED_PAGE)
- Lobby timeout handling
- User admission monitoring

### Microsoft Teams Bot (`MicrosoftTeamsBot.ts`)

**Purpose**: Automates joining and recording Microsoft Teams meetings

**Key Features**:

- Teams meeting URL parsing and validation
- Guest access handling
- Lobby waiting and admission detection
- Meeting recording functionality
- Platform-specific error handling

**Supported Scenarios**:

- ✅ Guest-accessible meetings
- ✅ Public meeting links
- ❌ Sign-in required meetings
- ❌ Enterprise authentication

### Zoom Bot (`ZoomBot.ts`)

**Purpose**: Automates joining and recording Zoom meetings

**Key Features**:

- Zoom meeting URL parsing
- Meeting ID and password extraction
- Guest joining automation
- Recording coordination
- Platform-specific timeout handling

**Supported Meeting Types**:

- ✅ Public Zoom meetings
- ✅ Guest-accessible meetings
- ❌ Password-protected meetings
- ❌ Sign-in required meetings

## Common Bot Operations

### 1. Meeting Join Process

```typescript
// All bots follow this general pattern:
1. Validate meeting URL and parameters
2. Launch browser with Playwright
3. Navigate to meeting URL
4. Handle authentication (if required)
5. Wait in lobby (if present)
6. Detect meeting admission
7. Start recording task
8. Monitor meeting status
9. Handle cleanup on completion
```

### 2. Recording Integration

- **RecordingTask**: Handles screen recording with configurable duration
- **ContextBridgeTask**: Manages browser context and automation
- **DiskUploader**: Manages local file storage and cloud upload

### 3. Error Handling

- **KnownError**: Retryable and non-retryable errors
- **WaitingAtLobbyError**: Lobby timeout scenarios
- **UnsupportedMeetingError**: Platform-specific limitations
- **MeetingTimeoutError**: General meeting operation timeouts

## Browser Automation

### Playwright Configuration

- **Browser**: Chromium (Google Chrome)
- **Headless Mode**: Configurable for debugging
- **Viewport**: Standard desktop resolution
- **User Agent**: Mimics real browser usage

### Context Management

- **Incognito Context**: Isolated browser sessions
- **Extension Handling**: Stealth mode anti-detection
- **Resource Cleanup**: Proper browser closure

## Monitoring & Logging

### Correlation IDs

- **Unique Tracking**: Each bot instance has unique correlation ID
- **Request Tracing**: Track requests across the entire system
- **Error Correlation**: Link errors to specific meeting attempts

### Log Categories

- **WaitingAtLobby**: Lobby-related events and timeouts
- **Recording**: Recording start/end events
- **Integration**: External service interactions
- **UnsupportedMeeting**: Platform limitation detections
- **Platform**: Bot crashes and responsiveness issues

### Bot Status Updates

- **Processing**: Meeting join initiated
- **Joined**: Successfully joined meeting
- **Recording**: Recording in progress
- **Finished**: Meeting completed successfully
- **Failed**: Meeting failed with error

## Configuration & Limits

### Timeouts

- **Join Timeout**: Maximum time to wait for meeting admission
- **Recording Duration**: Configurable maximum recording time
- **Page Load Timeout**: Browser page loading limits

### Retry Logic

- **Retry Count**: Configurable retry attempts for known errors
- **Exponential Backoff**: Increasing delay between retries
- **Error Classification**: Retryable vs non-retryable errors

## Development Considerations

### Platform Differences

- **URL Patterns**: Each platform has unique URL structures
- **Authentication**: Different guest access patterns
- **Lobby Behavior**: Platform-specific waiting room implementations
- **Error Messages**: Platform-specific error detection

### Testing Strategy

- **Unit Tests**: Bot logic testing with mocked browser
- **Integration Tests**: Full browser automation testing
- **Platform Testing**: Each bot tested against its target platform

### Debugging Support

- **Headless Mode**: Visual debugging when disabled
- **Screenshot Capture**: Error state screenshots
- **Browser Logs**: Console and network logging

## Error Scenarios & Handling

### Common Error Patterns

1. **Lobby Timeouts**: Bot waits too long in meeting lobby
2. **Authentication Issues**: Meeting requires sign-in
3. **Unsupported Meetings**: Password-protected or restricted meetings
4. **Network Issues**: Connectivity problems during automation
5. **Browser Crashes**: Playwright browser instability

### Error Recovery

- **Graceful Degradation**: Clean shutdown on unrecoverable errors
- **Resource Cleanup**: Browser and file cleanup on errors
- **Status Updates**: Proper error status reporting to API

## Performance Optimization

### Resource Management

- **Single Browser Instance**: One browser per meeting
- **Memory Monitoring**: Prevent memory leaks
- **File Cleanup**: Automatic temporary file removal

### Scalability Considerations

- **Sequential Processing**: Only one meeting at a time
- **Resource Limits**: Configurable timeouts and limits
- **Concurrent Handling**: JobStore prevents resource conflicts

---

_For API integration details, see the `app/` directory context. For core infrastructure, see the `lib/` directory context._
