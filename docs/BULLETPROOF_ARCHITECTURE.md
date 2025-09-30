# BULLETPROOF ARCHITECTURE: Claude Conversation Capture System

**Architecture Review & Redesign**
**Date:** 2025-09-30
**System:** Arrakis - Claude Code Conversation Capture
**Criticality:** HIGH - Foundation for entire application

---

## EXECUTIVE SUMMARY

### Current State: FRAGILE
The current system has multiple single points of failure with no visibility or recovery mechanisms. Users report silent failures and stale frontend data.

### Target State: BULLETPROOF
A resilient, self-healing system with real-time updates, comprehensive monitoring, and zero data loss.

### Implementation Approach: PHASED
- **Phase 1 (2 hours):** Critical fixes - immediate reliability improvements
- **Phase 2 (1 day):** Monitoring & visibility - observability layer
- **Phase 3 (2-3 days):** Real-time updates - WebSocket/SSE implementation
- **Phase 4 (3-5 days):** Self-healing - queue and retry infrastructure

---

## SYSTEM ARCHITECTURE ANALYSIS

### Current Component Flow

```
┌──────────────────┐
│  Claude Code     │
│  Desktop App     │
└────────┬─────────┘
         │ Hook Events
         ▼
┌──────────────────┐
│  Node.js Hook    │ ◄─── FRAGILITY POINT #1: Silent failures
│  .claude/hooks/  │      - Exits with code 0 on all errors
│  capture-*       │      - No retry queue
└────────┬─────────┘      - No logging to file
         │ HTTPS POST
         ▼
┌──────────────────┐
│  Next.js API     │ ◄─── FRAGILITY POINT #2: No persistence
│  /api/claude-    │      - Failed requests lost forever
│  hooks/route.ts  │      - No async processing
└────────┬─────────┘      - Blocking operations
         │ Prisma
         ▼
┌──────────────────┐
│  PostgreSQL      │ ◄─── FRAGILITY POINT #3: No constraints
│  Render.com      │      - Missing unique constraints
└────────┬─────────┘      - No transaction management
         │
         ▼
┌──────────────────┐
│  Next.js SSR     │ ◄─── FRAGILITY POINT #4: No real-time
│  Frontend Pages  │      - 5-10 minute cache
│  /conversations  │      - No cache invalidation
└──────────────────┘      - No live updates
```

### Failure Mode Catalog

| Failure Mode | Current Behavior | Impact | Probability |
|--------------|------------------|--------|-------------|
| **Hook script crashes** | Silent exit, event lost | Data loss | HIGH |
| **Network timeout** | Event lost, no retry | Data loss | MEDIUM |
| **Wrong API key** | All events fail silently | Complete data loss | HIGH (during setup) |
| **Database deadlock** | Request fails, no retry | Data loss | LOW |
| **Duplicate SessionStart** | Creates duplicate records | Data corruption | MEDIUM |
| **Missing sessionId** | Hook skips event | Data loss | LOW |
| **Large payload** | Request rejected | Data loss | MEDIUM |
| **API endpoint down** | All events lost | Complete system failure | LOW |
| **Frontend stale cache** | Shows old data | Poor UX | HIGH |
| **Race condition on messages** | Out-of-order messages | Data corruption | MEDIUM |

---

## BULLETPROOF ARCHITECTURE DESIGN

### New Component Flow with Resilience

