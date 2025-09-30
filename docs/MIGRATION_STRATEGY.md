# Migration Strategy from Current State

## 🚀 MIGRATION STRATEGY FRAMEWORK

**Current State Assessment:**
- ✅ Established conversation persistence schema with proper indexing
- ✅ pgvector extension already enabled with HNSW indexes
- ✅ Robust migration infrastructure with versioning
- ⚠️ No Epic model currently exists (clean slate opportunity)
- ✅ Strong foundation for extending with roadmap capabilities

**Migration Approach:** Additive enhancement that preserves existing functionality while adding comprehensive roadmap features.

## Phase 1: Foundation Schema (Zero Downtime)

### 1.1 Core Epic Tables Creation

```sql
-- Migration: 20250930000002_add_epic_foundation.sql
-- Creates core epic tables without disrupting existing schema

BEGIN;

-- Core enums for epic management
CREATE TYPE epic_status AS ENUM (
  'PLANNED',
  'IN_PROGRESS',
  'BLOCKED',
  'REVIEW',
  'COMPLETED',
  'CANCELLED',
  'ON_HOLD'
);

CREATE TYPE priority AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
  'URGENT'
);

CREATE TYPE risk_level AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

-- Core epic table with essential fields
CREATE TABLE epics (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status epic_status DEFAULT 'PLANNED',
  priority priority DEFAULT 'MEDIUM',
  quarter VARCHAR(7), -- Format: "Q1 2025"
  outcome TEXT,
  icon VARCHAR(10), -- Emoji storage
  color CHAR(7), -- Hex format #RRGGBB

  -- CRITICAL: Decimal ordering prevents race conditions
  display_order DECIMAL(20,10) DEFAULT 1000,

  -- CRITICAL: Optimistic locking
  version INTEGER DEFAULT 1,

  -- Extended planning fields
  effort INTEGER, -- Story points or hours
  business_value INTEGER, -- 1-10 scale
  risk risk_level DEFAULT 'LOW',
  dependencies TEXT, -- Free-text dependencies
  acceptance_criteria TEXT,

  -- Timeline planning
  start_date DATE,
  target_date DATE,
  completed_date DATE,

  -- Soft delete and audit
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT, -- Future: user ID
  last_modified_by TEXT -- Future: user ID
);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_epics_updated_at
  BEFORE UPDATE ON epics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Essential indexes for immediate performance
CREATE INDEX idx_epic_display_order ON epics (display_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_epic_status_order ON epics (status, display_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_epic_priority_order ON epics (priority, display_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_epic_soft_delete ON epics (deleted_at);
CREATE INDEX idx_epic_created ON epics (created_at);
CREATE INDEX idx_epic_updated ON epics (updated_at);

COMMIT;
```

### 1.2 Prisma Schema Update

```prisma
// Add to existing schema.prisma
model Epic {
  id           String    @id @default(uuid())
  title        String    @db.VarChar(200)
  description  String?   @db.Text
  status       EpicStatus @default(PLANNED)
  priority     Priority  @default(MEDIUM)
  quarter      String?   @db.VarChar(7)
  outcome      String?   @db.Text
  icon         String?   @db.VarChar(10)
  color        String?   @db.Char(7)

  displayOrder Decimal   @default(1000) @map("display_order") @db.Decimal(20, 10)
  version      Int       @default(1)

  effort           Int?
  businessValue    Int?      @map("business_value")
  risk             RiskLevel @default(LOW)
  dependencies     String?   @db.Text
  acceptanceCriteria String? @map("acceptance_criteria") @db.Text

  startDate     DateTime? @map("start_date") @db.Date
  targetDate    DateTime? @map("target_date") @db.Date
  completedDate DateTime? @map("completed_date") @db.Date

  deletedAt        DateTime? @map("deleted_at") @db.Timestamptz
  createdAt        DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt        DateTime  @updatedAt @map("updated_at") @db.Timestamptz
  createdBy        String?   @map("created_by")
  lastModifiedBy   String?   @map("last_modified_by")

  @@index([displayOrder], map: "idx_epic_display_order")
  @@index([status, displayOrder], map: "idx_epic_status_order")
  @@index([priority, displayOrder], map: "idx_epic_priority_order")
  @@index([deletedAt], map: "idx_epic_soft_delete")
  @@index([createdAt], map: "idx_epic_created")
  @@index([updatedAt], map: "idx_epic_updated")

  @@map("epics")
}

enum EpicStatus {
  PLANNED
  IN_PROGRESS
  BLOCKED
  REVIEW
  COMPLETED
  CANCELLED
  ON_HOLD
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
  URGENT
}

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}
```

