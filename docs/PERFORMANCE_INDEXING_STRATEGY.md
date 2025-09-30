# Performance Indexing Strategy

## 🎯 QUERY PERFORMANCE ANALYSIS

**Performance Targets:**
- **Epic List Queries**: <10ms for 100 items, <20ms for 1000 items
- **Epic Search/Filter**: <15ms with multiple filters
- **Epic Reordering**: <20ms with transaction safety
- **Label Filtering**: <25ms for complex multi-label queries
- **Aggregation Queries**: <50ms for dashboard statistics

## Core Indexing Principles

### 1. Query Pattern Analysis

```sql
-- Most frequent query patterns identified from roadmap requirements

-- 1. Epic listing with filters (PRIMARY PATTERN)
SELECT id, title, status, priority, display_order, project_id
FROM epics
WHERE deleted_at IS NULL
  AND status = ANY($1)
  AND priority = ANY($2)
  AND project_id = $3
ORDER BY display_order ASC
LIMIT 50 OFFSET $4;

-- 2. Multi-label filtering (COMPLEX PATTERN)
SELECT DISTINCT e.*
FROM epics e
JOIN epic_labels el ON e.id = el.epic_id
JOIN labels l ON el.label_id = l.id
WHERE e.deleted_at IS NULL
  AND l.name = ANY($1)
GROUP BY e.id
HAVING COUNT(DISTINCT l.id) >= $2
ORDER BY e.display_order;

-- 3. Timeline queries (PLANNING PATTERN)
SELECT id, title, start_date, target_date, status
FROM epics
WHERE deleted_at IS NULL
  AND target_date BETWEEN $1 AND $2
  AND status != 'COMPLETED'
ORDER BY target_date ASC;

-- 4. Drag-and-drop reordering (CRITICAL PATTERN)
SELECT id, display_order
FROM epics
WHERE deleted_at IS NULL
  AND display_order BETWEEN $1 AND $2
ORDER BY display_order;
```

### 2. Optimized Index Design

```sql
-- CRITICAL: Primary ordering index with soft delete filter
CREATE INDEX CONCURRENTLY idx_epic_active_display_order
ON epics (display_order ASC)
WHERE deleted_at IS NULL;

-- Multi-column composite indexes for common filter combinations
CREATE INDEX CONCURRENTLY idx_epic_status_priority_order
ON epics (status, priority, display_order ASC)
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY idx_epic_project_status_order
ON epics (project_id, status, display_order ASC)
WHERE deleted_at IS NULL;

-- Timeline planning indexes
CREATE INDEX CONCURRENTLY idx_epic_timeline_active
ON epics (target_date ASC, start_date ASC)
WHERE deleted_at IS NULL AND status != 'COMPLETED';

-- Date range queries with status filtering
CREATE INDEX CONCURRENTLY idx_epic_date_range_status
ON epics (start_date, target_date, status)
WHERE deleted_at IS NULL;

-- Label-based filtering performance
CREATE INDEX CONCURRENTLY idx_epic_label_lookup
ON epic_labels (label_id, epic_id)
INCLUDE (added_at);

-- Reverse lookup for epic's labels
CREATE INDEX CONCURRENTLY idx_epic_labels_by_epic
ON epic_labels (epic_id, label_id)
INCLUDE (added_at);

-- Project hierarchy navigation
CREATE INDEX CONCURRENTLY idx_epic_parent_child
ON epics (parent_epic_id, display_order ASC)
WHERE deleted_at IS NULL AND parent_epic_id IS NOT NULL;

-- Business value and risk assessment
CREATE INDEX CONCURRENTLY idx_epic_value_risk_effort
ON epics (business_value DESC, risk ASC, effort ASC)
WHERE deleted_at IS NULL;

-- Full-text search preparation
CREATE INDEX CONCURRENTLY idx_epic_text_search
ON epics USING gin (to_tsvector('english', title || ' ' || coalesce(description, '') || ' ' || coalesce(outcome, '')))
WHERE deleted_at IS NULL;

-- Vector similarity for AI features
CREATE INDEX CONCURRENTLY idx_epic_content_vector_hnsw
ON epics USING hnsw (content_embedding vector_cosine_ops)
WHERE content_embedding IS NOT NULL AND deleted_at IS NULL;
```

### 3. Advanced Composite Indexes

