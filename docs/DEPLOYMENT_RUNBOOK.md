# Deployment Runbook: Arrakis Webhook System

**Purpose:** Step-by-step deployment procedures, troubleshooting, and rollback strategies
**Audience:** Operations team, DevOps engineers, developers deploying changes
**Last Updated:** 2025-09-30

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Deployment Procedures](#deployment-procedures)
3. [Common Deployment Issues](#common-deployment-issues)
4. [Rollback Procedures](#rollback-procedures)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Emergency Procedures](#emergency-procedures)

---

## Pre-Deployment Checklist

### Code Quality Verification

```bash
# Run all quality checks
npm run check          # TypeScript + ESLint
npm run format         # Prettier formatting
npm test              # Run test suite (if exists)
npm run build         # Verify production build locally
```

### Database Changes

**If schema changes are included:**

```bash
# 1. Review migration files
ls prisma/migrations/

# 2. Test migration locally
npm run db:migrate

# 3. Verify Prisma client generation
npm run db:generate

# 4. Check generated types
grep "model WebhookEvent" node_modules/.prisma/client/index.d.ts

# 5. Ensure build script includes prisma generate
grep "prisma generate" package.json
# Should see: "build": "prisma generate && next build"
```

### Environment Variables

```bash
# Verify all required environment variables are set in Render
# - DATABASE_URL
# - DIRECT_URL
# - CLAUDE_HOOK_API_KEY
# - NODE_ENV
# - Any other app-specific vars

# Check Render dashboard:
# https://dashboard.render.com/web/srv-*/env
```

### Git Status

```bash
# Ensure clean working directory
git status

# Verify all changes committed
git diff

# Check branch
git branch --show-current

# Verify origin is correct
git remote -v
```

---

## Deployment Procedures

### Standard Deployment (Render.com)

Render is configured with **auto-deploy on push to master**. Every push triggers a new deployment.

#### Step 1: Push to Production

```bash
# Ensure you're on master branch
git checkout master

# Pull latest changes
git pull origin master

# Merge your feature branch (if applicable)
git merge feature-branch-name

# Push to trigger deployment
git push origin master
```

#### Step 2: Monitor Build

1. Open Render dashboard: https://dashboard.render.com/
2. Navigate to your service: `Arrakis` or workspace ID `tea-d303qfodl3ps739p3e60`
3. Click on "Logs" tab
4. Watch build output in real-time

**Expected build steps:**
```
1. Cloning repository
2. Installing dependencies (npm install)
3. Generating Prisma client (prisma generate)
4. Building Next.js (next build)
5. Starting server (npm start)
```

#### Step 3: Watch for Critical Steps

**Prisma Client Generation:**
```
✓ Generated Prisma Client (3.2s)
```
If you see this, Prisma client was regenerated successfully.

**Next.js Build:**
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
```

**Common Build Warnings (Safe to Ignore):**
- "Duplicate atom key" warnings (React-related)
- "Module not found" for optional dependencies
- Unused variable warnings (ESLint)

#### Step 4: Deployment Completion

**Success indicators:**
- Build log shows "Build succeeded"
- Service status changes to "Live"
- Health check passes (if configured)
- URL responds to requests

**Failure indicators:**
- Build log shows "Build failed"
- Service status shows "Build Failed"
- Error messages in red
- Service remains on previous version

---

### Database Schema Deployment

**CRITICAL:** Always use migrations for schema changes, never `db:push` in production.

#### Step 1: Create Migration Locally

```bash
# Create migration with descriptive name
npm run db:migrate -- --name add_webhook_event_table

# This creates a new migration file in prisma/migrations/
```

#### Step 2: Review Migration SQL

```bash
# Open generated migration file
cat prisma/migrations/[timestamp]_add_webhook_event_table/migration.sql

# Verify SQL is correct:
# - No DROP statements (unless intentional)
# - Indexes created for performance
# - Constraints properly defined
```

#### Step 3: Test Migration Locally

```bash
# Apply migration to local database
npm run db:migrate

# Verify database state
npm run db:studio

# Test that application works with new schema
npm run dev
# Run manual tests
```

#### Step 4: Deploy to Production

```bash
# Commit migration files
git add prisma/migrations/
git add prisma/schema.prisma
git commit -m "feat: Add webhook event tracking table"

# Push (Render auto-deploys)
git push origin master
```

**Render Build Process:**
1. Pulls new code (includes migration files)
2. Runs `prisma generate` (build script)
3. Runs `prisma migrate deploy` (postinstall script or manual)
4. Builds Next.js
5. Starts application

**Note:** Migrations run automatically if you have a `postdeploy` script:
```json
{
  "scripts": {
    "postdeploy": "prisma migrate deploy"
  }
}
```

---

## Common Deployment Issues

### Issue 1: Prisma Client Not Generated

**Symptoms:**
```
Error: @prisma/client did not initialize yet.
Please run "prisma generate" and try to import it again.
```

**Cause:**
Build script doesn't include `prisma generate` before Next.js build.

**Solution:**
```bash
# Update package.json
{
  "scripts": {
    "build": "prisma generate && next build"
  }
}

# Commit and redeploy
git add package.json
git commit -m "fix: Add prisma generate to build command"
git push origin master
```

**Prevention:**
- Always include `prisma generate` in build script
- Never rely on postinstall scripts for generated code
- Test on clean environment before deploying

---

### Issue 2: Database Migration Failed

**Symptoms:**
```
Error: P3005: The database schema is not empty.
Migration failed to apply.
```

**Cause:**
- Migration conflicts with existing data
- Constraint violations
- Incompatible schema changes

**Solution:**

**Option A: Fix Migration (Recommended)**
```bash
# 1. Rollback locally
npm run db:migrate -- --rollback

# 2. Modify migration SQL
# Edit prisma/migrations/[timestamp]/migration.sql

# 3. Re-apply locally
npm run db:migrate

# 4. Redeploy
git add prisma/migrations/
git commit -m "fix: Corrected migration SQL"
git push origin master
```

**Option B: Reset Migration (Dangerous)**
```bash
# Only for development/staging!
# This will drop all data!
prisma migrate reset

# Recreate from scratch
npm run db:migrate
```

**Prevention:**
- Test migrations on copy of production data
- Use non-breaking changes when possible
- Add data migration scripts for breaking changes

---

### Issue 3: Environment Variables Missing

**Symptoms:**
```
Error: Environment variable not found: DATABASE_URL
```

**Cause:**
Required environment variables not configured in Render.

**Solution:**

1. Go to Render dashboard
2. Navigate to service settings
3. Click "Environment" tab
4. Add missing variables:
   - `DATABASE_URL` - PostgreSQL connection string
   - `DIRECT_URL` - Direct connection (for migrations)
   - `CLAUDE_HOOK_API_KEY` - API authentication key
5. Click "Save Changes"
6. Trigger manual redeploy

**Prevention:**
- Document all required environment variables
- Use `.env.example` file as reference
- Verify variables before deployment

---

### Issue 4: Build Timeout

**Symptoms:**
```
Error: Build exceeded 15 minute timeout
```

**Cause:**
- Slow dependency installation
- Large file operations
- Network issues

**Solution:**

**Immediate:**
1. Click "Manual Deploy" to retry
2. Build may succeed on second attempt

**Long-term:**
```bash
# Optimize dependencies
npm prune
npm dedupe

# Remove unused dependencies
npm uninstall <unused-packages>

# Commit optimizations
git add package.json package-lock.json
git commit -m "perf: Optimize dependencies"
git push origin master
```

**Prevention:**
- Keep dependencies minimal
- Use npm ci instead of npm install (faster)
- Monitor build times

---

### Issue 5: Runtime Errors After Deployment

**Symptoms:**
- Build succeeds but application crashes on startup
- 502 Bad Gateway errors
- Service shows "Live" but doesn't respond

**Diagnosis:**

```bash
# Check Render logs
# Look for errors after "Starting server" message

# Common errors:
# - Database connection failed
# - Port binding issues
# - Initialization errors
```

**Solution:**

**Database Connection:**
```bash
# Verify DATABASE_URL is correct
# Test connection:
psql "$DATABASE_URL" -c "SELECT 1;"

# Check IP whitelist in Render database settings
# Add Render's outbound IP addresses
```

**Port Binding:**
```bash
# Ensure Next.js listens on correct port
# Render sets PORT environment variable
# Next.js uses PORT automatically
```

**Initialization:**
```bash
# Check for missing environment variables
# Verify all required configs are set
# Look for startup errors in logs
```

---

## Rollback Procedures

### Quick Rollback (Render Dashboard)

**Use when:** Current deployment has critical bugs, need to restore previous version immediately.

1. Go to Render dashboard
2. Navigate to service
3. Click "Deploys" tab
4. Find previous successful deploy
5. Click "⋮" menu → "Redeploy"
6. Wait for deployment to complete
7. Verify rollback successful

**Rollback time:** ~5 minutes

---

### Git Rollback (For Code Changes)

**Use when:** Need to revert specific commits.

```bash
# Option 1: Revert last commit
git revert HEAD
git push origin master

# Option 2: Revert specific commit
git revert <commit-hash>
git push origin master

# Option 3: Hard reset (dangerous!)
# Only if you're sure nobody else has pulled
git reset --hard <previous-commit>
git push origin master --force
```

**Rollback time:** ~7 minutes (includes rebuild)

---

### Database Rollback (For Schema Changes)

**Use when:** Need to undo database migrations.

**⚠️ WARNING:** Database rollbacks can cause data loss. Always backup first!

#### Step 1: Backup Current State

```bash
# Create backup
pg_dump "$DATABASE_URL" > backup-$(date +%Y%m%d-%H%M%S).sql

# Verify backup
ls -lh backup-*.sql
```

#### Step 2: Rollback Migration

```bash
# Rollback last migration
prisma migrate resolve --rolled-back <migration-name>

# Or manually run rollback SQL
psql "$DATABASE_URL" -f rollback.sql
```

#### Step 3: Deploy Code Rollback

```bash
# Revert code that depends on new schema
git revert <migration-commit>
git push origin master
```

#### Step 4: Verify

```bash
# Check schema
psql "$DATABASE_URL" -c "\d webhook_events"

# Verify application works
curl https://arrakis-prod.onrender.com/api/health
```

**Rollback time:** ~15 minutes (includes backup and verification)

---

## Post-Deployment Verification

### Automated Checks

```bash
# Health check
curl https://arrakis-prod.onrender.com/api/health
# Expected: {"status": "ok"}

# Webhook endpoint
curl -X POST https://arrakis-prod.onrender.com/api/claude-hooks \
  -H "Authorization: Bearer $CLAUDE_HOOK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event":"SessionStart","sessionId":"test-123","timestamp":"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}'
# Expected: {"success": true, "requestId": "req_..."}

# Database connectivity
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM webhook_events;"
# Expected: Numeric count
```

### Manual Verification

**1. Test End-to-End Flow:**
- Start new Claude Code conversation
- Verify webhook captured in database
- Check conversation record created
- Verify no errors in logs

**2. Check Database Schema:**
```sql
-- Verify tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';

-- Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'webhook_events';

-- Check recent data
SELECT * FROM webhook_events
ORDER BY received_at DESC
LIMIT 5;
```

**3. Monitor Performance:**
```sql
-- Average processing time
SELECT
  event_type,
  AVG(processing_time) as avg_ms,
  COUNT(*) as total
FROM webhook_events
WHERE received_at > NOW() - INTERVAL '1 hour'
  AND processing_time IS NOT NULL
GROUP BY event_type;
```

**4. Check Error Rates:**
```sql
-- Error rate last hour
SELECT
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM webhook_events
WHERE received_at > NOW() - INTERVAL '1 hour'
GROUP BY status;
```

### Success Criteria

**Deployment is successful when:**
- ✅ Build completed without errors
- ✅ Service status shows "Live"
- ✅ Health check returns 200 OK
- ✅ Webhook API responds correctly
- ✅ Database schema matches expected state
- ✅ No errors in Render logs (last 10 minutes)
- ✅ End-to-end test conversation captured
- ✅ Performance metrics within acceptable range (<200ms P95)

---

## Emergency Procedures

### Critical Production Issue

**Symptoms:**
- All webhook captures failing
- Database connection errors
- API returning 500 errors
- Service unavailable

**Immediate Response:**

**1. Assess Severity (30 seconds)**
```bash
# Check service status
curl -I https://arrakis-prod.onrender.com/

# Check database
psql "$DATABASE_URL" -c "SELECT 1;"

# Check Render logs
# Look for error patterns
```

**2. Quick Fix Attempts (2 minutes)**
```bash
# Option 1: Restart service
# Render dashboard → "Manual Deploy" → "Restart"

# Option 2: Rollback to last known good
# Render dashboard → "Deploys" → Redeploy previous

# Option 3: Check environment variables
# Verify DATABASE_URL, API keys still set
```

**3. Failover Plan (5 minutes)**
```bash
# If database is down:
# - Check Render database status
# - Check IP whitelist
# - Restart database service

# If API is down:
# - Check Render service logs
# - Verify build succeeded
# - Check for out-of-memory errors
```

**4. Communication (Immediate)**
- Notify team in Slack/email
- Update status page (if applicable)
- Document issue for post-mortem

### Escalation Path

**Level 1 (Developer):**
- Check logs
- Attempt quick fixes
- Rollback if necessary

**Level 2 (Tech Lead):**
- Review deployment changes
- Coordinate with team
- Make architectural decisions

**Level 3 (CTO/Vendor Support):**
- Contact Render support
- Database vendor support
- Critical infrastructure issues

---

## Deployment Checklist

### Before Deployment
- [ ] All tests passing locally
- [ ] TypeScript compilation successful
- [ ] ESLint checks passing
- [ ] Code formatted with Prettier
- [ ] Environment variables documented
- [ ] Database migrations tested
- [ ] Prisma client generation verified
- [ ] Build succeeds locally
- [ ] Changes reviewed by peer

### During Deployment
- [ ] Push to master branch
- [ ] Monitor Render build logs
- [ ] Verify Prisma client generated
- [ ] Verify Next.js build successful
- [ ] Check for build errors/warnings
- [ ] Wait for "Live" status

### After Deployment
- [ ] Health check passes
- [ ] Webhook API responds
- [ ] Database accessible
- [ ] End-to-end test successful
- [ ] No errors in logs (10 min)
- [ ] Performance metrics acceptable
- [ ] Document any issues
- [ ] Update deployment log

---

## Deployment History Template

**Deployment Date:** 2025-09-30
**Deployed By:** [Developer Name]
**Git Commit:** d01588f
**Changes:**
- Fixed Prisma client generation in build script
- Deployment now includes `prisma generate`

**Issues Encountered:**
- Initial deployment failed (ee9dcff) due to missing Prisma client
- Fixed by adding `prisma generate` to build command

**Rollback Needed:** No
**Post-Deployment Status:** ✅ Successful

---

## Best Practices

### Development Workflow
1. Develop and test locally
2. Push to feature branch
3. Create pull request
4. Peer review
5. Merge to master (triggers deploy)
6. Monitor deployment
7. Verify in production

### Database Changes
1. Always use migrations (never `db:push` in production)
2. Test migrations on copy of production data
3. Have rollback SQL ready
4. Backup before schema changes
5. Verify Prisma client regenerates

### Monitoring
1. Check logs immediately after deployment
2. Monitor for 1 hour after major changes
3. Set up alerts for error rates
4. Track performance metrics
5. Document any anomalies

### Emergency Response
1. Have rollback procedure ready
2. Know who to escalate to
3. Keep communication channels open
4. Document all incidents
5. Conduct post-mortems

---

## Troubleshooting Quick Reference

| Issue | Quick Fix | Time |
|-------|-----------|------|
| Build failed | Check logs, fix error, redeploy | 5-10 min |
| Database connection | Check DATABASE_URL, IP whitelist | 2-5 min |
| Prisma client missing | Add `prisma generate` to build | 5-7 min |
| Migration failed | Rollback, fix SQL, redeploy | 10-15 min |
| Service crashed | Restart service, check logs | 2-5 min |
| Need rollback | Redeploy previous version | 5-7 min |

---

## Additional Resources

**Render Documentation:**
- Build configuration: https://render.com/docs/deploys
- Database management: https://render.com/docs/databases
- Environment variables: https://render.com/docs/environment-variables

**Prisma Documentation:**
- Migrations: https://www.prisma.io/docs/concepts/components/prisma-migrate
- Client generation: https://www.prisma.io/docs/concepts/components/prisma-client

**Project Documentation:**
- Architecture: `docs/WEBHOOK_PHASE1_ARCHITECTURE.md`
- Developer guide: `docs/WEBHOOK_DEVELOPER_GUIDE.md`
- Troubleshooting: `docs/WEBHOOK_TROUBLESHOOTING.md`

---

**Last Updated:** 2025-09-30
**Maintained By:** Development Team
**Review Schedule:** After each major deployment or incident
