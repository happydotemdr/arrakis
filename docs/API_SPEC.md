# API Specification - Arrakis Conversation Persistence

**Last Updated**: 2025-09-29
**Base URL**: `https://arrakis-prod.onrender.com`
**API Version**: 1.0

---

## Table of Contents

1. [Authentication](#authentication)
2. [Webhook API](#webhook-api)
3. [tRPC API](#trpc-api)
4. [Data Formats](#data-formats)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [Examples](#examples)

---

## Authentication

### Webhook Endpoint Authentication

**Method**: Bearer Token Authentication

**Header**:
```
Authorization: Bearer <API_KEY>
```

**API Key**: Configured via `CLAUDE_HOOK_API_KEY` environment variable

**Production Enforcement**:
- Development (`NODE_ENV=development`): Authentication optional
- Production (`NODE_ENV=production`): Authentication required

**Error Responses**:
- `401 Unauthorized` - Missing or invalid API key
- `403 Forbidden` - Valid key but insufficient permissions

---

## Webhook API

### POST /api/claude-hooks

Receives and processes Claude Code hook events.

**Authentication**: Required (Bearer token)

**Content-Type**: `application/json`

**Request Size Limits**:
- Prompt: 100 KB max
- Parameters: 500 KB max
- Response: 1 MB max
- Duration: 1 hour max (3,600,000 ms)

---

### Event Types

#### 1. SessionStart

Triggered when a new Claude Code session begins.

**Payload**:
```json
{
  "event": "SessionStart",
  "timestamp": "2025-09-29T19:00:00.000Z",
  "sessionId": "session-abc123",
  "projectPath": "c:\\projects\\arrakis",
  "userInfo": {
    "platform": "win32",
    "nodeVersion": "18.0.0"
  },
  "metadata": {
    "customField": "value"
  }
}
```

**Field Descriptions**:
- `event` (required): Must be "SessionStart"
- `timestamp` (required): ISO 8601 datetime string
- `sessionId` (optional): Unique session identifier from Claude Code
- `projectPath` (optional): Absolute path to project directory
- `userInfo` (optional): User environment information
- `metadata` (optional): Additional custom metadata

**Response** (200 OK):
```json
{
  "success": true,
  "message": "SessionStart event processed",
  "conversationId": "clxxx..."
}
```

**Database Actions**:
- Creates new `Conversation` record
- Sets `started_at` to timestamp
- Sets `session_id` to sessionId
- Sets `project_path` to projectPath
- Stores metadata in `metadata` JSON field

---

#### 2. UserPromptSubmit

Triggered when user submits a prompt to Claude Code.

**Payload**:
```json
{
  "event": "UserPromptSubmit",
  "timestamp": "2025-09-29T19:01:00.000Z",
  "sessionId": "session-abc123",
  "prompt": "What is the status of this project?",
  "promptId": "prompt-xyz789",
  "messageIndex": 1,
  "metadata": {
    "context": "dashboard"
  }
}
```

**Field Descriptions**:
- `event` (required): Must be "UserPromptSubmit"
- `timestamp` (required): ISO 8601 datetime when prompt submitted
- `sessionId` (optional): Session identifier to link to conversation
- `prompt` (optional): The actual prompt text (max 100KB)
- `promptId` (optional): Unique identifier for this prompt
- `messageIndex` (optional): Position in conversation sequence
- `metadata` (optional): Additional context

**Response** (200 OK):
```json
{
  "success": true,
  "message": "UserPromptSubmit event processed",
  "conversationId": "clxxx...",
  "messageId": "clyyy..."
}
```

**Database Actions**:
- Finds conversation by `sessionId`
- Creates new `Message` record with `role='user'`
- Sets `content` to prompt text
- Sets `timestamp` to event timestamp
- Updates conversation `title` (if first prompt)
- Updates conversation `updated_at`

---

#### 3. PreToolUse

Triggered before a tool is executed (optional event).

**Payload**:
```json
{
  "event": "PreToolUse",
  "timestamp": "2025-09-29T19:01:05.000Z",
  "sessionId": "session-abc123",
  "toolName": "Read",
  "toolId": "tool-123",
  "parameters": {
    "file_path": "c:\\projects\\arrakis\\README.md",
    "limit": 100
  },
  "messageIndex": 2
}
```

**Field Descriptions**:
- `event` (required): Must be "PreToolUse"
- `timestamp` (required): When tool execution started
- `sessionId` (optional): Session identifier
- `toolName` (optional): Name of tool being executed
- `toolId` (optional): Unique identifier for this tool execution
- `parameters` (optional): Tool parameters as JSON object
- `messageIndex` (optional): Position in conversation

**Response** (200 OK):
```json
{
  "success": true,
  "message": "PreToolUse event processed"
}
```

**Database Actions**:
- Logs the event (may be used for analytics)
- Does NOT create database records (waits for PostToolUse)

---

#### 4. PostToolUse

Triggered after a tool has been executed with results.

**Payload**:
```json
{
  "event": "PostToolUse",
  "timestamp": "2025-09-29T19:01:05.150Z",
  "sessionId": "session-abc123",
  "toolName": "Read",
  "toolId": "tool-123",
  "parameters": {
    "file_path": "c:\\projects\\arrakis\\README.md",
    "limit": 100
  },
  "response": {
    "content": "# Arrakis - Conversation Persistence System\n...",
    "lines": 182,
    "success": true
  },
  "duration": 150,
  "status": "success",
  "messageIndex": 2
}
```

**Field Descriptions**:
- `event` (required): Must be "PostToolUse"
- `timestamp` (required): When tool execution completed
- `sessionId` (optional): Session identifier
- `toolName` (optional): Name of tool executed
- `toolId` (optional): Unique identifier for this execution
- `parameters` (optional): Tool parameters (max 500KB)
- `response` (optional): Tool result/output (max 1MB)
- `duration` (optional): Execution time in milliseconds
- `status` (optional): "success", "error", or "timeout"
- `messageIndex` (optional): Position in conversation

**Response** (200 OK):
```json
{
  "success": true,
  "message": "PostToolUse event processed",
  "toolUseId": "clzzz..."
}
```

**Database Actions**:
- Finds conversation by `sessionId`
- Finds or creates corresponding `Message` record
- Creates `ToolUse` record linked to message
- Stores parameters, response, duration, and status
- Updates message `tool_calls` JSON array

---

#### 5. Stop

Triggered when user stops/interrupts Claude's response.

**Payload**:
```json
{
  "event": "Stop",
  "timestamp": "2025-09-29T19:02:00.000Z",
  "sessionId": "session-abc123",
  "reason": "user_interrupted",
  "messageIndex": 3
}
```

**Field Descriptions**:
- `event` (required): Must be "Stop"
- `timestamp` (required): When stop occurred
- `sessionId` (optional): Session identifier
- `reason` (optional): Why conversation was stopped (max 500 chars)
- `messageIndex` (optional): Position where stopped

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Stop event processed"
}
```

**Database Actions**:
- Logs the event
- Updates conversation metadata with stop reason
- Does NOT set `ended_at` (session may continue)

---

#### 6. SessionEnd

Triggered when Claude Code session ends.

**Payload**:
```json
{
  "event": "SessionEnd",
  "timestamp": "2025-09-29T19:05:00.000Z",
  "sessionId": "session-abc123",
  "transcriptPath": "c:\\Users\\user\\.claude\\transcript-abc123.jsonl",
  "messageCount": 5,
  "toolUseCount": 3,
  "metadata": {
    "duration_seconds": 300,
    "exit_code": 0
  }
}
```

**Field Descriptions**:
- `event` (required): Must be "SessionEnd"
- `timestamp` (required): When session ended
- `sessionId` (optional): Session identifier
- `transcriptPath` (optional): Path to full transcript file
- `messageCount` (optional): Total messages in session
- `toolUseCount` (optional): Total tool uses in session
- `metadata` (optional): Additional session metadata

**Response** (200 OK):
```json
{
  "success": true,
  "message": "SessionEnd event processed",
  "conversationId": "clxxx...",
  "transcriptParsed": true
}
```

**Database Actions**:
- Finds conversation by `sessionId`
- Sets `ended_at` to timestamp
- Updates conversation metadata with counts
- **Parses transcript file** (if path provided):
  - Reads JSONL transcript
  - Extracts any missing messages
  - Fills in gaps from real-time capture
  - Generates title from first user prompt
  - Updates message sequence
- Marks conversation as complete

---

### Error Responses

All webhook errors return JSON with this format:

**400 Bad Request** - Invalid payload:
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "timestamp",
      "message": "Required field missing"
    }
  ]
}
```

**401 Unauthorized** - Authentication failed:
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid or missing API key"
}
```

**405 Method Not Allowed** - Wrong HTTP method:
```json
{
  "error": "Method GET not allowed",
  "allowed": ["POST"]
}
```

**413 Payload Too Large**:
```json
{
  "success": false,
  "error": "Payload too large",
  "message": "Prompt exceeds 100KB limit"
}
```

**500 Internal Server Error** - Server error:
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Database connection failed"
}
```

---

## tRPC API

### Base URL

```
/api/trpc/[procedure_name]
```

All tRPC endpoints are type-safe and return JSON formatted responses.

---

### conversation.getAll

Get list of all conversations.

**Type**: Query
**Authentication**: None (public)

**Input**: None

**Response**:
```json
{
  "result": {
    "data": [
      {
        "id": "clxxx...",
        "sessionId": "session-abc123",
        "projectPath": "c:\\projects\\arrakis",
        "title": "Project status inquiry",
        "description": null,
        "startedAt": "2025-09-29T19:00:00.000Z",
        "endedAt": "2025-09-29T19:05:00.000Z",
        "metadata": {},
        "createdAt": "2025-09-29T19:00:00.000Z",
        "updatedAt": "2025-09-29T19:05:00.000Z",
        "messages": [
          {
            "id": "clyyy...",
            "role": "user",
            "content": "What is the status...",
            "timestamp": "2025-09-29T19:01:00.000Z"
          }
        ],
        "_count": {
          "messages": 5
        }
      }
    ]
  }
}
```

**Features**:
- Sorted by `updatedAt` DESC (most recent first)
- Includes first message preview
- Includes message count
- No pagination (add if needed)

**Usage** (TypeScript):
```typescript
const { data } = trpc.conversation.getAll.useQuery()
```

---

### conversation.getById

Get a single conversation with all messages.

**Type**: Query
**Authentication**: None (public)

**Input**:
```json
{
  "id": "clxxx..."
}
```

**Response**:
```json
{
  "result": {
    "data": {
      "id": "clxxx...",
      "sessionId": "session-abc123",
      "title": "Project status inquiry",
      "startedAt": "2025-09-29T19:00:00.000Z",
      "endedAt": "2025-09-29T19:05:00.000Z",
      "messages": [
        {
          "id": "clyyy...",
          "conversationId": "clxxx...",
          "role": "user",
          "content": "What is the status of this project?",
          "toolCalls": null,
          "timestamp": "2025-09-29T19:01:00.000Z",
          "metadata": {},
          "createdAt": "2025-09-29T19:01:00.000Z",
          "updatedAt": "2025-09-29T19:01:00.000Z"
        },
        {
          "id": "clzzz...",
          "conversationId": "clxxx...",
          "role": "assistant",
          "content": "I'll check the README...",
          "toolCalls": [
            {
              "toolName": "Read",
              "parameters": {"file": "README.md"}
            }
          ],
          "timestamp": "2025-09-29T19:01:05.000Z"
        }
      ]
    }
  }
}
```

**Features**:
- Returns full conversation data
- Includes all messages ordered by timestamp
- Includes tool calls in messages
- Returns `null` if not found

**Usage** (TypeScript):
```typescript
const { data } = trpc.conversation.getById.useQuery({ id: 'clxxx...' })
```

---

## Data Formats

### Timestamps

All timestamps use **ISO 8601 format** with UTC timezone:
```
2025-09-29T19:00:00.000Z
```

**JavaScript**:
```javascript
new Date().toISOString()
```

**Format**: `YYYY-MM-DDTHH:mm:ss.sssZ`

---

### IDs

All IDs use **CUID format** (Collision-resistant Unique Identifier):
```
clxxx123456789abc
```

**Characteristics**:
- 25 characters long
- URL-safe
- Sortable by creation time
- Globally unique

**Generated by**: Prisma `@default(cuid())`

---

### JSON Metadata

**Format**: Valid JSON object (not array or primitive)

**Example**:
```json
{
  "platform": "win32",
  "nodeVersion": "18.0.0",
  "customField": "value"
}
```

**Restrictions**:
- Must be valid JSON
- No circular references
- Stored as JSONB in PostgreSQL
- Queryable with JSON operators

---

### File Paths

**Windows**: Use double backslashes in JSON:
```json
{
  "projectPath": "c:\\projects\\arrakis"
}
```

**Unix**: Regular forward slashes:
```json
{
  "projectPath": "/home/user/projects/arrakis"
}
```

---

## Error Handling

### HTTP Status Codes

- `200 OK` - Request successful
- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `405 Method Not Allowed` - Wrong HTTP method
- `413 Payload Too Large` - Request body too large
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Server temporarily down

---

### Error Response Format

**Standard error response**:
```json
{
  "success": false,
  "error": "Error category",
  "message": "Human-readable error description",
  "details": [
    {
      "field": "fieldName",
      "message": "Specific field error"
    }
  ]
}
```

**Field descriptions**:
- `success`: Always `false` for errors
- `error`: Error category (e.g., "Validation failed")
- `message`: Human-readable description
- `details`: Array of specific field errors (for validation)

---

### Validation Errors

**Zod validation errors** include field-level details:

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "timestamp",
      "message": "Invalid datetime"
    },
    {
      "field": "prompt",
      "message": "Prompt exceeds 100KB limit"
    }
  ]
}
```

---

## Rate Limiting

**Current Status**: NOT IMPLEMENTED

**Planned Limits** (future):
- 100 requests per minute per IP
- 1000 requests per hour per API key
- Burst allowance: 20 requests

**Headers** (when implemented):
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1696012800
```

