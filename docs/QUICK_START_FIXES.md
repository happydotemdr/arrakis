# QUICK START: Critical Fixes (2 Hours)

**Goal:** Stop silent failures and add basic reliability
**Time:** 2 hours
**Risk:** LOW
**Impact:** HIGH

---

## TL;DR - What We're Fixing

| Problem | Solution | Time |
|---------|----------|------|
| Silent failures | Add structured logging | 20 min |
| Lost events | Add file-based queue | 20 min |
| No traceability | Add request IDs | 10 min |
| Duplicate conversations | Make SessionStart idempotent | 15 min |
| No audit trail | Add WebhookEvent table | 20 min |
| Stale error messages | Better error responses | 10 min |
| **TOTAL** | | **95 min + 25 min buffer** |

---

## BEFORE YOU START

### Prerequisites

- [ ] Node.js installed
- [ ] PostgreSQL database accessible
- [ ] Prisma CLI installed (`npm install -g prisma`)
- [ ] Git configured
- [ ] Access to Render.com dashboard

### Backup Checklist

```bash
# 1. Backup current hook script
cp .claude/hooks/capture-conversation.js .claude/hooks/capture-conversation.js.backup

# 2. Backup settings
cp .claude/settings.json .claude/settings.json.backup

# 3. Export current database (optional but recommended)
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql
```

---

## STEP-BY-STEP GUIDE

### STEP 1: Database Schema (15 minutes)

**File:** `c:\projects\arrakis\prisma\schema.prisma`

**1.1 Add WebhookEvent Model**

Add at the end of the file:

```prisma
// Webhook event tracking for reliability and debugging
model WebhookEvent {
  id            String    @id @default(cuid())
  requestId     String    @unique @map("request_id")
  event         String
  sessionId     String?   @map("session_id")
  payload       Json
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

**1.2 Update Conversation Model**

Find the `Conversation` model and add this line before the closing brace:

```prisma
model Conversation {
  // ... existing fields ...

  @@unique([sessionId], map: "unique_session_id")  // ADD THIS LINE
}
```

**1.3 Run Migration**

```bash
cd c:\projects\arrakis
npx prisma migrate dev --name add_webhook_tracking
```

**Expected output:**
```
✓ Generated Prisma Client
✓ Database migration completed
```

---

### STEP 2: Hook Script Updates (40 minutes)

**File:** `.claude/hooks/capture-conversation.js`

**2.1 Add Required Imports**

After `const { URL } = require('url');` add:

```javascript
const path = require('path');
const crypto = require('crypto');
```

**2.2 Add Configuration for Logging**

After the `CONFIG` object, add:

```javascript
// Paths for logging and queue
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const LOG_DIR = path.join(PROJECT_DIR, '.claude', 'logs');
const QUEUE_DIR = path.join(PROJECT_DIR, '.claude', 'queue');