## Phase 2: Project Organization (Week 2)

### 2.1 Project Hierarchy Addition

```sql
-- Migration: 20250930000003_add_project_system.sql

BEGIN;

CREATE TYPE project_status AS ENUM (
  'ACTIVE',
  'ARCHIVED',
  'COMPLETED',
  'ON_HOLD'
);

-- Project organization table
CREATE TABLE projects (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(100) NOT NULL,
  key VARCHAR(10) UNIQUE NOT NULL, -- Short identifier like "WEB"
  description TEXT,
  color CHAR(7), -- Hex format
  status project_status DEFAULT 'ACTIVE',

  -- Project hierarchy
  parent_project_id TEXT REFERENCES projects(id),
  display_order DECIMAL(20,10) DEFAULT 1000,

  -- Timeline
  start_date DATE,
  end_date DATE,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Add project relationship to epics
ALTER TABLE epics ADD COLUMN project_id TEXT REFERENCES projects(id);

-- Indexes for project system
CREATE INDEX idx_project_key ON projects (key);
CREATE INDEX idx_project_status_order ON projects (status, display_order);
CREATE INDEX idx_project_parent ON projects (parent_project_id);
CREATE INDEX idx_project_soft_delete ON projects (deleted_at);
CREATE INDEX idx_epic_project_order ON epics (project_id, display_order) WHERE deleted_at IS NULL;

-- Update trigger for projects
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;
```

## Phase 3: Label and Metadata System (Week 3)

### 3.1 Flexible Labeling Infrastructure

```sql
-- Migration: 20250930000004_add_labeling_system.sql

BEGIN;

CREATE TYPE label_category AS ENUM (
  'GENERAL',
  'TECHNOLOGY',
  'TEAM',
  'PRIORITY',
  'RISK',
  'MILESTONE',
  'FEATURE_TYPE'
);

-- Labels table
CREATE TABLE labels (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(50) UNIQUE NOT NULL,
  color CHAR(7) NOT NULL,
  description VARCHAR(200),
  category label_category DEFAULT 'GENERAL',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Epic-Label many-to-many relationship
CREATE TABLE epic_labels (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  epic_id TEXT NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by TEXT, -- Future: user ID

  UNIQUE(epic_id, label_id)
);

-- Metadata column for epics (JSON storage)
ALTER TABLE epics ADD COLUMN metadata JSONB;

-- Indexes for label system
CREATE INDEX idx_label_category ON labels (category);
CREATE INDEX idx_label_name ON labels (name);
CREATE INDEX idx_epic_label_epic ON epic_labels (epic_id);
CREATE INDEX idx_epic_label_label ON epic_labels (label_id);
CREATE INDEX idx_epic_label_lookup ON epic_labels (label_id, epic_id);
CREATE INDEX idx_epic_metadata_gin ON epics USING gin (metadata) WHERE deleted_at IS NULL;

-- Update triggers
CREATE TRIGGER update_labels_updated_at
  BEFORE UPDATE ON labels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;
```

### 3.2 Seed Essential Labels

