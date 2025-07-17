# src/middleware/ Context Guide

## Purpose

Express middleware layer cho HTTP request processing, authentication, logging, error handling, và request validation. Hiện tại folder này empty nhưng sẵn sàng cho future middleware implementations.

## Potential Middleware Implementations

### Authentication Middleware

```typescript
// Bearer token validation middleware
export const authenticateToken = async (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    // Validate token với ScreenApp API
    const apiClient = createApiV2(token);
    await apiClient.get('/auth/validate');
    
    req.user = { token }; // Attach validated token
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};
```

### Request Logging Middleware

```typescript
// Correlation ID và request logging
export const requestLogger = (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  const correlationId = createCorrelationId({
    teamId: req.body?.teamId,
    userId: req.body?.userId,
    url: req.body?.url
  });
  
  const logger = loggerFactory(correlationId, 'api');
  
  // Attach logger to request
  req.logger = logger;
  req.correlationId = correlationId;
  
  logger.info('Request started', {
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent']
  });
  
  // Log response
  res.on('finish', () => {
    logger.info('Request completed', {
      statusCode: res.statusCode,
      contentLength: res.get('content-length')
    });
  });
  
  next();
};
```

### Rate Limiting Middleware

```typescript
// Rate limiting cho API endpoints
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many requests from this IP',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});
```

### Validation Middleware

```typescript
// Request validation cho Google Meet endpoints
export const validateGoogleMeetRequest = (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  const { bearerToken, url, name, teamId, timezone, userId } = req.body;
  
  const errors: string[] = [];
  
  if (!bearerToken) errors.push('bearerToken is required');
  if (!url || !url.includes('meet.google.com')) {
    errors.push('Valid Google Meet URL is required');
  }
  if (!name) errors.push('name is required');
  if (!teamId) errors.push('teamId is required');
  if (!userId) errors.push('userId is required');
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors
    });
  }
  
  next();
};
```

### Error Handling Middleware

```typescript
// Global error handler
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const logger = req.logger || console;
  const correlationId = req.correlationId;
  
  logger.error('Unhandled error:', { error: error.message, stack: error.stack });
  
  if (error instanceof KnownError) {
    return res.status(400).json({
      success: false,
      error: error.message,
      retryable: error.retryable,
      correlationId
    });
  }
  
  // Generic error response
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    correlationId
  });
};
```

### CORS Middleware

```typescript
// CORS configuration cho external integrations
export const corsConfig = cors({
  origin: (origin, callback) => {
    // Allow specific domains hoặc all in development
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Service-Key']
});
```

## Usage Patterns

### Middleware Stack Setup

```typescript
// In app/index.ts
import { 
  requestLogger, 
  authenticateToken, 
  validateGoogleMeetRequest,
  errorHandler 
} from '../middleware';

// Global middleware
app.use(express.json());
app.use(requestLogger);

// Protected routes
app.use('/google', authenticateToken);
app.use('/google/join', validateGoogleMeetRequest);

// Route handlers
app.use('/google', googleRouter);

// Error handling (must be last)
app.use(errorHandler);
```

### Conditional Middleware

```typescript
// Apply middleware conditionally
const conditionalAuth = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'development') {
    return next(); // Skip auth in development
  }
  
  return authenticateToken(req, res, next);
};
```

## Using Tools

### Desktop Commander for Middleware Testing

```bash
# Test middleware với different requests
mcp_desktop-comma_start_process "curl -X POST http://localhost:3000/google/join \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer invalid-token' \
  -d '{}'"

# Test rate limiting
mcp_desktop-comma_start_process "for i in {1..15}; do 
  curl http://localhost:3000/isbusy; 
  echo; 
done"
```

### Context7 for Express Middleware

```typescript
// Get Express middleware patterns
mcp_context7_resolve-library-id "express middleware"
mcp_context7_get-library-docs "/expressjs/express" "middleware authentication validation"
```

## Integration Points

### With Logging System

```typescript
// Middleware integrates với logger utilities
const logger = loggerFactory(correlationId, 'middleware');

// Attach logger to request cho downstream usage
req.logger = logger;
```

### With Authentication

```typescript
// Middleware uses auth utilities
const apiClient = createApiV2(token, serviceKey);
await apiClient.get('/validate');
```

### With Error System

```typescript
// Middleware handles KnownError hierarchy
if (error instanceof WaitingAtLobbyRetryError) {
  return res.status(409).json({
    error: 'Bot waiting at lobby',
    retryable: error.retryable
  });
}
```

## Common Tasks

1. **Add authentication**: Implement token validation middleware
2. **Add request validation**: Create schema validation middleware  
3. **Add rate limiting**: Implement request throttling
4. **Add CORS**: Configure cross-origin requests
5. **Add logging**: Implement request/response logging
6. **Add error handling**: Create global error middleware
7. **Add monitoring**: Implement metrics collection middleware