**Rate Limit Response** (429):
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

---

## Examples

### Complete Session Lifecycle

**1. Start Session**:
```bash
curl -X POST https://arrakis-prod.onrender.com/api/claude-hooks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "SessionStart",
    "timestamp": "2025-09-29T19:00:00.000Z",
    "sessionId": "demo-session-001",
    "projectPath": "c:\\projects\\demo",
    "userInfo": {
      "platform": "win32"
    }
  }'
```

**2. Submit User Prompt**:
```bash
curl -X POST https://arrakis-prod.onrender.com/api/claude-hooks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "UserPromptSubmit",
    "timestamp": "2025-09-29T19:01:00.000Z",
    "sessionId": "demo-session-001",
    "prompt": "List all files in the project",
    "messageIndex": 1
  }'
```

**3. Tool Execution**:
```bash
curl -X POST https://arrakis-prod.onrender.com/api/claude-hooks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "PostToolUse",
    "timestamp": "2025-09-29T19:01:02.123Z",
    "sessionId": "demo-session-001",
    "toolName": "Bash",
    "parameters": {
      "command": "ls -la"
    },
    "response": {
      "output": "total 48\ndrwxr-xr-x...",
      "exitCode": 0
    },
    "duration": 123,
    "status": "success",
    "messageIndex": 2
  }'
```

