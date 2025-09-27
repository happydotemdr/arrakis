# Claude Code Conversation Capture & Learning System

## Executive Summary

This document outlines a modern, robust system for capturing and leveraging
Claude Code conversations to build a personal AI assistant with memory and
learning capabilities. Unlike traditional approaches that rely on external tools
or outdated methods, this plan leverages Claude Code's native 2025 capabilities
including structured JSON output, session management, OpenTelemetry monitoring,
and the latest Neon PostgreSQL with pgvector enhancements.

The system captures every aspect of Claude Code interactions - from user prompts
and assistant responses to internal tool usage, costs, and reasoning - then
stores this data in a vector-enabled database for semantic search and contextual
recall. This creates a continuously learning AI assistant that remembers past
conversations and can provide increasingly relevant help over time.

## Current State Analysis (Updated September 26, 2025)

### ✅ Arrakis Phase 4 Completion Status

**What We Actually Built**:

- **✅ Real Claude API Integration**: Direct Anthropic Claude API
  (`claude-sonnet-4-20250514`)
- **✅ Working Database Capture**: Neon PostgreSQL with automatic conversation
  storage
- **✅ Retro Sci-Fi Interface**: 1980s cyberpunk terminal aesthetic with
  scanlines and neon effects
- **✅ End-to-End Workflow**: User prompt → Real Claude API → Response display →
  Database storage
- **✅ Next.js 15 Foundation**: 54 React components, tRPC API layer, responsive
  design

### 🎯 Current Architecture vs Original Vision

**Current Implementation**: Basic Claude API

```
User → [Arrakis] → @anthropic-ai/sdk → Text Response → Database Storage
```

**Original Vision**: Claude Code SDK Integration

```
User → [Arrakis] → Claude Code SDK → File Operations + Tool Access + Multi-step Reasoning
```

### 🚀 The Revolutionary Next Step: Dual-System Architecture

Based on latest documentation research, we can build TWO complementary systems:

**System A: Conversational Interface (Current)**

- Basic Claude API integration (`@anthropic-ai/sdk`)
- Text-based conversations with UI
- Perfect for user interactions and discussions
- ✅ Already working and capturing to database

**System B: Claude Code Development Interface (New)**

- Full Claude Code SDK integration with tool access
- Read, Write, Edit, Bash, Glob, Grep capabilities
- File system operations and project manipulation
- Multi-step reasoning and complex task execution
- Workspace management and project-aware context
- **Self-Modification Potential**: Can improve its own codebase

**Shared Foundation**:

- Single centralized knowledge base (current Neon database)
- Both systems learn from and contribute to shared memory
- Cross-system context awareness and learning

### Problems with Original Plan

The provided plan has several outdated assumptions:

1. **SpecStory Dependency**: Relies on external tool when Claude Code has native
   logging
2. **Manual Parsing**: Assumes markdown file parsing when structured JSON is
   available
3. **Legacy Storage References**: Mentions old SQLite patterns that no longer
   apply
4. **Missing 2025 Features**: Doesn't leverage new monitoring, session
   management, or output formats

## Proposed Architecture

### 1. Dual-System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARRAKIS DUAL ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐              ┌─────────────────┐          │
│  │   System A:     │              │   System B:     │          │
│  │ Chat Interface  │              │  Claude Code    │          │
│  │ (Basic API)     │              │   (Full SDK)    │          │
│  └─────────────────┘              └─────────────────┘          │
│           │                               │                    │
│           ▼                               ▼                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │            SHARED CAPTURE LAYER                             │ │
│  │                 (TypeScript)                                │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                               │                                 │
│                               ▼                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │         CENTRALIZED KNOWLEDGE BASE                          │ │
│  │            (Neon + pgvector)                                │ │
│  └─────────────────────────────────────────────────────────────┘ │
│           │                               │                    │
│           ▼                               ▼                    │
│  ┌─────────────────┐              ┌─────────────────┐          │
│  │ Context Engine  │              │Vector Processing│          │
│  │    (RAG)        │              │  (Embeddings)   │          │
│  └─────────────────┘              └─────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Core Components

#### A. Conversation Capture Service

**Technology**: Node.js/TypeScript using Claude Code SDK **Responsibilities**:

- Intercept all Claude Code interactions via SDK/CLI wrapper
- Stream conversation data to database in real-time
- Handle session management and resumption
- Capture OpenTelemetry events for comprehensive monitoring

#### B. Database Layer

**Technology**: Neon PostgreSQL with pgvector extension

**Key Features**:

- Serverless autoscaling
- 30x faster HNSW index building (2025 enhancement)
- Half-precision vector support for memory efficiency
- Built-in vector similarity search