```sql
-- Migration: 20250930000005_seed_default_labels.sql

BEGIN;

-- Insert default labels for immediate use
INSERT INTO labels (id, name, color, description, category) VALUES
-- Technology labels
(gen_random_uuid()::text, 'frontend', '#3B82F6', 'Frontend development work', 'TECHNOLOGY'),
(gen_random_uuid()::text, 'backend', '#10B981', 'Backend development work', 'TECHNOLOGY'),
(gen_random_uuid()::text, 'database', '#8B5CF6', 'Database related work', 'TECHNOLOGY'),
(gen_random_uuid()::text, 'infrastructure', '#F59E0B', 'Infrastructure and DevOps', 'TECHNOLOGY'),

-- Team labels
(gen_random_uuid()::text, 'engineering', '#06B6D4', 'Engineering team work', 'TEAM'),
(gen_random_uuid()::text, 'design', '#EC4899', 'Design team work', 'TEAM'),
(gen_random_uuid()::text, 'product', '#84CC16', 'Product team work', 'TEAM'),

-- Feature type labels
(gen_random_uuid()::text, 'feature', '#6366F1', 'New feature development', 'FEATURE_TYPE'),
(gen_random_uuid()::text, 'improvement', '#14B8A6', 'Enhancement to existing feature', 'FEATURE_TYPE'),
(gen_random_uuid()::text, 'bug-fix', '#EF4444', 'Bug fix or maintenance', 'FEATURE_TYPE'),
(gen_random_uuid()::text, 'research', '#9333EA', 'Research and investigation', 'FEATURE_TYPE'),

-- Risk labels
(gen_random_uuid()::text, 'technical-debt', '#F97316', 'Technical debt related', 'RISK'),
(gen_random_uuid()::text, 'security', '#DC2626', 'Security related work', 'RISK'),
(gen_random_uuid()::text, 'performance', '#7C3AED', 'Performance optimization', 'RISK'),

-- Milestone labels
(gen_random_uuid()::text, 'mvp', '#F59E0B', 'Minimum viable product', 'MILESTONE'),
(gen_random_uuid()::text, 'beta', '#8B5CF6', 'Beta release', 'MILESTONE'),
(gen_random_uuid()::text, 'launch', '#10B981', 'Production launch', 'MILESTONE');

COMMIT;
```

## Phase 4: Advanced Features (Week 4)

### 4.1 Epic Hierarchy and Dependencies

```sql
-- Migration: 20250930000006_add_epic_relationships.sql

BEGIN;

-- Add parent-child relationships to epics
ALTER TABLE epics ADD COLUMN parent_epic_id TEXT REFERENCES epics(id);

-- Epic attachments
CREATE TABLE epic_attachments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  epic_id TEXT NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size INTEGER NOT NULL,
  url VARCHAR(500),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by TEXT
);

-- Epic comments
CREATE TABLE epic_comments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  epic_id TEXT NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

-- Epic history for audit trail
CREATE TYPE change_type AS ENUM (
  'CREATED',
  'UPDATED',
  'DELETED',
  'RESTORED',
  'STATUS_CHANGED',
  'REORDERED'
);

CREATE TABLE epic_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  epic_id TEXT NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  field VARCHAR(50) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_type change_type NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by TEXT
);

-- Indexes for new relationships
CREATE INDEX idx_epic_parent ON epics (parent_epic_id);
CREATE INDEX idx_epic_attachment_epic ON epic_attachments (epic_id);
CREATE INDEX idx_epic_attachment_date ON epic_attachments (uploaded_at);
CREATE INDEX idx_epic_comment_epic_date ON epic_comments (epic_id, created_at);
CREATE INDEX idx_epic_history_epic_date ON epic_history (epic_id, changed_at);
CREATE INDEX idx_epic_history_field ON epic_history (field);
CREATE INDEX idx_epic_history_type ON epic_history (change_type);

-- Update triggers
CREATE TRIGGER update_epic_comments_updated_at
  BEFORE UPDATE ON epic_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;
```

### 4.2 Vector Search Integration

