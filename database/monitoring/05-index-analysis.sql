-- ============================================================================
-- INDEX OPTIMIZATION ANALYSIS
-- ============================================================================
-- Purpose: Analyze current index strategy and provide recommendations
-- Runtime: ~500ms
-- Usage: Run after initial deployment and periodically to optimize
-- ============================================================================

\timing on
\x auto

-- ============================================================================
-- 1. CURRENT INDEX INVENTORY
-- ============================================================================
-- Complete list of all indexes on webhook_events

SELECT
    i.relname AS index_name,
    a.attname AS column_name,
    ix.indisunique AS is_unique,
    ix.indisprimary AS is_primary,
    am.amname AS index_type,
    pg_size_pretty(pg_relation_size(i.oid)) AS index_size,
    pg_relation_size(i.oid) AS size_bytes,
    idx_scan AS times_used,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched,
    CASE
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'LOW_USAGE'
        WHEN idx_scan < 1000 THEN 'MODERATE'
        ELSE 'HIGH_USAGE'
    END AS usage_category
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_am am ON i.relam = am.oid
LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
LEFT JOIN pg_stat_user_indexes ui ON ui.indexrelid = i.oid
WHERE t.relname = 'webhook_events'
    AND t.relkind = 'r'
ORDER BY idx_scan DESC NULLS LAST, pg_relation_size(i.oid) DESC;

-- ============================================================================
-- 2. INDEX USAGE STATISTICS
-- ============================================================================
-- How effective are our indexes?

SELECT
    indexrelname AS index_name,
    idx_scan AS scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) AS size,
    -- Efficiency ratio: fetches per read
    CASE
        WHEN idx_tup_read > 0
        THEN ROUND((idx_tup_fetch::numeric / idx_tup_read) * 100, 2)
        ELSE 0
    END AS fetch_ratio_pct,
    -- Cost-benefit ratio: scans per MB
    CASE
        WHEN pg_relation_size(indexrelid) > 0
        THEN ROUND(idx_scan::numeric / (pg_relation_size(indexrelid) / 1024.0 / 1024.0), 2)
        ELSE 0
    END AS scans_per_mb,
    CASE
        WHEN idx_scan = 0 THEN 'NEVER_USED - Consider dropping'
        WHEN idx_scan < 10 AND pg_relation_size(indexrelid) > 1024*1024 THEN 'LOW_VALUE - Review necessity'
        WHEN idx_tup_fetch * 1.0 / NULLIF(idx_tup_read, 0) < 0.1 THEN 'LOW_EFFICIENCY - Review query patterns'
        ELSE 'GOOD'
    END AS recommendation
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND relname = 'webhook_events'
ORDER BY idx_scan DESC;

-- ============================================================================
-- 3. MISSING INDEX DETECTION
-- ============================================================================
-- Analyze queries to find potential missing indexes

-- 3.1 Sequential scans that might benefit from indexes
SELECT
    schemaname,
    relname AS table_name,
    seq_scan AS sequential_scans,
    seq_tup_read AS rows_read_sequentially,
    idx_scan AS index_scans,
    n_live_tup AS estimated_rows,
    CASE
        WHEN seq_scan > 0 AND n_live_tup > 0
        THEN ROUND((seq_tup_read::numeric / seq_scan) / n_live_tup * 100, 2)
        ELSE 0
    END AS avg_pct_table_scanned,
    CASE
        WHEN seq_scan > idx_scan AND seq_scan > 100 AND n_live_tup > 1000
        THEN 'CONSIDER_ADDITIONAL_INDEXES'
        ELSE 'OK'
    END AS recommendation
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND relname = 'webhook_events';

-- ============================================================================
-- 4. INDEX COVERAGE ANALYSIS
-- ============================================================================
-- Which columns are filtered/sorted but not indexed?

-- Query patterns we expect (based on schema review):
-- 1. Filter by status + receivedAt (covered by composite index)
-- 2. Filter by eventType + status (covered by composite index)
-- 3. Filter by sessionId + receivedAt (covered by composite index)
-- 4. Filter by conversationId (covered by single column index)
-- 5. Filter by requestId (covered by unique index)
-- 6. Order by receivedAt (covered by single column index)

-- Check if we're missing coverage for common patterns:

SELECT
    'Index Coverage Analysis' AS analysis_type,
    'webhook_events' AS table_name,
    jsonb_build_object(
        'single_column_indexes', ARRAY[
            'session_id',
            'event_type',
            'status',
            'received_at',
            'conversation_id',
            'request_id (unique)'
        ],
        'composite_indexes', ARRAY[
            'event_type + status',
            'session_id + received_at',
            'status + received_at'
        ],
        'potentially_useful_additions', ARRAY[
            'processing_time (for slow query detection)',
            'retry_count (for retry analysis)',
            'error_code (for error grouping)',
            'status + processed_at (for completion tracking)'
        ]
    ) AS index_inventory;