```
┌──────────────────┐
│  Claude Code     │
│  Desktop App     │
└────────┬─────────┘
         │ Hook Events
         ▼
┌──────────────────────────────────────┐
│  Enhanced Node.js Hook               │
│  ✓ File-based queue for failures     │
│  ✓ Structured logging                │
│  ✓ Exponential backoff retry         │
│  ✓ Configuration validation          │
│  ✓ Health check endpoint             │
└────────┬─────────────────────────────┘
         │ HTTPS POST (with retry)
         ▼
┌──────────────────────────────────────┐
│  Next.js API with Queue              │
│  ✓ Request validation & sanitization│
│  ✓ Idempotent operations             │
│  ✓ Background job processing         │
│  ✓ Webhook event log (PostgreSQL)   │
│  ✓ Health monitoring endpoint        │
└────────┬─────────────────────────────┘
         │ Transactional writes
         ▼
┌──────────────────────────────────────┐
│  PostgreSQL with Constraints         │
│  ✓ Unique indexes on sessionId       │
│  ✓ Transaction management            │
│  ✓ ON CONFLICT handling              │
│  ✓ Database triggers for audit       │
└────────┬─────────────────────────────┘
         │ Cache invalidation events
         ▼
┌──────────────────────────────────────┐
│  Real-time Update Layer              │
│  ✓ Server-Sent Events (SSE)          │
│  ✓ Cache invalidation on writes      │
│  ✓ Optimistic UI updates             │
│  ✓ Automatic reconnection            │
└────────┬─────────────────────────────┘
         │ Real-time push
         ▼
┌──────────────────────────────────────┐
│  Next.js Frontend with Live Updates  │
│  ✓ Auto-refresh conversation list    │
│  ✓ Live message streaming            │
│  ✓ Connection status indicator       │
│  ✓ Optimistic updates with rollback  │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  Monitoring & Observability          │
│  ✓ Hook execution logs (file + DB)   │
│  ✓ Status dashboard                  │
│  ✓ Error tracking                    │
│  ✓ Performance metrics               │
└──────────────────────────────────────┘
```

---

## PHASE 1: IMMEDIATE FIXES (< 2 hours)

### 1.1 Hook Script Improvements

**File:** `c:\projects\arrakis\.claude\hooks\capture-conversation.js`

**Changes:**
1. Add file-based queue for failed requests
2. Implement structured logging to file
3. Add request ID for tracing
4. Validate configuration on startup
5. Add simple health check mode

**Key Code Changes:**

```javascript
// At top of file
const LOG_DIR = path.join(process.env.CLAUDE_PROJECT_DIR, '.claude', 'logs');
const QUEUE_DIR = path.join(process.env.CLAUDE_PROJECT_DIR, '.claude', 'queue');

// Ensure directories exist
[LOG_DIR, QUEUE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Add request ID for tracing
const requestId = generateId();

// Queue failed requests to file
async function queueFailedRequest(payload, error) {
  const queueFile = path.join(QUEUE_DIR, `${Date.now()}-${requestId}.json`);
  fs.writeFileSync(queueFile, JSON.stringify({
    payload,
    error: error.message,
    timestamp: new Date().toISOString(),
    retryCount: 0
  }));
}

// Process queued requests on startup
async function processQueuedRequests() {
  const files = fs.readdirSync(QUEUE_DIR);
  for (const file of files) {
    // Retry logic...
  }
}

// Structured logging
function log(level, message, meta = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    requestId,
    event: HOOK_ENV.event,
    sessionId: HOOK_ENV.sessionId,
    message,
    ...meta
  };

  // Log to file
  const logFile = path.join(LOG_DIR, `capture-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');

  // Also console log
  if (CONFIG.debug) {
    console.log(JSON.stringify(logEntry));
  }
}
```

### 1.2 Database Schema Improvements

**File:** `c:\projects\arrakis\prisma\schema.prisma`

**Changes:**
1. Add unique constraint on sessionId
2. Add webhook event log table
3. Add indexes for performance

```prisma
model Conversation {
  // ... existing fields ...

  @@unique([sessionId])  // Prevent duplicate sessions
  @@index([sessionId, startedAt])  // Composite index for queries
}

