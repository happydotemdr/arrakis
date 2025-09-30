-- ============================================================================
-- DATABASE MAINTENANCE PLAN
-- ============================================================================
-- Purpose: Regular maintenance tasks for optimal performance
-- Frequency: See individual task recommendations
-- Usage: Run via scheduled jobs or manually as needed
-- ============================================================================

\timing on
\x auto

-- ============================================================================
-- SECTION 1: VACUUM ANALYSIS & EXECUTION
-- ============================================================================

-- 1.1 Check if VACUUM is needed
-- Run this BEFORE deciding to vacuum

SELECT
    schemaname,
    relname AS table_name,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows,
    ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_row_pct,
    last_vacuum,
    last_autovacuum,
    CASE
        WHEN last_autovacuum > last_vacuum OR last_vacuum IS NULL THEN last_autovacuum
        ELSE last_vacuum
    END AS last_vacuum_time,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS total_size,
    CASE
        WHEN n_dead_tup > 10000 AND n_dead_tup * 1.0 / NULLIF(n_live_tup, 0) > 0.2
        THEN 'VACUUM_NEEDED'
        WHEN n_dead_tup > 50000
        THEN 'VACUUM_RECOMMENDED'
        ELSE 'OK'
    END AS recommendation,
    -- Estimated time to vacuum (rough approximation)
    CASE
        WHEN n_dead_tup < 10000 THEN '< 1 second'
        WHEN n_dead_tup < 100000 THEN '1-10 seconds'
        WHEN n_dead_tup < 1000000 THEN '10-60 seconds'
        ELSE '> 1 minute'
    END AS estimated_duration
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY dead_row_pct DESC NULLS LAST;

-- 1.2 VACUUM Commands (run as needed)
-- Uncomment and run based on above analysis:

-- Standard VACUUM (reclaims space, updates statistics)
-- VACUUM VERBOSE webhook_events;

-- VACUUM ANALYZE (vacuum + update statistics)
-- VACUUM ANALYZE webhook_events;

-- VACUUM FULL (reclaims ALL space, but requires exclusive lock - AVOID in production)
-- WARNING: This locks the table and can take a long time!
-- VACUUM FULL webhook_events;

-- ============================================================================
-- SECTION 2: ANALYZE STATISTICS
-- ============================================================================

-- 2.1 Check if ANALYZE is needed
-- Statistics are used by query planner - keep them current

SELECT
    schemaname,
    relname AS table_name,
    n_mod_since_analyze AS modifications_since_analyze,
    last_analyze,
    last_autoanalyze,
    CASE
        WHEN last_autoanalyze > last_analyze OR last_analyze IS NULL THEN last_autoanalyze
        ELSE last_analyze
    END AS last_analyze_time,
    CASE
        WHEN n_mod_since_analyze > 10000 THEN 'ANALYZE_NEEDED'
        WHEN n_mod_since_analyze > 1000 THEN 'ANALYZE_RECOMMENDED'
        ELSE 'OK'
    END AS recommendation
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_mod_since_analyze DESC;

-- 2.2 ANALYZE Commands
-- Update statistics for query planner optimization

-- Analyze specific table
-- ANALYZE VERBOSE webhook_events;

-- Analyze all tables in database
-- ANALYZE VERBOSE;

-- ============================================================================
-- SECTION 3: INDEX MAINTENANCE
-- ============================================================================

-- 3.1 Check for index bloat
-- Indexes can become bloated over time

SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS times_used,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched,
    (SELECT n_tup_upd + n_tup_del
     FROM pg_stat_user_tables t
     WHERE t.relname = s.tablename) AS table_modifications,
    CASE
        WHEN (SELECT last_vacuum FROM pg_stat_user_tables t WHERE t.relname = s.tablename) < NOW() - INTERVAL '30 days'
        THEN 'REINDEX_RECOMMENDED'
        WHEN (SELECT n_tup_upd + n_tup_del FROM pg_stat_user_tables t WHERE t.relname = s.tablename) > 100000
        THEN 'REINDEX_CONSIDER'
        ELSE 'OK'
    END AS recommendation
FROM pg_stat_user_indexes s
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- 3.2 REINDEX Commands
-- Rebuild indexes to eliminate bloat

-- Reindex specific index (least intrusive - allows concurrent queries)
-- REINDEX INDEX CONCURRENTLY idx_webhook_events_received_at;

