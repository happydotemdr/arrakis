-- Add vector search indexes after tables are created

-- Create HNSW index for fast approximate nearest neighbor search
-- This is more efficient than IVFFlat for datasets under 1M vectors
CREATE INDEX IF NOT EXISTS idx_conversation_embeddings_vector_hnsw
ON "conversation_embeddings"
USING hnsw (embedding vector_cosine_ops)
WHERE embedding IS NOT NULL;

-- Add GIN index for JSONB metadata columns for fast querying
CREATE INDEX IF NOT EXISTS idx_conversations_metadata_gin
ON "conversations"
USING gin (metadata);

CREATE INDEX IF NOT EXISTS idx_messages_metadata_gin
ON "messages"
USING gin (metadata);

CREATE INDEX IF NOT EXISTS idx_messages_tool_calls_gin
ON "messages"
USING gin (tool_calls);

CREATE INDEX IF NOT EXISTS idx_tool_uses_parameters_gin
ON "tool_uses"
USING gin (parameters);

CREATE INDEX IF NOT EXISTS idx_tool_uses_response_gin
ON "tool_uses"
USING gin (response);

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_messages_conversation_timestamp
ON "messages" (conversation_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_tool_uses_message_timestamp
ON "tool_uses" (message_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_session_started
ON "conversations" (session_id, started_at DESC);

-- Add partial index for active conversations (no end time)
CREATE INDEX IF NOT EXISTS idx_conversations_active
ON "conversations" (started_at DESC)
WHERE ended_at IS NULL;

-- Add index for tool usage analytics
CREATE INDEX IF NOT EXISTS idx_tool_uses_name_status
ON "tool_uses" (tool_name, status, timestamp DESC);