// New table for tracking all webhook events
model WebhookEvent {
  id            String   @id @default(cuid())
  requestId     String   @unique  // From hook script
  event         String   // SessionStart, UserPromptSubmit, etc.
  sessionId     String?
  payload       Json
  status        String   // received, processing, completed, failed
  errorMessage  String?  @db.Text
  retryCount    Int      @default(0)
  receivedAt    DateTime @default(now())
  processedAt   DateTime?
  createdAt     DateTime @default(now())

  @@index([sessionId])
  @@index([event, status])
  @@index([receivedAt])
  @@map("webhook_events")
}
```

### 1.3 API Route Improvements

**File:** `c:\projects\arrakis\src\app\api\claude-hooks\route.ts`

**Changes:**
1. Log all incoming requests to WebhookEvent table
2. Make operations idempotent
3. Add request validation
4. Return detailed error info (when safe)

```typescript
export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || generateId();

  try {
    // Parse body
    const body = await request.json();
    const payload = hookPayloadSchema.parse(body);

    // Log webhook event FIRST (before any processing)
    const webhookEvent = await db.webhookEvent.create({
      data: {
        requestId,
        event: payload.event,
        sessionId: payload.sessionId,
        payload: body,
        status: 'received',
      }
    });

    // Process event (with error handling)
    try {
      await db.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: 'processing' }
      });

      const result = await processHookEvent(payload);

      await db.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: 'completed',
          processedAt: new Date()
        }
      });

      return NextResponse.json({
        success: true,
        requestId,
        webhookEventId: webhookEvent.id,
        data: result
      });

    } catch (processingError) {
      // Log error but don't fail request
      await db.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: 'failed',
          errorMessage: processingError.message,
          processedAt: new Date()
        }
      });

      throw processingError;
    }

  } catch (error) {
    // Return error with request ID for debugging
    return NextResponse.json({
      success: false,
      requestId,
      error: error.message,
      // Include more details in development
      ...(process.env.NODE_ENV !== 'production' && {
        stack: error.stack
      })
    }, { status: 500 });
  }
}
```

### 1.4 Configuration Validation

**File:** `c:\projects\arrakis\.claude\settings.json`

**Changes:**
1. Remove `CLAUDE_HOOK_FAIL_SILENTLY: "true"` (change to false)
2. Increase retry attempts
3. Add request ID header

```json
{
  "env": {
    "CLAUDE_HOOK_API_URL": "https://arrakis-prod.onrender.com/api/claude-hooks",
    "CLAUDE_HOOK_API_KEY": "...",
    "CLAUDE_HOOK_DEBUG": "true",
    "CLAUDE_HOOK_ENABLED": "true",
    "CLAUDE_HOOK_FAIL_SILENTLY": "false",  // ← CHANGE THIS
    "CLAUDE_HOOK_TIMEOUT": "10000",
    "CLAUDE_HOOK_RETRY_ATTEMPTS": "3",  // ← INCREASE THIS
    "CLAUDE_HOOK_RETRY_DELAY": "1000"
  }
}
```

---

## PHASE 2: MONITORING & VISIBILITY (1 day)

### 2.1 Hook Status Dashboard

**New File:** `c:\projects\arrakis\src\app\(dashboard)\admin\hooks\page.tsx`

```typescript
export default async function HookStatusPage() {
  const recentEvents = await api.admin.getRecentWebhookEvents({ limit: 50 });
  const stats = await api.admin.getWebhookStats();

  return (
    <div>
      <h1>Hook Status Dashboard</h1>

      {/* Real-time status indicator */}
      <StatusCard stats={stats} />

      {/* Recent events table */}
      <EventsTable events={recentEvents} />

      {/* Failed events that need retry */}
      <FailedEventsAlert events={stats.failedEvents} />
    </div>
  );
}
```

### 2.2 Admin Router for Monitoring

**New File:** `c:\projects\arrakis\src\server\api\routers\admin.ts`

```typescript
export const adminRouter = createTRPCRouter({
  getRecentWebhookEvents: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      status: z.enum(['received', 'processing', 'completed', 'failed']).optional()
    }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.webhookEvent.findMany({
        where: input.status ? { status: input.status } : {},
        orderBy: { receivedAt: 'desc' },
        take: input.limit
      });
    }),

  getWebhookStats: publicProcedure
    .query(async ({ ctx }) => {
      const [total, failed, recent] = await Promise.all([
        ctx.db.webhookEvent.count(),
        ctx.db.webhookEvent.count({ where: { status: 'failed' } }),
        ctx.db.webhookEvent.count({
          where: {
            receivedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        })
      ]);

      return { total, failed, recent };
    }),

  retryFailedWebhook: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.db.webhookEvent.findUnique({
        where: { id: input.id }
      });

      if (!event) throw new Error('Event not found');

      // Retry processing...
      return await processHookEvent(event.payload);
    })
});
```

### 2.3 Log Viewer

**New File:** `c:\projects\arrakis\src\app\(dashboard)\admin\logs\page.tsx`

Display parsed logs from `.claude/logs/` directory with filtering and search.

---

## PHASE 3: REAL-TIME UPDATES (2-3 days)

### 3.1 Server-Sent Events (SSE) for Live Updates

**Why SSE over WebSockets:**
- Simpler to implement
- Auto-reconnection built-in
- Works through proxies/firewalls
- Unidirectional (perfect for our use case)
- Native browser support

**New File:** `c:\projects\arrakis\src\app\api\conversations\stream\route.ts`

```typescript
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`));

      // Set up database listener (using polling for simplicity)
      const intervalId = setInterval(async () => {
        try {
          // Check for new conversations
          const latestConversation = await db.conversation.findFirst({
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              title: true,
              createdAt: true,
              _count: { select: { messages: true } }
            }
          });

          if (latestConversation) {
            const message = JSON.stringify({
              type: 'conversation_update',
              data: latestConversation
            });
            controller.enqueue(encoder.encode(`data: ${message}\n\n`));
          }
        } catch (error) {
          console.error('SSE error:', error);
        }
      }, 2000); // Poll every 2 seconds

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

### 3.2 Frontend Real-time Hook

**New File:** `c:\projects\arrakis\src\hooks\useConversationStream.ts`

```typescript
export function useConversationStream() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource('/api/conversations/stream');

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'conversation_update') {
        // Invalidate queries to trigger refetch
        queryClient.invalidateQueries(['conversation', 'getAll']);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [queryClient]);

  return { isConnected };
}
```

### 3.3 Update Frontend to Use Stream

**Update:** `c:\projects\arrakis\src\app\(dashboard)\conversations\page.tsx`

```tsx
'use client';

