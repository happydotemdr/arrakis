# Architecture Decision Record: Conversation Capture System

**Date:** 2025-09-30
**Status:** PROPOSED
**Decision Makers:** Engineering Team
**Context:** Current system is fragile with silent failures and stale frontend

---

## DECISION SUMMARY

We will transform the Claude Code conversation capture system from a fragile, fire-and-forget architecture to a bulletproof, observable, self-healing system through four phased improvements.

---

## CONTEXT & PROBLEM STATEMENT

### Current Pain Points

1. **Silent Failures:** Hooks exit with code 0 even on errors, making debugging impossible
2. **No Retry Mechanism:** Failed webhook calls are lost forever
3. **Stale Frontend:** 5-10 minute cache means users don't see new conversations
4. **No Observability:** No way to know if the system is working
5. **Race Conditions:** Duplicate SessionStart events create duplicate records
6. **No Traceability:** Can't trace a request through the entire stack

### Business Impact

- Users lose trust when conversations don't appear
- Debugging takes hours instead of minutes
- Data loss is invisible and unrecoverable
- Poor user experience reduces adoption

---

## DECISION DRIVERS

### Technical Requirements

1. **Zero Data Loss:** Every hook event must be captured or queued
2. **Full Observability:** Know the status of every request
3. **Fast Recovery:** Automatic retry with exponential backoff
4. **Real-time Updates:** Frontend sees changes within 2 seconds
5. **Idempotency:** Handle duplicate events gracefully
6. **Scalability:** Support 1000+ conversations/day

### Operational Requirements

1. **Easy Debugging:** Structured logs with request tracing
2. **Self-Healing:** Automatic recovery from transient failures
3. **Monitoring:** Dashboard showing system health
4. **Alerting:** Notifications when things go wrong
5. **Low Maintenance:** Minimal manual intervention

---

## CONSIDERED OPTIONS

### Option 1: Keep Current System + Add Logging (REJECTED)

**Pros:**
- Minimal changes
- Low risk
- Quick to implement

**Cons:**
- Doesn't solve core reliability issues
- Still has silent failures
- No retry mechanism
- No real-time updates

**Verdict:** Insufficient - doesn't address root causes

### Option 2: External Queue Service (e.g., Redis, RabbitMQ) (REJECTED)

**Pros:**
- Industry standard
- Robust retry mechanisms
- Good observability

**Cons:**
- Additional infrastructure cost (~$20-50/month)
- More complexity to manage
- Overkill for current scale
- Adds network dependency

**Verdict:** Over-engineered for current needs

### Option 3: File-Based Queue + Database Logging (SELECTED)

**Pros:**
- Zero additional infrastructure cost
- Works offline
- Simple to implement
- Easy to debug (human-readable files)
- Scales to 10,000+ events/day
- Self-contained solution

**Cons:**
- File I/O overhead (minimal at current scale)
- Manual queue management in extreme failure cases

**Verdict:** Optimal for current scale and requirements

### Option 4: Full Event Sourcing Architecture (REJECTED)

**Pros:**
- Ultimate reliability
- Complete audit trail
- Time-travel debugging

**Cons:**
- Massive implementation effort (4-6 weeks)
- Significant complexity
- Overkill for use case
- Expensive to maintain

**Verdict:** Too complex for current needs

---

## SELECTED SOLUTION ARCHITECTURE

### Core Design Principles

