# 📊 Claude Code Conversation Persistence - Project Status

**Project Start**: September 29, 2025
**Current Status**: 60% Complete - Core infrastructure ready, integration pending
**Tech Stack**: Next.js 15.5.4, Prisma 6.16.2, PostgreSQL 17, pgvector, tRPC v11, React 19

---

## 🎯 Project Mission

Build a system to capture and persist Claude Code conversation threads with full verbose output, storing them in PostgreSQL with vector embeddings for semantic search and future context enhancement.

---

## ✅ COMPLETED WORK (What's Already Done)

### 1. Project Foundation ✓
```bash
# Current directory: c:\projects\arrakis
# Dependencies installed via Bun (bun.lockb present)
# Node modules: 457 packages installed successfully
```

**Key Files Created:**
- `package.json` - All dependencies with correct versions
- `tsconfig.json` - TypeScript 5.9.2 configuration
- `next.config.js` - Next.js 15 configuration
- `tailwind.config.ts` - TailwindCSS setup
- `.eslintrc.json` - Linting rules

### 2. Database Schema (Prisma) ✓
**Location**: `prisma/schema.prisma`

```prisma
model Conversation {
  id          String    @id @default(cuid())
  sessionId   String    @unique
  title       String?
  projectPath String?
  startedAt   DateTime
  endedAt     DateTime?
  metadata    Json?
  messages    Message[]
  embeddings  ConversationEmbedding[]
  toolUses    ToolUse[]
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  role           Role     // user | assistant | system
  content        String
  timestamp      DateTime
  toolCalls      Json?
  metadata       Json?
}

model ToolUse {
  id         String   @id @default(cuid())
  messageId  String?
  toolName   String
  parameters Json
  response   Json?
  duration   Int?
  timestamp  DateTime
}

model ConversationEmbedding {
  id             String @id @default(cuid())
  conversationId String
  chunkText      String
  chunkIndex     Int
  embedding      Unsupported("vector(1536)")
  metadata       Json?
}
```

**Migration Created**: `prisma/migrations/20240929000000_add_pgvector/migration.sql`
- Enables pgvector extension
- Creates HNSW indexes for fast similarity search

### 3. Claude Code Hook Integration ✓
**Hook Script**: `.claude/hooks/capture-conversation.js`
- Captures all Claude Code events
- Sends to webhook endpoint
- Handles errors gracefully

**Configuration**: `.claude/settings.json`
```json
{
  "hooks": {
    "SessionStart": [{"hooks": [{"type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/capture-conversation.js\""}]}],
    "UserPromptSubmit": [{"hooks": [{"type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/capture-conversation.js\""}]}],
    "PostToolUse": [{"matcher": "*", "hooks": [{"type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/capture-conversation.js\""}]}],
    "SessionEnd": [{"hooks": [{"type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/capture-conversation.js\""}]}]
  }
}
```

### 4. API Structure (Partial) ✓
**Created Files:**
- `src/server/api/trpc.ts` - tRPC initialization
- `src/server/api/root.ts` - Root router
- `src/server/api/routers/conversation.ts` - Conversation endpoints
- `src/app/api/claude-hooks/route.ts` - Webhook receiver
- `src/lib/claude/parser.ts` - JSONL transcript parser
- `src/lib/claude/types.ts` - TypeScript types

### 5. Dependencies Installed ✓
```json
{
  "dependencies": {
    "next": "15.5.4",
    "react": "19.1.1",
    "react-dom": "19.1.1",
    "@prisma/client": "6.16.2",
    "@trpc/server": "11.6.0",
    "@trpc/client": "11.6.0",
    "@trpc/react-query": "11.6.0",
    "@tanstack/react-query": "5.90.2",
    "zod": "3.25.76",  // Note: v3 for OpenAI compatibility
    "openai": "5.23.1",
    "pgvector": "0.2.1"
  }
}
```

---

## 🔴 CRITICAL ISSUES TO FIX FIRST

### 1. TypeScript Build Errors
**File**: `prisma/seed.ts`
**Issue**: ToolUse creation has incorrect messageId references
**Fix**: Remove or properly reference messageId in seed data

### 2. Missing tRPC Provider
**File**: `src/app/layout.tsx`
**Issue**: TRPCProvider not properly configured
**Fix**: Need to wrap the app with proper provider setup

### 3. Missing Files
Several files were referenced but don't exist:
- `src/lib/trpc/provider.tsx` - Need to create
- `src/lib/trpc/client.ts` - Need to create
- `src/lib/db.ts` - Need to create

---

## 🚧 REMAINING WORK (Priority Order)

### Priority 1: Fix Build & Basic Setup (2 hours)
```bash
# Tasks:
1. Fix prisma/seed.ts TypeScript errors
2. Create src/lib/db.ts with Prisma client
3. Create tRPC provider and client setup
4. Ensure npm run build passes
```