**4. End Session**:
```bash
curl -X POST https://arrakis-prod.onrender.com/api/claude-hooks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "SessionEnd",
    "timestamp": "2025-09-29T19:05:00.000Z",
    "sessionId": "demo-session-001",
    "messageCount": 4,
    "toolUseCount": 2
  }'
```

**5. Retrieve via tRPC**:
```bash
curl https://arrakis-prod.onrender.com/api/trpc/conversation.getAll
```

---

### Error Examples

**Missing Required Field**:
```bash
# Request
curl -X POST https://arrakis-prod.onrender.com/api/claude-hooks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event": "SessionStart"}'

# Response (400)
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "timestamp",
      "message": "Required"
    }
  ]
}
```

**Invalid Timestamp Format**:
```bash
# Request
curl -X POST https://arrakis-prod.onrender.com/api/claude-hooks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "SessionStart",
    "timestamp": "2025-09-29 19:00:00"
  }'

# Response (400)
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "timestamp",
      "message": "Invalid datetime"
    }
  ]
}
```

**Wrong API Key**:
```bash
# Request
curl -X POST https://arrakis-prod.onrender.com/api/claude-hooks \
  -H "Authorization: Bearer wrong-key" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "SessionStart",
    "timestamp": "2025-09-29T19:00:00.000Z"
  }'

# Response (401)
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid or missing API key"
}
```

