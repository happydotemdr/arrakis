-- ============================================================================
-- DIAGNOSTIC QUERIES - Troubleshooting and deep analysis
-- ============================================================================
-- Purpose: Deep dive into issues when health checks fail
-- Runtime: ~1-5 seconds (more detailed analysis)
-- Usage: Run when investigating specific problems
-- ============================================================================

\timing on
\x auto

-- ============================================================================
-- SECTION 1: ERROR ANALYSIS
-- ============================================================================

-- 1.1 ERROR DISTRIBUTION BY TYPE
-- What types of errors are occurring?

SELECT
    event_type,
    error_code,
    status,
    COUNT(*) AS occurrences,
    ROUND(AVG(retry_count)) AS avg_retries,
    MIN(received_at) AS first_seen,
    MAX(received_at) AS last_seen,
    EXTRACT(EPOCH FROM (MAX(received_at) - MIN(received_at))) / 3600 AS duration_hours
FROM webhook_events
WHERE status IN ('FAILED', 'ERROR')
    AND received_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type, error_code, status
ORDER BY occurrences DESC;

-- 1.2 DETAILED ERROR MESSAGES
-- Show full error context for recent failures

SELECT
    id,
    event_type,
    status,
    received_at,
    error_code,
    error_message,
    LEFT(error_stack, 200) AS error_stack_preview,
    retry_count,
    request_id,
    session_id
FROM webhook_events
WHERE status IN ('FAILED', 'ERROR')
    AND received_at > NOW() - INTERVAL '1 hour'
ORDER BY received_at DESC
LIMIT 20;

-- 1.3 ERROR PATTERNS BY TIME
-- When do errors occur? (hourly breakdown)

SELECT
    date_trunc('hour', received_at) AS hour,
    COUNT(*) AS total_events,
    COUNT(*) FILTER (WHERE status IN ('FAILED', 'ERROR')) AS errors,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE status IN ('FAILED', 'ERROR')) / NULLIF(COUNT(*), 0),
        2
    ) AS error_rate_pct,
    ARRAY_AGG(DISTINCT error_code) FILTER (WHERE status IN ('FAILED', 'ERROR')) AS error_codes
FROM webhook_events
WHERE received_at > NOW() - INTERVAL '24 hours'
GROUP BY date_trunc('hour', received_at)
ORDER BY hour DESC;

-- 1.4 ERROR CORRELATION WITH IP ADDRESSES
-- Are errors coming from specific sources?

SELECT
    ip_address,
    COUNT(*) AS total_requests,
    COUNT(*) FILTER (WHERE status IN ('FAILED', 'ERROR')) AS errors,
    COUNT(*) FILTER (WHERE status = 'SUCCESS') AS successes,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE status IN ('FAILED', 'ERROR')) / NULLIF(COUNT(*), 0),
        2
    ) AS error_rate_pct,
    ARRAY_AGG(DISTINCT event_type) AS event_types
FROM webhook_events
WHERE received_at > NOW() - INTERVAL '6 hours'
GROUP BY ip_address
HAVING COUNT(*) FILTER (WHERE status IN ('FAILED', 'ERROR')) > 0
ORDER BY error_rate_pct DESC
LIMIT 20;

-- ============================================================================
-- SECTION 2: STUCK/HANGING EVENTS
-- ============================================================================

-- 2.1 EVENTS STUCK IN PROCESSING
-- Find events that have been processing too long

SELECT
    id,
    event_type,
    status,
    received_at,
    NOW() - received_at AS stuck_duration,
    EXTRACT(EPOCH FROM (NOW() - received_at)) AS stuck_seconds,
    session_id,
    request_id,
    retry_count,
    CASE
        WHEN NOW() - received_at > INTERVAL '30 minutes' THEN 'CRITICAL'
        WHEN NOW() - received_at > INTERVAL '10 minutes' THEN 'WARNING'
        ELSE 'ATTENTION'
    END AS severity
