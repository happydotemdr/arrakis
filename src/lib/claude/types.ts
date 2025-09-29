/**
 * TypeScript types for Claude Code hook integration and transcript parsing
 */

// Hook event types that Claude Code can trigger
export type ClaudeHookEvent =
  | 'SessionStart'
  | 'UserPromptSubmit'
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Stop'
  | 'SessionEnd'

// Base hook payload structure
export interface ClaudeHookPayload {
  event: ClaudeHookEvent
  timestamp: string
  sessionId?: string
  projectPath?: string
  transcriptPath?: string
  metadata?: Record<string, any>
}

// Session start event payload
export interface SessionStartPayload extends ClaudeHookPayload {
  event: 'SessionStart'
  sessionId: string
  projectPath: string
  transcriptPath: string
  userInfo?: {
    id?: string
    email?: string
    name?: string
  }
}

// User prompt submit event payload
export interface UserPromptSubmitPayload extends ClaudeHookPayload {
  event: 'UserPromptSubmit'
  sessionId: string
  prompt: string
  promptId?: string
  messageIndex?: number
}

// Tool use event payloads
export interface PreToolUsePayload extends ClaudeHookPayload {
  event: 'PreToolUse'
  sessionId: string
  toolName: string
  parameters: Record<string, any>
  toolId?: string
  messageIndex?: number
}

export interface PostToolUsePayload extends ClaudeHookPayload {
  event: 'PostToolUse'
  sessionId: string
  toolName: string
  parameters: Record<string, any>
  response?: any
  duration?: number
  status: 'success' | 'error' | 'timeout'
  error?: string
  toolId?: string
  messageIndex?: number
}

// Session end events
export interface StopPayload extends ClaudeHookPayload {
  event: 'Stop'
  sessionId: string
  reason?: 'user_stop' | 'max_tokens' | 'error'
}

export interface SessionEndPayload extends ClaudeHookPayload {
  event: 'SessionEnd'
  sessionId: string
  duration?: number
  messageCount?: number
  toolUseCount?: number
  transcriptPath: string
}

// Union type for all hook payloads
export type AnyClaudeHookPayload =
  | SessionStartPayload
  | UserPromptSubmitPayload
  | PreToolUsePayload
  | PostToolUsePayload
  | StopPayload
  | SessionEndPayload

// Transcript file structure (JSONL format)
export interface TranscriptEntry {
  type: 'message' | 'tool_use' | 'tool_result' | 'system' | 'error'
  timestamp: string
  data: any
}

// Message entry in transcript
export interface TranscriptMessage extends TranscriptEntry {
  type: 'message'
  data: {
    role: 'user' | 'assistant' | 'system'
    content: string | Array<{
      type: 'text' | 'image' | 'tool_use' | 'tool_result'
      text?: string
      source?: any
      tool_use_id?: string
      name?: string
      input?: any
      content?: any
    }>
    messageIndex?: number
    id?: string
  }
}

// Tool use entry in transcript
export interface TranscriptToolUse extends TranscriptEntry {
  type: 'tool_use'
  data: {
    id: string
    name: string
    input: Record<string, any>
    messageIndex?: number
  }
}

// Tool result entry in transcript
export interface TranscriptToolResult extends TranscriptEntry {
  type: 'tool_result'
  data: {
    tool_use_id: string
    content: any
    is_error?: boolean
    duration?: number
    messageIndex?: number
  }
}

// System entry (metadata, session info, etc.)
export interface TranscriptSystem extends TranscriptEntry {
  type: 'system'
  data: {
    event: string
    sessionId?: string
    projectPath?: string
    [key: string]: any
  }
}

// Error entry
export interface TranscriptError extends TranscriptEntry {
  type: 'error'
  data: {
    message: string
    stack?: string
    code?: string
    [key: string]: any
  }
}

// Union type for all transcript entries
export type AnyTranscriptEntry =
  | TranscriptMessage
  | TranscriptToolUse
  | TranscriptToolResult
  | TranscriptSystem
  | TranscriptError

// Parsed conversation structure
export interface ParsedConversation {
  sessionId?: string
  projectPath?: string
  startedAt: Date
  endedAt?: Date
  messages: ParsedMessage[]
  toolUses: ParsedToolUse[]
  metadata: Record<string, any>
}

// Parsed message structure
export interface ParsedMessage {
  role: 'user' | 'assistant' | 'system' | 'function' | 'tool'
  content: string
  timestamp: Date
  messageIndex?: number
  toolCalls?: any[]
  metadata?: Record<string, any>
}

// Parsed tool use structure
export interface ParsedToolUse {
  toolName: string
  parameters: Record<string, any>
  response?: any
  duration?: number
  status: 'success' | 'error' | 'timeout'
  timestamp: Date
  messageIndex?: number
  error?: string
  metadata?: Record<string, any>
}

// Hook configuration interface
export interface HookConfig {
  url: string
  timeout?: number
  retryAttempts?: number
  retryDelay?: number
  headers?: Record<string, string>
}

// API response interfaces
export interface HookResponse {
  success: boolean
  message?: string
  data?: any
  error?: string
}

export interface ConversationCreateRequest {
  sessionId?: string
  projectPath?: string
  title?: string
  description?: string
  transcript?: ParsedConversation
}

export interface MessageCreateRequest {
  conversationId: string
  role: 'user' | 'assistant' | 'system' | 'function' | 'tool'
  content: string
  toolCalls?: any[]
  timestamp?: Date
  metadata?: Record<string, any>
}

export interface ToolUseCreateRequest {
  messageId: string
  toolName: string
  parameters: Record<string, any>
  response?: any
  duration?: number
  status: 'success' | 'error' | 'timeout'
  timestamp?: Date
  error?: string
  metadata?: Record<string, any>
}

// Environment configuration
export interface ClaudeHookConfig {
  apiUrl: string
  apiKey?: string
  enabled: boolean
  debug: boolean
  events: {
    sessionStart: boolean
    userPromptSubmit: boolean
    preToolUse: boolean
    postToolUse: boolean
    stop: boolean
    sessionEnd: boolean
  }
  transcript: {
    parseOnSessionEnd: boolean
    storeRaw: boolean
    cleanup: boolean
  }
}