/**
 * Claude Code hooks API endpoint
 * Receives and processes hook events from Claude Code
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  parseTranscriptFile,
  generateConversationTitle,
  extractProjectName,
} from '@/lib/claude/parser'
import type {
  AnyClaudeHookPayload,
  SessionStartPayload,
  UserPromptSubmitPayload,
  PostToolUsePayload,
  SessionEndPayload,
} from '@/lib/claude/types'

// Validation schema for hook payloads with size limits
const hookPayloadSchema = z.object({
  event: z.enum([
    'SessionStart',
    'UserPromptSubmit',
    'PreToolUse',
    'PostToolUse',
    'Stop',
    'SessionEnd',
  ]),
  timestamp: z.string().datetime(),
  sessionId: z.string().max(200).optional(),
  projectPath: z.string().max(1000).optional(),
  transcriptPath: z.string().max(2000).optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  // Event-specific fields with size limits
  prompt: z.string().max(100000).optional(), // 100KB max
  promptId: z.string().max(200).optional(),
  toolName: z.string().max(100).optional(),
  parameters: z.record(z.unknown()).optional().refine(
    (val) => !val || JSON.stringify(val).length < 500000,
    { message: "Parameters too large (max 500KB)" }
  ),
  response: z.unknown().optional().refine(
    (val) => !val || JSON.stringify(val).length < 1000000,
    { message: "Response too large (max 1MB)" }
  ),
  duration: z.number().min(0).max(3600000).optional(), // Max 1 hour
  status: z.enum(['success', 'error', 'timeout']).optional(),
  error: z.string().max(10000).optional(),
  toolId: z.string().max(200).optional(),
  messageIndex: z.number().min(0).max(100000).optional(),
  reason: z.string().max(500).optional(),
  messageCount: z.number().min(0).max(100000).optional(),
  toolUseCount: z.number().min(0).max(100000).optional(),
  userInfo: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
})

// API Key authentication
const CLAUDE_HOOK_API_KEY = process.env.CLAUDE_HOOK_API_KEY

export async function POST(request: NextRequest) {
  try {
    // Verify API key for production
    if (process.env.NODE_ENV === 'production') {
      const authHeader = request.headers.get('authorization')
      const providedKey = authHeader?.replace('Bearer ', '')

      if (!CLAUDE_HOOK_API_KEY) {
        console.error('[Claude Hook] CLAUDE_HOOK_API_KEY not configured')
        return NextResponse.json(
          { success: false, error: 'Server misconfigured' },
          { status: 500 }
        )
      }

      if (providedKey !== CLAUDE_HOOK_API_KEY) {
        console.warn('[Claude Hook] Unauthorized request attempt')
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    // Parse and validate the request body
    const body = await request.json()
    const payload = hookPayloadSchema.parse(body) as AnyClaudeHookPayload

    console.log(`[Claude Hook] ${payload.event}:`, {
      sessionId: payload.sessionId,
      timestamp: payload.timestamp,
      projectPath: payload.projectPath,
    })

    // Process the hook event
    const result = await processHookEvent(payload)

    return NextResponse.json({
      success: true,
      message: `Processed ${payload.event} event`,
      data: result,
    })
  } catch (error) {
    console.error('[Claude Hook] Error processing hook:', error)

    // Return error response but don't break Claude Code's workflow
    // In production, don't leak error details
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : error instanceof Error
        ? error.message
        : 'Unknown error processing hook'

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    )
  }
}

/**
 * Process different types of hook events
 */
async function processHookEvent(payload: AnyClaudeHookPayload): Promise<any> {
  switch (payload.event) {
    case 'SessionStart':
      return await handleSessionStart(payload as SessionStartPayload)

    case 'UserPromptSubmit':
      return await handleUserPromptSubmit(payload as UserPromptSubmitPayload)

    case 'PostToolUse':
      return await handlePostToolUse(payload as PostToolUsePayload)

    case 'SessionEnd':
      return await handleSessionEnd(payload as SessionEndPayload)

    case 'PreToolUse':
    case 'Stop':
      // These events are logged but don't require special processing
      console.log(`[Claude Hook] ${payload.event} event received`)
      return { logged: true }

    default:
      console.warn('[Claude Hook] Unknown event type:', (payload as any).event)
      return { ignored: true }
  }
}

/**
 * Handle session start - create conversation record
 */
