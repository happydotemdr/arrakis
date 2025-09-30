# Implementation Plan - Detailed Task Breakdown

**Last Updated**: 2025-09-29
**Status**: Ready for Execution
**Total Estimated Time**: 2-4 hours critical path, 20-40 hours for full feature set

---

## Task Organization Philosophy

This plan breaks work into **small, atomic tasks** that can be completed in 5-30 minutes each. Tasks are organized by:
- **Priority**: Critical → High → Medium → Low
- **Dependencies**: Tasks that must be done in order
- **Complexity**: Simple → Medium → Complex
- **Risk**: Low → Medium → High

---

## Phase 1: Database Deployment (CRITICAL)

### Task 1.1: Commit Migrations to Git
**Priority**: CRITICAL | **Time**: 5 min | **Risk**: Low | **Dependencies**: None

**Actions**:
```bash
cd c:\projects\arrakis
git add prisma/migrations/20250930000000_initial_schema/
git add prisma/migrations/20250930000001_vector_indexes/
git status  # Verify files staged
```

**Success Criteria**:
- Both migration directories staged
- No other unexpected files staged
- Git status clean except for migrations

**Rollback**: `git reset HEAD prisma/migrations/`

---

### Task 1.2: Commit with Proper Message
**Priority**: CRITICAL | **Time**: 3 min | **Risk**: Low | **Dependencies**: 1.1

**Actions**:
```bash
git commit -m "feat: Add initial database schema with vector support

- Create Conversation, Message, ToolUse, ConversationEmbedding models
- Add pgvector extension for semantic search
- Implement 18 performance indexes (B-tree, GIN, HNSW)
- Configure cascade deletes for data integrity

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Success Criteria**:
- Commit created successfully
- Commit message follows conventional format
- No uncommitted changes remain

**Rollback**: `git reset --soft HEAD~1`

---

### Task 1.3: Push to Trigger Deployment
**Priority**: CRITICAL | **Time**: 2 min | **Risk**: Medium | **Dependencies**: 1.2

**Actions**:
```bash
git push origin master
```

**Success Criteria**:
- Push succeeds without errors
- GitHub shows new commit
- Render auto-deploy triggered (check dashboard)

**Monitor**: Render dashboard → Deploys tab → Watch for "Deploying" status

**Rollback**: `git revert HEAD && git push` (if build fails)

---

### Task 1.4: Wait for Deployment
**Priority**: CRITICAL | **Time**: 5 min | **Risk**: Low | **Dependencies**: 1.3

**Actions**:
- Open Render dashboard: https://dashboard.render.com
- Navigate to arrakis-prod service
- Watch Deploys tab for "Live" status

**Success Criteria**:
- Deployment completes successfully
- Build logs show no errors
- Service status shows "Live"

**If Fails**: Check build logs, fix errors, commit fix, push again

---

### Task 1.5: Enable pgvector Extension
**Priority**: CRITICAL | **Time**: 5 min | **Risk**: Medium | **Dependencies**: 1.4

**Method A - Via Render Dashboard**:
1. Go to Render dashboard
2. Click arrakis-prod-db database
3. Click "Query" tab (or "Connect")
4. Execute: `CREATE EXTENSION IF NOT EXISTS vector;`
5. Verify: `SELECT * FROM pg_extension WHERE extname = 'vector';`

**Method B - Via psql** (if you have connection string):
```bash
# Get DATABASE_URL from Render dashboard → Environment
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql "$DATABASE_URL" -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
```

**Success Criteria**:
- Extension created successfully
- Query returns 1 row showing vector extension
- No errors about permissions

**Common Issue**: Need superuser privileges → Use Render dashboard method

---

### Task 1.6: Run Database Migrations
**Priority**: CRITICAL | **Time**: 10 min | **Risk**: Medium | **Dependencies**: 1.5

**Method A - Via Render Shell** (Recommended):
1. Go to Render dashboard → arrakis-prod service
2. Click "Shell" tab
3. Execute: `npm run db:deploy`
4. Wait for completion
5. Verify output shows "Migration successful"

**Method B - Manual SQL Execution**:
1. Open database Query tab
2. Copy entire contents of `prisma/migrations/20250930000000_initial_schema/migration.sql`
3. Paste and execute
4. Copy entire contents of `prisma/migrations/20250930000001_vector_indexes/migration.sql`
5. Paste and execute

**Success Criteria**:
- All SQL executes without errors
- 4 tables created: conversations, messages, tool_uses, conversation_embeddings
- 18+ indexes created
- Foreign keys established
- No constraint violations

**Verification Query**:
```sql
-- Check tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Check indexes
SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname;

