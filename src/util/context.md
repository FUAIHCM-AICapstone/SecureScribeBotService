# src/util/ Context Guide

## Purpose

Utility functions và helpers supporting core functionality across entire codebase. Provides reusable patterns cho authentication, logging, error handling, resilience, và string manipulation.

## Key Files & Responsibilities

### `logger.ts` - Logging Infrastructure
- **Correlation ID system** cho request tracing
- **Structured logging** với Winston
- **Browser console capture** từ Playwright
- **Error type classification** cho metrics
- **Multi-context logging** (Node.js + Browser)

### `auth.ts` - Authentication Utilities
- **API client creation** với bearer tokens
- **Service key validation**
- **HTTP client configuration** cho external services
- **Authentication error handling**

### `resilience.ts` - Retry & Recovery Logic
- **Exponential backoff** retry patterns
- **Action retry wrapper** với configurable attempts
- **Timeout handling** với graceful degradation
- **Error classification** cho retry decisions

### `errors.ts` - Error Categorization
- **Error type mapping** cho monitoring
- **Structured error classification**
- **Metrics-friendly error names**

### `recordingName.ts` - File Naming
- **Provider-specific naming** conventions
- **Consistent file naming** across platforms

### `strings.ts` - String Utilities
- **Text processing** helpers
- **Format validation** utilities

## Architecture Patterns

### Correlation ID Pattern

```typescript
// Generate unique correlation ID cho request tracing
const correlationId = createCorrelationId({ 
  teamId, userId, botId, eventId, url 
});

// Create logger với correlation context
const logger = loggerFactory(correlationId, 'google');

// All log messages will include correlation ID
logger.info('Processing started'); 
// Output: [timestamp] [info] [correlationId: abc-123] Processing started
```

### Structured Logging Pattern

```typescript
// Use structured logging với metadata
logger.info('Bot status updated', { 
  botId, 
  teamId, 
  status: 'joined',
  duration: 1234 
});

// Browser log capture
page.on('console', async msg => {
  await browserLogCaptureCallback(logger, msg);
});
```

### Retry Pattern

```typescript
// Standard retry với exponential backoff
await retryActionWithWait(
  'Clicking join button',
  async () => {
    await page.click('[data-testid="join-button"]');
  },
  logger,
  maxAttempts: 3,
  timeoutMs: 15000
);
```

## Development Patterns

### Adding New Utility Functions

1. **Create specialized utility**:

```typescript
// In new utility file
export const createSpecializedHelper = (config: HelperConfig) => {
  return {
    process: async (input: InputType): Promise<OutputType> => {
      // Implementation với error handling
    },
    
    validate: (input: InputType): boolean => {
      // Validation logic
    }
  };
};
```

2. **Add to existing utility**:

```typescript
// Extend existing utility file
export const newLoggerFeature = (logger: Logger, context: string) => {
  return logger.child({ context });
};
```

### Custom Error Classifications

```typescript
// Extend error categorization
export const getCustomErrorType = (error: Error): string => {
  if (error instanceof CustomError) {
    return 'custom_error';
  }
  
  if (error.message.includes('network')) {
    return 'network_error';
  }
  
  return getErrorType(error); // Fallback to existing
};
```

### Authentication Patterns

```typescript
// Create authenticated API client
const apiClient = createApiV2(bearerToken, serviceKey);

// Make authenticated requests
const response = await apiClient.post('/endpoint', data);

// Handle auth errors
try {
  await apiClient.get('/protected');
} catch (error) {
  if (error.response?.status === 401) {
    throw new KnownError('Authentication failed', false);
  }
}
```

## Using Tools

### Desktop Commander for Utility Testing