async function handleSessionStart(payload: SessionStartPayload) {
  if (!payload.sessionId) {
    throw new Error('SessionStart event missing sessionId')
  }

  try {
    // Check if conversation already exists
    const existingConversation = await db.conversation.findFirst({
      where: { sessionId: payload.sessionId },
    })

    if (existingConversation) {
      console.log(
        `[Claude Hook] Conversation already exists for session: ${payload.sessionId}`
      )
      return { conversationId: existingConversation.id, created: false }
    }

    // Create new conversation
    const conversation = await db.conversation.create({
      data: {
        sessionId: payload.sessionId,
        projectPath: payload.projectPath,
        title: `Session ${payload.sessionId.slice(-8)}`, // Temporary title
        startedAt: new Date(payload.timestamp),
        metadata: {
          userInfo: payload.userInfo,
          transcriptPath: payload.transcriptPath,
          ...payload.metadata,
        },
      },
    })

    console.log(
      `[Claude Hook] Created conversation: ${conversation.id} for session: ${payload.sessionId}`
    )

    return { conversationId: conversation.id, created: true }
  } catch (error) {
    console.error('[Claude Hook] Error creating conversation:', error)
    throw error
  }
}

/**
 * Handle user prompt submit - add user message
 */
async function handleUserPromptSubmit(payload: UserPromptSubmitPayload) {
  if (!payload.sessionId || !payload.prompt) {
    console.warn('[Claude Hook] UserPromptSubmit missing required fields')
    return { skipped: true }
  }

  try {
    // Find conversation
    const conversation = await db.conversation.findFirst({
      where: { sessionId: payload.sessionId },
    })

    if (!conversation) {
      console.warn(
        `[Claude Hook] Conversation not found for session: ${payload.sessionId}`
      )
      return { error: 'Conversation not found' }
    }

    // Add user message
    const message = await db.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: payload.prompt,
        timestamp: new Date(payload.timestamp),
        metadata: {
          promptId: payload.promptId,
          messageIndex: payload.messageIndex,
          ...payload.metadata,
        },
      },
    })

    // Update conversation title if this is the first user message
    if (!conversation.title || conversation.title.startsWith('Session ')) {
      const title = generateConversationTitle([
        {
          role: 'user',
          content: payload.prompt,
          timestamp: new Date(payload.timestamp),
        },
      ])

      await db.conversation.update({
        where: { id: conversation.id },
        data: { title },
      })
    }

    return { messageId: message.id }
  } catch (error) {
    console.error('[Claude Hook] Error adding user message:', error)
    throw error
  }
}

/**
 * Handle post tool use - record tool usage
 */
async function handlePostToolUse(payload: PostToolUsePayload) {
  if (!payload.sessionId || !payload.toolName) {
    console.warn('[Claude Hook] PostToolUse missing required fields')
    return { skipped: true }
  }

  try {
    // Find conversation
    const conversation = await db.conversation.findFirst({
      where: { sessionId: payload.sessionId },
    })

    if (!conversation) {
      console.warn(
        `[Claude Hook] Conversation not found for session: ${payload.sessionId}`
      )
      return { error: 'Conversation not found' }
    }

    // Find the most recent assistant message to attach tool use to
    const recentMessage = await db.message.findFirst({
      where: {
        conversationId: conversation.id,
        role: 'assistant',
      },
      orderBy: { timestamp: 'desc' },
    })

    if (!recentMessage) {
      console.warn(
        '[Claude Hook] No recent assistant message found for tool use'
      )
      return { error: 'No message to attach tool use to' }
    }

    // Create tool use record
    const toolUse = await db.toolUse.create({
      data: {
        messageId: recentMessage.id,
        toolName: payload.toolName,
        parameters: payload.parameters || {},
        response: payload.response,
        duration: payload.duration,
        status: payload.status || 'success',
        timestamp: new Date(payload.timestamp),
        metadata: {
          toolId: payload.toolId,
          messageIndex: payload.messageIndex,
          error: payload.error,
          ...payload.metadata,
        },
      },
    })

    return { toolUseId: toolUse.id }
  } catch (error) {
    console.error('[Claude Hook] Error recording tool use:', error)
    throw error
  }
}

/**
 * Handle session end - parse full transcript and update conversation
 */
