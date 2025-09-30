-- Performance optimization indexes
-- These indexes target the most common query patterns in the application
-- Note: CONCURRENTLY removed to allow migration inside transaction

-- Conversations: Optimize list queries ordered by updatedAt
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at_desc
ON conversations (updated_at DESC);

-- Conversations: Session lookup (used frequently in hooks)
CREATE INDEX IF NOT EXISTS idx_conversations_session_id_not_null
ON conversations (session_id) WHERE session_id IS NOT NULL;

-- Messages: Optimize conversation detail queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
ON messages (conversation_id, created_at ASC);

-- Messages: Optimize recent message queries for conversation previews
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_desc
ON messages (conversation_id, created_at DESC);

-- Tool uses: Optimize tool analytics queries
CREATE INDEX IF NOT EXISTS idx_tool_uses_name_timestamp
ON tool_uses (tool_name, timestamp DESC);

-- Tool uses: Optimize message tool lookup
CREATE INDEX IF NOT EXISTS idx_tool_uses_message_timestamp
ON tool_uses (message_id, timestamp ASC);

-- Conversation embeddings: Optimize vector similarity searches
CREATE INDEX IF NOT EXISTS idx_embeddings_conversation_chunk
ON conversation_embeddings (conversation_id, chunk_index);

-- Composite index for conversation stats (active conversations)
CREATE INDEX IF NOT EXISTS idx_conversations_ended_started
ON conversations (ended_at, started_at) WHERE ended_at IS NULL;

-- Optimize recent conversation queries (removed - NOW() not IMMUTABLE for partial index)
-- Use application-level filtering instead of partial index for time-based queries