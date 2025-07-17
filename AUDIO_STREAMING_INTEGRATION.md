# Audio Streaming Integration Guide

## Overview

The Google Meet Bot now includes integrated audio streaming capabilities that automatically send meeting audio to the SecureScribe Audio Streaming API in real-time. This enables real-time transcription, audio analysis, and processing while maintaining the existing video recording functionality.

## Features

- 🎵 **Dual Recording**: Simultaneous video recording (for ScreenApp) and audio streaming (for SecureScribe)
- 🔗 **Real-time Streaming**: Audio chunks are streamed immediately to SecureScribe API
- 🎛️ **Configurable Settings**: Customizable sample rates, channels, formats, and chunk sizes
- 🔄 **Session Management**: Automatic session creation and cleanup
- 📊 **Error Handling**: Comprehensive error handling and logging
- ⚡ **Performance Optimized**: Separate recorders for optimal performance

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```env
# Enable audio streaming
ENABLE_AUDIO_STREAMING=true

# SecureScribe API endpoint
AUDIO_STREAMING_WS_ENDPOINT=ws://localhost:8000/api/ws/audio

# Audio configuration
AUDIO_SAMPLE_RATE=44100    # Options: 8000, 16000, 22050, 44100, 48000, 96000
AUDIO_CHANNELS=1           # Options: 1 (mono), 2 (stereo)
AUDIO_FORMAT=wav           # Options: wav, mp3, flac, aac
AUDIO_CHUNK_DURATION=1000  # Milliseconds between audio chunks
```

### Default Values

If not specified, the system uses these defaults:
- **Sample Rate**: 44100 Hz (CD quality)
- **Channels**: 1 (mono)
- **Format**: wav
- **Chunk Duration**: 1000ms (1 second)

## Architecture

### Recording Flow

```
Google Meet → MediaRecorder (Video) → ScreenApp Upload Service
            ↘ MediaRecorder (Audio) → SecureScribe WebSocket API
```

### Key Components

1. **Video Recording**: Continues to work as before, sending video chunks to ScreenApp
2. **Audio Recording**: New separate recorder that streams audio to SecureScribe
3. **Session Management**: Automatic creation and management of SecureScribe sessions
4. **Error Handling**: Graceful degradation if audio streaming fails

## Usage

### Starting a Recording with Audio Streaming

The audio streaming is automatically enabled when you start a recording if `ENABLE_AUDIO_STREAMING=true`:

```bash
curl -X POST http://localhost:3000/google/join \
  -H "Content-Type: application/json" \
  -d '{
    "bearerToken": "your-token",
    "url": "meet.google.com/abc-defg-hij",
    "name": "Bot Name",
    "teamId": "team123",
    "timezone": "UTC",
    "userId": "user123",
    "botId": "bot123"
  }'
```

### Monitoring Audio Streaming

The bot logs will show audio streaming status:

```
[INFO] Audio streaming WebSocket connected
[INFO] Audio session created: {sessionId}
[INFO] Started audio recording with 1000ms chunks
[INFO] Audio streaming session closed
```

## Technical Implementation

### Separate Media Recorders

The system uses two separate `MediaRecorder` instances:

1. **Video Recorder**: 
   - Format: `video/webm` with H.264 codec
   - Chunk Duration: 2000ms
   - Destination: ScreenApp upload service

2. **Audio Recorder**:
   - Format: `audio/webm` with Opus codec (preferred) or `audio/wav`
   - Chunk Duration: Configurable (default 1000ms)
   - Destination: SecureScribe WebSocket API

### WebSocket Connection Management

```typescript
// Automatic connection creation
audioStreamSessionId = await connectToAudioStream(audioSessionId);

// Chunk streaming
await sendAudioChunk(base64AudioData);

// Graceful closure
await closeAudioStream();
```

### Error Handling

The system includes comprehensive error handling:

- **Connection Failures**: Continues video recording if audio streaming fails
- **Chunk Upload Errors**: Logs errors but continues operation
- **Session Management**: Automatic cleanup on recording end
- **Graceful Degradation**: Video recording is not affected by audio streaming issues

## Audio Processing Details

### Supported Audio Formats

**Input Processing**:
- Source: Browser MediaRecorder API
- Primary: `audio/webm; codecs=opus`
- Fallback: `audio/webm` (default)
- Alternative: `audio/wav`

**SecureScribe Processing**:
- Automatic conversion to WAV format
- FFmpeg-based concatenation
- Persistent storage with session IDs

### Sample Rate Options

- **8000 Hz**: Telephone quality (minimal bandwidth)
- **16000 Hz**: Wide band speech (good for voice)
- **22050 Hz**: Radio quality
- **44100 Hz**: CD quality (default, recommended)
- **48000 Hz**: Professional audio
- **96000 Hz**: High-resolution audio (high bandwidth)

### Channel Configuration

- **Mono (1 channel)**: Default, efficient for speech
- **Stereo (2 channels)**: Better spatial audio, larger bandwidth

