-- Phase 6 System A: Embeddings Support Migration
-- Add vector embeddings support for semantic search

-- Create embeddings table for storing message embeddings
CREATE TABLE IF NOT EXISTS message_embeddings (
  embedding_id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0, -- For large messages split into chunks
  text_content TEXT NOT NULL, -- The actual text that was embedded
  embedding vector(1536) NOT NULL, -- OpenAI text-embedding-3-small dimensions
  model VARCHAR(50) NOT NULL DEFAULT 'text-embedding-3-small',
  token_count INTEGER NOT NULL DEFAULT 0,
  start_index INTEGER NOT NULL DEFAULT 0, -- Where this chunk starts in the original text
  end_index INTEGER NOT NULL DEFAULT 0, -- Where this chunk ends in the original text
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

  -- Foreign key to messages table
  CONSTRAINT fk_message_embeddings_message
    FOREIGN KEY (message_id) REFERENCES messages(message_id) ON DELETE CASCADE,

  -- Unique constraint to prevent duplicate embeddings
  UNIQUE(message_id, chunk_index)
);

-- Create session embeddings table for session-level semantic content
CREATE TABLE IF NOT EXISTS session_embeddings (
  session_embedding_id SERIAL PRIMARY KEY,
  session_id UUID NOT NULL,
  summary_text TEXT NOT NULL, -- Summarized session content for embedding
  embedding vector(1536) NOT NULL,
  model VARCHAR(50) NOT NULL DEFAULT 'text-embedding-3-small',
  token_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

  -- Foreign key to sessions table
  CONSTRAINT fk_session_embeddings_session
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,

  -- Unique constraint - one embedding per session
  UNIQUE(session_id)
);

-- Create indexes for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_message_embeddings_vector
  ON message_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_session_embeddings_vector
  ON session_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_message_embeddings_message_id
  ON message_embeddings(message_id);

CREATE INDEX IF NOT EXISTS idx_message_embeddings_created_at
  ON message_embeddings(created_at);

CREATE INDEX IF NOT EXISTS idx_session_embeddings_session_id
  ON session_embeddings(session_id);

CREATE INDEX IF NOT EXISTS idx_session_embeddings_created_at
  ON session_embeddings(created_at);

-- Add column to track embedding status on messages
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS embedding_status VARCHAR(20) DEFAULT 'pending';

-- Add column to track embedding status on sessions
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS embedding_status VARCHAR(20) DEFAULT 'pending';

-- Create embedding processing queue table
CREATE TABLE IF NOT EXISTS embedding_queue (
  queue_id SERIAL PRIMARY KEY,
  item_type VARCHAR(20) NOT NULL, -- 'message' or 'session'
  item_id VARCHAR(100) NOT NULL, -- message_id or session_id
  priority INTEGER NOT NULL DEFAULT 5, -- 1 (highest) to 10 (lowest)
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMPTZ,

  -- Unique constraint to prevent duplicate queue entries
  UNIQUE(item_type, item_id)
);

-- Create indexes for queue processing
CREATE INDEX IF NOT EXISTS idx_embedding_queue_status_priority
  ON embedding_queue(status, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_embedding_queue_item
  ON embedding_queue(item_type, item_id);

-- Create embedding processing log table for monitoring
CREATE TABLE IF NOT EXISTS embedding_processing_log (
  log_id SERIAL PRIMARY KEY,
  item_type VARCHAR(20) NOT NULL,
  item_id VARCHAR(100) NOT NULL,
  operation VARCHAR(50) NOT NULL, -- 'embed', 'reembed', 'delete'
  status VARCHAR(20) NOT NULL, -- success, error
  processing_time_ms INTEGER,
  token_count INTEGER,
  chunk_count INTEGER DEFAULT 1,
  model VARCHAR(50),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create index for monitoring queries
CREATE INDEX IF NOT EXISTS idx_embedding_log_created_at
  ON embedding_processing_log(created_at);

CREATE INDEX IF NOT EXISTS idx_embedding_log_status
  ON embedding_processing_log(status, created_at);

-- Update existing messages to be queued for embedding
INSERT INTO embedding_queue (item_type, item_id, priority)
SELECT 'message', message_id::text, 3
FROM messages
WHERE message_id NOT IN (
  SELECT item_id::integer
  FROM embedding_queue
  WHERE item_type = 'message'
)
ON CONFLICT (item_type, item_id) DO NOTHING;

-- Update existing sessions to be queued for embedding
INSERT INTO embedding_queue (item_type, item_id, priority)
SELECT 'session', session_id::text, 4
FROM sessions
WHERE session_id NOT IN (
  SELECT item_id::uuid
  FROM embedding_queue
  WHERE item_type = 'session'
)
ON CONFLICT (item_type, item_id) DO NOTHING;

-- Create function to automatically queue new messages for embedding
CREATE OR REPLACE FUNCTION queue_message_for_embedding()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO embedding_queue (item_type, item_id, priority)
  VALUES ('message', NEW.message_id::text, 3)
  ON CONFLICT (item_type, item_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to automatically queue new sessions for embedding
CREATE OR REPLACE FUNCTION queue_session_for_embedding()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO embedding_queue (item_type, item_id, priority)
  VALUES ('session', NEW.session_id::text, 4)
  ON CONFLICT (item_type, item_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically queue new items
DROP TRIGGER IF EXISTS trigger_queue_message_embedding ON messages;
CREATE TRIGGER trigger_queue_message_embedding
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION queue_message_for_embedding();

DROP TRIGGER IF EXISTS trigger_queue_session_embedding ON sessions;
CREATE TRIGGER trigger_queue_session_embedding
  AFTER INSERT ON sessions
  FOR EACH ROW EXECUTE FUNCTION queue_session_for_embedding();

-- Grant permissions for application user
-- Note: Replace 'arrakis_user' with your actual application database user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON message_embeddings TO arrakis_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON session_embeddings TO arrakis_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON embedding_queue TO arrakis_user;
-- GRANT SELECT, INSERT ON embedding_processing_log TO arrakis_user;
-- GRANT USAGE ON SEQUENCE message_embeddings_embedding_id_seq TO arrakis_user;
-- GRANT USAGE ON SEQUENCE session_embeddings_session_embedding_id_seq TO arrakis_user;
-- GRANT USAGE ON SEQUENCE embedding_queue_queue_id_seq TO arrakis_user;
-- GRANT USAGE ON SEQUENCE embedding_processing_log_log_id_seq TO arrakis_user;