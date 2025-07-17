# Google Meet Bot - AI Coding Assistant Instructions

## Architecture Overview

This is a **single-job execution system** for automated Google Meet recording using browser automation. The core principle: only one meeting can be recorded at a time across the entire system.

### Key Components Flow
```
HTTP Request → JobStore (singleton) → GoogleMeetBot → RecordingTask → Upload Service
```

- **JobStore**: Global singleton (`src/lib/globalJobStore.ts`) that enforces single-job execution
- **GoogleMeetBot**: Playwright-based browser automation for joining meetings
- **RecordingTask**: MediaRecorder API for capturing and streaming video chunks
- **Upload Service**: Multipart upload to cloud storage with real-time streaming

## Critical Patterns

### 1. Single Job Execution Pattern
```typescript
// Always check job acceptance before proceeding
const jobResult = await globalJobStore.addJob(async () => {
  const bot = new GoogleMeetBot(logger);
  await bot.join(params);
}, logger);

if (!jobResult.accepted) {
  return res.status(409).json({ error: 'BUSY' });
}
```

### 2. Graceful Shutdown Integration
All long-running tasks must check shutdown status:
```typescript
// In tasks that run in browser context
if (this.isShutdownRequested()) {
  await this.cleanup();
  throw new Error('Shutdown requested');
}
```

### 3. Real-time Streaming Architecture
Recording doesn't store locally - chunks stream directly to cloud:
```typescript
// 2-second chunks sent via exposed function
mediaRecorder.start(2000);
mediaRecorder.ondataavailable = async (event) => {
  const arrayBuffer = await event.data.arrayBuffer();
  await sendChunkToServer(arrayBuffer);
};
```

### 4. Intelligent Meeting Detection
Two-layer detection for auto-ending recordings:
- **Presence Detection**: Parse Google Meet UI for participant count
- **Silence Detection**: AudioContext analysis for meeting inactivity

## Development Workflows

### Local Development
```bash
npm run dev          # Docker compose with hot reload
npm start           # Direct nodemon execution
```

### Production Build
```bash
# Multi-stage Docker build
docker build -f Dockerfile.production -t meeting-bot .
```

### API Testing
```bash
# Check if system is busy
curl http://localhost:3000/isbusy

# Join a meeting
curl -X POST http://localhost:3000/google/join \
  -H "Content-Type: application/json" \
  -d '{"bearerToken":"token","url":"meet.google.com/abc","name":"Bot","teamId":"team1","timezone":"UTC","userId":"user1","botId":"bot1"}'
```

## Error Handling Conventions

### KnownError System
Use typed error hierarchy for retry logic:
```typescript
// Retryable errors
throw new WaitingAtLobbyRetryError('Lobby timeout', bodyText, true, 2);

// Non-retryable errors  
throw new KnownError('Auth failed', false);
```

### Correlation ID Logging
Every request gets a correlation ID for tracing:
```typescript
const correlationId = createCorrelationId({ teamId, userId, botId, eventId, url });
const logger = loggerFactory(correlationId, 'google');
```

## Configuration Patterns

### Environment-based Config (`src/config.ts`)
```typescript
// Required: GCP_DEFAULT_REGION, GCP_MISC_BUCKET, SCREENAPP_BACKEND_SERVICE_API_KEY
// Optional: MAX_RECORDING_DURATION_MINUTES (default: 180)
maxRecordingDuration: process.env.MAX_RECORDING_DURATION_MINUTES ? 
  Number(process.env.MAX_RECORDING_DURATION_MINUTES) : 180
```

### Browser Configuration
Fixed setup optimized for recording:
- Resolution: 1280x720
- Chrome executable: `/usr/bin/google-chrome`
- Stealth plugin enabled with specific evasions disabled

## Docker Deployment Specifics

### Multi-stage Production Build
- **Builder stage**: Full dependencies + TypeScript compilation
- **Production stage**: Only runtime dependencies + non-root user
- **Security**: Runs as `nodejs` user (uid 1001)

### Xvfb Integration
Uses custom wrapper script for headless display:
```dockerfile
ENTRYPOINT ["/usr/src/app/xvfb-run-wrapper"]
CMD ["node", "dist/index.js"]
```

## Integration Points

### External Services
- **ScreenApp Auth API**: Bearer token validation via `createApiV2()`
- **Cloud Storage**: Direct multipart upload (bypasses local filesystem)
- **Bot Status API**: Real-time status updates during recording

### Browser Automation Stack
- **Playwright**: Core automation with stealth plugin
- **MediaRecorder**: Native browser API for video capture
- **Custom Detection**: Google Meet UI parsing for meeting state

## Common Gotchas

1. **Never store recordings locally** - all chunks stream directly to cloud
2. **Check JobStore.isBusy()** before accepting new jobs
3. **Use correlation IDs** for all logging to trace requests
4. **Implement graceful shutdown checks** in long-running browser tasks
5. **Handle lobby waiting** with retryable errors and timeout detection
6. **Monitor browser console logs** using `browserLogCaptureCallback`

## Folder-Specific Context

Each `src/` folder contains a `context.md` file with detailed guidance:

- **`src/app/context.md`** - HTTP API layer, route handlers, Express setup
- **`src/bots/context.md`** - Browser automation, platform implementations
- **`src/lib/context.md`** - Core infrastructure, JobStore, Task framework
- **`src/services/context.md`** - External integrations, upload/bot services
- **`src/tasks/context.md`** - Background tasks, recording implementation
- **`src/util/context.md`** - Utilities, logging, authentication, retry logic
- **`src/test/context.md`** - Debug utilities, testing patterns
- **`src/middleware/context.md`** - Express middleware patterns (future use)

## Using Desktop Commander & Context7

These tools are available throughout the codebase for enhanced development:

### Desktop Commander Commands
```bash
# Start development environment
mcp_desktop-comma_start_process "npm run dev"

# Test API endpoints
mcp_desktop-comma_start_process "curl http://localhost:3000/isbusy"

# Debug browser automation
mcp_desktop-comma_start_process "node -e \"require('./dist/test/debug').default('user', 'url')\""
```

### Context7 Documentation
```typescript
// Get framework-specific guidance
mcp_context7_resolve-library-id "playwright"
mcp_context7_get-library-docs "/microsoft/playwright" "browser automation"

// Access specific documentation
mcp_context7_resolve-library-id "express"
mcp_context7_get-library-docs "/expressjs/express" "middleware routing"
```
