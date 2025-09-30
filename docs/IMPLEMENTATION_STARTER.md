# Implementation Starter Guide: Roadmap Planning for Arrakis

**Date**: September 29, 2025
**Version**: 1.0.0
**Target Audience**: Development Team
**Prerequisites**: Existing Arrakis codebase with Next.js 15, tRPC, Prisma, and Neon PostgreSQL

## Quick Start Implementation Path

### Pre-Implementation Checklist

**Verify Current State**:
- [ ] Confirm Neon database is accessible
- [ ] Verify tRPC and Prisma are functioning
- [ ] Check that development environment runs without errors
- [ ] Ensure all dependencies are up to date

**Repository Preparation**:
```bash
# Verify current working directory
cd C:\projects\arrakis

# Check git status and commit any pending changes
git status
git add . && git commit -m "Pre-roadmap implementation checkpoint"

# Verify database connection
npm run db:studio  # Should open Prisma Studio successfully
```

## Phase 1: Database Foundation (60 minutes)

### 1.1 Schema Design Implementation

**Create optimized Prisma schema addition**:

```typescript
// Add to prisma/schema.prisma

model Epic {
  id           String    @id @default(uuid())
  title        String    @db.VarChar(200)
  description  String?   @db.Text
  status       EpicStatus @default(PLANNED)
  priority     EpicPriority @default(MEDIUM)
  quarter      String?   @db.VarChar(7)  // Format: "Q1 2025"
  outcome      String?   @db.Text
  icon         String?   @db.VarChar(10) // Emoji storage
  color        String?   @db.Char(7)     // Hex format #RRGGBB

  // CRITICAL: Decimal ordering prevents race conditions
  displayOrder Decimal   @default(1000) @map("display_order") @db.Decimal(20, 10)

  // CRITICAL: Optimistic locking
  version      Int       @default(1)

  // Timestamps with timezone
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  // Soft delete support
  deletedAt    DateTime? @map("deleted_at") @db.Timestamptz

  // Optimized indexes for common query patterns
  @@index([displayOrder], map: "idx_epic_display_order", type: BTree)
  @@index([status, displayOrder], map: "idx_epic_status_order")
  @@index([priority, displayOrder], map: "idx_epic_priority_order")
  @@index([quarter, displayOrder], map: "idx_epic_quarter_order")
  @@index([deletedAt], map: "idx_epic_soft_delete")
  @@index([createdAt], map: "idx_epic_created")
  @@index([updatedAt], map: "idx_epic_updated")

  @@map("epics")
}

enum EpicStatus {
  PLANNED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum EpicPriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}
```

### 1.2 Database Migration

**Execute migration safely**:
```bash
# Generate and apply migration
npx prisma migrate dev --name "add_epic_roadmap_schema"

# Generate updated Prisma client
npx prisma generate

# Verify schema in database
npx prisma db push --accept-data-loss  # Only in development!
```

### 1.3 Verify Database Setup

**Test database connection and schema**:
```bash
# Open Prisma Studio to verify schema
npm run db:studio

# Verify indexes were created
psql $DATABASE_URL -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'epics';"
```

## Phase 2: Backend API Implementation (90 minutes)

### 2.1 Fractional Ordering Utilities

**Create `src/lib/utils/fractionalIndexing.ts`**:
```typescript
import { Decimal } from '@prisma/client/runtime/library'

/**
 * Generates a fractional index between two values
 * Prevents race conditions in drag-and-drop operations
 */
export function generateOrderBetween(
  lower: Decimal | null,
  upper: Decimal | null
): Decimal {
  if (!lower && !upper) {
    return new Decimal(1000)
  }

  if (!lower) {
    return new Decimal(upper!.toNumber() - 500)
  }

  if (!upper) {
    return new Decimal(lower.toNumber() + 500)
  }

  const avg = lower.add(upper).div(2)
  return avg
}

/**
 * Normalize display orders when they get too close together
 */
export function normalizeOrders(epics: { id: string; displayOrder: Decimal }[]): {
  id: string;
  newOrder: Decimal;
}[] {
  return epics.map((epic, index) => ({
    id: epic.id,
    newOrder: new Decimal((index + 1) * 1000)
  }))
}
```

### 2.2 Epic Router Implementation