#### C. Vector Processing Pipeline

**Technology**: Background service with embedding models

**Responsibilities**:

- Generate embeddings for new messages
- Store vectors with efficient HNSW indexing
- Support multiple embedding models (OpenAI, local alternatives)

#### D. Context Retrieval System

**Technology**: RAG-enabled search service

**Responsibilities**:

- Semantic search across conversation history
- Context injection for new conversations
- Smart session resumption with historical context

#### E. Multi-Model Support Layer

**Technology**: Unified API interface

**Responsibilities**:

- Support Claude Code, direct Anthropic API, OpenAI API
- Model-specific metadata handling
- Unified cost tracking and session management

## Detailed Database Schema

### Core Tables

```sql
-- Users table for multi-user support
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    preferences JSONB DEFAULT '{}'
);

-- Sessions with comprehensive metadata
CREATE TABLE sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(user_id),
    claude_session_id VARCHAR(255), -- Claude's internal session ID
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMPTZ,
    title VARCHAR(500),
    model VARCHAR(100),
    total_cost_usd DECIMAL(10,6) DEFAULT 0,
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0,
    total_cache_read_tokens INTEGER DEFAULT 0,
    total_cache_creation_tokens INTEGER DEFAULT 0,
    turn_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active', -- active, completed, error
    metadata JSONB DEFAULT '{}'
);

-- Messages with full context and token tracking
CREATE TABLE messages (
    message_id SERIAL PRIMARY KEY,
    session_id UUID REFERENCES sessions(session_id),
    role VARCHAR(20) NOT NULL, -- user, assistant, system
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'text', -- text, code, image, etc.
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cache_read_tokens INTEGER,
    cache_creation_tokens INTEGER,
    cost_usd DECIMAL(8,6),
    model VARCHAR(100),
    metadata JSONB DEFAULT '{}' -- store any additional Claude-specific data
);

-- Vector embeddings for semantic search
CREATE TABLE message_embeddings (
    embedding_id SERIAL PRIMARY KEY,
    message_id INTEGER REFERENCES messages(message_id),
    embedding VECTOR(1536), -- OpenAI ada-002 size, adjust based on model
    embedding_model VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tool usage tracking
CREATE TABLE tool_events (
    event_id SERIAL PRIMARY KEY,
    session_id UUID REFERENCES sessions(session_id),
    message_id INTEGER REFERENCES messages(message_id),
    tool_name VARCHAR(100) NOT NULL,
    tool_parameters JSONB,
    tool_result JSONB,
    success BOOLEAN,
    duration_ms INTEGER,
    decision VARCHAR(20), -- accept, reject
    decision_source VARCHAR(50), -- config, user_permanent, user_temporary, etc.
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- OpenTelemetry events for comprehensive monitoring
CREATE TABLE telemetry_events (
    event_id SERIAL PRIMARY KEY,
    session_id UUID REFERENCES sessions(session_id),
    event_name VARCHAR(100) NOT NULL, -- claude_code.user_prompt, claude_code.api_request, etc.
    event_type VARCHAR(50), -- user_prompt, tool_result, api_request, api_error, tool_decision
    attributes JSONB NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Extracted key attributes for easier querying
    user_id INTEGER,
    prompt_length INTEGER,
    tool_name VARCHAR(100),
    model VARCHAR(100),
    cost_usd DECIMAL(8,6),
    duration_ms INTEGER,
    success BOOLEAN
);

-- Conversation summaries for quick context
CREATE TABLE conversation_summaries (
    summary_id SERIAL PRIMARY KEY,
    session_id UUID REFERENCES sessions(session_id),
    summary_text TEXT NOT NULL,
    summary_type VARCHAR(50) DEFAULT 'auto', -- auto, manual, ai_generated
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    embedding VECTOR(1536) -- for semantic search of summaries
);
```

### Indexes for Performance

```sql
-- Session indexes
CREATE INDEX idx_sessions_user_created ON sessions(user_id, created_at DESC);
CREATE INDEX idx_sessions_claude_session ON sessions(claude_session_id);
CREATE INDEX idx_sessions_status ON sessions(status);

-- Message indexes
CREATE INDEX idx_messages_session_created ON messages(session_id, created_at);
CREATE INDEX idx_messages_role ON messages(role);

-- Vector similarity search indexes (HNSW for best performance)
CREATE INDEX idx_message_embeddings_vector ON message_embeddings
USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_summary_embeddings_vector ON conversation_summaries
USING hnsw (embedding vector_cosine_ops);

-- Tool event indexes
CREATE INDEX idx_tool_events_session ON tool_events(session_id, created_at);
CREATE INDEX idx_tool_events_tool_name ON tool_events(tool_name);

-- Telemetry indexes
CREATE INDEX idx_telemetry_session_event ON telemetry_events(session_id, event_type, timestamp);
CREATE INDEX idx_telemetry_event_name ON telemetry_events(event_name);
```

