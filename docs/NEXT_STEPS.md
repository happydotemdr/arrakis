# Next Steps - Immediate Actions for Agent Handoff

**Last Updated**: 2025-09-29
**Priority**: HIGH - Critical path to production
**Estimated Time**: 2-4 hours for full deployment and testing

---

## Context

You're picking up a **production-ready Next.js application** that's 85% complete. The application builds successfully, has zero TypeScript errors, and is deployed to Render. The only remaining work is **database deployment and end-to-end testing**.

**Current Status**:
- ✅ Frontend: Built and deployed
- ✅ Backend: Built and deployed
- ✅ API: Functional and type-safe
- ⚠️ Database: Schema ready but migrations NOT applied
- ⚠️ Capture: Implemented but NOT tested
- ❌ Embeddings: Not implemented (future phase)

---

## Critical Path (Execute in Order)

### Phase 1: Database Deployment (30 minutes)

#### Task 1.1: Commit and Push Migrations
**Priority**: CRITICAL
**Estimated Time**: 5 minutes

```bash
# From: c:\projects\arrakis

# Add migration files to git
git add prisma/migrations/20250930000000_initial_schema/
git add prisma/migrations/20250930000001_vector_indexes/

# Commit migrations
git commit -m "feat: Add initial database schema with vector support

- Create Conversation, Message, ToolUse, ConversationEmbedding models
- Add pgvector extension for semantic search
- Implement 18 performance indexes (B-tree, GIN, HNSW)
- Configure cascade deletes for data integrity

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to trigger auto-deploy
git push origin master
```

**Verification**:
- Check Render dashboard for deployment progress
- Wait for build to complete (~3-5 minutes)

#### Task 1.2: Enable pgvector Extension
**Priority**: CRITICAL
**Estimated Time**: 5 minutes

**Method 1 - Via Render Dashboard** (Recommended):
1. Go to Render dashboard
2. Navigate to arrakis-prod-db database
3. Click "Query" or "Connect"
4. Run: `CREATE EXTENSION IF NOT EXISTS vector;`

**Method 2 - Via psql** (If you have connection string):
```bash
# Get DATABASE_URL from Render dashboard
psql "postgresql://..." -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

**Verification**:
```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
-- Should return 1 row
```

#### Task 1.3: Deploy Migrations
**Priority**: CRITICAL
**Estimated Time**: 10 minutes

**Method 1 - Via Render Dashboard** (Recommended):
1. Go to Render web service (arrakis-prod)
2. Click "Shell" tab
3. Run: `npm run db:deploy`

**Method 2 - Manually Run SQL** (If above fails):
1. Connect to database via Render dashboard
2. Copy contents of `prisma/migrations/20250930000000_initial_schema/migration.sql`
3. Paste and execute
4. Copy contents of `prisma/migrations/20250930000001_vector_indexes/migration.sql`
5. Paste and execute

**Verification**:
```sql
-- Check tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
-- Should show: conversations, messages, tool_uses, conversation_embeddings

-- Check indexes
SELECT indexname FROM pg_indexes WHERE schemaname = 'public';
-- Should show 18+ indexes

-- Check vector extension
SELECT * FROM conversation_embeddings LIMIT 1;
-- Should return 0 rows (table empty but functional)
```

#### Task 1.4: Verify Database Connectivity
**Priority**: HIGH
**Estimated Time**: 5 minutes

**Test from deployed application**:
```bash
# Via Render Shell
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.conversation.count().then(count => {
  console.log('Connection successful! Conversations:', count);
  process.exit(0);
}).catch(err => {
  console.error('Connection failed:', err);
  process.exit(1);
});
"
```

**Test from local machine** (if you have DATABASE_URL):
```bash
# Set environment variable
export DATABASE_URL="postgresql://..."