-- Check foreign keys
SELECT conname FROM pg_constraint WHERE contype = 'f';
```

**If Fails**:
- Check pgvector extension is enabled first
- Check for SQL syntax errors
- Verify database user has CREATE permissions
- Try manual SQL method if shell method fails

---

### Task 1.7: Verify Database Schema
**Priority**: HIGH | **Time**: 5 min | **Risk**: Low | **Dependencies**: 1.6

**Actions**:
```sql
-- Verify table structure
\d conversations
\d messages
\d tool_uses
\d conversation_embeddings

-- Check indexes exist
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Check vector column type
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'conversation_embeddings'
AND column_name = 'embedding';
```

**Success Criteria**:
- All 4 tables exist with correct columns
- At least 18 indexes exist
- embedding column has type "vector" or "USER-DEFINED"
- Foreign key constraints in place

---

### Task 1.8: Test Database Connection from App
**Priority**: HIGH | **Time**: 5 min | **Risk**: Low | **Dependencies**: 1.7

**Via Render Shell**:
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.conversation.count()
  .then(count => {
    console.log('✓ Connection successful! Conversations:', count);
    process.exit(0);
  })
  .catch(err => {
    console.error('✗ Connection failed:', err.message);
    process.exit(1);
  });
"
```

**Success Criteria**:
- Command exits with code 0
- Outputs "Connection successful! Conversations: 0"
- No error messages

**If Fails**:
- Check DATABASE_URL environment variable in Render
- Verify database is running
- Check IP allowlist includes Render IPs
- Test with psql connection first

---

## Phase 2: Webhook Testing (CRITICAL)

### Task 2.1: Test Webhook GET Request
**Priority**: HIGH | **Time**: 2 min | **Risk**: Low | **Dependencies**: 1.8

**Actions**:
```bash
curl -i https://arrakis-prod.onrender.com/api/claude-hooks
```

**Expected Response**:
```
HTTP/1.1 405 Method Not Allowed
Content-Type: application/json

{"error":"Method GET not allowed"}
```

**Success Criteria**:
- Returns 405 status code
- Response is JSON
- Error message mentions GET not allowed

**This is CORRECT behavior** - webhook only accepts POST

---

### Task 2.2: Test Webhook POST Without Auth
**Priority**: HIGH | **Time**: 2 min | **Risk**: Low | **Dependencies**: 2.1

**Actions**:
```bash
curl -i -X POST https://arrakis-prod.onrender.com/api/claude-hooks \
  -H "Content-Type: application/json" \
  -d '{"event":"SessionStart"}'
```

**Expected Response** (if NODE_ENV=production):
```
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{"success":false,"error":"Unauthorized"}
```

**Success Criteria**:
- Returns 401 status code (production)
- OR returns 400 (development - still good, means auth is skipped)

**If Gets 500**: Check Render logs - database connection or code error

---

### Task 2.3: Test Webhook POST With Auth
**Priority**: HIGH | **Time**: 5 min | **Risk**: Medium | **Dependencies**: 2.2

**Actions**:
```bash
curl -i -X POST https://arrakis-prod.onrender.com/api/claude-hooks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 7d3e4490f7d8c68f82dd9e93d55fa714a34107e96b654c6373eba45c99aa7b38" \
  -d '{
    "event": "SessionStart",
    "timestamp": "2025-09-29T19:00:00.000Z",
    "sessionId": "test-session-001",
    "projectPath": "c:\\projects\\arrakis",
    "metadata": {
      "platform": "win32",
      "test": true
    }
  }'
```

**Expected Response**:
```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "SessionStart event processed",
  "conversationId": "clxxx..."
}
```

**Success Criteria**:
- Returns 200 status code
- Response includes success=true
- Response includes conversationId
- No error messages in response

**If Fails**:
- 400: Check JSON payload format
- 401: Verify API key matches Render environment variable
- 500: Check Render logs for database/code errors