**Create `src/server/api/routers/epic.ts`**:
```typescript
import { z } from 'zod'
import { createTRPCRouter, publicProcedure } from '../trpc'
import { EpicStatus, EpicPriority, Prisma } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { generateOrderBetween } from '@/lib/utils/fractionalIndexing'

// Input validation schemas
const createEpicSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.nativeEnum(EpicStatus).optional(),
  priority: z.nativeEnum(EpicPriority).optional(),
  quarter: z.string().regex(/^Q[1-4]\s20\d{2}$/).optional(),
  outcome: z.string().optional(),
  icon: z.string().max(10).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

const updateEpicSchema = createEpicSchema.partial().extend({
  id: z.string().uuid(),
  version: z.number().int().positive(),
})

export const epicRouter = createTRPCRouter({
  // Create epic with proper ordering
  create: publicProcedure
    .input(createEpicSchema)
    .mutation(async ({ input, ctx }) => {
      // Get the highest display order
      const maxOrderEpic = await ctx.db.epic.findFirst({
        where: { deletedAt: null },
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true }
      })

      const newOrder = maxOrderEpic
        ? new Prisma.Decimal(maxOrderEpic.displayOrder.toNumber() + 1000)
        : new Prisma.Decimal(1000)

      return await ctx.db.epic.create({
        data: {
          ...input,
          displayOrder: newOrder,
        }
      })
    }),

  // List epics with pagination and filtering
  list: publicProcedure
    .input(z.object({
      cursor: z.string().uuid().optional(),
      limit: z.number().min(1).max(100).default(50),
      status: z.nativeEnum(EpicStatus).optional(),
      priority: z.nativeEnum(EpicPriority).optional(),
      quarter: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { cursor, limit, ...filters } = input

      const whereClause = {
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined)
        ),
        deletedAt: null,
      }

      const epics = await ctx.db.epic.findMany({
        where: whereClause,
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { displayOrder: 'asc' },
      })

      let nextCursor: string | undefined = undefined
      if (epics.length > limit) {
        const nextItem = epics.pop()
        nextCursor = nextItem!.id
      }

      return {
        items: epics,
        nextCursor,
      }
    }),

  // Get single epic by ID
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const epic = await ctx.db.epic.findUnique({
        where: {
          id: input.id,
          deletedAt: null
        }
      })

      if (!epic) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Epic not found'
        })
      }

      return epic
    }),

  // Update epic with optimistic locking
  update: publicProcedure
    .input(updateEpicSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, version, ...data } = input

      try {
        const epic = await ctx.db.epic.update({
          where: {
            id,
            version,
            deletedAt: null,
          },
          data: {
            ...data,
            version: { increment: 1 }
          }
        })

        return epic
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2025') {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Epic was modified by another user. Please refresh and try again.',
            })
          }
        }
        throw error
      }
    }),

  // Reorder epic with fractional indexing
  reorder: publicProcedure
    .input(z.object({
      epicId: z.string().uuid(),
      position: z.enum(['before', 'after']),
      targetId: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      return await ctx.db.$transaction(async (tx) => {
        // Get the epic being moved
        const epic = await tx.epic.findUnique({
          where: { id: input.epicId, deletedAt: null },
          select: { id: true, displayOrder: true, version: true }
        })

        if (!epic) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Epic to move not found'
          })
        }

        // Get target epic
        const target = await tx.epic.findUnique({
          where: { id: input.targetId, deletedAt: null },
          select: { displayOrder: true }
        })

        if (!target) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Target epic not found'
          })
        }

        // Calculate new position
        let newOrder: Prisma.Decimal

        if (input.position === 'before') {
          const prevEpic = await tx.epic.findFirst({
            where: {
              displayOrder: { lt: target.displayOrder },
              deletedAt: null,
            },
            orderBy: { displayOrder: 'desc' },
            select: { displayOrder: true }
          })

          newOrder = generateOrderBetween(
            prevEpic?.displayOrder || null,
            target.displayOrder
          )
        } else {
          const nextEpic = await tx.epic.findFirst({
            where: {
              displayOrder: { gt: target.displayOrder },
              deletedAt: null,
            },
            orderBy: { displayOrder: 'asc' },
            select: { displayOrder: true }
          })

          newOrder = generateOrderBetween(
            target.displayOrder,
            nextEpic?.displayOrder || null
          )
        }

        // Update with optimistic locking
        const updated = await tx.epic.update({
          where: {
            id: input.epicId,
            version: epic.version,
          },
          data: {
            displayOrder: newOrder,
            version: { increment: 1 }
          }
        })

        return updated
      })
    }),

  // Soft delete epic
  delete: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
      version: z.number().int().positive(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await ctx.db.epic.update({
          where: {
            id: input.id,
            version: input.version,
            deletedAt: null,
          },
          data: {
            deletedAt: new Date(),
            version: { increment: 1 }
          }
        })
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2025') {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Epic was modified by another user. Please refresh and try again.',
            })
          }
        }
        throw error
      }
    }),

  // Get roadmap statistics
  stats: publicProcedure
    .query(async ({ ctx }) => {
      const [
        total,
        byStatus,
        byPriority,
        byQuarter
      ] = await Promise.all([
        ctx.db.epic.count({
          where: { deletedAt: null }
        }),
        ctx.db.epic.groupBy({
          by: ['status'],
          where: { deletedAt: null },
          _count: { _all: true },
        }),
        ctx.db.epic.groupBy({
          by: ['priority'],
          where: { deletedAt: null },
          _count: { _all: true },
        }),
        ctx.db.epic.groupBy({
          by: ['quarter'],
          where: {
            deletedAt: null,
            quarter: { not: null }
          },
          _count: { _all: true },
        })
      ])

      return {
        total,
        byStatus,
        byPriority,
        byQuarter,
      }
    }),
})
```