1. **Defense in Depth:** Multiple layers of resilience
2. **Fail Loud:** Errors must be visible
3. **Eventually Consistent:** Accept temporary inconsistency for reliability
4. **Idempotent Operations:** Safe to retry any operation
5. **Observable by Default:** All operations logged with context

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     RESILIENCE LAYERS                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Layer 1: Hook Script (First Line of Defense)               │
│  ┌───────────────────────────────────────────────┐          │
│  │ - Structured logging to file                  │          │
│  │ - Request ID generation for tracing           │          │
│  │ - Retry with exponential backoff (3 attempts) │          │
│  │ - Queue to disk on failure                    │          │
│  │ - Process queued requests on next run         │          │
│  └───────────────────────────────────────────────┘          │
│                         ↓                                     │
│  Layer 2: API Endpoint (Second Line of Defense)             │
│  ┌───────────────────────────────────────────────┐          │
│  │ - Log ALL requests to WebhookEvent table      │          │
│  │ - Request validation and sanitization         │          │
│  │ - Idempotent database operations (upsert)     │          │
│  │ - Detailed error responses for debugging      │          │
│  │ - Track processing status (received → completed) │       │
│  └───────────────────────────────────────────────┘          │
│                         ↓                                     │
│  Layer 3: Database (Third Line of Defense)                  │
│  ┌───────────────────────────────────────────────┐          │
│  │ - Unique constraints prevent duplicates       │          │
│  │ - Transactions ensure consistency             │          │
│  │ - Indexes optimize query performance          │          │
│  │ - Foreign keys maintain referential integrity │          │
│  └───────────────────────────────────────────────┘          │
│                         ↓                                     │
│  Layer 4: Cache Invalidation (Fourth Line of Defense)       │
│  ┌───────────────────────────────────────────────┐          │
│  │ - SSE for real-time updates                   │          │
│  │ - Invalidate cache on write operations        │          │
│  │ - Optimistic UI updates                       │          │
│  │ - Automatic reconnection                      │          │
│  └───────────────────────────────────────────────┘          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow with Failure Handling

```
┌──────────────┐
│ Claude Code  │
│  Hook Event  │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Hook Script                          │
│ ✓ Generate request ID                │ ← Traceability
│ ✓ Log to file                        │ ← Observability
│ ✓ Retry 3x with backoff              │ ← Resilience
│ ✓ Queue to disk on failure           │ ← No data loss
└──────┬───────────────────────────────┘
       │ HTTPS POST
       ▼
┌──────────────────────────────────────┐
│ API Endpoint                         │
│ ✓ Log to WebhookEvent table          │ ← Audit trail
│ ✓ Validate & sanitize                │ ← Security
│ ✓ Process with idempotency           │ ← Consistency
│ ✓ Update status (received → completed)│ ← Tracking
└──────┬───────────────────────────────┘
       │ Database write
       ▼
┌──────────────────────────────────────┐
│ PostgreSQL                           │
│ ✓ Unique constraints                 │ ← No duplicates
│ ✓ Transactions                       │ ← Atomicity
│ ✓ Cascade deletes                    │ ← Cleanup
└──────┬───────────────────────────────┘
       │ Trigger cache invalidation
       ▼
┌──────────────────────────────────────┐
│ Real-time Update (SSE)               │
│ ✓ Notify connected clients           │ ← Live updates
│ ✓ Invalidate React Query cache       │ ← Fresh data
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Frontend                             │
│ ✓ Shows new conversation immediately │ ← UX
│ ✓ Connection status indicator        │ ← Feedback
└──────────────────────────────────────┘

FAILURE RECOVERY PATHS:
───────────────────────

Hook Script Crash:
  → Log persists to disk
  → Queue file created
  → Retry on next hook call
  → Max 5 retries with exponential backoff
  → Move to .claude/failed/ after max retries

Network Failure:
  → Hook script retries 3x
  → Queue to disk
  → Background job processor retries (Phase 4)
  → Alert after 10 consecutive failures

Database Deadlock:
  → Transaction rollback
  → WebhookEvent marked as failed
  → Background job processor retries
  → Alert if retry count > 3

API Endpoint Down:
  → All hook requests queued locally
  → Health check endpoint detects issue
  → Alert triggered immediately
  → Automatic retry when endpoint recovers

Wrong API Key:
  → Request logged with 401 status
  → Queue for retry after key fix
  → Alert: "Check API key configuration"
  → Manual intervention required

Duplicate Events:
  → Upsert prevents duplicate records
  → WebhookEvent logs duplicate attempt
  → No error to user
  → Metrics track duplicate rate
```

