# src/lib/ Context Guide

## Purpose

Core infrastructure libraries và utilities cho system-wide functionality. Đây là foundation layer providing essential services như job management, browser setup, task execution, và promise utilities.

## Key Files & Responsibilities

### `globalJobStore.ts` - Global Job Management
- **Singleton JobStore instance** cho entire application
- **Utility functions**: `isShutdownRequested()`, `isJobStoreBusy()`
- **Centralized access point** cho job state management

### `JobStore.ts` - Single Job Execution Engine
- **Single job enforcement** - only one meeting recording at a time
- **Retry logic với exponential backoff**
- **Graceful shutdown support** với task completion waiting
- **Error handling** với KnownError hierarchy
- **Task lifecycle management** (queuing, execution, cleanup)

### `Task.ts` - Abstract Task Framework
- **Base class** cho all background tasks
- **Lifecycle management**: completed, faulted, running states
- **Error propagation** với proper logging
- **Shutdown awareness** với `isShutdownRequested()` checks

### `chromium.ts` - Browser Context Factory
- **Standardized browser setup** cho all bots
- **Permission management** (camera, microphone)
- **Security configuration** (disable web security cho recording)
- **Performance optimization** settings

### `promise.ts` - Promise Utilities
- **WaitPromise type** với early resolution capability
- **Timeout management** với custom resolvers
- **Promise composition** patterns

## Architecture Patterns

### Single Job Execution Pattern

```typescript
// Core pattern used throughout system
const jobResult = await globalJobStore.addJob(async () => {
  // Long-running task that must be singleton
  await performMeetingRecording();
}, logger);

if (!jobResult.accepted) {
  throw new Error('System busy - cannot accept new job');
}
```

### Task Implementation Pattern

```typescript
export class CustomTask extends Task<InputType, OutputType> {
  protected async execute(input: InputType): Promise<OutputType> {
    // Check shutdown before starting
    if (this.isShutdownRequested()) {
      throw new Error('Shutdown requested');
    }
    
    // Perform work với periodic shutdown checks
    for (const item of workItems) {
      if (this.isShutdownRequested()) {
        await this.cleanup();
        throw new Error('Shutdown during execution');
      }
      
      await this.processItem(item);
    }
    
    return result;
  }
}
```

### Browser Context Pattern

```typescript
// Standardized browser setup
const context = await createBrowserContext();
await context.grantPermissions(['microphone', 'camera'], { origin: url });
const page = await context.newPage();

// Always cleanup
try {
  await performBrowserWork(page);
} finally {
  await page.context().browser()?.close();
}
```

## Development Patterns

### Adding New Task Types

1. **Extend Task base class**:

```typescript
export class DataProcessingTask extends Task<ProcessingInput, ProcessingOutput> {
  constructor(private config: ProcessingConfig, logger: Logger) {
    super(logger);
  }
  
  protected async execute(input: ProcessingInput): Promise<ProcessingOutput> {
    // Implementation với shutdown awareness
  }
}
```

2. **Register với JobStore**:

```typescript
const taskResult = await globalJobStore.addJob(async () => {
  const task = new DataProcessingTask(config, logger);
  return await task.runAsync(input);
}, logger);
```

### Custom Promise Utilities

```typescript
// For operations needing early termination
const waitPromise = getWaitingPromise(timeoutMs);

// Early resolution capability
waitPromise.resolveEarly();

// Use in long-running operations
await Promise.race([
  longRunningOperation(),
  waitPromise.promise
]);
```

## Using Tools

### Desktop Commander for Job Testing

```bash
# Test job store behavior
mcp_desktop-comma_start_process "node -e \"
const { globalJobStore } = require('./dist/lib/globalJobStore');
console.log('Job store busy:', globalJobStore.isBusy());
console.log('Shutdown requested:', globalJobStore.isShutdownRequested());
\""

# Test task execution
mcp_desktop-comma_start_process "node -e \"
const { Task } = require('./dist/lib/Task');
// Test custom task implementation
\""
```

### Context7 for Design Patterns

```typescript
// Get task queue và job management patterns
mcp_context7_resolve-library-id "node.js task queue"
mcp_context7_get-library-docs "/nodejs/node" "async patterns task management"

// Browser automation patterns
mcp_context7_resolve-library-id "playwright browser context"
mcp_context7_get-library-docs "/microsoft/playwright" "browser context management"
```

## Configuration & Setup

### JobStore Configuration

```typescript
// Single instance pattern
export const globalJobStore = new JobStore();

// Access utilities
export const isShutdownRequested = (): boolean => 
  globalJobStore.isShutdownRequested();
  
export const isJobStoreBusy = (): boolean => 
  globalJobStore.isBusy();
```

### Browser Context Settings

```typescript
// Standard configuration for recording
const browserArgs = [
  '--enable-usermedia-screen-capturing',
  '--allow-http-screen-capture',
  '--disable-web-security',
  '--use-gl=egl'
];

const contextOptions = {
  permissions: ['camera', 'microphone'],
  viewport: { width: 1280, height: 720 }
};
```

## Error Handling & Resilience

### Job Retry Logic

```typescript
// Built-in retry với exponential backoff
private async executeTaskWithRetry<T>(
  task: () => Promise<T>,
  logger: Logger,
  retryCount: number
): Promise<void> {
  try {
    await task();
  } catch (error) {
    if (error instanceof KnownError && !error.retryable) {
      throw error; // No retry for non-retryable errors
    }
    
    if (retryCount < maxRetries) {
      await sleep(retryCount * 30000); // Exponential backoff
      await this.executeTaskWithRetry(task, logger, retryCount + 1);
    } else {
      throw error;
    }
  }
}
```

### Graceful Shutdown Handling

```typescript
// In long-running operations
while (processing && !this.isShutdownRequested()) {
  await processChunk();
  
  // Periodic shutdown checks
  if (this.isShutdownRequested()) {
    await this.cleanup();
    break;
  }
}
```

## Integration Points

- **App Layer**: JobStore integration cho request handling
- **Bots**: Task framework cho bot lifecycle
- **Services**: Browser context cho automation
- **Utils**: Promise utilities cho async operations

## Monitoring & Debugging

### Job State Monitoring

```typescript
// Check system state
console.log('System busy:', globalJobStore.isBusy());
console.log('Shutdown requested:', globalJobStore.isShutdownRequested());

// Wait for completion
await globalJobStore.waitForCompletion();
```

### Task Debugging

```typescript
// Task state inspection
console.log('Task completed:', task.completed);
console.log('Task faulted:', task.faulted);
console.log('Task running:', task.running);
```

## Common Tasks

1. **Add new task type**: Extend Task class, implement execute()
2. **Configure browser**: Modify chromium.ts settings
3. **Handle new job type**: Use JobStore pattern
4. **Debug job issues**: Monitor JobStore state
5. **Implement graceful shutdown**: Use Task shutdown checks
