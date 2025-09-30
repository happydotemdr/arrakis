# Quick Reference Guide

One-page reference for common database monitoring commands.

**System Status**: ✅ **OPERATIONAL** (Activated September 30, 2025, 11:30 AM PT)
**Current State**: All 6 event hooks active and capturing webhooks

## Connection Strings

```bash
# Pooled connection (for app)
DATABASE_URL="postgresql://...?pgbouncer=true"

# Direct connection (for admin queries)
DIRECT_URL="postgresql://..."
```

## Essential Commands

### Post-Activation (Current State)

```bash
# Check current metrics (webhooks now firing!)
psql $DIRECT_URL -f 01-baseline-metrics.sql

# Verify webhooks being captured
psql $DIRECT_URL -c "SELECT COUNT(*) FROM webhook_events WHERE received_at > NOW() - INTERVAL '1 hour';"
```

### Real-Time Monitoring

```bash
# Continuous monitoring (every 5 seconds)
watch -n 5 'psql $DIRECT_URL -f 02-realtime-monitoring.sql'

# Single snapshot
psql $DIRECT_URL -f 02-realtime-monitoring.sql
```

### Health Checks

```bash
# Quick health check
psql $DIRECT_URL -f 03-health-check.sql

# Check for stuck events
psql $DIRECT_URL -c "
  SELECT COUNT(*) FROM webhook_events
  WHERE status = 'PROCESSING'
    AND received_at < NOW() - INTERVAL '5 minutes';
"

# Check success rate (last 5 minutes)
psql $DIRECT_URL -c "
  SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'SUCCESS') as success,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'SUCCESS') / COUNT(*), 2) as success_rate
  FROM webhook_events
  WHERE received_at > NOW() - INTERVAL '5 minutes';
"
```

### Diagnostics

```bash
# Full diagnostic report
psql $DIRECT_URL -f 04-diagnostics.sql > diagnostics.txt

# Find errors
psql $DIRECT_URL -c "
  SELECT error_code, COUNT(*) as count, error_message
  FROM webhook_events
  WHERE status IN ('FAILED', 'ERROR')
    AND received_at > NOW() - INTERVAL '1 hour'
  GROUP BY error_code, error_message
  ORDER BY count DESC;
"

# Find slow events
psql $DIRECT_URL -c "
  SELECT event_type, processing_time, received_at
  FROM webhook_events
  WHERE processing_time > 1000
  ORDER BY processing_time DESC
  LIMIT 20;
"
```

### Index Analysis

```bash
# Full index analysis
psql $DIRECT_URL -f 05-index-analysis.sql > indexes.txt

# Check index usage
psql $DIRECT_URL -c "
  SELECT indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid))
  FROM pg_stat_user_indexes
  WHERE relname = 'webhook_events'
  ORDER BY idx_scan DESC;
"
```

### Maintenance

```bash
# Vacuum analyze
psql $DIRECT_URL -c "VACUUM ANALYZE webhook_events;"

# Check if vacuum needed
psql $DIRECT_URL -c "
  SELECT
    n_dead_tup,
    n_live_tup,
    ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup, 0), 2) as dead_pct
  FROM pg_stat_user_tables
  WHERE relname = 'webhook_events';
"

# Reindex (use CONCURRENTLY in production)
psql $DIRECT_URL -c "REINDEX TABLE CONCURRENTLY webhook_events;"
```

## One-Liner Checks

```bash
# Total events
psql $DIRECT_URL -t -c "SELECT COUNT(*) FROM webhook_events;"

# Events last hour
psql $DIRECT_URL -t -c "
  SELECT COUNT(*) FROM webhook_events
  WHERE received_at > NOW() - INTERVAL '1 hour';
"

# Current success rate
psql $DIRECT_URL -t -c "
  SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'SUCCESS') / COUNT(*), 2)
  FROM webhook_events
  WHERE received_at > NOW() - INTERVAL '5 minutes';
"

# Stuck event count
psql $DIRECT_URL -t -c "
  SELECT COUNT(*) FROM webhook_events
  WHERE status = 'PROCESSING'
    AND received_at < NOW() - INTERVAL '5 minutes';
"

# Database size
psql $DIRECT_URL -t -c "
  SELECT pg_size_pretty(pg_database_size(current_database()));
"

# Active connections
psql $DIRECT_URL -t -c "
  SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active';
"
```

## Emergency Commands

### Force Vacuum

```bash
# Standard vacuum (safe)
psql $DIRECT_URL -c "VACUUM VERBOSE webhook_events;"

# Vacuum full (LOCKS TABLE - avoid in production)
# psql $DIRECT_URL -c "VACUUM FULL webhook_events;"
```

### Kill Stuck Connections

```bash
# List stuck connections
psql $DIRECT_URL -c "
  SELECT pid, usename, state, NOW() - state_change as duration
  FROM pg_stat_activity
  WHERE state = 'idle in transaction'
    AND NOW() - state_change > INTERVAL '10 minutes';
"

# Kill specific connection (replace 12345 with actual PID)
# psql $DIRECT_URL -c "SELECT pg_terminate_backend(12345);"
```

### Reset Stuck Events

