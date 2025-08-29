# Meeting Bot - Middleware Layer

## Overview

The `middleware/` directory contains Express.js middleware and core upload functionality that handles file storage, processing, and cloud upload operations for meeting recordings.

## Directory Structure

```
middleware/
├── disk-uploader.ts      # Core upload functionality and file management
└── context.md           # This file
```

## Key Components

### Disk Uploader (`disk-uploader.ts`)

**Purpose**: Comprehensive file upload system with local storage and cloud integration

**Key Features**:

- **Dual Storage**: Local temporary storage + cloud upload
- **Multipart Upload**: Large file chunked upload support
- **Progress Tracking**: Real-time upload progress monitoring
- **Error Recovery**: Automatic retry and recovery mechanisms
- **Resource Cleanup**: Automatic temporary file management

## Architecture

### Upload Pipeline

```
Recording File → Local Storage → Chunking → Cloud Upload → Verification → Cleanup
```

### Core Classes

#### `DiskUploader` Class

**Purpose**: Main upload coordinator implementing `IUploader` interface

**Key Methods**:

```typescript
interface IUploader {
  uploadRecordingToRemoteStorage(options?: { forceUpload?: boolean }): Promise<boolean>;
  saveDataToTempFile(data: Buffer): Promise<boolean>;
}
```

### Upload Process Flow

#### 1. File Reception

- **Data Streaming**: Recording data received in chunks
- **Buffer Management**: Efficient memory buffer handling
- **Temporary Storage**: Local file system storage during recording

#### 2. File Processing

- **Format Conversion**: WebM/MP4/MKV format handling
- **Metadata Extraction**: File size, duration, format information
- **Integrity Checks**: File corruption detection

#### 3. Cloud Upload

- **Storage Detection**: AWS S3, GCP, MinIO compatibility
- **Authentication**: Access key and secret management
- **Region Handling**: Multi-region storage support

#### 4. Verification & Cleanup

- **Upload Verification**: File integrity and accessibility checks
- **Local Cleanup**: Temporary file removal
- **Error Handling**: Failed upload recovery

## Configuration

### Environment Variables

```bash
# Storage Configuration
S3_ENDPOINT=https://s3.amazonaws.com          # S3-compatible endpoint
S3_ACCESS_KEY_ID=your-access-key              # Storage access key
S3_SECRET_ACCESS_KEY=your-secret-key          # Storage secret key
S3_BUCKET_NAME=meeting-recordings             # Target bucket
S3_REGION=us-west-2                          # AWS region
S3_USE_MINIO_COMPATIBILITY=true              # MinIO support

# Upload Settings
UPLOADER_FILE_EXTENSION=.webm                # Recording format
MAX_RECORDING_DURATION_MINUTES=60            # Recording limit
```

### Runtime Configuration

```typescript
const config = {
  uploaderFileExtension: '.webm',
  s3CompatibleStorage: {
    endpoint: process.env.S3_ENDPOINT,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    bucket: process.env.S3_BUCKET_NAME,
    region: process.env.S3_REGION,
    forcePathStyle: process.env.S3_USE_MINIO_COMPATIBILITY === 'true',
  },
};
```

## Upload Strategies

### 1. Local-First Upload

- **Temporary Storage**: Files stored locally during recording
- **Background Upload**: Cloud upload happens asynchronously
- **Cleanup**: Local files removed after successful upload

### 2. Direct Streaming Upload

- **Memory Buffer**: Small recordings kept in memory
- **Direct Transfer**: Immediate cloud upload without local storage
- **Resource Efficiency**: Reduced disk I/O for small files

### 3. Multipart Upload

- **Chunk Size**: 50MB chunks for large files
- **Parallel Upload**: Concurrent chunk uploading
- **Resume Support**: Failed upload resumption

## Error Handling

### Upload Error Types

- **NoSuchUpload**: Upload session expired or corrupted
- **Network Errors**: Connectivity issues during upload
- **Authentication Errors**: Invalid storage credentials
- **Quota Errors**: Storage quota exceeded
- **Permission Errors**: Insufficient bucket permissions

### Recovery Mechanisms

- **Automatic Retry**: Configurable retry attempts (max 3)
- **Exponential Backoff**: Increasing delays between retries
- **Chunk Retry**: Individual chunk failure recovery
- **Session Recovery**: Multipart upload session restoration

### Error Classification

```typescript
function isNoSuchUploadError(err: any, userId: string, logger: Logger): boolean {
  const xml = err?.response?.data || err?.data || '';
  const isNoSuchUpload = typeof xml === 'string' && xml?.includes('NoSuchUpload');

  if (isNoSuchUpload) {
    logger.error('Critical: NoSuchUpload error', { userId, status, code });
  }

  return isNoSuchUpload;
}
```

## Storage Providers

### AWS S3

```bash
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-west-2
```

### Google Cloud Storage

```bash
S3_ENDPOINT=https://storage.googleapis.com
S3_REGION=us-west1
```

### MinIO (Self-hosted)

```bash
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-west-2
S3_USE_MINIO_COMPATIBILITY=true
```

## Performance Optimization

### Chunk Management

- **Optimal Size**: 50MB chunks balance speed and reliability
- **Parallel Processing**: Multiple chunks uploaded simultaneously
- **Memory Limits**: Controlled memory usage during chunking

### Resource Management

- **File Handles**: Proper file descriptor management
- **Memory Buffers**: Efficient buffer allocation and cleanup
- **Network Connections**: Connection pooling and reuse

### Monitoring

- **Upload Progress**: Real-time progress tracking
- **Transfer Rates**: Upload speed monitoring
- **Error Rates**: Failed upload percentage tracking

## Integration Points

### Recording Integration

- **RecordingTask**: Provides data stream for upload
- **Format Handling**: WebM/MP4/MKV format support
- **Metadata**: File size, duration, quality information

### Service Integration

- **Upload Service**: Multipart upload coordination
- **Storage Service**: Cloud storage abstraction
- **Bot Service**: Upload status reporting

### JobStore Integration

- **Background Processing**: Upload happens outside main job flow
- **Status Updates**: Upload completion status reporting
- **Error Propagation**: Upload failures handled gracefully

## Security Considerations

### Data Protection

- **Encryption**: Data encrypted during transfer
- **Access Control**: Storage bucket permission management
- **Credential Security**: Secure credential storage and rotation

### Privacy

- **Data Minimization**: Only necessary metadata stored
- **Access Logging**: Upload access audit trails
- **Retention Policies**: Configurable data retention

## Development & Testing

### Testing Strategy

- **Unit Tests**: Individual upload component testing
- **Integration Tests**: Full upload pipeline testing
- **Mock Storage**: Simulated storage backend for testing
- **Error Simulation**: Network failure and storage error testing

### Debugging Support

- **Upload Logs**: Detailed upload progress logging
- **File Inspection**: Temporary file content verification
- **Network Tracing**: Upload request/response monitoring
- **Performance Profiling**: Upload bottleneck identification

## Deployment Considerations

### Environment Configuration

- **Development**: Local storage with mock cloud uploads
- **Staging**: Full cloud integration with monitoring
- **Production**: Optimized settings with enhanced security

### Scalability

- **Concurrent Uploads**: Multiple simultaneous uploads
- **Storage Distribution**: Multi-region storage support
- **Load Balancing**: Upload request distribution

### Cost Optimization

- **Storage Classes**: Appropriate storage tier selection
- **Data Transfer**: Minimize unnecessary data movement
- **Cleanup Policies**: Automatic temporary file removal

---

_For service layer details, see the `services/` directory context. For storage implementation, see the `uploader/` directory context._
