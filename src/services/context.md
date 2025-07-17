# src/services/ Context Guide

## Purpose

External service integration layer providing business logic cho API communication, file upload, và bot status management. Đây là abstraction layer between core business logic và external dependencies.

## Key Files & Responsibilities

### `uploadService.ts` - Cloud Storage Integration
- **Multipart upload workflow** cho large video files
- **Real-time chunk streaming** to cloud storage
- **Upload URL generation** cho secure direct uploads
- **File finalization** với metadata (name, timezone, botId)
- **Error handling** cho network failures

### `botService.ts` - Bot Status Management
- **Status updates** to ScreenApp backend
- **Bot logging** với categorized messages
- **Authentication** với service key validation
- **Error resilience** cho API communication failures

## Architecture Patterns

### Multipart Upload Flow

```typescript
// 1. Initialize upload session
const { fileId, uploadId } = await initializeMultipartUpload({
  teamId, folderId, contentType: 'video/webm', token
});

// 2. Stream chunks in real-time
for (const chunk of videoChunks) {
  const uploadUrl = await createPartUploadUrl({
    teamId, folderId, fileId, uploadId, partNumber, contentType, token
  });
  
  await uploadChunkToStorage({ uploadUrl, chunk });
}

// 3. Finalize with metadata
const file = await finalizeUpload({
  teamId, folderId, fileId, uploadId,
  namePrefix: 'Google Meet Recording',
  timezone, botId
});
```

### Bot Status Tracking

```typescript
// Status progression pattern
const statuses: BotStatus[] = ['processing'];

try {
  await performBotWork();
  statuses.push('joined');
  await performRecording();
  statuses.push('finished');
} catch (error) {
  statuses.push('failed');
} finally {
  await patchBotStatus({ botId, eventId, provider: 'google', status: statuses });
}
```

## Development Patterns

### Adding New Upload Destinations

```typescript
export const initializeS3Upload = async ({
  bucketName, objectKey, contentType, token
}: S3UploadOptions) => {
  const apiV2 = createApiV2(token);
  const response = await apiV2.put<IVFSResponse<S3UploadResponse>>(
    `/files/upload/s3/init/${bucketName}/${objectKey}`,
    { contentType }
  );
  return response.data.data;
};
```

### Custom Bot Status Categories

```typescript
export const addCustomBotLog = async ({
  eventId, botId, provider, level, message, 
  category, subCategory, token
}: CustomLogParams) => {
  // Extend existing bot logging với new categories
  await addBotLog({
    eventId, botId, provider, level, message,
    category: 'custom_category',
    subCategory: 'specific_subcategory',
    token
  }, logger);
};
```

### Error Resilience Patterns

```typescript
// Retry pattern cho service calls
const retryServiceCall = async <T>(
  serviceCall: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await serviceCall();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};
```

## Using Tools

### Desktop Commander for Service Testing

```bash
# Test upload service endpoints
mcp_desktop-comma_start_process "node -e \"
const { initializeMultipartUpload } = require('./dist/services/uploadService');
// Test upload initialization
initializeMultipartUpload({
  teamId: 'test',
  folderId: 'test',
  contentType: 'video/webm',
  token: 'test-token'
}).then(console.log).catch(console.error);
\""

# Test bot service status updates
mcp_desktop-comma_start_process "node -e \"
const { patchBotStatus } = require('./dist/services/botService');
// Test status update
patchBotStatus({
  botId: 'test-bot',
  provider: 'google',
  status: ['processing'],
  token: 'test-token'
}, console).then(console.log);
\""
```

### Context7 for HTTP Client Patterns

```typescript
// Get Axios patterns và best practices
mcp_context7_resolve-library-id "axios"
mcp_context7_get-library-docs "/axios/axios" "http client retry patterns error handling"

// Multipart upload patterns
mcp_context7_resolve-library-id "multipart upload"
mcp_context7_get-library-docs "/aws/aws-sdk-js-v3" "multipart upload streaming"
```