---

## TypeScript Usage

### Webhook Client

```typescript
interface WebhookClient {
  apiKey: string
  baseUrl: string
}

class ClaudeHookClient {
  constructor(private config: WebhookClient) {}

  async sendEvent(event: ClaudeHookPayload): Promise<WebhookResponse> {
    const response = await fetch(`${this.config.baseUrl}/api/claude-hooks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Webhook failed: ${error.message}`)
    }

    return response.json()
  }

  async startSession(sessionId: string, projectPath: string) {
    return this.sendEvent({
      event: 'SessionStart',
      timestamp: new Date().toISOString(),
      sessionId,
      projectPath,
    })
  }

  // ... other methods
}

// Usage
const client = new ClaudeHookClient({
  apiKey: process.env.CLAUDE_HOOK_API_KEY!,
  baseUrl: 'https://arrakis-prod.onrender.com',
})

await client.startSession('session-123', 'c:\\projects\\demo')
```

---

### tRPC Client

```typescript
import { trpc } from '@/lib/trpc/client'

// Get all conversations
const ConversationList = () => {
  const { data, isLoading, error } = trpc.conversation.getAll.useQuery()

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <ul>
      {data?.map(conv => (
        <li key={conv.id}>
          {conv.title || 'Untitled'} - {conv._count.messages} messages
        </li>
      ))}
    </ul>
  )
}

// Get single conversation
const ConversationDetail = ({ id }: { id: string }) => {
  const { data } = trpc.conversation.getById.useQuery({ id })

  return (
    <div>
      <h1>{data?.title}</h1>
      {data?.messages.map(msg => (
        <div key={msg.id}>
          <strong>{msg.role}:</strong> {msg.content}
        </div>
      ))}
    </div>
  )
}
```