-- ============================================================================
-- 5. COMPOSITE INDEX EFFECTIVENESS
-- ============================================================================
-- Are our multi-column indexes being used correctly?

WITH composite_indexes AS (
    SELECT
        i.relname AS index_name,
        string_agg(a.attname, ', ' ORDER BY array_position(ix.indkey, a.attnum)) AS columns,
        idx_scan AS scans,
        pg_size_pretty(pg_relation_size(i.oid)) AS size
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    LEFT JOIN pg_stat_user_indexes ui ON ui.indexrelid = i.oid
    WHERE t.relname = 'webhook_events'
        AND array_length(ix.indkey, 1) > 1
    GROUP BY i.relname, idx_scan, i.oid
)
SELECT
    index_name,
    columns,
    scans,
    size,
    CASE
        WHEN index_name LIKE '%event_type_status%' THEN 'Used for: event type + status filters'
        WHEN index_name LIKE '%session%received%' THEN 'Used for: session history queries'
        WHEN index_name LIKE '%status%received%' THEN 'Used for: status + time range queries'
        ELSE 'Purpose unclear - document usage'
    END AS purpose,
    CASE
        WHEN scans = 0 THEN 'NOT_USED - Consider dropping'
        WHEN scans < 100 THEN 'LOW_USAGE - Monitor'
        ELSE 'ACTIVE'
    END AS recommendation
FROM composite_indexes
ORDER BY scans DESC;

-- ============================================================================
-- 6. INDEX SIZE VS BENEFIT
-- ============================================================================
-- Cost-benefit analysis of each index

SELECT
    indexrelname AS index_name,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    pg_relation_size(indexrelid) AS size_bytes,
    idx_scan AS times_used,
    -- Approximate cost of maintaining index (writes * size)
    (SELECT n_tup_ins + n_tup_upd + n_tup_del
     FROM pg_stat_user_tables
     WHERE relname = 'webhook_events') AS table_modifications,
    -- Benefit score: usage divided by size in MB
    CASE
        WHEN pg_relation_size(indexrelid) > 0
        THEN ROUND(idx_scan::numeric / (pg_relation_size(indexrelid) / 1024.0 / 1024.0), 2)
        ELSE 0
    END AS benefit_score,
    CASE
        WHEN idx_scan = 0 AND pg_relation_size(indexrelid) > 1024*1024
        THEN 'HIGH_COST_NO_BENEFIT - Drop this index'
        WHEN idx_scan < 10 AND pg_relation_size(indexrelid) > 5*1024*1024
        THEN 'HIGH_COST_LOW_BENEFIT - Review necessity'
        WHEN idx_scan > 1000 AND pg_relation_size(indexrelid) < 1024*1024
        THEN 'LOW_COST_HIGH_BENEFIT - Excellent index'
        ELSE 'ACCEPTABLE'
    END AS recommendation
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND relname = 'webhook_events'
ORDER BY benefit_score DESC NULLS LAST;

-- ============================================================================
-- 7. PARTIAL INDEX OPPORTUNITIES
-- ============================================================================
-- Where could partial indexes improve performance?

-- Current data distribution to identify candidates
SELECT
    'Partial Index Opportunities' AS analysis,
    jsonb_build_object(
        'by_status', (
            SELECT jsonb_object_agg(status, count)
            FROM (
                SELECT status, COUNT(*) AS count
                FROM webhook_events
                GROUP BY status
            ) sub
        ),
        'pending_only_percentage', (
            SELECT ROUND(
                100.0 * COUNT(*) FILTER (WHERE status = 'PENDING') / NULLIF(COUNT(*), 0),
                2
            )
            FROM webhook_events
        ),
        'recommendation', CASE
            WHEN (SELECT COUNT(*) FILTER (WHERE status = 'PENDING') FROM webhook_events) * 100.0 / NULLIF((SELECT COUNT(*) FROM webhook_events), 0) < 10
            THEN 'Consider partial index on status = PENDING for faster pending queue queries'
            ELSE 'PENDING status is common - partial index may not help'
        END
    ) AS analysis_results;

-- Suggested partial indexes (uncomment to create):
/*
-- Partial index for pending events only
CREATE INDEX idx_webhook_events_pending_received
ON webhook_events (received_at)
WHERE status = 'PENDING';

-- Partial index for error events only
CREATE INDEX idx_webhook_events_errors_recent
ON webhook_events (received_at, event_type, error_code)
WHERE status IN ('FAILED', 'ERROR');

-- Partial index for retry queue
CREATE INDEX idx_webhook_events_pending_retry
ON webhook_events (retry_after)
WHERE status = 'PENDING_RETRY' AND retry_after IS NOT NULL;
*/

-- ============================================================================
-- 8. INDEX BLOAT CHECK
-- ============================================================================
-- Are indexes bloated and need rebuilding?

SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    -- This is an approximation - actual bloat calculation is complex
    CASE
        WHEN (SELECT last_vacuum FROM pg_stat_user_tables WHERE relname = 'webhook_events') IS NULL
        THEN 'NEVER_VACUUMED - May have bloat'
        WHEN (SELECT last_vacuum FROM pg_stat_user_tables WHERE relname = 'webhook_events') < NOW() - INTERVAL '7 days'
        THEN 'OLD_VACUUM - Consider REINDEX'
        ELSE 'RECENTLY_MAINTAINED'
    END AS maintenance_status,
    (SELECT last_vacuum FROM pg_stat_user_tables WHERE relname = 'webhook_events') AS last_table_vacuum
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND relname = 'webhook_events'
ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================================================
-- 9. COVERING INDEX OPPORTUNITIES
-- ============================================================================
-- Could we use covering indexes (INCLUDE clause) to avoid table lookups?

SELECT
    'Covering Index Analysis' AS analysis_type,
    'Current indexes cover WHERE clauses well' AS current_state,
    'Consider adding INCLUDE columns for SELECT lists' AS opportunity,
    jsonb_build_object(
        'common_query_pattern_1', 'SELECT id, status, processing_time WHERE event_type = ? AND status = ?',
        'current_index', 'event_type + status (composite)',
        'potential_covering_index', 'CREATE INDEX ... ON webhook_events (event_type, status) INCLUDE (id, processing_time)',
        'benefit', 'Avoid table lookup for these columns',
        'cost', 'Larger index size',
        'recommendation', 'Monitor query patterns first - add if frequently used'
    ) AS analysis;

-- ============================================================================
-- 10. INDEX MAINTENANCE RECOMMENDATIONS
-- ============================================================================
-- Generate maintenance recommendations based on analysis

WITH index_stats AS (
    SELECT
        indexrelname,
        idx_scan,
        pg_relation_size(indexrelid) AS size_bytes,
        (SELECT n_tup_ins + n_tup_upd FROM pg_stat_user_tables WHERE relname = 'webhook_events') AS modifications
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
        AND relname = 'webhook_events'
)
SELECT
    indexrelname AS index_name,
    CASE
        -- Unused indexes
        WHEN idx_scan = 0 AND size_bytes > 1024*1024
        THEN 'DROP: Index never used and wastes space'

        -- Low-value indexes
        WHEN idx_scan < 10 AND modifications > 10000
        THEN 'CONSIDER_DROP: Rarely used but maintained on every write'

        -- High-value indexes needing maintenance
        WHEN idx_scan > 1000 AND modifications > 50000
        THEN 'REINDEX_PERIODICALLY: High usage index with many modifications'

        -- Good indexes
        WHEN idx_scan > 100
        THEN 'KEEP: Well-used index'

        -- New indexes (not enough data yet)
        ELSE 'MONITOR: Insufficient data for recommendation'
    END AS recommendation,
    idx_scan AS times_used,
    pg_size_pretty(size_bytes) AS size,
    modifications AS table_writes
FROM index_stats
ORDER BY
    CASE
        WHEN idx_scan = 0 THEN 1
        WHEN idx_scan < 10 THEN 2
        ELSE 3
    END,
    size_bytes DESC;

-- ============================================================================
-- SUMMARY: INDEX OPTIMIZATION RECOMMENDATIONS
-- ============================================================================

SELECT
    'INDEX OPTIMIZATION SUMMARY' AS summary_type,
    jsonb_build_object(
        'current_indexes', (
            SELECT COUNT(*)
            FROM pg_stat_user_indexes
            WHERE relname = 'webhook_events'
        ),
        'unused_indexes', (
            SELECT COUNT(*)
            FROM pg_stat_user_indexes
            WHERE relname = 'webhook_events'
                AND idx_scan = 0
        ),
        'total_index_size', (
            SELECT pg_size_pretty(SUM(pg_relation_size(indexrelid)))
            FROM pg_stat_user_indexes
            WHERE relname = 'webhook_events'
        ),
        'recommended_actions', ARRAY[
            'Monitor query patterns for 24-48 hours before making changes',
            'Consider partial indexes for PENDING and ERROR statuses if < 10% of data',
            'Drop unused indexes if they have 0 scans after 1 week',
            'Add covering indexes if specific queries are heavily repeated',
            'REINDEX monthly if table has high write volume',
            'Consider adding index on processing_time for performance monitoring queries'
        ]
    ) AS recommendations;

-- ============================================================================
-- INDEX ANALYSIS COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Run this analysis after 24-48 hours of production traffic
-- 2. Compare index usage patterns with baseline
-- 3. Drop unused indexes to reduce write overhead
-- 4. Add missing indexes based on actual query patterns
-- 5. Implement partial indexes for selective filtering
-- 6. Schedule monthly REINDEX for high-traffic indexes
-- ============================================================================