export default function ConversationsPage() {
  const { data } = trpc.conversation.getAll.useQuery({ limit: 50 });
  const { isConnected } = useConversationStream();

  return (
    <div>
      {/* Connection indicator */}
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span>{isConnected ? 'Live' : 'Disconnected'}</span>
      </div>

      {/* Rest of component */}
    </div>
  );
}
```

### 3.4 Cache Invalidation Trigger

**Update:** `c:\projects\arrakis\src\app\api\claude-hooks\route.ts`

After successfully processing a hook event, trigger cache invalidation:

```typescript
// After successful processing
if (result.success) {
  // Trigger SSE update to all connected clients
  await broadcastUpdate({
    type: 'conversation_update',
    conversationId: result.conversationId
  });
}
```

---

## PHASE 4: SELF-HEALING INFRASTRUCTURE (3-5 days)

### 4.1 Background Job Processor

**New File:** `c:\projects\arrakis\src\lib\jobs\webhook-processor.ts`

Process failed webhook events automatically:

```typescript
export async function processFailedWebhooks() {
  const failedEvents = await db.webhookEvent.findMany({
    where: {
      status: 'failed',
      retryCount: { lt: 5 }
    },
    orderBy: { receivedAt: 'asc' },
    take: 10
  });

  for (const event of failedEvents) {
    try {
      await processHookEvent(event.payload);

      await db.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: 'completed',
          processedAt: new Date()
        }
      });
    } catch (error) {
      await db.webhookEvent.update({
        where: { id: event.id },
        data: {
          retryCount: event.retryCount + 1,
          errorMessage: error.message
        }
      });
    }
  }
}
```

### 4.2 Cron Job Setup (Render.com)

Add to `render.yaml`:

```yaml
services:
  - type: cron
    name: webhook-retry-processor
    env: docker
    schedule: "*/5 * * * *"  # Every 5 minutes
    dockerCommand: npm run jobs:webhook-retry