# Test connection
npm run db:generate
npx prisma db pull
```

**Expected Result**: Connection succeeds, tables exist, zero conversations

---

### Phase 2: Webhook Testing (20 minutes)

#### Task 2.1: Test Webhook Endpoint Accessibility
**Priority**: HIGH
**Estimated Time**: 5 minutes

```bash
# Test GET (should return 405 Method Not Allowed)
curl -i https://arrakis-prod.onrender.com/api/claude-hooks

# Test POST without auth (should return 401 if production)
curl -i -X POST https://arrakis-prod.onrender.com/api/claude-hooks \
  -H "Content-Type: application/json" \
  -d '{"event":"SessionStart"}'

# Test POST with auth (should return 400 - validation error, but auth passes)
curl -i -X POST https://arrakis-prod.onrender.com/api/claude-hooks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 7d3e4490f7d8c68f82dd9e93d55fa714a34107e96b654c6373eba45c99aa7b38" \
  -d '{"event":"SessionStart"}'
```

**Expected Results**:
- GET: `405 Method Not Allowed`
- POST without auth (production): `401 Unauthorized`
- POST with auth: `400 Bad Request` (missing required fields - this is GOOD)

#### Task 2.2: Test Valid Webhook Payload
**Priority**: HIGH
**Estimated Time**: 10 minutes

```bash
# Create test payload
cat > test-payload.json <<'EOF'
{
  "event": "SessionStart",
  "timestamp": "2025-09-29T19:00:00.000Z",
  "sessionId": "test-session-001",
  "projectPath": "c:\\projects\\arrakis",
  "metadata": {
    "platform": "win32",
    "nodeVersion": "18.0.0"
  }
}
EOF

# Send test payload
curl -i -X POST https://arrakis-prod.onrender.com/api/claude-hooks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 7d3e4490f7d8c68f82dd9e93d55fa714a34107e96b654c6373eba45c99aa7b38" \
  -d @test-payload.json
```

**Expected Result**: `200 OK` with response:
```json
{
  "success": true,
  "message": "SessionStart event processed",
  "conversationId": "clxxxxxxxxxxxx"
}
```

**If it fails**:
- Check Render logs for error details
- Verify DATABASE_URL is set in environment
- Verify pgvector extension is enabled
- Check database connection from Render shell

#### Task 2.3: Verify Data in Database
**Priority**: HIGH
**Estimated Time**: 5 minutes

```sql
-- Check conversation was created
SELECT * FROM conversations
WHERE session_id = 'test-session-001';

-- Should show 1 row with:
-- - id: generated CUID
-- - session_id: 'test-session-001'
-- - project_path: 'c:\projects\arrakis'
-- - started_at: 2025-09-29 19:00:00
-- - ended_at: NULL
```

**Verification via tRPC**:
```bash
# Test tRPC endpoint
curl -i https://arrakis-prod.onrender.com/api/trpc/conversation.getAll
```

**Expected**: JSON response with array of conversations (including test conversation)

---

### Phase 3: End-to-End Capture Test (40 minutes)

#### Task 3.1: Update Hook Configuration for Production
**Priority**: HIGH
**Estimated Time**: 10 minutes

**File**: `c:\projects\arrakis\.claude\hooks\capture-conversation.js`

**Update** (around line 10-20):
```javascript
// Configuration - UPDATE THESE for production testing
const WEBHOOK_URL = process.env.CLAUDE_HOOK_API_URL ||
  'https://arrakis-prod.onrender.com/api/claude-hooks'; // CHANGED from localhost

const API_KEY = process.env.CLAUDE_HOOK_API_KEY ||
  '7d3e4490f7d8c68f82dd9e93d55fa714a34107e96b654c6373eba45c99aa7b38';
