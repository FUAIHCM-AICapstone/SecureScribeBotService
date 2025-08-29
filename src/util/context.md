# Meeting Bot - Utility Layer

## Overview

The `util/` directory contains utility functions and helpers that provide common functionality across the Meeting Bot application. These utilities handle logging, authentication, error handling, and various helper functions.

## Directory Structure

```
util/
├── auth.ts              # Authentication utilities
├── errors.ts            # Error handling utilities
├── logger.ts            # Logging and correlation ID management
├── recordingName.ts     # Recording file naming utilities
├── resilience.ts        # Resilience and retry utilities
├── strings.ts           # String manipulation utilities
├── virtualCamera.ts     # Virtual camera implementation **[NEW]**
└── context.md           # This file
```

## Key Components

### 1. Authentication Utilities (`auth.ts`)

**Purpose**: API authentication and token management

**Key Features**:

- **API Client Creation**: Configured HTTP client with authentication
- **Token Management**: Bearer token handling and refresh
- **Service Authentication**: Backend service API key management

**Core Functions**:

```typescript
function createApiV2(token: string, serviceKey?: string): AxiosInstance;
```

**Usage**:

```typescript
const apiClient = createApiV2(userToken, serviceKey);
const response = await apiClient.post('/endpoint', data);
```

### 2. Error Handling (`errors.ts`)

**Purpose**: Centralized error handling and classification

**Key Features**:

- **Error Type Detection**: Automatic error type classification
- **Context Enrichment**: Error context and metadata addition
- **Logging Integration**: Error logging with correlation IDs

**Core Functions**:

```typescript
function getErrorType(error: any): string;
function enrichError(error: any, context: object): Error;
```

### 3. Logging System (`logger.ts`)

**Purpose**: Structured logging with correlation ID tracking

**Key Features**:

- **Correlation IDs**: Unique request tracing across components
- **Structured Logging**: Consistent log format with metadata
- **Multiple Transports**: Console, file, and external logging
- **Log Levels**: Configurable logging verbosity

**Core Components**:

#### Logger Factory

```typescript
function loggerFactory(correlationId: string, provider: string): Logger;
```

**Features**:

- **Context Preservation**: Correlation ID maintained across async operations
- **Provider Tagging**: Platform-specific log categorization
- **Performance Tracking**: Request timing and performance metrics

#### Correlation ID Management

```typescript
function createCorrelationId(params: { teamId: string; userId: string; botId?: string; eventId?: string; url: string }): string;
```

#### Log Aggregator

```typescript
class LogAggregator {
  addLog(level: string, message: string): void;
  getLogs(): LogEntry[];
}
```

### 4. Recording Name Utilities (`recordingName.ts`)

**Purpose**: Generate consistent recording file names

**Key Features**:

- **Platform-Specific Naming**: Different naming conventions per platform
- **Timestamp Integration**: Date/time-based naming
- **Safe Characters**: File system-safe character usage
- **Uniqueness**: Collision-resistant naming

**Core Functions**:

```typescript
function getRecordingNamePrefix(provider: 'google' | 'microsoft' | 'zoom'): string;
function generateRecordingName(params: { prefix: string; timestamp: Date; userId: string; teamId: string }): string;
```

**Naming Pattern**:

```
{provider}_{timestamp}_{userId}_{teamId}_{randomId}.{extension}
```

### 5. Resilience Utilities (`resilience.ts`)

**Purpose**: Retry logic and resilience patterns

**Key Features**:

- **Exponential Backoff**: Intelligent retry with backoff
- **Circuit Breaker**: Failure isolation and recovery
- **Timeout Handling**: Configurable operation timeouts
- **Rate Limiting**: Request rate control

**Core Functions**:

```typescript
function withRetry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T>;

function withTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T>;
```

### 6. String Utilities (`strings.ts`)

**Purpose**: String manipulation and encoding utilities

**Key Features**:

- **Safe Encoding**: URL and filename-safe encoding
- **Base64 Handling**: Safe base64 encoding/decoding
- **String Sanitization**: Input sanitization and validation
- **Format Conversion**: String format transformations

**Core Functions**:

```typescript
function encodeFileNameSafebase64(input: string): string;
function decodeFileNameSafebase64(input: string): string;
function sanitizeFileName(filename: string): string;
```

### 7. Virtual Camera (`virtualCamera.ts`) **[NEW]**

**Purpose**: Canvas-based virtual camera implementation for browser automation

**Key Features**:

