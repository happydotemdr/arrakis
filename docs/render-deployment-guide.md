# Render.com Deployment Guide

Complete guide for deploying Arrakis to Render.com with proper dev/prod environment separation following 2025 best practices and cost optimization.

## Overview

This guide transforms Arrakis from a mixed GitHub + Neon + local setup to a clean, professional Render.com infrastructure with:

- ✅ **Environment Separation**: Development and Production (cost-optimized 2-environment setup)
- ✅ **Infrastructure as Code**: YAML blueprints
- ✅ **Automated CI/CD**: GitHub Actions integration
- ✅ **Database Migration**: From Neon to Render PostgreSQL
- ✅ **Security**: Proper secret management and environment isolation
- ✅ **Cost Optimization**: ~$22/month total with free development tier

## Prerequisites

Before starting the migration:

1. **Render.com Account**: Create account at [render.com](https://render.com)
2. **GitHub Repository**: Ensure code is pushed to GitHub
3. **Environment Variables**: Gather all current secrets (API keys, etc.)
4. **Database Backup**: Export current Neon database data

## Phase 1: Render.com Setup (30 minutes)

### 1.1 Create Render Account and Project

1. Sign up at [render.com](https://render.com)
2. Connect your GitHub account
3. Create a new project called "Arrakis"
4. Generate a Render API key for CI/CD

### 1.2 Configure GitHub Secrets

Add these secrets to your GitHub repository (`Settings > Secrets and variables > Actions`):

```bash
RENDER_API_KEY=rnd_xxxxxxxxxxxx
```

### 1.3 Update Repository References

Update `render.yaml` line 45, 69, 93 to point to your actual repository:

```yaml
repo: https://github.com/YOURUSERNAME/arrakis.git
```

## Phase 2: Environment Groups Setup (15 minutes)

### 2.1 Create Environment Groups in Render Dashboard

Environment groups centralize configuration management and reduce duplication. The blueprint includes these groups, but secret groups must be created manually:

1. **Go to Render Dashboard** → Navigate to your team/workspace
2. **Environment Groups** → Click "Create Environment Group"
3. **Create Secret Groups**:

**Development Secrets Group** (`arrakis-secrets-dev`):
```
ANTHROPIC_API_KEY=sk-ant-api03-[your-dev-key]
OPENAI_API_KEY=sk-proj-[your-dev-key]
```

**Production Secrets Group** (`arrakis-secrets-prod`):
```
ANTHROPIC_API_KEY=sk-ant-api03-[your-prod-key]
OPENAI_API_KEY=sk-proj-[your-prod-key]
```

> **Note**: Use separate API keys for dev/prod environments when possible for better security and billing tracking.

### 2.2 Update render.yaml (If Needed)

If you want to use the secret groups in your blueprint, uncomment and modify these sections in `render.yaml`:

```yaml
envVarGroups:
  # Uncomment these after creating the groups in Dashboard
  - name: arrakis-secrets-dev
    envVars:
      - key: ANTHROPIC_API_KEY
        value: # Set in Render Dashboard
      - key: OPENAI_API_KEY
        value: # Set in Render Dashboard

  - name: arrakis-secrets-prod
    envVars:
      - key: ANTHROPIC_API_KEY
        value: # Set in Render Dashboard
      - key: OPENAI_API_KEY
        value: # Set in Render Dashboard
```

Then update your services to reference these groups:
```yaml
envVarGroups:
  - arrakis-shared
  - arrakis-dev
  - arrakis-secrets-dev  # Add this line
```

## Phase 3: Database Migration (1-2 hours)

### 3.1 Export Data from Neon

```bash
# Export current database
pg_dump $CURRENT_NEON_DATABASE_URL > arrakis_backup.sql

# Or use Neon's export feature in their dashboard
```

### 3.2 Deploy Infrastructure

1. **Push to GitHub**: Ensure all code is committed and pushed
2. **Deploy Blueprint**: Go to Render Dashboard > "New" > "Blueprint"
3. **Connect Repository**: Select your GitHub repository
4. **Select render.yaml**: Render will detect the blueprint automatically
5. **Provide Secrets**: When prompted, enter your API keys for each service

> **Tip**: If you created secret environment groups, you can skip entering secrets per-service and just reference the groups.

### 3.3 Import Data to Render PostgreSQL

After deployment completes:

1. **Get Connection Strings**: From Render Dashboard
   - Development DB: `arrakis-dev-db`
   - Production DB: `arrakis-prod-db`

2. **Import Data**:
```bash
# Import to production first
psql $RENDER_PROD_DATABASE_URL < arrakis_backup.sql

# Copy to development (optional - you might want fresh data)
pg_dump $RENDER_PROD_DATABASE_URL | psql $RENDER_DEV_DATABASE_URL
```

## Phase 4: Environment Configuration (30 minutes)

### 4.1 Branch Strategy

Create the development branch in your repository:

```bash
# Create and push development branch
git checkout -b develop
git push origin develop

# master branch already exists for production
```

### 4.2 Environment URLs

After deployment, your environments will be available at:

- **Development**: `https://arrakis-dev.onrender.com`
- **Production**: `https://arrakis.onrender.com` (after custom domain setup)

### 4.3 Custom Domain (Production)

1. Go to Render Dashboard > Production Service > Settings
2. Add custom domain: `yourdomain.com`
3. Configure DNS records as instructed by Render

## Phase 5: CI/CD Workflows (15 minutes)

### 5.1 Automated Deployments

The GitHub Actions workflows will automatically:

- **Push to `develop`** → Deploy to Development
- **Push to `master`** → Deploy to Production (requires manual approval)

### 5.2 Manual Deployments

Trigger manual deployments via GitHub Actions:

1. Go to GitHub > Actions > "Render.com Deployment"
2. Click "Run workflow"
3. Select environment (development/production)
4. Click "Run workflow"

## Environment Groups Strategy

### Why Environment Groups?

Environment groups provide centralized configuration management with these benefits:

- **No Duplication**: Set `ANTHROPIC_API_KEY` once, use across multiple services
- **Consistency**: All dev environments get identical configuration
- **Security**: Separate secret groups with restricted access
- **Easier Updates**: Change shared configs in one place
- **Audit Trail**: Track who changed what and when

### Current Environment Groups

Your `render.yaml` includes these pre-configured groups:

**`arrakis-shared`** (All environments):
- `NODE_ENV=production`
- `NEXT_TELEMETRY_DISABLED=1`
- `FORCE_COLOR=1`
- `NEXT_PUBLIC_APP_NAME=Arrakis`

**`arrakis-dev`** (Development only):
- `LOG_LEVEL=debug`
- `NEXT_PUBLIC_ENV=development`
- `ENABLE_QUERY_LOGGING=true`
- `ENABLE_DEV_TOOLS=true`


**`arrakis-prod`** (Production only):
- `LOG_LEVEL=warn`
- `NEXT_PUBLIC_ENV=production`
- `ENABLE_QUERY_LOGGING=false`
- `ENABLE_DEV_TOOLS=false`
- `NODE_OPTIONS=--max-old-space-size=4096`

### Managing Environment Groups

**Adding New Shared Configuration**:
1. Go to Render Dashboard → Environment Groups
2. Select `arrakis-shared`
3. Add new environment variable
4. All services automatically get the new config

**Environment-Specific Changes**:
1. Select the appropriate group (`arrakis-dev`, `arrakis-prod`)
2. Add or modify variables
3. Only services using that group are affected

**Secret Management** (Manual Setup Required):
Create these groups in Render Dashboard:
- `arrakis-secrets-dev` → Development API keys
- `arrakis-secrets-prod` → Production API keys

## Environment Management

### Development Environment

- **Purpose**: Feature development and testing
- **Auto-deploy**: Yes (from `develop` branch)
- **Database**: Free tier PostgreSQL with sample data
- **Monitoring**: Debug logging enabled

### Production Environment

- **Purpose**: Live application
- **Auto-deploy**: No (manual approval required)
- **Database**: Basic tier PostgreSQL with automated backups
- **Monitoring**: Warning-level logging, error tracking

## Database Operations

### Running Migrations

Migrations run automatically during deployment. For manual migrations:

```bash
# Connect to specific environment
bun run db:migrate  # Uses DATABASE_URL from environment
```

### Database Access

Access databases via Render Dashboard or direct connection:

```bash
# Development
psql $DEV_DATABASE_URL

# Production (use carefully!)
psql $PROD_DATABASE_URL
```

### Backups

Render automatically backs up Basic tier and higher databases. For manual backups:

```bash
# Backup production
pg_dump $PROD_DATABASE_URL > backup_$(date +%Y%m%d).sql
```

## Monitoring and Logging

### Health Checks

All environments include automatic health checks at `/api/health`:

```bash
# Check environment health
curl https://arrakis-dev.onrender.com/api/health
curl https://arrakis.onrender.com/api/health
```

### Log Access

View logs in Render Dashboard or via CLI:

```bash
# Install Render CLI
curl -sL https://render.com/install.sh | bash

# View logs
render logs --service arrakis-dev
render logs --service arrakis-prod
```

### Performance Monitoring

Monitor performance metrics in Render Dashboard:

- CPU and memory usage
- Response times
- Error rates
- Database connections

## Security

### Environment Isolation

Each environment is completely isolated:

- Separate databases
- Separate Redis instances
- Cross-environment traffic blocked
- Environment-specific secrets

### Secret Management

Secrets are managed per environment in Render Dashboard:

1. Go to Service > Environment
2. Add/update environment variables
3. Restart service if needed

### SSL/TLS

All environments automatically get SSL certificates:

- Automatic Let's Encrypt certificates
- HTTP redirects to HTTPS
- HSTS headers enabled

## Troubleshooting

### Common Issues

**Build Failures**:
```bash
# Check build logs in Render Dashboard
# Ensure all dependencies are in package.json
# Verify Bun version compatibility
```

**Database Connection Issues**:
```bash
# Verify DATABASE_URL environment variable
# Check database status in Render Dashboard
# Test connection from local environment
```

**Health Check Failures**:
```bash
# Check /api/health endpoint directly
# Review application logs
# Verify all dependencies are available
```

### Support

- **Render Documentation**: [render.com/docs](https://render.com/docs)
- **GitHub Issues**: Repository issues for application problems
- **Render Support**: For infrastructure issues

## Cost Optimization

### Resource Planning

**Development**: Free tier resources sufficient (web service, database, Redis, worker)

**Production**: Basic/Starter tier for cost optimization (~$22/month total)

### Scaling

Services auto-scale based on traffic:

- Development: 1 instance (free)
- Production: 1-2 instances (configurable)

## Next Steps

After successful deployment:

1. **Monitor Performance**: Check metrics for first 24 hours
2. **Update DNS**: Point production domain to Render
3. **Team Training**: Share access and procedures with team
4. **Backup Strategy**: Verify automated backups are working
5. **Monitoring Setup**: Configure alerts for critical metrics

## Rollback Plan

If issues arise, you can quickly rollback:

1. **Database**: Restore from backup
2. **Application**: Redeploy previous working version
3. **DNS**: Point back to previous provider if needed

The Neon database remains available as backup during transition period.

---

## Summary

This migration provides:

- ✅ **Professional Infrastructure**: Industry-standard deployment setup
- ✅ **Cost Efficiency**: Optimized 2-environment setup (~$22/month total)
- ✅ **Developer Experience**: Automated workflows and easy management
- ✅ **Security**: Proper isolation and secret management
- ✅ **Reliability**: Built-in monitoring, backups, and scaling

Your Arrakis application is now production-ready with cost-optimized environment separation and automated deployment workflows!