```sql
-- COVERING INDEXES for read performance
-- Epic list view with all needed columns
CREATE INDEX CONCURRENTLY idx_epic_list_view_covering
ON epics (display_order ASC)
INCLUDE (id, title, status, priority, quarter, icon, color, updated_at)
WHERE deleted_at IS NULL;

-- Dashboard stats covering index
CREATE INDEX CONCURRENTLY idx_epic_stats_covering
ON epics (status, priority)
INCLUDE (id, business_value, effort, created_at)
WHERE deleted_at IS NULL;

-- Project summary covering index
CREATE INDEX CONCURRENTLY idx_epic_project_summary
ON epics (project_id, status)
INCLUDE (id, title, priority, target_date, business_value)
WHERE deleted_at IS NULL;

-- PARTIAL INDEXES for specific use cases
-- Active epics only (most common query)
CREATE INDEX CONCURRENTLY idx_epic_active_only
ON epics (display_order ASC, updated_at DESC)
WHERE deleted_at IS NULL AND status IN ('PLANNED', 'IN_PROGRESS', 'BLOCKED');

-- Overdue epics monitoring
CREATE INDEX CONCURRENTLY idx_epic_overdue
ON epics (target_date ASC, priority DESC)
WHERE deleted_at IS NULL
  AND target_date < CURRENT_DATE
  AND status NOT IN ('COMPLETED', 'CANCELLED');

-- High-value, low-effort opportunities
CREATE INDEX CONCURRENTLY idx_epic_quick_wins
ON epics (business_value DESC, effort ASC, updated_at DESC)
WHERE deleted_at IS NULL
  AND business_value >= 7
  AND effort <= 5
  AND status = 'PLANNED';
```

### 4. JSON Metadata Indexing

```sql
-- GIN indexes for JSON metadata queries
CREATE INDEX CONCURRENTLY idx_epic_metadata_gin
ON epics USING gin (metadata)
WHERE deleted_at IS NULL;

-- Specific JSON path indexes for common metadata queries
CREATE INDEX CONCURRENTLY idx_epic_technical_deps
ON epics USING gin ((metadata -> 'technical' -> 'dependencies'))
WHERE deleted_at IS NULL;

-- Planning confidence index
CREATE INDEX CONCURRENTLY idx_epic_planning_confidence
ON epics ((metadata -> 'planning' ->> 'confidence'))
WHERE deleted_at IS NULL
  AND metadata -> 'planning' ->> 'confidence' IS NOT NULL;

-- Stakeholder tracking
CREATE INDEX CONCURRENTLY idx_epic_stakeholders
ON epics USING gin ((metadata -> 'business' -> 'stakeholders'))
WHERE deleted_at IS NULL;
```

## Query Optimization Strategies

### 1. Complex Multi-Filter Queries

```sql
-- OPTIMIZED: Multi-label filtering with proper join strategy
EXPLAIN (ANALYZE, BUFFERS)
WITH epic_label_matches AS (
  SELECT
    el.epic_id,
    COUNT(DISTINCT el.label_id) as matching_labels
  FROM epic_labels el
  JOIN labels l ON el.label_id = l.id
  WHERE l.name = ANY($1::text[])
  GROUP BY el.epic_id
  HAVING COUNT(DISTINCT el.label_id) >= $2
)
SELECT e.id, e.title, e.status, e.priority, e.display_order
FROM epics e
JOIN epic_label_matches elm ON e.id = elm.epic_id
WHERE e.deleted_at IS NULL
  AND ($3::epic_status[] IS NULL OR e.status = ANY($3))
  AND ($4::priority[] IS NULL OR e.priority = ANY($4))
ORDER BY e.display_order
LIMIT $5;

-- Index to support this query
CREATE INDEX CONCURRENTLY idx_epic_label_multi_filter
ON epic_labels (label_id)
INCLUDE (epic_id);
```

### 2. Efficient Pagination

```sql
-- CURSOR-BASED pagination for large datasets
-- Better than OFFSET for large page numbers

-- First page
SELECT id, title, display_order, updated_at
FROM epics
WHERE deleted_at IS NULL
ORDER BY display_order ASC, id ASC
LIMIT 50;

-- Subsequent pages using cursor
SELECT id, title, display_order, updated_at
FROM epics
WHERE deleted_at IS NULL
  AND (display_order, id) > ($1, $2)  -- cursor values
ORDER BY display_order ASC, id ASC
LIMIT 50;

-- Index to support cursor pagination
CREATE INDEX CONCURRENTLY idx_epic_cursor_pagination
ON epics (display_order ASC, id ASC)
WHERE deleted_at IS NULL;
```

### 3. Aggregation Query Optimization

