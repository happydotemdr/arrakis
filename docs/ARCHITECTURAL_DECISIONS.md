# Architectural Decisions: Roadmap Planning for Arrakis

**Date**: September 29, 2025
**Version**: 1.0.0
**Status**: Architectural Decision Record (ADR)

## Context and Business Requirements

### Strategic Context
The Arrakis project requires **long-term collaborative planning capabilities** to support multi-week and multi-month project coordination. The solution must integrate seamlessly with the existing conversation persistence system while maintaining simplicity and extensibility.

### Technical Constraints
- **Existing Stack**: Next.js 15, TypeScript, tRPC 11.6, Prisma 6.16, PostgreSQL on Neon
- **Performance Requirements**: Sub-20ms response times, support for 100+ concurrent users
- **Scalability**: Handle 1000+ epics without degradation
- **Team Size**: Small team, prioritize maintainability over complexity

## Core Architectural Decisions

### ADR-001: Database Schema Design

**Decision**: Use PostgreSQL with optimized schema design featuring decimal ordering and optimistic locking.

**Options Considered**:
1. **Integer-based ordering** (Original approach)
   - ❌ Race conditions in concurrent drag-and-drop
   - ❌ Requires expensive batch updates for reordering
   - ❌ Potential data corruption in multi-user scenarios

2. **Decimal-based fractional ordering** (Selected)
   - ✅ Eliminates race conditions
   - ✅ O(1) reordering operations
   - ✅ Mathematically stable under concurrent operations
   - ❌ Slightly more complex implementation

3. **Linked list approach**
   - ❌ Complex to implement and maintain
   - ❌ Poor query performance for ordering
   - ❌ Fragile under concurrent operations

**Rationale**:
```sql
-- Decimal ordering enables safe concurrent reordering
displayOrder Decimal @default(1000) @map("display_order") @db.Decimal(20, 10)

-- Calculate new position between two existing items
newOrder = (prevOrder + nextOrder) / 2
```

**Implementation Impact**:
- Zero race conditions in drag-and-drop operations
- Sub-millisecond reordering calculations
- Clean separation of ordering logic from business logic

### ADR-002: Optimistic Locking Strategy

**Decision**: Implement version-based optimistic locking for all epic mutations.

**Options Considered**:
1. **No concurrency control** (Unsafe)
   - ❌ Data loss in concurrent editing
   - ❌ Last-write-wins conflicts
   - ❌ Poor user experience

2. **Pessimistic locking** (Database locks)
   - ❌ Poor performance under load
   - ❌ Deadlock potential
   - ❌ Complex timeout handling

3. **Optimistic locking with versioning** (Selected)
   - ✅ High performance under normal conditions
   - ✅ Clear conflict detection and handling
   - ✅ Excellent user experience with proper error handling
   - ❌ Requires client-side conflict resolution

**Implementation**:
```typescript
// Version field tracks record changes
version: Int @default(1)

// Update operations include version check
await db.epic.update({
  where: {
    id: epicId,
    version: currentVersion  // Optimistic lock
  },
  data: {
    ...updates,
    version: { increment: 1 }
  }
})
```

**Conflict Resolution Strategy**:
- Detect version conflicts at database level
- Return meaningful error messages to users
- Provide refresh-and-retry user experience
- Log conflicts for monitoring and optimization

### ADR-003: Database Index Strategy

**Decision**: Implement comprehensive indexing for all common query patterns.

**Performance Analysis**:
```sql
-- Primary ordering index (most critical)
@@index([displayOrder], type: BTree)

-- Filtered ordering indexes
@@index([status, displayOrder])
@@index([priority, displayOrder])
@@index([quarter, displayOrder])

-- Utility indexes
@@index([deletedAt])        -- Soft delete filtering
@@index([createdAt])        -- Time-based queries
@@index([updatedAt])        -- Change tracking
```

**Query Performance Targets**:
- List 50 epics: <10ms
- Filtered lists: <15ms
- Individual epic lookup: <5ms
- Statistics aggregation: <50ms

