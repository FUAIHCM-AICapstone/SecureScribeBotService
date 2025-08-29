# Meeting Bot - Redis Integration Layer

## Overview

The `connect/` directory handles Redis connectivity and message queue processing for asynchronous meeting requests. This layer enables high-throughput meeting processing through Redis pub/sub and queue operations.

## Directory Structure

```
connect/
├── messageBroker.ts         # Redis connection and basic operations
├── RedisConsumerService.ts  # Asynchronous message processing
├── RedisMessageBroker.ts   # Advanced Redis message operations
└── context.md              # This file
```

## Architecture

### Redis Integration Strategy

- **Dual Input Methods**: REST API + Redis message queue
- **Asynchronous Processing**: High-throughput meeting requests
- **Single Job Execution**: Redis respects JobStore busy status
- **Graceful Shutdown**: Proper Redis connection cleanup

## Key Components

### 1. Message Broker (`messageBroker.ts`)

**Purpose**: Core Redis connection management and basic operations

**Key Features**:

- **Connection Management**: Redis client initialization and health checks
- **Basic Operations**: GET, SET, RPUSH, BLPOP operations
- **Connection Monitoring**: Connection status and reconnection handling
- **Graceful Shutdown**: Clean Redis client disconnection

**Connection Configuration**:

```typescript
const redisUri = constructRedisUri(); // redis://username:password@host:port
const client = new Redis(redisUri);
```

**Core Operations**:

- `getMeetingbotJobsWithTimeout()`: BLPOP with timeout
- `returnMeetingbotJobs()`: RPUSH for message return
- `isConnected()`: Connection health check
- `quitClientGracefully()`: Clean shutdown

### 2. Redis Consumer Service (`RedisConsumerService.ts`)

**Purpose**: Asynchronous message processing from Redis queue

**Key Features**:

- **Message Loop**: Continuous message processing
- **JobStore Integration**: Respects single-job execution constraint
- **Error Handling**: Robust error handling with reconnection
- **Graceful Shutdown**: Controlled service shutdown

**Processing Flow**:

```typescript
1. Check JobStore availability (prevents race conditions)
2. BLPOP message from Redis queue with timeout
3. Parse message to MeetingJoinRedisParams
4. Create correlation ID and logger
5. Add job to JobStore for processing
6. Handle job acceptance/rejection
7. Process next message
```

**Race Condition Prevention**:

- **Pre-check**: Verify JobStore availability before getting messages
- **Message Return**: Return messages to queue if JobStore rejects
- **Duplicate Prevention**: Single-job execution prevents conflicts

### 3. Redis Message Broker (`RedisMessageBroker.ts`)

**Purpose**: Advanced Redis operations and message management

**Key Features**:

- **Message Serialization**: JSON message handling
- **Queue Management**: Advanced queue operations
- **Batch Processing**: Multiple message operations
- **Monitoring**: Queue depth and performance metrics

## Message Processing Pipeline

### Redis Message Format

```typescript
interface MeetingJoinRedisParams {
  url: string;
  name: string;
  teamId: string;
  userId: string;
  bearerToken: string;
  timezone: string;
  botId?: string;
  eventId?: string;
  provider: 'google' | 'microsoft' | 'zoom'; // Required for Redis
}
```

### Message Flow

1. **Message Queued**: Client adds message via RPUSH
2. **Consumer Processing**: RedisConsumerService processes messages
3. **Validation**: Message format and required fields validation
4. **Job Creation**: Message converted to JobStore task
5. **Platform Routing**: Routed to appropriate bot implementation
6. **Processing**: Meeting join and recording execution
7. **Completion**: Job completion and cleanup

## Configuration

### Environment Variables

```bash
REDIS_HOST=redis              # Redis server hostname
REDIS_PORT=6379               # Redis server port
REDIS_USERNAME=               # Redis username (optional)
REDIS_PASSWORD=               # Redis password (optional)
REDIS_QUEUE_NAME=jobs:meetbot:list  # Queue name
REDIS_CONSUMER_ENABLED=true   # Enable Redis processing
```

