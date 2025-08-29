# Meeting Bot - Business Services Layer

## Overview

The `services/` directory contains business logic services that handle external integrations, API communications, and specialized functionality for the Meeting Bot system.

## Directory Structure

```
services/
├── botService.ts        # Bot status and logging API integration
├── uploadService.ts     # File upload coordination and management
├── bugService.ts        # Bug reporting and error tracking
└── context.md          # This file
```

## Key Components

### 1. Bot Service (`botService.ts`)

**Purpose**: API integration for bot status updates and logging

**Key Features**:

- **Status Updates**: Real-time bot status reporting
- **Log Aggregation**: Centralized logging to external services
- **Error Handling**: Robust API communication error handling
- **Authentication**: Bearer token management for API calls

**Core Functions**:

#### `patchBotStatus()`

**Purpose**: Update bot status in external monitoring systems

**Parameters**:

```typescript
interface PatchBotStatusParams {
  eventId?: string;
  botId?: string;
  provider: 'google' | 'microsoft' | 'zoom';
  status: BotStatus[]; // 'processing' | 'joined' | 'finished' | 'failed'
  token: string;
}
```

**Status Types**:

- `processing`: Meeting join initiated
- `joined`: Successfully joined meeting
- `finished`: Meeting completed successfully
- `failed`: Meeting failed with error

#### `addBotLog()`

**Purpose**: Send log entries to external monitoring systems

**Parameters**:

```typescript
interface AddBotLogParams {
  eventId?: string;
  botId?: string;
  provider: 'google' | 'microsoft' | 'zoom';
  level: 'info' | 'error';
  message: string;
  category: LogCategory;
  subCategory: LogSubCategory<LogCategory>;
  token: string;
}
```

**Log Categories**:

- **WaitingAtLobby**: Lobby-related events (Timeout, StuckInLobby, UserDeniedRequest)
- **Recording**: Recording events (Start, End)
- **Integration**: External service events (InactiveIntegration, ReconnectRequired)
- **UnsupportedMeeting**: Platform limitations (RequiresSignIn, RestrictedMeeting, PrivateMeeting)
- **Platform**: Bot health (BotCrashed, BotNotResponding)

### 2. Upload Service (`uploadService.ts`)

**Purpose**: File upload coordination and multipart upload management

**Key Features**:

- **Multipart Upload**: Large file upload handling
- **Progress Tracking**: Upload progress monitoring
- **Error Recovery**: Failed upload retry logic
- **Storage Abstraction**: S3-compatible storage integration

**Core Functions**:

#### `initializeMultipartUpload()`

**Purpose**: Initialize multipart upload session

#### `uploadChunkToStorage()`

**Purpose**: Upload individual file chunks

#### `finalizeUpload()`

**Purpose**: Complete multipart upload and verify integrity

#### `createPartUploadUrl()`

**Purpose**: Generate presigned URLs for direct upload

**Upload Flow**:

```typescript
1. Initialize multipart upload
2. Split file into chunks (50MB each)
3. Upload chunks in parallel
4. Finalize upload with ETags
5. Verify upload completion
```

### 3. Bug Service (`bugService.ts`)

**Purpose**: Bug reporting and error tracking integration

**Key Features**:

- **Error Reporting**: Automated bug report generation
- **Context Capture**: Rich error context and system state
- **Severity Classification**: Error severity assessment
- **Integration**: External bug tracking system integration

## API Integration Architecture

### Authentication

- **Bearer Token**: JWT-based authentication for API calls
- **Service Key**: Backend service authentication
- **Token Management**: Secure token handling and rotation

### HTTP Client Configuration

```typescript
const apiV2 = createApiV2(token, serviceKey);
// Axios instance with:
// - Base URL configuration
// - Authentication headers
// - Timeout settings
// - Retry logic
```

### Error Handling Strategy

- **Network Errors**: Connection timeout and retry logic
- **Authentication Errors**: Token refresh and re-authentication
- **API Errors**: HTTP status code handling
- **Rate Limiting**: Request throttling and backoff

## Data Flow & Integration

### Status Update Flow

1. **Bot Event**: Bot state change occurs
2. **Status Capture**: Current status and context collected
3. **API Call**: Status sent to monitoring service
4. **Confirmation**: Success/failure response handling
5. **Logging**: Local logging of status update result

