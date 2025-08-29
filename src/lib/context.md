# Meeting Bot - Core Library Components

## Overview

The `lib/` directory contains the core infrastructure components that provide the foundation for the Meeting Bot system. These utilities handle job management, browser automation, recording, and system-level operations.

## Directory Structure

```
lib/
├── globalJobStore.ts      # Global job management instance
├── JobStore.ts           # Single job execution management
├── Task.ts              # Background task abstraction
├── recording.ts         # Recording utilities
├── chromium.ts          # Browser automation setup
├── datetime.ts          # Date/time utilities
├── promise.ts           # Promise utilities
└── context.md          # This file
```

## Key Components

### 1. Job Management System

#### Global Job Store (`globalJobStore.ts`)

**Purpose**: Singleton instance for system-wide job management

**Key Features**:

- **Single Instance**: `globalJobStore` provides system-wide access
- **Busy Status**: Real-time system availability checking
- **Shutdown Coordination**: Graceful shutdown handling

**Usage**:

```typescript
import { globalJobStore, isJobStoreBusy } from './lib/globalJobStore';

// Check if system is busy
const busy = isJobStoreBusy();

// Add job to queue
const result = await globalJobStore.addJob(myTask, logger);
```

#### Job Store (`JobStore.ts`)

**Purpose**: Core job execution management with single-job constraint

**Key Features**:

- **Single Job Execution**: Only one job runs at a time
- **Retry Logic**: Automatic retry for known errors with exponential backoff
- **Graceful Shutdown**: Prevents new jobs during shutdown
- **Completion Waiting**: Wait for ongoing jobs to complete

**Job Execution Flow**:

```typescript
1. Job added via addJob()
2. Check if system is busy or shutting down
3. Execute task asynchronously
4. Handle errors with retry logic
5. Mark system as available on completion
```

**Retry Strategy**:

- **Max Retries**: 3 attempts for known errors
- **Backoff Delay**: 30 seconds \* retry count
- **Error Classification**: Retryable vs non-retryable errors

### 2. Task Abstraction (`Task.ts`)

**Purpose**: Generic background task wrapper

**Key Features**:

- **Task Lifecycle**: Start, monitor, and cleanup
- **Resource Management**: Automatic resource cleanup
- **Error Handling**: Standardized error propagation
- **Async Execution**: Non-blocking task execution

### 3. Browser Automation (`chromium.ts`)

**Purpose**: Playwright browser setup and configuration

**Key Features**:

- **Browser Launch**: Configured Chromium instance
- **Context Creation**: Incognito browser contexts
- **Stealth Mode**: Anti-detection measures
- **Resource Cleanup**: Proper browser shutdown

**Configuration**:

```typescript
const browser = await chromium.launch({
  headless: config.headless,
  executablePath: config.chromeExecutablePath,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
```

### 4. Recording Utilities (`recording.ts`)

**Purpose**: Meeting recording management and utilities

**Key Features**:

- **Recording Control**: Start/stop recording operations
- **Format Handling**: Multiple video format support
- **Quality Settings**: Configurable recording parameters
- **File Management**: Temporary file handling

### 5. Date/Time Utilities (`datetime.ts`)

**Purpose**: Timezone handling and date formatting

**Key Features**:

- **Timezone Support**: User-specific timezone handling
- **Date Formatting**: Consistent date/time formatting
- **Duration Calculation**: Meeting duration tracking

**Usage**:

```typescript
import { getTimeString } from './lib/datetime';

const timestamp = getTimeString(userTimezone);
```

### 6. Promise Utilities (`promise.ts`)

**Purpose**: Advanced promise handling and utilities

**Key Features**:

- **Timeout Handling**: Promise timeouts with cleanup
- **Race Conditions**: Promise race handling
- **Cancellation**: Cancellable promise operations

## System Architecture

### Single Job Execution Model

The core architectural principle is **single job execution**:

1. **Job Acceptance**: Only one job accepted at a time
2. **Queue Management**: Subsequent requests rejected when busy
3. **Resource Protection**: Prevents resource conflicts
4. **Predictable Behavior**: Consistent system state

### Error Handling Strategy

- **KnownError**: Retryable errors with configurable limits
- **Non-Retryable**: Immediate failure for permanent errors
- **Exponential Backoff**: Increasing delays between retries
- **Graceful Degradation**: Clean failure handling

### Resource Management

- **Browser Instances**: Single browser per meeting
- **File Handles**: Proper file cleanup
- **Memory Management**: Leak prevention
- **Connection Pooling**: Redis connection management

## Integration Points

### Application Layer Integration

- **API Endpoints**: JobStore used by all meeting endpoints
- **Status Checks**: Busy status exposed via `/isbusy`
- **Metrics**: Job status integrated with Prometheus metrics

### Bot Layer Integration

- **Task Execution**: Bots run within JobStore-managed tasks
- **Error Propagation**: Bot errors handled by JobStore retry logic
- **Resource Coordination**: Browser and recording resources managed

### Redis Integration

- **Message Processing**: Redis consumer respects JobStore busy status
- **Race Prevention**: Prevents duplicate job processing
- **Shutdown Coordination**: Redis shutdown coordinated with JobStore

## Configuration Dependencies

### Environment Variables

- `MAX_RECORDING_DURATION_MINUTES`: Recording time limits
- `NODE_ENV`: Development vs production behavior
- `REDIS_*`: Redis connectivity settings

### Runtime Configuration

- `config.maxRecordingDuration`: Recording duration limits
- `config.joinWaitTime`: Meeting join timeout
- `config.inactivityLimit`: Inactivity detection threshold

## Monitoring & Observability

### Job Status Tracking

- **Busy State**: Real-time system availability
- **Job Progress**: Task execution monitoring
- **Error Metrics**: Failure rate and error type tracking

### Performance Metrics

- **Execution Time**: Job completion duration
- **Retry Count**: Failed attempt tracking
- **Resource Usage**: Memory and CPU monitoring

## Development Considerations

### Testing Strategy

- **Unit Tests**: Individual component testing
- **Integration Tests**: Full job execution testing
- **Mocking**: Browser and external service mocking
- **Concurrency Tests**: Race condition testing

### Debugging Support

- **Job Tracing**: Detailed job execution logging
- **Error Context**: Rich error information with correlation IDs
- **State Inspection**: Runtime job store status inspection

### Extension Points

- **Custom Tasks**: Easy addition of new task types
- **Error Handlers**: Pluggable error handling strategies
- **Monitoring Hooks**: Custom monitoring integration points

## Best Practices

### Job Implementation

- **Idempotent Operations**: Jobs should be safely retryable
- **Resource Cleanup**: Always clean up resources in finally blocks
- **Error Classification**: Properly classify retryable vs non-retryable errors
- **Timeout Handling**: Implement appropriate timeouts

### Performance Optimization

- **Memory Management**: Monitor and limit memory usage
- **File I/O**: Efficient temporary file handling
- **Network Calls**: Timeout and retry network operations
- **Browser Resources**: Proper browser cleanup

### Error Handling

- **Specific Errors**: Use specific error types over generic errors
- **Error Context**: Include relevant context in error messages
- **Logging**: Comprehensive error logging with correlation IDs
- **Recovery**: Implement graceful error recovery where possible

---

_For API layer details, see the `app/` directory context. For platform-specific bot implementations, see the `bots/` directory context._
