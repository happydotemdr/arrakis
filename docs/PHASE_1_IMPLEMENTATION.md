# PHASE 1: IMMEDIATE FIXES - Implementation Guide

**Estimated Time:** 2 hours
**Impact:** HIGH - Eliminates most critical failure modes
**Risk:** LOW - All changes are backwards compatible

---

## PRE-IMPLEMENTATION CHECKLIST

- [ ] Backup current `.claude/settings.json`
- [ ] Backup current hook script
- [ ] Backup database (or ensure point-in-time recovery is enabled)
- [ ] Test environment variables are accessible
- [ ] Verify API endpoint is reachable

---

## STEP 1: Database Schema Updates (15 minutes)

### 1.1 Add WebhookEvent Model

**File:** `c:\projects\arrakis\prisma\schema.prisma`

Add this model at the end of the file:

```prisma
// Webhook event tracking for reliability and debugging
model WebhookEvent {
  id            String    @id @default(cuid())
  requestId     String    @unique @map("request_id") // From hook script for tracing
  event         String    // SessionStart, UserPromptSubmit, etc.
  sessionId     String?   @map("session_id")
  payload       Json      // Full webhook payload
  status        String    // received, processing, completed, failed
  errorMessage  String?   @map("error_message") @db.Text
  retryCount    Int       @default(0) @map("retry_count")
  receivedAt    DateTime  @default(now()) @map("received_at")
  processedAt   DateTime? @map("processed_at")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  @@index([sessionId])
  @@index([event, status])
  @@index([receivedAt])
  @@index([status, retryCount])
  @@map("webhook_events")
}
```

### 1.2 Add Unique Constraint to Conversation

Update the `Conversation` model to add a unique constraint:

```prisma
model Conversation {
  // ... existing fields ...

  @@unique([sessionId], map: "unique_session_id")
  @@index([sessionId, startedAt])
}
```

### 1.3 Run Migration

```bash
# Generate migration
npx prisma migrate dev --name add_webhook_tracking

# Or if in production
npx prisma migrate deploy
```

**Expected Output:**
```
✓ Generated Prisma Client
✓ Database migration completed
```

---

## STEP 2: Enhanced Hook Script (30 minutes)

### 2.1 Create Required Directories

The hook script will need these directories:

```javascript
// Add to top of capture-conversation.js after requires
const path = require('path');

// Configuration paths
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR;
const LOG_DIR = path.join(PROJECT_DIR, '.claude', 'logs');
const QUEUE_DIR = path.join(PROJECT_DIR, '.claude', 'queue');

// Ensure directories exist
function ensureDirectories() {
  [LOG_DIR, QUEUE_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

ensureDirectories();
```

### 2.2 Add Structured Logging

Replace console.log statements with structured logging:

```javascript
// Add after configuration
const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

function log(level, message, meta = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    requestId: REQUEST_ID,
    event: HOOK_ENV.event,
    sessionId: HOOK_ENV.sessionId,
    message,
    ...meta
  };

  // Write to file
  const logFile = path.join(LOG_DIR, `capture-${new Date().toISOString().split('T')[0]}.log`);
  try {
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  } catch (error) {
    // Fallback to console if file write fails
    console.error('Failed to write log:', error.message);
  }

  // Also output to console if debug enabled
  if (CONFIG.debug || level === LOG_LEVELS.ERROR) {
    const prefix = `[Claude Hook ${level.toUpperCase()}]`;
    console.log(prefix, JSON.stringify(logEntry, null, 2));
  }
}
```

### 2.3 Add Request ID Generation

```javascript
// Add near top of file
const crypto = require('crypto');

function generateRequestId() {
  return `hook-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

const REQUEST_ID = generateRequestId();
```

### 2.4 Add Failed Request Queue

```javascript
// Queue failed requests for retry
async function queueFailedRequest(payload, error) {
  const queueFile = path.join(QUEUE_DIR, `${Date.now()}-${REQUEST_ID}.json`);

  const queueData = {
    requestId: REQUEST_ID,
    payload,
    error: {
      message: error.message,
      stack: error.stack
    },
    timestamp: new Date().toISOString(),
    retryCount: 0,
    nextRetryAt: new Date(Date.now() + 60000).toISOString() // Retry in 1 minute
  };

  try {
    fs.writeFileSync(queueFile, JSON.stringify(queueData, null, 2));
    log(LOG_LEVELS.INFO, 'Request queued for retry', {
      queueFile,
      error: error.message
    });
  } catch (writeError) {
    log(LOG_LEVELS.ERROR, 'Failed to queue request', {
      queueError: writeError.message,
      originalError: error.message
    });
  }
}