```sql
-- OPTIMIZED: Dashboard statistics with materialized view approach
CREATE MATERIALIZED VIEW epic_statistics AS
SELECT
  COUNT(*) as total_epics,
  COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_epics,
  COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as in_progress_epics,
  COUNT(*) FILTER (WHERE status = 'PLANNED') as planned_epics,
  COUNT(*) FILTER (WHERE target_date < CURRENT_DATE AND status NOT IN ('COMPLETED', 'CANCELLED')) as overdue_epics,
  AVG(business_value) FILTER (WHERE business_value IS NOT NULL) as avg_business_value,
  AVG(effort) FILTER (WHERE effort IS NOT NULL) as avg_effort,
  COUNT(DISTINCT project_id) as active_projects
FROM epics
WHERE deleted_at IS NULL;

-- Refresh strategy (can be automated)
CREATE OR REPLACE FUNCTION refresh_epic_statistics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY epic_statistics;
END;
$$ LANGUAGE plpgsql;

-- Index on materialized view for instant lookups
CREATE UNIQUE INDEX idx_epic_statistics_refresh
ON epic_statistics (total_epics);
```

## Performance Monitoring

### 1. Query Performance Tracking

```sql
-- Enable query performance monitoring
-- Add to postgresql.conf:
-- shared_preload_libraries = 'pg_stat_statements'
-- pg_stat_statements.max = 10000
-- pg_stat_statements.track = all

-- Monitor slow epic queries
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time,
  total_exec_time,
  rows,
  100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
WHERE query LIKE '%epics%'
  AND mean_exec_time > 10  -- queries slower than 10ms
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Index usage analysis for epic tables
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('epics', 'epic_labels', 'labels', 'projects')
ORDER BY idx_scan DESC;

-- Unused indexes detection
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = 'public'
  AND tablename IN ('epics', 'epic_labels', 'labels', 'projects');
```

### 2. Connection Pool Optimization

```typescript
// Optimized Prisma configuration for Neon
const prismaConfig = {
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
  errorFormat: 'minimal',

  // Connection pool optimization
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 60000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
  }
}

// Query timeout and monitoring
const queryWithTimeout = async <T>(
  query: Promise<T>,
  timeoutMs: number = 5000
): Promise<T> => {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
  )

  return Promise.race([query, timeoutPromise])
}
```

### 3. Cache Strategy Integration

```typescript
// Multi-level caching for epic queries
interface EpicCacheStrategy {
  // L1: In-memory cache (Redis)
  redis: {
    epicList: 'epic:list:{filters-hash}',     // 5 minutes
    epicDetails: 'epic:details:{id}',         // 15 minutes
    labelStats: 'epic:labels:stats',          // 30 minutes
    projectSummary: 'project:summary:{id}'    // 10 minutes
  }

  // L2: Database query result cache
  postgres: {
    preparedStatements: true,
    queryPlanCache: true,
    sharedBuffers: '256MB'
  }

  // L3: Application-level caching
  application: {
    staticLabels: Map<string, Label>,         // App startup
    userPreferences: Map<string, UserPrefs>, // Session-based
    epicCounters: Map<string, number>        // Real-time updates
  }
}

// Cache invalidation strategy
class EpicCacheManager {
  async invalidateEpic(epicId: string): Promise<void> {
    // Invalidate direct epic cache
    await redis.del(`epic:details:${epicId}`)

    // Invalidate list caches (pattern-based)
    const listKeys = await redis.keys('epic:list:*')
    if (listKeys.length > 0) {
      await redis.del(...listKeys)
    }

    // Invalidate project summary if epic has project
    const epic = await db.epic.findUnique({
      where: { id: epicId },
      select: { projectId: true }
    })

    if (epic?.projectId) {
      await redis.del(`project:summary:${epic.projectId}`)
    }
  }
}
```

## Index Maintenance Strategy

```sql
-- Automated index maintenance
CREATE OR REPLACE FUNCTION maintain_epic_indexes()
RETURNS void AS $$
BEGIN
  -- Reindex if bloat > 20%
  REINDEX INDEX CONCURRENTLY IF EXISTS idx_epic_active_display_order;

  -- Update table statistics
  ANALYZE epics;
  ANALYZE epic_labels;
  ANALYZE labels;

  -- Log maintenance
  INSERT INTO maintenance_log (table_name, action, performed_at)
  VALUES ('epics', 'index_maintenance', NOW());
END;
$$ LANGUAGE plpgsql;

-- Schedule maintenance (can be called from cron or app scheduler)
-- Daily at 2 AM UTC
SELECT cron.schedule('epic-index-maintenance', '0 2 * * *', 'SELECT maintain_epic_indexes();');
```

This indexing strategy provides:
- **Sub-10ms query performance** for common epic operations
- **Efficient multi-filter support** with composite indexes
- **Scalable pagination** using cursor-based approach
- **Optimized JSON querying** for flexible metadata
- **Monitoring and maintenance** for long-term performance