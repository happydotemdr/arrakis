# Troubleshooting: Webhook Capture System

**Purpose:** Diagnose and resolve common issues with the webhook capture system
**Last Updated:** 2025-09-30

---

## Table of Contents

1. [Quick Diagnostic](#quick-diagnostic)
2. [Common Issues](#common-issues)
3. [Error Messages](#error-messages)
4. [System Health Checks](#system-health-checks)
5. [Recovery Procedures](#recovery-procedures)
6. [Getting Help](#getting-help)

---

## Quick Diagnostic

### 5-Minute Health Check

Run these commands to quickly assess system health:

```bash
# 1. Check if logs exist
ls -la c:\projects\arrakis\.claude\logs\

# 2. Check for recent errors
tail -5 c:\projects\arrakis\.claude\logs\webhook-error.log

# 3. Check queue depth
ls c:\projects\arrakis\.claude\queue\pending\*.json 2>/dev/null | wc -l

# 4. Check database connectivity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM webhook_events;"

# 5. Check recent webhook events
psql $DATABASE_URL -c "SELECT status, COUNT(*) FROM webhook_events WHERE received_at > NOW() - INTERVAL '1 hour' GROUP BY status;"
```

### Red Flags

🚨 **Immediate Action Required:**
- More than 50 files in .claude/queue/pending/
- More than 100 failed webhook_events in last hour
- Log files not updated in last 10 minutes
- All webhook_events have status='FAILED'

⚠️ **Investigate Soon:**
- 5-10 files in queue pending
- 10-20 failed webhook_events in last hour
- Error log growing rapidly
- Slow processing times (>2 seconds)

✅ **Healthy:**
- 0-5 files in queue
- <5 failed events per hour
- Recent log entries
- Processing times <500ms

---

## Common Issues

### Issue 1: Hooks Not Capturing Conversations

**Symptoms:**
- New conversations don't appear in database
- No log files being created
- .claude/logs/ directory is empty

**Diagnosis Steps:**

```bash
# Step 1: Verify directory structure
ls -la .claude/
ls -la .claude/logs/
ls -la .claude/queue/

# Step 2: Check if hook is enabled
grep "CLAUDE_HOOK_ENABLED" .claude/settings.json

# Step 3: Check environment variables
echo "API URL: $CLAUDE_HOOK_API_URL"
echo "API Key: ${CLAUDE_HOOK_API_KEY:0:10}..."

# Step 4: Test hook manually
cd .claude/hooks
CLAUDE_HOOK_EVENT="SessionStart" \
CLAUDE_SESSION_ID="test-123" \
CLAUDE_PROJECT_DIR="c:\projects\arrakis" \
CLAUDE_HOOK_DEBUG="true" \
node capture-conversation.js

# Step 5: Check hook output
echo "Exit code: $?"
cat .claude/logs/webhook-debug.log
```

**Common Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Hook disabled | Set `CLAUDE_HOOK_ENABLED="true"` in .claude/settings.json |
| Missing directories | Run `mkdir -p .claude/logs .claude/queue/{pending,processing,failed}` |
| Wrong API URL | Verify `CLAUDE_HOOK_API_URL` in settings.json |
| Missing API key | Add `CLAUDE_HOOK_API_KEY` to settings.json and .env |
| Hook script error | Check `.claude/logs/webhook-error.log` for details |

**Resolution:**

```bash
# Fix 1: Enable hook
# Edit .claude/settings.json:
"CLAUDE_HOOK_ENABLED": "true"

# Fix 2: Create directories
mkdir -p .claude/logs .claude/queue/{pending,processing,failed}

# Fix 3: Verify API URL
# Edit .claude/settings.json:
"CLAUDE_HOOK_API_URL": "https://arrakis-prod.onrender.com/api/claude-hooks"

# Fix 4: Add API key
# Edit .claude/settings.json:
"CLAUDE_HOOK_API_KEY": "your-api-key-here"

# Also add to .env:
echo 'CLAUDE_HOOK_API_KEY="your-api-key-here"' >> .env.local

# Test again
node .claude/hooks/capture-conversation.js
```

---

### Issue 2: Requests Stuck in Queue

**Symptoms:**
- Files accumulating in .claude/queue/pending/
- No retry attempts in logs
- Queue depth increasing over time

**Diagnosis Steps:**

```bash
# Step 1: Check queue status
ls -la .claude/queue/pending/

# Step 2: View oldest queued request
cat $(ls -t .claude/queue/pending/*.json | tail -1) | jq .

# Step 3: Check nextRetryAt timestamp
cat $(ls -t .claude/queue/pending/*.json | tail -1) | jq .nextRetryAt

# Step 4: Check current time
date -u +"%Y-%m-%dT%H:%M:%SZ"

# Step 5: Check if queue processing is running
grep "Processing queue" .claude/logs/webhook-queue.log | tail -5

# Step 6: Test API endpoint
curl -X POST $CLAUDE_HOOK_API_URL \
  -H "Authorization: Bearer $CLAUDE_HOOK_API_KEY" \
  -d '{"event":"SessionStart","sessionId":"test"}'
```

**Common Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| nextRetryAt in future | Wait until retry time, or manually reset |
| API endpoint down | Check server status, restart if needed |
| Queue processing not called | Hook must be triggered to process queue |
| Max retries exceeded | Move to failed/, investigate root cause |

**Resolution:**

```bash
# Fix 1: Manually trigger retry
# (Start new Claude Code conversation to trigger hook)

# Fix 2: Reset retry time (manual intervention)
for f in .claude/queue/pending/*.json; do
  jq '.nextRetryAt = "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"' "$f" > "$f.tmp"
  mv "$f.tmp" "$f"
done

# Fix 3: Test API endpoint
curl -v -X POST $CLAUDE_HOOK_API_URL \
  -H "Authorization: Bearer $CLAUDE_HOOK_API_KEY" \
  -d '{"event":"SessionStart","sessionId":"test-123","timestamp":"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}'

# Fix 4: Move old requests to failed
find .claude/queue/pending -name "*.json" -mtime +7 -exec mv {} .claude/queue/failed/ \;
```

---

### Issue 3: Database Records Show 'FAILED' Status

**Symptoms:**
- webhook_events records with status='FAILED'
- Error messages in error_message column
- Conversations not being created

**Diagnosis Steps:**

```sql
-- Step 1: Find recent failed events
SELECT
  request_id,
  event_type,
  session_id,
  error_message,
  received_at
FROM webhook_events
WHERE status = 'FAILED'
  AND received_at > NOW() - INTERVAL '1 hour'
ORDER BY received_at DESC
LIMIT 10;

-- Step 2: Group failures by error type
SELECT
  SUBSTRING(error_message, 1, 50) as error_type,
  COUNT(*) as count
FROM webhook_events
WHERE status = 'FAILED'
  AND received_at > NOW() - INTERVAL '24 hours'
GROUP BY error_type
ORDER BY count DESC;

-- Step 3: Check if conversations exist
SELECT c.id, c.session_id, c.title, c.created_at
FROM conversations c
WHERE c.session_id IN (
  SELECT session_id
  FROM webhook_events
  WHERE status = 'FAILED'
    AND session_id IS NOT NULL
  LIMIT 10
);
```

**Common Error Messages:**

| Error Message | Cause | Solution |
|--------------|-------|----------|
| "Unauthorized - invalid API key" | Wrong/missing API key | Update CLAUDE_HOOK_API_KEY |
| "Validation error: sessionId required" | Missing required field | Check payload structure |
| "Duplicate key value violates unique constraint" | Duplicate request ID | Check for duplicate hook calls |
| "Connection timeout" | Slow database/network | Increase timeout, check network |
| "JSONB parse error" | Invalid JSON in payload | Validate payload format |

**Resolution:**

```bash
# Fix 1: Update API key
# Edit .claude/settings.json AND .env:
"CLAUDE_HOOK_API_KEY": "correct-api-key"

# Fix 2: Check payload structure
node -e "
const payload = {
  event: 'SessionStart',
  sessionId: 'test-123',
  timestamp: new Date().toISOString()
};
console.log(JSON.stringify(payload, null, 2));
"

# Fix 3: Increase timeout
# Edit .claude/settings.json:
"CLAUDE_HOOK_TIMEOUT": "10000"  # 10 seconds

# Fix 4: Retry failed events manually
psql $DATABASE_URL -c "
UPDATE webhook_events
SET status = 'PENDING_RETRY', retry_count = 0
WHERE status = 'FAILED'
  AND received_at > NOW() - INTERVAL '1 hour';
"
```

---

### Issue 4: Logs Not Being Written

**Symptoms:**
- .claude/logs/ directory empty
- No log files created
- Can't find debug information

**Diagnosis Steps:**

```bash
# Step 1: Check directory exists
ls -la .claude/logs/

# Step 2: Check write permissions
touch .claude/logs/test.txt && rm .claude/logs/test.txt
echo "Write test: $?"

# Step 3: Check disk space
df -h $(pwd)

# Step 4: Test logger directly
node -e "
const path = require('path');
const fs = require('fs');
const logDir = path.join(process.cwd(), '.claude', 'logs');
console.log('Log directory:', logDir);
console.log('Exists:', fs.existsSync(logDir));
console.log('Writable:', fs.accessSync(logDir, fs.constants.W_OK) === undefined);
"

# Step 5: Test hook with debug
CLAUDE_HOOK_DEBUG="true" \
CLAUDE_HOOK_EVENT="SessionStart" \
node .claude/hooks/capture-conversation.js
```

**Common Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Directory doesn't exist | Create: `mkdir -p .claude/logs` |
| No write permissions | Fix: `chmod 755 .claude/logs` |
| Disk full | Free space or increase disk size |
| Logger not initialized | Check logger module import |
| Async logs not flushed | Call `logger.flush()` before exit |

**Resolution:**

```bash
# Fix 1: Create directory
mkdir -p .claude/logs

# Fix 2: Set permissions
chmod 755 .claude/logs

# Fix 3: Check disk space
df -h .

# Fix 4: Test logger
node -e "
const fs = require('fs');
const path = require('path');
const logFile = path.join(process.cwd(), '.claude', 'logs', 'test.log');
fs.writeFileSync(logFile, 'Test log entry\n');
console.log('Log test successful');
"

# Fix 5: Verify hook is logging
grep "logger.info" .claude/hooks/capture-conversation.js
```

---

### Issue 5: High Processing Time

**Symptoms:**
- Webhook events taking >2 seconds
- Slow conversation creation
- Timeouts occurring

**Diagnosis Steps:**

```sql
-- Step 1: Find slow requests
SELECT
  request_id,
  event_type,
  processing_time,
  received_at,
  SUBSTRING(error_message, 1, 100) as error
FROM webhook_events
WHERE processing_time > 2000 -- >2 seconds
ORDER BY processing_time DESC
LIMIT 20;

-- Step 2: Average processing time by event type
SELECT
  event_type,
  AVG(processing_time) as avg_ms,
  MAX(processing_time) as max_ms,
  COUNT(*) as count
FROM webhook_events
WHERE processing_time IS NOT NULL
  AND received_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type
ORDER BY avg_ms DESC;

-- Step 3: Check database performance
EXPLAIN ANALYZE
SELECT * FROM webhook_events
WHERE session_id = 'test-session'
ORDER BY received_at DESC;
```

**Common Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Missing indexes | Verify all 8 indexes exist |
| Large JSONB payloads | Reduce payload size |
| Slow database | Check Render.com metrics |
| Network latency | Check connection speed |
| Multiple hook calls | Debounce or deduplicate |

**Resolution:**

```bash
# Fix 1: Verify indexes
psql $DATABASE_URL -c "
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'webhook_events';
"

# Fix 2: Check database performance
psql $DATABASE_URL -c "
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename = 'webhook_events';
"

# Fix 3: Analyze queries
psql $DATABASE_URL -c "
EXPLAIN ANALYZE
INSERT INTO webhook_events (id, event_type, request_body, status)
VALUES ('test', 'SessionStart', '{}'::jsonb, 'PENDING');
"

# Fix 4: Increase timeout
# Edit .claude/settings.json:
"CLAUDE_HOOK_TIMEOUT": "15000"  # 15 seconds
```

---

### Issue 6: Duplicate Conversations Created

**Symptoms:**
- Multiple conversations with same sessionId
- webhook_events has duplicate request_id errors
- Inconsistent data

**Diagnosis Steps:**

```sql
-- Step 1: Find duplicate sessions
SELECT session_id, COUNT(*) as count
FROM conversations
GROUP BY session_id
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Step 2: Find duplicate request IDs
SELECT request_id, COUNT(*) as count
FROM webhook_events
WHERE request_id IS NOT NULL
GROUP BY request_id
HAVING COUNT(*) > 1;

-- Step 3: Check for duplicate hook calls
SELECT event_type, session_id, COUNT(*) as count
FROM webhook_events
WHERE received_at > NOW() - INTERVAL '5 minutes'
GROUP BY event_type, session_id
HAVING COUNT(*) > 1;
```

**Common Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Hook called multiple times | Check settings.json for duplicate hooks |
| No idempotency check | Implement request_id checking |
| No unique constraint | Add unique constraint on sessionId |
| Race condition | Use database transactions |

**Resolution:**

```sql
-- Fix 1: Add unique constraint (if missing)
ALTER TABLE conversations
ADD CONSTRAINT unique_session_id UNIQUE (session_id);

-- Fix 2: Clean up duplicates (keep newest)
DELETE FROM conversations
WHERE id IN (
  SELECT c1.id
  FROM conversations c1
  JOIN conversations c2 ON c1.session_id = c2.session_id
  WHERE c1.created_at < c2.created_at
);

-- Fix 3: Update API route to use upsert
-- (See developer guide for code example)
```

```bash
# Fix 4: Check for duplicate hooks
grep -A 10 "SessionStart" .claude/settings.json

# Should only appear once per event type
```

---

## Error Messages

### Network Errors

#### ECONNREFUSED
```
Error: connect ECONNREFUSED 127.0.0.1:3000
```

**Meaning:** API server is not running or not reachable

**Solutions:**
1. Check if server is running: `curl http://localhost:3000/api/health`
2. Verify API URL: Check `CLAUDE_HOOK_API_URL`
3. Check firewall/network: Ensure no blocking

#### ETIMEDOUT
```
Error: Request timeout (5000ms)
```

**Meaning:** Request took longer than timeout limit

**Solutions:**
1. Increase timeout: `CLAUDE_HOOK_TIMEOUT="10000"`
2. Check server performance: Database slow?
3. Check network latency: Slow connection?

#### ENOTFOUND
```
Error: getaddrinfo ENOTFOUND arrakis-prod.onrender.com
```

**Meaning:** DNS resolution failed

**Solutions:**
1. Check domain name: Is it correct?
2. Check DNS: Can you ping the domain?
3. Check network: Internet connection working?

### HTTP Errors

#### 400 Bad Request
```
HTTP 400: Validation error: sessionId required
```

**Meaning:** Invalid payload sent to API

**Solutions:**
1. Check payload structure
2. Verify required fields
3. Validate JSON format

#### 401 Unauthorized
```
HTTP 401: Unauthorized - invalid API key
```

**Meaning:** API key is missing or incorrect

**Solutions:**
1. Check `CLAUDE_HOOK_API_KEY` in settings.json
2. Verify key matches .env file
3. Regenerate API key if needed

#### 413 Payload Too Large
```
HTTP 413: Payload Too Large
```

**Meaning:** Request body exceeds size limit

**Solutions:**
1. Reduce payload size
2. Exclude large data from metadata
3. Increase server body size limit

#### 500 Internal Server Error
```
HTTP 500: Internal server error
```

**Meaning:** Server-side error occurred

**Solutions:**
1. Check server logs: Render.com dashboard
2. Check database connectivity
3. Verify database schema is up to date

### Database Errors

#### Duplicate Key Error
```
ERROR: duplicate key value violates unique constraint "webhook_events_request_id_key"
```

**Meaning:** Request ID already exists

**Solutions:**
1. Check for duplicate hook calls
2. Verify request ID generation
3. Use idempotency check before insert

#### Connection Error
```
ERROR: connection to database failed
```

**Meaning:** Cannot connect to PostgreSQL

**Solutions:**
1. Check `DATABASE_URL` environment variable
2. Verify database is running
3. Check IP whitelist (Render.com)
4. Check connection limit

---

## System Health Checks

### Daily Health Check Script

```bash
#!/bin/bash
# daily-health-check.sh

echo "=== Webhook System Health Check ==="
echo "Date: $(date)"
echo ""

echo "1. Queue Status:"
PENDING=$(ls .claude/queue/pending/*.json 2>/dev/null | wc -l)
PROCESSING=$(ls .claude/queue/processing/*.json 2>/dev/null | wc -l)
FAILED=$(ls .claude/queue/failed/*.json 2>/dev/null | wc -l)
echo "  Pending: $PENDING"
echo "  Processing: $PROCESSING"
echo "  Failed: $FAILED"

if [ $PENDING -gt 50 ]; then
  echo "  ⚠️  WARNING: High pending queue depth"
fi

echo ""
echo "2. Log Status:"
for log in webhook-success.log webhook-error.log webhook-queue.log; do
  if [ -f ".claude/logs/$log" ]; then
    SIZE=$(du -h ".claude/logs/$log" | cut -f1)
    LINES=$(wc -l < ".claude/logs/$log")
    echo "  $log: $SIZE ($LINES lines)"
  else
    echo "  $log: ⚠️  MISSING"
  fi
done

echo ""
echo "3. Recent Errors:"
if [ -f ".claude/logs/webhook-error.log" ]; then
  ERRORS=$(grep "\"level\":\"error\"" .claude/logs/webhook-error.log | wc -l)
  echo "  Total errors: $ERRORS"

  if [ $ERRORS -gt 0 ]; then
    echo "  Recent errors:"
    tail -3 .claude/logs/webhook-error.log | jq -r '.message'
  fi
else
  echo "  No error log found"
fi

echo ""
echo "4. Database Status:"
psql $DATABASE_URL -t -c "
SELECT
  'Total events: ' || COUNT(*) || E'\n' ||
  'Success: ' || SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) || E'\n' ||
  'Failed: ' || SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) || E'\n' ||
  'Pending: ' || SUM(CASE WHEN status IN ('PENDING', 'PENDING_RETRY') THEN 1 ELSE 0 END)
FROM webhook_events
WHERE received_at > NOW() - INTERVAL '24 hours';
" | sed 's/^/  /'

echo ""
echo "=== End Health Check ==="
```

### Monitoring Queries

```sql
-- webhook-monitoring.sql

-- Overall health summary
WITH stats AS (
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success,
    SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
    AVG(processing_time) as avg_time
  FROM webhook_events
  WHERE received_at > NOW() - INTERVAL '1 hour'
)
SELECT
  total,
  success,
  failed,
  ROUND((success::numeric / NULLIF(total, 0)) * 100, 2) as success_rate,
  ROUND(avg_time, 2) as avg_processing_ms
FROM stats;

-- Recent failures
SELECT
  event_type,
  SUBSTRING(error_message, 1, 50) as error,
  COUNT(*) as count
FROM webhook_events
WHERE status = 'FAILED'
  AND received_at > NOW() - INTERVAL '1 hour'
GROUP BY event_type, error
ORDER BY count DESC;

-- Performance by event type
SELECT
  event_type,
  COUNT(*) as count,
  ROUND(AVG(processing_time), 2) as avg_ms,
  MAX(processing_time) as max_ms
FROM webhook_events
WHERE processing_time IS NOT NULL
  AND received_at > NOW() - INTERVAL '1 hour'
GROUP BY event_type
ORDER BY avg_ms DESC;
```

---

## Recovery Procedures

### Procedure 1: System Reset

**When to use:** System is completely broken, nothing working

```bash
# 1. Stop all processes
# (Close Claude Code)

# 2. Clear queue
mv .claude/queue .claude/queue.backup
mkdir -p .claude/queue/{pending,processing,failed}

# 3. Clear logs
mv .claude/logs .claude/logs.backup
mkdir -p .claude/logs

# 4. Reset database (CAUTION!)
psql $DATABASE_URL -c "
UPDATE webhook_events
SET status = 'FAILED'
WHERE status IN ('PENDING', 'PROCESSING');
"

# 5. Test hook
CLAUDE_HOOK_DEBUG="true" \
CLAUDE_HOOK_EVENT="SessionStart" \
node .claude/hooks/capture-conversation.js

# 6. Verify
ls .claude/logs/
psql $DATABASE_URL -c "SELECT * FROM webhook_events ORDER BY received_at DESC LIMIT 5;"
```

### Procedure 2: Queue Flush

**When to use:** Queue has grown too large, want to start fresh

```bash
# 1. Archive current queue
tar -czf queue-backup-$(date +%Y%m%d).tar.gz .claude/queue/

# 2. Clear pending (lose queued requests!)
rm .claude/queue/pending/*.json

# 3. Archive failed
tar -czf failed-$(date +%Y%m%d).tar.gz .claude/queue/failed/
rm .claude/queue/failed/*.json

# 4. Verify
ls .claude/queue/pending/
ls .claude/queue/failed/
```

### Procedure 3: Database Cleanup

**When to use:** Database has old/invalid webhook_events records

```sql
-- 1. Archive old events (>30 days)
CREATE TABLE webhook_events_archive AS
SELECT * FROM webhook_events
WHERE received_at < NOW() - INTERVAL '30 days';

-- 2. Delete archived
DELETE FROM webhook_events
WHERE received_at < NOW() - INTERVAL '30 days';

-- 3. Vacuum table
VACUUM ANALYZE webhook_events;

-- 4. Verify
SELECT
  MIN(received_at) as oldest,
  MAX(received_at) as newest,
  COUNT(*) as total
FROM webhook_events;
```

---

## Getting Help

### Before Asking for Help

1. **Gather diagnostic information:**
   ```bash
   # Create diagnostic report
   {
     echo "=== System Info ==="
     node --version
     npm --version

     echo ""
     echo "=== Environment ==="
     echo "API URL: $CLAUDE_HOOK_API_URL"
     echo "API Key: ${CLAUDE_HOOK_API_KEY:0:10}..."

     echo ""
     echo "=== Queue Status ==="
     ls -la .claude/queue/pending/

     echo ""
     echo "=== Recent Logs ==="
     tail -20 .claude/logs/webhook-error.log

     echo ""
     echo "=== Database Status ==="
     psql $DATABASE_URL -c "SELECT status, COUNT(*) FROM webhook_events GROUP BY status;"
   } > diagnostic-report.txt
   ```

2. **Include specific error messages**
3. **Note what you've already tried**
4. **Provide request ID if available**

### Support Channels

- **Documentation:** Check other docs first
- **GitHub Issues:** File bug reports
- **Logs:** Search .claude/logs/ for clues
- **Database:** Query webhook_events for history

### Useful Commands Reference

```bash
# View logs
tail -f .claude/logs/webhook-error.log

# Search logs
grep "req_abc123" .claude/logs/*.log

# Check queue
ls .claude/queue/pending/*.json | wc -l

# Test API
curl -X POST $CLAUDE_HOOK_API_URL -H "Authorization: Bearer $CLAUDE_HOOK_API_KEY" -d '{"event":"SessionStart"}'

# Check database
psql $DATABASE_URL -c "SELECT * FROM webhook_events WHERE status='FAILED' LIMIT 10;"

# Manual retry
cp .claude/queue/failed/req_abc123.json .claude/queue/pending/
```

---

**Last Updated:** 2025-09-30
**Maintainer:** Development Team
**Feedback:** File issues or submit documentation improvements