```sql
-- Migration: 20250930000007_add_vector_search.sql

BEGIN;

-- Add vector embedding column to epics
ALTER TABLE epics ADD COLUMN content_embedding vector(1536);

-- Create HNSW index for semantic search (reuse existing pgvector setup)
CREATE INDEX idx_epic_content_vector_hnsw
ON epics USING hnsw (content_embedding vector_cosine_ops)
WHERE content_embedding IS NOT NULL AND deleted_at IS NULL;

-- Function to update epic embeddings (integrate with existing embedding infrastructure)
CREATE OR REPLACE FUNCTION update_epic_embedding()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark for embedding update (actual embedding done by application)
  NEW.content_embedding = NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to mark epics for re-embedding when content changes
CREATE TRIGGER epic_embedding_update
AFTER UPDATE OF title, description, outcome, acceptance_criteria ON epics
FOR EACH ROW
EXECUTE FUNCTION update_epic_embedding();

COMMIT;
```

## Phase 5: Performance Optimization (Week 5)

### 5.1 Advanced Indexing and Materialized Views

```sql
-- Migration: 20250930000008_performance_optimization.sql

BEGIN;

-- Advanced composite indexes
CREATE INDEX CONCURRENTLY idx_epic_complex_filter
ON epics (status, priority, project_id, display_order)
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY idx_epic_timeline_active
ON epics (target_date, start_date, status)
WHERE deleted_at IS NULL AND status != 'COMPLETED';

CREATE INDEX CONCURRENTLY idx_epic_value_risk_effort
ON epics (business_value DESC, risk ASC, effort ASC)
WHERE deleted_at IS NULL;

-- Label performance indexes
CREATE INDEX CONCURRENTLY idx_epic_label_performance
ON epic_labels (label_id, epic_id)
INCLUDE (added_at);

-- Materialized view for dashboard statistics
CREATE MATERIALIZED VIEW epic_dashboard_stats AS
SELECT
  COUNT(*) as total_epics,
  COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_epics,
  COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as in_progress_epics,
  COUNT(*) FILTER (WHERE status = 'PLANNED') as planned_epics,
  COUNT(*) FILTER (WHERE target_date < CURRENT_DATE AND status NOT IN ('COMPLETED', 'CANCELLED')) as overdue_epics,
  AVG(business_value) FILTER (WHERE business_value IS NOT NULL) as avg_business_value,
  AVG(effort) FILTER (WHERE effort IS NOT NULL) as avg_effort,
  COUNT(DISTINCT project_id) as active_projects,
  MAX(updated_at) as last_updated
FROM epics
WHERE deleted_at IS NULL;

-- Index on materialized view
CREATE UNIQUE INDEX idx_epic_dashboard_stats_last_updated
ON epic_dashboard_stats (last_updated);

-- Function to refresh stats
CREATE OR REPLACE FUNCTION refresh_epic_dashboard_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY epic_dashboard_stats;
END;
$$ LANGUAGE plpgsql;

COMMIT;
```

## Safe Migration Execution Strategy

### 1. Pre-Migration Checklist

```bash
#!/bin/bash
# pre_migration_check.sh

echo "=== Pre-Migration Safety Check ==="

# 1. Backup current database
echo "Creating backup..."
pg_dump $DATABASE_URL > "backup_$(date +%Y%m%d_%H%M%S).sql"

# 2. Check current schema state
echo "Checking current schema..."
psql $DATABASE_URL -c "\dt+ public.*"

# 3. Verify existing indexes
echo "Verifying existing indexes..."
psql $DATABASE_URL -c "
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;"

# 4. Check for blocking queries
echo "Checking for long-running queries..."
psql $DATABASE_URL -c "
SELECT pid, usename, application_name, state,
       now() - query_start AS runtime, query
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - query_start > interval '30 seconds';"

# 5. Verify connection limits
echo "Checking connection usage..."
psql $DATABASE_URL -c "
SELECT count(*) as active_connections,
       setting as max_connections
FROM pg_stat_activity, pg_settings
WHERE name = 'max_connections'
GROUP BY setting;"

echo "Pre-migration check complete. Review output before proceeding."
```

