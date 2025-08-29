# Meeting Bot - Task Layer

## Overview

The `tasks/` directory contains background task implementations that handle specific operations within the meeting automation workflow. These tasks run asynchronously and manage complex operations like browser automation and recording.

## Directory Structure

```
tasks/
├── ContextBridgeTask.ts    # Browser context and automation management
├── RecordingTask.ts        # Meeting recording functionality
└── context.md              # This file
```

## Key Components

### 1. Context Bridge Task (`ContextBridgeTask.ts`)

**Purpose**: Manages browser context, page automation, and meeting interaction

**Key Features**:

- **Browser Context**: Incognito browser session management
- **Page Automation**: Meeting page navigation and interaction
- **Context Bridge**: Communication between main process and browser
- **Resource Management**: Browser cleanup and resource disposal

**Core Responsibilities**:

- Launch and configure browser context
- Navigate to meeting URLs
- Handle authentication flows
- Manage browser lifecycle
- Coordinate with recording task

### 2. Recording Task (`RecordingTask.ts`)

**Purpose**: Handles meeting recording, screen capture, and file management

**Key Features**:

- **Screen Recording**: High-quality meeting recording
- **Format Support**: Multiple video formats (WebM, MP4, MKV)
- **Quality Control**: Configurable recording parameters
- **File Management**: Temporary file handling and cleanup

**Core Responsibilities**:

- Initialize recording session
- Manage recording parameters
- Handle recording lifecycle
- Coordinate with upload system
- Ensure recording integrity

## Task Architecture

### Task Lifecycle

```typescript
1. Task Initialization
   - Parameter validation
   - Resource allocation
   - Context setup

2. Task Execution
   - Main operation processing
   - Progress monitoring
   - Error handling

3. Task Completion
   - Resource cleanup
   - Result reporting
   - Status updates
```

### Task Coordination

- **Sequential Execution**: Tasks run in coordinated sequence
- **Resource Sharing**: Shared resources between tasks
- **Error Propagation**: Errors handled at appropriate levels
- **Status Synchronization**: Consistent state across tasks

## Integration Points

### Bot Layer Integration

- **GoogleMeetBot**: Uses ContextBridgeTask for browser automation
- **MicrosoftTeamsBot**: Uses RecordingTask for screen capture
- **ZoomBot**: Coordinates both tasks for complete meeting handling

### Infrastructure Integration

- **JobStore**: Tasks execute within JobStore-managed jobs
- **Browser Automation**: Playwright integration for web automation
- **File System**: Local file system for temporary storage

### Service Integration

- **Upload Service**: Recording files handed to upload system
- **Bot Service**: Task status and progress reporting
- **Logger**: Comprehensive task execution logging

## Task Types & Patterns

### 1. Context Bridge Pattern

**Purpose**: Bridge between main application and browser context

**Key Features**:

- **Isolation**: Separate browser context for each meeting
- **Security**: Incognito mode prevents data leakage
- **Performance**: Optimized browser configuration
- **Monitoring**: Browser health and performance tracking

### 2. Recording Pattern

**Purpose**: Structured approach to meeting recording

**Key Features**:

- **Format Flexibility**: Support for multiple video formats
- **Quality Management**: Configurable recording quality
- **Duration Control**: Recording time limits and management
- **File Handling**: Efficient temporary file management

## Error Handling

### Task-Specific Errors

- **Browser Launch Failure**: Browser initialization issues
- **Page Load Errors**: Meeting page loading problems
- **Recording Failures**: Screen capture technical issues
- **Resource Exhaustion**: Memory or disk space issues

### Recovery Strategies

- **Retry Logic**: Automatic retry for transient failures
- **Graceful Degradation**: Continue with reduced functionality
- **Resource Cleanup**: Proper cleanup on task failure
- **Error Reporting**: Comprehensive error information

## Configuration

### Task Parameters

```typescript
interface TaskConfig {
  browser: {
    headless: boolean;
    timeout: number;
    viewport: { width: number; height: number };
  };
  recording: {
    format: 'webm' | 'mp4' | 'mkv';
    quality: number;
    durationLimit: number;
  };
}
```

### Environment Dependencies

- `MAX_RECORDING_DURATION_MINUTES`: Recording time limits
- `UPLOADER_FILE_EXTENSION`: Recording file format
- `NODE_ENV`: Development vs production settings

## Performance Considerations

### Resource Optimization

- **Browser Pooling**: Efficient browser instance management
- **Memory Management**: Controlled memory usage during recording
- **Disk I/O**: Optimized file system operations
- **Network Efficiency**: Minimized network overhead

### Monitoring

- **Task Duration**: Execution time tracking
- **Resource Usage**: CPU, memory, and disk monitoring
- **Success Rates**: Task completion percentage
- **Error Patterns**: Common failure mode identification

## Development Considerations

### Testing Strategy

- **Unit Tests**: Individual task component testing
- **Integration Tests**: Full task workflow testing
- **Browser Testing**: Cross-browser compatibility testing
- **Performance Tests**: Load and stress testing

### Debugging Support

- **Task Tracing**: Detailed execution flow logging
- **Browser DevTools**: Browser automation debugging
- **Screenshot Capture**: Error state visualization
- **Performance Profiling**: Task bottleneck identification

## Security Considerations

### Browser Security

- **Incognito Mode**: Session isolation and data protection
- **Extension Control**: Limited browser extension access
- **Network Filtering**: Controlled network access
- **Data Sanitization**: Input validation and sanitization

### File Security

- **Temporary Files**: Secure temporary file handling
- **Permission Control**: Proper file system permissions
- **Data Encryption**: Recording data protection
- **Cleanup Verification**: Complete file removal verification

## Deployment Patterns

### Environment-Specific Configuration

- **Development**: Headless mode disabled for debugging
- **Staging**: Full functionality with monitoring
- **Production**: Optimized settings with security hardening

### Scalability Considerations

- **Concurrent Tasks**: Multiple task execution management
- **Resource Allocation**: Dynamic resource assignment
- **Load Balancing**: Task distribution across instances
- **Horizontal Scaling**: Multiple instance deployment

---

_For bot implementation details, see the `bots/` directory context. For core infrastructure, see the `lib/` directory context._