-- Reindex entire table (requires more time)
-- REINDEX TABLE CONCURRENTLY webhook_events;

-- Note: CONCURRENTLY requires PostgreSQL 12+
-- Without CONCURRENTLY, the operation locks the table (avoid in production)

-- ============================================================================
-- SECTION 4: TABLE SIZE MONITORING
-- ============================================================================

-- 4.1 Track table growth over time
-- Monitor to detect unexpected growth patterns

SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(
        pg_total_relation_size(schemaname||'.'||tablename) -
        pg_relation_size(schemaname||'.'||tablename)
    ) AS indexes_size,
    n_live_tup AS estimated_rows,
    CASE
        WHEN n_live_tup > 0
        THEN pg_size_pretty((pg_relation_size(schemaname||'.'||tablename) / n_live_tup)::bigint)
        ELSE 'N/A'
    END AS avg_row_size,
    NOW() AS measured_at
FROM pg_stat_user_tables
JOIN pg_tables USING (schemaname, tablename)
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 4.2 Growth rate analysis
-- Compare current size with baseline (requires historical data)

-- Create a table to track size history (run once):
/*
CREATE TABLE IF NOT EXISTS monitoring_size_history (
    id SERIAL PRIMARY KEY,
    measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    table_name TEXT NOT NULL,
    total_size_bytes BIGINT NOT NULL,
    table_size_bytes BIGINT NOT NULL,
    index_size_bytes BIGINT NOT NULL,
    row_count BIGINT NOT NULL
);

CREATE INDEX idx_size_history_table_time
ON monitoring_size_history (table_name, measured_at DESC);
*/

-- Record current sizes (run daily/weekly):
/*
INSERT INTO monitoring_size_history (table_name, total_size_bytes, table_size_bytes, index_size_bytes, row_count)
SELECT
    tablename,
    pg_total_relation_size(schemaname||'.'||tablename),
    pg_relation_size(schemaname||'.'||tablename),
    pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename),
    n_live_tup
FROM pg_stat_user_tables
WHERE schemaname = 'public';
*/

-- Analyze growth trends:
/*
WITH size_comparison AS (
    SELECT
        table_name,
        measured_at,
        total_size_bytes,
        LAG(total_size_bytes) OVER (PARTITION BY table_name ORDER BY measured_at) AS previous_size,
        LAG(measured_at) OVER (PARTITION BY table_name ORDER BY measured_at) AS previous_measurement
    FROM monitoring_size_history
    WHERE measured_at > NOW() - INTERVAL '30 days'
)
SELECT
    table_name,
    pg_size_pretty(total_size_bytes) AS current_size,
    pg_size_pretty(previous_size) AS previous_size,
    pg_size_pretty(total_size_bytes - previous_size) AS growth,
    ROUND(
        ((total_size_bytes - previous_size)::numeric / NULLIF(previous_size, 0)) * 100,
        2
    ) AS growth_pct,
    EXTRACT(EPOCH FROM (measured_at - previous_measurement)) / 86400 AS days_between,
    measured_at AS current_measurement,
    previous_measurement
FROM size_comparison
WHERE previous_size IS NOT NULL
ORDER BY table_name, measured_at DESC;
*/

-- ============================================================================
-- SECTION 5: ARCHIVE/PURGE OLD DATA
-- ============================================================================

-- 5.1 Identify archival candidates
-- Old webhook events that can be archived or deleted

SELECT
    'Data Archival Analysis' AS analysis_type,
    COUNT(*) AS total_events,
    COUNT(*) FILTER (WHERE received_at < NOW() - INTERVAL '90 days') AS older_than_90_days,
    COUNT(*) FILTER (WHERE received_at < NOW() - INTERVAL '30 days') AS older_than_30_days,
    COUNT(*) FILTER (WHERE received_at < NOW() - INTERVAL '7 days') AS older_than_7_days,
    pg_size_pretty(pg_total_relation_size('webhook_events')) AS current_table_size,
    -- Estimated space savings from purging old data
    CASE
        WHEN COUNT(*) > 0
        THEN pg_size_pretty(
            (pg_total_relation_size('webhook_events') *
             COUNT(*) FILTER (WHERE received_at < NOW() - INTERVAL '90 days') / COUNT(*))::bigint
        )
        ELSE '0 bytes'
    END AS potential_space_savings_90d
