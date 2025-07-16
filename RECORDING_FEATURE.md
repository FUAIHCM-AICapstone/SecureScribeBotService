# Google Meet Bot Recording Feature

## Tổng quan

Google Meet Bot Recording Feature là một hệ thống tự động ghi lại cuộc họp Google Meet thông qua việc sử dụng browser automation (Playwright) và MediaRecorder API. Bot sẽ tự động tham gia cuộc họp, ghi lại video/audio, và upload file lên cloud storage.

## Cách thức hoạt động

### 1. Quy trình tham gia cuộc họp (`GoogleMeetBot.ts`)

```
Khởi tạo → Tham gia → Ghi lại → Upload → Kết thúc
```

#### A. Khởi tạo Browser
- Sử dụng Playwright Chromium với stealth plugin
- Cấu hình permissions cho camera/microphone
- Kích thước: 1280x720px
- User Agent: Chrome latest

#### B. Tham gia cuộc họp
1. **Navigate**: Đi đến Google Meet URL
2. **Bypass Camera/Mic**: Click "Continue without microphone and camera"
3. **Nhập tên**: Điền "ScreenApp Notetaker" hoặc tên custom
4. **Join**: Click "Ask to join" / "Join now" / "Join anyway"
5. **Chờ admit**: Đợi được admit vào cuộc họp (detect bằng UI elements)
6. **Dismiss modals**: Click tất cả button "Got it"

### 2. Quy trình ghi lại (`RecordingTask.ts`)

#### A. MediaRecorder Setup
- **Format**: WebM với H.264 codec (fallback: WebM default)
- **Chunk duration**: 2 giây/chunk
- **Audio settings**:
  - 2 channels
  - Tắt auto gain control
  - Tắt echo cancellation
  - Tắt noise suppression

#### B. Screen Capture
```javascript
navigator.mediaDevices.getDisplayMedia({
  video: true,
  audio: { /* settings */ },
  preferCurrentTab: true
})
```

#### C. Data Streaming
- Mỗi 2 giây tạo ra 1 chunk
- Convert ArrayBuffer → Base64
- Gửi qua `screenAppSendData()` exposed function
- Chunks được upload real-time lên server

### 3. Upload Process (`uploadService.ts`)

#### A. Multipart Upload Flow
```
Initialize → Create Parts → Upload Chunks → Finalize
```

1. **Initialize Multipart Upload**
   ```typescript
   initializeMultipartUpload({
     teamId, folderId, contentType: 'video/webm', token
   })
   ```
   → Returns: `fileId`, `uploadId`

2. **Create Upload URLs**
   ```typescript
   createPartUploadUrl({
     teamId, folderId, fileId, uploadId, partNumber, contentType, token
   })
   ```
   → Returns: `uploadUrl` cho từng part

3. **Upload Chunks**
   ```typescript
   uploadChunkToStorage({ uploadUrl, chunk })
   ```
   → Upload binary data lên cloud storage

4. **Finalize Upload**
   ```typescript
   finalizeUpload({
     teamId, folderId, fileId, uploadId, 
     namePrefix: "Google Meet Recording",
     timezone, botId
   })
   ```
   → Tạo file cuối cùng với tên: `"Google Meet Recording {time}"`

### 4. Intelligent Recording Control

#### A. Inactivity Detection (sau X phút)
- **Lone Participant Detection**: Kiểm tra số người tham gia mỗi 5 giây
- **Silence Detection**: Phân tích audio frequency để detect im lặng
- **Auto Stop**: Dừng ghi khi detect bot ở một mình hoặc im lặng quá lâu

#### B. Meeting End Detection
- Detect "Meeting ended by host"
- Detect URL changes (không còn trên meet.google.com)
- Auto cleanup khi meeting kết thúc

#### C. Timeout Controls
- **Max Duration**: Giới hạn thời gian ghi tối đa
- **Join Wait Time**: Thời gian chờ được admit
- **Graceful Shutdown**: Clean up browser và resources

### 5. Bot Status Tracking (`botService.ts`)

```typescript
BotStatus: 'processing' → 'joined' → 'finished' | 'failed'
```

- **Status Updates**: Real-time update trạng thái bot
- **Error Logging**: Log lỗi với category/subcategory
- **Retry Logic**: Retry khi waiting at lobby

## File Output & Processing

### 1. File Naming Convention
```
{namePrefix} {formatted_time}
```
Ví dụ: `"Google Meet Recording 2:30pm Jul 17 2025"`

### 2. Upload Destination
- **Cloud Storage**: Upload lên cloud storage của ScreenApp
- **Team Folder**: Organized theo `teamId` và `folderId`
- **Metadata**: Include `botId`, `timezone`, `contentType`

### 3. File Format
- **Video**: WebM container
- **Codec**: H.264 (preferred) hoặc WebM default
- **Audio**: 2-channel, unprocessed
- **Resolution**: 1280x720

### 4. Post-Processing Flow
1. **Real-time upload**: Chunks upload ngay khi record
2. **Multipart assembly**: Server assembly các chunks thành file hoàn chỉnh
3. **File registration**: Register file vào database với metadata
4. **Team access**: File available trong team folder
5. **Further processing**: Có thể trigger transcription, AI analysis, etc.

## Key Features

### ✅ Automatic Join & Record
- Tự động tham gia meeting
- Bypass camera/mic requirements
- Handle lobby waiting

### ✅ Intelligent Control
- Auto-detect meeting end
- Silence & presence detection
- Graceful timeout handling

### ✅ Real-time Upload
- Stream chunks while recording
- No local storage required
- Fault-tolerant upload

### ✅ Error Handling
- Retry mechanisms
- Detailed logging
- Status tracking

### ✅ Resource Management
- Auto cleanup browser
- Memory efficient
- Background processing

## Cấu hình quan trọng

- `maxRecordingDuration`: Thời gian ghi tối đa
- `inactivityLimit`: Thời gian im lặng tối đa
- `joinWaitTime`: Thời gian chờ admit
- `activateInactivityDetectionAfter`: Khi nào bắt đầu detect inactivity

Hệ thống này cho phép record meetings một cách tự động, intelligent và scalable với minimal human intervention.