### Redis URI Construction

```typescript
const constructRedisUri = () => {
  if (username && password) {
    return `redis://${username}:${password}@${host}:${port}`;
  } else if (password) {
    return `redis://:${password}@${host}:${port}`;
  } else {
    return `redis://${host}:${port}`;
  }
};
```

## Error Handling & Recovery

### Connection Issues

- **Reconnection Logic**: Automatic reconnection on connection loss
- **Exponential Backoff**: Increasing delays between reconnection attempts
- **Connection Monitoring**: Health checks and status reporting

### Message Processing Errors

- **Parse Errors**: Invalid JSON message handling
- **Validation Errors**: Missing required fields
- **Job Rejection**: JobStore busy status handling
- **Processing Errors**: Bot execution failures

### Graceful Shutdown

- **Shutdown Signaling**: Controlled shutdown initiation
- **Message Preservation**: Unprocessed messages remain in queue
- **Clean Disconnection**: Proper Redis client cleanup

## Performance Considerations

### Queue Operations

- **BLPOP Timeout**: 10-second timeout for message retrieval
- **Non-blocking**: Consumer doesn't block on empty queue
- **Fair Queuing**: FIFO message processing

### Scalability

- **Multiple Consumers**: Multiple instances can process different queues
- **Load Distribution**: Redis clustering support
- **Resource Limits**: Configurable connection pools

### Monitoring

- **Queue Depth**: Monitor pending message count
- **Processing Rate**: Messages processed per time unit
- **Error Rates**: Failed message processing rates

## Integration Patterns

### API vs Redis Processing

- **REST API**: Synchronous response, immediate feedback
- **Redis Queue**: Asynchronous processing, better scalability
- **Consistent Logic**: Same processing pipeline for both methods

### JobStore Coordination

- **Busy Status Check**: Prevents queue processing when system busy
- **Race Prevention**: Atomic job acceptance checking
- **Status Synchronization**: Consistent state across processing methods

## Development & Testing

### Local Development

- **Redis Docker**: `docker run -d -p 6379:6379 redis:alpine`
- **Connection Testing**: Basic connectivity verification
- **Message Injection**: Manual message insertion for testing

### Testing Strategy

- **Unit Tests**: Individual component testing
- **Integration Tests**: Full Redis pipeline testing
- **Load Testing**: High-throughput message processing
- **Error Simulation**: Network failure and reconnection testing

### Debugging

- **Message Inspection**: Queue content examination
- **Processing Logs**: Detailed processing flow logging
- **Correlation IDs**: Request tracing across components
- **Performance Metrics**: Queue depth and processing rates

## Security Considerations

### Authentication

- **Redis Password**: Secure password authentication
- **Username Support**: Optional username authentication
- **Connection Encryption**: TLS/SSL support consideration

### Data Protection

- **Message Encryption**: Sensitive data encryption at rest
- **Access Control**: Redis instance access restrictions
- **Audit Logging**: Message processing audit trails

## Deployment Patterns

### Docker Integration

```yaml
services:
  meeting-bot:
    depends_on:
      - redis
    environment:
      - REDIS_HOST=redis
      - REDIS_CONSUMER_ENABLED=true

  redis:
    image: redis:alpine
    ports:
      - '6379:6379'
```

### Production Considerations

- **Redis Clustering**: High availability Redis setup
- **Persistence**: Redis data persistence configuration
- **Backup**: Queue message backup strategies
- **Monitoring**: Redis performance and health monitoring

## Troubleshooting

### Common Issues

- **Connection Failures**: Network connectivity problems
- **Message Loss**: Queue overflow or processing failures
- **Race Conditions**: Concurrent processing conflicts
- **Memory Issues**: Redis memory usage problems

### Diagnostic Tools

- **Redis CLI**: Direct Redis command execution
- `redis-cli LLEN jobs:meetbot:list` - Check queue length
- `redis-cli PING` - Test connectivity
- `redis-cli INFO` - Redis server information

---

_For API layer details, see the `app/` directory context. For core infrastructure, see the `lib/` directory context._