```

### 4.3 Health Check Endpoints

**New File:** `c:\projects\arrakis\src\app\api\health\route.ts`

```typescript
export async function GET() {
  const checks = {
    database: false,
    webhooks: false,
    timestamp: new Date().toISOString()
  };

  try {
    // Check database
    await db.$queryRaw`SELECT 1`;
    checks.database = true;

    // Check webhook processing
    const recentEvents = await db.webhookEvent.count({
      where: {
        receivedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }
      }
    });
    checks.webhooks = recentEvents > 0;

    return NextResponse.json({
      status: 'healthy',
      checks
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      checks,
      error: error.message
    }, { status: 500 });
  }
}
```

### 4.4 Alert System

**New File:** `c:\projects\arrakis\src\lib\alerts\webhook-monitor.ts`

```typescript
export async function checkWebhookHealth() {
  const failedCount = await db.webhookEvent.count({
    where: {
      status: 'failed',
      receivedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
    }
  });

  if (failedCount > 10) {
    await sendAlert({
      level: 'critical',
      message: `${failedCount} webhook events failed in the last hour`,
      action: 'Check API logs and database connectivity'
    });
  }
}
```

---

## CONFIGURATION CHANGES

### Updated `.claude/settings.json`

```json
{
  "env": {
    "CLAUDE_HOOK_API_URL": "https://arrakis-prod.onrender.com/api/claude-hooks",
    "CLAUDE_HOOK_API_KEY": "d9997bce251f45d313ce1fc86565ed9f4bc68bbb45a34691fbed8d91e3d59776",
    "CLAUDE_HOOK_DEBUG": "true",
    "CLAUDE_HOOK_ENABLED": "true",
    "CLAUDE_HOOK_FAIL_SILENTLY": "false",
    "CLAUDE_HOOK_TIMEOUT": "10000",
    "CLAUDE_HOOK_RETRY_ATTEMPTS": "3",
    "CLAUDE_HOOK_RETRY_DELAY": "1000",
    "CLAUDE_HOOK_LOG_DIR": "$CLAUDE_PROJECT_DIR/.claude/logs",
    "CLAUDE_HOOK_QUEUE_DIR": "$CLAUDE_PROJECT_DIR/.claude/queue"
  },
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/capture-conversation.js",
            "timeout": 15,
            "env": {
              "CLAUDE_HOOK_EVENT": "SessionStart"
            }
          }
        ]
      }
    ]
  }
}
```

---

## MONITORING STRATEGY

### Key Metrics to Track

1. **Hook Execution Metrics**
   - Events received (by type)
   - Events processed successfully
   - Events failed (with reasons)
   - Average processing time
   - Queue depth

2. **System Health Metrics**
   - API response time
   - Database query performance
   - SSE connection count
   - Cache hit rate

3. **Data Quality Metrics**
   - Conversations created
   - Messages captured
   - Tool uses recorded
   - Duplicate prevention effectiveness

4. **User Experience Metrics**
   - Time from hook to UI update
   - Cache staleness
   - Connection reliability
   - Error recovery success rate

### Monitoring Dashboard

Create a comprehensive dashboard at `/admin/monitoring` showing:

- Real-time event stream
- Failed event queue with retry buttons
- System health indicators
- Performance charts
- Recent errors with stack traces

### Alerting Rules

1. **Critical Alerts**
   - API endpoint unreachable for > 5 minutes
   - > 50 failed webhook events in 1 hour
   - Database connection lost

2. **Warning Alerts**
   - > 10 failed events in 1 hour
   - Average processing time > 2 seconds
   - Queue depth > 100 events

3. **Info Alerts**
   - First successful event after failures
   - System recovered from error state

---

## TESTING STRATEGY

### Unit Tests

1. Hook script failure scenarios
2. API route error handling
3. Database constraint validation
4. Queue processing logic

### Integration Tests

1. End-to-end hook flow
2. Retry mechanism
3. Idempotency checks
4. Real-time update propagation

### Load Tests

1. Concurrent hook requests
2. Large payload handling
3. Queue processing under load
4. SSE connection scaling

### Chaos Tests

1. Network failures
2. Database outages
3. API key rotation
4. Malformed payloads

---

## ROLLOUT PLAN

### Week 1: Foundation (Phase 1 + 2)
- Day 1: Implement immediate fixes
- Day 2: Deploy and monitor
- Day 3: Build monitoring dashboard
- Day 4-5: Test and refine

### Week 2: Real-time (Phase 3)
- Day 1-2: Implement SSE
- Day 3: Frontend integration
- Day 4: Testing
- Day 5: Deploy to production

### Week 3: Self-healing (Phase 4)
- Day 1-2: Background job processor
- Day 3: Health checks and alerts
- Day 4-5: Testing and hardening

### Week 4: Polish & Documentation
- Day 1-2: Performance optimization
- Day 3: Documentation
- Day 4-5: Load testing and tuning

---

## SUCCESS METRICS

After full implementation, the system should achieve:

- **99.9% event capture rate** (measured by webhook_events table)
- **< 2 second end-to-end latency** (hook to UI update)
- **100% idempotency** (duplicate events handled correctly)
- **< 1 minute recovery time** (from failure to working state)
- **Zero data loss** (all events logged, failed events retried)
- **< 5 second cache staleness** (time until frontend shows new data)

---

## APPENDIX: QUICK REFERENCE

### File Structure After Implementation

```
c:\projects\arrakis\
├── .claude\
│   ├── hooks\
│   │   └── capture-conversation.js  (ENHANCED)
│   ├── logs\  (NEW)
│   │   └── capture-2025-09-30.log
│   └── queue\  (NEW)
│       └── [failed-requests].json
├── src\
│   ├── app\
│   │   ├── api\
│   │   │   ├── claude-hooks\
│   │   │   │   └── route.ts  (ENHANCED)
│   │   │   ├── conversations\
│   │   │   │   └── stream\
│   │   │   │       └── route.ts  (NEW - SSE)
│   │   │   └── health\
│   │   │       └── route.ts  (NEW)
│   │   └── (dashboard)\
│   │       ├── admin\
│   │       │   ├── hooks\
│   │       │   │   └── page.tsx  (NEW)
│   │       │   └── logs\
│   │       │       └── page.tsx  (NEW)
│   │       └── conversations\
│   │           └── page.tsx  (ENHANCED)
│   ├── lib\
│   │   ├── jobs\
│   │   │   └── webhook-processor.ts  (NEW)
│   │   └── alerts\
│   │       └── webhook-monitor.ts  (NEW)
│   ├── hooks\
│   │   └── useConversationStream.ts  (NEW)
│   └── server\
│       └── api\
│           └── routers\
│               ├── conversation.ts  (ENHANCED)
│               └── admin.ts  (NEW)
└── prisma\
    └── schema.prisma  (ENHANCED - WebhookEvent table)