async function handleSessionEnd(payload: SessionEndPayload) {
  if (!payload.sessionId) {
    console.warn('[Claude Hook] SessionEnd missing sessionId')
    return { skipped: true }
  }

  try {
    // Find conversation
    const conversation = await db.conversation.findFirst({
      where: { sessionId: payload.sessionId },
    })

    if (!conversation) {
      console.warn(
        `[Claude Hook] Conversation not found for session: ${payload.sessionId}`
      )
      return { error: 'Conversation not found' }
    }

    // Parse transcript if available
    let transcriptData = null
    if (payload.transcriptPath) {
      try {
        transcriptData = await parseTranscriptFile(payload.transcriptPath)
        console.log(
          `[Claude Hook] Parsed transcript with ${transcriptData?.messages.length || 0} messages`
        )
      } catch (error) {
        console.warn('[Claude Hook] Error parsing transcript:', error)
      }
    }

    // Update conversation with end time and metadata
    const updatedConversation = await db.conversation.update({
      where: { id: conversation.id },
      data: {
        endedAt: new Date(payload.timestamp),
        metadata: {
          ...(conversation.metadata as Record<string, any> || {}),
          duration: payload.duration,
          messageCount: payload.messageCount,
          toolUseCount: payload.toolUseCount,
          transcriptParsed: !!transcriptData,
          projectName: extractProjectName(conversation.projectPath || undefined),
          ...(payload.metadata as Record<string, any> || {}),
        },
      },
    })

    // If transcript was parsed and contains more data, sync it
    if (transcriptData && transcriptData.messages.length > 0) {
      await syncTranscriptData(conversation.id, transcriptData)
    }

    return {
      conversationId: conversation.id,
      transcriptParsed: !!transcriptData,
      messageCount: transcriptData?.messages.length || 0,
      toolUseCount: transcriptData?.toolUses.length || 0,
    }
  } catch (error) {
    console.error('[Claude Hook] Error handling session end:', error)
    throw error
  }
}

/**
 * Sync parsed transcript data with database
 * This ensures we have complete conversation data even if some hooks were missed
 */
async function syncTranscriptData(
  conversationId: string,
  transcriptData: any
) {
  try {
    console.log(
      `[Claude Hook] Syncing transcript data for conversation: ${conversationId}`
    )

    // Get existing messages to avoid duplicates
    const existingMessages = await db.message.findMany({
      where: { conversationId },
      select: { content: true, role: true, timestamp: true },
    })

    const existingMessageSignatures = new Set(
      existingMessages.map(
        (m) => `${m.role}-${m.content.slice(0, 100)}-${m.timestamp.getTime()}`
      )
    )

    // Add missing messages from transcript
    let newMessagesCount = 0
    for (const message of transcriptData.messages) {
      const signature = `${message.role}-${message.content.slice(0, 100)}-${message.timestamp.getTime()}`

      if (!existingMessageSignatures.has(signature)) {
        await db.message.create({
          data: {
            conversationId,
            role: message.role,
            content: message.content,
            timestamp: message.timestamp,
            toolCalls: message.toolCalls,
            metadata: message.metadata,
          },
        })
        newMessagesCount++
      }
    }

    // Add missing tool uses from transcript
    let newToolUsesCount = 0
    for (const toolUse of transcriptData.toolUses) {
      // Find corresponding message
      const message = await db.message.findFirst({
        where: {
          conversationId,
          role: 'assistant',
          timestamp: {
            gte: new Date(toolUse.timestamp.getTime() - 60000), // 1 minute tolerance
            lte: new Date(toolUse.timestamp.getTime() + 60000),
          },
        },
        orderBy: { timestamp: 'asc' },
      })

      if (message) {
        // Check if tool use already exists
        const existingToolUse = await db.toolUse.findFirst({
          where: {
            messageId: message.id,
            toolName: toolUse.toolName,
            timestamp: toolUse.timestamp,
          },
        })

        if (!existingToolUse) {
          await db.toolUse.create({
            data: {
              messageId: message.id,
              toolName: toolUse.toolName,
              parameters: toolUse.parameters,
              response: toolUse.response,
              duration: toolUse.duration,
              status: toolUse.status,
              timestamp: toolUse.timestamp,
              metadata: toolUse.metadata,
            },
          })
          newToolUsesCount++
        }
      }
    }

    console.log(
      `[Claude Hook] Synced ${newMessagesCount} new messages and ${newToolUsesCount} new tool uses`
    )

    return { newMessagesCount, newToolUsesCount }
  } catch (error) {
    console.error('[Claude Hook] Error syncing transcript data:', error)
    throw error
  }
}

// OPTIONS handler for CORS - restricted to localhost only in production
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || ''
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? ['http://localhost:3000', 'http://127.0.0.1:3000']
    : ['*']

  const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin)

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': isAllowed ? (origin || '*') : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}