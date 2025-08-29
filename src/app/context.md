# Meeting Bot - Application Layer

## Overview

The `app/` directory contains the Express.js application setup, REST API endpoints, and routing logic for the Meeting Bot. This layer handles HTTP requests, manages job queuing, and coordinates between different platform bots.

## Directory Structure

```
app/
├── index.ts          # Main Express application setup
├── google.ts         # Google Meet API endpoints
├── microsoft.ts      # Microsoft Teams API endpoints
├── zoom.ts          # Zoom API endpoints
├── common.ts        # Shared types and utilities
└── context.md       # This file
```

## Key Components

### 1. Main Application (`index.ts`)

**Purpose**: Express application configuration and initialization

**Key Features**:

- Express server setup with JSON middleware
- Redis consumer service initialization
- Health check endpoints (`/health`, `/isbusy`)
- Prometheus metrics endpoint (`/metrics`)
- Platform-specific route mounting

**Endpoints**:

- `GET /health`: Docker health check
- `GET /isbusy`: Current system busy status
- `GET /metrics`: Prometheus metrics for monitoring
- `POST /google/join`: Join Google Meet
- `POST /microsoft/join`: Join Microsoft Teams meeting
- `POST /zoom/join`: Join Zoom meeting

### 2. Platform Routes

Each platform has its own route file (`google.ts`, `microsoft.ts`, `zoom.ts`) with identical structure:

**Request Flow**:

1. **Validation**: Required fields validation
2. **Correlation ID**: Generate unique correlation ID for tracking
3. **Logger**: Create platform-specific logger
4. **Job Queuing**: Add job to global JobStore
5. **Response**: Return immediate acceptance or busy status

**Request Format**:

```typescript
interface MeetingJoinParams {
  bearerToken: string; // Authentication token
  url: string; // Meeting URL
  name: string; // Bot display name
  teamId: string; // Team identifier
  timezone: string; // User timezone
  userId: string; // User identifier
  botId?: string; // Bot identifier
  eventId?: string; // Event identifier
}
```

**Response Codes**:

- `202 Accepted`: Request accepted and processing started
- `409 Conflict`: System busy with another meeting
- `400 Bad Request`: Missing required fields
- `500 Internal Server Error`: Processing error

### 3. Shared Utilities (`common.ts`)

**Purpose**: Common types and meeting join utilities

**Key Interfaces**:

```typescript
interface MeetingJoinParams {
  url: string;
  name: string;
  teamId: string;
  userId: string;
  bearerToken: string;
  timezone: string;
  botId?: string;
  eventId?: string;
}

interface MeetingJoinRedisParams extends MeetingJoinParams {
  provider: 'google' | 'microsoft' | 'zoom';
}
```

**Utility Functions**:

- `joinMeetWithRetry()`: Retry logic for meeting joins with exponential backoff
- `processMeetingJoin()`: Main processing wrapper with logging

## API Usage Examples

### Join Google Meet

```bash
POST /google/join
Content-Type: application/json

{
  "bearerToken": "your-auth-token",
  "url": "https://meet.google.com/abc-defg-hij",
  "name": "Meeting Notetaker",
  "teamId": "team123",
  "timezone": "UTC",
  "userId": "user123",
  "botId": "UUID"
}
```

### Check System Status

```bash
GET /isbusy
# Returns: { "success": true, "data": 0 } (0=available, 1=busy)
```

## Error Handling

### Validation Errors

- Missing required fields return `400 Bad Request`
- Either `botId` or `eventId` must be provided
- Invalid URLs or malformed data

### Job Queue Errors

- `409 Conflict` when system is busy
- Graceful handling of job store rejections
- Proper logging with correlation IDs

### Platform-Specific Errors

- Authentication failures
- Invalid meeting URLs
- Platform-specific validation errors

## Integration Points

### JobStore Integration

- All meeting requests go through `globalJobStore.addJob()`
- Single job execution ensures no resource conflicts
- Job acceptance/rejection handling

### Redis Consumer Service

- Redis messages processed through same job queue
- Consistent processing pipeline for both API and Redis requests
- Race condition handling for concurrent requests

### Bot Service Integration

- Bot status updates via `botService.patchBotStatus()`
- Log aggregation via `botService.addBotLog()`
- Error reporting and monitoring

## Monitoring & Observability

### Health Checks

- `/health`: Basic health status for container orchestration
- Includes uptime and timestamp information
- Used by Docker and orchestration platforms

### Busy Status

- `/isbusy`: Real-time system availability
- Used by load balancers and client applications
- Prevents duplicate meeting requests

### Metrics

- `/metrics`: Prometheus-compatible metrics
- `isbusy` gauge: Current busy status (0/1)
- `isavailable` gauge: Availability status (0/1)
- Integration with monitoring systems

## Configuration Dependencies

### Environment Variables

- `REDIS_CONSUMER_ENABLED`: Enable Redis message processing
- `NODE_ENV`: Environment mode for debugging
- `MAX_RECORDING_DURATION_MINUTES`: Recording limits

### Runtime Configuration

- `config.isRedisEnabled`: Redis feature flag
- `NODE_ENV`: Development vs production behavior
- Logger configuration and correlation ID generation

## Development Notes

### Request Processing

- All requests are asynchronous and return immediately
- Actual meeting processing happens in background jobs
- Clients should poll status or use webhooks for completion

### Correlation IDs

- Unique ID generated for each request
- Used across all logging and error tracking
- Helps trace requests through the entire system

### Error Propagation

- Errors bubble up from bot implementations
- Standardized error responses across all endpoints
- Proper HTTP status codes for different error types

---

_For platform-specific bot implementations, see the `bots/` directory context._
