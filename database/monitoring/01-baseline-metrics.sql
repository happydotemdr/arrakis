-- ============================================================================
-- BASELINE METRICS - Run BEFORE webhook activation
-- ============================================================================
-- Purpose: Capture current database state to compare against post-activation
-- Runtime: ~500ms total
-- Usage: psql $DIRECT_URL -f 01-baseline-metrics.sql
-- ============================================================================

-- Set output format for better readability
\timing on
\x auto

-- ============================================================================
-- 1. CONVERSATION & MESSAGE COUNTS
-- ============================================================================
-- Baseline: How many conversations and messages exist now?
-- Expected: Varies by usage, but should be consistent

SELECT
    'Baseline Counts' AS metric_group,
    (SELECT COUNT(*) FROM conversations) AS total_conversations,
    (SELECT COUNT(*) FROM messages) AS total_messages,
    (SELECT COUNT(*) FROM tool_uses) AS total_tool_uses,
    (SELECT COUNT(*) FROM conversation_embeddings) AS total_embeddings,
    (SELECT COUNT(*) FROM webhook_events) AS total_webhook_events,
    ROUND(
        (SELECT COUNT(*)::numeric FROM messages) /
        NULLIF((SELECT COUNT(*) FROM conversations), 0),
        2
    ) AS avg_messages_per_conversation,
    now() AS measured_at;

-- ============================================================================
-- 2. DATABASE SIZE ANALYSIS
-- ============================================================================
-- Baseline: Current storage consumption

SELECT
    'Database Size' AS metric_group,
    pg_size_pretty(pg_database_size(current_database())) AS total_database_size,
    pg_database_size(current_database()) AS total_size_bytes,
    now() AS measured_at;

-- ============================================================================
-- 3. TABLE SIZE BREAKDOWN
-- ============================================================================
-- Baseline: Individual table sizes (data + indexes)

SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_total_relation_size(schemaname||'.'||tablename) AS total_bytes,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(
        pg_total_relation_size(schemaname||'.'||tablename) -
        pg_relation_size(schemaname||'.'||tablename)
    ) AS indexes_size,
    ROUND(
        100.0 * (pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) /
        NULLIF(pg_total_relation_size(schemaname||'.'||tablename), 0),
        2
    ) AS index_ratio_pct
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================================
-- 4. INDEX USAGE STATISTICS
-- ============================================================================
-- Baseline: Current index efficiency before webhook load

SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan AS index_scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    CASE
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'LOW_USAGE'
        ELSE 'ACTIVE'
    END AS usage_status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY tablename, idx_scan DESC;

-- ============================================================================
-- 5. TABLE STATISTICS
-- ============================================================================
-- Baseline: Row counts and bloat indicators

SELECT
    schemaname,
    relname AS tablename,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows,
    ROUND(
        100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0),
        2
    ) AS dead_row_pct,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze,
    CASE
        WHEN last_autovacuum > last_vacuum OR last_vacuum IS NULL
        THEN 'autovacuum'
        WHEN last_vacuum > last_autovacuum OR last_autovacuum IS NULL
        THEN 'manual'
        ELSE 'never'
    END AS last_vacuum_type
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- ============================================================================
-- 6. QUERY PERFORMANCE BASELINE (if pg_stat_statements is enabled)
-- ============================================================================
-- Baseline: Current query performance patterns

-- Check if pg_stat_statements is available
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
        )
        THEN 'pg_stat_statements is enabled'
        ELSE 'pg_stat_statements is NOT enabled - consider enabling for query monitoring'
    END AS extension_status;

-- Top queries by execution time (if available)
-- Uncomment if pg_stat_statements is enabled:
/*
SELECT
    LEFT(query, 100) AS query_preview,
    calls AS executions,
    ROUND(mean_exec_time::numeric, 2) AS avg_time_ms,
    ROUND(total_exec_time::numeric, 2) AS total_time_ms,
    ROUND((100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0))::numeric, 2) AS cache_hit_pct
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY total_exec_time DESC
LIMIT 10;
*/

-- ============================================================================
-- 7. CONNECTION STATISTICS
-- ============================================================================
-- Baseline: Current connection patterns

