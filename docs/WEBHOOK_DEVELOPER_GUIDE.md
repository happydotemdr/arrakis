# Developer Guide: Bulletproof Webhook System

**Audience:** Developers working with or debugging the webhook capture system
**Prerequisites:** Basic knowledge of Node.js, PostgreSQL, and Next.js
**System Status:** ✅ **OPERATIONAL** (Activated September 30, 2025)
**Last Updated:** 2025-09-30

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [How It Works](#how-it-works)
3. [Development Workflow](#development-workflow)
4. [Debugging](#debugging)
5. [Testing](#testing)
6. [Common Tasks](#common-tasks)
7. [Best Practices](#best-practices)

---

## Quick Start

### Viewing Logs

**Watch logs in real-time:**
```bash
# Success log (all successful webhooks)
tail -f c:\projects\arrakis\.claude\logs\webhook-success.log

# Error log (all failures)
tail -f c:\projects\arrakis\.claude\logs\webhook-error.log

# Queue operations
tail -f c:\projects\arrakis\.claude\logs\webhook-queue.log

# Debug log (verbose)
tail -f c:\projects\arrakis\.claude\logs\webhook-debug.log
```

**Search logs for specific request:**
```bash
# Find all log entries for request ID
grep "req_abc123" c:\projects\arrakis\.claude\logs\*.log

# Find all errors in last hour
grep "\"level\":\"error\"" c:\projects\arrakis\.claude\logs\webhook-error.log | tail -20
```

**Parse and format JSON logs:**
```bash
# Pretty-print recent errors
tail -5 c:\projects\arrakis\.claude\logs\webhook-error.log | jq .

# Count errors by type
grep "\"level\":\"error\"" c:\projects\arrakis\.claude\logs\webhook-error.log | jq -r '.context.errorCode' | sort | uniq -c
```

### Checking Queue Status

**Count queued requests:**
```bash
# Pending retries
ls c:\projects\arrakis\.claude\queue\pending\*.json 2>/dev/null | wc -l

# Currently processing
ls c:\projects\arrakis\.claude\queue\processing\*.json 2>/dev/null | wc -l

# Permanently failed
ls c:\projects\arrakis\.claude\queue\failed\*.json 2>/dev/null | wc -l
```

**View queue file contents:**
```bash
# View oldest pending request
cat $(ls -t c:\projects\arrakis\.claude\queue\pending\*.json | tail -1) | jq .

# View all failed requests
for f in c:\projects\arrakis\.claude\queue\failed\*.json; do
  echo "File: $f"
  jq '{requestId, retryCount, error: .error.message}' "$f"
  echo "---"
done
```

### Tracing a Request

**Follow a request through the entire system:**

```bash
# 1. Find request in logs
grep "req_abc123" c:\projects\arrakis\.claude\logs\*.log

# 2. Check if queued
ls c:\projects\arrakis\.claude\queue\*\*req_abc123*.json

# 3. Check database
psql $DATABASE_URL -c "SELECT request_id, event_type, status, error_message FROM webhook_events WHERE request_id = 'req_abc123';"

# 4. Check conversation was created
psql $DATABASE_URL -c "SELECT id, session_id, title, started_at FROM conversations WHERE session_id IN (SELECT session_id FROM webhook_events WHERE request_id = 'req_abc123');"
```

---

## How It Works

### Request Flow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. HOOK TRIGGER                                                  │
│    Claude Code fires hook → capture-conversation.js starts      │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. REQUEST INITIALIZATION                                        │
│    - Generate Request ID (req_<timestamp>_<random>)             │
│    - Generate Trace ID (trace_<session>_<timestamp>)            │
│    - Log: "Request started"                                     │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. QUEUE PROCESSING (if any pending)                            │
│    - Scan .claude/queue/pending/                                │
│    - Retry eligible requests (nextRetryAt <= now)               │
│    - Move to processing/ during retry                           │
│    - Delete on success, update on failure                       │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. PAYLOAD BUILDING                                              │
│    - Collect environment variables                              │
│    - Build event-specific payload (SessionStart, etc.)          │
│    - Log: "Payload built"                                       │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. HTTP REQUEST                                                  │
│    - Add headers: X-Request-ID, X-Trace-ID, Authorization       │
│    - Send POST to API endpoint                                  │
│    - Timeout: 5000ms                                            │
│    - Log: "Request sent"                                        │
└─────────────────────────────────────────────────────────────────┘
                           ↓
                    ┌──────┴──────┐
                    │             │
                SUCCESS        FAILURE
                    │             │
                    ↓             ↓
┌─────────────────────────┐  ┌──────────────────────────────────┐
│ 6a. SUCCESS PATH        │  │ 6b. FAILURE PATH                 │
│  - Receive 200 response │  │  - Catch error                   │
│  - Log: "Success"       │  │  - Log: "Failed"                 │
│  - Exit 0               │  │  - Enqueue to pending/           │
└─────────────────────────┘  │  - Log: "Queued for retry"       │
                             │  - Exit 0 (don't break Claude)   │
                             └──────────────────────────────────┘
```

### API Route Processing

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. REQUEST RECEIVED                                              │
│    POST /api/claude-hooks                                        │
│    - Extract request_id from X-Request-ID header                │
│    - Generate new ID if not provided                            │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. LOG TO DATABASE                                               │
│    INSERT INTO webhook_events (                                 │
│      request_id, event_type, session_id,                        │
│      request_body, status = 'PENDING'                           │
│    )                                                             │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. UPDATE STATUS                                                 │
│    UPDATE webhook_events                                         │
│    SET status = 'PROCESSING'                                    │
│    WHERE id = <webhook_event_id>                                │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. PROCESS EVENT                                                 │
│    - SessionStart → Create/update conversation                  │
│    - UserPromptSubmit → Create message                          │
│    - PostToolUse → Create tool_use                              │
│    - etc.                                                        │
└─────────────────────────────────────────────────────────────────┘
                           ↓
                    ┌──────┴──────┐
                    │             │
                SUCCESS        FAILURE
                    │             │
                    ↓             ↓
┌─────────────────────────┐  ┌──────────────────────────────────┐
│ 5a. SUCCESS             │  │ 5b. FAILURE                      │
│  UPDATE webhook_events  │  │  UPDATE webhook_events           │
│  SET                    │  │  SET                             │
│    status = 'SUCCESS',  │  │    status = 'FAILED',            │
│    processed_at = NOW(),│  │    error_message = <error>,      │
│    conversation_id = <> │  │    error_stack = <stack>         │
│                         │  │                                  │
│  Return 200 OK          │  │  Return 500 Error                │
└─────────────────────────┘  └──────────────────────────────────┘
```

### Core Components

#### 1. ID Generator
```javascript
// Generate unique request ID
const requestId = IdGenerator.generateRequestId();
// Returns: 'req_lz5k8p2_9x4m3n7q'

// Generate trace ID for session
const traceId = IdGenerator.generateTraceId(sessionId);
// Returns: 'trace_abc12345_lz5k8p2'

// Generate span ID for operation
const spanId = IdGenerator.generateSpanId('logger', 0);
// Returns: 'span_logger_0'
```

#### 2. Logger
```javascript
// Log successful webhook
logger.info('Webhook delivered successfully', {
  requestId: 'req_abc123',
  duration: 145,
  conversationId: 'clx123abc'
});

// Log error
logger.error('Webhook delivery failed', error, {
  requestId: 'req_abc123',
  attempt: 1,
  retryable: true
});

// Log queue operation
logger.queue('Request enqueued for retry', {
  requestId: 'req_abc123',
  retryCount: 1,
  nextRetryAt: '2025-09-30T12:39:57Z'
});
```

#### 3. Queue Manager
```javascript
// Enqueue failed request
await queueManager.enqueue(payload, error);
// Creates: .claude/queue/pending/req_abc123.json

// Process queue
await queueManager.processQueue();
// Retries all eligible requests

// Check queue status
const status = queueManager.getQueueDepth();
// Returns: { pending: 5, processing: 1, failed: 2 }
```

#### 4. Webhook Client
```javascript
// Send webhook request
const response = await webhookClient.send(payload, {
  requestId: 'req_abc123',
  traceId: 'trace_xyz456',
  timeout: 5000
});

// Send with automatic retry
const response = await webhookClient.sendWithRetry(payload, 3);
// Retries up to 3 times with exponential backoff
```

---

## Development Workflow

### Local Development Setup

1. **Install dependencies:**
   ```bash
   cd c:\projects\arrakis
   npm install
   ```

2. **Set environment variables:**
   ```bash
   # .env.local
   DATABASE_URL="postgresql://..."
   DIRECT_URL="postgresql://..."
   CLAUDE_HOOK_API_KEY="your-api-key"
   CLAUDE_HOOK_DEBUG="true"
   ```

3. **Apply database migrations:**
   ```bash
   npm run db:push
   # or
   npm run db:migrate
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Test webhook locally:**
   ```bash
   # Run hook script manually
   cd .claude/hooks
   CLAUDE_HOOK_EVENT="SessionStart" \
   CLAUDE_SESSION_ID="test-session-123" \
   CLAUDE_PROJECT_DIR="c:\projects\arrakis" \
   CLAUDE_HOOK_API_URL="http://localhost:3000/api/claude-hooks" \
   node capture-conversation.js
   ```

### Making Changes to Hook Script

1. **Edit hook script:**
   ```bash
   # Open in editor
   code c:\projects\arrakis\.claude\hooks\capture-conversation.js
   ```

2. **Test changes:**
   ```bash
   # Run with debug enabled
   CLAUDE_HOOK_DEBUG="true" node capture-conversation.js
   ```

3. **Check logs:**
   ```bash
   tail -f .claude/logs/webhook-debug.log
   ```

4. **Verify database:**
   ```bash
   npm run db:studio
   # Open browser to view webhook_events table
   ```

### Making Changes to Core Libraries

1. **Edit library:**
   ```bash
   code .claude/hooks/lib/logger.js
   ```

2. **Test library in isolation:**
   ```javascript
   // test-logger.js
   const logger = require('./.claude/hooks/lib/logger');

   logger.info('Test message', { test: true });
   logger.flush();
   ```

3. **Run test:**
   ```bash
   node test-logger.js
   cat .claude/logs/webhook-success.log
   ```

### Making Changes to API Route

1. **Edit route:**
   ```bash
   code src/app/api/claude-hooks/route.ts
   ```

2. **Test with curl:**
   ```bash
   curl -X POST http://localhost:3000/api/claude-hooks \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-api-key" \
     -H "X-Request-ID: req_test_123" \
     -d '{
       "event": "SessionStart",
       "sessionId": "test-123",
       "projectPath": "/test",
       "timestamp": "2025-09-30T12:00:00Z"
     }'
   ```

3. **Check database:**
   ```sql
   SELECT * FROM webhook_events
   WHERE request_id = 'req_test_123';
   ```

---

## Debugging

### Common Debugging Scenarios

#### Scenario 1: Webhooks Not Being Captured

**Symptoms:**
- No webhook_events records in database
- No log files being created
- Conversations not appearing

**Diagnosis:**
```bash
# 1. Check if hook is enabled
grep "CLAUDE_HOOK_ENABLED" .claude/settings.json

# 2. Check for hook errors
cat .claude/logs/webhook-error.log

# 3. Test hook manually
CLAUDE_HOOK_EVENT="SessionStart" \
CLAUDE_SESSION_ID="debug-test" \
CLAUDE_HOOK_DEBUG="true" \
node .claude/hooks/capture-conversation.js

# 4. Check API key
echo $CLAUDE_HOOK_API_KEY

# 5. Test API endpoint
curl -X POST $CLAUDE_HOOK_API_URL \
  -H "Authorization: Bearer $CLAUDE_HOOK_API_KEY" \
  -d '{"event":"SessionStart"}'
```

**Solutions:**
- Ensure `CLAUDE_HOOK_ENABLED="true"` in settings.json
- Verify API key is correct in both .claude/settings.json and .env
- Check that API endpoint is reachable
- Ensure database is accessible

#### Scenario 2: Requests Being Queued But Not Retrying

**Symptoms:**
- Files piling up in .claude/queue/pending/
- No retry attempts in logs
- Queue depth increasing

**Diagnosis:**
```bash
# 1. Check queue directory
ls -la .claude/queue/pending/

# 2. View oldest queued request
cat $(ls -t .claude/queue/pending/*.json | tail -1) | jq .

# 3. Check nextRetryAt timestamp
cat $(ls -t .claude/queue/pending/*.json | tail -1) | jq .nextRetryAt

# 4. Check if hook is being triggered
tail -f .claude/logs/webhook-queue.log
```

**Solutions:**
- Queue is processed only when hook is triggered
- Manually trigger a hook (start new conversation) to process queue
- Check if nextRetryAt is in the future (not yet eligible)
- Verify queueManager.processQueue() is being called

#### Scenario 3: Database Records Show 'FAILED' Status

**Symptoms:**
- webhook_events records with status='FAILED'
- Error messages in error_message column
- Conversations not created

**Diagnosis:**
```sql
-- 1. Find failed events
SELECT request_id, event_type, session_id, error_message
FROM webhook_events
WHERE status = 'FAILED'
ORDER BY received_at DESC
LIMIT 10;

-- 2. Check for specific error patterns
SELECT error_message, COUNT(*)
FROM webhook_events
WHERE status = 'FAILED'
GROUP BY error_message;

-- 3. Find if conversation exists
SELECT c.id, c.session_id, c.title
FROM conversations c
WHERE c.session_id IN (
  SELECT session_id FROM webhook_events WHERE status = 'FAILED'
);
```

**Solutions:**
- Check error_message for specific error type
- Common errors:
  - "Validation error" → Invalid payload structure
  - "Unauthorized" → Wrong API key
  - "Timeout" → Slow database/network
  - "Duplicate key" → Request ID already exists

#### Scenario 4: Logs Not Being Written

**Symptoms:**
- .claude/logs/ directory empty
- No log files created
- Can't debug issues

**Diagnosis:**
```bash
# 1. Check directory exists
ls -la .claude/logs/

# 2. Check write permissions
touch .claude/logs/test.txt
rm .claude/logs/test.txt

# 3. Check if logger is initialized
grep "logger.info" .claude/hooks/capture-conversation.js

# 4. Test logger directly
node -e "
  const logger = require('./.claude/hooks/lib/logger');
  logger.info('Test message');
  logger.flush();
"
```

**Solutions:**
- Create directory: `mkdir -p .claude/logs`
- Check file permissions: `chmod 755 .claude/logs`
- Verify logger module is properly imported
- Ensure logger.flush() is called before exit

### Debugging Tools

#### Log Parser Script
```javascript
// parse-logs.js
const fs = require('fs');

const logFile = process.argv[2];
const lines = fs.readFileSync(logFile, 'utf8').split('\n');

const parsed = lines
  .filter(line => line.trim())
  .map(line => JSON.parse(line))
  .filter(entry => entry.level === 'error');

console.log(`Found ${parsed.length} errors:`);
parsed.forEach(entry => {
  console.log(`[${entry.timestamp}] ${entry.message}`);
  console.log(`  Request ID: ${entry.requestId}`);
  console.log(`  Error: ${entry.context?.error?.message || 'N/A'}`);
  console.log('---');
});
```

```bash
# Usage
node parse-logs.js .claude/logs/webhook-error.log
```

#### Database Query Script
```sql
-- webhook-stats.sql
-- Comprehensive webhook statistics

-- Overall status summary
SELECT status, COUNT(*) as count
FROM webhook_events
GROUP BY status
ORDER BY count DESC;

-- Recent activity (last hour)
SELECT event_type, status, COUNT(*) as count
FROM webhook_events
WHERE received_at > NOW() - INTERVAL '1 hour'
GROUP BY event_type, status;

-- Failed events by error type
SELECT
  SUBSTRING(error_message, 1, 50) as error_type,
  COUNT(*) as count
FROM webhook_events
WHERE status = 'FAILED'
GROUP BY error_type
ORDER BY count DESC;

-- Average processing time by event type
SELECT
  event_type,
  AVG(processing_time) as avg_ms,
  COUNT(*) as count
FROM webhook_events
WHERE processing_time IS NOT NULL
GROUP BY event_type;
```

```bash
# Usage
psql $DATABASE_URL -f webhook-stats.sql
```

---

## Testing

### Unit Tests

```javascript
// test/webhook-client.test.js
const webhookClient = require('./.claude/hooks/lib/webhook-client');

describe('WebhookClient', () => {
  test('should send request successfully', async () => {
    const payload = {
      event: 'SessionStart',
      sessionId: 'test-123'
    };

    const response = await webhookClient.send(payload);
    expect(response.success).toBe(true);
  });

  test('should retry on network error', async () => {
    // Mock network error
    // Verify retry logic
  });

  test('should not retry on 400 error', async () => {
    // Mock 400 response
    // Verify no retry
  });
});
```

### Integration Tests

```javascript
// test/webhook-integration.test.js
describe('Webhook Integration', () => {
  test('end-to-end SessionStart flow', async () => {
    // 1. Trigger hook
    // 2. Verify log files
    // 3. Verify database record
    // 4. Verify conversation created
  });

  test('retry flow for failed request', async () => {
    // 1. Trigger hook with mocked failure
    // 2. Verify enqueued
    // 3. Trigger hook again
    // 4. Verify retry attempted
  });
});
```

### Manual Testing Checklist

- [ ] SessionStart creates conversation
- [ ] UserPromptSubmit creates message
- [ ] PostToolUse creates tool_use
- [ ] Failed request is queued
- [ ] Queued request is retried
- [ ] Max retries moves to failed/
- [ ] Logs are written correctly
- [ ] Database records are created
- [ ] Request IDs are unique
- [ ] Trace IDs are consistent

---

## Common Tasks

### Manually Retry Failed Webhook

```bash
# 1. Find failed request in queue
FAILED_FILE=$(ls -t .claude/queue/failed/*.json | head -1)

# 2. View request details
cat $FAILED_FILE | jq .

# 3. Copy to pending (manual retry)
cp $FAILED_FILE .claude/queue/pending/

# 4. Trigger hook to process queue
# (start new Claude Code conversation)

# 5. Verify retry
tail -f .claude/logs/webhook-queue.log
```

### Clear Old Logs

```bash
# Archive logs older than 7 days
find .claude/logs -name "*.log" -mtime +7 -exec gzip {} \;

# Delete archived logs older than 30 days
find .claude/logs -name "*.log.gz" -mtime +30 -delete
```

### Purge Queue

```bash
# Move all queued requests to failed
mv .claude/queue/pending/*.json .claude/queue/failed/

# Or delete entirely (use with caution!)
rm .claude/queue/pending/*.json
```

### Export Webhook Events

```sql
-- Export to CSV
COPY (
  SELECT request_id, event_type, status, received_at, error_message
  FROM webhook_events
  WHERE received_at > NOW() - INTERVAL '7 days'
  ORDER BY received_at DESC
) TO '/tmp/webhook_events.csv' WITH CSV HEADER;
```

### Analyze Performance

```sql
-- Find slow requests
SELECT
  request_id,
  event_type,
  processing_time,
  received_at
FROM webhook_events
WHERE processing_time > 1000 -- Slower than 1 second
ORDER BY processing_time DESC
LIMIT 20;

-- Average processing time by hour
SELECT
  DATE_TRUNC('hour', received_at) as hour,
  AVG(processing_time) as avg_ms,
  COUNT(*) as count
FROM webhook_events
WHERE received_at > NOW() - INTERVAL '24 hours'
  AND processing_time IS NOT NULL
GROUP BY hour
ORDER BY hour DESC;
```

---

## Best Practices

### 1. Always Use Request IDs
```javascript
// Good
const requestId = IdGenerator.generateRequestId();
logger.info('Processing webhook', { requestId });
await sendWebhook(payload, { requestId });

// Bad
logger.info('Processing webhook');
await sendWebhook(payload);
```

### 2. Log All Important Operations
```javascript
// Good
logger.info('Webhook request started', { requestId });
logger.info('Payload built', { requestId, eventType });
logger.info('HTTP request sent', { requestId, url });
logger.info('Response received', { requestId, statusCode });

// Bad
// (silent execution, no logs)
```

### 3. Handle Errors Gracefully
```javascript
// Good
try {
  await sendWebhook(payload);
  logger.info('Webhook succeeded', { requestId });
} catch (error) {
  logger.error('Webhook failed', error, { requestId });
  await queueManager.enqueue(payload, error);
  // Don't throw - let Claude Code continue
}

// Bad
await sendWebhook(payload); // Unhandled error crashes Claude Code
```

### 4. Flush Logs on Exit
```javascript
// Good
process.on('exit', () => {
  logger.flush();
});

// Bad
// (logs may not be written before process exits)
```

### 5. Monitor Queue Depth
```javascript
// Good
const { pending } = queueManager.getQueueDepth();
if (pending > 100) {
  logger.warn('Queue depth high', { pending });
}

// Bad
// (unaware of queue growth)
```

### 6. Use Async Operations
```javascript
// Good
await logger.info('Message', context); // Non-blocking
await queueManager.enqueue(payload, error);

// Bad
fs.writeFileSync(logFile, message); // Blocking
```

### 7. Validate Before Processing
```javascript
// Good
if (!payload.sessionId) {
  logger.error('Missing sessionId', { requestId });
  return;
}

// Bad
// (process invalid payload, causes database error)
```

---

## Additional Resources

### Documentation
- Architecture: `docs/WEBHOOK_PHASE1_ARCHITECTURE.md`
- Implementation Log: `docs/WEBHOOK_IMPLEMENTATION_LOG.md`
- Troubleshooting: `docs/WEBHOOK_TROUBLESHOOTING.md`
- API Reference: `docs/WEBHOOK_API_REFERENCE.md`

### Code Locations
- Hook Script: `.claude/hooks/capture-conversation.js`
- Core Libraries: `.claude/hooks/lib/`
- API Route: `src/app/api/claude-hooks/route.ts`
- Database Schema: `prisma/schema.prisma`

### External Links
- Prisma Docs: https://www.prisma.io/docs
- Next.js API Routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Node.js HTTP: https://nodejs.org/api/http.html

---

**Last Updated:** 2025-09-30
**Maintainer:** Development Team
**Questions:** Check troubleshooting guide or file an issue
