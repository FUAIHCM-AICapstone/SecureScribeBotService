# src/tasks/ Context Guide

## Purpose

Background task implementations cho specialized operations trong meeting bot lifecycle. Tasks handle complex, long-running operations với proper error handling, shutdown awareness, và resource management.

## Key Files & Responsibilities

### `RecordingTask.ts` - Video Recording Engine
- **MediaRecorder API orchestration** trong browser context
- **Real-time chunk streaming** với 2-second intervals
- **Intelligent meeting detection** (presence + silence)
- **Auto-recording termination** logic
- **Browser resource cleanup**

### `ContextBridgeTask.ts` - Browser-Node Communication
- **Bridge setup** giữa browser và Node.js contexts
- **ExposedFunction management** cho data transfer
- **Browser console log capture**
- **Event coordination** cho recording lifecycle

## Architecture Patterns

### Task Execution Pattern

```typescript
export class CustomTask extends Task<InputType, OutputType> {
  protected async execute(input: InputType): Promise<OutputType> {
    // 1. Shutdown check before starting
    if (this.isShutdownRequested()) {
      throw new Error('Shutdown requested before execution');
    }
    
    // 2. Perform work với periodic checks
    const result = await this.performWork(input);
    
    // 3. Cleanup on completion
    await this.cleanup();
    
    return result;
  }
  
  private async performWork(input: InputType): Promise<OutputType> {
    // Implementation với shutdown awareness
    while (this.hasWork() && !this.isShutdownRequested()) {
      await this.processNext();
    }
  }
}
```

### Browser Context Task Pattern

```typescript
// Execute logic trong browser context
await page.evaluate(async (params) => {
  // Browser-side logic
  const mediaRecorder = new MediaRecorder(stream);
  
  mediaRecorder.ondataavailable = async (event) => {
    // Stream data back to Node.js
    await (window as any).exposedFunction(data);
  };
  
  mediaRecorder.start();
}, executionParams);
```

## Development Patterns

### Creating New Task Types

1. **Extend Task base class**:

```typescript
export class DataAnalysisTask extends Task<AnalysisInput, AnalysisOutput> {
  constructor(
    private config: AnalysisConfig,
    logger: Logger
  ) {
    super(logger);
  }
  
  protected async execute(input: AnalysisInput): Promise<AnalysisOutput> {
    // Implementation với proper error handling
    try {
      return await this.performAnalysis(input);
    } catch (error) {
      this._logger.error('Analysis failed:', error);
      throw error;
    }
  }
}
```

2. **Add shutdown awareness**:

```typescript
private async performAnalysis(input: AnalysisInput): Promise<AnalysisOutput> {
  const items = input.items;
  const results = [];
  
  for (const item of items) {
    // Check shutdown before each item
    if (this.isShutdownRequested()) {
      this._logger.info('Shutdown requested during analysis');
      break;
    }
    
    const result = await this.analyzeItem(item);
    results.push(result);
  }
  
  return { results };
}
```

### Browser Task Communication

```typescript
// Setup exposed functions cho browser communication
await page.exposeFunction('sendDataToNode', async (data: any) => {
  await this.processDataFromBrowser(data);
});

await page.exposeFunction('requestShutdown', () => {
  this.requestEarlyTermination();
});

// Execute trong browser context
await page.evaluate(() => {
  // Browser code có thể call exposed functions
  (window as any).sendDataToNode({ type: 'chunk', data: chunk });
});
```

## Recording Task Specifics

### MediaRecorder Setup Pattern

```typescript
// Trong browser context execution
const stream = await navigator.mediaDevices.getDisplayMedia({
  video: true,
  audio: {
    autoGainControl: false,
    channels: 2,
    echoCancellation: false,
    noiseSuppression: false
  },
  preferCurrentTab: true
});

const mediaRecorder = new MediaRecorder(stream, {
  mimeType: 'video/webm; codecs="h264"'
});

// 2-second chunk intervals
mediaRecorder.start(2000);
```

### Intelligent Detection Logic