```bash
# Test logging utilities
mcp_desktop-comma_start_process "node -e \"
const { loggerFactory, createCorrelationId } = require('./dist/util/logger');
const correlationId = createCorrelationId({ teamId: 'test', userId: 'test' });
const logger = loggerFactory(correlationId, 'test');
logger.info('Testing utility functions');
\""

# Test retry utilities
mcp_desktop-comma_start_process "node -e \"
const { retryActionWithWait } = require('./dist/util/resilience');
retryActionWithWait('test action', async () => {
  console.log('Action executed');
}, console, 3, 5000).catch(console.error);
\""

# Test authentication utilities
mcp_desktop-comma_start_process "node -e \"
const { createApiV2 } = require('./dist/util/auth');
const api = createApiV2('test-token', 'service-key');
console.log('API client created');
\""
```

### Context7 for Utility Patterns

```typescript
// Get Winston logging patterns
mcp_context7_resolve-library-id "winston"
mcp_context7_get-library-docs "/winstonjs/winston" "structured logging correlation"

// Retry pattern documentation
mcp_context7_resolve-library-id "retry patterns"
mcp_context7_get-library-docs "/nodejs/node" "retry exponential backoff"

// Authentication patterns
mcp_context7_resolve-library-id "axios authentication"
mcp_context7_get-library-docs "/axios/axios" "authentication interceptors"
```

## Configuration & Usage

### Logger Configuration

```typescript
// Standard logger factory usage
const logger = loggerFactory(correlationId, botType);

// Logger format includes:
// - Timestamp
// - Log level
// - Correlation ID
// - Bot type (optional)
// - Message
// - Metadata (JSON)
```

### Retry Configuration

```typescript
// Configurable retry parameters
const retryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2
};

// Usage với custom config
await retryActionWithWait(
  'Custom action',
  actionFunction,
  logger,
  retryConfig.maxAttempts,
  retryConfig.maxDelay
);
```

### Error Classification

```typescript
// Map errors to monitoring categories
const errorType = getErrorType(error);

// Standard error types:
// - 'known_error'
// - 'waiting_at_lobby_error'
// - 'network_error'
// - 'validation_error'
// - 'unknown_error'
```

## Integration Points

### With Core Systems

```typescript
// Logger integration with all components
const logger = loggerFactory(correlationId, 'component');

// Error classification cho monitoring
const errorType = getErrorType(error);
logger.error(`LogBasedMetric Error type: ${errorType}`, error);

// Retry integration with actions
await retryActionWithWait('API call', () => apiCall(), logger, 3, 15000);
```

### With External Services

```typescript
// Auth integration với services
const apiClient = createApiV2(token, serviceKey);

// Structured logging cho service calls
logger.info('Service call started', { endpoint, method, teamId });

try {
  const response = await apiClient.post(endpoint, data);
  logger.info('Service call succeeded', { status: response.status });
} catch (error) {
  const errorType = getErrorType(error);
  logger.error('Service call failed', { error, errorType });
}
```

## Monitoring & Debugging

### Correlation ID Tracing

```typescript
// Generate correlation ID cho full request lifecycle
const correlationId = createCorrelationId({
  teamId: 'team-123',
  userId: 'user-456', 
  botId: 'bot-789',
  eventId: 'event-abc',
  url: 'meet.google.com/xyz'
});

// All related logs will have same correlation ID
// Enables tracing across distributed systems
```

### Error Analysis

```typescript
// Categorize errors cho analytics
const analyzeErrors = (errors: Error[]) => {
  const errorCounts = errors.reduce((acc, error) => {
    const type = getErrorType(error);
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return errorCounts;
};
```

### Performance Monitoring

```typescript
// Track retry performance
const retryMetrics = {
  totalAttempts: 0,
  successfulRetries: 0,
  failedRetries: 0,
  averageAttempts: 0
};

// Log performance data
logger.info('Retry metrics', retryMetrics);
```

## Common Tasks

1. **Add new logger context**: Extend loggerFactory với new bot types
2. **Improve error classification**: Add new error types in getErrorType()
3. **Enhance retry logic**: Add custom backoff strategies
4. **Add authentication**: Extend auth utilities cho new services
5. **Debug correlation**: Use correlation IDs cho request tracing
6. **Monitor performance**: Add timing utilities cho critical paths
7. **Extend string utilities**: Add new text processing helpers