---

### Task 2.4: Verify Data in Database
**Priority**: HIGH | **Time**: 3 min | **Risk**: Low | **Dependencies**: 2.3

**Actions**:
```sql
SELECT * FROM conversations
WHERE session_id = 'test-session-001'
ORDER BY started_at DESC
LIMIT 1;
```

**Expected Result**:
- 1 row returned
- session_id = 'test-session-001'
- project_path = 'c:\projects\arrakis'
- started_at ≈ 2025-09-29 19:00:00
- ended_at = NULL
- metadata contains test=true

**Success Criteria**:
- Row exists
- All fields populated correctly
- Timestamps are valid
- JSON metadata is valid

---

### Task 2.5: Test tRPC Endpoint
**Priority**: HIGH | **Time**: 3 min | **Risk**: Low | **Dependencies**: 2.4

**Actions**:
```bash
curl -i https://arrakis-prod.onrender.com/api/trpc/conversation.getAll
```

**Expected Response**:
```json
{
  "result": {
    "data": [
      {
        "id": "clxxx...",
        "sessionId": "test-session-001",
        "title": null,
        "startedAt": "2025-09-29T19:00:00.000Z",
        "messages": [],
        "_count": {"messages": 0}
      }
    ]
  }
}
```

**Success Criteria**:
- Returns 200 status code
- Response has result.data array
- Array contains test conversation
- Data structure matches expected format

---

### Task 2.6: Test Complete Hook Lifecycle
**Priority**: HIGH | **Time**: 10 min | **Risk**: Medium | **Dependencies**: 2.5

**Create test script**: `test-webhook-lifecycle.sh`
```bash
#!/bin/bash
API_KEY="7d3e4490f7d8c68f82dd9e93d55fa714a34107e96b654c6373eba45c99aa7b38"
URL="https://arrakis-prod.onrender.com/api/claude-hooks"
SESSION_ID="lifecycle-test-$(date +%s)"

echo "Testing webhook lifecycle with session: $SESSION_ID"

# 1. SessionStart
echo "1. SessionStart..."
curl -s -X POST "$URL" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"event\":\"SessionStart\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",\"sessionId\":\"$SESSION_ID\"}"

# 2. UserPromptSubmit
echo "\n2. UserPromptSubmit..."
curl -s -X POST "$URL" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"event\":\"UserPromptSubmit\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",\"sessionId\":\"$SESSION_ID\",\"prompt\":\"What is this project?\"}"

# 3. PostToolUse
echo "\n3. PostToolUse..."
curl -s -X POST "$URL" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"event\":\"PostToolUse\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",\"sessionId\":\"$SESSION_ID\",\"toolName\":\"Read\",\"parameters\":{\"file\":\"README.md\"},\"duration\":150,\"status\":\"success\"}"

# 4. SessionEnd
echo "\n4. SessionEnd..."
curl -s -X POST "$URL" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"event\":\"SessionEnd\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",\"sessionId\":\"$SESSION_ID\",\"messageCount\":2,\"toolUseCount\":1}"

echo "\n\n✓ Lifecycle test complete. Check database for session: $SESSION_ID"
```

**Run**:
```bash
chmod +x test-webhook-lifecycle.sh
./test-webhook-lifecycle.sh
```

**Verify in database**:
```sql
SELECT
  c.id,
  c.session_id,
  c.title,
  c.started_at,
  c.ended_at,
  COUNT(m.id) as message_count,
  COUNT(t.id) as tool_count
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
LEFT JOIN tool_uses t ON t.message_id = m.id
WHERE c.session_id LIKE 'lifecycle-test-%'
GROUP BY c.id
ORDER BY c.started_at DESC
LIMIT 1;
```

**Success Criteria**:
- Conversation exists with correct session_id
- started_at and ended_at populated
- At least 1 message exists
- At least 1 tool_use exists
- All foreign keys linked correctly

---

## Phase 3: Claude Hooks End-to-End (CRITICAL)

### Task 3.1: Update Hook Configuration
**Priority**: CRITICAL | **Time**: 5 min | **Risk**: Low | **Dependencies**: 2.6

**File**: `c:\projects\arrakis\.claude\settings.json`