**Index Maintenance Strategy**:
- Monitor index usage with EXPLAIN ANALYZE
- Regular VACUUM and ANALYZE operations
- Index-only scans for common read patterns

### ADR-004: API Design and Type Safety

**Decision**: Use tRPC with comprehensive Zod validation and structured error handling.

**API Architecture**:
```typescript
// Input validation with business rules
const createEpicSchema = z.object({
  title: z.string().min(1).max(200),
  quarter: z.string().regex(/^Q[1-4]\s20\d{2}$/),
  // ... other validations
})

// Structured error responses
if (error.code === 'P2025') {
  throw new TRPCError({
    code: 'CONFLICT',
    message: 'Epic was modified by another user.'
  })
}
```

**Benefits**:
- End-to-end type safety from database to UI
- Runtime validation prevents invalid data
- Consistent error handling across all operations
- Automatic API documentation through TypeScript types

### ADR-005: Connection Pooling and Database Optimization

**Decision**: Use PgBouncer connection pooling with Neon-optimized configuration.

**Connection Strategy**:
```typescript
// Optimized connection string
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require&pgbouncer=true&pool_mode=transaction&connection_limit=20"

// Prisma client configuration
new PrismaClient({
  log: ['query', 'error', 'warn'],
  errorFormat: 'minimal',
})
```

**Performance Optimizations**:
- Transaction-level connection pooling
- 20 connection limit optimized for Neon
- Prepared statement caching
- Query performance monitoring
- Graceful connection cleanup

### ADR-006: Frontend State Management

**Decision**: Use React Query (TanStack Query) with optimistic updates and cache invalidation.

**State Management Strategy**:
```typescript
// Optimistic updates for immediate UI feedback
onMutate: async (newData) => {
  await queryClient.cancelQueries(['epics'])
  const previousEpics = queryClient.getQueryData(['epics'])

  queryClient.setQueryData(['epics'], (old) => {
    // Optimistic update logic
  })

  return { previousEpics }
}

// Rollback on error
onError: (err, newData, context) => {
  queryClient.setQueryData(['epics'], context.previousEpics)
}
```

**Benefits**:
- Instant UI feedback for user actions
- Automatic error recovery and rollback
- Intelligent cache invalidation
- Background refetching for data consistency

### ADR-007: Drag and Drop Implementation

**Decision**: Native HTML5 drag and drop with fractional ordering backend.

**Options Considered**:
1. **Third-party drag library** (react-beautiful-dnd)
   - ❌ Additional dependency and bundle size
   - ❌ Complex integration with server state
   - ❌ Accessibility concerns

2. **Native HTML5 drag and drop** (Selected)
   - ✅ Zero dependencies
   - ✅ Better performance
   - ✅ Direct integration with fractional ordering
   - ❌ More implementation complexity

**Implementation Strategy**:
```typescript
const handleDrop = async (e: React.DragEvent, targetEpic: Epic) => {
  // Determine drop position from mouse coordinates
  const rect = e.currentTarget.getBoundingClientRect()
  const mouseY = e.clientY
  const cardCenter = rect.top + rect.height / 2
  const position = mouseY < cardCenter ? 'before' : 'after'

  // Server-side fractional ordering
  await reorderEpic.mutateAsync({
    epicId: draggedEpic.id,
    position,
    targetId: targetEpic.id,
  })
}
```

**Accessibility Considerations**:
- Keyboard shortcuts for reordering
- Screen reader announcements for position changes
- Visual feedback for drag states
- Fallback UI for devices without drag support

### ADR-008: Soft Delete Strategy

**Decision**: Implement soft deletion with `deletedAt` timestamp for data recovery capabilities.

**Implementation**:
```sql
-- Soft delete field
deletedAt DateTime? @map("deleted_at") @db.Timestamptz

-- All queries filter out deleted records
WHERE deletedAt IS NULL

-- Index for efficient filtering
@@index([deletedAt])
```

**Benefits**:
- Data recovery capabilities for accidental deletions
- Audit trail for deleted items
- Ability to implement "undo" functionality
- Compliance with data retention requirements

