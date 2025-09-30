# API Reference: Webhook System

**Purpose:** Complete API documentation for all webhook system modules
**Audience:** Developers integrating with or extending the webhook system
**Last Updated:** 2025-09-30

---

## Table of Contents

1. [Configuration API](#configuration-api)
2. [Logger API](#logger-api)
3. [ID Generator API](#id-generator-api)
4. [Queue Manager API](#queue-manager-api)
5. [Webhook Client API](#webhook-client-api)
6. [Database Schema](#database-schema)
7. [HTTP API Endpoints](#http-api-endpoints)

---

## Configuration API

**Module:** `.claude/hooks/lib/config.js`

### Overview

Centralized configuration for all webhook system components. Exports a single `CONFIG` object with all settings.

### Usage

```javascript
const CONFIG = require('./.claude/hooks/lib/config');

console.log(CONFIG.webhook.url);
console.log(CONFIG.logging.level);
```

### Configuration Object

#### `CONFIG.logging`

Controls logging behavior.

```javascript
{
  enabled: boolean,              // Enable/disable logging
  level: 'info' | 'debug',       // Log level
  directory: string,             // Log directory path
  files: {
    success: string,             // Success log filename
    error: string,               // Error log filename
    queue: string,               // Queue log filename
    debug: string                // Debug log filename
  },
  maxFileSize: number,           // Max size per file (bytes)
  maxFiles: number,              // Max files to keep
  asyncWrite: boolean,           // Use async buffered writes
  flushInterval: number          // Flush interval (ms)
}
```

**Defaults:**
```javascript
{
  enabled: true,
  level: process.env.CLAUDE_HOOK_DEBUG === 'true' ? 'debug' : 'info',
  directory: '.claude/logs',
  files: {
    success: 'webhook-success.log',
    error: 'webhook-error.log',
    queue: 'webhook-queue.log',
    debug: 'webhook-debug.log'
  },
  maxFileSize: 10 * 1024 * 1024,  // 10MB
  maxFiles: 5,
  asyncWrite: true,
  flushInterval: 5000
}
```

#### `CONFIG.queue`

Controls queue behavior.

```javascript
{
  enabled: boolean,              // Enable/disable queue
  directory: string,             // Queue directory path
  subdirs: {
    pending: string,             // Pending subdirectory name
    processing: string,          // Processing subdirectory name
    failed: string               // Failed subdirectory name
  },
  maxRetries: number,            // Max retry attempts
  retryDelays: number[],         // Delay per retry (ms)
  maxQueueSize: number,          // Max queued requests
  maxFileAge: number             // Max age before archive (ms)
}
```

**Defaults:**
```javascript
{
  enabled: true,
  directory: '.claude/queue',
  subdirs: {
    pending: 'pending',
    processing: 'processing',
    failed: 'failed'
  },
  maxRetries: 5,
  retryDelays: [
    60000,      // 1 minute
    300000,     // 5 minutes
    900000,     // 15 minutes
    3600000,    // 1 hour
    7200000     // 2 hours
  ],
  maxQueueSize: 1000,
  maxFileAge: 7 * 24 * 60 * 60 * 1000  // 7 days
}
```

#### `CONFIG.webhook`

Controls webhook HTTP behavior.

```javascript
{
  url: string,                   // API endpoint URL
  apiKey: string,                // API authentication key
  timeout: number,               // Request timeout (ms)
  maxRetries: number,            // Max HTTP retry attempts
  retryDelay: number,            // Delay between retries (ms)
  retryableErrors: string[],     // Network errors to retry
  retryableStatusCodes: number[] // HTTP status codes to retry
}
```

**Defaults:**
```javascript
{
  url: process.env.CLAUDE_HOOK_API_URL || 'http://localhost:3000/api/claude-hooks',
  apiKey: process.env.CLAUDE_HOOK_API_KEY,
  timeout: 5000,
  maxRetries: 3,
  retryDelay: 1000,
  retryableErrors: [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNRESET'
  ],
  retryableStatusCodes: [500, 502, 503, 504, 429]
}
```

#### `CONFIG.system`

System information (read-only).

```javascript
{
  hostname: string,              // Machine hostname
  platform: string,              // OS platform
  nodeVersion: string            // Node.js version
}
```

**Example:**
```javascript
{
  hostname: 'DESKTOP-ABC123',
  platform: 'win32',
  nodeVersion: 'v18.17.0'
}
```

---

## Logger API

**Module:** `.claude/hooks/lib/logger.js` (PENDING IMPLEMENTATION)

### Overview

Async buffered logging system with four separate log files and automatic rotation.

### Methods

#### `logger.info(message, context)`

Log informational message to success log.

**Parameters:**
- `message` (string) - Log message
- `context` (object, optional) - Additional context data

**Returns:** void

**Example:**
```javascript
logger.info('Webhook sent successfully', {
  requestId: 'req_abc123',
  duration: 145,
  statusCode: 200
});
```

**Output:** `.claude/logs/webhook-success.log`
```json
{
  "timestamp": "2025-09-30T12:34:56.789Z",
  "level": "info",
  "message": "Webhook sent successfully",
  "requestId": "req_abc123",
  "context": {
    "duration": 145,
    "statusCode": 200
  }
}
```

#### `logger.error(message, error, context)`

Log error message to error log.

**Parameters:**
- `message` (string) - Error description
- `error` (Error) - Error object
- `context` (object, optional) - Additional context data

**Returns:** void

**Example:**
```javascript
try {
  await sendWebhook(payload);
} catch (error) {
  logger.error('Webhook delivery failed', error, {
    requestId: 'req_abc123',
    attempt: 1,
    retryable: true
  });
}
```

**Output:** `.claude/logs/webhook-error.log`
```json
{
  "timestamp": "2025-09-30T12:34:56.789Z",
  "level": "error",
  "message": "Webhook delivery failed",
  "requestId": "req_abc123",
  "error": {
    "message": "ETIMEDOUT: Request timeout",
    "code": "ETIMEDOUT",
    "stack": "Error: ETIMEDOUT\n  at..."
  },
  "context": {
    "attempt": 1,
    "retryable": true
  }
}
```

#### `logger.queue(message, queueData)`

Log queue operation to queue log.

**Parameters:**
- `message` (string) - Queue operation description
- `queueData` (object) - Queue-related data

**Returns:** void

**Example:**
```javascript
logger.queue('Request enqueued for retry', {
  requestId: 'req_abc123',
  retryCount: 1,
  nextRetryAt: '2025-09-30T12:39:57Z'
});
```

**Output:** `.claude/logs/webhook-queue.log`
```json
{
  "timestamp": "2025-09-30T12:34:56.789Z",
  "level": "info",
  "message": "Request enqueued for retry",
  "queueData": {
    "requestId": "req_abc123",
    "retryCount": 1,
    "nextRetryAt": "2025-09-30T12:39:57Z"
  }
}
```

#### `logger.debug(message, context)`

Log debug message to debug log (only if debug enabled).

**Parameters:**
- `message` (string) - Debug message
- `context` (object, optional) - Additional context data

**Returns:** void

**Example:**
```javascript
logger.debug('Payload built', {
  requestId: 'req_abc123',
  eventType: 'SessionStart',
  payloadSize: 1234
});
```

**Output:** `.claude/logs/webhook-debug.log` (only if `CLAUDE_HOOK_DEBUG=true`)

#### `logger.flush()`

Flush buffered logs to disk immediately.

**Parameters:** None

**Returns:** Promise\<void\>

**Example:**
```javascript
// Flush before process exits
process.on('exit', () => {
  logger.flush();
});
```

---

## ID Generator API

**Module:** `.claude/hooks/lib/id-generator.js`

### Overview

Generates unique identifiers for request tracing and distributed tracing support.

### Methods

#### `IdGenerator.generateRequestId()`

Generate unique request ID.

**Parameters:** None

**Returns:** string - Format: `req_<timestamp36>_<random8>`

**Example:**
```javascript
const requestId = IdGenerator.generateRequestId();
console.log(requestId);
// Output: 'req_lz5k8p2_9x4m3n7q'
```

**Characteristics:**
- **Unique:** Timestamp + random ensures global uniqueness
- **Sortable:** Timestamp-based prefix allows chronological sorting
- **Short:** 8-16 characters total
- **URL-safe:** Base36 encoding (alphanumeric only)

#### `IdGenerator.generateTraceId(sessionId)`

Generate trace ID for distributed tracing.

**Parameters:**
- `sessionId` (string) - Session identifier to include in trace

**Returns:** string - Format: `trace_<session8>_<timestamp36>`

**Example:**
```javascript
const sessionId = 'abc12345-def6-7890-ghij-klmnopqrstuv';
const traceId = IdGenerator.generateTraceId(sessionId);
console.log(traceId);
// Output: 'trace_abc12345_lz5k8p2'
```

**Usage:**
- Links all operations in a session
- Used for distributed tracing
- Correlates logs across components

#### `IdGenerator.generateSpanId(component, sequence)`

Generate span ID for operation tracking.

**Parameters:**
- `component` (string) - Component name
- `sequence` (number) - Operation sequence number

**Returns:** string - Format: `span_<component>_<sequence>`

**Example:**
```javascript
const spanId1 = IdGenerator.generateSpanId('logger', 0);
const spanId2 = IdGenerator.generateSpanId('queue', 1);
console.log(spanId1);  // 'span_logger_0'
console.log(spanId2);  // 'span_queue_1'
```

**Usage:**
- Tracks individual operations within a request
- Used for performance profiling
- Maps operation flow

---

## Queue Manager API

**Module:** `.claude/hooks/lib/queue-manager.js` (PENDING IMPLEMENTATION)

### Overview

File-based queue system for failed webhook requests with automatic retry.

### Methods

#### `queueManager.enqueue(payload, error)`

Add failed request to queue.

**Parameters:**
- `payload` (object) - Webhook payload that failed
- `error` (Error) - Error that caused failure

**Returns:** Promise\<string\> - Path to created queue file

**Example:**
```javascript
try {
  await webhookClient.send(payload);
} catch (error) {
  const queueFile = await queueManager.enqueue(payload, error);
  console.log('Queued:', queueFile);
}
```

**Queue File Format:**
```json
{
  "requestId": "req_abc123",
  "traceId": "trace_xyz456",
  "payload": {
    "event": "SessionStart",
    "sessionId": "abc12345-def6-7890-ghij-klmnopqrstuv"
  },
  "error": {
    "message": "ETIMEDOUT: Request timeout",
    "code": "ETIMEDOUT",
    "stack": "Error: ETIMEDOUT\n  at..."
  },
  "enqueuedAt": "2025-09-30T12:34:56.789Z",
  "retryCount": 0,
  "nextRetryAt": "2025-09-30T12:35:56.789Z",
  "lastRetryAt": null,
  "lastError": null
}
```

**File Location:** `.claude/queue/pending/<requestId>.json`

#### `queueManager.dequeue()`

Remove and return next eligible request from queue.

**Parameters:** None

**Returns:** Promise\<object|null\> - Queue item or null if empty

**Example:**
```javascript
const item = await queueManager.dequeue();
if (item) {
  console.log('Processing:', item.requestId);
  console.log('Payload:', item.payload);
}
```

**Return Value:**
```javascript
{
  requestId: 'req_abc123',
  traceId: 'trace_xyz456',
  payload: { /* original payload */ },
  metadata: {
    retryCount: 1,
    enqueuedAt: '2025-09-30T12:34:56.789Z',
    lastError: 'ETIMEDOUT'
  }
}
```

#### `queueManager.getQueueDepth()`

Get current queue statistics.

**Parameters:** None

**Returns:** object - Queue depth by status

**Example:**
```javascript
const depth = queueManager.getQueueDepth();
console.log('Pending:', depth.pending);
console.log('Processing:', depth.processing);
console.log('Failed:', depth.failed);
```

**Return Value:**
```javascript
{
  pending: 5,      // Awaiting retry
  processing: 1,   // Currently being retried
  failed: 2        // Exceeded max retries
}
```

#### `queueManager.processQueue()`

Process all eligible queued requests.

**Parameters:** None

**Returns:** Promise\<object\> - Processing results

**Example:**
```javascript
const results = await queueManager.processQueue();
console.log('Processed:', results.processed);
console.log('Succeeded:', results.succeeded);
console.log('Failed:', results.failed);
```

**Return Value:**
```javascript
{
  processed: 5,    // Total requests processed
  succeeded: 3,    // Successfully retried
  failed: 2,       // Failed again
  skipped: 10      // Not yet eligible
}
```

**Processing Logic:**
1. Scan `.claude/queue/pending/`
2. For each file:
   - Check if `nextRetryAt <= now`
   - Check if `retryCount < maxRetries`
   - Move to `processing/` (lock)
   - Attempt retry
   - On success: Delete file
   - On failure: Update `retryCount`, move to `pending/`
   - On max retries: Move to `failed/`

#### `queueManager.archiveFailed(requestId)`

Move request to failed directory (permanent failure).

**Parameters:**
- `requestId` (string) - Request ID to archive

**Returns:** Promise\<void\>

**Example:**
```javascript
await queueManager.archiveFailed('req_abc123');
```

**Result:** Moves file from `pending/` to `failed/`

---

## Webhook Client API

**Module:** `.claude/hooks/lib/webhook-client.js` (PENDING IMPLEMENTATION)

### Overview

HTTP client for sending webhook requests with retry logic and error handling.

### Methods

#### `webhookClient.send(payload, options)`

Send webhook request to API endpoint.

**Parameters:**
- `payload` (object) - Webhook payload
- `options` (object, optional) - Request options

**Options:**
```javascript
{
  requestId: string,     // Request ID (auto-generated if not provided)
  traceId: string,       // Trace ID for distributed tracing
  timeout: number,       // Request timeout (ms), default from CONFIG
  headers: object        // Additional headers
}
```

**Returns:** Promise\<object\> - API response

**Example:**
```javascript
const payload = {
  event: 'SessionStart',
  sessionId: 'abc12345-def6-7890-ghij-klmnopqrstuv',
  projectPath: '/home/user/project',
  timestamp: '2025-09-30T12:34:56.789Z'
};

const options = {
  requestId: 'req_abc123',
  traceId: 'trace_xyz456',
  timeout: 5000
};

const response = await webhookClient.send(payload, options);
console.log('Success:', response.success);
console.log('Conversation ID:', response.data.conversationId);
```

**Response:**
```javascript
{
  success: true,
  requestId: 'req_abc123',
  webhookEventId: 'clx123abc',
  message: 'Processed SessionStart event',
  data: {
    conversationId: 'clx456def'
  }
}
```

**Errors:**
```javascript
// Network error
Error: ETIMEDOUT: Request timeout
  code: 'ETIMEDOUT'
  retryable: true

// HTTP error
Error: HTTP 401: Unauthorized - invalid API key
  statusCode: 401
  retryable: false

// Validation error
Error: HTTP 400: Validation error: sessionId required
  statusCode: 400
  retryable: false
```

#### `webhookClient.sendWithRetry(payload, maxRetries)`

Send webhook request with automatic retry.

**Parameters:**
- `payload` (object) - Webhook payload
- `maxRetries` (number, optional) - Max retry attempts (default: 3)

**Returns:** Promise\<object\> - API response

**Example:**
```javascript
const response = await webhookClient.sendWithRetry(payload, 3);
// Automatically retries on retryable errors with exponential backoff
```

**Retry Behavior:**
- **Retryable errors:** Network errors, 5xx status codes, 429 rate limit
- **Non-retryable errors:** 4xx status codes (except 429)
- **Backoff:** 1s, 2s, 4s (exponential)
- **Max retries:** Configurable (default: 3)

#### `webhookClient.validateResponse(response)`

Validate API response structure.

**Parameters:**
- `response` (object) - API response to validate

**Returns:** boolean - True if valid, false otherwise

**Example:**
```javascript
const response = await fetch(url, options);
const data = await response.json();

if (webhookClient.validateResponse(data)) {
  console.log('Valid response');
} else {
  console.error('Invalid response structure');
}
```

**Valid Response:**
```javascript
{
  success: boolean,      // Required
  requestId: string,     // Required
  message: string,       // Optional
  data: object          // Optional
}
```

### Request Headers

All webhook requests include these headers:

```javascript
{
  'Content-Type': 'application/json',
  'Authorization': 'Bearer <api_key>',
  'X-Request-ID': 'req_abc123',
  'X-Trace-ID': 'trace_xyz456',
  'User-Agent': 'Claude-Code-Hook/2.0'
}
```

### Error Classification

#### Retryable Errors
```javascript
// Network errors
- ECONNREFUSED (connection refused)
- ETIMEDOUT (timeout)
- ENOTFOUND (DNS failure)
- ECONNRESET (connection reset)

// HTTP status codes
- 500 (Internal Server Error)
- 502 (Bad Gateway)
- 503 (Service Unavailable)
- 504 (Gateway Timeout)
- 429 (Too Many Requests)
```

#### Non-Retryable Errors
```javascript
// HTTP status codes
- 400 (Bad Request)
- 401 (Unauthorized)
- 403 (Forbidden)
- 413 (Payload Too Large)
- 422 (Unprocessable Entity)
```

---

## Database Schema

### WebhookEvent Model

**Table:** `webhook_events`

Complete audit trail of all webhook events for debugging and retry.

#### Schema Definition

```prisma
model WebhookEvent {
  id             String        @id @default(cuid())
  requestId      String?       @unique @map("request_id")
  eventType      String        @map("event_type")
  sessionId      String?       @map("session_id")
  receivedAt     DateTime      @default(now()) @map("received_at")
  requestBody    Json          @map("request_body")
  requestHeaders Json?         @map("request_headers")
  ipAddress      String?       @map("ip_address")
  status         WebhookStatus @default(PENDING)
  processedAt    DateTime?     @map("processed_at")
  processingTime Int?          @map("processing_time")
  conversationId String?       @map("conversation_id")
  messageId      String?       @map("message_id")
  toolUseId      String?       @map("tool_use_id")
  errorMessage   String?       @map("error_message")
  errorStack     String?       @map("error_stack")
  errorCode      String?       @map("error_code")
  retryCount     Int           @default(0) @map("retry_count")
  retryAfter     DateTime?     @map("retry_after")
  metadata       Json?
  createdAt      DateTime      @default(now()) @map("created_at")
  updatedAt      DateTime      @updatedAt @map("updated_at")

  @@index([sessionId])
  @@index([eventType])
  @@index([status])
  @@index([receivedAt])
  @@index([conversationId])
  @@index([eventType, status])
  @@index([sessionId, receivedAt])
  @@index([status, receivedAt])
  @@map("webhook_events")
}
```

#### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Primary key (cuid) |
| `requestId` | String | Unique request identifier (from X-Request-ID header) |
| `eventType` | String | Type of webhook event (SessionStart, UserPromptSubmit, etc.) |
| `sessionId` | String | Claude Code session ID |
| `receivedAt` | DateTime | When request was received |
| `requestBody` | JSONB | Full webhook payload |
| `requestHeaders` | JSONB | Selected request headers |
| `ipAddress` | String | Source IP address |
| `status` | WebhookStatus | Processing status enum |
| `processedAt` | DateTime | When processing completed |
| `processingTime` | Integer | Processing duration (ms) |
| `conversationId` | String | Created/updated conversation ID |
| `messageId` | String | Created message ID |
| `toolUseId` | String | Created tool use ID |
| `errorMessage` | String | Error description |
| `errorStack` | String | Full error stack trace |
| `errorCode` | String | Categorized error code |
| `retryCount` | Integer | Number of retry attempts |
| `retryAfter` | DateTime | Scheduled retry time |
| `metadata` | JSONB | Additional metadata |
| `createdAt` | DateTime | Record creation time |
| `updatedAt` | DateTime | Last update time |

#### WebhookStatus Enum

```typescript
enum WebhookStatus {
  PENDING        // Just received, not processed yet
  PROCESSING     // Currently being processed
  SUCCESS        // Successfully processed
  FAILED         // Failed after retries
  ERROR          // Unexpected error
  DUPLICATE      // Duplicate request detected
  INVALID        // Invalid payload
  PENDING_RETRY  // Waiting for retry
}
```

#### Common Queries

**Find recent events:**
```sql
SELECT * FROM webhook_events
ORDER BY received_at DESC
LIMIT 10;
```

**Find failed events:**
```sql
SELECT request_id, event_type, error_message
FROM webhook_events
WHERE status = 'FAILED'
ORDER BY received_at DESC;
```

**Find events for session:**
```sql
SELECT * FROM webhook_events
WHERE session_id = 'abc12345-def6-7890-ghij-klmnopqrstuv'
ORDER BY received_at ASC;
```

**Get success rate:**
```sql
SELECT
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM webhook_events
GROUP BY status;
```

---

## HTTP API Endpoints

### POST /api/claude-hooks

Process Claude Code webhook events.

#### Request

**Method:** POST

**URL:** `https://arrakis-prod.onrender.com/api/claude-hooks`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <api_key>
X-Request-ID: req_abc123 (optional)
X-Trace-ID: trace_xyz456 (optional)
```

**Body (SessionStart):**
```json
{
  "event": "SessionStart",
  "sessionId": "abc12345-def6-7890-ghij-klmnopqrstuv",
  "projectPath": "/home/user/project",
  "transcriptPath": "/path/to/transcript.jsonl",
  "timestamp": "2025-09-30T12:34:56.789Z",
  "userInfo": {
    "nodeVersion": "v18.17.0",
    "platform": "darwin",
    "arch": "x64"
  }
}
```

**Body (UserPromptSubmit):**
```json
{
  "event": "UserPromptSubmit",
  "sessionId": "abc12345-def6-7890-ghij-klmnopqrstuv",
  "projectPath": "/home/user/project",
  "timestamp": "2025-09-30T12:35:30.000Z",
  "prompt": "Create a new React component",
  "promptId": "prompt_xyz123"
}
```

**Body (PostToolUse):**
```json
{
  "event": "PostToolUse",
  "sessionId": "abc12345-def6-7890-ghij-klmnopqrstuv",
  "timestamp": "2025-09-30T12:35:45.000Z",
  "toolName": "Write",
  "parameters": {
    "file_path": "/path/to/file.tsx",
    "content": "..."
  },
  "response": {
    "success": true
  },
  "duration": 234,
  "status": "success",
  "toolId": "tool_abc789"
}
```

#### Response

**Success (200):**
```json
{
  "success": true,
  "requestId": "req_abc123",
  "webhookEventId": "clx123abc",
  "message": "Processed SessionStart event",
  "data": {
    "conversationId": "clx456def",
    "created": true
  }
}
```

**Error (400 - Bad Request):**
```json
{
  "success": false,
  "requestId": "req_abc123",
  "error": "Validation error: sessionId required"
}
```

**Error (401 - Unauthorized):**
```json
{
  "success": false,
  "requestId": "req_abc123",
  "error": "Unauthorized - invalid API key"
}
```

**Error (500 - Internal Server Error):**
```json
{
  "success": false,
  "requestId": "req_abc123",
  "error": "Internal server error",
  "details": "Error: Database connection failed" // Development only
}
```

#### Rate Limiting

- **Limit:** 100 requests per minute per API key
- **Response:** 429 Too Many Requests
- **Retry-After:** Included in response header

---

## Type Definitions

### TypeScript Types

```typescript
// Request ID types
type RequestId = `req_${string}_${string}`;
type TraceId = `trace_${string}_${string}`;
type SpanId = `span_${string}_${number}`;

// Webhook event types
type WebhookEventType =
  | 'SessionStart'
  | 'UserPromptSubmit'
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Stop'
  | 'SessionEnd';

// Webhook status
type WebhookStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'ERROR'
  | 'DUPLICATE'
  | 'INVALID'
  | 'PENDING_RETRY';

// Queue item
interface QueueItem {
  requestId: RequestId;
  traceId?: TraceId;
  payload: Record<string, any>;
  error: {
    message: string;
    code?: string;
    stack?: string;
  };
  enqueuedAt: string;
  retryCount: number;
  nextRetryAt: string;
  lastRetryAt?: string;
  lastError?: string;
}

// Webhook response
interface WebhookResponse {
  success: boolean;
  requestId: RequestId;
  webhookEventId?: string;
  message?: string;
  data?: Record<string, any>;
  error?: string;
  details?: string;
}

// Logger context
interface LoggerContext {
  requestId?: RequestId;
  traceId?: TraceId;
  spanId?: SpanId;
  [key: string]: any;
}
```

---

## Error Codes

### System Error Codes

| Code | Description | Retryable | Action |
|------|-------------|-----------|--------|
| `ECONNREFUSED` | Connection refused | Yes | Check server status |
| `ETIMEDOUT` | Request timeout | Yes | Increase timeout |
| `ENOTFOUND` | DNS resolution failed | Yes | Check domain name |
| `ECONNRESET` | Connection reset | Yes | Retry with backoff |
| `QUEUE_FULL` | Queue at max capacity | No | Process queue first |
| `INVALID_PAYLOAD` | Invalid webhook payload | No | Fix payload structure |
| `AUTH_FAILED` | Authentication failed | No | Check API key |
| `RATE_LIMITED` | Rate limit exceeded | Yes | Wait and retry |

### HTTP Status Codes

| Code | Description | Retryable |
|------|-------------|-----------|
| 200 | Success | N/A |
| 400 | Bad Request | No |
| 401 | Unauthorized | No |
| 403 | Forbidden | No |
| 413 | Payload Too Large | No |
| 429 | Rate Limited | Yes |
| 500 | Internal Server Error | Yes |
| 502 | Bad Gateway | Yes |
| 503 | Service Unavailable | Yes |
| 504 | Gateway Timeout | Yes |

---

## Examples

### Complete Webhook Flow Example

```javascript
// 1. Generate IDs
const requestId = IdGenerator.generateRequestId();
const traceId = IdGenerator.generateTraceId(sessionId);

// 2. Log request start
logger.info('Webhook request started', {
  requestId,
  traceId,
  event: 'SessionStart'
});

// 3. Build payload
const payload = {
  event: 'SessionStart',
  sessionId: sessionId,
  timestamp: new Date().toISOString()
};

// 4. Send webhook
try {
  const response = await webhookClient.send(payload, {
    requestId,
    traceId
  });

  logger.info('Webhook succeeded', {
    requestId,
    conversationId: response.data.conversationId
  });

} catch (error) {
  logger.error('Webhook failed', error, { requestId });

  // 5. Enqueue for retry
  await queueManager.enqueue(payload, error);
  logger.queue('Request queued for retry', {
    requestId,
    retryCount: 0
  });
}

// 6. Flush logs
await logger.flush();
```

### Queue Processing Example

```javascript
// Process queue on hook trigger
async function processQueue() {
  const results = await queueManager.processQueue();

  logger.info('Queue processing complete', {
    processed: results.processed,
    succeeded: results.succeeded,
    failed: results.failed
  });

  // Archive requests that exceeded max retries
  for (const failedId of results.permanentFailures) {
    await queueManager.archiveFailed(failedId);
  }
}
```

---

**Last Updated:** 2025-09-30
**Version:** 1.0.0 (Phase 1)
**Maintainer:** Development Team
