-- ============================================================================
-- REAL-TIME MONITORING - Run DURING webhook activation
-- ============================================================================
-- Purpose: Monitor webhook processing performance in real-time
-- Runtime: ~200ms per execution
-- Usage: Run repeatedly via: watch -n 5 'psql $DIRECT_URL -f 02-realtime-monitoring.sql'
-- ============================================================================

\timing on
\x auto

-- ============================================================================
-- 1. WEBHOOK EVENT SUMMARY (LAST 5 MINUTES)
-- ============================================================================
-- Real-time overview of recent webhook activity

SELECT
    'Last 5 Minutes' AS time_window,
    COUNT(*) AS total_events,
    COUNT(*) FILTER (WHERE status = 'SUCCESS') AS successful,
    COUNT(*) FILTER (WHERE status = 'FAILED') AS failed,
    COUNT(*) FILTER (WHERE status = 'ERROR') AS errors,
    COUNT(*) FILTER (WHERE status = 'PENDING') AS pending,
    COUNT(*) FILTER (WHERE status = 'PROCESSING') AS processing,
    COUNT(*) FILTER (WHERE status = 'DUPLICATE') AS duplicates,
    COUNT(*) FILTER (WHERE status = 'INVALID') AS invalid,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE status = 'SUCCESS') / NULLIF(COUNT(*), 0),
        2
    ) AS success_rate_pct,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE status IN ('FAILED', 'ERROR')) / NULLIF(COUNT(*), 0),
        2
    ) AS error_rate_pct,
    ROUND(AVG(processing_time)) AS avg_processing_ms,
    MAX(processing_time) AS max_processing_ms
FROM webhook_events
WHERE received_at > NOW() - INTERVAL '5 minutes';

-- ============================================================================
-- 2. EVENTS PER MINUTE (LAST 10 MINUTES)
-- ============================================================================
-- Throughput analysis - detect spikes or drops

SELECT
    date_trunc('minute', received_at) AS minute,
    COUNT(*) AS events,
    COUNT(*) FILTER (WHERE status = 'SUCCESS') AS successful,
    COUNT(*) FILTER (WHERE status IN ('FAILED', 'ERROR')) AS failed,
    ROUND(AVG(processing_time)) AS avg_ms,
    MAX(processing_time) AS max_ms
FROM webhook_events
WHERE received_at > NOW() - INTERVAL '10 minutes'
GROUP BY date_trunc('minute', received_at)
ORDER BY minute DESC;

-- ============================================================================
-- 3. EVENT TYPE BREAKDOWN
-- ============================================================================
-- Which event types are being received?

SELECT
    event_type,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'SUCCESS') AS successful,
    COUNT(*) FILTER (WHERE status = 'PENDING') AS pending,
    COUNT(*) FILTER (WHERE status IN ('FAILED', 'ERROR')) AS failed,
    ROUND(AVG(processing_time)) AS avg_ms,
    ROUND(
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY processing_time)
    ) AS p50_ms,
    ROUND(
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time)
    ) AS p95_ms,
    ROUND(
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY processing_time)
    ) AS p99_ms,
    MAX(processing_time) AS max_ms
FROM webhook_events
WHERE received_at > NOW() - INTERVAL '5 minutes'
GROUP BY event_type
ORDER BY total DESC;

-- ============================================================================
-- 4. PROCESSING LATENCY PERCENTILES
-- ============================================================================
-- Distribution of processing times (overall)

SELECT
    'Overall Latency' AS metric,
    COUNT(*) FILTER (WHERE processing_time IS NOT NULL) AS measured_events,
    ROUND(AVG(processing_time)) AS avg_ms,
    ROUND(MIN(processing_time)) AS min_ms,
    ROUND(
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY processing_time)
    ) AS p50_ms,
    ROUND(
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY processing_time)
    ) AS p75_ms,
    ROUND(
        PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY processing_time)
    ) AS p90_ms,
    ROUND(
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time)
    ) AS p95_ms,
    ROUND(
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY processing_time)
    ) AS p99_ms,
    ROUND(MAX(processing_time)) AS max_ms
FROM webhook_events
WHERE received_at > NOW() - INTERVAL '5 minutes'
    AND status = 'SUCCESS';

-- ============================================================================
-- 5. ERROR ANALYSIS
-- ============================================================================
-- What's failing and why?

SELECT
    error_code,
    COUNT(*) AS occurrences,
    ARRAY_AGG(DISTINCT event_type) AS affected_event_types,
    LEFT(error_message, 100) AS error_preview,
    MIN(received_at) AS first_occurrence,
    MAX(received_at) AS last_occurrence
FROM webhook_events
WHERE status IN ('FAILED', 'ERROR')
    AND received_at > NOW() - INTERVAL '30 minutes'
GROUP BY error_code, LEFT(error_message, 100)
ORDER BY occurrences DESC
LIMIT 10;

