# Claude Code Hook Integration System

## Overview

This document describes the comprehensive Claude Code hook integration system that captures and stores all conversation data from Claude Code sessions. The system consists of hook scripts, API endpoints, transcript parsing, and database storage.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Claude Code   │───▶│   Hook Scripts   │───▶│  Next.js API    │
│   (Sessions)    │    │  (.claude/hooks) │    │  (Webhooks)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Transcript    │    │     tRPC API     │    │   PostgreSQL    │
│    Parser       │◀───│   (Database)     │◀───│   Database      │
│ (JSONL Format)  │    │   Operations     │    │ (Conversations) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Components

### 1. Hook Scripts

**Location**: `C:\projects\arrakis\.claude\hooks\capture-conversation.js`

Main Node.js script that handles all Claude Code hook events:
- `SessionStart` - Initialize conversation tracking
- `UserPromptSubmit` - Capture user prompts
- `PreToolUse` - Log tool usage starts
- `PostToolUse` - Record tool results and performance
- `Stop` - Handle conversation interruptions
- `SessionEnd` - Finalize conversation and parse transcript

**Features**:
- Robust error handling (won't break Claude Code workflow)
- Configurable via environment variables
- Retry logic for API failures
- Debug logging support
- Handles missing or invalid data gracefully

**Environment Variables**:
- `CLAUDE_HOOK_API_URL` - API endpoint URL (default: http://localhost:3000/api/claude-hooks)
- `CLAUDE_HOOK_DEBUG` - Enable debug logging (true/false)
- `CLAUDE_HOOK_ENABLED` - Enable/disable hooks (true/false)
- `CLAUDE_HOOK_TIMEOUT` - Request timeout in ms (default: 10000)
- `CLAUDE_HOOK_RETRY_ATTEMPTS` - Number of retry attempts (default: 2)
- `CLAUDE_HOOK_RETRY_DELAY` - Delay between retries in ms (default: 1000)

### 2. Hook Configuration

**Location**: `C:\projects\arrakis\.claude\settings.json`

Updated settings file that configures hooks for all events:

```json
{
  "hooks": {
    "SessionStart": [/* Capture session initialization */],
    "UserPromptSubmit": [/* Capture user input + context injection */],
    "PreToolUse": [/* Capture tool starts + security check */],
    "PostToolUse": [/* Capture tool results + formatting */],
    "Stop": [/* Capture interruptions */],
    "SessionEnd": [/* Finalize and parse transcript */]
  }
}
```

**Integration**: Works alongside existing hooks (context injection, security checks, formatting) without conflicts.

### 3. API Webhook Receiver

**Location**: `C:\projects\arrakis\src\app\api\claude-hooks\route.ts`

Next.js API route that receives and processes hook events:

**Endpoints**:
- `POST /api/claude-hooks` - Receive hook payloads

**Processing**:
- Validates incoming payloads with Zod schemas
- Routes events to appropriate handlers
- Creates/updates database records
- Parses transcripts on session end
- Syncs missing data from transcripts
- Returns appropriate responses

**Error Handling**:
- Never returns errors that would break Claude Code
- Logs all errors for debugging
- Graceful degradation when database is unavailable

### 4. TypeScript Types

**Location**: `C:\projects\arrakis\src\lib\claude\types.ts`

Comprehensive type definitions for:
- Hook event payloads (SessionStart, UserPromptSubmit, etc.)
- Transcript file format (JSONL entries)
- Parsed conversation structures
- Database model interfaces
- Configuration options

**Type Safety**: Ensures type safety across the entire hook system.

### 5. Transcript Parser

**Location**: `C:\projects\arrakis\src\lib\claude\parser.ts`

Sophisticated JSONL parser that:
- Reads Claude Code transcript files
- Parses individual entries (messages, tool uses, system events)
- Reconstructs conversation timeline
- Matches tool uses with their results
- Extracts metadata and session information
- Handles malformed or incomplete data

**Features**:
- Supports all Claude transcript entry types
- Robust error handling for corrupt data
- Efficient streaming for large files
- Automatic title generation from first user message
- Project name extraction from paths

### 6. Database Integration (tRPC)

**Location**: `C:\projects\arrakis\src\server\api\routers\conversation.ts`

Extended tRPC router with new procedures:
- `createFromHook` - Create conversations from hook events
- `updateFromHook` - Update conversations from session data
- `addToolUse` - Record tool usage with performance metrics
- `importFromTranscript` - Bulk import from transcript files
- `findBySessionId` - Find conversations by Claude session ID
- `getStats` - Get conversation statistics

**Database Schema** (Prisma):
- `Conversation` - Session metadata, timing, project info
- `Message` - User/assistant messages with tool calls
- `ToolUse` - Detailed tool usage tracking with performance
- `ConversationEmbedding` - Vector search support (future)

## Configuration

### Environment Setup

1. **Database**: Ensure PostgreSQL is configured with proper connection string
2. **API Server**: Next.js development server running on port 3000
3. **Node.js**: Version 18+ available for hook scripts

### Hook Configuration

The system is configured via environment variables in `.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_HOOK_API_URL": "http://localhost:3000/api/claude-hooks",
    "CLAUDE_HOOK_DEBUG": "true",
    "CLAUDE_HOOK_ENABLED": "true",
    "CLAUDE_HOOK_TIMEOUT": "10000",
    "CLAUDE_HOOK_RETRY_ATTEMPTS": "2",
    "CLAUDE_HOOK_RETRY_DELAY": "1000"
  }
}
```

### Production Configuration

For production use:
1. Update `CLAUDE_HOOK_API_URL` to production endpoint
2. Set `CLAUDE_HOOK_DEBUG` to "false"
3. Configure proper authentication if needed
4. Set up monitoring and alerting for hook failures

## Testing

### Manual Testing

1. **Start the Next.js server**:
   ```bash
   npm run dev
   ```

2. **Test hook script manually**:
   ```bash
   CLAUDE_HOOK_EVENT=SessionStart CLAUDE_SESSION_ID=test-session CLAUDE_PROJECT_DIR="C:\projects\arrakis" CLAUDE_HOOK_DEBUG=true node .claude/hooks/capture-conversation.js
   ```

3. **Start a Claude Code session** - hooks will automatically fire

4. **Check database** for captured conversations and messages

### Integration Testing

1. **Database Setup**: Ensure Prisma schema is applied
   ```bash
   npm run db:push
   ```

2. **API Testing**: Test webhook endpoint directly
   ```bash
   curl -X POST http://localhost:3000/api/claude-hooks \
     -H "Content-Type: application/json" \
     -d '{"event":"SessionStart","timestamp":"2024-01-01T00:00:00Z","sessionId":"test"}'
   ```

3. **End-to-End**: Complete Claude Code session with conversation

## Data Flow

### Session Lifecycle

1. **SessionStart**:
   - Hook fires → API creates conversation record
   - Stores session ID, project path, user info

2. **UserPromptSubmit**:
   - Hook fires → API adds user message
   - Updates conversation title from first prompt

3. **PreToolUse/PostToolUse**:
   - Hook fires → API records tool usage
   - Captures parameters, results, timing, errors

4. **SessionEnd**:
   - Hook fires → API finalizes conversation
   - Parses full transcript for missing data
   - Updates statistics and metadata

### Data Storage

- **Real-time**: Hook events stored immediately
- **Batch**: Transcript parsing fills gaps and validates data
- **Redundancy**: Multiple data sources ensure completeness

## Monitoring

### Debug Logging

Enable via `CLAUDE_HOOK_DEBUG=true`:
- Hook script execution details
- API request/response logging
- Database operation results
- Error stack traces

### Database Queries

Monitor conversation statistics:
```typescript
// Get system statistics
const stats = await trpc.conversation.getStats.query()

// Find conversations by session
const conversation = await trpc.conversation.findBySessionId.query({
  sessionId: 'session-123'
})
```

### Health Checks

- API endpoint health: `GET /api/claude-hooks` returns method not allowed (expected)
- Database connectivity: tRPC queries should work
- Hook script: Manual execution should connect to API

## Error Handling

### Hook Script Failures

- Never break Claude Code workflow
- Log errors but exit successfully (code 0)
- Retry failed requests with exponential backoff
- Handle network timeouts gracefully

### API Failures

- Return success even on partial failures
- Log detailed error information
- Continue processing other events
- Graceful degradation without database

### Database Issues

- Handle connection failures
- Transaction rollbacks on errors
- Data validation with Zod schemas
- Missing data handling in queries

## Performance Considerations

### Hook Execution

- Lightweight processing (< 100ms per hook)
- Non-blocking for Claude Code operations
- Configurable timeouts and retries
- Minimal memory footprint

### Database Operations

- Indexed queries for session lookups
- Batch operations where possible
- Efficient transcript parsing
- Connection pooling via Prisma

### Scalability

- Stateless hook processing
- Async API operations
- Streaming transcript parsing
- Database connection management

## Future Enhancements

### Vector Search

- Conversation embeddings for semantic search
- Integration with OpenAI embeddings API
- Similarity-based conversation discovery

### Analytics Dashboard

- Conversation metrics and trends
- Tool usage statistics
- Performance monitoring
- User behavior insights

### Advanced Features

- Conversation branching support
- Multi-user session tracking
- Real-time collaboration features
- Export/import functionality

## Troubleshooting

### Common Issues

1. **Hook not executing**: Check Claude Code settings.json syntax
2. **API connection failed**: Verify Next.js server is running
3. **Database errors**: Check PostgreSQL connection and schema
4. **Permission errors**: Ensure Node.js can execute hook scripts

### Debug Steps

1. Enable debug logging: `CLAUDE_HOOK_DEBUG=true`
2. Test hook script manually with mock data
3. Check API endpoint with curl
4. Verify database schema with Prisma Studio
5. Review Claude Code logs for hook execution

### Log Locations

- Hook script logs: Console output during Claude Code sessions
- API logs: Next.js server console
- Database logs: PostgreSQL server logs
- Claude Code logs: Claude Code application logs

## Security Considerations

### Data Privacy

- No sensitive user data in logs
- Configurable data retention policies
- Secure database connections
- Optional data encryption at rest

### Access Control

- API endpoint security (if needed)
- Database access restrictions
- Hook execution permissions
- Audit trail for data access

### Network Security

- HTTPS for production API calls
- Firewall rules for database access
- VPN/tunnel for remote access
- SSL/TLS for all connections

This comprehensive hook integration system provides complete conversation capture and analysis capabilities while maintaining the reliability and performance of Claude Code sessions.