```

**Or better - Update `.claude/settings.json`**:
```json
{
  "env": {
    "CLAUDE_HOOK_API_URL": "https://arrakis-prod.onrender.com/api/claude-hooks",
    "CLAUDE_HOOK_API_KEY": "7d3e4490f7d8c68f82dd9e93d55fa714a34107e96b654c6373eba45c99aa7b38",
    "CLAUDE_HOOK_DEBUG": "true",
    "CLAUDE_HOOK_ENABLED": "true"
  }
}
```

**Commit changes**:
```bash
git add .claude/settings.json
git commit -m "feat: Configure Claude hooks for production endpoint"
git push origin master
```

#### Task 3.2: Manual Hook Test
**Priority**: HIGH
**Estimated Time**: 10 minutes

```bash
# Test SessionStart hook manually
CLAUDE_HOOK_EVENT=SessionStart \
CLAUDE_SESSION_ID=manual-test-001 \
CLAUDE_PROJECT_DIR="c:\projects\arrakis" \
CLAUDE_HOOK_DEBUG=true \
node .claude/hooks/capture-conversation.js

# Expected output:
# [Claude Hook] Capturing SessionStart event...
# [Claude Hook] Sending to webhook: https://arrakis-prod.onrender.com/api/claude-hooks
# [Claude Hook] Response: 200 - Session captured successfully

# If it fails:
# - Check network connectivity to Render
# - Verify API key is correct
# - Check Render logs for backend errors
```

**Verify in database**:
```sql
SELECT * FROM conversations WHERE session_id = 'manual-test-001';
```

#### Task 3.3: Real Conversation Test
**Priority**: HIGH
**Estimated Time**: 20 minutes

**Start a Claude Code session** in the Arrakis project:

1. Open Claude Code
2. Navigate to `c:\projects\arrakis`
3. Start a conversation with Claude
4. Send a simple prompt: "What is the current status of this project?"
5. Let Claude respond (should use tools like Read, Grep)
6. End the session

**Monitor logs** (in separate terminal):
```bash
# Watch Render logs
# Via Render dashboard: Logs tab (live tail)

# Or check local hook output
# Claude Code should show hook execution in console
```

**Verify capture**:
```sql
-- Check conversations
SELECT id, session_id, title, started_at, ended_at
FROM conversations
ORDER BY started_at DESC
LIMIT 5;

-- Check messages
SELECT c.title, m.role, LEFT(m.content, 50) as preview
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
ORDER BY m.timestamp DESC
LIMIT 10;

-- Check tool uses
SELECT t.tool_name, t.status, t.duration
FROM tool_uses t
ORDER BY t.timestamp DESC
LIMIT 10;
```

**Expected Results**:
- 1 new conversation with session_id from Claude Code
- Multiple messages (user + assistant)
- Multiple tool_uses entries (Read, Grep, etc.)
- Title auto-generated from first user prompt
- ended_at timestamp populated

---

### Phase 4: Frontend Verification (20 minutes)

#### Task 4.1: Test Conversation List Page
**Priority**: MEDIUM
**Estimated Time**: 5 minutes

1. Open browser: `https://arrakis-prod.onrender.com/conversations`
2. Verify page loads successfully
3. Check that test conversations appear in list
4. Verify data displays correctly:
   - Conversation titles
   - Timestamps
   - Message counts

**If page errors**:
- Check browser console for errors
- Verify tRPC endpoint is accessible
- Check Render logs for server errors

#### Task 4.2: Test Conversation Detail Page
**Priority**: MEDIUM
**Estimated Time**: 5 minutes

1. Click on a conversation from list
2. Verify detail page loads: `https://arrakis-prod.onrender.com/conversations/[id]`
3. Check message timeline displays:
   - User messages
   - Assistant messages
   - Tool calls
   - Timestamps

**If page errors**:
- Check conversation ID is valid
- Verify tRPC getById endpoint works
- Check for TypeScript/runtime errors

#### Task 4.3: Test Dashboard & Stats
**Priority**: LOW
**Estimated Time**: 5 minutes

1. Visit dashboard: `https://arrakis-prod.onrender.com/`
2. Verify stats display (if implemented)
3. Visit stats page: `https://arrakis-prod.onrender.com/stats`
4. Check metrics and charts

**Note**: These pages may have placeholder data - that's fine for initial deployment

