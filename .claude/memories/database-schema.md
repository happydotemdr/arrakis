# Database Schema & Data Models

**Last Updated**: 2025-09-29

## Database Overview

- **Type**: PostgreSQL 17
- **Database**: `arrakis_production_bq3v`
- **Extensions**: pgvector (for semantic search)
- **ORM**: Prisma 6.16.2

## Core Models

### Conversation Model

**Purpose**: Represents a Claude Code conversation session with project context.

```prisma
model Conversation {
  id          String    @id @default(cuid())
  sessionId   String?   @map("session_id")
  projectPath String?   @map("project_path")
  title       String?
  description String?
  startedAt   DateTime  @default(now()) @map("started_at")
  endedAt     DateTime? @map("ended_at")
  metadata    Json?
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  // Relations
  messages              Message[]
  conversationEmbeddings ConversationEmbedding[]

  // Indexes
  @@index([sessionId])
  @@index([projectPath])
  @@index([startedAt])
  @@index([endedAt])
  @@map("conversations")
}
```

**Field Descriptions**:

- `id`: Unique identifier (CUID format)
- `sessionId`: Claude Code session identifier (nullable)
- `projectPath`: File system path to project being worked on
- `title`: Auto-generated or user-provided conversation title
- `description`: Brief description of what was accomplished
- `startedAt`: When conversation began
- `endedAt`: When conversation completed (nullable for active)
- `metadata`: Flexible JSON for additional context
- `createdAt`/`updatedAt`: Automatic timestamps

**Indexes**: Optimized for querying by session, project, and time range.

### Message Model

**Purpose**: Individual messages within a conversation (user, assistant, system).

```prisma
model Message {
  id             String   @id @default(cuid())
  conversationId String   @map("conversation_id")
  role           Role
  content        String   @db.Text
  toolCalls      Json?    @map("tool_calls")
  timestamp      DateTime @default(now())
  metadata       Json?
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  // Relations
  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  toolUses     ToolUse[]

  // Indexes
  @@index([conversationId])
  @@index([role])
  @@index([timestamp])
  @@map("messages")
}
```

**Field Descriptions**:

- `id`: Unique message identifier
- `conversationId`: Foreign key to parent conversation
- `role`: Message author (user, assistant, system, function, tool)
- `content`: Message text content (stored as TEXT for unlimited length)
- `toolCalls`: Array of tool invocations as JSON
- `timestamp`: When message was created
- `metadata`: Additional message-specific data

**Cascade Delete**: When conversation is deleted, all messages are deleted.

### ToolUse Model

**Purpose**: Track tool/function calls made during conversations.

```prisma
model ToolUse {
  id         String   @id @default(cuid())
  messageId  String   @map("message_id")
  toolName   String   @map("tool_name")
  parameters Json?
  response   Json?
  duration   Int?     // milliseconds
  status     String?
  timestamp  DateTime @default(now())
  metadata   Json?
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  // Relations
  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)

  // Indexes
  @@index([messageId])
  @@index([toolName])
  @@index([timestamp])
  @@index([status])
  @@map("tool_uses")
}
```

**Field Descriptions**:

- `id`: Unique tool use identifier
- `messageId`: Foreign key to message where tool was called
- `toolName`: Name of tool/function invoked (e.g., "Read", "Write", "Bash")
- `parameters`: Tool input parameters as JSON
- `response`: Tool output/result as JSON
- `duration`: Execution time in milliseconds
- `status`: Execution status (success, error, timeout, etc.)

**Use Cases**:

- Analyze which tools are used most frequently
- Debug tool failures
- Track performance of tool executions
- Understand conversation patterns

### ConversationEmbedding Model

**Purpose**: Vector embeddings for semantic search across conversations.

```prisma
model ConversationEmbedding {
  id             String                  @id @default(cuid())
  conversationId String                  @map("conversation_id")
  chunkText      String                  @db.Text @map("chunk_text")
  chunkIndex     Int                     @map("chunk_index")
  embedding      Unsupported("vector(1536)")? // OpenAI text-embedding-3-small
  metadata       Json?
  createdAt      DateTime                @default(now()) @map("created_at")
  updatedAt      DateTime                @updatedAt @map("updated_at")

  // Relations
  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  // Indexes
  @@index([conversationId])
  @@index([chunkIndex])
  @@map("conversation_embeddings")
}
```

**Field Descriptions**:

- `id`: Unique embedding identifier
- `conversationId`: Foreign key to conversation
- `chunkText`: Text content that was embedded
- `chunkIndex`: Order of chunk in conversation (for reconstruction)
- `embedding`: 1536-dimensional vector from OpenAI text-embedding-3-small
- `metadata`: Chunk-specific data (token count, model version, etc.)

**Vector Operations**: Requires pgvector extension for similarity search.

## Enums

### Role Enum

**Purpose**: Categorize message authors in conversations.

```prisma
enum Role {
  user        // Human user messages
  assistant   // Claude's responses
  system      // System-level instructions
  function    // Deprecated function call responses
  tool        // Tool/function call results
}
```

**Usage Pattern**:

- `user`: User requests, questions, instructions
- `assistant`: Claude's responses and actions
- `system`: Context, instructions, system prompts
- `tool`: Tool execution results

## Relationships

```
Conversation (1) ──< (Many) Message
                └──< (Many) ConversationEmbedding

Message (1) ──< (Many) ToolUse
```

**Key Points**:

- One conversation has many messages
- One conversation has many embeddings (chunked)
- One message can have many tool uses
- All relations use CASCADE delete for cleanup

