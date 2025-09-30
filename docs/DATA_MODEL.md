# Data Model - Database Schema Documentation

**Last Updated**: 2025-09-29
**Database**: PostgreSQL 17 with pgvector extension
**ORM**: Prisma 6.16.2

---

## Table of Contents

1. [Schema Overview](#schema-overview)
2. [Entity Relationship Diagram](#entity-relationship-diagram)
3. [Table Definitions](#table-definitions)
4. [Indexes](#indexes)
5. [Relationships](#relationships)
6. [Data Types](#data-types)
7. [Constraints](#constraints)
8. [Query Patterns](#query-patterns)

---

## Schema Overview

The Arrakis data model consists of **4 main tables** designed to capture Claude Code conversation data:

| Table | Purpose | Records (typical) |
|-------|---------|-------------------|
| `conversations` | Session metadata and lifecycle | 100-1000 |
| `messages` | User/assistant messages | 500-10,000 |
| `tool_uses` | Tool execution tracking | 1,000-50,000 |
| `conversation_embeddings` | Vector search support | 500-5,000 |

**Design Principles**:
- Normalized to 3NF (Third Normal Form)
- Cascade deletes for data integrity
- JSON storage for flexible metadata
- Vector search capability with pgvector
- Optimized for read-heavy workloads

---

## Entity Relationship Diagram

```
┌─────────────────────────┐
│     conversations       │
│─────────────────────────│
│ id (PK)                 │
│ session_id (UK)         │◄─────────┐
│ project_path            │          │
│ title                   │          │ Many
│ description             │          │
│ started_at              │          │
│ ended_at                │          │
│ metadata (JSON)         │          │
│ created_at              │          │
│ updated_at              │          │
└─────────────────────────┘          │
          │                           │
          │ One                       │
          │                           │
          │                           │
          ▼ Many                      │
┌─────────────────────────┐          │
│       messages          │          │
│─────────────────────────│          │
│ id (PK)                 │          │
│ conversation_id (FK)────┼──────────┘
│ role (ENUM)             │
│ content (TEXT)          │
│ tool_calls (JSON)       │◄─────────┐
│ timestamp               │          │
│ metadata (JSON)         │          │
│ created_at              │          │
│ updated_at              │          │
└─────────────────────────┘          │
          │                           │
          │ One                       │
          │                           │
          │                           │
          ▼ Many                      │
┌─────────────────────────┐          │
│      tool_uses          │          │
│─────────────────────────│          │
│ id (PK)                 │          │
│ message_id (FK)─────────┼──────────┘
│ tool_name               │
│ parameters (JSON)       │
│ response (JSON)         │
│ duration                │
│ status                  │
│ timestamp               │
│ metadata (JSON)         │
│ created_at              │
│ updated_at              │
└─────────────────────────┘

┌─────────────────────────┐
│ conversation_embeddings │
│─────────────────────────│
│ id (PK)                 │
│ conversation_id (FK)────┼──────────┐
│ chunk_text (TEXT)       │          │
│ chunk_index             │          │ Many
│ embedding (vector)      │          │
│ metadata (JSON)         │          │
│ created_at              │          │
│ updated_at              │          │
└─────────────────────────┘          │
                                     │
                                     │
                    ┌────────────────┘
                    │
                    │ One
                    │
                    ▼
          [Back to conversations]
```

**Relationship Summary**:
- 1 Conversation → Many Messages (1:N)
- 1 Message → Many ToolUses (1:N)
- 1 Conversation → Many ConversationEmbeddings (1:N)

---

## Table Definitions

### conversations

**Purpose**: Store conversation session metadata and lifecycle information.

**Columns**:

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | TEXT (CUID) | NO | cuid() | Primary key |
| `session_id` | TEXT | YES | NULL | Claude Code session identifier (unique) |
| `project_path` | TEXT | YES | NULL | File system path to project |
| `title` | TEXT | YES | NULL | Auto-generated or user-provided title |
| `description` | TEXT | YES | NULL | Brief description of conversation |
| `started_at` | TIMESTAMP(3) | NO | now() | Conversation start time |
| `ended_at` | TIMESTAMP(3) | YES | NULL | Conversation end time |
| `metadata` | JSONB | YES | NULL | Additional conversation metadata |
| `created_at` | TIMESTAMP(3) | NO | now() | Record creation timestamp |
| `updated_at` | TIMESTAMP(3) | NO | now() | Record last update timestamp |

**Indexes**:
- PRIMARY KEY: `id`
- INDEX: `session_id` (for session lookup)
- INDEX: `project_path` (for project filtering)
- INDEX: `started_at` (for time-based queries)
- INDEX: `ended_at` (for time-based queries)
- INDEX: `(session_id, started_at DESC)` (composite)
- PARTIAL INDEX: `started_at DESC WHERE ended_at IS NULL` (active conversations)
- GIN INDEX: `metadata` (for JSON queries)

**Example Row**:
```json
{
  "id": "clxxx123456789abc",
  "session_id": "session-abc123",
  "project_path": "c:\\projects\\arrakis",
  "title": "Database schema design discussion",
  "description": null,
  "started_at": "2025-09-29T19:00:00.000Z",
  "ended_at": "2025-09-29T19:15:00.000Z",
  "metadata": {
    "platform": "win32",
    "nodeVersion": "18.0.0",
    "messageCount": 8,
    "toolUseCount": 5
  },
  "created_at": "2025-09-29T19:00:00.123Z",
  "updated_at": "2025-09-29T19:15:00.456Z"
}
```

**Business Rules**:
- `session_id` should be unique per conversation
- `title` auto-generated from first user message if not provided
- `ended_at` is NULL for active conversations
- `metadata` stores flexible additional data (no fixed schema)
- Soft delete not implemented (use hard delete)

---

### messages

**Purpose**: Store individual messages within conversations.

**Columns**:

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | TEXT (CUID) | NO | cuid() | Primary key |
| `conversation_id` | TEXT | NO | - | Foreign key to conversations.id |
| `role` | ENUM(Role) | NO | - | Message role: user/assistant/system/function/tool |
| `content` | TEXT | NO | - | Message content (unlimited length) |
| `tool_calls` | JSONB | YES | NULL | Array of tool invocations in this message |
| `timestamp` | TIMESTAMP(3) | NO | now() | Message timestamp |
| `metadata` | JSONB | YES | NULL | Additional message metadata |
| `created_at` | TIMESTAMP(3) | NO | now() | Record creation timestamp |
| `updated_at` | TIMESTAMP(3) | NO | now() | Record last update timestamp |

**Indexes**:
- PRIMARY KEY: `id`
- INDEX: `conversation_id` (for conversation lookup)
- INDEX: `role` (for filtering by role)
- INDEX: `timestamp` (for chronological ordering)
- INDEX: `(conversation_id, timestamp DESC)` (composite - most common query)
- GIN INDEX: `metadata` (for JSON queries)
- GIN INDEX: `tool_calls` (for tool call queries)

**Example Row**:
```json
{
  "id": "clyyy987654321xyz",
  "conversation_id": "clxxx123456789abc",
  "role": "assistant",
  "content": "I'll check the database schema for you. Let me read the Prisma schema file.",
  "tool_calls": [
    {
      "toolName": "Read",
      "parameters": {
        "file_path": "prisma/schema.prisma"
      }
    }
  ],
  "timestamp": "2025-09-29T19:01:30.000Z",
  "metadata": {
    "model": "claude-sonnet-4-5-20250929",
    "tokenCount": 45
  },
  "created_at": "2025-09-29T19:01:30.123Z",
  "updated_at": "2025-09-29T19:01:30.123Z"
}
```

**Business Rules**:
- `role` must be one of: user, assistant, system, function, tool
- `content` stores the actual message text (no length limit)
- `tool_calls` is array format: `[{toolName, parameters}, ...]`
- Messages ordered by `timestamp` within conversation
- Foreign key cascade delete: deleting conversation deletes messages

---

### tool_uses

**Purpose**: Track tool executions with parameters, responses, and performance metrics.

**Columns**:

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | TEXT (CUID) | NO | cuid() | Primary key |
| `message_id` | TEXT | NO | - | Foreign key to messages.id |
| `tool_name` | TEXT | NO | - | Name of tool executed (Read, Write, Grep, etc.) |
| `parameters` | JSONB | YES | NULL | Tool input parameters |
| `response` | JSONB | YES | NULL | Tool output/result |
| `duration` | INTEGER | YES | NULL | Execution time in milliseconds |
| `status` | TEXT | YES | NULL | Execution status: success/error/timeout |
| `timestamp` | TIMESTAMP(3) | NO | now() | Tool execution timestamp |
| `metadata` | JSONB | YES | NULL | Additional tool use metadata |
| `created_at` | TIMESTAMP(3) | NO | now() | Record creation timestamp |
| `updated_at` | TIMESTAMP(3) | NO | now() | Record last update timestamp |

**Indexes**:
- PRIMARY KEY: `id`
- INDEX: `message_id` (for message lookup)
- INDEX: `tool_name` (for analytics by tool)
- INDEX: `timestamp` (for chronological ordering)
- INDEX: `status` (for filtering by outcome)
- INDEX: `(tool_name, status, timestamp DESC)` (composite - analytics)
- INDEX: `(message_id, timestamp DESC)` (composite - message tools)
- GIN INDEX: `parameters` (for parameter queries)
- GIN INDEX: `response` (for response queries)

**Example Row**:
```json
{
  "id": "clzzz555444333bbb",
  "message_id": "clyyy987654321xyz",
  "tool_name": "Read",
  "parameters": {
    "file_path": "c:\\projects\\arrakis\\prisma\\schema.prisma",
    "limit": 200
  },
  "response": {
    "content": "// Prisma schema file\ngenerator client {...}",
    "lines": 116,
    "success": true
  },
  "duration": 45,
  "status": "success",
  "timestamp": "2025-09-29T19:01:31.000Z",
  "metadata": {
    "toolVersion": "1.0",
    "retryCount": 0
  },
  "created_at": "2025-09-29T19:01:31.123Z",
  "updated_at": "2025-09-29T19:01:31.123Z"
}
```

**Business Rules**:
- `tool_name` corresponds to Claude Code tool names (Read, Write, Grep, Bash, etc.)
- `duration` in milliseconds (NULL if not measured)
- `status` typically: "success", "error", "timeout"
- `parameters` and `response` stored as JSON (flexible schema)
- Foreign key cascade delete: deleting message deletes tool_uses

---

### conversation_embeddings

**Purpose**: Store vector embeddings for semantic search.

**Columns**:

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | TEXT (CUID) | NO | cuid() | Primary key |
| `conversation_id` | TEXT | NO | - | Foreign key to conversations.id |
| `chunk_text` | TEXT | NO | - | Original text that was embedded |
| `chunk_index` | INTEGER | NO | - | Position in conversation (0-based) |
| `embedding` | vector(1536) | YES | NULL | OpenAI embedding vector (1536 dimensions) |
| `metadata` | JSONB | YES | NULL | Embedding metadata (model, tokens, etc.) |
| `created_at` | TIMESTAMP(3) | NO | now() | Record creation timestamp |
| `updated_at` | TIMESTAMP(3) | NO | now() | Record last update timestamp |

**Indexes**:
- PRIMARY KEY: `id`
- INDEX: `conversation_id` (for conversation lookup)
- INDEX: `chunk_index` (for ordered chunks)
- HNSW INDEX: `embedding` (vector similarity search)

**Example Row**:
```json
{
  "id": "claaa111222333ddd",
  "conversation_id": "clxxx123456789abc",
  "chunk_text": "User asked about database schema. Claude read the Prisma schema file and explained the table structure including conversations, messages, tool_uses, and conversation_embeddings tables.",
  "chunk_index": 0,
  "embedding": [0.023, -0.015, 0.089, ...1536 dimensions],
  "metadata": {
    "model": "text-embedding-3-small",
    "tokens": 45,
    "chunkingStrategy": "semantic"
  },
  "created_at": "2025-09-29T19:16:00.123Z",
  "updated_at": "2025-09-29T19:16:00.123Z"
}
```

**Business Rules**:
- `embedding` is OpenAI text-embedding-3-small (1536 dimensions)
- `chunk_text` contains the original text for reference
- `chunk_index` maintains order within conversation
- Multiple chunks per conversation supported
- Foreign key cascade delete: deleting conversation deletes embeddings
- **Not yet implemented** in current version (tables ready, service pending)

---

## Indexes

### Performance Indexes

**B-Tree Indexes** (Standard):
```sql
-- Primary keys (automatic)
conversations_pkey ON conversations(id)
messages_pkey ON messages(id)
tool_uses_pkey ON tool_uses(id)
conversation_embeddings_pkey ON conversation_embeddings(id)

-- Foreign key lookups
messages_conversation_id_idx ON messages(conversation_id)
tool_uses_message_id_idx ON tool_uses(message_id)
conversation_embeddings_conversation_id_idx ON conversation_embeddings(conversation_id)

-- Single column indexes
conversations_session_id_idx ON conversations(session_id)
conversations_project_path_idx ON conversations(project_path)
conversations_started_at_idx ON conversations(started_at)
conversations_ended_at_idx ON conversations(ended_at)
messages_role_idx ON messages(role)
messages_timestamp_idx ON messages(timestamp)
tool_uses_tool_name_idx ON tool_uses(tool_name)
tool_uses_timestamp_idx ON tool_uses(timestamp)
tool_uses_status_idx ON tool_uses(status)
conversation_embeddings_chunk_index_idx ON conversation_embeddings(chunk_index)
```

**Composite Indexes** (Multi-column):
```sql
-- Most common query pattern: messages by conversation, ordered by time
idx_messages_conversation_timestamp ON messages(conversation_id, timestamp DESC)

-- Tool uses by message, ordered by time
idx_tool_uses_message_timestamp ON tool_uses(message_id, timestamp DESC)

-- Session lookup with time ordering
idx_conversations_session_started ON conversations(session_id, started_at DESC)

-- Tool analytics
idx_tool_uses_name_status ON tool_uses(tool_name, status, timestamp DESC)
```

**Partial Indexes** (Conditional):
```sql
-- Active conversations (no end time)
idx_conversations_active ON conversations(started_at DESC)
WHERE ended_at IS NULL
```

**GIN Indexes** (JSON):
```sql
-- JSON metadata queries
idx_conversations_metadata_gin ON conversations USING gin(metadata)
idx_messages_metadata_gin ON messages USING gin(metadata)
idx_messages_tool_calls_gin ON messages USING gin(tool_calls)
idx_tool_uses_parameters_gin ON tool_uses USING gin(parameters)
idx_tool_uses_response_gin ON tool_uses USING gin(response)
```

**HNSW Index** (Vector):
```sql
-- Vector similarity search
idx_conversation_embeddings_vector_hnsw
ON conversation_embeddings USING hnsw(embedding vector_cosine_ops)
WHERE embedding IS NOT NULL
```

### Index Usage Patterns

**Query**: Get conversation with messages
```sql
-- Uses: conversations_pkey, messages_conversation_id_idx, idx_messages_conversation_timestamp
SELECT * FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE c.id = 'clxxx...'
ORDER BY m.timestamp ASC
```

**Query**: Find conversation by session
```sql
-- Uses: conversations_session_id_idx
SELECT * FROM conversations WHERE session_id = 'session-abc123'
```

**Query**: Get active conversations
```sql
-- Uses: idx_conversations_active (partial index)
SELECT * FROM conversations
WHERE ended_at IS NULL
ORDER BY started_at DESC
```

**Query**: Tool usage analytics
```sql
-- Uses: idx_tool_uses_name_status
SELECT tool_name, status, COUNT(*), AVG(duration)
FROM tool_uses
WHERE tool_name = 'Read'
GROUP BY tool_name, status
```

**Query**: Vector similarity search
```sql
-- Uses: idx_conversation_embeddings_vector_hnsw
SELECT c.*, embedding <=> '[...]'::vector AS distance
FROM conversation_embeddings ce
JOIN conversations c ON c.id = ce.conversation_id
WHERE embedding IS NOT NULL
ORDER BY embedding <=> '[...]'::vector
LIMIT 10
```

---

## Relationships

### conversations → messages

**Type**: One-to-Many
**Foreign Key**: `messages.conversation_id` → `conversations.id`
**On Delete**: CASCADE (delete messages when conversation deleted)
**On Update**: CASCADE (update messages when conversation id changes)

**Usage**:
```typescript
// Prisma query
const conversation = await prisma.conversation.findUnique({
  where: { id: 'clxxx...' },
  include: {
    messages: {
      orderBy: { timestamp: 'asc' }
    }
  }
})
```

---

### messages → tool_uses

**Type**: One-to-Many
**Foreign Key**: `tool_uses.message_id` → `messages.id`
**On Delete**: CASCADE (delete tool uses when message deleted)
**On Update**: CASCADE (update tool uses when message id changes)

**Usage**:
```typescript
// Prisma query
const message = await prisma.message.findUnique({
  where: { id: 'clyyy...' },
  include: {
    toolUses: {
      orderBy: { timestamp: 'asc' }
    }
  }
})
```

---

### conversations → conversation_embeddings

**Type**: One-to-Many
**Foreign Key**: `conversation_embeddings.conversation_id` → `conversations.id`
**On Delete**: CASCADE (delete embeddings when conversation deleted)
**On Update**: CASCADE (update embeddings when conversation id changes)

**Usage**:
```typescript
// Prisma query
const conversation = await prisma.conversation.findUnique({
  where: { id: 'clxxx...' },
  include: {
    conversationEmbeddings: {
      orderBy: { chunkIndex: 'asc' }
    }
  }
})
```

---

## Data Types

### CUID (Collision-resistant Unique Identifier)

**Format**: 25-character alphanumeric string
**Example**: `clxxx123456789abc`

**Advantages**:
- URL-safe (no special characters)
- Sortable by creation time
- Globally unique (collision probability ~1 in 10^36)
- Generated client-side (no round-trip to database)

**Generation**:
```typescript
import { cuid } from '@prisma/client/runtime/library'
const id = cuid() // "clxxx123456789abc"
```

---

### TIMESTAMP(3)

**Format**: PostgreSQL timestamp with 3 decimal places (millisecond precision)
**Example**: `2025-09-29 19:00:00.123`

**ISO 8601**: `2025-09-29T19:00:00.123Z` (in JSON)

**Timezone**: Stored as UTC, displayed as UTC

**Prisma Type**: `DateTime`

---

### JSONB

**Format**: PostgreSQL binary JSON (more efficient than TEXT JSON)

**Advantages**:
- Indexed with GIN indexes
- Query with JSON operators
- No parsing overhead
- Supports nested structures

**Example**:
```json
{
  "platform": "win32",
  "nodeVersion": "18.0.0",
  "custom": {
    "nested": "value"
  }
}
```

**Queries**:
```sql
-- Get specific field
SELECT metadata->>'platform' FROM conversations

-- Check for key existence
SELECT * FROM conversations WHERE metadata ? 'platform'

-- Match nested value
SELECT * FROM conversations WHERE metadata @> '{"platform":"win32"}'
```

---

### vector(1536)

**Format**: pgvector extension type
**Dimensions**: 1536 (OpenAI text-embedding-3-small)

**Example**: `[0.023, -0.015, 0.089, ... 1536 values]`

**Operations**:
- Cosine similarity: `embedding <=> other_embedding`
- Euclidean distance: `embedding <-> other_embedding`
- Inner product: `embedding <#> other_embedding`

**Storage**: ~6KB per embedding (1536 × 4 bytes)

---

### ENUM Role

**Values**: `user`, `assistant`, `system`, `function`, `tool`

**Usage**:
```typescript
enum Role {
  user = 'user',
  assistant = 'assistant',
  system = 'system',
  function = 'function',
  tool = 'tool'
}
```

**Database**: Stored as PostgreSQL ENUM type for efficiency

---

## Constraints

### Primary Keys

All tables use **CUID primary keys**:
- Globally unique
- Non-sequential (no information leakage)
- Indexed automatically
- No auto-increment issues in distributed systems

---

### Foreign Keys

All foreign keys have **CASCADE delete**:
- Deleting conversation → deletes messages, embeddings
- Deleting message → deletes tool_uses
- Maintains referential integrity
- No orphaned records

**Trade-off**: Cannot undelete parent without restoring children

---

### NOT NULL Constraints

**Required fields** (cannot be NULL):
- All `id` fields (primary keys)
- All `conversation_id` / `message_id` fields (foreign keys)
- `messages.role` (must specify role)
- `messages.content` (message must have content)
- `tool_uses.tool_name` (must specify tool)
- `conversation_embeddings.chunk_text` (must have source text)
- All timestamp fields (`created_at`, `updated_at`)

**Optional fields** (can be NULL):
- `conversations.session_id` (may not have session)
- `conversations.title` (auto-generated if NULL)
- `conversations.ended_at` (NULL = active)
- All `metadata` fields (optional additional data)
- `tool_uses.duration` (may not be measured)
- `tool_uses.status` (may not be known)
- `conversation_embeddings.embedding` (may not be generated yet)

---

### Unique Constraints

**None explicitly defined**, but:
- `session_id` should be unique per conversation (enforced by application)
- `id` fields are unique by definition (primary keys)

---

## Query Patterns

### Common Queries

**1. Get all conversations**:
```sql
SELECT * FROM conversations
ORDER BY updated_at DESC
LIMIT 20
```

**Indexes used**: None (full table scan) - Add index if needed

---

**2. Get conversation with messages**:
```sql
SELECT
  c.*,
  json_agg(m.* ORDER BY m.timestamp) AS messages
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE c.id = $1
GROUP BY c.id
```

**Indexes used**:
- `conversations_pkey` (conversation lookup)
- `messages_conversation_id_idx` (join)
- `idx_messages_conversation_timestamp` (ordering)

---

**3. Get messages with tool uses**:
```sql
SELECT
  m.*,
  json_agg(t.* ORDER BY t.timestamp) AS tool_uses
FROM messages m
LEFT JOIN tool_uses t ON t.message_id = m.id
WHERE m.conversation_id = $1
GROUP BY m.id
ORDER BY m.timestamp
```

**Indexes used**:
- `messages_conversation_id_idx` (filter)
- `tool_uses_message_id_idx` (join)
- `idx_tool_uses_message_timestamp` (ordering)

---

**4. Find conversations by project**:
```sql
SELECT * FROM conversations
WHERE project_path LIKE 'c:\projects\arrakis%'
ORDER BY started_at DESC
```

**Indexes used**: `conversations_project_path_idx`

---

**5. Get active conversations**:
```sql
SELECT * FROM conversations
WHERE ended_at IS NULL
ORDER BY started_at DESC
```

**Indexes used**: `idx_conversations_active` (partial index)

---

**6. Tool usage statistics**:
```sql
SELECT
  tool_name,
  COUNT(*) as total_uses,
  AVG(duration) as avg_duration_ms,
  COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
  COUNT(CASE WHEN status = 'error' THEN 1 END) as error_count
FROM tool_uses
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY tool_name
ORDER BY total_uses DESC
```

**Indexes used**: `idx_tool_uses_name_status`, `tool_uses_timestamp_idx`

---

**7. Vector similarity search**:
```sql
SELECT
  c.id,
  c.title,
  ce.chunk_text,
  ce.embedding <=> $1::vector AS distance
FROM conversation_embeddings ce
JOIN conversations c ON c.id = ce.conversation_id
WHERE ce.embedding IS NOT NULL
ORDER BY ce.embedding <=> $1::vector
LIMIT 10
```

**Indexes used**: `idx_conversation_embeddings_vector_hnsw` (HNSW index)

**Note**: $1 is a vector parameter like `[0.023, -0.015, ...]`

---

### Optimized Query Tips

**1. Use includes instead of joins** (Prisma):
```typescript
// Good - uses efficient joins
const conversations = await prisma.conversation.findMany({
  include: {
    messages: { orderBy: { timestamp: 'asc' } }
  }
})

// Avoid - N+1 query problem
const conversations = await prisma.conversation.findMany()
for (const conv of conversations) {
  const messages = await prisma.message.findMany({
    where: { conversationId: conv.id }
  })
}
```

---

**2. Filter before joining**:
```sql
-- Good - filter first, then join
SELECT * FROM conversations c
JOIN messages m ON m.conversation_id = c.id
WHERE c.project_path = 'c:\projects\arrakis'
AND m.timestamp > NOW() - INTERVAL '7 days'

-- Avoid - join all, then filter
SELECT * FROM conversations c
JOIN messages m ON m.conversation_id = c.id
WHERE c.project_path = 'c:\projects\arrakis'
```

---

**3. Use pagination**:
```typescript
// Good - paginated query
const conversations = await prisma.conversation.findMany({
  take: 20,
  skip: page * 20,
  orderBy: { updatedAt: 'desc' }
})

// Avoid - load all conversations
const conversations = await prisma.conversation.findMany()
```

---

**4. Project only needed fields**:
```typescript
// Good - select specific fields
const conversations = await prisma.conversation.findMany({
  select: {
    id: true,
    title: true,
    startedAt: true,
    _count: { select: { messages: true } }
  }
})

// Avoid - load all fields
const conversations = await prisma.conversation.findMany()
```

---

## Performance Considerations

### Database Size Estimates

**Typical usage** (1 year, 1000 conversations):
- Conversations: ~100 KB (100 bytes × 1000)
- Messages: ~5 MB (500 bytes × 10,000)
- Tool Uses: ~50 MB (1 KB × 50,000)
- Embeddings: ~30 MB (6 KB × 5,000)
- **Total**: ~85 MB data + ~20 MB indexes = **~105 MB**

**Heavy usage** (1 year, 10,000 conversations):
- Conversations: ~1 MB
- Messages: ~50 MB
- Tool Uses: ~500 MB
- Embeddings: ~300 MB
- **Total**: ~851 MB data + ~200 MB indexes = **~1 GB**

---

### Index Overhead

**Index size** (approximate):
- B-tree indexes: ~30% of table size
- GIN indexes: ~50% of column size
- HNSW indexes: ~20% of vector data size

**Total index overhead**: ~200-400 MB for heavy usage

---

### Query Performance

**Target SLAs**:
- Primary key lookup: < 1ms
- Foreign key join: < 5ms
- Complex aggregation: < 50ms
- Vector search (10 results): < 100ms

**Current performance** (PostgreSQL 17, basic plan):
- Conversation lookup: ~2ms
- Messages + tools: ~15ms
- Analytics query: ~30ms
- Vector search: Not yet tested (embeddings not implemented)

---

### Scaling Considerations

**Vertical scaling** (larger database instance):
- Current: basic-256mb plan (256 MB RAM, 10 GB storage)
- Next: standard-512mb (512 MB RAM, 20 GB storage)
- Maximum: enterprise (16 GB RAM, 256 GB storage)

**Horizontal scaling** (future):
- Read replicas for query load distribution
- Connection pooling (currently via Prisma)
- Caching layer (Redis) for frequent queries
- Archive old conversations to separate database

**When to scale**:
- > 1 GB database size: Upgrade to standard-512mb
- > 100 queries/second: Add read replica
- > 10,000 conversations: Implement archiving
- > 1 million embeddings: Consider IVFFlat index

---

## Migration Strategy

### Initial Migration

**File**: `prisma/migrations/20250930000000_initial_schema/migration.sql`

**Creates**:
- All 4 tables
- All foreign keys
- Basic indexes (B-tree)

**Time**: ~5 seconds

---

### Index Migration

**File**: `prisma/migrations/20250930000001_vector_indexes/migration.sql`

**Creates**:
- HNSW vector index
- GIN JSON indexes
- Composite indexes
- Partial indexes

**Time**: ~10 seconds (small dataset), up to 5 minutes (large dataset)

---

### Future Migrations

**Adding columns** (backward compatible):
```prisma
model Conversation {
  // ... existing fields
  newField String? // Add as optional (nullable)
}
```

**Migration command**: `npx prisma migrate dev --name add_new_field`

---

**Removing columns** (breaking change):
1. Mark column as optional (migration 1)
2. Update application to stop using column
3. Deploy application
4. Remove column from schema (migration 2)
5. Deploy migration

---

**Changing column types** (risky):
1. Add new column with new type
2. Backfill data from old column
3. Update application to use new column
4. Deploy application
5. Remove old column

---

## Security Considerations

### SQL Injection Prevention

**Prisma ORM** prevents SQL injection by:
- Parameterized queries (never string concatenation)
- Type-safe query builder
- Automatic escaping of user input

**Raw queries** (use with caution):
```typescript
// SAFE - parameterized
await prisma.$queryRaw`
  SELECT * FROM conversations
  WHERE project_path = ${userInput}
`

// UNSAFE - string concatenation
await prisma.$queryRawUnsafe(
  `SELECT * FROM conversations WHERE project_path = '${userInput}'`
)
```

---

### Data Encryption

**At rest**: Handled by PostgreSQL/Render (full disk encryption)

**In transit**: SSL/TLS connections (required by Render)

**Application-level**: Not implemented (no PII stored)

---

### Access Control

**Current**: Single database user with full access

**Future**: Row-level security (RLS) if multi-tenancy needed

**Recommendations**:
- Separate read-only user for analytics
- Separate migration user for schema changes
- Rotate database passwords quarterly

---

## Backup & Recovery

### Backup Strategy

**Render automatic backups**:
- Daily backups retained for 7 days
- Point-in-time recovery available
- Stored in separate region

**Manual backups**:
```bash
# Dump entire database
pg_dump $DATABASE_URL > backup.sql

# Dump schema only
pg_dump $DATABASE_URL --schema-only > schema.sql

# Dump data only
pg_dump $DATABASE_URL --data-only > data.sql
```

---

### Recovery

**Restore from backup**:
```bash
# Restore entire database
psql $DATABASE_URL < backup.sql

# Restore specific table
pg_restore --table=conversations backup.sql
```

**Point-in-time recovery** (via Render):
1. Go to Render dashboard → Database
2. Click "Backups" tab
3. Select backup date
4. Click "Restore"

---

## Monitoring

### Key Metrics

**Database health**:
- Connection count (< 20 target)
- Query latency (< 100ms p95)
- Index hit ratio (> 99% target)
- Cache hit ratio (> 95% target)

**Table growth**:
```sql
SELECT
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  pg_size_pretty(pg_relation_size(relid)) AS table_size,
  pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS indexes_size
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

**Slow queries**:
```sql
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## Resources

- **Prisma Docs**: https://www.prisma.io/docs
- **PostgreSQL 17 Docs**: https://www.postgresql.org/docs/17/
- **pgvector GitHub**: https://github.com/pgvector/pgvector
- **SQL Style Guide**: https://www.sqlstyle.guide/

---

Last Updated: 2025-09-29