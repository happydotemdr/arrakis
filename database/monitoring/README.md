# Database Monitoring & Optimization Suite

Comprehensive PostgreSQL monitoring and optimization toolkit for the Arrakis
webhook system.

## Overview

This suite provides production-ready SQL queries for monitoring, diagnosing,
and maintaining your PostgreSQL database during and after webhook activation.

## File Structure

```text
database/monitoring/
├── 01-baseline-metrics.sql      # Pre-activation baseline
├── 02-realtime-monitoring.sql   # Live monitoring during activation
├── 03-health-check.sql          # Fast health verification (<100ms)
├── 04-diagnostics.sql           # Deep troubleshooting
├── 05-index-analysis.sql        # Index optimization
├── 06-maintenance-plan.sql      # Maintenance procedures
├── README.md                    # This file
└── quick-reference.md           # Command cheatsheet
```

## Quick Start

### 1. Pre-Activation Baseline

Run BEFORE webhook activation to capture baseline metrics:

```bash
psql $DIRECT_URL -f 01-baseline-metrics.sql > baseline-report.txt
```

Save the output for comparison.

### 2. Real-Time Monitoring

Run DURING activation to monitor performance:

```bash
# Single run
psql $DIRECT_URL -f 02-realtime-monitoring.sql

# Continuous monitoring (every 5 seconds)
watch -n 5 'psql $DIRECT_URL -f 02-realtime-monitoring.sql'
```

### 3. Health Checks

Run continuously for alerting:

```bash
# Via cron (every minute)
* * * * * psql $DIRECT_URL -f 03-health-check.sql | grep -E 'CRITICAL|WARNING'
```

### 4. Diagnostics

Run when issues are detected:

```bash
psql $DIRECT_URL -f 04-diagnostics.sql > diagnostic-report.txt
```

### 5. Index Analysis

Run after 24-48 hours of production traffic:

```bash
psql $DIRECT_URL -f 05-index-analysis.sql > index-report.txt
```

### 6. Maintenance

Run on schedule:

```bash
# Weekly vacuum
psql $DIRECT_URL -c "VACUUM ANALYZE webhook_events;"

# Monthly reindex
psql $DIRECT_URL -c "REINDEX TABLE CONCURRENTLY webhook_events;"
```

## Using with Render MCP Tools

If you have Render MCP tools available, you can run queries directly:

```javascript
// Example: Run health check
const result = await render.runQuery({
  serviceId: 'your-postgres-service-id',
  query: fs.readFileSync('03-health-check.sql', 'utf8')
});
```

## Key Metrics to Monitor

### Critical Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| Success Rate | < 95% | Investigate errors immediately |
| P95 Latency | > 500ms | Check slow queries |
| Stuck Events | > 0 | Check processing pipeline |
| Error Rate | > 5% | Review error logs |
| Dead Rows | > 20% | Run VACUUM |
| Connection Count | > 50 | Check connection pool |

### Health Score Interpretation

- **100**: All systems healthy
- **75**: Warning - increased errors or latency
- **50**: Degraded - stuck events or high error rate
- **0**: Critical - immediate attention required

## Monitoring Workflow

### Phase 1: Pre-Activation (T-1 hour)

1. Run baseline metrics
2. Verify all tables are healthy
3. Check index usage
4. Document current state

### Phase 2: Activation (T+0 to T+1 hour)

1. Start continuous monitoring
2. Watch success rate every 30 seconds
3. Monitor for stuck events
4. Track processing latency

### Phase 3: Post-Activation (T+1 hour to T+24 hours)

1. Run health checks every minute
2. Review error patterns hourly
3. Check index usage after 24 hours
4. Optimize based on actual usage

### Phase 4: Steady State (T+24 hours+)

1. Daily health checks
2. Weekly maintenance
3. Monthly optimization
4. Quarterly planning

## Common Issues & Solutions

### Issue: Stuck Events

**Symptom**: Events in PROCESSING state for > 5 minutes

**Diagnosis**:

```bash
psql $DIRECT_URL -f 04-diagnostics.sql | grep -A 20 "STUCK IN PROCESSING"
```

**Solution**:

- Check application logs for crashes
- Verify webhook processor is running
- Consider manually updating stuck events:

```sql
UPDATE webhook_events
SET status = 'FAILED', error_message = 'Processing timeout'
WHERE status = 'PROCESSING'
  AND received_at < NOW() - INTERVAL '10 minutes';
```

### Issue: High Error Rate

**Symptom**: Error rate > 5%

**Diagnosis**:

```bash
psql $DIRECT_URL -f 04-diagnostics.sql | grep -A 30 "ERROR DISTRIBUTION"
```

**Solution**:

- Group errors by error_code
- Fix application bugs
- Add retry logic if needed

### Issue: Slow Processing

**Symptom**: P95 latency > 500ms

**Diagnosis**:

```bash
psql $DIRECT_URL -f 04-diagnostics.sql | grep -A 50 "SLOWEST EVENTS"
```

**Solution**:

- Optimize slow queries
- Add missing indexes
- Consider batch processing

### Issue: Database Bloat

