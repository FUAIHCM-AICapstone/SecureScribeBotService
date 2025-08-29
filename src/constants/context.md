# Meeting Bot - Constants Layer

## Overview

The `constants/` directory contains application-wide constants, configuration values, and enumerated types that are used throughout the Meeting Bot system. These constants ensure consistency and provide centralized configuration management.

## Directory Structure

```
constants/
├── index.ts             # Main constants export
└── context.md           # This file
```

## Key Components

### Constants Index (`index.ts`)

**Purpose**: Centralized constant definitions and exports

**Key Categories**:

- **Platform Constants**: Meeting platform configurations
- **API Constants**: API endpoint and configuration values
- **Upload Constants**: File upload and storage settings
- **Bot Constants**: Bot behavior and automation settings

## Constant Categories

### 1. Platform Constants

**Purpose**: Platform-specific configuration and settings

**Meeting Platforms**:

```typescript
export const PLATFORMS = {
  GOOGLE: 'google',
  MICROSOFT: 'microsoft',
  ZOOM: 'zoom',
} as const;

export type PlatformType = (typeof PLATFORMS)[keyof typeof PLATFORMS];
```

**Platform URLs**:

```typescript
export const PLATFORM_URLS = {
  [PLATFORMS.GOOGLE]: 'https://meet.google.com',
  [PLATFORMS.MICROSOFT]: 'https://teams.microsoft.com',
  [PLATFORMS.ZOOM]: 'https://zoom.us',
} as const;
```

### 2. API Constants

**Purpose**: API-related configuration and endpoints

**HTTP Status Codes**:

```typescript
export const HTTP_STATUS = {
  OK: 200,
  ACCEPTED: 202,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
} as const;
```

**API Endpoints**:

```typescript
export const API_ENDPOINTS = {
  GOOGLE_JOIN: '/google/join',
  MICROSOFT_JOIN: '/microsoft/join',
  ZOOM_JOIN: '/zoom/join',
  HEALTH: '/health',
  BUSY_STATUS: '/isbusy',
  METRICS: '/metrics',
} as const;
```

### 3. Upload Constants

**Purpose**: File upload and storage configuration

**File Formats**:

```typescript
export const SUPPORTED_FORMATS = {
  WEBM: '.webm',
  MP4: '.mp4',
  MKV: '.mkv',
} as const;

export type FileFormat = (typeof SUPPORTED_FORMATS)[keyof typeof SUPPORTED_FORMATS];
```

**Upload Settings**:

```typescript
export const UPLOAD_CONFIG = {
  CHUNK_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_RETRIES: 3,
  TIMEOUT: 300000, // 5 minutes
  MAX_FILE_SIZE: 2 * 1024 * 1024 * 1024, // 2GB
} as const;
```

### 4. Bot Constants

**Purpose**: Bot behavior and automation settings

**Bot Status**:

```typescript
export const BOT_STATUS = {
  PROCESSING: 'processing',
  JOINED: 'joined',
  RECORDING: 'recording',
  FINISHED: 'finished',
  FAILED: 'failed',
} as const;

export type BotStatusType = (typeof BOT_STATUS)[keyof typeof BOT_STATUS];
```

**Timeout Settings**:

```typescript
export const BOT_TIMEOUTS = {
  JOIN_WAIT_TIME: 10, // seconds
  PAGE_LOAD_TIMEOUT: 30000, // 30 seconds
  RECORDING_START_TIMEOUT: 10000, // 10 seconds
  MAX_MEETING_DURATION: 180, // 3 hours in minutes
} as const;
```

## Configuration Management

### Environment-Based Constants

**Development Settings**:

```typescript
export const DEV_CONFIG = {
  LOG_LEVEL: 'debug',
  HEADLESS: false,
  DEBUG_MODE: true,
} as const;
```

**Production Settings**:

```typescript
export const PROD_CONFIG = {
  LOG_LEVEL: 'info',
  HEADLESS: true,
  DEBUG_MODE: false,
} as const;
```

### Feature Flags

```typescript
export const FEATURE_FLAGS = {
  REDIS_ENABLED: process.env.REDIS_CONSUMER_ENABLED === 'true',
  UPLOAD_ENABLED: process.env.S3_BUCKET_NAME !== undefined,
  METRICS_ENABLED: true,
} as const;
```

## Error Constants

### Error Types

```typescript
export const ERROR_TYPES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PLATFORM_ERROR: 'PLATFORM_ERROR',
  UPLOAD_ERROR: 'UPLOAD_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
} as const;
```

### Error Messages

