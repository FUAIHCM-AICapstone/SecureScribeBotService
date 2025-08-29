# Meeting Bot - Source Code Overview

## Project Description

Meeting Bot is a TypeScript-based automation bot that joins and records video meetings across multiple platforms including Google Meet, Microsoft Teams, and Zoom. Built with Node.js, Playwright for browser automation, and Redis for message brokering.

## Architecture Overview

### Core Design Principles

- **Single Job Execution**: Only one meeting is processed at a time across the entire system
- **Platform Abstraction**: Abstract bot classes with platform-specific implementations
- **Asynchronous Processing**: Redis queue support for high-throughput meeting requests
- **Graceful Shutdown**: Proper cleanup and resource management
- **Error Handling**: Comprehensive error handling with retry mechanisms

### Directory Structure

```
src/
├── app/           # Express application and route handlers
├── bots/          # Platform-specific bot implementations
├── connect/       # Redis message broker and consumer services
├── lib/           # Core libraries and utilities
├── middleware/    # Express middleware (disk uploader)
├── services/      # Business logic services
├── tasks/         # Background task implementations
├── types/         # TypeScript type definitions
├── uploader/      # Upload services (S3-compatible storage)
├── util/          # Utility functions
├── test/          # Test utilities
├── config.ts      # Configuration management
├── error.ts       # Custom error classes
├── index.ts       # Application entry point
└── context.md     # This file
```

## Key Components

### 1. Application Layer (`app/`)

- **Purpose**: REST API endpoints and Express application setup
- **Key Files**:
  - `index.ts`: Main Express app with Redis consumer initialization
  - `google.ts`, `microsoft.ts`, `zoom.ts`: Platform-specific API routes
  - `common.ts`: Shared interfaces and meeting join utilities

### 2. Bot Implementations (`bots/`)

- **Purpose**: Platform-specific meeting automation logic
- **Key Files**:
  - `AbstractMeetBot.ts`: Base class for all bot implementations
  - `GoogleMeetBot.ts`: Google Meet automation
  - `MicrosoftTeamsBot.ts`: Microsoft Teams automation
  - `ZoomBot.ts`: Zoom meeting automation

### 3. Core Infrastructure (`lib/`)

- **Purpose**: Core system components and utilities
- **Key Files**:
  - `globalJobStore.ts`: Global job management instance
  - `JobStore.ts`: Single job execution management
  - `Task.ts`: Background task abstraction
  - `recording.ts`: Recording utilities
  - `chromium.ts`: Browser automation setup

### 4. Redis Integration (`connect/`)

- **Purpose**: Message queue and Redis connectivity
- **Key Files**:
  - `RedisConsumerService.ts`: Processes Redis messages asynchronously
  - `RedisMessageBroker.ts`: Redis message operations
  - `messageBroker.ts`: Redis connection management

### 5. Services (`services/`)

- **Purpose**: Business logic and external integrations
- **Key Files**:
  - `botService.ts`: Bot status and logging API calls
  - `uploadService.ts`: File upload coordination
  - `bugService.ts`: Bug reporting functionality

### 6. Middleware (`middleware/`)

- **Purpose**: Express middleware components
- **Key Files**:
  - `disk-uploader.ts`: Local file storage and S3 upload functionality

### 7. Utilities (`util/`)

- **Purpose**: Shared utility functions and helpers
- **Key Files**:
  - `virtualCamera.ts`: Virtual camera implementation **[NEW]**
  - `auth.ts`: Authentication utilities
  - `errors.ts`: Error handling utilities
  - `logger.ts`: Logging and correlation ID management
  - `recordingName.ts`: Recording file naming utilities
  - `resilience.ts`: Retry logic and resilience patterns
  - `strings.ts`: String manipulation utilities

## Data Flow

### API Request Flow

1. **Request Received**: Express route handler receives meeting join request
2. **Job Queueing**: Request added to JobStore for single-job execution
3. **Bot Initialization**: Platform-specific bot created with correlation ID
4. **Meeting Join**: Bot automates joining the meeting using Playwright
5. **Recording**: Meeting recording starts and saves to temporary storage
6. **Upload**: Recording uploaded to S3-compatible storage
7. **Cleanup**: Temporary files cleaned up, resources released

### Redis Message Flow

1. **Message Queued**: Meeting request added to Redis queue
2. **Consumer Processing**: RedisConsumerService processes messages
3. **Job Processing**: Messages converted to jobs and processed via JobStore
4. **Meeting Automation**: Same flow as API requests

## Configuration

### Environment Variables

- `REDIS_CONSUMER_ENABLED`: Enable/disable Redis message processing
- `MAX_RECORDING_DURATION_MINUTES`: Maximum recording duration
- `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, etc.: S3-compatible storage configuration
- `NODE_ENV`: Environment mode (development/staging/production)

### Key Settings

- **Single Job Execution**: Only one meeting processed at a time
- **Retry Logic**: Automatic retry on known errors with exponential backoff
- **Timeout Handling**: Configurable timeouts for meeting operations
- **Graceful Shutdown**: Proper cleanup on system shutdown

## Error Handling

### Custom Error Types

- `KnownError`: Base error class with retry capabilities
- `WaitingAtLobbyError`: Meeting lobby timeout errors
- `UnsupportedMeetingError`: Platform-specific unsupported scenarios
- `MeetingTimeoutError`: General meeting timeout errors

### Error Categories

- **WaitingAtLobby**: Bot stuck in meeting lobby
- **Recording**: Recording-related issues
- **Integration**: External service integration problems
- **UnsupportedMeeting**: Meetings requiring authentication or special access
- **Platform**: Bot crashes or unresponsiveness

## Development Guidelines

### Code Style

- TypeScript with strict type checking
- CamelCase for variables/functions, PascalCase for classes/interfaces
- Single quotes for strings, semicolons required
- Comprehensive JSDoc documentation

### Patterns

- Abstract classes for common functionality
- Dependency injection for services
- Async/await over raw promises
- Early returns to reduce nesting

## Testing Strategy

- Playwright for browser automation testing
- Unit tests for core utilities
- Mock external dependencies
- Integration tests for API endpoints

## Deployment

- Docker containerization
- Multi-stage builds for production
- Environment-specific configurations
- Health checks and metrics endpoints

## Security Considerations

- Never log sensitive information (tokens, passwords)
- Input validation on all endpoints
- Environment variables for configuration
- Proper authentication checks

## Performance Optimization

- Single job execution prevents resource conflicts
- Browser instance pooling with Playwright
- Connection pooling for Redis
- Memory usage monitoring

## Monitoring & Observability

- Prometheus metrics endpoint
- Winston structured logging
- Correlation IDs for request tracing
- Health and busy status endpoints

---

_This context file provides an overview of the Meeting Bot codebase. For detailed implementation of specific components, refer to the individual context.md files in each subdirectory._