## Performance Considerations

### Bandwidth Usage

- **Audio streaming**: ~64-128 kbps (depending on quality settings)
- **Video recording**: ~1-3 Mbps (existing)
- **Total**: Minimal additional bandwidth overhead

### Processing Overhead

- **Separate recorders**: Minimal CPU overhead
- **Real-time streaming**: Asynchronous, non-blocking
- **Error handling**: Lightweight, logging-based

### Memory Usage

- **Chunk-based processing**: Minimal memory footprint
- **No local storage**: Audio chunks stream directly
- **Automatic cleanup**: Resources freed on completion

## Troubleshooting

### Common Issues

1. **Audio Streaming Connection Failed**
   ```
   [ERROR] Failed to connect to audio streaming service
   ```
   - Check `AUDIO_STREAMING_WS_ENDPOINT` configuration
   - Verify SecureScribe API is running and accessible
   - Check network connectivity

2. **Audio Chunks Not Sending**
   ```
   [WARN] Failed to send audio chunk to SecureScribe API
   ```
   - Check WebSocket connection status
   - Verify audio recorder is producing data
   - Monitor network stability

3. **Session Creation Failed**
   ```
   [ERROR] Audio streaming WebSocket error
   ```
   - Verify API endpoint URL format
   - Check authentication if required
   - Review SecureScribe API logs

### Debug Commands

```bash
# Check configuration
curl http://localhost:3000/isbusy

# Monitor logs
docker-compose logs -f app

# Test WebSocket connection manually
wscat -c ws://localhost:8000/api/ws/audio?user_id=test&sample_rate=44100&channels=1
```

### Environment Validation

Ensure these environment variables are properly set:

```bash
echo $ENABLE_AUDIO_STREAMING
echo $AUDIO_STREAMING_WS_ENDPOINT
echo $AUDIO_SAMPLE_RATE
echo $AUDIO_CHANNELS
```

## Integration Examples

### Docker Compose Setup

```yaml
version: '3.8'
services:
  meeting-bot:
    build: .
    environment:
      - ENABLE_AUDIO_STREAMING=true
      - AUDIO_STREAMING_WS_ENDPOINT=ws://securescribe:8000/api/ws/audio
      - AUDIO_SAMPLE_RATE=44100
      - AUDIO_CHANNELS=1
    networks:
      - app-network

  securescribe:
    image: securescribe/api:latest
    ports:
      - "8000:8000"
    networks:
      - app-network

networks:
  app-network:
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: meeting-bot
spec:
  template:
    spec:
      containers:
      - name: meeting-bot
        image: meeting-bot:latest
        env:
        - name: ENABLE_AUDIO_STREAMING
          value: "true"
        - name: AUDIO_STREAMING_WS_ENDPOINT
          value: "ws://securescribe-service:8000/api/ws/audio"
        - name: AUDIO_SAMPLE_RATE
          value: "44100"
        - name: AUDIO_CHANNELS
          value: "1"
```

## Security Considerations

### Data Privacy

- **Real-time Streaming**: Audio data is streamed directly to SecureScribe
- **No Local Storage**: Audio chunks are not stored locally
- **Session Isolation**: Each recording has a unique session ID
- **Automatic Cleanup**: Sessions are closed when recording ends

### Network Security

- **WebSocket Security**: Use `wss://` for production environments
- **Authentication**: Implement proper API authentication
- **Access Control**: Restrict API access to authorized systems
- **Monitoring**: Log all audio streaming activities

## Monitoring and Observability

### Metrics to Monitor

- **Audio Streaming Success Rate**: Percentage of successful chunk uploads
- **Session Duration**: Total duration of audio streaming sessions
- **Connection Stability**: WebSocket connection uptime
- **Error Rates**: Failed connections and chunk upload errors

### Log Patterns

```javascript
// Successful audio streaming
[INFO] Audio streaming WebSocket connected {userId, teamId, sessionId}
[INFO] Audio session created {sessionId, userId, teamId}
[INFO] Started audio recording with {chunkDuration}ms chunks

// Error scenarios
[ERROR] Audio streaming WebSocket error {error, userId, teamId}
[ERROR] Failed to send audio chunk {error, userId, teamId}
[WARN] Failed to send audio chunk to SecureScribe API
```

## Future Enhancements

### Planned Features

1. **Adaptive Quality**: Automatic quality adjustment based on network conditions
2. **Compression Options**: Configurable audio compression for bandwidth optimization
3. **Failover Support**: Multiple SecureScribe endpoints for redundancy
4. **Real-time Transcription**: Direct integration with transcription services
5. **Audio Analysis**: Real-time speaker detection and sentiment analysis

### Integration Opportunities

- **Speech-to-Text**: Real-time transcription integration
- **Voice Analytics**: Speaker identification and emotion detection
- **Meeting Intelligence**: Automatic summary and insights generation
- **Compliance Recording**: Legal and compliance audio archiving