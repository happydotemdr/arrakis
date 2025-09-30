/**
 * Claude Code hooks API endpoint
 * Receives and processes hook events from Claude Code
 *
 * Features:
 * - Complete request/response logging via WebhookEvent model
 * - Idempotency support (prevents duplicate processing)
 * - Request tracing and performance metrics
 * - Comprehensive error tracking and audit trail
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { WebhookStatus } from '@prisma/client'
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
  _trace: z.object({
    requestId: z.string().optional(),
    spanId: z.string().optional(),
    traceId: z.string().optional(),
  }).optional(),
})

// API Key authentication
const CLAUDE_HOOK_API_KEY = process.env.CLAUDE_HOOK_API_KEY

/**
 * Request metadata for webhook event tracking
 */
interface RequestMetadata {
  requestId: string
  ipAddress: string | null
  userAgent: string | null
  headers: Record<string, string>
}

/**
 * Result of processing a webhook event
 */
interface ProcessingResult {
  conversationId?: string
  messageId?: string
  toolUseId?: string
  created?: boolean
  skipped?: boolean
  error?: string
}

/**
 * Extract request metadata for logging
 */
function extractRequestMetadata(request: NextRequest): RequestMetadata {
  // Try to get request ID from various sources (client-provided, trace header, or generate)
  const requestId =
    request.headers.get('x-request-id') ||
    request.headers.get('x-trace-id') ||
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Get client IP address (considering proxies)
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') || // Cloudflare
    null

  const userAgent = request.headers.get('user-agent')

  // Capture relevant headers (redact sensitive data)
  const headers: Record<string, string> = {
    'content-type': request.headers.get('content-type') || '',
    'user-agent': userAgent || '',
    'x-request-id': requestId,
  }

  // Log authorization header existence but not the actual key
  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    headers['authorization'] = authHeader.startsWith('Bearer ')
      ? 'Bearer [REDACTED]'
      : '[REDACTED]'
  }

  return { requestId, ipAddress, userAgent, headers }
}

/**
 * Create initial webhook event record
 */
async function createWebhookEvent(
  metadata: RequestMetadata,
  body: unknown,
  eventType?: string,
  sessionId?: string
): Promise<{ id: string }> {
  const webhookEvent = await db.webhookEvent.create({
    data: {
      requestId: metadata.requestId,
      eventType: eventType || 'UNKNOWN',
      sessionId: sessionId || null,
      receivedAt: new Date(),
      requestBody: body as any,
      requestHeaders: metadata.headers,
      ipAddress: metadata.ipAddress,
      status: WebhookStatus.PENDING,
      metadata: {
        userAgent: metadata.userAgent,
      },
    },
    select: { id: true },
  })

  return webhookEvent
}

/**
 * Update webhook event with processing results
 */
async function updateWebhookEvent(
  webhookEventId: string,
  updates: {
    status?: WebhookStatus
    processedAt?: Date
    processingTime?: number
    conversationId?: string
    messageId?: string
    toolUseId?: string
    errorMessage?: string
    errorStack?: string
    errorCode?: string
    metadata?: Record<string, any>
  }
): Promise<void> {
  await db.webhookEvent.update({
    where: { id: webhookEventId },
    data: updates,
  })
}

/**
 * Check for duplicate requests using requestId
 * Returns existing webhook event if found and successfully processed
 */
async function checkDuplicateRequest(
  requestId: string
): Promise<{ id: string; conversationId?: string | null; messageId?: string | null; toolUseId?: string | null } | null> {
  // Look for existing webhook event with same requestId
  const existing = await db.webhookEvent.findUnique({
    where: { requestId },
    select: {
      id: true,
      status: true,
      conversationId: true,
      messageId: true,
      toolUseId: true,
    },
  })

  if (!existing) {
    return null
  }

  // If already processing or successfully processed, treat as duplicate
  if (existing.status === WebhookStatus.PROCESSING || existing.status === WebhookStatus.SUCCESS) {
    return existing
  }

  // If previously failed or invalid, allow retry
  return null
}

/**
 * Check for duplicate SessionStart by sessionId
 * Prevents creating multiple conversations for the same session
 */
async function checkDuplicateSession(
  sessionId: string
): Promise<{ conversationId: string } | null> {
  const existingConversation = await db.conversation.findFirst({
    where: { sessionId },
    select: { id: true },
  })

  return existingConversation ? { conversationId: existingConversation.id } : null
}

