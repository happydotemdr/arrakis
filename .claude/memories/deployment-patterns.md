# Deployment Patterns & Infrastructure

**Last Updated**: 2025-09-29

## Render Infrastructure

### Workspace Details

- **Workspace ID**: `tea-d303qfodl3ps739p3e60`
- **Platform**: Render.com
- **Region**: Oregon (us-west)

### Database Configuration

**Service**: `arrakis-prod-db`

- **Type**: PostgreSQL 17
- **Plan**: basic-256mb ($7/month)
- **Database Name**: `arrakis_production_bq3v`
- **User**: `arrakis_prod_user`
- **SSL**: Required
- **Extensions**: pgvector (for vector embeddings)
- **IP Allowlist**: 0.0.0.0/0 (production access)

**Connection String Format**:

```
postgresql://arrakis_prod_user:password@host:port/arrakis_production_bq3v?sslmode=require
```

### Web Service Configuration

**Service**: `arrakis-prod`

- **Type**: Web Service
- **Runtime**: Node.js
- **Plan**: starter ($5/month)
- **Region**: Oregon
- **Repository**: https://github.com/happydotemdr/arrakis.git
- **Branch**: master
- **Auto-deploy**: ❌ Disabled (manual deployments for safety)

**Build Configuration**:

```yaml
buildCommand: "npm install && npm run build"
startCommand: "npm start"
healthCheckPath: /
```

## Deployment Workflow

### Pre-Deployment Checklist

```bash
# 1. Run all quality checks
npm run check          # Type-check + lint

# 2. Test production build locally
npm run build
npm start

# 3. Verify database migrations
npm run db:generate
npm run db:push        # or db:deploy for production
```

### Manual Deployment Steps

1. **Commit changes**:

   ```bash
   git add .
   git commit -m "feat: your feature description"
   ```

2. **Push to GitHub**:

   ```bash
   git push origin master
   ```

3. **Trigger deployment on Render**:
   - Go to Render Dashboard
   - Navigate to `arrakis-prod` service
   - Click "Manual Deploy" → "Deploy latest commit"
   - Monitor build logs

4. **Post-deployment verification**:
   - Check health endpoint: `https://arrakis-prod.onrender.com/`
   - Verify database connectivity
   - Test critical features
   - Monitor error logs

## Environment Variables

### Development (.env.local)

```env
DATABASE_URL="postgresql://arrakis_prod_user:...@dpg-...oregon-postgres.render.com:5432/arrakis_production_bq3v?sslmode=require"
DIRECT_URL="postgresql://arrakis_prod_user:...@dpg-...oregon-postgres.render.com:5432/arrakis_production_bq3v?sslmode=require"
NODE_ENV="development"
PORT="3000"
NEXTAUTH_SECRET="development-secret-change-in-production"
NEXTAUTH_URL="http://localhost:3000"
OPENAI_API_KEY="sk-..."
```

### Production (Render Dashboard)

**Environment variables are configured in Render:**

- `DATABASE_URL` → Auto-linked from database
- `DIRECT_URL` → Auto-linked from database
- `NODE_ENV` → "production"
- `NEXTAUTH_SECRET` → Generated value
- `NEXTAUTH_URL` → "https://arrakis-prod.onrender.com"
- `OPENAI_API_KEY` → Manually configured

## Infrastructure as Code

### render.yaml Configuration

```yaml
databases:
  - name: arrakis-prod-db
    plan: basic-256mb
    postgresMajorVersion: "17"
    databaseName: arrakis_production
    user: arrakis_prod_user
    ipAllowList:
      - source: 0.0.0.0/0
        description: "Production access"

services:
  - type: web
    name: arrakis-prod
    runtime: node
    plan: starter
    region: oregon
    repo: https://github.com/happydotemdr/arrakis.git
    branch: master
    autoDeploy: false
    buildCommand: "npm install && npm run build"
    startCommand: "npm start"
    healthCheckPath: /
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: arrakis-prod-db
          property: connectionString
      - key: DIRECT_URL
        fromDatabase:
          name: arrakis-prod-db
          property: connectionString
      - key: NODE_ENV
        value: production
      - key: NEXTAUTH_SECRET
        generateValue: true
      - key: NEXTAUTH_URL
        value: https://arrakis-prod.onrender.com
```

## Database Management

### Running Migrations

**Development**:

```bash
# Generate migration files
npm run db:migrate

# Push schema directly (no migration files)
npm run db:push
```

**Production**:

```bash
# Deploy migrations (use in CI/CD or before deployment)
npm run db:deploy
```

### Database Access

**Via Prisma Studio**:

```bash
npm run db:studio
```

**Via Render Dashboard**:

- Navigate to `arrakis-prod-db`
- Click "Connect" → Copy connection string
- Use with your preferred PostgreSQL client (psql, TablePlus, etc.)

## Common Deployment Issues

### Issue: Build Fails with Type Errors

**Solution**:

```bash
npm run type-check  # Find type errors locally
npm run db:generate # Regenerate Prisma client
```

### Issue: Database Connection Fails

**Check**:

1. DATABASE_URL format is correct
2. SSL mode is set to `require`
3. IP allowlist includes your source
4. Database service is running

### Issue: Next.js Build Optimization Errors

**Solution**: Check `next.config.js` settings:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false, // Set true only if necessary
  },
  eslint: {
    ignoreDuringBuilds: false, // Set true only if necessary
  },
}
```

## Monitoring & Logs

### Accessing Logs

1. **Render Dashboard** → `arrakis-prod` → "Logs" tab
2. **Real-time streaming** available
3. **Search/filter** by time range or keyword

### Key Metrics to Monitor

- **Response time**: Should be < 500ms for most requests
- **Error rate**: Should be < 1%
- **Database connections**: Monitor for connection pool exhaustion
- **Memory usage**: Should stay below plan limits
- **Build time**: Typically 2-3 minutes

## Cost Management

### Current Monthly Cost

- Database (basic-256mb): $7/month
- Web Service (starter): $5/month
- **Total**: $12/month

### Cost Optimization Tips

- Keep auto-deploy disabled to prevent accidental builds
- Use free preview environments sparingly
- Monitor database storage usage
- Consider upgrading only when traffic demands it

## Git Workflow

### Protected Branch Strategy

- **master**: Production-ready code only
- **Feature branches**: Use for development
- **Manual deploys**: Prevents accidental production changes

### Commit Message Format

```bash
git commit -m "feat: add new feature"
git commit -m "fix: resolve bug in API"
git commit -m "docs: update deployment guide"
git commit -m "refactor: simplify database queries"
```

## Rollback Strategy

### Quick Rollback

1. Go to Render Dashboard
2. Navigate to `arrakis-prod` → "Deploys"
3. Find previous successful deploy
4. Click "Redeploy"

### Database Rollback

```bash
# If migration fails, rollback with:
npx prisma migrate resolve --rolled-back <migration-name>
```

## Security Best Practices

- ✅ SSL enabled on database
- ✅ Environment variables not in source code
- ✅ Auto-deploy disabled (manual review required)
- ✅ Secrets stored in Render dashboard
- ⚠️ No authentication yet (planned for future)
- ⚠️ Database exposed to 0.0.0.0/0 (consider restricting)

## Next Steps & Improvements

1. **CI/CD Pipeline**: Consider GitHub Actions for automated testing
2. **Database Backups**: Configure automated backups on Render
3. **Monitoring**: Add error tracking (Sentry, LogRocket)
4. **Performance**: Add Redis caching when needed
5. **Security**: Implement authentication (NextAuth.js or Clerk)