### 2.3 Integrate Epic Router

**Update `src/server/api/root.ts`**:
```typescript
import { epicRouter } from './routers/epic'

export const appRouter = createTRPCRouter({
  conversation: conversationRouter,
  epic: epicRouter,  // Add this line
})
```

## Phase 3: Frontend Implementation (90 minutes)

### 3.1 Epic Types and Hooks

**Create `src/types/epic.ts`**:
```typescript
import type { Epic, EpicStatus, EpicPriority } from '@prisma/client'

export type { Epic, EpicStatus, EpicPriority }

export interface CreateEpicInput {
  title: string
  description?: string
  status?: EpicStatus
  priority?: EpicPriority
  quarter?: string
  outcome?: string
  icon?: string
  color?: string
}

export interface UpdateEpicInput extends Partial<CreateEpicInput> {
  id: string
  version: number
}

export interface EpicFilters {
  status?: EpicStatus
  priority?: EpicPriority
  quarter?: string
}
```

### 3.2 Epic Hooks

**Create `src/lib/hooks/useEpics.ts`**:
```typescript
import { api } from '@/lib/trpc/react'
import type { EpicFilters, CreateEpicInput, UpdateEpicInput } from '@/types/epic'

export function useEpics(filters?: EpicFilters) {
  return api.epic.list.useInfiniteQuery(
    {
      limit: 50,
      ...filters,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  )
}

export function useEpic(id: string) {
  return api.epic.getById.useQuery({ id })
}

export function useCreateEpic() {
  const utils = api.useUtils()

  return api.epic.create.useMutation({
    onSuccess: () => {
      utils.epic.list.invalidate()
      utils.epic.stats.invalidate()
    },
  })
}

export function useUpdateEpic() {
  const utils = api.useUtils()

  return api.epic.update.useMutation({
    onSuccess: () => {
      utils.epic.list.invalidate()
      utils.epic.stats.invalidate()
    },
  })
}

export function useReorderEpic() {
  const utils = api.useUtils()

  return api.epic.reorder.useMutation({
    onSuccess: () => {
      utils.epic.list.invalidate()
    },
  })
}

export function useDeleteEpic() {
  const utils = api.useUtils()

  return api.epic.delete.useMutation({
    onSuccess: () => {
      utils.epic.list.invalidate()
      utils.epic.stats.invalidate()
    },
  })
}

export function useEpicStats() {
  return api.epic.stats.useQuery()
}
```

### 3.3 Core Epic Components