## Implementation Details

### 1. Conversation Capture Service

**File**: `src/services/ConversationCapture.ts`

```typescript
interface CaptureServiceConfig {
  databaseUrl: string;
  openTelemetryEndpoint?: string;
  embeddingProvider: "openai" | "local";
  embeddingModel: string;
  autoEmbed: boolean;
}

class ConversationCaptureService {
  // Initialize with Claude Code SDK
  async startSession(userId: number, initialPrompt?: string): Promise<string>;

  // Stream conversation to database
  async captureConversation(
    sessionId: string,
    stream: ClaudeCodeStream,
  ): Promise<void>;

  // Handle OpenTelemetry events
  async processOtelEvent(event: OtelEvent): Promise<void>;

  // Resume existing session
  async resumeSession(sessionId: string, prompt: string): Promise<void>;
}
```

**Key Implementation Points**:

- Use Claude Code TypeScript SDK for direct integration
- Stream JSON output format for real-time processing
- Capture all OpenTelemetry events via configured endpoint
- Handle session state management
- Implement retry logic and error handling
- Support both interactive and headless modes

### 2. Vector Processing Pipeline

**File**: `src/services/VectorProcessor.ts`

```typescript
interface EmbeddingJob {
  messageId: number;
  content: string;
  priority: "high" | "normal" | "low";
}

class VectorProcessor {
  // Process embedding queue
  async processEmbeddingQueue(): Promise<void>;

  // Generate embeddings for new messages
  async embedMessage(messageId: number, content: string): Promise<void>;

  // Batch processing for historical data
  async processHistoricalMessages(batchSize: number): Promise<void>;

  // Update embeddings when content changes
  async updateEmbedding(messageId: number): Promise<void>;
}
```

**Implementation Strategy**:

- Background job queue (Redis/BullMQ or PostgreSQL-based)
- Support multiple embedding providers (OpenAI, Sentence Transformers, etc.)
- Batch processing for efficiency
- Automatic retry on failures
- Rate limiting for API-based embeddings
- Cache common embeddings for optimization

### 3. Context Retrieval System

**File**: `src/services/ContextRetrieval.ts`

```typescript
interface SearchResult {
  messageId: number;
  content: string;
  similarity: number;
  sessionId: string;
  timestamp: Date;
  metadata: any;
}

class ContextRetrievalService {
  // Semantic search across all conversations
  async semanticSearch(
    query: string,
    limit: number,
    threshold: number,
  ): Promise<SearchResult[]>;

  // Get relevant context for new conversation
  async getRelevantContext(prompt: string, userId: number): Promise<string>;

  // Find similar past sessions
  async findSimilarSessions(
    sessionId: string,
    limit: number,
  ): Promise<Session[]>;

  // Generate conversation summary
  async generateSummary(sessionId: string): Promise<string>;
}
```

**RAG Implementation**:

- Vector similarity search with pgvector
- Hybrid search (semantic + keyword)
- Context relevance scoring
- Automatic context injection
- Session clustering by topic
- Smart context window management

### 4. Multi-Model Support

**File**: `src/services/ModelConnector.ts`

```typescript
interface ModelProvider {
  name: "claude-code" | "anthropic-api" | "openai" | "custom";
  config: any;
}

abstract class BaseModelConnector {
  abstract sendMessage(
    prompt: string,
    context?: string,
  ): Promise<ModelResponse>;
  abstract getSessionId(): string;
  abstract getUsageStats(): UsageStats;
}

class ClaudeCodeConnector extends BaseModelConnector {
  // Use Claude Code SDK/CLI
}

class AnthropicAPIConnector extends BaseModelConnector {
  // Direct Anthropic API usage
}

class OpenAIConnector extends BaseModelConnector {
  // OpenAI API integration
}
```

## Development Integration

### 1. VS Code Extension

**Features**:

- Conversation history browser
- Semantic search within editor
- Quick context lookup
- Session management
- Cost tracking dashboard

**Files**:

```
claude-conversations-extension/
├── src/
│   ├── extension.ts
│   ├── conversationProvider.ts
│   ├── searchProvider.ts
│   └── webviewProvider.ts
├── webview-ui/
│   ├── index.html
│   ├── script.js
│   └── style.css
└── package.json
```

### 2. CLI Tools

**Conversation Query Tool**:

```bash
# Search conversations
claude-query "authentication bug" --limit 5

# Get session summary
claude-query --session abc123 --summary

# Export conversations
claude-query --export --format json --output conversations.json
```