/**
 * Main POST handler with complete webhook event logging
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let webhookEventId: string | undefined
  let requestMetadata: RequestMetadata | undefined

  try {
    // Step 1: Extract request metadata
    requestMetadata = extractRequestMetadata(request)

    // Step 2: Verify API key (enforced in ALL environments)
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
      console.warn('[Claude Hook] Unauthorized request attempt', {
        requestId: requestMetadata.requestId,
        ipAddress: requestMetadata.ipAddress,
      })
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Step 3: Parse request body (before validation to log even malformed requests)
    let body: unknown
    try {
      body = await request.json()
    } catch (parseError) {
      // Log malformed JSON requests
      const webhookEvent = await createWebhookEvent(
        requestMetadata,
        { error: 'Malformed JSON' },
        'PARSE_ERROR',
        undefined
      )

      await updateWebhookEvent(webhookEvent.id, {
        status: WebhookStatus.INVALID,
        processedAt: new Date(),
        processingTime: Date.now() - startTime,
        errorMessage: parseError instanceof Error ? parseError.message : 'Failed to parse JSON',
        errorCode: 'JSON_PARSE_ERROR',
      })

      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }

    // Step 4: Extract trace requestId if provided by client
    const traceRequestId = (body as any)?._trace?.requestId
    if (traceRequestId) {
      requestMetadata.requestId = traceRequestId
    }

    // Step 5: Check for duplicate request BEFORE validation (faster)
    const duplicate = await checkDuplicateRequest(requestMetadata.requestId)
    if (duplicate) {
      console.log('[Claude Hook] Duplicate request detected', {
        requestId: requestMetadata.requestId,
        originalWebhookEventId: duplicate.id,
      })

      // Update the duplicate webhook event
      await updateWebhookEvent(duplicate.id, {
        status: WebhookStatus.DUPLICATE,
        processedAt: new Date(),
        processingTime: Date.now() - startTime,
        metadata: {
          duplicateAttemptAt: new Date().toISOString(),
        },
      })

      // Return success with cached result
      return NextResponse.json({
        success: true,
        message: 'Request already processed (idempotent)',
        data: {
          conversationId: duplicate.conversationId,
          messageId: duplicate.messageId,
          toolUseId: duplicate.toolUseId,
          cached: true,
        },
      })
    }

    // Step 6: Validate payload with Zod
    let payload: AnyClaudeHookPayload
    try {
      payload = hookPayloadSchema.parse(body) as AnyClaudeHookPayload
    } catch (validationError) {
      // Create webhook event for invalid payload
      const webhookEvent = await createWebhookEvent(
        requestMetadata,
        body,
        (body as any)?.event || 'UNKNOWN',
        (body as any)?.sessionId
      )
      webhookEventId = webhookEvent.id

      // Extract Zod validation errors
      const zodErrors = validationError instanceof z.ZodError
        ? validationError.errors
        : undefined

      await updateWebhookEvent(webhookEventId, {
        status: WebhookStatus.INVALID,
        processedAt: new Date(),
        processingTime: Date.now() - startTime,
        errorMessage: validationError instanceof Error ? validationError.message : 'Validation failed',
        errorCode: 'VALIDATION_ERROR',
        metadata: { zodErrors },
      })

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid payload',
          details: process.env.NODE_ENV === 'production' ? undefined : zodErrors,
        },
        { status: 400 }
      )
    }

    // Step 7: Create webhook event record (PENDING)
    const webhookEvent = await createWebhookEvent(
      requestMetadata,
      body,
      payload.event,
      payload.sessionId
    )
    webhookEventId = webhookEvent.id

    console.log(`[Claude Hook] ${payload.event}:`, {
      webhookEventId,
      requestId: requestMetadata.requestId,
      sessionId: payload.sessionId,
      timestamp: payload.timestamp,
      projectPath: payload.projectPath,
    })

    // Step 8: Update status to PROCESSING
    await updateWebhookEvent(webhookEventId, {
      status: WebhookStatus.PROCESSING,
    })

    // Step 9: Process the hook event
    const result = await processHookEvent(payload, webhookEventId)

    // Step 10: Update webhook event with SUCCESS and outcomes
    await updateWebhookEvent(webhookEventId, {
      status: WebhookStatus.SUCCESS,
      processedAt: new Date(),
      processingTime: Date.now() - startTime,
      conversationId: result.conversationId,
      messageId: result.messageId,
      toolUseId: result.toolUseId,
      metadata: {
        created: result.created,
        skipped: result.skipped,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Processed ${payload.event} event`,
      data: result,
    })

  } catch (error) {
    console.error('[Claude Hook] Error processing hook:', error)

    // Update webhook event with error details
    if (webhookEventId) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : undefined
      const errorCode = (error as any)?.code || 'UNKNOWN_ERROR'

      await updateWebhookEvent(webhookEventId, {
        status: WebhookStatus.ERROR,
        processedAt: new Date(),
        processingTime: Date.now() - startTime,
        errorMessage,
        errorStack,
        errorCode,
      })
    }

    // Return error response but don't break Claude Code's workflow
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : error instanceof Error
        ? error.message
        : 'Unknown error processing hook'

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        requestId: requestMetadata?.requestId,
      },
      { status: 500 }
    )
  }
}

/**
 * Process different types of hook events
 * This function is called after webhook event is created and validated
 */
