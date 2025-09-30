# Webhook Activation Checklist

Quick reference checklist for Phase 1 webhook activation.

## Pre-Activation (30 minutes before)

### Database Preparation

```bash
# 1. Test database connection
psql $DIRECT_URL -c "SELECT version();"
```

- [ ] Connection successful
- [ ] PostgreSQL 17 confirmed

```bash
# 2. Verify webhook_events table exists
psql $DIRECT_URL -c "\d webhook_events"
```

- [ ] Table exists
- [ ] Schema matches expected structure

```bash
# 3. Capture baseline metrics
psql $DIRECT_URL -f database/monitoring/01-baseline-metrics.sql > baseline-$(date +%Y%m%d-%H%M%S).txt
```

- [ ] Baseline captured
- [ ] File saved with timestamp

```bash
# 4. Check current counts
psql $DIRECT_URL -c "SELECT
  (SELECT COUNT(*) FROM conversations) as conversations,
  (SELECT COUNT(*) FROM messages) as messages,
  (SELECT COUNT(*) FROM webhook_events) as webhook_events;"
```

- [ ] Counts documented: \_\_\_\_ conversations, \_\_\_\_ messages, \_\_\_\_
  webhooks

### Monitoring Setup

```bash
# 5. Test real-time monitoring
psql $DIRECT_URL -f database/monitoring/02-realtime-monitoring.sql
```

- [ ] Query executes successfully
- [ ] Results look reasonable

```bash
# 6. Test health check
psql $DIRECT_URL -f database/monitoring/03-health-check.sql
```

- [ ] Health score = 100
- [ ] No warnings or errors

### Terminal Setup

- [ ] Terminal 1: Real-time monitoring ready
- [ ] Terminal 2: Health checks ready
- [ ] Terminal 3: Application logs ready
- [ ] Terminal 4: Emergency commands ready

## During Activation (First 15 minutes)

### Monitoring Commands

Terminal 1 - Real-Time Monitoring:

```bash
watch -n 5 'psql $DIRECT_URL -f database/monitoring/02-realtime-monitoring.sql'
```

Terminal 2 - Success Rate Watch:

```bash
watch -n 10 "psql $DIRECT_URL -t -c \"
  SELECT
    NOW()::time as time,
    COUNT(*) as events,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'SUCCESS') / NULLIF(COUNT(*), 0), 1) as success_pct,
    COUNT(*) FILTER (WHERE status IN ('FAILED', 'ERROR')) as errors,
    ROUND(AVG(processing_time)) as avg_ms
  FROM webhook_events
  WHERE received_at > NOW() - INTERVAL '1 minute';
\""
```

Terminal 3 - Application Logs:

```bash
# Use your application's log viewing command
# Example for Render:
# render logs --service arrakis --tail
```

### Activation Checklist

**T+0 (Activation moment)**

- [ ] Webhook endpoint enabled
- [ ] First event received: \_\_:\_\_ (time)

**T+1 minute**

- [ ] Events appearing in database
- [ ] Success rate > 95%: \_\_\_\_%
- [ ] No stuck events
- [ ] Processing times reasonable: \_\_\_ms avg

**T+5 minutes**

- [ ] Continuous event flow
- [ ] Success rate: \_\_\_\_%
- [ ] Total events: \_\_\_\_
- [ ] Error count: \_\_\_\_ (should be < 5% of total)
- [ ] No stuck events

**T+15 minutes**

- [ ] Steady throughput established
- [ ] Success rate: \_\_\_\_%
- [ ] P95 latency: \_\_\_ms (target < 500ms)
- [ ] Error patterns identified (if any)
- [ ] Database responsive

## Quick Health Checks

### Every 5 Minutes

```bash
# Success rate
psql $DIRECT_URL -t -c "
  SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'SUCCESS') / NULLIF(COUNT(*), 0), 1)
  FROM webhook_events
  WHERE received_at > NOW() - INTERVAL '5 minutes';"
```

Target: > 95%
Current: \_\_\_\_% @ \_\_:\_\_

### Every 10 Minutes

```bash
# Stuck events check
psql $DIRECT_URL -t -c "
  SELECT COUNT(*) FROM webhook_events
  WHERE status = 'PROCESSING'
    AND received_at < NOW() - INTERVAL '5 minutes';"
```

Target: 0
Current: \_\_\_\_ @ \_\_:\_\_

### Every 15 Minutes

```bash
# Latency check
psql $DIRECT_URL -t -c "
  SELECT
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time))
  FROM webhook_events
  WHERE status = 'SUCCESS'
    AND received_at > NOW() - INTERVAL '15 minutes';"
```

Target: < 500ms
Current: \_\_\_\_ms @ \_\_:\_\_

## First Hour Monitoring

### T+30 minutes

- [ ] Run full health check: `psql $DIRECT_URL -f database/monitoring/03-health-check.sql`
- [ ] Health score: \_\_\_\_ (target: 100)
- [ ] Event rate stable
- [ ] No growing error patterns
- [ ] Database size increase reasonable