-- ============================================================================
-- 6. STUCK EVENTS
-- ============================================================================
-- Events that have been processing too long

SELECT
    id,
    event_type,
    status,
    received_at,
    EXTRACT(EPOCH FROM (NOW() - received_at)) AS age_seconds,
    session_id,
    request_id,
    retry_count
FROM webhook_events
WHERE status = 'PROCESSING'
    AND received_at < NOW() - INTERVAL '5 minutes'
ORDER BY received_at ASC
LIMIT 20;

-- ============================================================================
-- 7. RETRY PATTERNS
-- ============================================================================
-- Events requiring retries

SELECT
    event_type,
    retry_count,
    COUNT(*) AS events,
    ROUND(AVG(processing_time)) AS avg_processing_ms,
    COUNT(*) FILTER (WHERE status = 'SUCCESS') AS eventually_succeeded,
    COUNT(*) FILTER (WHERE status = 'FAILED') AS ultimately_failed
FROM webhook_events
WHERE retry_count > 0
    AND received_at > NOW() - INTERVAL '30 minutes'
GROUP BY event_type, retry_count
ORDER BY event_type, retry_count;

-- ============================================================================
-- 8. DUPLICATE DETECTION
-- ============================================================================
-- How many duplicates are being caught?

SELECT
    'Duplicate Detection' AS metric,
    COUNT(*) FILTER (WHERE status = 'DUPLICATE') AS total_duplicates,
    COUNT(DISTINCT request_id) FILTER (WHERE status = 'DUPLICATE') AS unique_request_ids,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE status = 'DUPLICATE') / NULLIF(COUNT(*), 0),
        2
    ) AS duplicate_rate_pct,
    ARRAY_AGG(DISTINCT event_type) FILTER (WHERE status = 'DUPLICATE') AS duplicate_event_types
FROM webhook_events
WHERE received_at > NOW() - INTERVAL '30 minutes';

-- ============================================================================
-- 9. SESSION ACTIVITY
-- ============================================================================
-- Which sessions are most active?

SELECT
    session_id,
    COUNT(*) AS total_events,
    COUNT(DISTINCT event_type) AS unique_event_types,
    ARRAY_AGG(DISTINCT event_type ORDER BY event_type) AS event_types,
    MIN(received_at) AS first_event,
    MAX(received_at) AS last_event,
    EXTRACT(EPOCH FROM (MAX(received_at) - MIN(received_at))) AS session_duration_seconds,
    COUNT(*) FILTER (WHERE status = 'SUCCESS') AS successful_events,
    COUNT(*) FILTER (WHERE status IN ('FAILED', 'ERROR')) AS failed_events
FROM webhook_events
WHERE received_at > NOW() - INTERVAL '30 minutes'
    AND session_id IS NOT NULL
GROUP BY session_id
ORDER BY total_events DESC
LIMIT 10;

-- ============================================================================
-- 10. OUTCOME TRACKING
-- ============================================================================
-- Are webhooks creating the expected database records?

SELECT
    event_type,
    COUNT(*) AS total_events,
    COUNT(conversation_id) AS created_conversations,
    COUNT(message_id) AS created_messages,
    COUNT(tool_use_id) AS created_tool_uses,
    ROUND(
        100.0 * COUNT(conversation_id) / NULLIF(COUNT(*), 0),
        2
    ) AS conversation_creation_rate_pct
FROM webhook_events
WHERE received_at > NOW() - INTERVAL '5 minutes'
    AND status = 'SUCCESS'
GROUP BY event_type
ORDER BY total_events DESC;

-- ============================================================================
-- 11. DATABASE PERFORMANCE IMPACT
-- ============================================================================
-- How is webhook processing affecting database performance?

SELECT
    'Database Performance' AS metric,
    (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') AS active_queries,
    (SELECT COUNT(*) FROM pg_stat_activity WHERE wait_event_type IS NOT NULL) AS waiting_queries,
    (SELECT MAX(EXTRACT(EPOCH FROM (NOW() - query_start)))
     FROM pg_stat_activity
     WHERE state = 'active') AS longest_query_seconds,
    (SELECT numbackends FROM pg_stat_database WHERE datname = current_database()) AS total_connections;

-- ============================================================================
-- 12. RECENT INDEX USAGE
-- ============================================================================
-- Are our indexes being used effectively?

SELECT
    indexrelname AS index_name,
    idx_scan AS scans_since_last_check,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND relname = 'webhook_events'
ORDER BY idx_scan DESC;

-- ============================================================================
-- REAL-TIME MONITORING COMPLETE
-- ============================================================================
-- Metrics to watch:
-- 1. Success rate should be > 95%
-- 2. P95 latency should be < 500ms
-- 3. No stuck events (processing > 5 minutes)
-- 4. Error rate should be < 5%
-- 5. Duplicate detection should catch any retries
-- ============================================================================
