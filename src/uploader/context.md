# Meeting Bot - Upload Layer

## Overview

The `uploader/` directory contains storage-specific upload implementations that handle cloud storage operations for different S3-compatible providers. This layer abstracts storage operations and provides unified interfaces for file uploads.

## Directory Structure

```
uploader/
├── s3-compatible-storage.ts    # S3-compatible storage operations
└── context.md                  # This file
```

## Key Components

### S3-Compatible Storage (`s3-compatible-storage.ts`)

**Purpose**: Unified interface for S3-compatible cloud storage operations

**Key Features**:

- **Multi-Provider Support**: AWS S3, Google Cloud Storage, MinIO
- **Multipart Upload**: Large file chunked upload support
- **Error Handling**: Comprehensive error handling and recovery
- **Progress Monitoring**: Real-time upload progress tracking

## Storage Providers

### 1. AWS S3

**Configuration**:

```typescript
const awsConfig = {
  endpoint: 'https://s3.amazonaws.com',
  region: 'us-west-2',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  bucket: 'meeting-recordings',
  forcePathStyle: false,
};
```

**Features**:

- Native AWS S3 API integration
- Region-specific endpoints
- IAM authentication
- Standard S3 path structure

### 2. Google Cloud Storage

**Configuration**:

```typescript
const gcpConfig = {
  endpoint: 'https://storage.googleapis.com',
  region: 'us-west1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  bucket: 'meeting-recordings',
  forcePathStyle: true,
};
```

**Features**:

- S3-compatible API for GCP
- HMAC authentication
- Global CDN integration
- Multi-region replication

### 3. MinIO (Self-hosted)

**Configuration**:

```typescript
const minioConfig = {
  endpoint: 'http://localhost:9000',
  region: 'us-west-2',
  credentials: {
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
  },
  bucket: 'meeting-recordings',
  forcePathStyle: true,
};
```

**Features**:

- Self-hosted S3-compatible storage
- Custom endpoint configuration
- Local network optimization
- Cost-effective for high-volume storage

## Upload Operations

### Core Functions

#### `uploadMultipartS3()`

**Purpose**: Execute multipart upload to S3-compatible storage

**Parameters**:

```typescript
interface UploadParams {
  filePath: string;
  bucket: string;
  key: string;
  contentType: string;
  metadata?: Record<string, string>;
}
```

**Process Flow**:

```typescript
1. Initialize multipart upload
2. Split file into 50MB chunks
3. Upload chunks in parallel
4. Collect ETags for each chunk
5. Complete multipart upload
6. Verify upload integrity
```

#### `initializeMultipartUpload()`

**Purpose**: Create multipart upload session

**Returns**: Upload ID and initial configuration

#### `uploadPart()`

**Purpose**: Upload individual file chunk

**Features**:

- Concurrent chunk uploads
- Progress tracking per chunk
- Automatic retry on failure
- Memory-efficient streaming

#### `completeMultipartUpload()`

**Purpose**: Finalize multipart upload

**Parameters**:

- Upload ID
- Array of uploaded parts with ETags
- Complete multipart request

## Error Handling

### Storage-Specific Errors

- **NoSuchBucket**: Target bucket doesn't exist
- **AccessDenied**: Insufficient permissions
- **InvalidBucketName**: Malformed bucket name
- **NoSuchUpload**: Upload session expired
- **EntityTooLarge**: File exceeds size limits

### Network Errors

- **Timeout**: Connection or request timeout
- **NetworkFailure**: Network connectivity issues
- **DNSResolution**: Domain name resolution failure
- **SSLVerification**: SSL certificate validation failure

### Recovery Strategies

- **Automatic Retry**: Exponential backoff retry logic
- **Chunk Retry**: Individual chunk failure recovery
- **Session Recovery**: Multipart upload session restoration
- **Alternative Endpoints**: Fallback endpoint usage

## Performance Optimization

### Upload Optimization

- **Chunk Size**: 50MB optimal chunk size
- **Parallel Uploads**: Concurrent chunk processing
- **Connection Pooling**: HTTP connection reuse
- **Bandwidth Management**: Upload throttling

### Monitoring

- **Upload Progress**: Real-time progress tracking
- **Transfer Rates**: Upload speed monitoring
- **Error Rates**: Failed upload percentage
- **Resource Usage**: Memory and network utilization

## Security Considerations

### Authentication

- **Access Keys**: Secure credential management
- **Signature Calculation**: AWS V4 signature implementation
- **Token Rotation**: Regular credential rotation
- **Least Privilege**: Minimal required permissions

### Data Protection

- **Encryption**: Data encrypted in transit (HTTPS)
- **Integrity**: MD5/SHA256 checksum verification
- **Access Control**: Bucket and object-level permissions
- **Audit Logging**: Upload operation logging

## Configuration

### Environment Variables

```bash
# Storage Configuration
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=meeting-recordings
S3_REGION=us-west-2
S3_USE_MINIO_COMPATIBILITY=false

# Upload Settings
UPLOAD_CHUNK_SIZE=52428800  # 50MB in bytes
MAX_UPLOAD_RETRIES=3
UPLOAD_TIMEOUT=300000       # 5 minutes
```

### Client Configuration

```typescript
const s3Client = new S3Client({
  region: config.region,
  endpoint: config.endpoint,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },
  forcePathStyle: config.forcePathStyle,
});
```

## Integration Points

### Middleware Integration

- **DiskUploader**: Primary consumer of upload functionality
- **Upload Coordination**: Multipart upload orchestration
- **Error Propagation**: Upload failures handled gracefully

### Service Integration

- **Upload Service**: High-level upload coordination
- **Storage Abstraction**: Provider-agnostic storage interface
- **Progress Reporting**: Upload status and progress updates

## Development & Testing

### Testing Strategy

- **Unit Tests**: Individual upload function testing
- **Integration Tests**: Full upload pipeline testing
- **Provider Tests**: Multi-provider compatibility testing
- **Error Simulation**: Network and storage failure testing

### Mock Storage

```typescript
const mockStorage = {
  uploadMultipartS3: jest.fn().mockResolvedValue({
    success: true,
    key: 'test-recording.webm',
  }),
};
```

### Debugging Support

- **Request Logging**: Detailed S3 API request/response logging
- **Progress Tracking**: Chunk-level upload progress
- **Error Context**: Rich error information with context
- **Network Tracing**: HTTP request/response monitoring

## Deployment Considerations

### Provider Selection

- **AWS S3**: Production-grade, global infrastructure
- **GCP Cloud Storage**: Google ecosystem integration
- **MinIO**: Cost-effective, self-hosted solution

### Cost Optimization

- **Storage Classes**: Appropriate storage tier selection
- **Data Transfer**: Minimize cross-region transfers
- **Lifecycle Policies**: Automatic data lifecycle management
- **Compression**: File compression before upload

### Scalability

- **Concurrent Uploads**: Multiple simultaneous uploads
- **Load Balancing**: Upload distribution across regions
- **Queue Management**: Upload job queuing and prioritization
- **Resource Scaling**: Dynamic resource allocation

## Monitoring & Observability

### Upload Metrics

- **Upload Success Rate**: Percentage of successful uploads
- **Upload Duration**: Average upload completion time
- **Chunk Failure Rate**: Failed chunk upload percentage
- **Bandwidth Utilization**: Network usage monitoring

### Storage Metrics

- **Storage Usage**: Total storage consumption
- **Object Count**: Number of stored objects
- **Access Patterns**: Object access frequency
- **Cost Tracking**: Storage and transfer costs

---

_For middleware implementation details, see the `middleware/` directory context. For service layer details, see the `services/` directory context._
