# Query Optimization Recommendations

## 💎 QUERY PERFORMANCE FRAMEWORK

**Optimization Strategy:**
- **Index-First Design**: All queries supported by purpose-built indexes
- **Cursor-Based Pagination**: Eliminate OFFSET performance degradation
- **Prepared Statement Caching**: Leverage PostgreSQL query planning
- **Materialized Views**: Pre-compute expensive aggregations
- **Connection Pool Optimization**: Minimize connection overhead

## Core Query Patterns & Optimizations

### 1. Epic List Queries (Most Critical)

```sql
-- OPTIMIZED: Primary epic listing with filters
-- Target: <10ms for 1000+ epics
PREPARE epic_list_optimized AS
SELECT
  id,
  title,
  status,
  priority,
  quarter,
  icon,
  color,
  display_order,
  updated_at,
  project_id
FROM epics
WHERE deleted_at IS NULL
  AND ($1::epic_status[] IS NULL OR status = ANY($1))
  AND ($2::priority[] IS NULL OR priority = ANY($2))
  AND ($3::text IS NULL OR project_id = $3)
  AND ($4::text IS NULL OR quarter = $4)
ORDER BY display_order ASC
LIMIT $5;

-- Supporting index (critical for performance)
CREATE INDEX CONCURRENTLY idx_epic_filtered_list
ON epics (deleted_at, status, priority, project_id, quarter, display_order)
WHERE deleted_at IS NULL;

-- Usage pattern with caching
-- Cache key: epic:list:{status_hash}:{priority_hash}:{project}:{quarter}:{limit}
```

### 2. Cursor-Based Pagination

```sql
-- OPTIMIZED: Cursor pagination for large datasets
-- Eliminates OFFSET performance degradation
PREPARE epic_list_cursor AS
SELECT
  id,
  title,
  status,
  priority,
  display_order,
  updated_at
FROM epics
WHERE deleted_at IS NULL
  AND (display_order, id) > ($1::decimal, $2::text) -- Cursor position
  AND ($3::epic_status[] IS NULL OR status = ANY($3))
ORDER BY display_order ASC, id ASC
LIMIT $4;

-- Cursor index for stable pagination
CREATE INDEX CONCURRENTLY idx_epic_cursor_stable
ON epics (display_order ASC, id ASC)
WHERE deleted_at IS NULL;

-- TypeScript implementation
interface CursorPagination {
  after?: {
    displayOrder: string
    id: string
  }
  limit: number
}

async function getEpicsCursor(pagination: CursorPagination): Promise<{
  items: Epic[]
  nextCursor?: { displayOrder: string; id: string }
  hasMore: boolean
}> {
  const { after, limit } = pagination

  const epics = await db.epic.findMany({
    where: {
      deletedAt: null,
      ...(after && {
        OR: [
          { displayOrder: { gt: after.displayOrder } },
          {
            displayOrder: after.displayOrder,
            id: { gt: after.id }
          }
        ]
      })
    },
    orderBy: [
      { displayOrder: 'asc' },
      { id: 'asc' }
    ],
    take: limit + 1 // Fetch one extra to check for more
  })

  const hasMore = epics.length > limit
  const items = hasMore ? epics.slice(0, -1) : epics
  const nextCursor = hasMore ? {
    displayOrder: epics[limit - 1].displayOrder.toString(),
    id: epics[limit - 1].id
  } : undefined

  return { items, nextCursor, hasMore }
}
```

### 3. Multi-Label Filtering

```sql
-- OPTIMIZED: Complex label filtering with proper joins
-- Target: <25ms for multi-label queries
PREPARE epic_multi_label_filter AS
WITH epic_label_matches AS (
  SELECT
    el.epic_id,
    COUNT(DISTINCT l.id) as matching_labels,
    array_agg(DISTINCT l.name ORDER BY l.name) as matched_label_names
  FROM epic_labels el
  JOIN labels l ON el.label_id = l.id
  WHERE l.name = ANY($1::text[]) -- Input label names
  GROUP BY el.epic_id
  HAVING COUNT(DISTINCT l.id) >= $2 -- Minimum matching labels
)
SELECT
  e.id,
  e.title,
  e.status,
  e.priority,
  e.display_order,
  elm.matching_labels,
  elm.matched_label_names
FROM epics e
JOIN epic_label_matches elm ON e.id = elm.epic_id
WHERE e.deleted_at IS NULL
ORDER BY e.display_order ASC
LIMIT $3;

-- Performance indexes for label filtering
CREATE INDEX CONCURRENTLY idx_epic_label_names
ON epic_labels (epic_id)
INCLUDE (label_id);

CREATE INDEX CONCURRENTLY idx_label_name_lookup
ON labels (name)
INCLUDE (id);
```

### 4. Dependency Graph Queries