**Considerations**:
- Regular cleanup of old soft-deleted records
- Performance monitoring for large deleted datasets
- Clear user communication about deletion behavior

### ADR-009: Integration with Existing Conversation System

**Decision**: Design roadmap system as independent module with potential future integration points.

**Integration Strategy**:
- **Phase 1**: Independent roadmap system with shared infrastructure
- **Phase 2**: Link epics to relevant conversations (future enhancement)
- **Phase 3**: AI-powered epic insights from conversation analysis (future)

**Shared Infrastructure**:
```typescript
// Shared database connection
import { db } from '@/server/db'

// Shared tRPC router pattern
import { createTRPCRouter, publicProcedure } from '../trpc'

// Shared UI components and styling
import { Card, Badge, Button } from '@/components/ui'
```

**Future Integration Opportunities**:
- Epic creation from conversation summaries
- Automatic epic updates based on conversation outcomes
- Cross-referencing epics in conversation context
- AI-powered epic prioritization based on conversation sentiment

## Performance Architecture

### Query Optimization Strategy

**Database Query Patterns**:
```sql
-- Optimized epic list query
SELECT id, title, description, status, priority, quarter, icon, color, display_order, version
FROM epics
WHERE deleted_at IS NULL
  AND status = $1  -- Optional filter
ORDER BY display_order ASC
LIMIT 50;

-- Uses index: idx_status_order or idx_display_order
```

**Caching Strategy**:
- React Query for client-side caching
- Browser-level caching for static assets
- Database query plan caching
- Connection pooling for database optimization

### Scalability Considerations

**Horizontal Scaling Preparation**:
- Stateless API design enables horizontal scaling
- Database connection pooling supports multiple app instances
- Client-side pagination reduces server load
- Optimistic updates minimize server round-trips

**Performance Monitoring**:
```typescript
// Slow query logging
db.$on('query', (e) => {
  if (e.duration > 1000) {
    console.warn(`Slow query (${e.duration}ms):`, e.query)
  }
})

// Error rate monitoring
catch (error) {
  console.error('Epic operation failed:', error)
  // Send to monitoring service
}
```

## Security Architecture

### Input Validation and Sanitization

**Multi-Layer Validation**:
```typescript
// Client-side validation (UX)
const schema = z.object({
  title: z.string().min(1).max(200),
  // ... validations
})

// Server-side validation (Security)
.input(createEpicSchema)
.mutation(async ({ input, ctx }) => {
  // Validated input guaranteed
})

// Database constraints (Final safety)
title String @db.VarChar(200)  -- Length constraint
```

**SQL Injection Prevention**:
- Prisma ORM provides parameterized queries
- No raw SQL in application code
- Input validation at API boundaries
- Database user has minimal required permissions

### Authorization Considerations

**Current Implementation**: Open access (no authentication)
**Future Security Model**:
```typescript
// Prepared for future authentication
.middleware(async ({ ctx, next }) => {
  // Authentication check
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  })
})
```

## Error Handling Architecture

### Comprehensive Error Strategy

**Database Level**:
```typescript
// Optimistic lock failures
if (error.code === 'P2025') {
  throw new TRPCError({
    code: 'CONFLICT',
    message: 'Epic was modified by another user. Please refresh and try again.',
  })
}

// Unique constraint violations
if (error.code === 'P2002') {
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'An epic with this title already exists.',
  })
}
```

**Network Level**:
```typescript
// React Query error handling
const mutation = useMutation({
  onError: (error) => {
    if (error.data?.code === 'CONFLICT') {
      toast.error('Epic was modified by another user. Please refresh.')
    } else {
      toast.error('Something went wrong. Please try again.')
    }
  }
})
```

**User Experience**:
- Clear, actionable error messages
- Automatic retry for transient failures
- Graceful degradation under network issues
- Loading states and progress indicators

## Monitoring and Observability

### Performance Metrics

**Database Metrics**:
- Query execution times
- Connection pool utilization
- Index usage statistics
- Slow query frequency

