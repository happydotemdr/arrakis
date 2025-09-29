# Render.com Quick Reference

Fast reference for common Render.com operations with Arrakis.

## Quick Commands

### Health Checks
```bash
# Check all environments
curl https://arrakis-dev.onrender.com/api/health
curl https://arrakis.onrender.com/api/health
```

### Local Development
```bash
# Start development server
bun run dev

# Run health check locally
bun run health:check

# Run type checking
bun run type-check

# Run full quality check
bun run check
```

### Database Operations
```bash
# Generate migration
bun run db:generate

# Run migrations
bun run db:migrate

# Open database studio
bun run db:studio

# Seed database
bun run db:seed
```

### Deployments

#### Automatic Deployments
- Push to `develop` → Deploy to Development
- Push to `master` → Deploy to Production

#### Manual Deployment
1. Go to GitHub Actions
2. Select "Render.com Deployment"
3. Click "Run workflow"
4. Choose environment
5. Click "Run workflow"

### Environment URLs
- **Development**: https://arrakis-dev.onrender.com
- **Production**: https://arrakis.onrender.com

### Database URLs
Access via Render Dashboard → Database → Connection Details:
- Development: `arrakis-dev-db`
- Production: `arrakis-prod-db`

## Environment Variables

### Required Secrets
Set in Render Dashboard → Service → Environment:

```bash
ANTHROPIC_API_KEY=sk-ant-api03-xxx
OPENAI_API_KEY=sk-proj-xxx
```

### Automatic Variables
Set by render.yaml:

```bash
DATABASE_URL=postgresql://user:pass@host:port/db
REDIS_URL=redis://host:port
NEXT_PUBLIC_APP_URL=https://service.onrender.com
NODE_ENV=production
NEXT_PUBLIC_ENV=development|production
```

## Monitoring

### View Logs
```bash
# Via Render Dashboard
Dashboard → Service → Logs

# Via Render CLI
render logs --service arrakis-dev
render logs --service arrakis-prod
```

### Metrics
Monitor in Render Dashboard:
- CPU usage
- Memory usage
- Response times
- Error rates
- Database connections

## Troubleshooting

### Build Issues
1. Check GitHub Actions logs
2. Verify package.json dependencies
3. Check Bun version compatibility
4. Ensure render.yaml syntax is correct

### Database Issues
1. Verify DATABASE_URL is set
2. Check database status in Render Dashboard
3. Test connection with health check
4. Review migration logs

### Health Check Failures
1. Check `/api/health` endpoint directly
2. Review application logs in Render Dashboard
3. Verify database and Redis connectivity
4. Check environment variables

## Common Tasks

### Add New Environment Variable
1. Go to Render Dashboard
2. Select service
3. Click "Environment" tab
4. Add variable
5. Save and redeploy

### Update Secret
1. Go to Render Dashboard
2. Select service
3. Update environment variable
4. Service will auto-restart

### Manual Redeploy
1. Go to Render Dashboard
2. Select service
3. Click "Manual Deploy"
4. Select commit/branch
5. Click "Deploy"

### Scale Service
1. Go to Render Dashboard
2. Select service
3. Click "Settings" tab
4. Adjust "Instance Count"
5. Save changes

## File Structure

### Key Files
- `render.yaml` - Infrastructure blueprint
- `.github/workflows/render-deploy.yml` - Deployment workflow
- `config/environment.ts` - Environment configuration
- `app/api/health/route.ts` - Health check endpoint
- `scripts/worker.ts` - Background worker process
- `scripts/health-check.ts` - Health check logic

### Environment Configs
- Development: Free tier, debug logging
- Production: Basic tier, warning logging

## Support Resources

- **Render Docs**: https://render.com/docs
- **Render Status**: https://status.render.com
- **GitHub Actions**: Repository Actions tab
- **Health Checks**: `/api/health` endpoints

## Emergency Procedures

### Rollback Deployment
1. Go to Render Dashboard
2. Select service
3. Click "Deploy" tab
4. Find previous successful deploy
5. Click "Redeploy"

### Database Restore
1. Access database backups in Render Dashboard
2. Download backup file
3. Restore using `psql`:
   ```bash
   psql $DATABASE_URL < backup.sql
   ```

### Service Restart
1. Go to Render Dashboard
2. Select service
3. Click "Restart Service"

This setup provides a robust, scalable, and maintainable deployment infrastructure for Arrakis following Render.com's 2025 best practices.