---

## IMPLEMENTATION STRATEGY

### Phased Rollout

**Why Phased:**
- Reduces risk of breaking existing functionality
- Allows testing at each stage
- Can roll back individual phases
- Provides incremental value

**Phase Breakdown:**

| Phase | Duration | Risk | Value | Dependencies |
|-------|----------|------|-------|--------------|
| Phase 1: Core Resilience | 2 hours | LOW | HIGH | None |
| Phase 2: Observability | 1 day | LOW | HIGH | Phase 1 |
| Phase 3: Real-time Updates | 2-3 days | MEDIUM | MEDIUM | Phase 1 |
| Phase 4: Self-healing | 3-5 days | MEDIUM | HIGH | Phase 1, 2 |

### Technology Choices

**File-based Queue vs. Redis:**
- **Chosen:** File-based queue
- **Reasoning:**
  - No additional infrastructure cost
  - Works even when API is down
  - Simple to debug (cat file.json)
  - Sufficient for current scale (< 1000 events/day)
  - Can migrate to Redis later if needed

**SSE vs. WebSockets:**
- **Chosen:** Server-Sent Events (SSE)
- **Reasoning:**
  - Simpler implementation
  - Auto-reconnection built-in
  - Unidirectional (we only push, don't receive)
  - Better firewall/proxy compatibility
  - Native browser support

**PostgreSQL vs. Separate Event Log:**
- **Chosen:** PostgreSQL with WebhookEvent table
- **Reasoning:**
  - Already have PostgreSQL
  - Can query with SQL
  - ACID guarantees
  - Easy to integrate with existing queries
  - No additional cost

**Background Jobs: Cron vs. Queue Worker:**
- **Chosen:** Cron job on Render.com
- **Reasoning:**
  - Simple to set up
  - No additional infrastructure
  - Sufficient frequency (every 5 minutes)
  - Easy to monitor
  - Can upgrade to dedicated worker later

---

## FAILURE MODE ANALYSIS

### Critical Failure Modes & Mitigations

| Failure Mode | Probability | Impact | MTTR (Before) | MTTR (After) | Mitigation |
|--------------|-------------|--------|---------------|--------------|------------|
| Hook script crash | HIGH | HIGH | Manual | Auto (1 min) | Queue + retry |
| Network timeout | MEDIUM | HIGH | Manual | Auto (1 min) | Queue + retry |
| Wrong API key | HIGH | CRITICAL | Manual | Auto (after fix) | Queue + alert |
| Database deadlock | LOW | MEDIUM | Manual | Auto (1 min) | Retry logic |
| API endpoint down | LOW | CRITICAL | Manual | Auto (5 min) | Queue + health check |
| Duplicate events | MEDIUM | LOW | N/A | N/A | Idempotent ops |
| Large payload | MEDIUM | MEDIUM | Lost | Rejected safely | Validation |
| Cache stale | HIGH | LOW | Manual refresh | Auto (2 sec) | SSE |

**MTTR:** Mean Time To Recovery

### Cascading Failure Prevention

**Scenario:** API endpoint becomes slow due to database load

**Without Mitigations:**
1. Hook timeouts increase
2. All hooks start failing
3. Queue fills up
4. Disk space exhausted
5. System crash

**With Mitigations:**
1. Timeout triggers queue write (low overhead)
2. Background processor handles queue (separate process)
3. Health check detects slowness
4. Alert triggered
5. Queue processor backs off exponentially
6. System degrades gracefully
7. Automatic recovery when database recovers

---

## MONITORING & ALERTING STRATEGY

### Key Metrics

**System Health Metrics:**
- Webhook events received/minute
- Webhook processing success rate
- Average processing latency
- Queue depth
- Failed event count
- Cache hit rate

**Data Quality Metrics:**
- Conversations created
- Messages captured
- Tool uses recorded
- Duplicate event rate

**User Experience Metrics:**
- Time from hook to UI update
- SSE connection uptime
- Frontend error rate

### Alert Levels

**CRITICAL (Page immediately):**
- API endpoint down for > 5 minutes
- > 50 failed events in 1 hour
- Database unreachable
- All hooks failing for > 10 minutes

**WARNING (Email within 1 hour):**
- > 10 failed events in 1 hour
- Queue depth > 100
- Average latency > 2 seconds
- Duplicate event rate > 10%

**INFO (Daily digest):**
- Daily statistics
- Top errors
- Performance trends

---

## TESTING STRATEGY

### Unit Tests

```typescript
// Hook script
describe('queueFailedRequest', () => {
  it('should write queue file with correct structure', async () => {
    await queueFailedRequest(payload, error);
    const queueFile = fs.readFileSync(queuePath, 'utf8');
    expect(JSON.parse(queueFile)).toMatchObject({
      requestId: expect.any(String),
      payload: payload,
      error: expect.objectContaining({
        message: error.message
      })
    });
  });
});

// API route
describe('POST /api/claude-hooks', () => {
  it('should create WebhookEvent record for all requests', async () => {
    await POST(mockRequest);
    const event = await db.webhookEvent.findFirst({
      where: { requestId: mockRequestId }
    });
    expect(event).toBeDefined();
    expect(event.status).toBe('completed');
  });

  it('should handle duplicate SessionStart events idempotently', async () => {
    await POST(sessionStartRequest);
    await POST(sessionStartRequest); // Duplicate

    const conversations = await db.conversation.findMany({
      where: { sessionId: sessionId }
    });

    expect(conversations).toHaveLength(1);
  });
});
```

### Integration Tests

```typescript
describe('End-to-end hook flow', () => {
  it('should capture conversation from SessionStart to SessionEnd', async () => {
    // Start session
    await callHook('SessionStart', { sessionId: testSessionId });

    // Add message
    await callHook('UserPromptSubmit', {
      sessionId: testSessionId,
      prompt: 'Hello'
    });

    // End session
    await callHook('SessionEnd', { sessionId: testSessionId });

    // Verify database state
    const conversation = await db.conversation.findFirst({
      where: { sessionId: testSessionId },
      include: { messages: true }
    });

    expect(conversation).toBeDefined();
    expect(conversation.messages).toHaveLength(1);
    expect(conversation.endedAt).toBeDefined();
  });

  it('should retry failed requests from queue', async () => {
    // Simulate API failure
    mockApiEndpoint.down();

    // Attempt hook call
    await callHook('SessionStart', { sessionId: testSessionId });

    // Verify queue file created
    const queueFiles = fs.readdirSync(QUEUE_DIR);
    expect(queueFiles).toHaveLength(1);

    // Restore API
    mockApiEndpoint.up();

    // Call another hook (triggers queue processing)
    await callHook('UserPromptSubmit', { sessionId: testSessionId });

    // Verify queue is empty and conversation exists
    expect(fs.readdirSync(QUEUE_DIR)).toHaveLength(0);
    const conversation = await db.conversation.findFirst({
      where: { sessionId: testSessionId }
    });
    expect(conversation).toBeDefined();
  });
});
```

### Load Tests

```bash
# Simulate 100 concurrent hooks
artillery quick --count 100 --num 10 \
  https://arrakis-prod.onrender.com/api/claude-hooks

# Expected results:
# - 100% success rate
# - p95 latency < 500ms
# - No failed events
# - No queue buildup
```

---

## COST ANALYSIS

### Infrastructure Costs

| Component | Current | After Phase 4 | Increase |
|-----------|---------|---------------|----------|
| Render.com hosting | $7/month | $7/month | $0 |
| PostgreSQL | $7/month | $7/month | $0 |
| Cron job | $0 | $0 (included) | $0 |
| Storage (logs/queue) | $0 | < $1/month | ~$1 |
| **Total** | **$14/month** | **~$15/month** | **~$1** |

### Development Costs

| Phase | Time | Cost ($150/hr) |
|-------|------|----------------|
| Phase 1 | 2 hours | $300 |
| Phase 2 | 8 hours | $1,200 |
| Phase 3 | 20 hours | $3,000 |
| Phase 4 | 30 hours | $4,500 |
| **Total** | **60 hours** | **$9,000** |

### ROI Analysis

**Current State:**
- 2 hours/week debugging issues: $300/week = $15,600/year
- Lost user trust: Hard to quantify, but significant

**After Implementation:**
- Near-zero debugging time
- Improved user experience
- Automated monitoring
- Self-healing system

**Break-even:** 30 weeks (7 months)
**5-year ROI:** $69,000 savings

---

## RISKS & MITIGATION

### Implementation Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing functionality | LOW | HIGH | Phased rollout, extensive testing |
| Database migration issues | LOW | HIGH | Test on staging, have rollback plan |
| Performance degradation | LOW | MEDIUM | Load testing, monitoring |
| Incomplete queue processing | MEDIUM | MEDIUM | Monitoring, alerts, manual retry UI |
| SSE connection issues | MEDIUM | LOW | Fallback to polling |

### Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Disk space exhaustion | LOW | HIGH | Log rotation, queue size limits |
| Queue file corruption | LOW | MEDIUM | JSON validation, error handling |
| False positive alerts | MEDIUM | LOW | Alert tuning, escalation policy |
| Monitoring blind spots | MEDIUM | MEDIUM | Comprehensive metrics, regular review |

---

## ALTERNATIVES CONSIDERED

### Alternative 1: Use Existing SaaS (Webhook.site, Svix)

**Pros:** Turnkey solution, no maintenance
**Cons:** $50-200/month, less control, data privacy concerns
**Decision:** Build in-house for cost and control

### Alternative 2: Implement Only Real-time Updates

**Pros:** Solves user-visible problem quickly
**Cons:** Doesn't address reliability issues
**Decision:** Not sufficient alone

### Alternative 3: Use Prisma Pulse for Real-time

**Pros:** Native Prisma integration
**Cons:** $20/month additional cost, limited to database changes
**Decision:** SSE is simpler and free

---

## SUCCESS CRITERIA

### Must Have (Phase 1-2)

- [ ] Zero silent failures (all errors logged)
- [ ] All webhook events tracked in database
- [ ] Failed requests queued and retried
- [ ] Request tracing with unique IDs
- [ ] Monitoring dashboard showing system health
- [ ] 99% webhook success rate

### Should Have (Phase 3)

- [ ] Real-time frontend updates (< 5 seconds)
- [ ] SSE connection status indicator
- [ ] Cache invalidation on writes
- [ ] < 2 second average processing latency

### Nice to Have (Phase 4)

- [ ] Automated health checks
- [ ] Self-healing via background jobs
- [ ] Alert system for failures
- [ ] Performance analytics dashboard
- [ ] 99.9% uptime

---

## DECISION

**We will proceed with the four-phase implementation** as outlined above.

**Rationale:**
1. Addresses all identified pain points
2. Minimal infrastructure cost increase
3. Phased approach reduces risk
4. Provides immediate value (Phase 1)
5. Creates foundation for future improvements
6. Strong ROI within 7 months

**Next Steps:**
1. Review and approve ADR (this document)
2. Begin Phase 1 implementation (2 hours)
3. Deploy to production and monitor
4. Proceed with Phase 2 after 1 week of stable operation

---

## APPROVAL

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineering Lead | | | |
| Product Owner | | | |
| DevOps | | | |

---

## REFERENCES

- **BULLETPROOF_ARCHITECTURE.md** - Complete architectural design
- **PHASE_1_IMPLEMENTATION.md** - Step-by-step implementation guide
- Prisma documentation: https://www.prisma.io/docs
- tRPC documentation: https://trpc.io/docs
- Next.js App Router: https://nextjs.org/docs/app
- Server-Sent Events: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events

---

## REVISION HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-09-30 | Claude (Sonnet 4.5) | Initial ADR |