---

## Security Considerations

### API Key Management

**DO**:
- Store API key in environment variables
- Rotate API key quarterly
- Use different keys for dev/staging/prod
- Monitor API key usage

**DON'T**:
- Commit API keys to git
- Share API keys in logs
- Use same key across environments
- Expose API keys in client-side code

---

### Input Validation

All inputs are validated with Zod schemas:

**Size Limits**:
- Strings: Maximum lengths enforced
- JSON: Maximum serialized size checked
- Numbers: Range validation
- Timestamps: Valid datetime format required

**Sanitization**:
- No HTML escaping needed (JSON only)
- SQL injection prevented by Prisma
- Path traversal blocked by validation

---

### Rate Limiting (Planned)

**Protection against**:
- DDoS attacks
- Abuse of free tier
- Runaway scripts
- Resource exhaustion

**Implementation** (future):
- Per-IP rate limiting
- Per-API-key rate limiting
- Exponential backoff on failures
- Circuit breaker pattern

---

## Performance

### Response Times

**Target SLAs**:
- Webhook endpoint: < 200ms (p95)
- tRPC queries: < 100ms (p95)
- Database queries: < 50ms (p95)

**Current Performance**:
- Webhook: ~150ms average
- tRPC getAll: ~80ms average
- tRPC getById: ~60ms average

---

### Optimization Tips

**For webhook clients**:
- Batch events when possible
- Use async/non-blocking sends
- Implement retry logic with exponential backoff
- Don't wait for response (fire-and-forget)

**For tRPC consumers**:
- Use React Query caching
- Implement pagination for large lists
- Use infinite queries for scrolling
- Prefetch data when possible

---

## Versioning

**Current Version**: 1.0

**Versioning Strategy**:
- Major version (1.x → 2.x): Breaking changes
- Minor version (1.0 → 1.1): New features (backward compatible)
- Patch version (1.0.0 → 1.0.1): Bug fixes

**Breaking Changes**:
- Will be announced 30 days in advance
- Old version supported for 90 days after deprecation
- Migration guide provided

**Non-Breaking Changes**:
- New optional fields: Can be added anytime
- New endpoints: Can be added anytime
- Bug fixes: Deployed immediately

---

## Support

**Documentation**:
- This spec: `docs/API_SPEC.md`
- Database schema: `docs/DATA_MODEL.md`
- Implementation guide: `docs/IMPLEMENTATION_PLAN.md`

**Issues**:
- GitHub: https://github.com/happydotemdr/arrakis/issues
- Email: (configure if needed)

**Response Times**:
- Critical bugs: 24 hours
- Feature requests: 1 week
- Questions: 48 hours

---

Last Updated: 2025-09-29