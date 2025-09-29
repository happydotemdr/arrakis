# Database Architecture

## Overview

This project uses PostgreSQL 17 with pgvector extension for storing and querying conversation data with semantic search capabilities using vector embeddings.

## Technology Stack

- **PostgreSQL 17**: Latest version with advanced features
- **Prisma 6.16.2**: Type-safe ORM for database operations
- **pgvector**: PostgreSQL extension for vector similarity search
- **OpenAI Embeddings**: text-embedding-3-small model (1536 dimensions)

## Database Schema

### Core Tables

#### 1. **conversations**
Primary table for conversation sessions.

| Column | Type | Description |
|--------|------|-------------|
| id | CUID | Primary key |
| session_id | String? | Claude Code session identifier |
| project_path | String? | File system path to project |
| title | String? | Auto-generated or user-provided title |
| description | String? | Brief description |
| started_at | DateTime | Conversation start time |
| ended_at | DateTime? | Conversation end time |
| metadata | JSON | Additional metadata |

**Indexes:**
- `session_id` - Fast lookup by session
- `project_path` - Filter by project
- `started_at`, `ended_at` - Time-based queries
- Active conversations (partial index where `ended_at IS NULL`)

#### 2. **messages**
Stores individual messages within conversations.

| Column | Type | Description |
|--------|------|-------------|
| id | CUID | Primary key |
| conversation_id | String | Foreign key to conversations |
| role | Enum | user/assistant/system/function/tool |
| content | Text | Message content |
| tool_calls | JSON? | Array of tool invocations |
| timestamp | DateTime | Message timestamp |
| metadata | JSON? | Additional metadata |

**Indexes:**
- `conversation_id` - Messages by conversation
- `role` - Filter by message type
- `timestamp` - Chronological ordering
- Composite: `(conversation_id, timestamp DESC)`

#### 3. **tool_uses**
Tracks tool invocations and responses.

| Column | Type | Description |
|--------|------|-------------|
| id | CUID | Primary key |
| message_id | String | Foreign key to messages |
| tool_name | String | Name of tool used |
| parameters | JSON? | Tool parameters |
| response | JSON? | Tool response/result |
| duration | Int? | Execution time in ms |
| status | String? | success/error/timeout |
| timestamp | DateTime | Execution timestamp |

**Indexes:**
- `message_id` - Tools by message
- `tool_name` - Analytics by tool
- `status` - Filter by outcome
- Composite: `(tool_name, status, timestamp DESC)`

#### 4. **conversation_embeddings**
Vector embeddings for semantic search.

| Column | Type | Description |
|--------|------|-------------|
| id | CUID | Primary key |
| conversation_id | String | Foreign key to conversations |
| chunk_text | Text | Text that was embedded |
| chunk_index | Int | Position in conversation |
| embedding | vector(1536) | OpenAI embedding vector |
| metadata | JSON? | Embedding metadata |

**Indexes:**
- `conversation_id` - Embeddings by conversation
- `chunk_index` - Ordered chunks
- HNSW index on `embedding` for fast vector search

## pgvector Configuration

### Extension Setup

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Vector Operations

The system supports three main vector operations:

1. **Cosine Similarity** (`<=>`)
   - Most common for text embeddings
   - Returns distance (0 = identical, 2 = opposite)
   - Convert to similarity: `1 - distance`

2. **Euclidean Distance** (`<->`)
   - L2 distance between vectors
   - Good for spatial data

3. **Inner Product** (`<#>`)
   - Dot product similarity
   - Faster but requires normalized vectors

### Index Strategy

We use HNSW (Hierarchical Navigable Small World) indexes:
```sql
CREATE INDEX idx_conversation_embeddings_vector_hnsw
ON conversation_embeddings
USING hnsw (embedding vector_cosine_ops)
WHERE embedding IS NOT NULL;
```

**Why HNSW over IVFFlat:**
- Better recall (accuracy)
- Faster build time
- Better for datasets < 1M vectors
- No training required

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Database URL

Create `.env.local`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/arrakis?schema=public"
DIRECT_URL="postgresql://user:password@localhost:5432/arrakis?schema=public"
```

### 3. Run Migrations

```bash
# Create pgvector extension
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Or run migrations (production)
npm run db:migrate
```

### 4. Seed Database (Optional)

```bash
npm run db:seed
```

## Usage Examples

### Store an Embedding

```typescript
import { storeEmbedding } from '@/lib/vector-operations'

const embedding = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'Your text here',
})

await storeEmbedding(
  conversationId,
  'Your text here',
  embedding.data[0].embedding,
  0, // chunk index
  { model: 'text-embedding-3-small' }
)
```

### Find Similar Conversations

```typescript
import { findSimilarConversations } from '@/lib/vector-operations'

const queryEmbedding = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'Search query',
})

const results = await findSimilarConversations(
  queryEmbedding.data[0].embedding,
  10, // limit
  0.3 // similarity threshold
)
```

### Direct SQL Query

```typescript
import { db, formatVector } from '@/lib/db'

const embedding = [0.1, 0.2, ...] // 1536 dimensions
const vectorString = formatVector(embedding)

const similar = await db.$queryRaw`
  SELECT *,
    embedding <=> ${vectorString}::vector AS distance
  FROM conversation_embeddings
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> ${vectorString}::vector
  LIMIT 10
`
```

## Performance Optimization

### Connection Pooling

Configured in `src/lib/db.ts`:
- Development: Single connection reused
- Production: Connection pool with appropriate limits

### Query Optimization

1. **Use indexes**: All common query patterns have indexes
2. **Limit vector operations**: Pre-filter with WHERE clauses
3. **Batch operations**: Use `batchInsertEmbeddings` for bulk inserts
4. **Partial indexes**: Active conversations have dedicated index

### Vector Search Performance

- HNSW index provides ~95% recall with 10x speed improvement
- Pre-filter by metadata before vector operations
- Use distance threshold to limit search space
- Consider caching frequently accessed embeddings

## Monitoring

### Key Metrics to Track

```sql
-- Index usage
SELECT * FROM pg_stat_user_indexes
WHERE schemaname = 'public';

-- Slow queries
SELECT * FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC;

-- Table sizes
SELECT
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

## Backup & Recovery

### Backup Strategy

1. **Regular pg_dump**:
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

2. **Continuous archiving** (if using managed PostgreSQL)

3. **Vector data considerations**:
- Embeddings can be regenerated from text
- Consider backing up only conversation/message data
- Store embedding model version in metadata

## Security Considerations

1. **SQL Injection**: Use parameterized queries with Prisma
2. **Vector dimensions**: Validate embedding dimensions (must be 1536)
3. **Rate limiting**: Implement for vector search endpoints
4. **Access control**: Use Row Level Security if needed
5. **Sensitive data**: Don't store PII in embeddings

## Troubleshooting

### Common Issues

1. **Extension not found**:
```sql
CREATE EXTENSION vector;
-- May need superuser privileges
```

2. **Index not used**:
```sql
-- Check query plan
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM conversation_embeddings
ORDER BY embedding <=> '[...]'::vector
LIMIT 10;
```

3. **Slow vector operations**:
- Ensure HNSW index exists
- Check `work_mem` setting
- Consider reducing vector dimensions

## Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [PostgreSQL 17 Features](https://www.postgresql.org/docs/17/)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)