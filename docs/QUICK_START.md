# 🚀 QUICK START - Immediate Actions for New Agent

## Step 1: Fix Build Errors (5 minutes)

### Fix prisma/seed.ts
```bash
# Open prisma/seed.ts and comment out lines 44-69 (ToolUse creation section)
# Or fix the messageId references to use actual message IDs
```

### Create Missing db.ts
```bash
# Create file: src/lib/db.ts
```
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

## Step 2: Database Setup (10 minutes)

### Add to .env.local
```env
DATABASE_URL=postgresql://[from-render-dashboard]
OPENAI_API_KEY=sk-[your-key]
```

### Initialize Database
```bash
# Generate Prisma Client
npm run db:generate

# Enable pgvector (run in psql or Render dashboard)
CREATE EXTENSION IF NOT EXISTS vector;

# Push schema
npm run db:push

# Seed (after fixing seed.ts)
npm run db:seed
```

## Step 3: Create tRPC Provider (15 minutes)

### Create src/lib/trpc/provider.tsx
```typescript
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import React, { useState } from 'react'
import { trpc } from './client'

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/trpc`,
        }),
      ],
    })
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}
```

### Create src/lib/trpc/client.ts
```typescript
import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@/server/api/root'

export const trpc = createTRPCReact<AppRouter>()
```

### Update app/layout.tsx
```typescript
// Add the import
import { TRPCProvider } from '@/lib/trpc/provider'

// Wrap children with provider
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  )
}
```

## Step 4: Test What Works (5 minutes)

```bash
# Build to check for errors
npm run build

# If build passes, start dev server
npm run dev

# Visit http://localhost:3000
# Check http://localhost:3000/api/claude-hooks (should return 405)
```

## Step 5: Priority Tasks

### High Priority (Do These First)
1. ✅ Fix build errors
2. ✅ Create tRPC provider
3. ⬜ Create OpenAI embedding service
4. ⬜ Test Claude hook integration

### Medium Priority
5. ⬜ Build conversation list UI
6. ⬜ Implement search endpoint
7. ⬜ Create search UI

### Low Priority
8. ⬜ Add analytics
9. ⬜ Deploy to Render
10. ⬜ Documentation

## 🔥 Hot Tips

1. **Use Bun**: `bun install` is way faster than npm
2. **Skip UI Initially**: Test API endpoints with curl/Postman first
3. **Mock Embeddings**: Use random vectors for testing before implementing OpenAI
4. **Check Logs**: Claude hooks log to `.claude/hooks/capture-conversation.log`

## 📁 Key Files to Focus On

```
PRIORITY 1 - Fix These:
├── prisma/seed.ts              # Has errors
├── src/lib/db.ts               # Missing
├── src/lib/trpc/provider.tsx   # Missing
├── src/lib/trpc/client.ts      # Missing

PRIORITY 2 - Create These:
├── src/services/embedding.ts   # OpenAI integration
├── app/conversations/page.tsx  # List view

PRIORITY 3 - Enhance These:
├── src/server/api/routers/conversation.ts  # Add search
├── app/api/claude-hooks/route.ts          # Add embedding generation
```

## 🎯 Success Metrics

You'll know it's working when:
1. ✅ `npm run build` passes with no errors
2. ✅ Dev server starts without crashes
3. ⬜ Claude hooks send data to webhook
4. ⬜ Conversations appear in database
5. ⬜ Embeddings are generated
6. ⬜ Search returns results

## 💬 Debug Commands

```bash
# Check if database is connected
npm run db:generate && npx prisma db pull

# Test webhook endpoint
curl -X POST http://localhost:3000/api/claude-hooks \
  -H "Content-Type: application/json" \
  -d '{"hook_event_name":"test"}'

# Check TypeScript errors
npm run type-check

# View database
npx prisma studio
```

## 🚨 Common Issues & Fixes

**Issue**: "Cannot find module '@/lib/db'"
**Fix**: Create the file as shown above

**Issue**: "tRPC provider errors"
**Fix**: Ensure all three files are created (provider, client, layout update)

**Issue**: "Database connection failed"
**Fix**: Check DATABASE_URL in .env.local

**Issue**: "Vector type not supported"
**Fix**: Run `CREATE EXTENSION vector;` on your database

---

Good luck! Start with Step 1 and work through sequentially. The project is well-structured and just needs these final connections!