```typescript
// Presence detection
const detectLoneParticipant = () => {
  const interval = setInterval(() => {
    if (this.isShutdownRequested()) {
      clearInterval(interval);
      return;
    }
    
    const participantCount = this.getParticipantCount();
    if (participantCount < 2) {
      this.stopRecording('lone_participant');
    }
  }, 5000);
};

// Silence detection
const detectSilence = () => {
  const audioContext = new AudioContext();
  const analyser = audioContext.createAnalyser();
  
  const checkSilence = () => {
    if (this.silenceDuration >= this.inactivityLimit) {
      this.stopRecording('silence_detected');
      return;
    }
    
    if (!this.isShutdownRequested()) {
      setTimeout(checkSilence, 100);
    }
  };
  
  checkSilence();
};
```

## Using Tools

### Desktop Commander for Task Testing

```bash
# Test recording task functionality
mcp_desktop-comma_start_process "node -e \"
const { RecordingTask } = require('./dist/tasks/RecordingTask');
// Test task creation và execution
const task = new RecordingTask(userId, teamId, page, duration, secretId, logger);
task.runAsync(null).then(console.log).catch(console.error);
\""

# Monitor browser processes
mcp_desktop-comma_list_processes
# Look for Chrome processes

# Test exposed function setup
mcp_desktop-comma_start_process "node -e \"
// Test page.exposeFunction patterns
\""
```

### Context7 for MediaRecorder Patterns

```typescript
// Get MediaRecorder best practices
mcp_context7_resolve-library-id "mediarecorder"
mcp_context7_get-library-docs "/mozilla/mediarecorder" "recording streaming chunks"

// Browser automation patterns
mcp_context7_resolve-library-id "playwright page evaluate"
mcp_context7_get-library-docs "/microsoft/playwright" "page evaluate expose function"
```

## Error Handling & Resilience

### Recording Error Recovery

```typescript
// Handle recording failures gracefully
mediaRecorder.onerror = (event) => {
  this._logger.error('MediaRecorder error:', event.error);
  
  // Attempt recovery
  if (this.canRecover()) {
    this.restartRecording();
  } else {
    this.terminateWithError('recording_failed');
  }
};

// Stream track error handling
stream.getTracks().forEach(track => {
  track.onerror = (error) => {
    this._logger.error('Track error:', error);
    this.handleTrackError(track, error);
  };
});
```

### Graceful Task Termination

```typescript
private async terminateGracefully(): Promise<void> {
  try {
    // Stop recording
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.stop();
    }
    
    // Stop tracks
    this.stream?.getTracks().forEach(track => track.stop());
    
    // Clear timeouts
    this.clearAllTimeouts();
    
    // Notify completion
    await (window as any).screenAppMeetEnd(this.slightlySecretId);
    
  } catch (error) {
    this._logger.error('Error during graceful termination:', error);
  }
}
```

## Integration Points

### With Browser Automation

```typescript
// Called from GoogleMeetBot
await this.recordMeetingPage({ teamId, eventId, userId, botId });

// Delegates to RecordingTask
const recordingTask = new RecordingTask(
  userId, teamId, page, duration, slightlySecretId, logger
);
await recordingTask.runAsync(null);
```

### With Upload Service

```typescript
// Real-time upload integration
const sendChunkToServer = async (chunk: ArrayBuffer) => {
  const base64 = arrayBufferToBase64(chunk);
  await (window as any).screenAppSendData(slightlySecretId, base64);
};

// Node.js side processing
page.exposeFunction('screenAppSendData', async (secretId: string, chunk: string) => {
  if (secretId !== this.slightlySecretId) return;
  
  const buffer = Buffer.from(chunk, 'base64');
  await this.uploadService.uploadChunk(buffer);
});
```

## Monitoring & Debugging

### Task State Monitoring

```typescript
// Track task progress
console.log('Task running:', task.running);
console.log('Task completed:', task.completed);
console.log('Task faulted:', task.faulted);

// Recording metrics
const metrics = {
  chunksRecorded: 0,
  bytesRecorded: 0,
  duration: 0,
  participantCount: 0
};
```

### Browser Context Debugging

```typescript
// Enable detailed browser logging
page.on('console', msg => {
  console.log(`Browser ${msg.type()}: ${msg.text()}`);
});

// Monitor performance
page.on('metrics', metrics => {
  console.log('Browser metrics:', metrics);
});
```

## Common Tasks

1. **Add new detection logic**: Extend recording termination conditions
2. **Improve error recovery**: Handle specific MediaRecorder errors
3. **Optimize performance**: Adjust chunk sizes và detection intervals
4. **Add new task types**: Implement custom background operations
5. **Debug recording issues**: Add detailed logging và metrics
6. **Extend browser communication**: Add new exposed functions