**Update env section**:
```json
{
  "env": {
    "CLAUDE_HOOK_API_URL": "https://arrakis-prod.onrender.com/api/claude-hooks",
    "CLAUDE_HOOK_API_KEY": "7d3e4490f7d8c68f82dd9e93d55fa714a34107e96b654c6373eba45c99aa7b38",
    "CLAUDE_HOOK_DEBUG": "true",
    "CLAUDE_HOOK_ENABLED": "true",
    "CLAUDE_HOOK_TIMEOUT": "10000",
    "CLAUDE_HOOK_RETRY_ATTEMPTS": "2"
  },
  "hooks": {
    ...existing hooks configuration...
  }
}
```

**Success Criteria**:
- CLAUDE_HOOK_API_URL points to production
- API key matches Render environment variable
- Debug enabled for troubleshooting
- JSON is valid (no syntax errors)

---

### Task 3.2: Test Manual Hook Execution
**Priority**: HIGH | **Time**: 5 min | **Risk**: Low | **Dependencies**: 3.1

**Actions**:
```bash
cd c:\projects\arrakis

# Test SessionStart hook
CLAUDE_HOOK_EVENT=SessionStart \
CLAUDE_SESSION_ID=manual-hook-test \
CLAUDE_PROJECT_DIR="c:\projects\arrakis" \
CLAUDE_HOOK_DEBUG=true \
node .claude/hooks/capture-conversation.js
```

**Expected Output**:
```
[Claude Hook] Capturing SessionStart event...
[Claude Hook] Session ID: manual-hook-test
[Claude Hook] Sending to: https://arrakis-prod.onrender.com/api/claude-hooks
[Claude Hook] Response: 200 - {"success":true,"message":"SessionStart event processed","conversationId":"clxxx..."}
[Claude Hook] Successfully captured SessionStart event
```

**Success Criteria**:
- Script runs without errors
- Shows "Sending to" production URL
- Receives 200 response
- Response includes conversationId
- No authentication errors

**Verify**:
```sql
SELECT * FROM conversations WHERE session_id = 'manual-hook-test';
```

---

### Task 3.3: Commit Hook Configuration
**Priority**: HIGH | **Time**: 3 min | **Risk**: Low | **Dependencies**: 3.2

**Actions**:
```bash
git add .claude/settings.json
git commit -m "feat: Configure Claude hooks for production endpoint

- Update CLAUDE_HOOK_API_URL to production URL
- Configure API key for authentication
- Enable debug mode for troubleshooting

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin master
```

**Success Criteria**:
- Changes committed and pushed
- No merge conflicts
- GitHub shows updated settings.json

---

### Task 3.4: Real Claude Code Session Test
**Priority**: CRITICAL | **Time**: 15 min | **Risk**: Medium | **Dependencies**: 3.3

**Preparation**:
1. Ensure Claude Code is running
2. Ensure you're in c:\projects\arrakis directory
3. Have database query tool ready (Render dashboard or psql)
4. Have Render logs open for monitoring

**Test Procedure**:
1. **Start new Claude Code session** in Arrakis project
2. **Send test prompt**: "Please read the README.md file and summarize the project status"
3. **Wait for Claude to respond** (should use Read tool)
4. **Ask follow-up**: "What database schema is configured?"
5. **End the session**

**Monitor During Test**:
- Watch Render logs for webhook requests
- Note any errors or warnings
- Observe hook execution messages in Claude Code console

**Immediate Verification** (after session ends):
```sql
-- Find the latest conversation
SELECT * FROM conversations
ORDER BY started_at DESC
LIMIT 1;

-- Check messages in that conversation
SELECT role, LEFT(content, 100) as preview, timestamp
FROM messages
WHERE conversation_id = (
  SELECT id FROM conversations ORDER BY started_at DESC LIMIT 1
)
ORDER BY timestamp ASC;

-- Check tool uses
SELECT tool_name, status, duration, timestamp
FROM tool_uses
WHERE message_id IN (
  SELECT id FROM messages WHERE conversation_id = (
    SELECT id FROM conversations ORDER BY started_at DESC LIMIT 1
  )
)
ORDER BY timestamp ASC;
```