```sql
-- OPTIMIZED: Epic dependency analysis with depth limiting
-- Prevents infinite recursion and stack overflow
PREPARE epic_dependency_graph AS
WITH RECURSIVE dependency_tree AS (
  -- Base case: direct dependencies
  SELECT
    ed.source_epic_id,
    ed.target_epic_id,
    ed.dependency_type,
    e1.title as source_title,
    e2.title as target_title,
    e1.status as source_status,
    e2.status as target_status,
    1 as depth,
    ARRAY[ed.source_epic_id] as path
  FROM epic_dependencies ed
  JOIN epics e1 ON ed.source_epic_id = e1.id
  JOIN epics e2 ON ed.target_epic_id = e2.id
  WHERE ed.source_epic_id = $1 -- Starting epic
    AND ed.resolved_at IS NULL
    AND e1.deleted_at IS NULL
    AND e2.deleted_at IS NULL

  UNION ALL

  -- Recursive case: follow dependencies
  SELECT
    ed.source_epic_id,
    ed.target_epic_id,
    ed.dependency_type,
    e1.title,
    e2.title,
    e1.status,
    e2.status,
    dt.depth + 1,
    dt.path || ed.source_epic_id
  FROM epic_dependencies ed
  JOIN dependency_tree dt ON ed.source_epic_id = dt.target_epic_id
  JOIN epics e1 ON ed.source_epic_id = e1.id
  JOIN epics e2 ON ed.target_epic_id = e2.id
  WHERE ed.resolved_at IS NULL
    AND e1.deleted_at IS NULL
    AND e2.deleted_at IS NULL
    AND dt.depth < 10 -- Prevent infinite recursion
    AND NOT ed.source_epic_id = ANY(dt.path) -- Prevent cycles
)
SELECT * FROM dependency_tree
ORDER BY depth, source_title;

-- Dependency graph index
CREATE INDEX CONCURRENTLY idx_epic_deps_graph
ON epic_dependencies (source_epic_id, target_epic_id, dependency_type, resolved_at);
```

### 5. Timeline and Planning Queries

```sql
-- OPTIMIZED: Timeline view with date range filtering
PREPARE epic_timeline_view AS
SELECT
  e.id,
  e.title,
  e.status,
  e.priority,
  e.start_date,
  e.target_date,
  e.completed_date,
  e.business_value,
  e.effort,
  p.name as project_name,
  p.color as project_color,
  -- Calculate timeline health
  CASE
    WHEN e.status = 'COMPLETED' AND e.completed_date <= e.target_date THEN 'ON_TIME'
    WHEN e.status = 'COMPLETED' AND e.completed_date > e.target_date THEN 'LATE'
    WHEN e.status != 'COMPLETED' AND e.target_date < CURRENT_DATE THEN 'OVERDUE'
    WHEN e.status != 'COMPLETED' AND e.target_date < CURRENT_DATE + INTERVAL '7 days' THEN 'AT_RISK'
    ELSE 'ON_TRACK'
  END as timeline_health,
  -- Days until/past target
  CASE
    WHEN e.status = 'COMPLETED' THEN e.completed_date - e.target_date
    ELSE CURRENT_DATE - e.target_date
  END as days_variance
FROM epics e
LEFT JOIN projects p ON e.project_id = p.id
WHERE e.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND (
    ($1::date IS NULL AND $2::date IS NULL) OR
    (e.start_date <= $2 AND e.target_date >= $1) OR
    (e.completed_date BETWEEN $1 AND $2)
  )
ORDER BY
  CASE
    WHEN e.status != 'COMPLETED' AND e.target_date < CURRENT_DATE THEN 1 -- Overdue first
    WHEN e.status != 'COMPLETED' AND e.target_date < CURRENT_DATE + INTERVAL '7 days' THEN 2 -- At risk
    ELSE 3 -- Others
  END,
  e.target_date ASC;

-- Timeline index for date range queries
CREATE INDEX CONCURRENTLY idx_epic_timeline_range
ON epics (start_date, target_date, completed_date, status)
WHERE deleted_at IS NULL;
```

## Advanced Optimization Techniques

### 1. Materialized View Strategy