FROM webhook_events
WHERE status = 'PROCESSING'
    AND received_at < NOW() - INTERVAL '2 minutes'
ORDER BY received_at ASC;

-- 2.2 PENDING EVENTS ANALYSIS
-- Events waiting to be processed

SELECT
    event_type,
    COUNT(*) AS pending_count,
    MIN(received_at) AS oldest_pending,
    MAX(received_at) AS newest_pending,
    AVG(EXTRACT(EPOCH FROM (NOW() - received_at))) AS avg_age_seconds,
    MAX(EXTRACT(EPOCH FROM (NOW() - received_at))) AS max_age_seconds
FROM webhook_events
WHERE status = 'PENDING'
GROUP BY event_type
ORDER BY pending_count DESC;

-- 2.3 RETRY QUEUE ANALYSIS
-- Events scheduled for retry

SELECT
    event_type,
    retry_count,
    COUNT(*) AS events_waiting,
    MIN(retry_after) AS next_retry_time,
    MAX(retry_after) AS last_retry_time,
    AVG(EXTRACT(EPOCH FROM (retry_after - NOW()))) AS avg_wait_seconds
FROM webhook_events
WHERE status = 'PENDING_RETRY'
    AND retry_after IS NOT NULL
GROUP BY event_type, retry_count
ORDER BY event_type, retry_count;

-- ============================================================================
-- SECTION 3: DUPLICATE DETECTION
-- ============================================================================

-- 3.1 DUPLICATE REQUESTS ANALYSIS
-- Which requests are being duplicated?

SELECT
    request_id,
    event_type,
    COUNT(*) AS duplicate_count,
    MIN(received_at) AS first_received,
    MAX(received_at) AS last_received,
    ARRAY_AGG(status ORDER BY received_at) AS status_progression,
    ARRAY_AGG(id ORDER BY received_at) AS event_ids
FROM webhook_events
WHERE request_id IS NOT NULL
    AND received_at > NOW() - INTERVAL '24 hours'
GROUP BY request_id, event_type
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 50;

-- 3.2 DUPLICATE PATTERNS BY SOURCE
-- Are certain sources sending more duplicates?

SELECT
    ip_address,
    event_type,
    COUNT(DISTINCT request_id) AS unique_requests,
    COUNT(*) AS total_requests,
    COUNT(*) - COUNT(DISTINCT request_id) AS duplicate_requests,
    ROUND(
        100.0 * (COUNT(*) - COUNT(DISTINCT request_id)) / NULLIF(COUNT(*), 0),
        2
    ) AS duplicate_rate_pct
FROM webhook_events
WHERE received_at > NOW() - INTERVAL '6 hours'
    AND request_id IS NOT NULL
GROUP BY ip_address, event_type
HAVING COUNT(*) > COUNT(DISTINCT request_id)
ORDER BY duplicate_rate_pct DESC;

-- ============================================================================
-- SECTION 4: SLOW PROCESSING EVENTS
-- ============================================================================

-- 4.1 SLOWEST EVENTS
-- Which events took the longest to process?

SELECT
    id,
    event_type,
    status,
    processing_time AS processing_ms,
    ROUND(processing_time / 1000.0, 2) AS processing_seconds,
    received_at,
    processed_at,
    session_id,
    CASE
        WHEN processing_time > 10000 THEN 'VERY_SLOW'
        WHEN processing_time > 5000 THEN 'SLOW'
        WHEN processing_time > 1000 THEN 'MODERATE'
        ELSE 'FAST'
    END AS performance_tier
FROM webhook_events
WHERE processing_time IS NOT NULL
    AND received_at > NOW() - INTERVAL '6 hours'
ORDER BY processing_time DESC
LIMIT 50;

-- 4.2 PROCESSING TIME BY EVENT TYPE
-- Which event types are slowest?

