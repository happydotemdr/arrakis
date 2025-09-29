# Coding Conventions & Best Practices

**Last Updated**: 2025-09-29

## Code Style Guidelines

### TypeScript Configuration

**Strict Mode**: Enabled throughout the project

```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "moduleResolution": "bundler",
    "jsx": "preserve"
  }
}
```

### Formatting Rules

- **Line Width**: 80 characters (code and markdown)
- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes for JavaScript/TypeScript
- **Semicolons**: Only when needed (ASI-safe)
- **Trailing Commas**: ES5 style (objects/arrays)

### File Organization

```
src/
├── app/              # Next.js pages and routes
├── components/       # Reusable React components
│   ├── ui/          # Base UI components (shadcn/ui)
│   └── [feature]/   # Feature-specific components
├── lib/             # Shared utilities and configurations
├── server/          # Server-side code (tRPC, database)
├── types/           # TypeScript type definitions
└── utils/           # Helper functions
```

## Naming Conventions

### Files & Directories

```typescript
// Components (PascalCase)
components/EpicCard.tsx
components/ui/Button.tsx

// Utilities (camelCase)
lib/utils.ts
lib/trpc/client.ts

// Types (camelCase)
types/index.ts
types/api.ts

// API routes (kebab-case for URLs)
app/api/trpc/[trpc]/route.ts
```

### Variables & Functions

```typescript
// Variables (camelCase)
const userName = 'John'
const isActive = true

// Functions (camelCase)
function getUserData() {}
const handleClick = () => {}

// React Components (PascalCase)
function EpicCard() {}
export const Button = () => {}

// Constants (SCREAMING_SNAKE_CASE)
const API_URL = 'https://api.example.com'
const MAX_RETRIES = 3

// Types & Interfaces (PascalCase)
interface User {}
type Epic = {}
```

### Database Models

```typescript
// Prisma models (PascalCase)
model Conversation {}
model Message {}
model ToolUse {}

// Enum values (SCREAMING_SNAKE_CASE)
enum Status {
  PLANNED
  IN_PROGRESS
  COMPLETED
}

// Table names (snake_case)
@@map("conversations")
@@map("tool_uses")
```

## tRPC Patterns

### Router Structure

```typescript
// src/server/api/routers/[resource].ts
import { z } from 'zod'
import { createTRPCRouter, publicProcedure } from '../trpc'

export const resourceRouter = createTRPCRouter({
  // Query (read operations)
  list: publicProcedure.input(z.object({...})).query(async ({ input }) => {
    // Implementation
  }),

  byId: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    // Implementation
  }),

  // Mutation (write operations)
  create: publicProcedure.input(z.object({...})).mutation(async ({ input }) => {
    // Implementation
  }),

  update: publicProcedure.input(z.object({...})).mutation(async ({ input }) => {
    // Implementation
  }),

  delete: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    // Implementation
  }),
})
```

### Input Validation with Zod

```typescript
// Always validate inputs
const createSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED']),
  priority: z.number().int().min(1).max(4),
})

// Reuse schemas
const updateSchema = createSchema.partial().extend({
  id: z.string(),
})
```

### Error Handling

```typescript
// Use tRPC error types
import { TRPCError } from '@trpc/server'

// Throw meaningful errors
throw new TRPCError({
  code: 'NOT_FOUND',
  message: 'Resource not found',
})

// Common error codes:
// - BAD_REQUEST
// - UNAUTHORIZED
// - FORBIDDEN
// - NOT_FOUND
// - INTERNAL_SERVER_ERROR
```

## React Best Practices

### Component Structure

```typescript
'use client' // Only when needed (client components)

import { useState } from 'react'
import { api } from '@/lib/trpc'

interface Props {
  // Props definition
}

export function ComponentName({ prop1, prop2 }: Props) {
  // 1. Hooks
  const [state, setState] = useState()
  const query = api.resource.list.useQuery()

  // 2. Derived values
  const derivedValue = useMemo(() => {}, [deps])

  // 3. Event handlers
  const handleClick = () => {}

  // 4. Effects
  useEffect(() => {}, [deps])

  // 5. Render
  return <div>...</div>
}
```

### Client vs Server Components

```typescript
// Server Component (default)
// - No useState, useEffect, event handlers
// - Can directly access database
// - Better performance

// Client Component (use sparingly)
// - Mark with 'use client'
// - Interactive features (onClick, forms)
// - React hooks (useState, useEffect)
```

### State Management

```typescript
// Local state
const [state, setState] = useState()

// Server state (React Query via tRPC)
const { data, isLoading } = api.resource.list.useQuery()

// Form state
const form = useForm({ resolver: zodResolver(schema) })

// Avoid global state unless necessary
```

## Prisma Best Practices

### Query Patterns

```typescript
// Use select to limit data
const user = await db.user.findUnique({
  where: { id },
  select: { id: true, name: true, email: true },
})

// Use include for relations
const conversation = await db.conversation.findUnique({
  where: { id },
  include: { messages: true },
})

// Batch queries with Promise.all
const [users, posts] = await Promise.all([
  db.user.findMany(),
  db.post.findMany(),
])
```

### Transactions