**Success Criteria**:
- New conversation created with valid session_id
- Multiple messages captured (user + assistant)
- Tool uses recorded (Read, Grep, or others)
- Timestamps are sequential and valid
- ended_at is populated (if SessionEnd fired)
- No errors in Render logs

**Common Issues**:
- **No conversation created**: Check hooks are enabled, verify API URL
- **SessionStart only**: Hooks may not fire for all events - check settings.json
- **Missing messages**: May need transcript parsing (SessionEnd hook)
- **No tool uses**: Tools may not have fired, or hook didn't capture them

---

### Task 3.5: Verify Conversation in UI
**Priority**: HIGH | **Time**: 5 min | **Risk**: Low | **Dependencies**: 3.4

**Actions**:
1. Open browser: `https://arrakis-prod.onrender.com/conversations`
2. Find the test conversation in list (should be first)
3. Click to open detail view
4. Verify all data displays correctly

**Check**:
- Conversation title (auto-generated from first prompt)
- Message list with user/assistant roles
- Message content renders correctly
- Tool calls display (if UI supports it)
- Timestamps are readable
- No loading errors

**Success Criteria**:
- Conversation appears in list
- Detail page loads successfully
- All captured data displays
- No JavaScript errors in console

---

## Phase 4: Production Verification (HIGH)

### Task 4.1: Stress Test Webhook
**Priority**: MEDIUM | **Time**: 10 min | **Risk**: Low | **Dependencies**: 3.5

**Create test**: `stress-test-webhook.sh`
```bash
#!/bin/bash
API_KEY="7d3e4490f7d8c68f82dd9e93d55fa714a34107e96b654c6373eba45c99aa7b38"
URL="https://arrakis-prod.onrender.com/api/claude-hooks"

echo "Sending 10 concurrent requests..."

for i in {1..10}; do
  (
    SESSION_ID="stress-test-$i-$(date +%s)"
    curl -s -X POST "$URL" \
      -H "Authorization: Bearer $API_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"event\":\"SessionStart\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",\"sessionId\":\"$SESSION_ID\"}" \
      > /dev/null
    echo "Request $i completed"
  ) &
done

wait
echo "All requests completed"

# Verify in database
echo "\nChecking database..."
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM conversations WHERE session_id LIKE 'stress-test-%';"
```

**Success Criteria**:
- All 10 requests complete successfully
- All 10 conversations created in database
- No rate limiting errors
- No database connection errors
- Response times < 2 seconds

---

### Task 4.2: Test Error Handling
**Priority**: MEDIUM | **Time**: 10 min | **Risk**: Low | **Dependencies**: 4.1

**Test invalid payloads**:
```bash
API_KEY="7d3e4490f7d8c68f82dd9e93d55fa714a34107e96b654c6373eba45c99aa7b38"
URL="https://arrakis-prod.onrender.com/api/claude-hooks"

# Test 1: Missing required field
curl -i -X POST "$URL" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event":"SessionStart"}'
# Expected: 400 Bad Request (missing timestamp)

# Test 2: Invalid event type
curl -i -X POST "$URL" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event":"InvalidEvent","timestamp":"2025-09-29T19:00:00Z"}'
# Expected: 400 Bad Request (invalid enum value)

# Test 3: Malformed JSON
curl -i -X POST "$URL" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{invalid json}'
# Expected: 400 Bad Request (parse error)

# Test 4: Payload too large
curl -i -X POST "$URL" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"event\":\"SessionStart\",\"timestamp\":\"2025-09-29T19:00:00Z\",\"prompt\":\"$(python -c 'print("A"*200000)')\"}"
# Expected: 400 Bad Request (exceeds size limit)
```

**Success Criteria**:
- All invalid requests return 400
- Error messages are descriptive
- No 500 errors (proper validation)
- Database integrity maintained (no partial writes)

---

### Task 4.3: Monitor Production Performance
**Priority**: MEDIUM | **Time**: 5 min | **Risk**: Low | **Dependencies**: 4.2

**Check Render metrics**:
1. Open Render dashboard → arrakis-prod service
2. Go to "Metrics" tab
3. Check last 1 hour:
   - CPU usage (should be < 50%)
   - Memory usage (should be < 80%)
   - Response times (should be < 1s average)
   - Error rate (should be 0%)