```

### Environment Variables Checklist

```bash
# Required
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
CLAUDE_HOOK_API_KEY=...

# Optional but recommended
NODE_ENV=production
LOG_LEVEL=info
ALERT_EMAIL=your-email@example.com
```

### Debugging Commands

```bash
# Check recent webhook events
psql $DATABASE_URL -c "SELECT * FROM webhook_events ORDER BY received_at DESC LIMIT 10;"

# Count failed events
psql $DATABASE_URL -c "SELECT status, COUNT(*) FROM webhook_events GROUP BY status;"

# View hook logs
tail -f c:\projects\arrakis\.claude\logs\capture-$(date +%Y-%m-%d).log

# Check queued failed requests
ls -la c:\projects\arrakis\.claude\queue\

# Test API health
curl https://arrakis-prod.onrender.com/api/health
```

---

## CONCLUSION

This bulletproof architecture transforms a fragile, silent-failure system into a resilient, observable, self-healing platform. The phased approach allows for incremental improvement while maintaining system stability.

**Key Improvements:**
1. **Zero data loss** through file-based queue and database logging
2. **Full visibility** via monitoring dashboard and structured logs
3. **Real-time updates** using Server-Sent Events
4. **Self-healing** via automatic retry and background processing
5. **Idempotent operations** preventing duplicate data
6. **Comprehensive monitoring** with alerts and health checks

**Recommended Priority:** Implement Phase 1 immediately (< 2 hours), then proceed with Phases 2-4 based on operational needs.