**Application Metrics**:
- API response times
- Error rates by operation
- User interaction patterns
- Cache hit/miss ratios

**User Experience Metrics**:
- Time to first paint
- Interaction to next paint
- Drag and drop completion times
- Error recovery success rates

### Logging Strategy

**Structured Logging**:
```typescript
// Operation logging
console.log({
  operation: 'epic.reorder',
  epicId: epic.id,
  duration: performance.now() - start,
  success: true
})

// Error logging
console.error({
  operation: 'epic.update',
  epicId: epic.id,
  error: error.message,
  stack: error.stack
})
```

## Migration and Deployment Strategy

### Database Migration Safety

**Migration Process**:
```bash
# Development migration
npx prisma migrate dev --name "add_epic_schema"

# Production deployment
npx prisma migrate deploy
```

**Safety Measures**:
- Pre-migration database backup
- Migration validation in staging environment
- Rollback plan for migration failures
- Index creation during low-traffic periods

### Zero-Downtime Deployment

**Deployment Strategy**:
1. Deploy new application version (backward compatible)
2. Run database migrations
3. Verify application functionality
4. Switch traffic to new version
5. Monitor for issues and rollback if needed

**Feature Flags**:
```typescript
// Prepared for gradual rollout
const isRoadmapEnabled = process.env.FEATURE_ROADMAP === 'true'

if (!isRoadmapEnabled) {
  throw new TRPCError({
    code: 'NOT_FOUND',
    message: 'Roadmap feature is not available'
  })
}
```

## Future Architecture Considerations

### AI Integration Opportunities

**Conversation Analysis**:
- Extract epic ideas from conversation summaries
- Suggest epic priorities based on conversation sentiment
- Automatically update epic status from conversation outcomes

**Predictive Analytics**:
- Epic completion time estimation
- Risk assessment based on historical patterns
- Resource allocation optimization

### Advanced Features Architecture

**Prepared Extension Points**:
```typescript
// Epic metadata for future features
interface EpicMetadata {
  estimatedHours?: number
  dependencies?: string[]
  assignees?: string[]
  tags?: string[]
  customFields?: Record<string, any>
}

// Extensible through JSON fields or separate tables
```

**Integration Capabilities**:
- Webhook system for external integrations
- Export/import functionality for data portability
- API versioning for backward compatibility
- Plugin architecture for custom features

## Risk Assessment and Mitigation

### Technical Risks

**Database Performance Degradation**:
- *Risk*: Poor query performance with large datasets
- *Mitigation*: Comprehensive indexing and pagination
- *Monitoring*: Query performance alerts

**Concurrent Editing Conflicts**:
- *Risk*: Users losing work due to conflicts
- *Mitigation*: Optimistic locking with clear conflict resolution
- *Monitoring*: Conflict frequency tracking

**Network Reliability Issues**:
- *Risk*: Poor user experience during network issues
- *Mitigation*: Optimistic updates and offline capabilities
- *Monitoring*: Network error rate tracking

### Operational Risks

**Data Loss**:
- *Risk*: Accidental deletion or corruption
- *Mitigation*: Soft deletes and regular backups
- *Monitoring*: Backup verification and recovery testing

**Scalability Limits**:
- *Risk*: Performance degradation under load
- *Mitigation*: Connection pooling and caching
- *Monitoring*: Performance metrics and load testing

## Conclusion

The architectural decisions outlined in this document prioritize **simplicity, performance, and extensibility** while addressing the core business requirements for collaborative roadmap planning. The design leverages proven patterns and technologies while providing clear extension points for future enhancements.

Key architectural strengths:
- **Performance-first design** with sub-20ms response times
- **Concurrent operation safety** with optimistic locking
- **Scalable foundation** supporting 1000+ epics
- **Type-safe implementation** preventing runtime errors
- **Extensible architecture** for future AI integration

The implementation provides immediate value while establishing a foundation for long-term growth and enhancement of the Arrakis project's collaborative planning capabilities.

---

*This document serves as the authoritative reference for architectural decisions in the roadmap planning implementation. Update this document when making significant architectural changes.*