SELECT
    event_type,
    COUNT(*) AS total_processed,
    ROUND(AVG(processing_time)) AS avg_ms,
    ROUND(STDDEV(processing_time)) AS stddev_ms,
    MIN(processing_time) AS min_ms,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY processing_time)) AS p50_ms,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY processing_time)) AS p90_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time)) AS p95_ms,
    ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY processing_time)) AS p99_ms,
    MAX(processing_time) AS max_ms,
    COUNT(*) FILTER (WHERE processing_time > 5000) AS slow_events_over_5s
FROM webhook_events
WHERE processing_time IS NOT NULL
    AND received_at > NOW() - INTERVAL '6 hours'
GROUP BY event_type
ORDER BY avg_ms DESC;

-- 4.3 PROCESSING TIME TRENDS
-- Is processing getting slower over time?

SELECT
    date_trunc('hour', received_at) AS hour,
    event_type,
    COUNT(*) AS processed,
    ROUND(AVG(processing_time)) AS avg_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time)) AS p95_ms,
    MAX(processing_time) AS max_ms
FROM webhook_events
WHERE processing_time IS NOT NULL
    AND received_at > NOW() - INTERVAL '24 hours'
GROUP BY date_trunc('hour', received_at), event_type
ORDER BY hour DESC, event_type;

-- ============================================================================
-- SECTION 5: DATA QUALITY ISSUES
-- ============================================================================

-- 5.1 MISSING REQUIRED FIELDS
-- Events with incomplete data

SELECT
    'Missing Fields Analysis' AS check_type,
    COUNT(*) AS total_events,
    COUNT(*) FILTER (WHERE event_type IS NULL OR event_type = '') AS missing_event_type,
    COUNT(*) FILTER (WHERE session_id IS NULL) AS missing_session_id,
    COUNT(*) FILTER (WHERE request_id IS NULL) AS missing_request_id,
    COUNT(*) FILTER (WHERE request_body IS NULL) AS missing_request_body,
    COUNT(*) FILTER (WHERE ip_address IS NULL) AS missing_ip_address
FROM webhook_events
WHERE received_at > NOW() - INTERVAL '24 hours';

-- 5.2 MALFORMED JSON PAYLOADS
-- Check for potential JSON issues (if there are validation errors)

SELECT
    id,
    event_type,
    status,
    error_code,
    error_message,
    received_at
FROM webhook_events
WHERE (error_message ILIKE '%json%' OR error_message ILIKE '%parse%')
    AND received_at > NOW() - INTERVAL '24 hours'
ORDER BY received_at DESC
LIMIT 20;

-- 5.3 ORPHANED RECORDS
-- Webhook events that should have created conversations but didn't

SELECT
    event_type,
    COUNT(*) AS total_events,
    COUNT(conversation_id) AS with_conversation,
    COUNT(*) - COUNT(conversation_id) AS orphaned,
    ROUND(
        100.0 * (COUNT(*) - COUNT(conversation_id)) / NULLIF(COUNT(*), 0),
        2
    ) AS orphan_rate_pct
FROM webhook_events
WHERE status = 'SUCCESS'
    AND received_at > NOW() - INTERVAL '6 hours'
    AND event_type IN ('SessionStart', 'UserPromptSubmit')  -- Events that should create records
GROUP BY event_type
ORDER BY orphan_rate_pct DESC;

-- 5.4 TIME DRIFT ANALYSIS
-- Check for events with unusual timestamps

SELECT
    id,
    event_type,
    received_at,
    processed_at,
    processed_at - received_at AS processing_duration,
    created_at,
    updated_at,
    CASE
        WHEN received_at > NOW() THEN 'FUTURE_TIMESTAMP'
        WHEN received_at < NOW() - INTERVAL '1 hour' AND status = 'PENDING' THEN 'OLD_PENDING'
        WHEN processed_at < received_at THEN 'TIME_PARADOX'
        WHEN processed_at - received_at > INTERVAL '10 minutes' THEN 'VERY_SLOW'
        ELSE 'NORMAL'
    END AS time_anomaly