```typescript
// Use transactions for related operations
await db.$transaction([
  db.epic.update({ where: { id }, data: { order: newOrder } }),
  db.epic.updateMany({
    where: { order: { gte: newOrder } },
    data: { order: { increment: 1 } },
  }),
])

// Or use interactive transactions for complex logic
await db.$transaction(async (tx) => {
  const epic = await tx.epic.findUnique({ where: { id } })
  // More operations...
  return result
})
```

### Migration Workflow

```bash
# Development: Create and apply migrations
npm run db:migrate

# Or push schema directly (no migration files)
npm run db:push

# Production: Apply migrations
npm run db:deploy

# Always generate Prisma client after schema changes
npm run db:generate
```

## Code Quality Scripts

### Pre-commit Workflow

```bash
# 1. Format all files
npm run format

# 2. Check for issues (type-check + lint)
npm run check

# 3. Fix linting issues automatically
npm run lint:fix

# Hooks run automatically on git commit!
```

### Script Reference

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "type-check": "tsc --noEmit",
  "format": "prettier --write .",
  "check": "npm run type-check && npm run lint",
  "db:generate": "prisma generate",
  "db:push": "prisma db push",
  "db:migrate": "prisma migrate dev",
  "db:deploy": "prisma migrate deploy",
  "db:studio": "prisma studio"
}
```

## Testing Conventions (When Implemented)

### Test File Organization

```
src/
├── components/
│   ├── EpicCard.tsx
│   └── EpicCard.test.tsx    # Co-located with component
├── lib/
│   ├── utils.ts
│   └── utils.test.ts        # Co-located with utility
```

### Test Naming

```typescript
describe('EpicCard', () => {
  it('renders epic title', () => {})
  it('displays status badge', () => {})
  it('calls onEdit when edit button clicked', () => {})
})
```

## Import Organization

```typescript
// 1. External dependencies
import { useState } from 'react'
import { z } from 'zod'

// 2. Internal absolute imports (@/)
import { api } from '@/lib/trpc'
import { Button } from '@/components/ui/Button'

// 3. Relative imports
import { helper } from './utils'
import type { Props } from './types'

// 4. CSS imports (if needed)
import './styles.css'
```

## Comment Guidelines

```typescript
// Use JSDoc for public functions
/**
 * Fetches user data by ID
 * @param id - The user ID
 * @returns User object or null
 */
export async function getUserById(id: string) {}

// Inline comments for complex logic
// Calculate new order by shifting affected items
const affectedItems = items.filter((item) => item.order >= newOrder)

// TODO comments for future work
// TODO: Add pagination support
// FIXME: Handle edge case when user is deleted
```

## Performance Considerations

### Next.js Optimizations

```typescript
// Use dynamic imports for heavy components
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <LoadingSkeleton />,
})

// Optimize images
import Image from 'next/image'
;<Image src="/image.png" alt="Description" width={500} height={300} />

// Use server components when possible (default in App Router)
```

### React Query / tRPC

```typescript
// Use staleTime to reduce refetches
const { data } = api.resource.list.useQuery(undefined, {
  staleTime: 60_000, // 1 minute
})

// Prefetch data for better UX
const utils = api.useUtils()
utils.resource.list.prefetch()
```

## Accessibility

```typescript
// Always provide semantic HTML
<button onClick={handleClick} aria-label="Edit epic">
  <EditIcon />
</button>

// Use proper heading hierarchy
<h1>Page Title</h1>
<h2>Section Title</h2>
<h3>Subsection Title</h3>

// Ensure keyboard navigation
<div role="button" tabIndex={0} onKeyDown={handleKeyDown}>
  ...
</div>
```

## Security Best Practices

```typescript
// Never expose secrets in client code
// ❌ Bad
const apiKey = 'sk-secret-key'

// ✅ Good
const apiKey = process.env.API_KEY // Server-side only

// Validate all user inputs
const input = z.string().email().parse(userInput)

// Sanitize data before rendering
import DOMPurify from 'isomorphic-dompurify'
const clean = DOMPurify.sanitize(dirty)
```

## Git Commit Conventions

```bash
# Format: <type>: <description>

# Common types:
feat: Add new feature
fix: Fix bug
docs: Update documentation
refactor: Refactor code (no behavior change)
test: Add or update tests
chore: Update dependencies, config, etc.
style: Format code (no logic change)

# Examples:
git commit -m "feat: add drag-and-drop epic reordering"
git commit -m "fix: resolve database connection timeout"
git commit -m "docs: update API documentation"
git commit -m "refactor: simplify tRPC error handling"
```

## Code Review Checklist

Before submitting code:

- [ ] Code follows naming conventions
- [ ] TypeScript has no errors (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Code is formatted (`npm run format`)
- [ ] No console.log statements (use proper logging)
- [ ] Error handling is implemented
- [ ] Input validation with Zod
- [ ] Comments explain complex logic
- [ ] No hardcoded secrets or sensitive data
- [ ] Imports are organized properly

## When in Doubt

1. **Check existing code** for patterns
2. **Run `npm run check`** before committing
3. **Let hooks do their job** (auto-formatting)
4. **Prioritize type safety** over convenience
5. **Keep it simple** - prefer clarity over cleverness