// Process queued requests (run at script start)
async function processQueuedRequests() {
  if (!fs.existsSync(QUEUE_DIR)) {
    return;
  }

  const files = fs.readdirSync(QUEUE_DIR).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    return;
  }

  log(LOG_LEVELS.INFO, `Found ${files.length} queued requests to retry`);

  for (const file of files) {
    const queueFile = path.join(QUEUE_DIR, file);

    try {
      const queueData = JSON.parse(fs.readFileSync(queueFile, 'utf8'));

      // Check if it's time to retry
      if (new Date(queueData.nextRetryAt) > new Date()) {
        continue; // Not yet time to retry
      }

      // Check retry limit
      if (queueData.retryCount >= 5) {
        log(LOG_LEVELS.ERROR, 'Max retries exceeded, moving to failed', {
          queueFile,
          retryCount: queueData.retryCount
        });

        // Move to failed directory
        const failedDir = path.join(PROJECT_DIR, '.claude', 'failed');
        if (!fs.existsSync(failedDir)) {
          fs.mkdirSync(failedDir, { recursive: true });
        }
        fs.renameSync(queueFile, path.join(failedDir, file));
        continue;
      }

      // Attempt retry
      log(LOG_LEVELS.INFO, 'Retrying queued request', {
        requestId: queueData.requestId,
        retryCount: queueData.retryCount + 1
      });

      const result = await makeHttpRequest(queueData.payload);

      // Success - remove from queue
      fs.unlinkSync(queueFile);
      log(LOG_LEVELS.INFO, 'Queued request succeeded', {
        requestId: queueData.requestId
      });

    } catch (retryError) {
      // Update retry count and next retry time
      try {
        const queueData = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
        queueData.retryCount += 1;
        queueData.nextRetryAt = new Date(
          Date.now() + Math.pow(2, queueData.retryCount) * 60000
        ).toISOString(); // Exponential backoff
        queueData.lastError = retryError.message;

        fs.writeFileSync(queueFile, JSON.stringify(queueData, null, 2));

        log(LOG_LEVELS.WARN, 'Retry failed, will retry later', {
          queueFile,
          retryCount: queueData.retryCount,
          nextRetryAt: queueData.nextRetryAt
        });
      } catch (updateError) {
        log(LOG_LEVELS.ERROR, 'Failed to update queue file', {
          queueFile,
          error: updateError.message
        });
      }
    }
  }
}
```

### 2.5 Update Main Function

```javascript
async function main() {
  try {
    // Process any queued requests first
    await processQueuedRequests();

    // Check if hook is enabled
    if (!CONFIG.enabled) {
      log(LOG_LEVELS.INFO, 'Hook disabled via CLAUDE_HOOK_ENABLED');
      return;
    }

    // Validate required environment
    if (!HOOK_ENV.event) {
      log(LOG_LEVELS.ERROR, 'CLAUDE_HOOK_EVENT not provided');
      process.exit(1);
    }

    log(LOG_LEVELS.INFO, 'Processing hook event', {
      event: HOOK_ENV.event,
      sessionId: HOOK_ENV.sessionId
    });

    // Build hook payload
    const payload = buildHookPayload();

    // Send hook data to API
    const result = await sendHookData(payload);

    log(LOG_LEVELS.INFO, 'Hook processed successfully', {
      result
    });

  } catch (error) {
    log(LOG_LEVELS.ERROR, 'Hook processing failed', {
      error: error.message,
      stack: error.stack
    });

    // Queue for retry
    if (HOOK_ENV.event && payload) {
      await queueFailedRequest(payload, error);
    }

    // Exit with error code if FAIL_SILENTLY is false
    if (process.env.CLAUDE_HOOK_FAIL_SILENTLY === 'false') {
      process.exit(1);
    }

    process.exit(0); // Silent failure for backwards compatibility
  }
}
```

### 2.6 Update HTTP Request to Include Request ID

```javascript
function makeHttpRequest(payload) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(CONFIG.apiUrl);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const postData = JSON.stringify(payload);

      const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Claude-Code-Hook/2.0',
        'X-Request-ID': REQUEST_ID,  // ← ADD THIS
      };

      // Add API key if configured
      if (CONFIG.apiKey) {
        headers['Authorization'] = `Bearer ${CONFIG.apiKey}`;
      }

      // Rest of function stays the same...
