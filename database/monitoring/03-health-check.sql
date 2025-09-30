-- ============================================================================
-- HEALTH CHECK QUERIES - Fast system health verification
-- ============================================================================
-- Purpose: Quick health checks that run in < 100ms
-- Runtime: ~50-100ms total
-- Usage: Run continuously via cron or monitoring system
-- Can be used for alerting thresholds
-- ============================================================================

\timing on

-- ============================================================================
-- 1. SYSTEM HEALTH OVERVIEW (< 50ms)
-- ============================================================================
-- Single query that provides overall health status

SELECT
    -- Database connectivity
    'OK' AS database_status,
    NOW() AS checked_at,

    -- Webhook event health (last 5 minutes)
    (SELECT COUNT(*) FROM webhook_events WHERE received_at > NOW() - INTERVAL '5 minutes') AS recent_events,
    (SELECT COUNT(*) FROM webhook_events WHERE status = 'PROCESSING' AND received_at < NOW() - INTERVAL '5 minutes') AS stuck_events,
    (SELECT COUNT(*) FROM webhook_events WHERE status IN ('FAILED', 'ERROR') AND received_at > NOW() - INTERVAL '1 hour') AS recent_errors,

    -- Database performance
    (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') AS active_connections,
    (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'idle in transaction' AND state_change < NOW() - INTERVAL '10 minutes') AS stuck_transactions,

    -- Health flags (boolean checks)
    CASE
        WHEN (SELECT COUNT(*) FROM webhook_events WHERE status = 'PROCESSING' AND received_at < NOW() - INTERVAL '5 minutes') > 0
        THEN true
        ELSE false
    END AS has_stuck_events,

    CASE
        WHEN (SELECT COUNT(*) FROM webhook_events WHERE status IN ('FAILED', 'ERROR') AND received_at > NOW() - INTERVAL '1 hour') > 10
        THEN true
        ELSE false
    END AS has_error_spike,

    CASE
        WHEN (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') > 50
        THEN true
        ELSE false
    END AS high_connection_count,

    -- Overall health score (0-100)
    CASE
        WHEN (SELECT COUNT(*) FROM webhook_events WHERE status = 'PROCESSING' AND received_at < NOW() - INTERVAL '5 minutes') > 0
            OR (SELECT COUNT(*) FROM webhook_events WHERE status IN ('FAILED', 'ERROR') AND received_at > NOW() - INTERVAL '1 hour') > 10
            OR (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') > 50
        THEN 50  -- Degraded
        WHEN (SELECT COUNT(*) FROM webhook_events WHERE status IN ('FAILED', 'ERROR') AND received_at > NOW() - INTERVAL '1 hour') > 5
        THEN 75  -- Warning
        ELSE 100 -- Healthy
    END AS health_score;

-- ============================================================================
-- 2. WEBHOOK TABLE HEALTH (< 20ms)
-- ============================================================================
-- Check if webhook_events table is healthy and responsive

SELECT
    'webhook_events' AS table_name,
    (SELECT COUNT(*) FROM webhook_events) AS total_rows,
    (SELECT COUNT(*) FROM webhook_events WHERE received_at > NOW() - INTERVAL '1 hour') AS rows_last_hour,
    pg_size_pretty(pg_total_relation_size('webhook_events')) AS total_size,
    (SELECT n_dead_tup FROM pg_stat_user_tables WHERE relname = 'webhook_events') AS dead_rows,
    (SELECT last_autovacuum FROM pg_stat_user_tables WHERE relname = 'webhook_events') AS last_vacuum,
    CASE
        WHEN (SELECT n_dead_tup FROM pg_stat_user_tables WHERE relname = 'webhook_events') > 10000
        THEN 'NEEDS_VACUUM'
        ELSE 'OK'
    END AS vacuum_status;

-- ============================================================================
-- 3. RECENT EVENT PROCESSING (< 20ms)
-- ============================================================================
-- Are events being processed successfully?

SELECT
    'Recent Processing' AS check_name,
    COUNT(*) AS events_last_minute,
    COUNT(*) FILTER (WHERE status = 'SUCCESS') AS successful,
    COUNT(*) FILTER (WHERE status = 'PENDING') AS pending,
    COUNT(*) FILTER (WHERE status IN ('FAILED', 'ERROR')) AS failed,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE status = 'SUCCESS') / NULLIF(COUNT(*), 0),
        2
    ) AS success_rate_pct,
    CASE
        WHEN COUNT(*) = 0 THEN 'NO_ACTIVITY'
        WHEN COUNT(*) FILTER (WHERE status = 'SUCCESS') * 1.0 / COUNT(*) < 0.90 THEN 'DEGRADED'
        ELSE 'HEALTHY'
    END AS status
FROM webhook_events
WHERE received_at > NOW() - INTERVAL '1 minute';

-- ============================================================================
-- 4. STUCK EVENTS CHECK (< 10ms)
-- ============================================================================
-- Alert if any events are stuck in PROCESSING state

SELECT
    'Stuck Events' AS check_name,
    COUNT(*) AS stuck_count,
    MIN(received_at) AS oldest_stuck_event,
    ARRAY_AGG(event_type) AS stuck_event_types,
    CASE
        WHEN COUNT(*) = 0 THEN 'OK'
        WHEN COUNT(*) < 5 THEN 'WARNING'
        ELSE 'CRITICAL'
    END AS severity
FROM webhook_events
WHERE status = 'PROCESSING'
    AND received_at < NOW() - INTERVAL '5 minutes';

-- ============================================================================
-- 5. ERROR SPIKE DETECTION (< 10ms)
-- ============================================================================
-- Alert if error rate exceeds threshold

SELECT
    'Error Spike Check' AS check_name,
    COUNT(*) FILTER (WHERE received_at > NOW() - INTERVAL '1 hour') AS total_events_last_hour,
    COUNT(*) FILTER (WHERE status IN ('FAILED', 'ERROR') AND received_at > NOW() - INTERVAL '1 hour') AS errors_last_hour,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE status IN ('FAILED', 'ERROR') AND received_at > NOW() - INTERVAL '1 hour') /
        NULLIF(COUNT(*) FILTER (WHERE received_at > NOW() - INTERVAL '1 hour'), 0),
        2
    ) AS error_rate_pct,
    CASE
        WHEN COUNT(*) FILTER (WHERE status IN ('FAILED', 'ERROR') AND received_at > NOW() - INTERVAL '1 hour') > 20 THEN 'CRITICAL'
        WHEN COUNT(*) FILTER (WHERE status IN ('FAILED', 'ERROR') AND received_at > NOW() - INTERVAL '1 hour') > 10 THEN 'WARNING'
        ELSE 'OK'
    END AS status