**Check database metrics**:
1. Open Render dashboard → arrakis-prod-db
2. Check:
   - Connection count (should be < 20)
   - Query performance
   - Storage usage

**Success Criteria**:
- All metrics within normal ranges
- No memory leaks
- No connection pool exhaustion
- No slow queries (> 1s)

---

### Task 4.4: Security Verification
**Priority**: HIGH | **Time**: 10 min | **Risk**: Low | **Dependencies**: 4.3

**Test authentication**:
```bash
URL="https://arrakis-prod.onrender.com/api/claude-hooks"

# Test 1: No API key
curl -i -X POST "$URL" -H "Content-Type: application/json" -d '{}'
# Expected: 401 Unauthorized

# Test 2: Wrong API key
curl -i -X POST "$URL" \
  -H "Authorization: Bearer wrong-key-12345" \
  -H "Content-Type: application/json" \
  -d '{"event":"SessionStart","timestamp":"2025-09-29T19:00:00Z"}'
# Expected: 401 Unauthorized

# Test 3: API key in wrong format
curl -i -X POST "$URL" \
  -H "Authorization: wrong-format" \
  -H "Content-Type: application/json" \
  -d '{"event":"SessionStart","timestamp":"2025-09-29T19:00:00Z"}'
# Expected: 401 Unauthorized
```

**Check database security**:
```sql
-- Verify RLS is not enabled (not needed for single-user system)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Check for sensitive data in logs
SELECT * FROM conversations
WHERE metadata::text LIKE '%password%'
   OR metadata::text LIKE '%secret%'
   OR metadata::text LIKE '%key%';
-- Should return 0 rows (or review if any found)
```

**Success Criteria**:
- All unauthenticated requests rejected
- Wrong API keys rejected
- No sensitive data in database
- IP allowlist configured correctly

---

## Phase 5: Documentation & Cleanup (MEDIUM)

### Task 5.1: Update README.md
**Priority**: MEDIUM | **Time**: 10 min | **Risk**: Low | **Dependencies**: 4.4

**Add deployment section**:
```markdown
## 🚀 Deployment

**Production Environment**:
- **URL**: https://arrakis-prod.onrender.com
- **Database**: PostgreSQL 17 with pgvector
- **Region**: Oregon (Render)
- **Status**: ✅ Live and capturing conversations

**Last Deployment**: 2025-09-29

### Features Live in Production
- ✅ Conversation capture via Claude Code hooks
- ✅ Message and tool use tracking
- ✅ Conversation browsing UI
- ✅ Type-safe tRPC API
- ⚠️ Semantic search (coming soon - embeddings not implemented)

### Deployment Process
1. Push to `master` branch
2. Render auto-deploys automatically
3. Database migrations run on first deploy
4. Zero-downtime updates

For detailed deployment instructions, see [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md).
```

**Commit**:
```bash
git add README.md
git commit -m "docs: Update README with deployment status"
git push origin master
```

---

### Task 5.2: Create DEPLOYMENT_GUIDE.md
**Priority**: MEDIUM | **Time**: 20 min | **Risk**: Low | **Dependencies**: 5.1

**Create**: `c:\projects\arrakis\docs\DEPLOYMENT_GUIDE.md`

**Contents** (outline):
1. Prerequisites
2. Initial Render Setup
3. Database Configuration
4. Environment Variables
5. First Deployment
6. Migration Strategy
7. Monitoring and Maintenance
8. Rollback Procedures
9. Troubleshooting

**See separate file creation task**

---

### Task 5.3: Update PROJECT_STATUS.md
**Priority**: MEDIUM | **Time**: 5 min | **Risk**: Low | **Dependencies**: 5.2

**Changes**:
- Update "Current Status" to "95% Complete"
- Mark database deployment as ✅
- Mark conversation capture as ✅
- Update "What's Working" section
- Mark all critical tasks as complete
- Update "Definition of Done" checklist

---

### Task 5.4: Create API_SPEC.md
**Priority**: LOW | **Time**: 30 min | **Risk**: Low | **Dependencies**: 5.3

**Create**: `c:\projects\arrakis\docs\API_SPEC.md`

**Document**:
- Webhook endpoint specification
- Request/response formats
- Authentication
- Error codes
- Rate limiting
- Examples for all event types
- tRPC endpoint documentation

**See separate file creation task**