**Create `src/components/epics/EpicCard.tsx`**:
```typescript
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Edit, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Epic } from '@/types/epic'
import { useDeleteEpic } from '@/lib/hooks/useEpics'

interface EpicCardProps {
  epic: Epic
  onEdit: (epic: Epic) => void
  onDragStart?: (e: React.DragEvent, epic: Epic) => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent, epic: Epic) => void
}

const statusColors = {
  PLANNED: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

const priorityColors = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
}

export function EpicCard({ epic, onEdit, onDragStart, onDragOver, onDrop }: EpicCardProps) {
  const [isDraggedOver, setIsDraggedOver] = useState(false)
  const deleteEpic = useDeleteEpic()

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this epic?')) {
      try {
        await deleteEpic.mutateAsync({
          id: epic.id,
          version: epic.version
        })
      } catch (error) {
        console.error('Failed to delete epic:', error)
        alert('Failed to delete epic. Please try again.')
      }
    }
  }

  const handleDragStart = (e: React.DragEvent) => {
    if (onDragStart) {
      onDragStart(e, epic)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggedOver(true)
    if (onDragOver) {
      onDragOver(e)
    }
  }

  const handleDragLeave = () => {
    setIsDraggedOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggedOver(false)
    if (onDrop) {
      onDrop(e, epic)
    }
  }

  return (
    <Card
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`cursor-move transition-all duration-200 ${
        isDraggedOver ? 'ring-2 ring-blue-500 bg-blue-50' : ''
      }`}
      style={{ borderColor: epic.color || undefined }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {epic.icon && <span className="text-lg">{epic.icon}</span>}
            <h3 className="font-semibold text-base">{epic.title}</h3>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(epic)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        {epic.description && (
          <p className="text-sm text-gray-600 mb-3">{epic.description}</p>
        )}

        <div className="flex flex-wrap gap-2 mb-3">
          <Badge className={statusColors[epic.status]}>
            {epic.status.replace('_', ' ')}
          </Badge>
          <Badge className={priorityColors[epic.priority]}>
            {epic.priority}
          </Badge>
          {epic.quarter && (
            <Badge variant="outline">{epic.quarter}</Badge>
          )}
        </div>

        {epic.outcome && (
          <div className="text-xs text-gray-500">
            <strong>Outcome:</strong> {epic.outcome}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

### 3.4 Epic List Component

**Create `src/components/epics/EpicList.tsx`**:
```typescript
'use client'

import { useState } from 'react'
import { EpicCard } from './EpicCard'
import { CreateEpicDialog } from './CreateEpicDialog'
import { EditEpicDialog } from './EditEpicDialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useEpics, useReorderEpic } from '@/lib/hooks/useEpics'
import type { Epic, EpicFilters } from '@/types/epic'

interface EpicListProps {
  filters?: EpicFilters
}

export function EpicList({ filters }: EpicListProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingEpic, setEditingEpic] = useState<Epic | null>(null)
  const [draggedEpic, setDraggedEpic] = useState<Epic | null>(null)

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isError,
  } = useEpics(filters)

  const reorderEpic = useReorderEpic()

  const epics = data?.pages.flatMap(page => page.items) ?? []

  const handleDragStart = (e: React.DragEvent, epic: Epic) => {
    setDraggedEpic(epic)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDrop = async (e: React.DragEvent, targetEpic: Epic) => {
    e.preventDefault()

    if (!draggedEpic || draggedEpic.id === targetEpic.id) {
      return
    }

    try {
      // Determine drop position based on mouse position
      const rect = e.currentTarget.getBoundingClientRect()
      const mouseY = e.clientY
      const cardCenter = rect.top + rect.height / 2
      const position = mouseY < cardCenter ? 'before' : 'after'

      await reorderEpic.mutateAsync({
        epicId: draggedEpic.id,
        position,
        targetId: targetEpic.id,
      })
    } catch (error) {
      console.error('Failed to reorder epic:', error)
    } finally {
      setDraggedEpic(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="text-center py-8 text-red-600">
        Failed to load epics. Please try again.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Roadmap Epics</h2>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Epic
        </Button>
      </div>

      <div className="space-y-3">
        {epics.map((epic) => (
          <EpicCard
            key={epic.id}
            epic={epic}
            onEdit={setEditingEpic}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
          />
        ))}
      </div>

      {hasNextPage && (
        <div className="text-center py-4">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={!hasNextPage}
          >
            Load More
          </Button>
        </div>
      )}

      <CreateEpicDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      {editingEpic && (
        <EditEpicDialog
          epic={editingEpic}
          open={!!editingEpic}
          onOpenChange={(open) => !open && setEditingEpic(null)}
        />
      )}
    </div>
  )
}
```

## Phase 4: Routing and Page Structure (30 minutes)

### 4.1 Roadmap Page

**Create `src/app/roadmap/page.tsx`**:
```typescript
import { EpicList } from '@/components/epics/EpicList'
import { EpicStats } from '@/components/epics/EpicStats'

export default function RoadmapPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Project Roadmap</h1>
        <p className="text-gray-600">
          Plan and track epics for long-term project success
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <EpicStats />
        </div>
        <div className="lg:col-span-3">
          <EpicList />
        </div>
      </div>
    </div>
  )
}
```

### 4.2 Navigation Integration

**Update main navigation** (in `src/app/layout.tsx` or navigation component):
```typescript
// Add roadmap link to your navigation
{
  href: "/roadmap",
  label: "Roadmap",
  icon: MapIcon
}
```

## Phase 5: Testing and Validation (45 minutes)

### 5.1 Manual Testing Checklist

**Core Functionality**:
- [ ] Create new epic
- [ ] Edit existing epic
- [ ] Delete epic
- [ ] Drag and drop reordering
- [ ] Filter by status/priority/quarter
- [ ] Pagination works correctly

**Edge Cases**:
- [ ] Concurrent editing (open same epic in two tabs)
- [ ] Network errors during operations
- [ ] Very long epic titles/descriptions
- [ ] Special characters in epic data
- [ ] Drag and drop with network latency

### 5.2 Performance Validation

**Database Performance**:
```bash
# Check query performance
npm run db:studio