#### Task 4.4: Verify Production Build
**Priority**: LOW
**Estimated Time**: 5 minutes

```bash
# Check latest deployment
# Via Render dashboard: Deploys tab

# Verify build logs show success
# Check for any runtime warnings

# Test server-side rendering
curl -i https://arrakis-prod.onrender.com/
# Should return 200 with HTML (not JSON)
```

---

## Troubleshooting Guide

### Issue: Database Connection Failed

**Symptoms**:
- Webhook returns 500 error
- Prisma client errors in logs
- "Can't reach database server" messages

**Solutions**:
1. Verify DATABASE_URL in Render environment variables
2. Check database is running in Render dashboard
3. Verify IP allowlist includes Render IPs (0.0.0.0/0 should work)
4. Test connection from Render shell: `npx prisma db pull`

### Issue: pgvector Extension Not Found

**Symptoms**:
- Migration fails with "type vector does not exist"
- CREATE INDEX fails for HNSW

**Solutions**:
1. Connect to database via Render dashboard
2. Run: `CREATE EXTENSION IF NOT EXISTS vector;`
3. Verify: `SELECT * FROM pg_extension WHERE extname = 'vector';`
4. Re-run migrations: `npm run db:deploy`

### Issue: Webhook Returns 401 Unauthorized

**Symptoms**:
- Hook script shows "401 Unauthorized"
- Production webhook rejects requests

**Solutions**:
1. Verify CLAUDE_HOOK_API_KEY in Render environment matches hook script
2. Check Authorization header format: `Bearer <key>`
3. Ensure NODE_ENV=production in Render
4. Test with curl to verify auth setup

### Issue: Hooks Not Firing

**Symptoms**:
- No database entries created
- No webhook logs in Render
- Claude Code sessions don't trigger hooks

**Solutions**:
1. Check `.claude/settings.json` has hooks configured
2. Verify hook script is executable: `chmod +x .claude/hooks/capture-conversation.js`
3. Test manual execution: `CLAUDE_HOOK_EVENT=SessionStart node .claude/hooks/capture-conversation.js`
4. Check Claude Code console for hook errors
5. Enable debug mode: `CLAUDE_HOOK_DEBUG=true`

### Issue: Frontend Displays No Data

**Symptoms**:
- Conversation list is empty
- Detail pages show loading spinner
- tRPC queries return empty arrays