### Log Aggregation Flow

1. **Log Event**: Application event occurs
2. **Context Enrichment**: Correlation ID and metadata added
3. **API Transmission**: Log sent to aggregation service
4. **Local Backup**: Fallback local logging on API failure
5. **Error Handling**: Graceful degradation on service unavailability

### Upload Coordination Flow

1. **File Ready**: Recording file ready for upload
2. **Upload Initialization**: Multipart upload session created
3. **Chunk Processing**: File split into manageable chunks
4. **Parallel Upload**: Chunks uploaded concurrently
5. **Completion**: Upload finalized and verified
6. **Cleanup**: Temporary files removed

## Configuration Dependencies

### Environment Variables

```bash
# Authentication
SCREENAPP_AUTH_BASE_URL_V2=http://localhost:8081/v2
SCREENAPP_BACKEND_SERVICE_API_KEY=your-service-key

# Upload Configuration
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=meeting-recordings
S3_REGION=us-west-2
```

### Service Configuration

- **API Base URLs**: Configurable service endpoints
- **Timeout Settings**: Request timeout configuration
- **Retry Limits**: Maximum retry attempts for failed requests
- **Rate Limits**: Request rate limiting settings

## Monitoring & Observability

### Service Health Monitoring

- **API Connectivity**: Service availability checks
- **Response Times**: API call performance monitoring
- **Error Rates**: Failed request rate tracking
- **Rate Limit Status**: API quota monitoring

### Integration Metrics

- **Status Update Success Rate**: Percentage of successful status updates
- **Log Delivery Rate**: Percentage of logs successfully delivered
- **Upload Success Rate**: File upload completion rates
- **Error Classification**: Categorization of different error types

## Error Handling Patterns

### Network Error Handling

```typescript
try {
  const response = await apiV2.patch(endpoint, data);
  return response.data.success;
} catch (error) {
  logger.error('API call failed:', error.message, error?.response?.data);
  return false; // Graceful degradation
}
```

### Authentication Error Handling

- **Token Expiration**: Automatic token refresh attempts
- **Invalid Tokens**: Clear error messaging and logging
- **Permission Errors**: Proper error classification and reporting

### Upload Error Handling

- **Chunk Failures**: Individual chunk retry logic
- **Session Timeouts**: Multipart upload session refresh
- **Integrity Checks**: Upload verification and corruption detection

## Development Considerations

### Testing Strategy

- **Mock Services**: External API mocking for unit tests
- **Integration Tests**: Full API flow testing
- **Error Simulation**: Network failure and API error testing
- **Load Testing**: High-volume request handling

### Debugging Support

- **Request Logging**: Detailed API request/response logging
- **Correlation IDs**: Request tracing across services
- **Error Context**: Rich error information for debugging
- **Performance Profiling**: API call timing and bottleneck identification

## Security Considerations

### Data Protection

- **Token Security**: Secure token storage and transmission
- **Data Encryption**: Sensitive data encryption in transit
- **Access Control**: Proper API permission management
- **Audit Logging**: Security event logging and monitoring

### API Security

- **Request Validation**: Input validation and sanitization
- **Rate Limiting**: Protection against abuse
- **Authentication**: Strong authentication mechanisms
- **Authorization**: Proper permission checking

## Performance Optimization

### Connection Management

- **Connection Pooling**: Efficient HTTP connection reuse
- **Timeout Configuration**: Appropriate timeout settings
- **Retry Logic**: Intelligent retry with backoff
- **Caching**: Response caching where applicable

### Upload Optimization

- **Chunk Size**: Optimal chunk size for network efficiency
- **Parallel Uploads**: Concurrent chunk uploading
- **Progress Tracking**: Real-time upload progress monitoring
- **Bandwidth Management**: Upload throttling and prioritization

## Deployment Considerations

### Environment-Specific Configuration

- **Development**: Mock services and relaxed timeouts
- **Staging**: Full integration with monitoring
- **Production**: Optimized settings and enhanced security

### Scalability Patterns

- **Horizontal Scaling**: Multiple service instances
- **Load Balancing**: Request distribution across instances
- **Circuit Breakers**: Failure isolation and recovery
- **Service Discovery**: Dynamic service location

---

_For API layer details, see the `app/` directory context. For upload implementation, see the `middleware/` directory context._