### 2. Migration Execution with Rollback

```typescript
// migration_executor.ts
import { PrismaClient } from '@prisma/client'

class SafeMigrationExecutor {
  private db: PrismaClient

  async executeMigrationWithRollback(migrationSql: string, rollbackSql: string) {
    const startTime = Date.now()

    try {
      console.log('Starting migration...')

      // Execute in transaction for safety
      await this.db.$transaction(async (tx) => {
        // Apply migration
        await tx.$executeRawUnsafe(migrationSql)

        // Verify migration success
        await this.verifyMigration(tx)

        console.log(`Migration completed in ${Date.now() - startTime}ms`)
      })

    } catch (error) {
      console.error('Migration failed, executing rollback...', error)

      try {
        await this.db.$executeRawUnsafe(rollbackSql)
        console.log('Rollback completed successfully')
      } catch (rollbackError) {
        console.error('CRITICAL: Rollback failed!', rollbackError)
        throw new Error('Migration and rollback both failed - manual intervention required')
      }

      throw error
    }
  }

  private async verifyMigration(tx: any) {
    // Verify tables exist
    const tableCheck = await tx.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('epics', 'projects', 'labels', 'epic_labels')
    `

    if (tableCheck.length < 4) {
      throw new Error('Migration verification failed: Missing expected tables')
    }

    // Verify indexes exist
    const indexCheck = await tx.$queryRaw`
      SELECT COUNT(*) as index_count
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'epics'
        AND indexname LIKE 'idx_%'
    `

    if (indexCheck[0].index_count < 5) {
      throw new Error('Migration verification failed: Missing expected indexes')
    }
  }
}
```

### 3. Rollback Procedures

```sql
-- Phase 1 Rollback: Remove epic foundation
-- rollback_20250930000002_add_epic_foundation.sql
BEGIN;
DROP TABLE IF EXISTS epics CASCADE;
DROP TYPE IF EXISTS epic_status CASCADE;
DROP TYPE IF EXISTS priority CASCADE;
DROP TYPE IF EXISTS risk_level CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
COMMIT;

-- Phase 2 Rollback: Remove project system
-- rollback_20250930000003_add_project_system.sql
BEGIN;
ALTER TABLE epics DROP COLUMN IF EXISTS project_id;
DROP TABLE IF EXISTS projects CASCADE;
DROP TYPE IF EXISTS project_status CASCADE;
COMMIT;

-- Phase 3 Rollback: Remove labeling system
-- rollback_20250930000004_add_labeling_system.sql
BEGIN;
DROP TABLE IF EXISTS epic_labels CASCADE;
DROP TABLE IF EXISTS labels CASCADE;
ALTER TABLE epics DROP COLUMN IF EXISTS metadata;
DROP TYPE IF EXISTS label_category CASCADE;
COMMIT;
```

### 4. Post-Migration Validation

```sql
-- post_migration_validation.sql
-- Comprehensive validation suite

-- 1. Schema validation
\echo 'Validating schema structure...'
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('epics', 'projects', 'labels', 'epic_labels')
ORDER BY table_name, ordinal_position;

-- 2. Index validation
\echo 'Validating indexes...'
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('epics', 'projects', 'labels', 'epic_labels')
ORDER BY tablename, indexname;

-- 3. Performance validation
\echo 'Testing query performance...'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, status, display_order
FROM epics
WHERE deleted_at IS NULL
ORDER BY display_order
LIMIT 10;

-- 4. Constraint validation
\echo 'Validating constraints...'
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('epics', 'projects', 'labels', 'epic_labels')
ORDER BY tc.table_name, tc.constraint_type;

\echo 'Post-migration validation complete.'
```

This migration strategy provides:
- **Zero-downtime deployment** with careful phasing
- **Comprehensive rollback procedures** for each phase
- **Performance validation** at each step
- **Safety checks** before and after migration
- **Incremental feature rollout** to minimize risk