---

### Task 5.5: Clean Up Test Data
**Priority**: LOW | **Time**: 5 min | **Risk**: Low | **Dependencies**: 5.4

**Actions**:
```sql
-- Remove test conversations
DELETE FROM conversations
WHERE session_id LIKE 'test-%'
   OR session_id LIKE 'manual-%'
   OR session_id LIKE 'stress-%'
   OR session_id LIKE 'lifecycle-%';

-- Verify deletion (should cascade to messages and tool_uses)
SELECT COUNT(*) FROM conversations;
SELECT COUNT(*) FROM messages;
SELECT COUNT(*) FROM tool_uses;

-- Keep one test conversation if desired
-- (Helps verify UI works with real data)
```

**Success Criteria**:
- Test data removed
- Foreign key cascades worked
- No orphaned records
- At least one real conversation remains

---

## Phase 6: Future Enhancements (LOW PRIORITY)

### Task 6.1: Implement OpenAI Embedding Service
**Priority**: LOW | **Time**: 2 hours | **Risk**: Medium | **Dependencies**: None

**File**: Create `c:\projects\arrakis\src\services\embedding.ts`

**Subtasks**:
1. Create OpenAI client initialization (10 min)
2. Implement text chunking function (20 min)
3. Create embedding generation function (20 min)
4. Add batch processing for efficiency (30 min)
5. Implement error handling and retries (20 min)
6. Add rate limiting (20 min)
7. Create tests (20 min)

**Success Criteria**:
- Can generate embeddings for text
- Handles rate limits gracefully
- Batches requests efficiently
- Stores in conversation_embeddings table

---

### Task 6.2: Add Automatic Embedding on SessionEnd
**Priority**: LOW | **Time**: 1 hour | **Risk**: Low | **Dependencies**: 6.1

**File**: Update `c:\projects\arrakis\src\app\api\claude-hooks\route.ts`

**Changes**:
```typescript
// In SessionEnd handler
if (event === 'SessionEnd' && conversationId) {
  // Generate embeddings asynchronously (don't block response)
  generateEmbeddingsForConversation(conversationId)
    .catch(err => console.error('Embedding generation failed:', err));
}
```

**Subtasks**:
1. Add embedding service import (2 min)
2. Create async embedding generation function (20 min)
3. Add error handling (10 min)
4. Add logging (10 min)
5. Test with real conversation (20 min)

---

### Task 6.3: Implement Semantic Search Endpoint
**Priority**: LOW | **Time**: 1.5 hours | **Risk**: Medium | **Dependencies**: 6.2

**File**: Update `c:\projects\arrakis\src\server\api\routers\conversation.ts`

**Add procedure**:
```typescript
search: publicProcedure
  .input(z.object({
    query: z.string().min(1).max(500),
    limit: z.number().min(1).max(50).default(10),
    threshold: z.number().min(0).max(1).default(0.7),
  }))
  .query(async ({ input, ctx }) => {
    // Generate query embedding
    // Search conversation_embeddings
    // Return ranked results
  }),
```

**Subtasks**:
1. Create search input schema (10 min)
2. Generate query embedding (15 min)
3. Execute vector similarity search (30 min)
4. Format and rank results (20 min)
5. Add caching (15 min)
6. Test search accuracy (30 min)

---

### Task 6.4: Build Semantic Search UI
**Priority**: LOW | **Time**: 2 hours | **Risk**: Low | **Dependencies**: 6.3

**File**: Create `c:\projects\arrakis\src\app\(dashboard)\search\page.tsx`

**Components**:
1. Search input with autocomplete (30 min)
2. Results list with highlighting (30 min)
3. Filters (date range, project) (20 min)
4. Pagination (20 min)
5. Result preview on hover (20 min)
6. Styling and polish (20 min)

---

### Task 6.5: Add Analytics Dashboard
**Priority**: LOW | **Time**: 3 hours | **Risk**: Low | **Dependencies**: None

**Subtasks**:
1. Create analytics queries (30 min)
   - Conversations per day
   - Most used tools
   - Average session duration
   - Message counts
2. Create tRPC analytics endpoint (30 min)
3. Build dashboard UI (1 hour)
4. Add charts (Recharts/Chart.js) (1 hour)

---

