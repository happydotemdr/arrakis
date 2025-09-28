# Render Environment Groups Setup Guide

Complete step-by-step instructions for setting up environment groups in Render Dashboard.

## What I've Already Done For You

✅ **Updated `render.yaml`** with optimized environment groups:
- `arrakis-shared` - Common configuration across all environments
- `arrakis-dev` - Development-specific settings
- `arrakis-staging` - Staging-specific settings
- `arrakis-prod` - Production-specific settings

✅ **Removed Duplication** - Environment-specific variables moved to groups
✅ **Updated Documentation** - Deployment guide includes environment groups strategy

## What You Need to Do Manually

### Step 1: Create Secret Environment Groups

These groups contain sensitive API keys and cannot be pre-configured in the blueprint.

#### 1.1 Access Environment Groups

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Navigate to your team/workspace
3. Click **"Environment Groups"** in the left sidebar
4. Click **"Create Environment Group"**

#### 1.2 Create Development Secrets Group

**Group Name**: `arrakis-secrets-dev`

**Environment Variables**:
```
ANTHROPIC_API_KEY=sk-ant-api03-[your-development-claude-key]
OPENAI_API_KEY=sk-proj-[your-development-openai-key]
```

**Notes**:
- Use development/test API keys if available
- Consider using lower rate limits for dev environment
- These keys will be used by development and dev-worker services

#### 1.3 Create Production Secrets Group

**Group Name**: `arrakis-secrets-prod`

**Environment Variables**:
```
ANTHROPIC_API_KEY=sk-ant-api03-[your-production-claude-key]
OPENAI_API_KEY=sk-proj-[your-production-openai-key]
```

**Notes**:
- Use production API keys with appropriate rate limits
- These keys will be shared between staging and production environments
- Ensure these keys have sufficient quotas for production load

### Step 2: Update render.yaml to Use Secret Groups (Optional)

If you want to manage secrets through environment groups instead of per-service variables:

#### 2.1 Uncomment Secret Groups in render.yaml

Edit `C:\projects\arrakis\render.yaml` and uncomment these sections:

```yaml
envVarGroups:
  # Uncomment these lines:
  - name: arrakis-secrets-dev
    envVars:
      - key: ANTHROPIC_API_KEY
        value: # Will be set from the group created above
      - key: OPENAI_API_KEY
        value: # Will be set from the group created above

  - name: arrakis-secrets-prod
    envVars:
      - key: ANTHROPIC_API_KEY
        value: # Will be set from the group created above
      - key: OPENAI_API_KEY
        value: # Will be set from the group created above
```

#### 2.2 Update Service Configurations

For each service, add the appropriate secret group:

**Development Services** (arrakis-dev, arrakis-dev-worker):
```yaml
envVarGroups:
  - arrakis-shared
  - arrakis-dev
  - arrakis-secrets-dev  # Add this line
```

**Staging Services** (arrakis-staging, arrakis-staging-worker):
```yaml
envVarGroups:
  - arrakis-shared
  - arrakis-staging
  - arrakis-secrets-prod  # Add this line (shares prod secrets)
```

**Production Services** (arrakis-prod, arrakis-prod-worker):
```yaml
envVarGroups:
  - arrakis-shared
  - arrakis-prod
  - arrakis-secrets-prod  # Add this line
```

#### 2.3 Remove Individual Secret Variables

Remove these lines from each service configuration:
```yaml
# Remove these:
- key: ANTHROPIC_API_KEY
  sync: false
- key: OPENAI_API_KEY
  sync: false
```

### Step 3: Deploy Updated Configuration

#### 3.1 Commit and Push Changes

```bash
git add render.yaml docs/
git commit -m "feat: optimize Render environment groups with centralized secrets

- Consolidate environment variables into logical groups
- Separate development and production secret groups
- Remove duplication across service configurations
- Update deployment documentation

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin feature/phase1-foundation
```

#### 3.2 Redeploy Services

1. Go to Render Dashboard
2. For each service (arrakis-dev, arrakis-staging, arrakis-prod)
3. Click **"Manual Deploy"** → **"Deploy latest commit"**
4. Monitor deployment logs for any environment variable issues

## Benefits After Setup

### ✅ Centralized Secret Management
- Update API keys in one place
- Consistent secrets across related services
- Better audit trail for secret changes

### ✅ Reduced Configuration Drift
- Environment-specific settings clearly separated
- Shared configuration automatically synchronized
- Less chance of misconfiguration

### ✅ Easier Team Management
- Grant access to specific environment groups
- Separate development and production secret access
- Clear separation of concerns

### ✅ Simplified Deployment
- New services automatically inherit group settings
- Environment promotion becomes easier
- Reduced manual configuration during deployments

## Troubleshooting

### Environment Variables Not Found

**Issue**: Service fails to start with missing environment variables
**Solution**:
1. Check that environment groups are properly assigned to services
2. Verify secret groups contain all required variables
3. Ensure group names match exactly (case-sensitive)

### Secret Group Changes Not Applied

**Issue**: Updated secrets in group but services still use old values
**Solution**:
1. Restart affected services (not just redeploy)
2. Check service logs for environment variable loading
3. Verify service configuration references correct groups

### Cannot Find Environment Groups

**Issue**: Groups not visible in Render Dashboard
**Solution**:
1. Ensure you're in the correct team/workspace
2. Check that you have appropriate permissions
3. Contact team admin if environment groups are restricted

## Next Steps

After completing this setup:

1. **Test Each Environment**: Verify all services start successfully
2. **Monitor API Usage**: Check that correct API keys are being used
3. **Document Access**: Share group access with team members as needed
4. **Plan Secret Rotation**: Establish process for rotating API keys across groups

## Security Notes

- **Principle of Least Privilege**: Only grant access to environment groups as needed
- **Regular Rotation**: Rotate API keys periodically, especially production keys
- **Audit Access**: Review who has access to production secret groups quarterly
- **Separate Keys**: Use different API keys for dev/staging/prod when possible

Your environment groups are now optimized for scalability, security, and maintainability!