```bash
# Count stuck events
psql $DIRECT_URL -c "
  SELECT COUNT(*) FROM webhook_events
  WHERE status = 'PROCESSING'
    AND received_at < NOW() - INTERVAL '10 minutes';
"

# Reset stuck events to FAILED
psql $DIRECT_URL -c "
  UPDATE webhook_events
  SET status = 'FAILED',
      error_message = 'Processing timeout - manually reset'
  WHERE status = 'PROCESSING'
    AND received_at < NOW() - INTERVAL '10 minutes';
"
```

## Monitoring Loops

### Watch Success Rate

```bash
watch -n 5 "psql $DIRECT_URL -t -c \"
  SELECT
    NOW() as time,
    COUNT(*) as events,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'SUCCESS') / COUNT(*), 1) as success_pct,
    ROUND(AVG(processing_time)) as avg_ms
  FROM webhook_events
  WHERE received_at > NOW() - INTERVAL '1 minute';
\""
```

### Watch Health Score

```bash
watch -n 10 "psql $DIRECT_URL -t -c \"
  SELECT
    CASE
      WHEN (SELECT COUNT(*) FROM webhook_events
            WHERE status = 'PROCESSING'
            AND received_at < NOW() - INTERVAL '5 minutes') > 0
      THEN 'CRITICAL'
      WHEN (SELECT COUNT(*) FROM webhook_events
            WHERE status IN ('FAILED', 'ERROR')
            AND received_at > NOW() - INTERVAL '1 hour') > 10
      THEN 'WARNING'
      ELSE 'HEALTHY'
    END as status;
\""
```

### Watch Events Per Minute

```bash
watch -n 5 "psql $DIRECT_URL -t -c \"
  SELECT
    date_trunc('minute', received_at) as minute,
    COUNT(*) as events,
    COUNT(*) FILTER (WHERE status = 'SUCCESS') as success
  FROM webhook_events
  WHERE received_at > NOW() - INTERVAL '5 minutes'
  GROUP BY 1
  ORDER BY 1 DESC;
\""
```

## Render-Specific Commands

### Using Render MCP (if available)

```bash
# List databases
render list-databases

# Run query via MCP
render query --service-id tea-d303qfodl3ps739p3e60 --query "SELECT COUNT(*) FROM webhook_events"

# Export metrics
render export-metrics --service-id tea-d303qfodl3ps739p3e60
```

## Alert Thresholds

```text
Success Rate:
  < 95% = WARNING
  < 90% = CRITICAL

P95 Latency:
  > 500ms = WARNING
  > 1000ms = CRITICAL

Stuck Events:
  > 0 = WARNING
  > 5 = CRITICAL

Error Rate:
  > 5% = WARNING
  > 10% = CRITICAL

Dead Rows:
  > 10% = WARNING
  > 20% = NEEDS VACUUM

Active Connections:
  > 50 = WARNING
  > 80 = CRITICAL
```

## Maintenance Schedule

```text
Every 30 seconds:  Health check
Every 5 minutes:   Real-time monitoring
Every hour:        Error analysis
Daily:             Vacuum check, error trends
Weekly:            VACUUM ANALYZE, index review
Monthly:           REINDEX, archive old data
Quarterly:         Optimization review
```

## Common Query Patterns

### Events by Type

```sql
SELECT event_type, COUNT(*), AVG(processing_time)
FROM webhook_events
WHERE received_at > NOW() - INTERVAL '1 hour'
GROUP BY event_type
ORDER BY COUNT(*) DESC;
```

### Latency Percentiles

```sql
SELECT
  ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY processing_time)) as p50,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time)) as p95,
  ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY processing_time)) as p99
FROM webhook_events
WHERE received_at > NOW() - INTERVAL '1 hour'
  AND status = 'SUCCESS';
```

### Error Distribution

```sql
SELECT error_code, COUNT(*), MAX(received_at)
FROM webhook_events
WHERE status IN ('FAILED', 'ERROR')
  AND received_at > NOW() - INTERVAL '24 hours'
GROUP BY error_code
ORDER BY COUNT(*) DESC;
```

### Session Activity

```sql
SELECT session_id, COUNT(*), MIN(received_at), MAX(received_at)
FROM webhook_events
WHERE received_at > NOW() - INTERVAL '1 hour'
GROUP BY session_id
ORDER BY COUNT(*) DESC
LIMIT 10;
```

## File Reference

- **01-baseline-metrics.sql**: Pre-activation snapshot
- **02-realtime-monitoring.sql**: Live performance monitoring
- **03-health-check.sql**: Fast health verification
- **04-diagnostics.sql**: Deep troubleshooting
- **05-index-analysis.sql**: Index optimization
- **06-maintenance-plan.sql**: Maintenance procedures

## Tips

1. Always use DIRECT_URL for admin queries (bypasses PgBouncer)
2. Use DATABASE_URL for application connections (pooled)
3. Run health checks frequently, diagnostics only when needed
4. Capture baseline BEFORE any major changes
5. Use CONCURRENTLY for production reindexing
6. Test destructive commands on non-production first
7. Document all manual interventions
8. Set up automated alerting for critical metrics
9. Archive old data before deleting
10. Monitor trends, not just point-in-time metrics