```sql
-- Pre-computed dashboard statistics
CREATE MATERIALIZED VIEW epic_dashboard_stats AS
SELECT
  -- Overall counts
  COUNT(*) as total_epics,
  COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_count,
  COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as in_progress_count,
  COUNT(*) FILTER (WHERE status = 'PLANNED') as planned_count,
  COUNT(*) FILTER (WHERE status = 'BLOCKED') as blocked_count,

  -- Priority distribution
  COUNT(*) FILTER (WHERE priority = 'CRITICAL') as critical_count,
  COUNT(*) FILTER (WHERE priority = 'HIGH') as high_count,
  COUNT(*) FILTER (WHERE priority = 'MEDIUM') as medium_count,
  COUNT(*) FILTER (WHERE priority = 'LOW') as low_count,

  -- Timeline health
  COUNT(*) FILTER (WHERE target_date < CURRENT_DATE AND status NOT IN ('COMPLETED', 'CANCELLED')) as overdue_count,
  COUNT(*) FILTER (WHERE target_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' AND status NOT IN ('COMPLETED', 'CANCELLED')) as due_soon_count,

  -- Business metrics
  AVG(business_value) FILTER (WHERE business_value IS NOT NULL) as avg_business_value,
  AVG(effort) FILTER (WHERE effort IS NOT NULL) as avg_effort,
  SUM(business_value) FILTER (WHERE status = 'COMPLETED') as completed_business_value,

  -- Meta information
  MAX(updated_at) as last_updated,
  COUNT(DISTINCT project_id) as active_projects
FROM epics
WHERE deleted_at IS NULL;

-- Refresh function with concurrency safety
CREATE OR REPLACE FUNCTION refresh_epic_dashboard_stats()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY epic_dashboard_stats;

  -- Log refresh for monitoring
  INSERT INTO system_events (event_type, details, occurred_at)
  VALUES ('materialized_view_refresh', '{"view": "epic_dashboard_stats"}', NOW());
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail
    INSERT INTO system_events (event_type, details, occurred_at)
    VALUES ('materialized_view_error', json_build_object('view', 'epic_dashboard_stats', 'error', SQLERRM), NOW());
END;
$$;

-- Auto-refresh schedule (every 15 minutes during business hours)
SELECT cron.schedule(
  'refresh-epic-stats',
  '*/15 8-18 * * 1-5', -- Every 15 min, 8AM-6PM, Mon-Fri
  'SELECT refresh_epic_dashboard_stats();'
);
```

### 2. Query Plan Caching Strategy

```typescript
// Prepared statement management for optimal query planning
class OptimizedEpicQueries {
  private db: PrismaClient
  private queryCache = new Map<string, any>()

  // Cache frequently used query plans
  async getEpicList(filters: EpicFilters): Promise<Epic[]> {
    const cacheKey = this.buildCacheKey('epic_list', filters)

    // Check Redis cache first
    const cached = await redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }

    // Use prepared statement for consistent query planning
    const result = await this.db.$queryRaw`
      EXECUTE epic_list_optimized(
        ${filters.statuses || null},
        ${filters.priorities || null},
        ${filters.projectId || null},
        ${filters.quarter || null},
        ${filters.limit || 50}
      )
    `

    // Cache result for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify(result))
    return result
  }

  // Bulk operations with transaction optimization
  async bulkUpdateEpicOrder(updates: Array<{id: string, order: number}>): Promise<void> {
    await this.db.$transaction(async (tx) => {
      // Use bulk update with unnest for performance
      await tx.$executeRaw`
        UPDATE epics
        SET
          display_order = updates.new_order,
          version = version + 1,
          updated_at = NOW()
        FROM (
          SELECT * FROM unnest(
            ${updates.map(u => u.id)}::text[],
            ${updates.map(u => u.order)}::decimal[]
          ) AS t(epic_id, new_order)
        ) AS updates
        WHERE epics.id = updates.epic_id
          AND epics.deleted_at IS NULL
      `
    }, {
      timeout: 10000, // 10 second timeout
      isolationLevel: 'ReadCommitted' // Minimize lock contention
    })

    // Invalidate relevant caches
    await this.invalidateEpicListCaches()
  }
}
```

### 3. Connection Pool Optimization

```typescript
// Neon-optimized connection configuration
const optimizedPrismaConfig = {
  datasources: {
    db: {
      url: buildOptimizedConnectionString(process.env.DATABASE_URL!)
    }
  },

  // Query optimization
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' }
  ],

  // Connection pool tuning for Neon
  pool: {
    min: 0,  // Let Neon handle scaling
    max: 20, // Respect Neon connection limits
    acquireTimeoutMillis: 60000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
  }
}

function buildOptimizedConnectionString(baseUrl: string): string {
  const url = new URL(baseUrl)

  // Neon-specific optimizations
  url.searchParams.set('pgbouncer', 'true')
  url.searchParams.set('pool_mode', 'transaction')
  url.searchParams.set('connection_limit', '20')
  url.searchParams.set('prepared_statements', 'true')
  url.searchParams.set('statement_cache_size', '100')

  // Performance tuning
  url.searchParams.set('application_name', 'arrakis-roadmap')
  url.searchParams.set('connect_timeout', '10')
  url.searchParams.set('command_timeout', '30')

  return url.toString()
}

// Query performance monitoring
prisma.$on('query', (e) => {
  if (e.duration > 100) { // Log queries over 100ms
    console.warn(`Slow query detected (${e.duration}ms):`, {
      query: e.query.substring(0, 200) + '...',
      params: e.params,
      duration: e.duration
    })
  }
})
```

