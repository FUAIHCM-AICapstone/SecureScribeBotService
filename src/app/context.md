# src/app/ Context Guide

## Purpose
HTTP API layer và route handlers cho Google Meet Bot service. Đây là entry point cho external requests và orchestrates các business logic.

## Key Files & Responsibilities

### `index.ts` - Main Express Application
- **Express server setup** với middleware
- **Health check endpoints**: `/health`, `/isbusy`, `/metrics`
- **Prometheus metrics** integration
- **JobStore status** monitoring
- **Debug endpoint** cho development

### `google.ts` - Google Meet API Routes
- **POST /google/join** - Main endpoint để join Google Meet
- **Request validation** cho required fields
- **Correlation ID generation** cho tracing
- **GlobalJobStore integration** với single-job pattern
- **Error handling** với proper HTTP status codes

### `common.ts` - Shared API Types & Utilities
- **MeetingJoinParams interface** - Standard request format
- **Retry logic with exponential backoff**
- **KnownError handling** patterns
- **Sleep utilities** cho async operations

## Development Patterns

### Adding New Routes
```typescript
// Luôn validate input trước
if (!bearerToken || !url || !teamId) {
  return res.status(400).json({ error: 'Missing required fields' });
}

// Tạo correlation ID cho tracing
const correlationId = createCorrelationId({ teamId, userId, botId });
const logger = loggerFactory(correlationId, 'platform');

// Check JobStore acceptance
const jobResult = await globalJobStore.addJob(async () => {
  // Your business logic
}, logger);

if (!jobResult.accepted) {
  return res.status(409).json({ error: 'BUSY' });
}
```

### Error Response Patterns
```typescript
// Success (202 Accepted)
res.status(202).json({
  success: true,
  message: "Request accepted and processing started",
  data: { userId, teamId, status: "processing" }
});

// Busy (409 Conflict)
res.status(409).json({
  success: false,
  message: "System is currently busy",
  error: "BUSY"
});

// Validation Error (400)
res.status(400).json({
  success: false,
  error: "Missing required fields: field1, field2"
});
```

## Using Tools

### Desktop Commander for API Testing
```bash
# Test endpoints
mcp_desktop-comma_start_process "curl http://localhost:3000/isbusy"
mcp_desktop-comma_start_process "curl -X POST http://localhost:3000/google/join -H 'Content-Type: application/json' -d '{\"bearerToken\":\"test\"}'"
```

### Context7 for Express Documentation
```typescript
// Resolve Express.js patterns và best practices
mcp_context7_resolve-library-id "express"
mcp_context7_get-library-docs "/expressjs/express" "routing middleware error-handling"
```

## Integration Points
- **GlobalJobStore**: Single job execution enforcement
- **Logger Factory**: Correlation ID based logging
- **Bot Services**: Business logic delegation
- **Config**: Environment-based settings

## Common Tasks
1. **Add new platform support**: Create new router file, implement validation
2. **Add middleware**: Modify `index.ts` app setup
3. **Add metrics**: Extend Prometheus gauges
4. **Debug requests**: Use `/debug` endpoint và correlation IDs