**Symptom**: Dead rows > 20%

**Diagnosis**:

```bash
psql $DIRECT_URL -f 06-maintenance-plan.sql | grep -A 10 "VACUUM_NEEDED"
```

**Solution**:

```bash
psql $DIRECT_URL -c "VACUUM ANALYZE webhook_events;"
```

## Performance Optimization

### Index Optimization

After 24-48 hours of traffic:

1. Run index analysis:

```bash
psql $DIRECT_URL -f 05-index-analysis.sql
```

2. Drop unused indexes:

```sql
-- Example: Drop if never used after 1 week
DROP INDEX IF EXISTS idx_unused_index;
```

3. Add missing indexes based on query patterns:

```sql
-- Example: Add partial index for pending events
CREATE INDEX CONCURRENTLY idx_webhook_events_pending
ON webhook_events (received_at)
WHERE status = 'PENDING';
```

### Query Optimization

Enable pg_stat_statements for query analysis:

```sql
-- On database (requires superuser)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Then analyze slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query ILIKE '%webhook_events%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Connection Pool Tuning

For high-traffic scenarios:

```javascript
// Optimize pool settings
const pool = new Pool({
  max: 20,              // Increase if needed
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  keepAlive: true
});
```

## Maintenance Schedule

### Daily

- Run health checks
- Monitor error rates
- Check for stuck events

### Weekly

- VACUUM ANALYZE tables
- Review index usage
- Check table bloat
- Analyze slow queries

### Monthly

- REINDEX high-traffic indexes
- Archive old webhook events
- Review capacity trends
- Optimize based on usage patterns

### Quarterly

- Review data retention policy
- Update monitoring thresholds
- Capacity planning
- Performance baseline comparison

## Alerting Setup

### Health Check Integration

Set up automated alerting:

```bash
#!/bin/bash
# health-check.sh

HEALTH_SCORE=$(psql $DIRECT_URL -t -c "
  SELECT health_score
  FROM (
    SELECT CASE
      WHEN (SELECT COUNT(*) FROM webhook_events
            WHERE status = 'PROCESSING'
            AND received_at < NOW() - INTERVAL '5 minutes') > 0
      THEN 0
      ELSE 100
    END AS health_score
  ) sub;
")

if [ "$HEALTH_SCORE" -lt 75 ]; then
  echo "ALERT: Health score is $HEALTH_SCORE"
  # Send alert (Slack, PagerDuty, etc.)
fi
```

### Monitoring Integration

Export metrics to monitoring systems:

```javascript
// Example: Export to Prometheus
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DIRECT_URL });

async function collectMetrics() {
  const result = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'SUCCESS') AS success_count,
      COUNT(*) FILTER (WHERE status = 'FAILED') AS failed_count,
      AVG(processing_time) AS avg_processing_time
    FROM webhook_events
    WHERE received_at > NOW() - INTERVAL '5 minutes'
  `);

  return result.rows[0];
}
```

## Troubleshooting Guide

### Database Not Responding

1. Check connection count:

```sql
SELECT COUNT(*) FROM pg_stat_activity;
```

2. Check for blocking queries:

```bash
psql $DIRECT_URL -f 04-diagnostics.sql | grep -A 20 "LOCK CONTENTION"
```

3. Kill stuck connections if necessary (CAREFUL!):

```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND NOW() - state_change > INTERVAL '30 minutes';
```

### High CPU Usage

1. Check active queries:

```sql
SELECT pid, query, NOW() - query_start AS duration
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC;
```

2. Check for missing indexes:

```bash
psql $DIRECT_URL -f 05-index-analysis.sql | grep "MISSING INDEX"
```

### Disk Space Issues

1. Check database size:

```sql
SELECT pg_size_pretty(pg_database_size(current_database()));
```

2. Check table sizes:

```sql
SELECT tablename, pg_size_pretty(pg_total_relation_size(tablename::regclass))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::regclass) DESC;
```

3. Archive old data if needed (see 06-maintenance-plan.sql Section 5)

## Best Practices

### Do's

- Always capture baseline before making changes
- Monitor continuously during activation
- Run VACUUM ANALYZE weekly
- Archive old data regularly
- Document all maintenance activities
- Use CONCURRENTLY for REINDEX in production
- Test queries on non-production first

### Don'ts

- Don't run VACUUM FULL in production (locks table)
- Don't drop indexes without analyzing usage first
- Don't delete data without backup
- Don't ignore health check warnings
- Don't make schema changes without testing
- Don't terminate connections unnecessarily

## Additional Resources

- [PostgreSQL Monitoring Documentation](https://www.postgresql.org/docs/current/monitoring.html)
- [Render PostgreSQL Guide](https://render.com/docs/databases)
- [pg_stat_statements Extension](https://www.postgresql.org/docs/current/pgstatstatements.html)

## Support

For issues or questions:

1. Check diagnostic queries first
2. Review application logs
3. Consult this README
4. Contact database administrator if needed

## Changelog

- **2025-09-30**: Initial monitoring suite creation
- Created 6 comprehensive SQL analysis files
- Added README and quick reference guide
- Established maintenance schedule and best practices