**Files to create:**
- `src/lib/db.ts`:
```typescript
import { PrismaClient } from '@prisma/client'
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### Priority 2: OpenAI Embedding Service (3 hours)
**Create**: `src/services/embedding.ts`
```typescript
// Implement:
- Initialize OpenAI client
- generateEmbedding(text: string): Promise<number[]>
- chunkConversation(messages: Message[]): string[]
- embedConversation(conversationId: string): Promise<void>
- Use text-embedding-3-small model (1536 dimensions)
```

### Priority 3: Complete API Endpoints (2 hours)
**Update**: `src/server/api/routers/conversation.ts`
```typescript
// Add procedures:
- search: Semantic search using pgvector
- similar: Find similar conversations
- list: Paginated conversation list
- get: Get single conversation with messages
- statistics: Analytics data
```

### Priority 4: Build UI Components (4 hours)
**Create these files:**
```
app/
├── conversations/
│   ├── page.tsx           # List all conversations
│   └── [id]/
│       └── page.tsx        # Conversation detail view
├── search/
│   └── page.tsx           # Semantic search interface
└── components/
    ├── ConversationList.tsx
    ├── MessageTimeline.tsx
    ├── ToolUsageCard.tsx
    └── SearchBar.tsx
```

### Priority 5: Testing & Deployment (2 hours)
1. Test Claude Code hooks locally
2. Verify database connection
3. Test embedding generation
4. Deploy to Render
5. Configure production environment variables

---

## 🗂️ File Structure Overview

```
c:\projects\arrakis\
├── .claude/
│   ├── hooks/
│   │   └── capture-conversation.js    ✓ Created
│   └── settings.json                   ✓ Updated
├── prisma/
│   ├── schema.prisma                   ✓ Created
│   ├── seed.ts                         ✓ Created (has errors)
│   └── migrations/                     ✓ Created
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── claude-hooks/
│   │   │   │   └── route.ts           ✓ Created
│   │   │   └── trpc/
│   │   │       └── [trpc]/
│   │   │           └── route.ts       ✓ Created
│   │   ├── layout.tsx                 ✓ Created (needs fix)
│   │   ├── page.tsx                   ✓ Created
│   │   └── globals.css                ✓ Created
│   ├── lib/
│   │   ├── claude/
│   │   │   ├── parser.ts              ✓ Created
│   │   │   └── types.ts               ✓ Created
│   │   ├── trpc/
│   │   │   ├── provider.tsx           ✗ Missing
│   │   │   └── client.ts              ✗ Missing
│   │   └── db.ts                      ✗ Missing
│   ├── server/
│   │   └── api/
│   │       ├── trpc.ts                ✓ Created
│   │       ├── root.ts                ✓ Created
│   │       └── routers/
│   │           └── conversation.ts    ✓ Created
│   └── services/
│       └── embedding.ts               ✗ Missing
├── package.json                        ✓ Created
├── tsconfig.json                       ✓ Created
├── next.config.js                      ✓ Created
└── .env.local                          ✓ Exists (needs values)
```

---

## 🔧 Environment Variables Required

Add to `.env.local`:
```env
# Database (get from Render PostgreSQL)
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require

# OpenAI (get from platform.openai.com)
OPENAI_API_KEY=sk-...

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Change in production

# Claude Hooks (optional for debugging)
CLAUDE_HOOKS_DEBUG=true
CLAUDE_HOOKS_API_URL=http://localhost:3000/api/claude-hooks
```

---

## 📝 Commands Cheat Sheet

```bash
# Install dependencies (already done)
bun install

# Generate Prisma client
npm run db:generate

# Push schema to database (after adding DATABASE_URL)
npm run db:push

# Seed database (after fixing seed.ts)
npm run db:seed

# Start development server
npm run dev

# Build for production (currently has errors)
npm run build

# Type checking
npm run type-check

# Linting (ESLint v9 flat config)
npm run lint
npm run lint:fix
```

---

## ⚠️ Important Notes for New Agent

1. **Zod Version**: We're using v3.25.76, not v4, due to OpenAI SDK compatibility
2. **pgvector**: Must be enabled on PostgreSQL before migrations: `CREATE EXTENSION vector;`
3. **Prisma**: Vector type uses `Unsupported("vector(1536)")` since it's not natively supported
4. **Render Deployment**: The `render.yaml` exists and is configured for Next.js
5. **Claude Hooks**: The capture script is complete and will work once the server is running

---

## 🎯 Definition of Done

The project is complete when:
- [ ] All TypeScript errors are resolved
- [ ] Claude Code hooks successfully capture conversations
- [ ] Conversations are stored with vector embeddings
- [ ] Semantic search returns relevant results
- [ ] UI allows browsing and searching conversations
- [ ] System is deployed and running on Render
- [ ] Documentation is complete

---

## 📚 Resources

- [Next.js 15 App Router Docs](https://nextjs.org/docs/app)
- [Prisma 6 with pgvector](https://www.prisma.io/docs/orm/prisma-schema/postgresql-extensions)
- [tRPC v11 Setup](https://trpc.io/docs/quickstart)
- [Claude Code Hooks Reference](https://docs.anthropic.com/en/docs/claude-code/hooks)
- [pgvector Operations](https://github.com/pgvector/pgvector)

---

## 💡 Quick Wins for Immediate Progress

1. Fix the seed.ts file - just comment out the ToolUse creation
2. Create the missing db.ts file (code provided above)
3. Run `npm run db:generate` to create Prisma client
4. Start the dev server to see what works

This documentation should give any new agent everything they need to continue!