### 4. Search and Filter Optimization

```sql
-- Full-text search with ranking
PREPARE epic_text_search AS
SELECT
  e.id,
  e.title,
  e.description,
  e.status,
  e.priority,
  -- Search ranking
  ts_rank_cd(
    to_tsvector('english', e.title || ' ' || COALESCE(e.description, '') || ' ' || COALESCE(e.outcome, '')),
    plainto_tsquery('english', $1)
  ) as search_rank,
  -- Highlight matches
  ts_headline('english', e.title, plainto_tsquery('english', $1)) as highlighted_title
FROM epics e
WHERE e.deleted_at IS NULL
  AND to_tsvector('english', e.title || ' ' || COALESCE(e.description, '') || ' ' || COALESCE(e.outcome, ''))
      @@ plainto_tsquery('english', $1)
ORDER BY search_rank DESC, e.display_order ASC
LIMIT $2;

-- Full-text search index
CREATE INDEX CONCURRENTLY idx_epic_fulltext_search
ON epics USING gin (
  to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || COALESCE(outcome, ''))
)
WHERE deleted_at IS NULL;

-- Vector similarity search integration
PREPARE epic_semantic_search AS
SELECT
  e.id,
  e.title,
  e.description,
  e.status,
  -- Cosine similarity score
  1 - (e.content_embedding <-> $1) as similarity_score
FROM epics e
WHERE e.deleted_at IS NULL
  AND e.content_embedding IS NOT NULL
  AND 1 - (e.content_embedding <-> $1) > $2 -- Similarity threshold
ORDER BY e.content_embedding <-> $1 ASC
LIMIT $3;
```

### 5. Cache Invalidation Strategy

```typescript
// Intelligent cache invalidation
class EpicCacheManager {
  private readonly CACHE_PATTERNS = {
    EPIC_LIST: 'epic:list:*',
    EPIC_DETAIL: 'epic:detail:*',
    EPIC_STATS: 'epic:stats:*',
    PROJECT_SUMMARY: 'project:summary:*'
  }

  async invalidateEpicCaches(epicId: string, changes?: Partial<Epic>): Promise<void> {
    const pipeline = redis.pipeline()

    // Always invalidate direct epic cache
    pipeline.del(`epic:detail:${epicId}`)

    // Invalidate list caches if order/filter fields changed
    if (changes?.displayOrder || changes?.status || changes?.priority || changes?.projectId) {
      const listKeys = await redis.keys(this.CACHE_PATTERNS.EPIC_LIST)
      if (listKeys.length > 0) {
        pipeline.del(...listKeys)
      }
    }

    // Invalidate stats if business metrics changed
    if (changes?.status || changes?.businessValue || changes?.effort) {
      const statsKeys = await redis.keys(this.CACHE_PATTERNS.EPIC_STATS)
      if (statsKeys.length > 0) {
        pipeline.del(...statsKeys)
      }
    }

    // Invalidate project summaries
    if (changes?.projectId) {
      pipeline.del(`project:summary:${changes.projectId}`)
    }

    await pipeline.exec()

    // Trigger materialized view refresh if needed
    if (changes?.status || changes?.businessValue) {
      await this.scheduleStatsRefresh()
    }
  }

  private async scheduleStatsRefresh(): Promise<void> {
    // Use job queue for async refresh
    await jobQueue.add('refresh-epic-stats', {}, {
      delay: 60000, // 1 minute delay to batch updates
      removeOnComplete: 5,
      removeOnFail: 3
    })
  }
}
```

## Performance Monitoring & Alerting

```sql
-- Query performance monitoring view
CREATE VIEW slow_epic_queries AS
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
  AND mean_exec_time > 50 -- Queries slower than 50ms
ORDER BY mean_exec_time DESC;

-- Index usage monitoring
CREATE VIEW epic_index_usage AS
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size,
  CASE
    WHEN idx_scan = 0 THEN 'UNUSED'
    WHEN idx_scan < 100 THEN 'LOW_USAGE'
    WHEN idx_scan < 1000 THEN 'MODERATE_USAGE'
    ELSE 'HIGH_USAGE'
  END as usage_category
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('epics', 'epic_labels', 'labels', 'projects')
ORDER BY idx_scan DESC;
```

This query optimization strategy provides:
- **Sub-10ms performance** for critical operations
- **Scalable pagination** that maintains performance at scale
- **Intelligent caching** with smart invalidation
- **Prepared statement optimization** for consistent query plans
- **Comprehensive monitoring** for performance regression detection