- **Canvas-based Video Stream**: Creates fake video using HTML5 Canvas
- **MediaDevices Override**: Intercepts `getUserMedia` to return virtual stream
- **Customizable Content**: Configurable background color and text overlay
- **Browser Compatibility**: Uses standard Canvas and MediaStream APIs

**Core Functions**:

```typescript
class VirtualCamera {
  static inject(page: Page): Promise<void>;
  // Injects virtual camera into browser page
}

interface VirtualCameraOptions {
  width?: number; // Canvas width (default: 640)
  height?: number; // Canvas height (default: 480)
  backgroundColor?: string; // Background color (default: '#0066cc')
  text?: string; // Display text (default: 'Virtual Camera')
  textColor?: string; // Text color (default: 'white')
  fps?: number; // Frame rate (default: 30)
}
```

**Usage Pattern**:

```typescript
import { VirtualCamera } from '../util/virtualCamera';

// Inject virtual camera before meeting join
await VirtualCamera.inject(page);
```

## Integration Patterns

### Cross-Component Usage

- **Logger**: Used throughout the application for consistent logging
- **Correlation IDs**: Passed between components for request tracing
- **Error Handling**: Standardized error handling across modules
- **Authentication**: Consistent API authentication patterns
- **Virtual Camera**: Canvas-based fake video stream for browser automation

### Service Integration

- **Bot Service**: Uses auth utilities for API calls
- **Upload Service**: Uses retry utilities for resilience
- **Redis Service**: Uses string utilities for data encoding
- **Google Meet Bot**: Uses Virtual Camera for fake video stream injection

## Configuration

### Environment Variables

```bash
# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Authentication
SCREENAPP_AUTH_BASE_URL_V2=http://localhost:8081/v2
SCREENAPP_BACKEND_SERVICE_API_KEY=your-service-key

# Resilience
MAX_RETRY_ATTEMPTS=3
RETRY_BASE_DELAY=1000
TIMEOUT_DEFAULT=30000
```

### Runtime Configuration

```typescript
const config = {
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },
  retry: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
  },
};
```

## Performance Considerations

### Logging Performance

- **Async Logging**: Non-blocking log operations
- **Buffer Management**: Efficient log buffer handling
- **Transport Optimization**: Optimized log transport mechanisms
- **Memory Limits**: Controlled memory usage for log buffering

### Utility Performance

- **Caching**: Function result caching where applicable
- **Memory Efficiency**: Minimal memory allocation
- **CPU Optimization**: Efficient string and encoding operations
- **I/O Optimization**: Minimized file system operations

## Security Considerations

### Data Protection

- **Token Security**: Secure token storage and transmission
- **Input Validation**: String input sanitization and validation
- **Encoding Security**: Safe encoding/decoding operations
- **Log Security**: Sensitive data filtering in logs

### Authentication Security

- **Token Management**: Secure token handling and rotation
- **Request Signing**: API request authentication
- **Rate Limiting**: Protection against abuse
- **Audit Logging**: Security event logging

## Development Considerations

### Testing Strategy

- **Unit Tests**: Individual utility function testing
- **Integration Tests**: Cross-utility functionality testing
- **Mock Utilities**: Mock implementations for testing
- **Performance Tests**: Utility performance benchmarking

### Debugging Support

- **Detailed Logging**: Comprehensive utility operation logging
- **Error Context**: Rich error information with context
- **Performance Metrics**: Utility performance monitoring
- **Tracing**: Request flow tracing through utilities

## Best Practices

### Logging Best Practices

- **Consistent Format**: Standardized log message format
- **Appropriate Levels**: Correct log level usage (debug, info, warn, error)
- **Context Inclusion**: Relevant context in log messages
- **Performance Awareness**: Minimal performance impact

### Error Handling Best Practices

- **Specific Errors**: Use specific error types over generic errors
- **Error Context**: Include relevant context in errors
- **Recovery**: Implement appropriate error recovery
- **Logging**: Comprehensive error logging

### Utility Design Best Practices

- **Pure Functions**: Prefer pure functions for testability
- **Single Responsibility**: Each utility has a single, clear purpose
- **Error Handling**: Comprehensive error handling in utilities
- **Documentation**: Clear documentation for utility functions

## Monitoring & Observability

### Utility Metrics

- **Function Usage**: Utility function call frequency
- **Performance**: Function execution time
- **Error Rates**: Utility function error rates
- **Resource Usage**: Memory and CPU usage by utilities

### Logging Metrics

- **Log Volume**: Total log message volume
- **Error Logs**: Error log message analysis
- **Performance Impact**: Logging performance overhead
- **Storage Usage**: Log storage consumption

---

_For main application details, see the `app/` directory context. For service layer details, see the `services/` directory context._