## Indexes & Performance

### Query Optimization

```typescript
// Efficient queries use indexes:

// ✅ Good (uses index)
await db.conversation.findMany({
  where: { sessionId: 'session_123' },
  orderBy: { startedAt: 'desc' },
})

// ✅ Good (uses index)
await db.message.findMany({
  where: {
    conversationId: 'conv_123',
    role: 'assistant',
  },
})

// ✅ Good (uses composite index)
await db.toolUse.findMany({
  where: {
    toolName: 'Read',
    status: 'success',
  },
})
```

### Full-Text Search (Future)

PostgreSQL supports full-text search on TEXT columns:

```sql
-- Create full-text index (not yet implemented)
CREATE INDEX message_content_fts
ON messages
USING gin(to_tsvector('english', content));
```

## Vector Search Operations

### Similarity Search

**Purpose**: Find similar conversations based on semantic meaning.

```typescript
// Example vector search (implemented in src/lib/vector-operations.ts)
import { sql } from '@prisma/client'

const results = await db.$queryRaw`
  SELECT
    c.id,
    c.title,
    ce.chunk_text,
    1 - (ce.embedding <-> ${embedding}::vector) AS similarity
  FROM conversation_embeddings ce
  JOIN conversations c ON c.id = ce.conversation_id
  WHERE 1 - (ce.embedding <-> ${embedding}::vector) > ${threshold}
  ORDER BY similarity DESC
  LIMIT ${limit}
`
```

**Operators**:

- `<->`: L2 distance (Euclidean)
- `<#>`: Inner product (dot product)
- `<=>`: Cosine distance

## Common Queries

### Get Conversation with Messages

```typescript
const conversation = await db.conversation.findUnique({
  where: { id: conversationId },
  include: {
    messages: {
      orderBy: { timestamp: 'asc' },
      include: {
        toolUses: true,
      },
    },
  },
})
```

### Find Recent Conversations

```typescript
const recent = await db.conversation.findMany({
  where: {
    projectPath: '/path/to/project',
    endedAt: null, // Active conversations
  },
  orderBy: { startedAt: 'desc' },
  take: 10,
})
```

### Get Tool Usage Statistics

```typescript
const stats = await db.toolUse.groupBy({
  by: ['toolName', 'status'],
  _count: true,
  _avg: {
    duration: true,
  },
  orderBy: {
    _count: {
      toolName: 'desc',
    },
  },
})
```

### Search by Content

```typescript
const results = await db.message.findMany({
  where: {
    content: {
      contains: 'search term',
      mode: 'insensitive',
    },
    role: 'assistant',
  },
  include: {
    conversation: {
      select: {
        id: true,
        title: true,
        projectPath: true,
      },
    },
  },
})
```

## Migration Strategy

### Development Workflow

```bash
# 1. Modify schema in prisma/schema.prisma
# 2. Generate migration
npm run db:migrate

# Prisma creates migration file in prisma/migrations/
# 3. Review generated SQL
# 4. Apply to database (automatic)
```

### Production Workflow

```bash
# In CI/CD or before deployment:
npm run db:deploy

# This applies pending migrations without prompting
```

## Data Seeding

### Seed Script Location

`prisma/seed.ts` - Sample data for development

```typescript
// Run with:
npm run db:seed

// Seeds:
// - Sample conversations
// - Messages with different roles
// - Tool uses
// - Embeddings (if API key provided)
```

## Database Maintenance

### Backup Strategy

- Render provides automated daily backups (depending on plan)
- Manual backup: `pg_dump` via connection string
- Point-in-time recovery available on higher tiers

### Vacuum & Analyze

```sql
-- Run periodically for performance
VACUUM ANALYZE conversations;
VACUUM ANALYZE messages;
VACUUM ANALYZE tool_uses;
VACUUM ANALYZE conversation_embeddings;
```

### Index Monitoring

```sql
-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;
```

## Future Schema Additions (Planned)

Based on [ROADMAP_PLANNER_IMPLEMENTATION.md](c:\projects\arrakis\docs\ROADMAP_PLANNER_IMPLEMENTATION.md):

### Epic Model (Roadmap Planning)

```prisma
model Epic {
  id          String    @id @default(cuid())
  title       String
  description String?   @db.Text
  status      Status    @default(PLANNED)
  priority    Priority  @default(MEDIUM)
  quarter     String?
  outcome     String?   @db.Text
  icon        String?
  color       String?
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

## Schema Best Practices

1. **Always use indexes** for frequently queried fields
2. **Use cascade deletes** to maintain referential integrity
3. **Store large text** as `@db.Text` (unlimited length)
4. **Use JSON** for flexible/nested data
5. **Map to snake_case** for SQL compatibility (`@@map`, `@map`)
6. **Add timestamps** to all models (createdAt, updatedAt)
7. **Use CUIDs** for globally unique IDs
8. **Document relationships** with clear foreign keys

## Troubleshooting

### Schema Sync Issues

```bash
# Reset database (DESTRUCTIVE)
npx prisma migrate reset

# Push schema without migrations (dev only)
npm run db:push

# Regenerate Prisma client
npm run db:generate
```

### Connection Issues

```typescript
// Check DATABASE_URL format:
postgresql://user:password@host:port/database?sslmode=require

// Enable query logging (dev only)
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
})
```

### Performance Issues

- Add indexes for slow queries
- Use `select` to limit returned fields
- Use pagination for large result sets
- Consider materialized views for complex aggregations