# Run EXPLAIN ANALYZE on key queries
psql $DATABASE_URL -c "EXPLAIN ANALYZE SELECT * FROM epics WHERE deleted_at IS NULL ORDER BY display_order LIMIT 50;"
```

**Response Time Testing**:
```typescript
// Add to browser console for testing
const testCreateEpic = async () => {
  const start = performance.now()
  await fetch('/api/trpc/epic.create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Test Epic',
      description: 'Performance test epic'
    })
  })
  const end = performance.now()
  console.log(`Create epic took ${end - start}ms`)
}
```

### 5.3 Error Handling Verification

**Test Error Scenarios**:
- Database connection loss
- Optimistic locking conflicts
- Invalid input validation
- Rate limiting (if implemented)
- Network timeout scenarios

## Phase 6: Production Deployment (30 minutes)

### 6.1 Environment Configuration

**Production environment variables**:
```bash
# Ensure these are set in Render
DATABASE_URL="postgresql://[optimized-connection-string]"
DIRECT_URL="postgresql://[direct-connection-string]"
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://your-app.onrender.com"
```

### 6.2 Database Migration in Production

**Safe production deployment**:
```bash
# Deploy migrations
npx prisma migrate deploy

# Verify production database
npx prisma db pull
```

### 6.3 Monitoring Setup

**Add basic monitoring**:
```typescript
// In src/server/db.ts - enhance existing monitoring
if (process.env.NODE_ENV === 'production') {
  db.$on('query', (e) => {
    if (e.duration > 1000) {
      console.warn(`[SLOW QUERY] ${e.duration}ms:`, e.query.substring(0, 100))
    }
  })
}
```

## Success Criteria Verification

### Performance Targets
- [ ] Create epic: <30ms response time
- [ ] List epics: <20ms response time
- [ ] Reorder epic: <40ms response time
- [ ] Update epic: <30ms response time

### Functionality Validation
- [ ] All CRUD operations work correctly
- [ ] Drag and drop reordering functions without conflicts
- [ ] Optimistic locking prevents data loss
- [ ] Pagination handles large datasets
- [ ] Filters work correctly

### User Experience
- [ ] Responsive design works on mobile/desktop
- [ ] Loading states provide good feedback
- [ ] Error messages are helpful
- [ ] Interface is intuitive and matches existing app design

## Next Steps and Extensions

### Immediate Enhancements (if time permits)
- Add epic search functionality
- Implement bulk operations
- Add keyboard shortcuts for power users
- Enhanced filtering options

### Future Roadmap
- Epic dependencies visualization
- Time estimation and tracking
- Team assignment capabilities
- Integration with conversation system for epic-related discussions
- AI-powered epic suggestion and optimization

## Troubleshooting Common Issues

### Database Connection Issues
```bash
# Verify connection string format
echo $DATABASE_URL

# Test direct connection
psql "$DATABASE_URL" -c "SELECT version();"
```

### Migration Problems
```bash
# Reset development database if needed
npx prisma migrate reset

# Check migration status
npx prisma migrate status
```

### Performance Issues
```sql
-- Check index usage
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM epics
WHERE deleted_at IS NULL
ORDER BY display_order
LIMIT 50;
```

## Support and Resources

- **Prisma Documentation**: https://www.prisma.io/docs
- **tRPC Documentation**: https://trpc.io/docs
- **Next.js App Router**: https://nextjs.org/docs/app
- **Performance Optimization**: See ARCHITECTURAL_DECISIONS.md

This implementation guide provides a complete path from current state to fully functional roadmap planning capability. Each phase builds incrementally, allowing for testing and validation at each step while maintaining the existing application's stability and performance.