## Configuration & Setup

### API Client Setup

```typescript
// Authentication với service key
const apiV2 = createApiV2(bearerToken, serviceKey);

// Standard headers
const headers = {
  'Authorization': `Bearer ${bearerToken}`,
  'X-Service-Key': serviceKey,
  'Content-Type': 'application/json'
};
```

### Upload Configuration

```typescript
// Content type mapping
const getContentType = (format: string): ContentType => {
  switch (format) {
    case 'webm': return 'video/webm';
    case 'mp4': return 'video/mp4';
    default: return 'application/octet-stream';
  }
};

// Chunk size optimization
const OPTIMAL_CHUNK_SIZE = 2000; // 2 seconds for video
const MAX_PART_SIZE = 100 * 1024 * 1024; // 100MB per part
```

## Error Handling Strategies

### Service API Errors

```typescript
// Categorize API errors
const handleServiceError = (error: AxiosError, context: string) => {
  if (error.response?.status === 401) {
    throw new KnownError('Authentication failed', false);
  }
  
  if (error.response?.status === 429) {
    throw new KnownError('Rate limited', true, 3); // Retryable
  }
  
  if (error.response?.status >= 500) {
    throw new KnownError('Server error', true, 2); // Retryable
  }
  
  logger.error(`${context} failed:`, error.message, error.response?.data);
  throw error;
};
```

### Upload Failure Recovery

```typescript
// Resume interrupted uploads
const resumeUpload = async (uploadId: string, partNumber: number) => {
  try {
    // Check which parts were successfully uploaded
    const completedParts = await listUploadParts(uploadId);
    
    // Resume from last successful part
    const nextPartNumber = Math.max(...completedParts.map(p => p.partNumber)) + 1;
    return nextPartNumber;
  } catch (error) {
    logger.warn('Could not resume upload, starting fresh');
    return 1;
  }
};
```

## Integration Points

### With Recording System

```typescript
// Called from browser context
await (window as any).screenAppSendData(slightlySecretId, base64Chunk);

// Processed in Node.js context
page.exposeFunction('screenAppSendData', async (secretId: string, chunk: string) => {
  if (secretId !== expectedSecretId) return;
  
  const buffer = Buffer.from(chunk, 'base64');
  await uploadChunkToStorage({ uploadUrl, chunk: new Blob([buffer]) });
});
```

### With Bot Lifecycle

```typescript
// Status updates at key milestones
await patchBotStatus({ status: ['processing'] }); // Starting
await patchBotStatus({ status: ['processing', 'joined'] }); // Joined meeting
await patchBotStatus({ status: ['processing', 'joined', 'finished'] }); // Completed
```

## Monitoring & Debugging

### Upload Progress Tracking

```typescript
// Track upload metrics
const uploadMetrics = {
  totalChunks: 0,
  uploadedChunks: 0,
  failedChunks: 0,
  bytesUploaded: 0
};

// Log progress periodically
if (uploadMetrics.totalChunks % 10 === 0) {
  logger.info('Upload progress:', {
    progress: `${uploadMetrics.uploadedChunks}/${uploadMetrics.totalChunks}`,
    bytes: uploadMetrics.bytesUploaded
  });
}
```

### Service Health Monitoring

```typescript
// Health check cho external services
const checkServiceHealth = async (): Promise<boolean> => {
  try {
    await apiV2.get('/health');
    return true;
  } catch (error) {
    logger.error('Service health check failed:', error.message);
    return false;
  }
};
```

## Common Tasks

1. **Add new upload destination**: Implement new upload service methods
2. **Extend bot status types**: Add new BotStatus enum values
3. **Improve error handling**: Add retry logic cho specific errors
4. **Monitor service health**: Add health checks và circuit breakers
5. **Debug upload issues**: Add detailed logging cho upload steps
6. **Optimize upload performance**: Adjust chunk sizes và concurrency