FROM webhook_events
WHERE received_at > NOW() - INTERVAL '24 hours'
    AND (
        received_at > NOW()
        OR (received_at < NOW() - INTERVAL '1 hour' AND status = 'PENDING')
        OR processed_at < received_at
        OR processed_at - received_at > INTERVAL '10 minutes'
    )
ORDER BY received_at DESC
LIMIT 50;

-- ============================================================================
-- SECTION 6: PERFORMANCE BOTTLENECKS
-- ============================================================================

-- 6.1 LOCK CONTENTION
-- Check for blocking queries

SELECT
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS blocking_statement,
    NOW() - blocked_activity.query_start AS blocked_duration
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- 6.2 LONG-RUNNING QUERIES
-- Queries that have been running for a long time

SELECT
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query_start,
    NOW() - query_start AS runtime,
    wait_event_type,
    wait_event,
    LEFT(query, 200) AS query_preview
FROM pg_stat_activity
WHERE state = 'active'
    AND query NOT LIKE '%pg_stat_activity%'
    AND NOW() - query_start > INTERVAL '10 seconds'
ORDER BY runtime DESC;

-- 6.3 TABLE BLOAT ANALYSIS
-- Check for table bloat that might slow queries

SELECT
    schemaname,
    tablename,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows,
    ROUND(
        100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0),
        2
    ) AS dead_row_pct,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    last_vacuum,
    last_autovacuum,
    CASE
        WHEN n_dead_tup > n_live_tup * 0.2 THEN 'NEEDS_VACUUM'
        WHEN n_dead_tup > n_live_tup * 0.1 THEN 'CONSIDER_VACUUM'
        ELSE 'OK'
    END AS bloat_status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY dead_row_pct DESC NULLS LAST;

-- 6.4 INDEX EFFICIENCY
-- Are indexes being used effectively?

SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan AS scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    CASE
        WHEN idx_scan = 0 THEN 'NEVER_USED'
        WHEN idx_scan < 10 THEN 'RARELY_USED'
        WHEN idx_tup_read = 0 THEN 'FETCH_ONLY'
        WHEN idx_tup_fetch * 1.0 / NULLIF(idx_tup_read, 0) < 0.1 THEN 'LOW_EFFICIENCY'
        ELSE 'GOOD'
    END AS efficiency_status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY tablename, idx_scan DESC;

-- ============================================================================
-- SECTION 7: SESSION ANALYSIS
-- ============================================================================

-- 7.1 SESSION HEALTH
-- Analyze individual session behavior

SELECT
    session_id,
    COUNT(*) AS total_events,
    COUNT(DISTINCT event_type) AS unique_event_types,
    MIN(received_at) AS session_start,
    MAX(received_at) AS session_end,
    EXTRACT(EPOCH FROM (MAX(received_at) - MIN(received_at))) AS duration_seconds,
    COUNT(*) FILTER (WHERE status = 'SUCCESS') AS successful,
    COUNT(*) FILTER (WHERE status IN ('FAILED', 'ERROR')) AS failed,
    COUNT(*) FILTER (WHERE status = 'DUPLICATE') AS duplicates,
    ROUND(AVG(processing_time)) AS avg_processing_ms,
    ARRAY_AGG(DISTINCT error_code) FILTER (WHERE error_code IS NOT NULL) AS error_codes
FROM webhook_events
WHERE session_id IS NOT NULL
    AND received_at > NOW() - INTERVAL '6 hours'
GROUP BY session_id
ORDER BY failed DESC, total_events DESC
LIMIT 50;

-- ============================================================================
-- DIAGNOSTIC QUERIES COMPLETE
-- ============================================================================
-- Use these queries to investigate:
-- 1. Error patterns and root causes
-- 2. Stuck or slow processing events
-- 3. Duplicate detection effectiveness
-- 4. Data quality issues
-- 5. Database performance bottlenecks
-- 6. Session-level problems
-- ============================================================================