### Task 6.6: Implement Rate Limiting
**Priority**: LOW | **Time**: 1 hour | **Risk**: Medium | **Dependencies**: None

**Library**: Use `@upstash/ratelimit` or similar

**Subtasks**:
1. Install rate limiting library (5 min)
2. Create rate limit middleware (20 min)
3. Apply to webhook endpoint (10 min)
4. Add rate limit headers (10 min)
5. Create rate limit exceeded response (10 min)
6. Test rate limiting (15 min)

---

### Task 6.7: Add Error Monitoring
**Priority**: MEDIUM | **Time**: 1 hour | **Risk**: Low | **Dependencies**: None

**Service**: Use Sentry, Rollbar, or similar

**Subtasks**:
1. Sign up for error monitoring service (10 min)
2. Install SDK (5 min)
3. Configure in Next.js (15 min)
4. Add custom error boundaries (20 min)
5. Test error reporting (10 min)

---

### Task 6.8: Optimize Database Queries
**Priority**: LOW | **Time**: 2 hours | **Risk**: Low | **Dependencies**: None

**Subtasks**:
1. Analyze slow queries (30 min)
2. Add missing indexes (20 min)
3. Optimize N+1 queries (30 min)
4. Add query caching (20 min)
5. Test performance improvements (20 min)

---

## Dependency Graph

```
Phase 1 (Database Deployment)
1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7 → 1.8

Phase 2 (Webhook Testing)
1.8 → 2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6

Phase 3 (Claude Hooks)
2.6 → 3.1 → 3.2 → 3.3 → 3.4 → 3.5

Phase 4 (Production Verification)
3.5 → 4.1 → 4.2 → 4.3 → 4.4

Phase 5 (Documentation)
4.4 → 5.1 → 5.2 → 5.3 → 5.4 → 5.5

Phase 6 (Future Enhancements) - No dependencies on critical path
6.1 → 6.2 → 6.3 → 6.4
6.5 (independent)
6.6 (independent)
6.7 (independent)
6.8 (independent)
```

---

## Time Estimates Summary

### Critical Path (Phases 1-4)
- **Minimum**: 1.5 hours (if everything works first try)
- **Expected**: 2-3 hours (with minor troubleshooting)
- **Maximum**: 4-6 hours (with significant issues)

### Documentation (Phase 5)
- **Time**: 1-2 hours

### Future Features (Phase 6)
- **Embeddings**: 4-5 hours
- **Analytics**: 3-4 hours
- **Infrastructure**: 2-3 hours
- **Total**: 15-20 hours for all enhancements

---

## Risk Assessment

### High Risk Tasks
- 1.6: Run Database Migrations (could fail if pgvector not enabled)
- 3.4: Real Claude Code Session Test (many points of failure)
- 6.1: Implement Embeddings (complex, API rate limits)

### Medium Risk Tasks
- 1.5: Enable pgvector Extension (may need special permissions)
- 2.3: Test Webhook With Auth (authentication issues common)
- 6.3: Semantic Search (vector search complexity)

### Low Risk Tasks
- All git operations (easy to rollback)
- All testing tasks (read-only)
- All documentation tasks (no code changes)

---

## Success Metrics

After completing critical path (Phases 1-4):
- [ ] Database has 4 tables with 18+ indexes
- [ ] Webhook endpoint returns 200 for valid requests
- [ ] Real Claude Code sessions create conversations
- [ ] UI displays captured conversations
- [ ] No errors in production logs
- [ ] Response times < 1 second
- [ ] Zero downtime during deployment

---

## Notes for Next Agent

**Quick Start**:
1. Start with Phase 1, Task 1.1
2. Follow tasks in sequence
3. Don't skip verification steps
4. Check success criteria for each task

**If Stuck**:
1. Check troubleshooting section in NEXT_STEPS.md
2. Review STATE.md for current status
3. Check Render logs for errors
4. Test with curl before blaming code

**After Critical Path**:
- Phase 5 can be done any time (documentation)
- Phase 6 tasks are independent (pick any order)
- Prioritize based on user needs

**Time Management**:
- Block out 4 hours for critical path
- Take breaks between phases
- Don't rush - follow verification steps
- Document any issues discovered

Good luck! The system is well-built and should deploy smoothly. 🚀