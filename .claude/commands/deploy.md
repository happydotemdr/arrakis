---
name: deploy
description: Run complete deployment workflow with quality checks and Render deployment to production
---

# Deploy Workflow

Execute the full deployment checklist for Arrakis to production on Render.

## Workflow Steps

### 1. Pre-Deployment Quality Checks
- [ ] Run `npm run check` to verify code quality
- [ ] Ensure all tests pass
- [ ] Check for uncommitted changes with `git status`
- [ ] Review recent commits with `git log -5`

### 2. Security Validation
- [ ] Invoke security-specialist agent to review for vulnerabilities
- [ ] Verify no secrets in code or config files
- [ ] Check environment variable configuration

### 3. Database Migrations (if applicable)
- [ ] Check for pending Render PostgreSQL migrations
- [ ] Review migration safety
- [ ] Backup production database before migrations

### 4. Build Verification
- [ ] Run production build
- [ ] Check for build warnings or errors
- [ ] Verify bundle sizes are reasonable

### 5. Git Commit & Push
- [ ] Stage all changes: `git add .`
- [ ] Create deployment commit with proper message
- [ ] Push to remote: `git push origin master`

### 6. Render Deployment
- [ ] List Render services to verify deployment target
- [ ] Monitor deployment progress in Render dashboard
- [ ] Check deployment logs for errors
- [ ] Verify service health after deployment

### 7. Database Migration Execution
- [ ] Run database migrations on production PostgreSQL (if any)
- [ ] Verify migrations completed successfully
- [ ] Check data integrity post-migration

### 8. Post-Deployment Validation
- [ ] Test critical user flows on production
- [ ] Check error monitoring/logging
- [ ] Verify database connections
- [ ] Monitor performance metrics
- [ ] Check application health endpoint

## Rollback Plan

If deployment fails:
1. Check Render deployment logs
2. Identify the failing component
3. Revert to previous deploy in Render dashboard
4. Roll back database migrations if needed
5. Fix issue locally and redeploy

## Important Notes

- **Single environment**: We only deploy to production (no staging)
- **Cost optimization**: Testing happens locally before prod push
- **Risk mitigation**: Use Render's rollback feature if needed
- **Database**: PostgreSQL 17 hosted on Render

## Success Criteria

- ✅ All quality checks pass
- ✅ Build completes without errors
- ✅ Deployment succeeds on Render
- ✅ Database migrations complete successfully
- ✅ Application responds to health checks
- ✅ No critical errors in production logs
- ✅ User flows work correctly