FROM webhook_events;

-- 5.2 Data retention recommendations

SELECT
    status,
    COUNT(*) AS events,
    MIN(received_at) AS oldest_event,
    MAX(received_at) AS newest_event,
    pg_size_pretty(
        (COUNT(*) * (SELECT pg_relation_size('webhook_events') / NULLIF(COUNT(*), 0) FROM webhook_events))::bigint
    ) AS estimated_size,
    CASE
        WHEN status = 'SUCCESS' AND MIN(received_at) < NOW() - INTERVAL '90 days'
        THEN 'Archive successful events older than 90 days'
        WHEN status = 'DUPLICATE' AND MIN(received_at) < NOW() - INTERVAL '30 days'
        THEN 'Delete duplicate events older than 30 days'
        WHEN status IN ('FAILED', 'ERROR') AND MIN(received_at) < NOW() - INTERVAL '180 days'
        THEN 'Archive error events older than 180 days for analysis'
        ELSE 'Keep for now'
    END AS recommendation
FROM webhook_events
GROUP BY status
ORDER BY COUNT(*) DESC;

-- 5.3 Archive/Purge Commands (CAREFUL!)
-- Always backup before purging data

-- Option A: Archive to separate table before deletion
/*
-- Create archive table (run once)
CREATE TABLE webhook_events_archive (LIKE webhook_events INCLUDING ALL);

-- Archive old successful events
INSERT INTO webhook_events_archive
SELECT * FROM webhook_events
WHERE status = 'SUCCESS'
    AND received_at < NOW() - INTERVAL '90 days';

-- Verify archive
SELECT COUNT(*) FROM webhook_events_archive;

-- Delete archived events (BE VERY CAREFUL!)
DELETE FROM webhook_events
WHERE status = 'SUCCESS'
    AND received_at < NOW() - INTERVAL '90 days';
*/

-- Option B: Direct deletion (no archive - permanent!)
/*
-- Delete duplicate events older than 30 days
DELETE FROM webhook_events
WHERE status = 'DUPLICATE'
    AND received_at < NOW() - INTERVAL '30 days';
*/

-- Option C: Batch deletion to avoid long transactions
/*
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    LOOP
        DELETE FROM webhook_events
        WHERE id IN (
            SELECT id
            FROM webhook_events
            WHERE status = 'SUCCESS'
                AND received_at < NOW() - INTERVAL '90 days'
            LIMIT 1000
        );

        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        EXIT WHEN deleted_count = 0;

        -- Sleep to avoid overwhelming the database
        PERFORM pg_sleep(1);

        RAISE NOTICE 'Deleted % rows', deleted_count;
    END LOOP;
END $$;
*/

-- ============================================================================
-- SECTION 6: CONNECTION POOL MAINTENANCE
-- ============================================================================

-- 6.1 Identify idle connections

SELECT
    pid,
    usename,
    application_name,
    client_addr,
    state,
    state_change,
    NOW() - state_change AS idle_duration,
    query_start,
    LEFT(query, 100) AS last_query
FROM pg_stat_activity
WHERE state = 'idle'
    AND datname = current_database()
ORDER BY state_change ASC
LIMIT 20;

-- 6.2 Identify long-running idle transactions (can hold locks!)

SELECT
    pid,
    usename,
    application_name,
    client_addr,
    state,
    xact_start,
    NOW() - xact_start AS transaction_duration,
    query_start,
    NOW() - query_start AS query_duration,
    LEFT(query, 100) AS query
FROM pg_stat_activity
WHERE state = 'idle in transaction'
    AND datname = current_database()
    AND NOW() - xact_start > INTERVAL '5 minutes'
ORDER BY xact_start ASC;

-- 6.3 Kill stuck connections (CAREFUL!)
-- Only use if absolutely necessary

-- Terminate specific connection
-- SELECT pg_terminate_backend(12345);  -- Replace 12345 with actual PID

-- Terminate all idle in transaction connections older than 30 minutes
/*
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
    AND datname = current_database()
    AND NOW() - state_change > INTERVAL '30 minutes';
*/

-- ============================================================================
-- SECTION 7: AUTOVACUUM TUNING
-- ============================================================================

-- 7.1 Current autovacuum settings