**Solutions**:
1. Verify database has data: `SELECT COUNT(*) FROM conversations;`
2. Test tRPC endpoint: `curl https://arrakis-prod.onrender.com/api/trpc/conversation.getAll`
3. Check browser console for errors
4. Verify React Query is configured correctly
5. Check for CORS issues (shouldn't happen with same-origin)

### Issue: Build Fails on Deployment

**Symptoms**:
- Render deployment shows "Build failed"
- TypeScript errors in build logs
- Missing dependencies

**Solutions**:
1. Run locally first: `npm run build`
2. Check all dependencies in package.json
3. Verify TypeScript: `npm run type-check`
4. Check Node version matches (18+)
5. Clear build cache in Render dashboard

---

## Validation Checklist

Use this checklist to verify everything is working:

### Phase 1: Database ✅
- [ ] Migrations committed to git
- [ ] Migrations pushed to GitHub
- [ ] Auto-deploy completed successfully
- [ ] pgvector extension enabled
- [ ] Migrations applied to production database
- [ ] All tables exist (4 tables)
- [ ] All indexes exist (18+ indexes)
- [ ] Database connection works from Render shell

### Phase 2: Webhook ✅
- [ ] Webhook endpoint accessible (returns 405 on GET)
- [ ] Authentication works (401 without key, 200/400 with key)
- [ ] Valid payload creates database record
- [ ] Test conversation appears in database
- [ ] tRPC endpoint returns test data

### Phase 3: End-to-End ✅
- [ ] Hook configuration updated for production URL
- [ ] Manual hook test succeeds
- [ ] Real Claude Code session triggers hooks
- [ ] Conversation created in database
- [ ] Messages captured correctly
- [ ] Tool uses recorded with duration and status
- [ ] Transcript parsing works (if SessionEnd fired)

### Phase 4: Frontend ✅
- [ ] Dashboard page loads
- [ ] Conversation list displays data
- [ ] Conversation detail shows messages
- [ ] Stats page accessible
- [ ] No console errors
- [ ] tRPC queries work correctly

---

## Success Criteria

You'll know the deployment is complete when:

1. ✅ Database migrations applied successfully
2. ✅ Webhook endpoint accepts and processes hook events
3. ✅ Claude Code sessions create conversation records
4. ✅ Messages and tool uses captured correctly
5. ✅ Frontend displays captured conversations
6. ✅ Detail pages show full conversation history
7. ✅ No errors in Render logs
8. ✅ No errors in browser console

---

## After Success - Optional Enhancements

Once basic capture is working, consider:

### Short-term Improvements (1-2 days)
1. Add error monitoring (Sentry, Rollbar)
2. Implement rate limiting on webhook
3. Add conversation search (text-based)
4. Create analytics dashboard
5. Add API documentation with examples

### Medium-term Features (1-2 weeks)
6. Implement OpenAI embedding service
7. Build semantic search UI
8. Add conversation tagging/categorization
9. Create export functionality (JSON/Markdown)
10. Add user preferences and settings

### Long-term Enhancements (1+ month)
11. Real-time conversation updates (WebSockets)
12. Conversation branching support
13. Advanced analytics and insights
14. Integration with other AI tools
15. Multi-user support with authentication

---

## Time Estimates

**Absolute Minimum** (everything works first try): 1.5 hours
- Database deployment: 30 min
- Webhook testing: 20 min
- End-to-end test: 30 min
- Frontend verification: 10 min

**Realistic** (some troubleshooting needed): 2-4 hours
- Database issues: +30 min
- Webhook debugging: +30 min
- Hook configuration: +30 min
- Testing iterations: +30 min

**Worst Case** (major issues): 6-8 hours
- Database connectivity problems: +2 hours
- pgvector setup issues: +1 hour
- Network/firewall issues: +2 hours
- Debugging production errors: +2 hours

---

## Documentation Updates Needed

After successful deployment, update:

1. **README.md** - Add "Deployment" section with live URL
2. **docs/PROJECT_STATUS.md** - Update to "100% Complete - Production"
3. **docs/STATE.md** - Mark all items as "Working in Production"
4. **docs/DEPLOYMENT_GUIDE.md** - Create detailed deployment documentation
5. **docs/API_SPEC.md** - Document webhook API with examples

---

## Need Help?

**Key Files to Check**:
- `c:\projects\arrakis\docs\STATE.md` - Current state details
- `c:\projects\arrakis\docs\DATABASE.md` - Database architecture
- `c:\projects\arrakis\docs\CLAUDE_HOOKS_INTEGRATION.md` - Hook system docs
- `c:\projects\arrakis\docs\QUICK_START.md` - Quick start guide

**Common Commands**:
```bash
# Check deployment status
git status
git log --oneline -5

# Test database connection
npm run db:generate
npx prisma studio

# Test builds
npm run type-check
npm run build

# Test webhook
curl -X POST https://arrakis-prod.onrender.com/api/claude-hooks \
  -H "Authorization: Bearer 7d3e4490f7d8c68f82dd9e93d55fa714a34107e96b654c6373eba45c99aa7b38" \
  -H "Content-Type: application/json" \
  -d '{"event":"SessionStart","timestamp":"2025-09-29T19:00:00Z"}'
```

**Render Dashboard**:
- URL: https://dashboard.render.com
- Workspace: tea-d303qfodl3ps739p3e60
- Database: arrakis-prod-db
- Web Service: arrakis-prod

Good luck! The system is well-built and should deploy smoothly. 🚀