```typescript
export const ERROR_MESSAGES = {
  [ERROR_TYPES.VALIDATION_ERROR]: 'Invalid input parameters',
  [ERROR_TYPES.PLATFORM_ERROR]: 'Platform-specific error occurred',
  [ERROR_TYPES.UPLOAD_ERROR]: 'File upload failed',
  [ERROR_TYPES.TIMEOUT_ERROR]: 'Operation timed out',
} as const;
```

## Redis Constants

### Redis Keys and Channels

```typescript
export const REDIS_KEYS = {
  MEETING_QUEUE: 'jobs:meetbot:list',
  STATUS_CHANNEL: 'meetbot:status',
  METRICS_CHANNEL: 'meetbot:metrics',
} as const;
```

### Redis Configuration

```typescript
export const REDIS_CONFIG = {
  DEFAULT_PORT: 6379,
  DEFAULT_HOST: 'redis',
  CONNECTION_TIMEOUT: 5000,
  COMMAND_TIMEOUT: 5000,
  MAX_RETRIES: 3,
} as const;
```

## Logging Constants

### Log Levels

```typescript
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
} as const;
```

### Log Categories

```typescript
export const LOG_CATEGORIES = {
  BOT_ACTIVITY: 'BOT_ACTIVITY',
  UPLOAD_ACTIVITY: 'UPLOAD_ACTIVITY',
  SYSTEM_ACTIVITY: 'SYSTEM_ACTIVITY',
  ERROR_ACTIVITY: 'ERROR_ACTIVITY',
} as const;
```

## Browser Constants

### Browser Configuration

```typescript
export const BROWSER_CONFIG = {
  DEFAULT_VIEWPORT: { width: 1920, height: 1080 },
  USER_AGENT: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
  EXECUTABLE_PATH: '/usr/bin/google-chrome',
} as const;
```

### Browser Arguments

```typescript
export const BROWSER_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--disable-gpu'] as const;
```

## Validation Constants

### Input Validation

```typescript
export const VALIDATION_RULES = {
  URL_MIN_LENGTH: 10,
  URL_MAX_LENGTH: 2048,
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 100,
  TEAM_ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  USER_ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
} as const;
```

### File Validation

```typescript
export const FILE_VALIDATION = {
  ALLOWED_EXTENSIONS: ['.webm', '.mp4', '.mkv'],
  MAX_SIZE_BYTES: 2 * 1024 * 1024 * 1024, // 2GB
  MIN_SIZE_BYTES: 1024, // 1KB
} as const;
```

## Usage Patterns

### Importing Constants

```typescript
import { PLATFORMS, BOT_STATUS, UPLOAD_CONFIG } from '../constants';

// Usage
if (platform === PLATFORMS.GOOGLE) {
  // Google-specific logic
}

if (status === BOT_STATUS.PROCESSING) {
  // Processing logic
}

const chunkSize = UPLOAD_CONFIG.CHUNK_SIZE;
```

### Type Safety

```typescript
import type { PlatformType, BotStatusType } from '../constants';

// Type-safe usage
function processMeeting(platform: PlatformType, status: BotStatusType) {
  // Function implementation
}
```

## Best Practices

### Constant Organization

- **Logical Grouping**: Related constants grouped together
- **Clear Naming**: Descriptive and consistent naming
- **Type Safety**: TypeScript types for constant values
- **Documentation**: Comprehensive documentation for each constant

### Maintenance

- **Centralized**: All constants in one location
- **Version Control**: Changes tracked in version control
- **Testing**: Constants validated through tests
- **Documentation**: Constants properly documented

## Testing Considerations

### Constant Testing

```typescript
describe('Constants', () => {
  it('should have valid platform values', () => {
    expect(PLATFORMS.GOOGLE).toBe('google');
    expect(PLATFORMS.MICROSOFT).toBe('microsoft');
    expect(PLATFORMS.ZOOM).toBe('zoom');
  });

  it('should have valid HTTP status codes', () => {
    expect(HTTP_STATUS.OK).toBe(200);
    expect(HTTP_STATUS.INTERNAL_ERROR).toBe(500);
  });
});
```

### Type Testing

```typescript
it('should have type-safe constants', () => {
  const platform: PlatformType = PLATFORMS.GOOGLE;
  const status: BotStatusType = BOT_STATUS.PROCESSING;

  expect(platform).toBeDefined();
  expect(status).toBeDefined();
});
```

## Deployment Considerations

### Environment-Specific Constants

- **Development**: Relaxed validation, debug features enabled
- **Staging**: Full validation, monitoring enabled
- **Production**: Strict validation, security features enabled

### Feature Flags

- **Gradual Rollout**: Feature flags for controlled deployment
- **A/B Testing**: Different constant values for testing
- **Rollback Support**: Easy reversion to previous values

---

_For configuration details, see the main `config.ts` file. For type definitions, see the `types.ts` file._