SELECT
    name,
    setting,
    unit,
    short_desc
FROM pg_settings
WHERE name LIKE '%autovacuum%'
ORDER BY name;

-- 7.2 Per-table autovacuum settings
-- Check if tables have custom autovacuum settings

SELECT
    relname AS table_name,
    reloptions AS custom_settings
FROM pg_class
WHERE relname IN ('webhook_events', 'conversations', 'messages', 'tool_uses')
    AND reloptions IS NOT NULL;

-- 7.3 Recommended autovacuum tuning for webhook_events
-- High-traffic table needs more aggressive autovacuum

/*
-- More aggressive autovacuum for webhook_events
ALTER TABLE webhook_events SET (
    autovacuum_vacuum_scale_factor = 0.05,  -- Vacuum when 5% dead rows (default: 20%)
    autovacuum_analyze_scale_factor = 0.02, -- Analyze when 2% changes (default: 10%)
    autovacuum_vacuum_cost_delay = 10,      -- Faster vacuum (default: 20ms)
    autovacuum_vacuum_threshold = 1000      -- Vacuum when 1000+ dead rows
);

-- Verify settings
SELECT reloptions FROM pg_class WHERE relname = 'webhook_events';
*/

-- ============================================================================
-- SECTION 8: MAINTENANCE SCHEDULE
-- ============================================================================

SELECT
    'MAINTENANCE SCHEDULE' AS schedule_type,
    jsonb_build_object(
        'daily_tasks', ARRAY[
            'Monitor health checks (03-health-check.sql)',
            'Check for stuck events',
            'Review error rates'
        ],
        'weekly_tasks', ARRAY[
            'Review index usage (05-index-analysis.sql)',
            'Check table bloat',
            'VACUUM ANALYZE if needed',
            'Review query performance'
        ],
        'monthly_tasks', ARRAY[
            'REINDEX high-traffic indexes',
            'Archive old webhook events (>90 days)',
            'Review and optimize slow queries',
            'Database size trend analysis'
        ],
        'quarterly_tasks', ARRAY[
            'Review data retention policy',
            'Optimize composite indexes based on usage patterns',
            'Update monitoring thresholds',
            'Capacity planning review'
        ]
    ) AS maintenance_schedule;

-- ============================================================================
-- SECTION 9: MAINTENANCE LOG
-- ============================================================================

-- 9.1 Create maintenance log table (run once)
/*
CREATE TABLE IF NOT EXISTS maintenance_log (
    id SERIAL PRIMARY KEY,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    maintenance_type TEXT NOT NULL,
    table_name TEXT,
    command TEXT,
    duration_seconds NUMERIC,
    rows_affected BIGINT,
    notes TEXT,
    performed_by TEXT DEFAULT current_user
);

CREATE INDEX idx_maintenance_log_time ON maintenance_log (performed_at DESC);
CREATE INDEX idx_maintenance_log_type ON maintenance_log (maintenance_type);
*/

-- 9.2 Log maintenance activity
/*
INSERT INTO maintenance_log (maintenance_type, table_name, command, duration_seconds, rows_affected, notes)
VALUES (
    'VACUUM',
    'webhook_events',
    'VACUUM ANALYZE webhook_events',
    12.5,
    150000,
    'Routine weekly maintenance - removed dead rows'
);
*/

-- 9.3 View maintenance history
/*
SELECT
    performed_at,
    maintenance_type,
    table_name,
    duration_seconds,
    rows_affected,
    notes
FROM maintenance_log
ORDER BY performed_at DESC
LIMIT 20;
*/

-- ============================================================================
-- MAINTENANCE PLAN COMPLETE
-- ============================================================================
-- Quick reference for common maintenance tasks:
--
-- DAILY:
--   psql $DIRECT_URL -f 03-health-check.sql
--
-- WEEKLY:
--   psql $DIRECT_URL -c "VACUUM ANALYZE webhook_events;"
--   psql $DIRECT_URL -f 05-index-analysis.sql
--
-- MONTHLY:
--   psql $DIRECT_URL -c "REINDEX TABLE CONCURRENTLY webhook_events;"
--   -- Archive old events (see Section 5.3)
--
-- AS NEEDED:
--   psql $DIRECT_URL -f 04-diagnostics.sql  (when issues occur)
-- ============================================================================