async function processHookEvent(
  payload: AnyClaudeHookPayload,
  webhookEventId: string
): Promise<ProcessingResult> {
  switch (payload.event) {
    case 'SessionStart':
      return await handleSessionStart(payload as SessionStartPayload, webhookEventId)

    case 'UserPromptSubmit':
      return await handleUserPromptSubmit(payload as UserPromptSubmitPayload)

    case 'PostToolUse':
      return await handlePostToolUse(payload as PostToolUsePayload)

    case 'SessionEnd':
      return await handleSessionEnd(payload as SessionEndPayload)

    case 'PreToolUse':
    case 'Stop':
      // These events are logged via webhook event but don't require special processing
      console.log(`[Claude Hook] ${payload.event} event received and logged`)
      return { skipped: false }

    default:
      console.warn('[Claude Hook] Unknown event type:', (payload as any).event)
      return { skipped: true }
  }
}

/**
 * Handle session start - create conversation record with idempotency
 */
async function handleSessionStart(
  payload: SessionStartPayload,
  webhookEventId: string
): Promise<ProcessingResult> {
  if (!payload.sessionId) {
    throw new Error('SessionStart event missing sessionId')
  }

  try {
    // Check for duplicate session (idempotency for SessionStart)
    const existingSession = await checkDuplicateSession(payload.sessionId)
    if (existingSession) {
      console.log(
        `[Claude Hook] Conversation already exists for session: ${payload.sessionId}`,
        { conversationId: existingSession.conversationId }
      )

      // Update webhook event to indicate this was a duplicate session
      await updateWebhookEvent(webhookEventId, {
        conversationId: existingSession.conversationId,
        metadata: {
          duplicateSession: true,
        },
      })

      return {
        conversationId: existingSession.conversationId,
        created: false,
      }
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
async function handleUserPromptSubmit(
  payload: UserPromptSubmitPayload
): Promise<ProcessingResult> {
  if (!payload.sessionId || !payload.prompt) {
    console.warn('[Claude Hook] UserPromptSubmit missing required fields')
    return { skipped: true }
  }

  try {
    // Find conversation
    const conversation = await db.conversation.findFirst({
      where: { sessionId: payload.sessionId },
      select: {
        id: true,
        title: true,
      },
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

    return {
      conversationId: conversation.id,
      messageId: message.id,
    }
  } catch (error) {
    console.error('[Claude Hook] Error adding user message:', error)
    throw error
  }
}

/**
 * Handle post tool use - record tool usage
 */
async function handlePostToolUse(
  payload: PostToolUsePayload
): Promise<ProcessingResult> {
  if (!payload.sessionId || !payload.toolName) {
    console.warn('[Claude Hook] PostToolUse missing required fields')
    return { skipped: true }
  }

  try {
    // Find conversation
    const conversation = await db.conversation.findFirst({
      where: { sessionId: payload.sessionId },
      select: { id: true },
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

    return {
      conversationId: conversation.id,
      messageId: recentMessage.id,
      toolUseId: toolUse.id,
    }
  } catch (error) {
    console.error('[Claude Hook] Error recording tool use:', error)
    throw error
  }
}

/**
 * Handle session end - parse full transcript and update conversation
 */
async function handleSessionEnd(
  payload: SessionEndPayload
): Promise<ProcessingResult> {
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
