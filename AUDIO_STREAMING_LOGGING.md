# Audio Streaming Logging Guide

## Overview
The RecordingTask now includes comprehensive console logging to track audio streaming to SecureScribe WebSocket API. All audio-related operations are logged with emoji prefixes for easy identification.

## Logging Categories

### 🎵 Connection & Setup
- **🔇** Audio streaming disabled messages
- **🎵** Audio streaming initialization
- **🔗** WebSocket endpoint information
- **📋** Session details (new/existing)
- **👤** User and team identification
- **⚙️** Audio configuration (sample rate, channels, format)
- **🚀** WebSocket connection attempts

### ✅❌ Connection Status
- **✅** Successful WebSocket connections
- **❌** WebSocket connection failures
- **📡** Connected endpoint details
- **🔌** Connection close events
- **⏰** Connection timeouts

### 📤📩 Data Transmission
- **🎧** Audio chunk processing
- **📊** Data size information
- **🔄** Base64 conversion steps
- **📤** Chunk transmission to SecureScribe
- **📩** WebSocket message reception
- **🔑** Session ID assignment

### 🎙️📹 Recording Management
- **🎙️** Audio recorder setup and configuration
- **📹** Video recorder operations
- **⏱️** Chunk duration settings
- **🔧** MediaRecorder configuration
- **🛑** Recording stop triggers
- **🔇** Track stopping

### ⚠️ℹ️ Status & Warnings
- **⚠️** Warning conditions (empty chunks, connection issues)
- **ℹ️** Informational messages
- **💥** Critical failures
- **🚨** Error conditions

## Key Logging Points

### Audio Streaming Connection
```
🎵 Starting audio streaming connection...
📋 Session ID: new session
👤 User ID: user123
🏢 Team ID: team456
🆕 Creating new session: ws://localhost:8000/api/ws/audio?user_id=user123&sample_rate=16000&channels=1&format=pcm
⚙️ Audio config: 16000Hz, 1ch, pcm
🚀 Initializing WebSocket connection...
✅ WebSocket connection established successfully
```

### Audio Chunk Processing
```
🎵 Audio chunk received from MediaRecorder - Size: 2048 bytes, Type: audio/webm
🔄 Converted blob to ArrayBuffer - Size: 2048 bytes
🎧 Processing audio chunk - Size: 2048 bytes
📊 Base64 audio size: 2731 characters
📤 Sending audio chunk to SecureScribe...
🎧 Sending audio chunk - Size: 2048 bytes
✅ Audio chunk sent successfully
✅ Audio chunk sent successfully to SecureScribe
```

### Recording Stop
```
🛑 -------- TRIGGER stop the recording
📹 Stopping video MediaRecorder...
🎙️ Stopping audio MediaRecorder...
✅ Audio recording stopped for SecureScribe
🔌 Stopping all media tracks...
🔇 Stopping audio track
🔇 Stopping video track
🔚 Closing audio streaming connection...
📤 Sending close message to SecureScribe
✅ Close message sent
🔌 Closing WebSocket connection
✅ Audio streaming session closed successfully
✅ SecureScribe audio streaming connection closed successfully
```

## Error Scenarios

### Connection Failures
```
🚨 Failed to connect to audio streaming service: Error: Connection refused
❌ Audio streaming WebSocket error: ECONNREFUSED
⏰ WebSocket connection timeout (5s)
```

### Transmission Issues
```
⚠️ Cannot send audio chunk - WebSocket not ready
WebSocket state: exists, readyState: 3
❌ Failed to send audio chunk: Error: WebSocket is closed
⚠️ Failed to send audio chunk to SecureScribe API - sendAudioChunk returned false
```

### Configuration Issues
```
🔇 Audio streaming is disabled in configuration
🔇 Audio streaming disabled - skipping chunk
⚠️ Audio streaming enabled but no session ID found
```

## Usage for Debugging

### Checking Audio Flow
1. Look for **🎵** messages to verify connection establishment
2. Monitor **🎧** messages to confirm chunk processing
3. Watch for **✅** confirmations of successful transmission
4. Check **⚠️** and **❌** for any issues

### Verifying WebSocket Communication
1. **📡** shows successful connection with endpoint
2. **📤** and **📩** indicate bidirectional communication
3. **🔑** confirms session establishment
4. **🔌** tracks connection lifecycle

### Performance Monitoring
- Chunk sizes are logged for both audio and base64 formats
- Timing information available through chunk intervals
- Connection status changes are immediately visible
- Error conditions provide detailed context

## Configuration Validation
The logging will immediately show if:
- Audio streaming is enabled/disabled
- WebSocket endpoint is reachable
- Audio configuration is being applied
- Session management is working correctly

All console output uses descriptive emojis and clear text to make debugging the audio streaming integration straightforward.