### T+60 minutes

- [ ] Run diagnostic check: `psql $DIRECT_URL -f database/monitoring/04-diagnostics.sql > diagnostics-1h.txt`
- [ ] Review error patterns
- [ ] Check for any anomalies
- [ ] Verify event outcomes (conversations/messages created)
- [ ] Document any issues

## Metrics to Record

### Activation Summary (First Hour)

```text
Activation Time: ____:____
Total Events Received: ________
Successful Events: ________
Failed Events: ________
Error Events: ________
Success Rate: ____%

Processing Times:
  Average: ____ms
  P50: ____ms
  P95: ____ms
  P99: ____ms

Event Type Breakdown:
  SessionStart: ____
  UserPromptSubmit: ____
  AssistantResponseStart: ____
  (others): ____

Issues Encountered:
  [ ] None
  [ ] Errors (details: _____________)
  [ ] Stuck events (details: _____________)
  [ ] Slow processing (details: _____________)
  [ ] Other (details: _____________)
```

## Emergency Commands

### If Stuck Events Detected

```bash
# Count stuck events
psql $DIRECT_URL -c "
  SELECT event_type, COUNT(*)
  FROM webhook_events
  WHERE status = 'PROCESSING'
    AND received_at < NOW() - INTERVAL '5 minutes'
  GROUP BY event_type;"
```

```bash
# View stuck event details
psql $DIRECT_URL -c "
  SELECT id, event_type, received_at, session_id
  FROM webhook_events
  WHERE status = 'PROCESSING'
    AND received_at < NOW() - INTERVAL '5 minutes'
  ORDER BY received_at LIMIT 10;"
```

```bash
# Reset stuck events (ONLY IF SAFE)
# psql $DIRECT_URL -c "
#   UPDATE webhook_events
#   SET status = 'FAILED',
#       error_message = 'Processing timeout - manually reset'
#   WHERE status = 'PROCESSING'
#     AND received_at < NOW() - INTERVAL '10 minutes';"
```

### If High Error Rate

```bash
# Analyze errors
psql $DIRECT_URL -c "
  SELECT error_code, COUNT(*), MAX(error_message)
  FROM webhook_events
  WHERE status IN ('FAILED', 'ERROR')
    AND received_at > NOW() - INTERVAL '30 minutes'
  GROUP BY error_code
  ORDER BY COUNT(*) DESC;"
```

### If Database Slow

```bash
# Check active queries
psql $DIRECT_URL -c "
  SELECT pid, NOW() - query_start as duration, state, LEFT(query, 100)
  FROM pg_stat_activity
  WHERE state = 'active'
    AND query NOT LIKE '%pg_stat_activity%'
  ORDER BY duration DESC
  LIMIT 10;"
```

### If Need to Disable Webhooks

```text
Webhook endpoint URL: ___________________________
Disable command/button: _________________________
Re-enable command/button: _______________________
```

## Post-Activation (After First Hour)

### Immediate Follow-up

- [ ] Full diagnostic report: `psql $DIRECT_URL -f database/monitoring/04-diagnostics.sql > diagnostics-complete.txt`
- [ ] Compare with baseline
- [ ] Document success rate: \_\_\_\_%
- [ ] Document average latency: \_\_\_ms
- [ ] Document any issues encountered
- [ ] Update team on status

### Next 24 Hours

- [ ] Run health checks every hour
- [ ] Monitor error patterns
- [ ] Check database growth
- [ ] Verify VACUUM running automatically
- [ ] No stuck events detected

### After 24 Hours

- [ ] Run index analysis: `psql $DIRECT_URL -f database/monitoring/05-index-analysis.sql > indexes-24h.txt`
- [ ] Review index usage patterns
- [ ] Identify optimization opportunities
- [ ] Run VACUUM if needed
- [ ] Document lessons learned

### After 1 Week

- [ ] Comprehensive performance review
- [ ] Optimize indexes based on usage
- [ ] Adjust monitoring thresholds
- [ ] Update documentation
- [ ] Plan for Phase 2

## Success Criteria

Phase 1 activation is successful if:

- [ ] Success rate > 95% sustained for 1 hour
- [ ] P95 latency < 500ms
- [ ] Zero stuck events after first 15 minutes
- [ ] Error rate < 5%
- [ ] Database performance stable
- [ ] No critical alerts
- [ ] Events creating expected database records

## Contact Information

```text
Database Admin: _______________________
DevOps Contact: _______________________
On-Call Engineer: _____________________

Render Dashboard: https://dashboard.render.com
Database Service ID: tea-d303qfodl3ps739p3e60

Emergency Procedures: _______________
Rollback Plan: ______________________
```

## Notes

```text
______________________________________________________________________________

______________________________________________________________________________

______________________________________________________________________________

______________________________________________________________________________

______________________________________________________________________________
```

---

**Last Updated**: 2025-09-30
**Prepared By**: Database Expert (Claude)
**Version**: 1.0