**Session Management**:

```bash
# List recent sessions
claude-sessions list --recent 10

# Resume with context
claude-sessions resume abc123 --with-context

# Archive old sessions
claude-sessions archive --older-than 30d
```

### 3. Dashboard Interface

**Technology**: Next.js with real-time updates **Features**:

- Live conversation monitoring
- Cost analytics
- Usage patterns
- Model performance comparison
- Vector search interface

## Configuration and Setup

### 1. Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@db.neon.com/dbname
PGVECTOR_ENABLED=true

# Claude Code
ANTHROPIC_API_KEY=your_api_key
CLAUDE_CODE_SESSION_DIR=/path/to/sessions

# OpenTelemetry
OTEL_LOGS_EXPORTER=otlp
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_LOG_USER_PROMPTS=1

# Embeddings
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=your_openai_key
EMBEDDING_MODEL=text-embedding-ada-002
EMBEDDING_BATCH_SIZE=100

# Application
APP_ENV=development
LOG_LEVEL=info
QUEUE_REDIS_URL=redis://localhost:6379
```

### 2. Configuration Files

**config/database.ts**:

```typescript
export const databaseConfig = {
  url: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production",
  poolSize: 10,
  vectorDimensions: 1536,
  enableVectorIndex: true,
};
```

**config/claude.ts**:

```typescript
export const claudeConfig = {
  defaultModel: "claude-sonnet-4-20250514",
  maxTurns: 50,
  outputFormat: "json",
  verboseLogging: true,
  sessionTimeout: 3600000, // 1 hour
  allowedTools: ["Bash", "Read", "Edit", "Write"],
  permissionMode: "acceptEdits",
};
```

### 3. Docker Compose Setup

```yaml
version: "3.8"
services:
  app:
    build: .
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    depends_on:
      - redis
      - otel-collector

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  otel-collector:
    image: otel/opentelemetry-collector:latest
    command: ["--config=/etc/otel-collector-config.yaml"]
    volumes:
      - ./otel-collector-config.yaml:/etc/otel-collector-config.yaml
    ports:
      - "4317:4317"
      - "4318:4318"

  vector-processor:
    build: .
    command: npm run process-vectors
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - redis
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)

1. Set up Neon PostgreSQL with pgvector
2. Create database schema and indexes
3. Implement basic conversation capture service
4. Set up OpenTelemetry collection
5. Basic TypeScript SDK integration

### Phase 2: Vector Processing (Week 3)

1. Implement embedding generation pipeline
2. Set up background job processing
3. Create vector similarity search
4. Add basic context retrieval
5. Performance optimization and indexing

### Phase 3: Context & RAG (Week 4)

1. Build comprehensive context retrieval system
2. Implement RAG-style context injection
3. Add conversation summarization
4. Create smart session resumption
5. Add semantic search capabilities

### Phase 4: Multi-Model Support (Week 5)

1. Create unified model connector interface
2. Implement Anthropic API direct connector
3. Add OpenAI API support
4. Create model switching logic
5. Unified cost and usage tracking

### Phase 5: Developer Tools (Week 6-7)

1. Build VS Code extension
2. Create CLI tools for querying
3. Implement dashboard interface
4. Add monitoring and analytics
5. Create export/import functionality

### Phase 6: Advanced Features (Week 8+)

1. Proactive suggestions based on context
2. Conversation clustering and tagging
3. Advanced analytics and insights
4. Team collaboration features
5. API for third-party integrations

## Monitoring and Analytics

### 1. Key Metrics to Track

- Conversation volume and frequency
- Token usage and costs per model
- Tool usage patterns
- Context retrieval effectiveness
- Vector search performance
- Session duration and completion rates

### 2. Alerting and Health Checks

- Database connection health
- Embedding pipeline status
- OpenTelemetry data flow
- API rate limit monitoring
- Cost threshold alerts

### 3. Performance Optimization

- Query optimization for vector searches
- Embedding cache strategies
- Database connection pooling
- Background job queue monitoring
- Memory usage tracking

## Conclusion

This comprehensive plan leverages the latest 2025 capabilities of Claude Code,
Neon PostgreSQL, and vector database technologies to create a sophisticated AI
conversation capture and learning system. By building on native Claude Code
features rather than external tools, the system will be more reliable,
comprehensive, and future-proof.

The modular architecture ensures extensibility for multiple AI models while the
vector-enabled database provides powerful semantic search capabilities. The
phased implementation approach allows for iterative development and validation,
ensuring each component works effectively before building upon it.

This system will transform how developers interact with AI assistants, creating
a continuously learning and improving AI companion that remembers context,
learns from past interactions, and provides increasingly relevant assistance
over time.
