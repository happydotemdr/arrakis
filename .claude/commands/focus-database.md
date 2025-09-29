---
name: focus-database
description: Load database-specific context for schema design, migrations, and query optimization with Render PostgreSQL
---

# Database Focus Mode

Switch context to database development with Prisma, Render PostgreSQL 17, and data modeling.

## Context Loading

### 1. Schema Analysis
- [ ] Read complete Prisma schema from `prisma/schema.prisma`
- [ ] Identify all models and their relationships
- [ ] Review field types, constraints, and defaults
- [ ] Check indexes and unique constraints

### 2. Migration History
- [ ] Review migration files in `prisma/migrations/`
- [ ] Identify recent schema changes
- [ ] Check for pending migrations
- [ ] Note any migration issues or rollbacks

### 3. Render PostgreSQL Configuration
- [ ] Review Render PostgreSQL 17 configuration
- [ ] Check database connection string setup
- [ ] Verify connection pooling settings
- [ ] Note PostgreSQL-specific features in use

### 4. Query Patterns
- [ ] Identify common query patterns in codebase
- [ ] Review Prisma client usage
- [ ] Check for N+1 query problems
- [ ] Note complex queries that might need optimization

### 5. Data Relationships
- [ ] Map entity relationships (one-to-one, one-to-many, many-to-many)
- [ ] Identify foreign key constraints
- [ ] Review cascade behaviors
- [ ] Check referential integrity

### 6. Invoke Database Expert
- [ ] Launch `database-expert` agent for specialized guidance
- [ ] Get PostgreSQL 17 best practices
- [ ] Review schema design patterns
- [ ] Optimize query performance

## Ready for Database Work

With context loaded, you're ready for:
- ✅ Schema design and modeling
- ✅ Creating migrations
- ✅ Query optimization
- ✅ Index management
- ✅ Data relationships
- ✅ Performance tuning
- ✅ PostgreSQL 17 features
- ✅ Database debugging

## Common Database Tasks

**Schema Design**
- Design new models
- Define relationships
- Add constraints and validations
- Plan data types

**Migrations**
- Create schema changes
- Test migrations locally first
- Apply to production Render PostgreSQL
- Handle data transformations
- Roll back if needed

**Query Optimization**
- Analyze slow queries with EXPLAIN
- Add strategic indexes
- Reduce N+1 queries
- Implement query batching

**PostgreSQL Features**
- Use PostgreSQL 17-specific features
- Optimize connection pooling
- Monitor database performance
- Leverage advanced data types (JSON, arrays)

**Data Integrity**
- Add foreign key constraints
- Define unique constraints
- Set up cascade rules
- Validate data consistency

## Specialized Tools

**Render MCP Commands**
```bash
# Query Render PostgreSQL
mcp__render__query_render_postgres

# Get database instance details
mcp__render__get_postgres

# List PostgreSQL instances
mcp__render__list_postgres_instances
```

**Prisma Commands**
```bash
# Generate Prisma Client
npx prisma generate

# Create migration (dev/local)
npx prisma migrate dev --name <migration-name>

# Apply migrations (production)
npx prisma migrate deploy

# Open Prisma Studio (local only)
npx prisma studio

# Check migration status
npx prisma migrate status
```

## Production Database Notes

- **Single environment**: Production only (no staging database)
- **Cost optimization**: Test migrations thoroughly locally
- **Backup strategy**: Ensure Render backups are configured
- **Migration safety**: Always backup before applying migrations to prod
- **PostgreSQL 17**: Take advantage of new features and performance improvements