// Generate unique request ID
function generateRequestId() {
  return `hook-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

const REQUEST_ID = generateRequestId();

// Ensure directories exist
function ensureDirectories() {
  [LOG_DIR, QUEUE_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (error) {
        console.error(`Failed to create directory ${dir}:`, error.message);
      }
    }
  });
}

// Log levels
const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

// Structured logging function
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
  try {
    const logFile = path.join(LOG_DIR, `capture-${new Date().toISOString().split('T')[0]}.log`);
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  } catch (error) {
    console.error('Failed to write log:', error.message);
  }

  // Also output to console if debug enabled or error level
  if (CONFIG.debug || level === LOG_LEVELS.ERROR) {
    const prefix = `[Claude Hook ${level.toUpperCase()}]`;
    console.log(prefix, JSON.stringify(logEntry));
  }
}
```

**2.3 Add Queue Functions**

Add these functions before the `main()` function:

```javascript
// Queue failed request for retry
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

// Process queued requests
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
        continue;
      }

      // Check retry limit
      if (queueData.retryCount >= 5) {
        log(LOG_LEVELS.ERROR, 'Max retries exceeded', {
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

      await makeHttpRequest(queueData.payload);

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
        ).toISOString();
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

**2.4 Update main() Function**

Replace the entire `main()` function:

```javascript
async function main() {
  try {
    // Ensure directories exist
    ensureDirectories();

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

    // Queue for retry if we have payload
    if (HOOK_ENV.event && typeof payload !== 'undefined') {
      await queueFailedRequest(payload, error);
    }

    // Exit with error code if FAIL_SILENTLY is false
    if (process.env.CLAUDE_HOOK_FAIL_SILENTLY === 'false') {
      process.exit(1);
    }

    process.exit(0);
  }
}
```

**2.5 Update makeHttpRequest to Add Request ID**

Find the `headers` object in `makeHttpRequest()` and add:

```javascript
const headers = {
  'Content-Type': 'application/json',
  'Content-Length': Buffer.byteLength(postData),
  'User-Agent': 'Claude-Code-Hook/2.0',
  'X-Request-ID': REQUEST_ID,  // ← ADD THIS LINE
};
```

---

### STEP 3: API Route Updates (25 minutes)

**File:** `c:\projects\arrakis\src\app\api\claude-hooks\route.ts`

**3.1 Update POST Function**

Replace the entire `POST` function with this version:

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

**3.2 Update handleSessionStart for Idempotency**

Replace the `handleSessionStart` function:

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

### STEP 4: Update Configuration (5 minutes)

**File:** `.claude/settings.json`

Find the `env` section and update these values:

```json
{
  "env": {
    "CLAUDE_HOOK_FAIL_SILENTLY": "false",
    "CLAUDE_HOOK_RETRY_ATTEMPTS": "3"
  }
}
```

---

### STEP 5: Deploy (10 minutes)

**5.1 Commit Changes**

```bash
git add .
git commit -m "feat: Add webhook tracking and enhanced error handling

- Add WebhookEvent model for tracking all webhook events
- Add structured logging to hook script with request IDs
- Add file-based queue for failed requests with exponential backoff
- Make SessionStart handler idempotent with upsert
- Add request ID tracing throughout stack
- Change FAIL_SILENTLY to false for better error visibility

Phase 1 of bulletproof architecture implementation."

git push origin master
```

**5.2 Monitor Deployment**

Watch Render.com dashboard for deployment progress.

---

### STEP 6: Verify (10 minutes)

**6.1 Start New Claude Conversation**

Open a new conversation in Claude Code.

**6.2 Check Logs**

```bash
# View hook logs
cat c:\projects\arrakis\.claude\logs\capture-$(date +%Y-%m-%d).log | tail -20

# Should see:
# - "Processing hook event" with SessionStart
# - "Hook processed successfully"
# - Request ID in all entries
```

**6.3 Check Database**

```sql
-- Check webhook events
SELECT
  request_id,
  event,
  status,
  error_message,
  received_at
FROM webhook_events
ORDER BY received_at DESC
LIMIT 5;

-- Should see:
-- - SessionStart event with status 'completed'
-- - No error_message
```

**6.4 Check Conversations**

```sql
-- Check conversation was created
SELECT
  session_id,
  title,
  started_at,
  created_at
FROM conversations
ORDER BY created_at DESC
LIMIT 5;
```

---

## TROUBLESHOOTING

### Issue: No webhook_events Records

**Cause:** Migration not run
**Solution:**
```bash
npx prisma migrate deploy
npx prisma generate
```

### Issue: Logs Not Being Written

**Cause:** Directory doesn't exist or permissions
**Solution:**
```bash
mkdir -p .claude/logs
mkdir -p .claude/queue
chmod 755 .claude/logs
chmod 755 .claude/queue
```

### Issue: "Request ID already exists" Error

**Cause:** Duplicate webhook event
**Solution:** This is expected - the system will update the existing event

### Issue: Queue Files Piling Up

**Cause:** API endpoint unreachable
**Solution:**
1. Check API URL in settings.json
2. Check API key is correct
3. Check network connectivity
4. View queue file: `cat .claude/queue/[filename].json | jq .`

---

## WHAT YOU JUST FIXED

| Before | After |
|--------|-------|
| ❌ Silent failures | ✅ All errors logged |
| ❌ Lost events | ✅ Queued and retried |
| ❌ No traceability | ✅ Request ID tracking |
| ❌ Duplicate conversations | ✅ Idempotent operations |
| ❌ No audit trail | ✅ WebhookEvent table |
| ❌ Hard to debug | ✅ Structured logs |

---

## NEXT STEPS

1. **Monitor for 1-2 days** - Ensure stability
2. **Review webhook_events table** - Check success rate
3. **Review log files** - Look for patterns
4. **Proceed to Phase 2** - Build monitoring dashboard

---

## QUICK COMMANDS

```bash
# View today's logs
tail -f .claude/logs/capture-$(date +%Y-%m-%d).log

# Count log entries by level
grep -o '"level":"[^"]*"' .claude/logs/capture-*.log | sort | uniq -c

# View queued requests
ls -lh .claude/queue/

# Check webhook event status
psql $DATABASE_URL -c "SELECT status, COUNT(*) FROM webhook_events GROUP BY status;"

# View failed events
psql $DATABASE_URL -c "SELECT * FROM webhook_events WHERE status='failed' ORDER BY received_at DESC LIMIT 10;"
```

---

## DONE!

You now have a much more reliable system with:
- ✅ Zero silent failures
- ✅ Automatic retry
- ✅ Full traceability
- ✅ Structured logging
- ✅ Complete audit trail

**Time to celebrate!** 🎉

Then move on to Phase 2 for the monitoring dashboard.