```

---

## STEP 3: Enhanced API Route (30 minutes)

### 3.1 Update API Route to Log All Events

**File:** `c:\projects\arrakis\src\app\api\claude-hooks\route.ts`

Replace the entire POST function:

```typescript
export async function POST(request: NextRequest) {
  // Extract request ID from header or generate new one
  const requestId = request.headers.get('x-request-id') || `api-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  try {
    // Verify API key for production
    if (process.env.NODE_ENV === 'production') {
      const authHeader = request.headers.get('authorization')
      const providedKey = authHeader?.replace('Bearer ', '')

      if (!CLAUDE_HOOK_API_KEY) {
        console.error('[Claude Hook] CLAUDE_HOOK_API_KEY not configured')
        return NextResponse.json(
          { success: false, error: 'Server misconfigured', requestId },
          { status: 500 }
        )
      }

      if (providedKey !== CLAUDE_HOOK_API_KEY) {
        console.warn('[Claude Hook] Unauthorized request attempt')

        // Still log the attempt for debugging
        await db.webhookEvent.create({
          data: {
            requestId,
            event: 'unknown',
            payload: {},
            status: 'failed',
            errorMessage: 'Unauthorized - invalid API key',
          }
        }).catch(err => {
          console.error('[Claude Hook] Failed to log unauthorized attempt:', err);
        });

        return NextResponse.json(
          { success: false, error: 'Unauthorized', requestId },
          { status: 401 }
        )
      }
    }

    // Parse and validate the request body
    const body = await request.json()
    const payload = hookPayloadSchema.parse(body) as AnyClaudeHookPayload

    console.log(`[Claude Hook] ${payload.event}:`, {
      requestId,
      sessionId: payload.sessionId,
      timestamp: payload.timestamp,
    })

    // Log webhook event IMMEDIATELY (before any processing)
    const webhookEvent = await db.webhookEvent.create({
      data: {
        requestId,
        event: payload.event,
        sessionId: payload.sessionId,
        payload: body,
        status: 'received',
        receivedAt: new Date(),
      }
    });

    console.log(`[Claude Hook] Logged webhook event: ${webhookEvent.id}`);

    // Process the hook event
    let result;
    try {
      // Update status to processing
      await db.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: 'processing' }
      });

      result = await processHookEvent(payload);

      // Mark as completed
      await db.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: 'completed',
          processedAt: new Date()
        }
      });

      console.log(`[Claude Hook] Successfully processed: ${webhookEvent.id}`);

    } catch (processingError) {
      // Mark as failed but don't throw
      await db.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: 'failed',
          errorMessage: processingError instanceof Error ? processingError.message : String(processingError),
          processedAt: new Date()
        }
      });

      console.error(`[Claude Hook] Processing failed:`, processingError);

      // Re-throw to return error response
      throw processingError;
    }

    return NextResponse.json({
      success: true,
      requestId,
      webhookEventId: webhookEvent.id,
      message: `Processed ${payload.event} event`,
      data: result,
    })

  } catch (error) {
    console.error('[Claude Hook] Error processing hook:', error)

    // Return error response with request ID for tracing
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : error instanceof Error
        ? error.message
        : 'Unknown error processing hook'

    return NextResponse.json(
      {
        success: false,
        requestId,
        error: errorMessage,
        ...(process.env.NODE_ENV !== 'production' && {
          details: error instanceof Error ? error.stack : String(error)
        })
      },
      { status: 500 }
    )
  }
}
```

### 3.2 Make handleSessionStart Idempotent

Update the function to use `upsert`:

```typescript
async function handleSessionStart(payload: SessionStartPayload) {
  if (!payload.sessionId) {
    throw new Error('SessionStart event missing sessionId')
  }

  try {
    // Use upsert to handle duplicate SessionStart events
    const conversation = await db.conversation.upsert({
      where: {
        sessionId: payload.sessionId
      },
      update: {
        // If exists, just update metadata
        metadata: {
          ...(await db.conversation.findUnique({
            where: { sessionId: payload.sessionId },
            select: { metadata: true }
          }))?.metadata as Record<string, any> || {},
          userInfo: payload.userInfo,
          transcriptPath: payload.transcriptPath,
          lastSeenAt: new Date(),
          ...payload.metadata,
        }
      },
      create: {
        sessionId: payload.sessionId,
        projectPath: payload.projectPath,
        title: `Session ${payload.sessionId.slice(-8)}`,
        startedAt: new Date(payload.timestamp),
        metadata: {
          userInfo: payload.userInfo,
          transcriptPath: payload.transcriptPath,
          ...payload.metadata,
        },
      }
    });

    const isNewConversation = conversation.createdAt.getTime() === conversation.updatedAt.getTime();

    console.log(
      `[Claude Hook] ${isNewConversation ? 'Created' : 'Updated'} conversation: ${conversation.id}`
    );

    return {
      conversationId: conversation.id,
      created: isNewConversation
    };
  } catch (error) {
    console.error('[Claude Hook] Error in handleSessionStart:', error);
    throw error;
  }
}
```

---

## STEP 4: Update Configuration (5 minutes)

### 4.1 Update `.claude/settings.json`

```json
{
  "env": {
    "CLAUDE_HOOK_API_URL": "https://arrakis-prod.onrender.com/api/claude-hooks",
    "CLAUDE_HOOK_API_KEY": "d9997bce251f45d313ce1fc86565ed9f4bc68bbb45a34691fbed8d91e3d59776",
    "CLAUDE_HOOK_DEBUG": "true",
    "CLAUDE_HOOK_ENABLED": "true",
    "CLAUDE_HOOK_FAIL_SILENTLY": "false",
    "CLAUDE_HOOK_TIMEOUT": "10000",
    "CLAUDE_HOOK_RETRY_ATTEMPTS": "3",
    "CLAUDE_HOOK_RETRY_DELAY": "1000"
  }
}
```

**Key Changes:**
- `CLAUDE_HOOK_FAIL_SILENTLY`: Changed from `"true"` to `"false"`
- `CLAUDE_HOOK_RETRY_ATTEMPTS`: Increased from `"1"` to `"3"`

---

## STEP 5: Deploy & Test (40 minutes)

### 5.1 Deploy Database Migration

```bash
cd c:\projects\arrakis
npm run db:deploy
```

### 5.2 Deploy Updated Code

```bash
git add .
git commit -m "feat: Add webhook tracking and enhanced error handling

- Add WebhookEvent model for tracking all webhook events
- Add structured logging to hook script
- Add file-based queue for failed requests
- Make SessionStart handler idempotent with upsert
- Add request ID tracing throughout stack
- Change FAIL_SILENTLY to false for better error visibility"

git push origin master
```

### 5.3 Test Hook Execution

1. **Start a new Claude Code conversation**

2. **Check logs in real-time:**
```bash
tail -f c:\projects\arrakis\.claude\logs\capture-$(date +%Y-%m-%d).log
```

3. **Verify webhook events in database:**
```sql
SELECT
  event,
  status,
  session_id,
  error_message,
  received_at
FROM webhook_events
ORDER BY received_at DESC
LIMIT 10;
```

4. **Check for queued requests:**
```bash
ls c:\projects\arrakis\.claude\queue\
```

### 5.4 Test Error Scenarios

**Test 1: Wrong API Key**
```bash
# Temporarily change API key in settings.json
# Start conversation
# Check that event is queued
ls .claude/queue/
```

**Test 2: Network Timeout**
```bash
# Set very low timeout
"CLAUDE_HOOK_TIMEOUT": "1"
# Start conversation
# Verify retry logic works
```

**Test 3: Large Payload**
```bash
# Create a very long message (>100KB)
# Verify it's handled or rejected gracefully
```

---

## STEP 6: Verification Checklist

After deployment, verify:

- [ ] New conversations appear in database within 2 seconds
- [ ] WebhookEvent records are created for all hook calls
- [ ] Log files are being written to `.claude/logs/`
- [ ] Failed requests are queued in `.claude/queue/`
- [ ] Queued requests are retried on next hook call
- [ ] Request IDs match between logs, queue files, and database
- [ ] Duplicate SessionStart events don't create duplicate conversations
- [ ] Frontend shows new conversations (may require page refresh)
- [ ] No errors in server logs
- [ ] All webhook events have status 'completed' (not 'failed')

---

## ROLLBACK PLAN

If issues occur:

1. **Revert configuration:**
```bash
cd c:\projects\arrakis\.claude
git checkout HEAD settings.json
```

2. **Revert code:**
```bash
git revert HEAD
git push origin master
```

3. **Revert database migration (if needed):**
```bash
npx prisma migrate resolve --rolled-back [migration-name]
```

---

## MONITORING COMMANDS

### Check Webhook Status

```sql
-- Overall health
SELECT
  status,
  COUNT(*) as count,
  MAX(received_at) as latest
FROM webhook_events
GROUP BY status;

-- Failed events
SELECT
  request_id,
  event,
  session_id,
  error_message,
  retry_count,
  received_at
FROM webhook_events
WHERE status = 'failed'
ORDER BY received_at DESC;

-- Recent events by type
SELECT
  event,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (processed_at - received_at))) as avg_processing_time_seconds
FROM webhook_events
WHERE received_at > NOW() - INTERVAL '1 hour'
  AND processed_at IS NOT NULL
GROUP BY event;
```

### Check Queue Status

```bash
# Count queued requests
ls .claude/queue/*.json | wc -l

# Show oldest queued request
ls -lt .claude/queue/*.json | tail -1

# View details of queued request
cat .claude/queue/[first-file].json | jq .
```

### Check Logs

```bash
# Today's log
tail -f .claude/logs/capture-$(date +%Y-%m-%d).log

# Count errors today
grep '"level":"error"' .claude/logs/capture-$(date +%Y-%m-%d).log | wc -l

# View recent errors
grep '"level":"error"' .claude/logs/capture-$(date +%Y-%m-%d).log | tail -5 | jq .
```

---

## EXPECTED IMPROVEMENTS

After Phase 1 implementation:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Silent failures | Common | None | 100% |
| Data loss on errors | High | Low | ~90% |
| Debugging difficulty | High | Low | Easy |
| Duplicate SessionStart handling | Creates duplicates | Idempotent | 100% |
| Error visibility | None | Full | 100% |
| Retry capability | Manual only | Automatic | 100% |
| Traceability | None | Full (request ID) | 100% |

---

## NEXT STEPS

After Phase 1 is stable:

1. **Phase 2:** Build monitoring dashboard (1 day)
   - View webhook events in UI
   - Manual retry buttons
   - Real-time status indicators

2. **Phase 3:** Add real-time updates (2-3 days)
   - Server-Sent Events for live updates
   - Auto-refresh conversation list
   - Connection status indicator

3. **Phase 4:** Self-healing infrastructure (3-5 days)
   - Background job processor for failed events
   - Automated health checks
   - Alert system

---

## SUPPORT

If you encounter issues:

1. Check logs: `.claude/logs/capture-YYYY-MM-DD.log`
2. Check queue: `.claude/queue/*.json`
3. Check database: `SELECT * FROM webhook_events WHERE status='failed'`
4. Check server logs: Render.com dashboard
5. Verify API key is correct in both settings.json and .env

**Common Issues:**

| Issue | Cause | Solution |
|-------|-------|----------|
| "Request ID already exists" | Duplicate webhook call | Check for duplicate hooks in settings.json |
| Queue files piling up | API endpoint unreachable | Check API URL and network connectivity |
| No webhook_events records | Migration not run | Run `npm run db:deploy` |
| Logs not being written | Directory doesn't exist | Check that `.claude/logs/` directory exists |