SELECT
    datname AS database,
    numbackends AS active_connections,
    xact_commit AS transactions_committed,
    xact_rollback AS transactions_rolled_back,
    ROUND(
        100.0 * xact_rollback / NULLIF(xact_commit + xact_rollback, 0),
        2
    ) AS rollback_pct,
    blks_read AS disk_blocks_read,
    blks_hit AS cache_blocks_hit,
    ROUND(
        100.0 * blks_hit / NULLIF(blks_hit + blks_read, 0),
        2
    ) AS cache_hit_ratio_pct,
    tup_returned AS rows_returned,
    tup_fetched AS rows_fetched,
    tup_inserted AS rows_inserted,
    tup_updated AS rows_updated,
    tup_deleted AS rows_deleted
FROM pg_stat_database
WHERE datname = current_database();

-- ============================================================================
-- 8. RECENT ACTIVITY SNAPSHOT
-- ============================================================================
-- Baseline: What's happening right now?

SELECT
    COUNT(*) AS total_active_queries,
    COUNT(*) FILTER (WHERE state = 'active') AS currently_executing,
    COUNT(*) FILTER (WHERE state = 'idle') AS idle_connections,
    COUNT(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_transaction,
    COUNT(*) FILTER (WHERE wait_event_type IS NOT NULL) AS waiting_queries,
    MAX(EXTRACT(EPOCH FROM (now() - query_start))) AS longest_query_seconds
FROM pg_stat_activity
WHERE datname = current_database()
    AND pid != pg_backend_pid();

-- ============================================================================
-- 9. WEBHOOK-SPECIFIC BASELINE
-- ============================================================================
-- Baseline: Current webhook table state (should be empty or minimal)

SELECT
    'Webhook Events Baseline' AS metric_group,
    COUNT(*) AS total_events,
    COUNT(*) FILTER (WHERE status = 'SUCCESS') AS successful,
    COUNT(*) FILTER (WHERE status = 'FAILED') AS failed,
    COUNT(*) FILTER (WHERE status = 'ERROR') AS errors,
    COUNT(*) FILTER (WHERE status = 'PENDING') AS pending,
    COUNT(DISTINCT event_type) AS distinct_event_types,
    COUNT(DISTINCT session_id) AS distinct_sessions,
    MIN(received_at) AS earliest_event,
    MAX(received_at) AS latest_event
FROM webhook_events;

-- If there are any events, show their distribution
SELECT
    event_type,
    status,
    COUNT(*) AS count,
    AVG(processing_time) AS avg_processing_ms,
    MAX(processing_time) AS max_processing_ms
FROM webhook_events
GROUP BY event_type, status
ORDER BY event_type, status;

-- ============================================================================
-- 10. SAVE BASELINE TO TABLE (OPTIONAL)
-- ============================================================================
-- Uncomment to create a baseline tracking table:

/*
CREATE TABLE IF NOT EXISTS monitoring_baselines (
    id SERIAL PRIMARY KEY,
    measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metric_name TEXT NOT NULL,
    metric_value NUMERIC,
    metric_unit TEXT,
    metadata JSONB
);

-- Insert baseline metrics
INSERT INTO monitoring_baselines (metric_name, metric_value, metric_unit, metadata)
SELECT
    'total_conversations',
    COUNT(*),
    'count',
    jsonb_build_object('table', 'conversations')
FROM conversations;

INSERT INTO monitoring_baselines (metric_name, metric_value, metric_unit, metadata)
SELECT
    'total_messages',
    COUNT(*),
    'count',
    jsonb_build_object('table', 'messages')
FROM messages;

INSERT INTO monitoring_baselines (metric_name, metric_value, metric_unit, metadata)
SELECT
    'database_size_bytes',
    pg_database_size(current_database()),
    'bytes',
    jsonb_build_object('database', current_database())
FROM (SELECT 1) AS dummy;

-- Query saved baselines
SELECT * FROM monitoring_baselines ORDER BY measured_at DESC;
*/

-- ============================================================================
-- BASELINE METRICS COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Save these results before activation
-- 2. Run webhook activation
-- 3. Run 02-realtime-monitoring.sql during activation
-- 4. Compare results to detect issues early
-- ============================================================================
