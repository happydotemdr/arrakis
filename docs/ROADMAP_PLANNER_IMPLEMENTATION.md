# Simple Roadmap Planner - Complete Implementation Guide

> **Date**: September 29, 2025
> **Purpose**: Comprehensive documentation for implementing a minimal roadmap planning application
> **Status**: Dependencies installed, ready for implementation

## Table of Contents
1. [Project Vision](#project-vision)
2. [Current State](#current-state)
3. [Research Findings](#research-findings)
4. [Technical Architecture](#technical-architecture)
5. [Data Model](#data-model)
6. [Implementation Roadmap](#implementation-roadmap)
7. [Component Specifications](#component-specifications)
8. [Styling Guidelines](#styling-guidelines)
9. [Infrastructure Details](#infrastructure-details)
10. [Code Examples](#code-examples)
11. [Testing Strategy](#testing-strategy)
12. [Deployment Checklist](#deployment-checklist)

---

## Project Vision

### What We're Building
A **simple, list-based roadmap planning application** for managing epics (high-level features/initiatives). Think of it as a stripped-down version of ProductPlan or Roadmunk, but with a fun 1990's sci-fi aesthetic.

### Core Requirements
- **Epic-level planning only** (no tasks, subtasks, or granular breakdown)
- **CRUD operations** for managing epics
- **Drag-and-drop reordering** of epics
- **Status tracking** (Planned, In Progress, Completed, Cancelled)
- **Priority levels** (Low, Medium, High, Critical)
- **Quarterly planning** support
- **Outcome-focused** descriptions

### Design Philosophy
- **Minimalist**: Only essential features, no bloat
- **Type-safe**: End-to-end type safety with TypeScript
- **Fun**: 1990's sci-fi aesthetic with neon colors and retro icons
- **Accessible**: Colorblind-friendly palette
- **Fast**: Optimized for speed and responsiveness

### Explicitly Out of Scope
❌ Authentication/Authorization
❌ User management
❌ Redis or caching layers
❌ Complex state management
❌ External integrations
❌ Task/subtask breakdown
❌ Comments or attachments
❌ Time tracking
❌ Gantt charts or timeline views

---

## Current State

### ✅ Already Completed
1. **Dependencies Installed** - All required packages are in package.json:
   - Next.js 15.5.4
   - Prisma 6.16.2 & @prisma/client
   - tRPC 11.6.0 (all packages)
   - Zod 4.1.11
   - React Query 5.90.2
   - TailwindCSS 3.5.1
   - TypeScript 5.9.2

2. **Scripts Configured** - package.json has all necessary scripts:
   - Development: `npm run dev`
   - Database: `npm run db:push`, `npm run db:migrate`
   - Type checking: `npm run type-check`
   - Linting: `npm run lint` (ESLint v9 flat config), `npm run lint:fix`

3. **Infrastructure Ready**:
   - PostgreSQL database: `arrakis-prod-db` (PostgreSQL 17)
   - Database name: `arrakis_production_bq3v`
   - Render workspace: `tea-d303qfodl3ps739p3e60`

### ⏳ Next Steps Required
1. Initialize Next.js app structure
2. Create Prisma schema
3. Set up tRPC router
4. Build UI components
5. Apply styling
6. Test functionality
7. Deploy to Render

---

## Research Findings

### Roadmap Planning Best Practices

1. **Epic-Level Focus**
   - Roadmaps should focus on high-level outcomes
   - Avoid getting lost in granular details
   - Each epic should represent a significant deliverable

2. **Outcome-Based Planning**
   - Focus on the "why" not just the "what"
   - Each epic should have a clear expected outcome
   - Metrics for success should be defined

3. **Visual Hierarchy**
   - Clear status indicators
   - Priority levels visually distinct
   - Temporal organization (quarters/timeframes)

4. **Flexibility**
   - Easy to reorder and reprioritize
   - Status changes should be simple
   - Allow for iteration and change

---

## Technical Architecture

### Stack Overview
```
┌─────────────────────────────────────────┐
│           Frontend (Next.js)            │
│  - React 19 with App Router             │
│  - TailwindCSS for styling              │
│  - tRPC React Query client              │
└─────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────┐
│          API Layer (tRPC)               │
│  - Type-safe procedures                 │
│  - Zod validation                       │
│  - SuperJSON for serialization          │
└─────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────┐
│         Data Layer (Prisma)             │
│  - Type-safe ORM                        │
│  - Migration management                 │
│  - Query optimization                   │
└─────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────┐
│      Database (PostgreSQL 17)           │
│  - Hosted on Render                     │
│  - SSL enabled                          │
└─────────────────────────────────────────┘
```

### Why This Stack?

**Next.js 14 (App Router)**
- Server Components for better performance
- Built-in API routes for tRPC
- Excellent TypeScript support
- Easy deployment to Render

**Prisma + PostgreSQL**
- Type-safe database queries
- Automatic migration generation
- Excellent developer experience
- Already have PostgreSQL provisioned

**tRPC**
- End-to-end type safety
- No need for API documentation
- Automatic client generation
- Works perfectly with React Query

**Zod**
- Runtime validation
- TypeScript type inference
- Works seamlessly with tRPC
- Clear error messages

---

## Data Model

### Prisma Schema (`prisma/schema.prisma`)

```prisma
// This is your Prisma schema file
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Epic {
  id          String    @id @default(cuid())
  title       String
  description String?   @db.Text
  status      Status    @default(PLANNED)
  priority    Priority  @default(MEDIUM)
  quarter     String?   // e.g., "Q1 2025", "Q2 2025"
  outcome     String?   @db.Text // Expected outcome/objective
  icon        String?   // Fun 90's icon/emoji (🚀, 📡, 💾, etc.)
  color       String?   // Theme color in hex (#00FFFF)
  order       Int       @default(autoincrement())
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([status])
  @@index([priority])
  @@index([order])
}

enum Status {
  PLANNED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}
```

### Field Explanations

- **id**: CUID for globally unique identifiers
- **title**: Epic name (required)
- **description**: Detailed description (optional)
- **status**: Current state of the epic
- **priority**: Importance level for visual hierarchy
- **quarter**: Planning period (flexible string format)
- **outcome**: Expected result/objective
- **icon**: Fun visual element (emoji or icon name)
- **color**: Custom color for the epic card
- **order**: For drag-and-drop reordering
- **timestamps**: Automatic tracking

---

## Implementation Roadmap

### Phase 1: Project Setup (30 mins)

#### 1.1 Initialize Next.js Structure
```bash
# Create essential directories
mkdir -p src/app/api/trpc/[trpc]
mkdir -p src/components/epics
mkdir -p src/components/ui
mkdir -p src/server/api/routers
mkdir -p src/lib
mkdir -p src/styles
mkdir -p prisma
```

#### 1.2 Create TypeScript Configuration
Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

#### 1.3 Configure Next.js
Create `next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
}

module.exports = nextConfig
```

### Phase 2: Database Setup (20 mins)

#### 2.1 Initialize Prisma
```bash
npx prisma init
```

#### 2.2 Update `.env.local`
```env
# Existing DATABASE_URL from Render
DATABASE_URL="postgresql://..."

# Add for Next.js
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

#### 2.3 Create Prisma Schema
Copy the schema from the [Data Model](#data-model) section above.

#### 2.4 Push Schema to Database
```bash
npm run db:push
```

### Phase 3: Backend Implementation (45 mins)

#### 3.1 Database Client (`src/server/db.ts`)
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

#### 3.2 tRPC Setup (`src/server/api/trpc.ts`)
```typescript
import { initTRPC } from '@trpc/server'
import superjson from 'superjson'
import { ZodError } from 'zod'

const t = initTRPC.create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure
```

#### 3.3 Epic Router (`src/server/api/routers/epic.ts`)
See [Code Examples](#code-examples) section for full implementation.

#### 3.4 Root Router (`src/server/api/root.ts`)
```typescript
import { createTRPCRouter } from './trpc'
import { epicRouter } from './routers/epic'

export const appRouter = createTRPCRouter({
  epic: epicRouter,
})

export type AppRouter = typeof appRouter
```

### Phase 4: Frontend Setup (30 mins)

#### 4.1 tRPC Client (`src/lib/trpc.ts`)
```typescript
import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@/server/api/root'

export const api = createTRPCReact<AppRouter>()
```

#### 4.2 App Layout (`src/app/layout.tsx`)
```typescript
import '@/styles/globals.css'
import { TRPCProvider } from '@/lib/trpc-provider'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="retro-theme">
        <TRPCProvider>
          {children}
        </TRPCProvider>
      </body>
    </html>
  )
}
```

### Phase 5: Component Implementation (1 hour)

See [Component Specifications](#component-specifications) for detailed breakdowns.

### Phase 6: Styling (30 mins)

See [Styling Guidelines](#styling-guidelines) for the complete theme.

### Phase 7: Testing & Deployment (30 mins)

1. Test all CRUD operations
2. Verify database connectivity
3. Check responsive design
4. Update render.yaml for Next.js
5. Deploy to Render

---

## Component Specifications

### Layout Components

#### Header Component (`src/components/Header.tsx`)
```typescript
// Features:
// - Retro terminal-style title "ROADMAP CONTROL SYSTEM"
// - Glowing neon text effect
// - Current date/time display (90's style)
// - Optional status indicators

interface HeaderProps {
  totalEpics: number
  completedEpics: number
}
```

#### Sidebar Component (`src/components/Sidebar.tsx`)
```typescript
// Features:
// - Filter by status (All, Planned, In Progress, Completed)
// - Filter by priority
// - Quick stats display
// - "Add Epic" button with retro styling

interface SidebarProps {
  filters: FilterState
  onFilterChange: (filters: FilterState) => void
  onAddEpic: () => void
}
```

### Epic Components

#### EpicList Component (`src/components/epics/EpicList.tsx`)
```typescript
// Features:
// - Displays epics as cards
// - Drag-and-drop reordering
// - Empty state with retro ASCII art
// - Loading state with scanline effect

interface EpicListProps {
  epics: Epic[]
  onReorder: (epicId: string, newOrder: number) => void
  onEdit: (epic: Epic) => void
  onDelete: (epicId: string) => void
}
```

#### EpicCard Component (`src/components/epics/EpicCard.tsx`)
```typescript
// Features:
// - Display epic details
// - Status badge with color coding
// - Priority indicator
// - Icon display
// - Hover effects (neon glow)
// - Edit/Delete actions

interface EpicCardProps {
  epic: Epic
  onEdit: () => void
  onDelete: () => void
  isDragging?: boolean
}
```

#### EpicForm Component (`src/components/epics/EpicForm.tsx`)
```typescript
// Features:
// - Modal or inline form
// - All epic fields
// - Icon picker (emoji selector)
// - Color picker (preset palette)
// - Validation feedback
// - Retro form styling

interface EpicFormProps {
  epic?: Epic // If provided, edit mode
  onSubmit: (data: EpicFormData) => void
  onCancel: () => void
}
```

### UI Components

#### StatusBadge Component (`src/components/ui/StatusBadge.tsx`)
```typescript
// Features:
// - Color-coded by status
// - Animated pulse for "In Progress"
// - Retro pixel font

interface StatusBadgeProps {
  status: Status
  size?: 'sm' | 'md' | 'lg'
}
```

#### PriorityIndicator Component (`src/components/ui/PriorityIndicator.tsx`)
```typescript
// Features:
// - Visual indicators (▲ symbols)
// - Color intensity by priority
// - Tooltip on hover

interface PriorityIndicatorProps {
  priority: Priority
}
```

---

## Styling Guidelines

### 1990's Sci-Fi Aesthetic

#### Color Palette (CSS Variables)
```css
:root {
  /* Primary Colors - Neon/Cyberpunk */
  --neon-cyan: #00FFFF;
  --neon-magenta: #FF00FF;
  --neon-yellow: #FFFF00;
  --neon-green: #00FF00;

  /* Status Colors (Colorblind-friendly) */
  --status-planned: #708090;     /* Slate Gray */
  --status-progress: #00CED1;    /* Dark Turquoise */
  --status-completed: #32CD32;   /* Lime Green */
  --status-cancelled: #DC143C;   /* Crimson */

  /* Priority Colors */
  --priority-low: #87CEEB;       /* Sky Blue */
  --priority-medium: #FFD700;    /* Gold */
  --priority-high: #FF8C00;      /* Dark Orange */
  --priority-critical: #FF1493;  /* Deep Pink */

  /* Background */
  --bg-dark: #0A0A0A;
  --bg-card: #1A1A2E;
  --bg-hover: #16213E;

  /* Text */
  --text-primary: #E0E0E0;
  --text-secondary: #A0A0A0;
  --text-accent: var(--neon-cyan);
}
```

#### Typography
```css
/* Import retro fonts */
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');

.retro-theme {
  --font-heading: 'Orbitron', monospace;
  --font-body: 'Share Tech Mono', monospace;
}
```

#### Special Effects
```css
/* Neon Glow Effect */
.neon-glow {
  text-shadow:
    0 0 10px var(--neon-cyan),
    0 0 20px var(--neon-cyan),
    0 0 30px var(--neon-cyan);
}

/* Scanline Animation */
@keyframes scanline {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
}

.scanline::before {
  content: '';
  position: absolute;
  width: 100%;
  height: 2px;
  background: linear-gradient(transparent, var(--neon-cyan), transparent);
  animation: scanline 3s linear infinite;
}

/* Glitch Effect */
@keyframes glitch {
  0%, 100% { transform: translate(0); }
  20% { transform: translate(-1px, 1px); }
  40% { transform: translate(-1px, -1px); }
  60% { transform: translate(1px, 1px); }
  80% { transform: translate(1px, -1px); }
}

/* Terminal Cursor */
.terminal-cursor::after {
  content: '_';
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
```

#### Component Styling Examples

**Epic Card**
```css
.epic-card {
  background: var(--bg-card);
  border: 1px solid var(--neon-cyan);
  border-radius: 0; /* Sharp corners for retro feel */
  padding: 1rem;
  position: relative;
  transition: all 0.3s ease;
}

.epic-card:hover {
  border-color: var(--neon-magenta);
  box-shadow:
    0 0 10px var(--neon-magenta),
    inset 0 0 10px rgba(255, 0, 255, 0.1);
  transform: translateY(-2px);
}

.epic-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg,
    transparent,
    var(--neon-cyan),
    transparent
  );
  animation: slide 2s linear infinite;
}
```

### Icon Set (90's Theme)
```
Recommended emojis/icons:
🚀 - Launch/Deploy
📡 - Communication/API
💾 - Save/Storage
🛸 - Future/Innovation
⚡ - Performance/Speed
🎮 - Gaming/Fun features
🤖 - Automation
📟 - Legacy/Retro
🔬 - Research/Experiment
🌐 - Global/Network
💿 - Database
📺 - Display/UI
🕹️ - Control/Admin
⚠️ - Warning
✅ - Success
```

---

## Infrastructure Details

### Render Configuration

#### Current Setup
- **Database**: arrakis-prod-db
  - Type: PostgreSQL 17
  - Plan: basic-256mb ($7/month)
  - Name: arrakis_production_bq3v
  - User: arrakis_prod_user
  - Region: Oregon
  - SSL: Required

- **Web Service**: arrakis-prod
  - Runtime: Node.js
  - Plan: starter ($5/month)
  - Region: Oregon
  - Branch: master
  - Auto-deploy: Disabled

#### Required Updates to `render.yaml`
```yaml
services:
  - type: web
    name: arrakis-prod
    runtime: node
    plan: starter
    region: oregon
    repo: https://github.com/happydotemdr/arrakis.git
    branch: master
    autoDeploy: false
    buildCommand: "npm install && npm run build"
    startCommand: "npm start"
    healthCheckPath: /health
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: arrakis-prod-db
          property: connectionString
      - key: NODE_ENV
        value: production
```

### Environment Variables

#### Development (`.env.local`)
```env
DATABASE_URL="postgresql://[from Render dashboard]"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
```

#### Production (Render Dashboard)
```env
DATABASE_URL=[auto-linked from database]
NEXT_PUBLIC_APP_URL="https://arrakis-prod.onrender.com"
NODE_ENV="production"
```

---

## Code Examples

### Complete Epic Router Implementation

```typescript
// src/server/api/routers/epic.ts
import { z } from 'zod'
import { createTRPCRouter, publicProcedure } from '../trpc'
import { db } from '@/server/db'
import { Status, Priority } from '@prisma/client'

// Validation schemas
const createEpicSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  status: z.nativeEnum(Status).optional(),
  priority: z.nativeEnum(Priority).optional(),
  quarter: z.string().optional(),
  outcome: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

const updateEpicSchema = createEpicSchema.partial().extend({
  id: z.string(),
})

const reorderEpicSchema = z.object({
  epicId: z.string(),
  newOrder: z.number().int().positive(),
})

export const epicRouter = createTRPCRouter({
  // Create a new epic
  create: publicProcedure
    .input(createEpicSchema)
    .mutation(async ({ input }) => {
      const epic = await db.epic.create({
        data: input,
      })
      return epic
    }),

  // Get all epics
  list: publicProcedure
    .input(z.object({
      status: z.nativeEnum(Status).optional(),
      priority: z.nativeEnum(Priority).optional(),
    }).optional())
    .query(async ({ input }) => {
      const where = {
        ...(input?.status && { status: input.status }),
        ...(input?.priority && { priority: input.priority }),
      }

      const epics = await db.epic.findMany({
        where,
        orderBy: { order: 'asc' },
      })

      return epics
    }),

  // Get a single epic
  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const epic = await db.epic.findUnique({
        where: { id: input.id },
      })

      if (!epic) {
        throw new Error('Epic not found')
      }

      return epic
    }),

  // Update an epic
  update: publicProcedure
    .input(updateEpicSchema)
    .mutation(async ({ input }) => {
      const { id, ...data } = input

      const epic = await db.epic.update({
        where: { id },
        data,
      })

      return epic
    }),

  // Delete an epic
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.epic.delete({
        where: { id: input.id },
      })

      return { success: true }
    }),

  // Reorder epics
  reorder: publicProcedure
    .input(reorderEpicSchema)
    .mutation(async ({ input }) => {
      const { epicId, newOrder } = input

      // Get the current epic
      const epic = await db.epic.findUnique({
        where: { id: epicId },
      })

      if (!epic) {
        throw new Error('Epic not found')
      }

      const oldOrder = epic.order

      // Update orders for affected epics
      if (oldOrder < newOrder) {
        // Moving down
        await db.epic.updateMany({
          where: {
            order: {
              gt: oldOrder,
              lte: newOrder,
            },
          },
          data: {
            order: {
              decrement: 1,
            },
          },
        })
      } else if (oldOrder > newOrder) {
        // Moving up
        await db.epic.updateMany({
          where: {
            order: {
              gte: newOrder,
              lt: oldOrder,
            },
          },
          data: {
            order: {
              increment: 1,
            },
          },
        })
      }

      // Update the moved epic
      const updatedEpic = await db.epic.update({
        where: { id: epicId },
        data: { order: newOrder },
      })

      return updatedEpic
    }),

  // Get statistics
  stats: publicProcedure
    .query(async () => {
      const [total, byStatus, byPriority] = await Promise.all([
        db.epic.count(),
        db.epic.groupBy({
          by: ['status'],
          _count: true,
        }),
        db.epic.groupBy({
          by: ['priority'],
          _count: true,
        }),
      ])

      return {
        total,
        byStatus,
        byPriority,
      }
    }),
})
```

### Main Page Implementation

```typescript
// src/app/page.tsx
'use client'

import { useState } from 'react'
import { api } from '@/lib/trpc'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { EpicList } from '@/components/epics/EpicList'
import { EpicForm } from '@/components/epics/EpicForm'
import { Status, Priority } from '@prisma/client'

export default function RoadmapPage() {
  const [filters, setFilters] = useState<{
    status?: Status
    priority?: Priority
  }>({})

  const [showForm, setShowForm] = useState(false)
  const [editingEpic, setEditingEpic] = useState<Epic | null>(null)

  // Queries
  const { data: epics, isLoading, refetch } = api.epic.list.useQuery(filters)
  const { data: stats } = api.epic.stats.useQuery()

  // Mutations
  const createEpic = api.epic.create.useMutation({
    onSuccess: () => {
      refetch()
      setShowForm(false)
    },
  })

  const updateEpic = api.epic.update.useMutation({
    onSuccess: () => {
      refetch()
      setEditingEpic(null)
    },
  })

  const deleteEpic = api.epic.delete.useMutation({
    onSuccess: () => refetch(),
  })

  const reorderEpic = api.epic.reorder.useMutation({
    onSuccess: () => refetch(),
  })

  return (
    <div className="min-h-screen retro-theme">
      <Header
        totalEpics={stats?.total || 0}
        completedEpics={
          stats?.byStatus.find(s => s.status === 'COMPLETED')?._count || 0
        }
      />

      <div className="flex">
        <Sidebar
          filters={filters}
          onFilterChange={setFilters}
          onAddEpic={() => setShowForm(true)}
        />

        <main className="flex-1 p-6">
          {isLoading ? (
            <div className="loading-scanline">Loading roadmap data...</div>
          ) : (
            <EpicList
              epics={epics || []}
              onReorder={(id, order) => reorderEpic.mutate({ epicId: id, newOrder: order })}
              onEdit={setEditingEpic}
              onDelete={(id) => deleteEpic.mutate({ id })}
            />
          )}
        </main>
      </div>

      {(showForm || editingEpic) && (
        <EpicForm
          epic={editingEpic}
          onSubmit={(data) => {
            if (editingEpic) {
              updateEpic.mutate({ id: editingEpic.id, ...data })
            } else {
              createEpic.mutate(data)
            }
          }}
          onCancel={() => {
            setShowForm(false)
            setEditingEpic(null)
          }}
        />
      )}
    </div>
  )
}
```

---

## Testing Strategy

### Unit Tests to Implement
1. **tRPC Procedures** - Test all CRUD operations
2. **Validation** - Ensure Zod schemas work correctly
3. **Reordering Logic** - Verify order updates work

### Integration Tests
1. **Database Operations** - Test Prisma queries
2. **API Routes** - Test tRPC endpoints
3. **Component Interactions** - Test form submissions

### Manual Testing Checklist
- [ ] Create an epic with all fields
- [ ] Edit an existing epic
- [ ] Delete an epic
- [ ] Reorder epics via drag-and-drop
- [ ] Filter by status
- [ ] Filter by priority
- [ ] Check responsive design
- [ ] Verify colorblind accessibility
- [ ] Test keyboard navigation
- [ ] Check loading states
- [ ] Verify error handling

---

## Deployment Checklist

### Pre-Deployment
- [ ] Run type checking: `npm run type-check`
- [ ] Run linter: `npm run lint`
- [ ] Build locally: `npm run build`
- [ ] Test production build: `npm start`
- [ ] Update environment variables in Render
- [ ] Update render.yaml for Next.js

### Deployment Steps
1. **Commit all changes**
   ```bash
   git add .
   git commit -m "feat: implement roadmap planner with Next.js, Prisma, and tRPC"
   ```

2. **Push to GitHub**
   ```bash
   git push origin master
   ```

3. **Deploy on Render**
   - Manual trigger (auto-deploy is disabled)
   - Monitor build logs
   - Check health endpoint

### Post-Deployment
- [ ] Verify database connection
- [ ] Test all CRUD operations
- [ ] Check performance metrics
- [ ] Monitor error logs
- [ ] Verify SSL certificate

---

## Troubleshooting Guide

### Common Issues & Solutions

#### Database Connection Issues
```typescript
// If DATABASE_URL is not working, check:
// 1. SSL settings in Prisma schema
// 2. IP allowlist in Render dashboard
// 3. Connection string format

// Add to schema.prisma if needed:
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  relationMode = "prisma" // If using Prisma-level relations
}
```

#### tRPC Type Issues
```typescript
// If types aren't syncing:
// 1. Restart TypeScript server
// 2. Run: npm run db:generate
// 3. Check imports are from correct paths
```

#### Build Failures
```bash
# Common fixes:
npm run db:generate  # Regenerate Prisma client
npm run type-check   # Find type errors
npm run lint         # Find linting issues
```

#### Styling Not Applied
```css
/* Ensure Tailwind is configured properly */
/* Check that globals.css imports are correct */
/* Verify CSS module imports in components */
```

---

## Future Enhancements (Out of Current Scope)

Once the MVP is complete, consider these additions:

1. **Authentication** - Add user accounts with Clerk or NextAuth
2. **Teams** - Multiple users working on same roadmap
3. **Timeline View** - Gantt chart visualization
4. **Dependencies** - Link related epics
5. **Attachments** - File uploads for epics
6. **Comments** - Discussion threads
7. **History** - Track changes over time
8. **Export** - PDF/CSV export functionality
9. **Notifications** - Email/Slack alerts
10. **API** - Public API for integrations

---

## Resources & References

### Documentation
- [Next.js 14 Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [tRPC Docs](https://trpc.io/docs)
- [Zod Docs](https://zod.dev)
- [React Query Docs](https://tanstack.com/query/latest)

### Inspiration
- [ProductPlan](https://www.productplan.com)
- [Roadmunk](https://roadmunk.com)
- [90s Sci-Fi UI Gallery](https://www.hudsandguis.com)

### Tools
- [Coolors](https://coolors.co) - Color palette generator
- [Contrast Checker](https://webaim.org/resources/contrastchecker/) - Accessibility
- [Emoji Reference](https://emojipedia.org) - Icon selection

---

## Final Notes for Next Agent

### Current Status
✅ All dependencies installed
✅ Database provisioned and ready
✅ Package.json configured
⏳ Need to create file structure
⏳ Need to implement components
⏳ Need to apply styling
⏳ Need to test and deploy

### Immediate Next Steps
1. Run `npm install` to ensure all dependencies are installed
2. Create the file structure as outlined
3. Set up Prisma schema and push to database
4. Implement tRPC router
5. Build UI components
6. Apply retro styling
7. Test locally
8. Deploy to Render

### Key Decisions Made
- **No authentication** - Keep it simple for MVP
- **Epic-level only** - No task breakdown
- **List view only** - No timeline/Gantt charts
- **Drag-and-drop** - For intuitive reordering
- **90's aesthetic** - Fun and distinctive

### Time Estimate
- Setup: 30 minutes
- Backend: 45 minutes
- Frontend: 1 hour
- Styling: 30 minutes
- Testing: 30 minutes
- **Total: ~3 hours**

### Contact & Questions
If you need clarification on any decisions or run into issues:
1. Check this documentation first
2. Review the Render dashboard for infrastructure details
3. Test database connectivity before proceeding

Good luck with the implementation! 🚀

---

*Document created: September 29, 2025*
*Last updated: September 29, 2025*
*Version: 1.0.0*