FROM webhook_events;

-- ============================================================================
-- 6. DATABASE RESPONSIVENESS (< 10ms)
-- ============================================================================
-- Is the database responding quickly?

SELECT
    'Database Response' AS check_name,
    (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') AS active_queries,
    (SELECT COUNT(*) FROM pg_stat_activity WHERE wait_event_type IS NOT NULL) AS waiting_queries,
    (SELECT ROUND(MAX(EXTRACT(EPOCH FROM (NOW() - query_start))))
     FROM pg_stat_activity
     WHERE state = 'active' AND query NOT LIKE '%pg_stat_activity%') AS longest_query_seconds,
    CASE
        WHEN (SELECT COUNT(*) FROM pg_stat_activity WHERE wait_event_type IS NOT NULL) > 10 THEN 'DEGRADED'
        WHEN (SELECT MAX(EXTRACT(EPOCH FROM (NOW() - query_start)))
              FROM pg_stat_activity
              WHERE state = 'active') > 30 THEN 'SLOW'
        ELSE 'OK'
    END AS status;

-- ============================================================================
-- 7. CONNECTION POOL STATUS (< 10ms)
-- ============================================================================
-- Check connection pool health

SELECT
    'Connection Pool' AS check_name,
    (SELECT numbackends FROM pg_stat_database WHERE datname = current_database()) AS total_connections,
    (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') AS active,
    (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'idle') AS idle,
    (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'idle in transaction') AS idle_in_transaction,
    CASE
        WHEN (SELECT numbackends FROM pg_stat_database WHERE datname = current_database()) > 80 THEN 'CRITICAL'
        WHEN (SELECT numbackends FROM pg_stat_database WHERE datname = current_database()) > 50 THEN 'WARNING'
        ELSE 'OK'
    END AS status;

-- ============================================================================
-- 8. REPLICATION LAG CHECK (for Render - if read replicas exist)
-- ============================================================================
-- Check if there's replication lag (only on primary)

SELECT
    'Replication Lag' AS check_name,
    CASE
        WHEN pg_is_in_recovery() THEN 'This is a replica'
        ELSE 'This is primary'
    END AS node_type,
    (SELECT COUNT(*) FROM pg_stat_replication) AS connected_replicas;

-- If this is a replica, check lag:
-- SELECT
--     NOW() - pg_last_xact_replay_timestamp() AS replication_lag
-- FROM pg_stat_replication;

-- ============================================================================
-- 9. DISK SPACE CHECK (< 10ms)
-- ============================================================================
-- Monitor available disk space

SELECT
    'Disk Space' AS check_name,
    pg_size_pretty(pg_database_size(current_database())) AS database_size,
    pg_database_size(current_database()) AS size_bytes,
    -- Render typically allocates based on plan
    -- You may want to set alerts based on your plan limits
    CASE
        WHEN pg_database_size(current_database()) > 10 * 1024 * 1024 * 1024 THEN 'WARNING_10GB'  -- 10GB
        WHEN pg_database_size(current_database()) > 5 * 1024 * 1024 * 1024 THEN 'GROWING_5GB'    -- 5GB
        ELSE 'OK'
    END AS status;

-- ============================================================================
-- COMBINED HEALTH STATUS (< 20ms)
-- ============================================================================
-- Single-row summary suitable for monitoring systems

WITH health_checks AS (
    SELECT
        (SELECT COUNT(*) FROM webhook_events WHERE status = 'PROCESSING' AND received_at < NOW() - INTERVAL '5 minutes') AS stuck_events,
        (SELECT COUNT(*) FROM webhook_events WHERE status IN ('FAILED', 'ERROR') AND received_at > NOW() - INTERVAL '1 hour') AS recent_errors,
        (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') AS active_connections,
        (SELECT COUNT(*) FROM pg_stat_activity WHERE wait_event_type IS NOT NULL) AS waiting_queries,
        (SELECT n_dead_tup FROM pg_stat_user_tables WHERE relname = 'webhook_events') AS dead_rows
)
SELECT
    NOW() AS timestamp,
    CASE
        WHEN stuck_events > 0 OR recent_errors > 20 THEN 'CRITICAL'
        WHEN recent_errors > 10 OR active_connections > 50 OR dead_rows > 10000 THEN 'WARNING'
        ELSE 'HEALTHY'
    END AS overall_status,
    stuck_events,
    recent_errors,
    active_connections,
    waiting_queries,
    dead_rows,
    -- Health score for programmatic monitoring
    CASE
        WHEN stuck_events > 0 OR recent_errors > 20 THEN 0
        WHEN recent_errors > 10 OR active_connections > 50 THEN 50
        ELSE 100
    END AS health_score
FROM health_checks;

-- ============================================================================
-- HEALTH CHECK COMPLETE
-- ============================================================================
-- Thresholds for alerting:
-- - CRITICAL: stuck_events > 0 OR recent_errors > 20
-- - WARNING: recent_errors > 10 OR active_connections > 50 OR dead_rows > 10000
-- - HEALTHY: All metrics within normal ranges
--
-- Recommended monitoring frequency:
-- - Health check: Every 30 seconds
-- - Full monitoring: Every 5 minutes
-- - Baseline comparison: Every hour
-- ============================================================================
