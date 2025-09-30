import { z } from 'zod'
import { createTRPCRouter, publicProcedure } from '@/server/api/trpc'
import { parseTranscriptFile, generateConversationTitle, extractProjectName } from '@/lib/claude/parser'
import type { ParsedConversation } from '@/lib/claude/types'

export const conversationRouter = createTRPCRouter({
  // =============================================================================
  // PUBLIC READ OPERATIONS - Used by frontend
  // =============================================================================

  // Get all conversations with pagination and optimized queries
  getAll: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { limit, cursor } = input

      const conversations = await ctx.db.conversation.findMany({
        take: limit + 1, // Take one extra to determine if there are more
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          sessionId: true,
          projectPath: true,
          title: true,
          description: true,
          startedAt: true,
          endedAt: true,
          updatedAt: true,
          // Only get the latest message preview - no full content
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              role: true,
              content: true,
              timestamp: true,
            },
          },
          _count: {
            select: { messages: true },
          },
        },
      })

      let nextCursor: string | undefined = undefined
      if (conversations.length > limit) {
        const nextItem = conversations.pop()
        nextCursor = nextItem!.id
      }

      return {
        items: conversations,
        nextCursor,
      }
    }),

  // Get a conversation by ID with optimized message loading
  getById: publicProcedure
    .input(z.object({
      id: z.string(),
      includeToolUses: z.boolean().default(false),
      limit: z.number().min(1).max(500).default(100),
      cursor: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { id, includeToolUses, limit, cursor } = input

      // First get the conversation
      const conversation = await ctx.db.conversation.findUnique({
        where: { id },
        select: {
          id: true,
          sessionId: true,
          projectPath: true,
          title: true,
          description: true,
          startedAt: true,
          endedAt: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { messages: true },
          },
        },
      })

      if (!conversation) return null

      // Then get messages with pagination
      const messages = await ctx.db.message.findMany({
        where: { conversationId: id },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          toolCalls: true,
          timestamp: true,
          metadata: true,
          ...(includeToolUses && {
            toolUses: {
              orderBy: { timestamp: 'asc' },
              select: {
                id: true,
                toolName: true,
                parameters: true,
                response: true,
                duration: true,
                status: true,
                timestamp: true,
              },
            },
          }),
        },
      })

      let nextCursor: string | undefined = undefined
      if (messages.length > limit) {
        const nextItem = messages.pop()
        nextCursor = nextItem!.id
      }

      return {
        ...conversation,
        messages,
        nextCursor,
      }
    }),

  // =============================================================================
  // DISABLED - General CRUD operations not used by read-only frontend
  // These are commented out for security as they're not needed for the UI
  // Uncomment and add authentication if you need write operations in the future
  // =============================================================================

  /*
  // Create a new conversation
  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const conversation = await ctx.db.conversation.create({
        data: {
          title: input.title,
          description: input.description,
        },
      })
      return conversation
    }),

  // Update conversation
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updateData } = input
      const conversation = await ctx.db.conversation.update({
        where: { id },
        data: updateData,
      })
      return conversation
    }),

  // Delete conversation
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.conversation.delete({
        where: { id: input.id },
      })
      return { success: true }
    }),

  // Add message to conversation
  addMessage: publicProcedure
    .input(
      z.object({
        conversationId: z.string(),
        role: z.enum(['user', 'assistant', 'system', 'function', 'tool']),
        content: z.string(),
        toolCalls: z.array(z.any()).optional(),
        timestamp: z.date().optional(),
        metadata: z.record(z.any()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const message = await ctx.db.message.create({
        data: {
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
          toolCalls: input.toolCalls,
          timestamp: input.timestamp || new Date(),
          metadata: input.metadata,
        },
      })

      // Update conversation's updatedAt timestamp
      await ctx.db.conversation.update({
        where: { id: input.conversationId },
        data: { updatedAt: new Date() },
      })

      return message
    }),

  // Add tool use to message
  addToolUse: publicProcedure
    .input(
      z.object({
        messageId: z.string(),
        toolName: z.string(),
        parameters: z.record(z.any()),
        response: z.any().optional(),
        duration: z.number().optional(),
        status: z.enum(['success', 'error', 'timeout']).default('success'),
        timestamp: z.date().optional(),
        error: z.string().optional(),
        metadata: z.record(z.any()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const toolUse = await ctx.db.toolUse.create({
        data: {
          messageId: input.messageId,
          toolName: input.toolName,
          parameters: input.parameters,
          response: input.response,
          duration: input.duration,
          status: input.status,
          timestamp: input.timestamp || new Date(),
          metadata: {
            error: input.error,
            ...input.metadata,
          },
        },
      })
      return toolUse
    }),
  */

  // =============================================================================
  // WEBHOOK OPERATIONS - Used by Claude Code hooks (keep these active)
  // =============================================================================

  // Create conversation from Claude hook
  createFromHook: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        projectPath: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        startedAt: z.date().optional(),
        userInfo: z.record(z.any()).optional(),
        transcriptPath: z.string().optional(),
        metadata: z.record(z.any()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Check if conversation already exists
      const existingConversation = await ctx.db.conversation.findFirst({
        where: { sessionId: input.sessionId },
      })

      if (existingConversation) {
        return { conversation: existingConversation, created: false }
      }

      const conversation = await ctx.db.conversation.create({
        data: {
          sessionId: input.sessionId,
          projectPath: input.projectPath,
          title: input.title || `Session ${input.sessionId.slice(-8)}`,
          description: input.description,
          startedAt: input.startedAt || new Date(),
          metadata: {
            userInfo: input.userInfo,
            transcriptPath: input.transcriptPath,
            projectName: extractProjectName(input.projectPath),
            ...input.metadata,
          },
        },
      })

      return { conversation, created: true }
    }),

  // Update conversation from hook
  updateFromHook: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        endedAt: z.date().optional(),
        duration: z.number().optional(),
        messageCount: z.number().optional(),
        toolUseCount: z.number().optional(),
        metadata: z.record(z.any()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const conversation = await ctx.db.conversation.findFirst({
        where: { sessionId: input.sessionId },
      })

      if (!conversation) {
        throw new Error(`Conversation not found for session: ${input.sessionId}`)
      }

      const updatedConversation = await ctx.db.conversation.update({
        where: { id: conversation.id },
        data: {
          endedAt: input.endedAt,
          metadata: {
            ...(conversation.metadata as Record<string, any> || {}),
            duration: input.duration,
            messageCount: input.messageCount,
            toolUseCount: input.toolUseCount,
            ...(input.metadata || {}),
          },
        },
      })

      return updatedConversation
    }),

  // Import full conversation from transcript
  importFromTranscript: publicProcedure
    .input(
      z.object({
        transcriptPath: z.string(),
        sessionId: z.string().optional(),
        projectPath: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Parse the transcript
      const parsedConversation = await parseTranscriptFile(input.transcriptPath)
      if (!parsedConversation) {
        throw new Error('Failed to parse transcript file')
      }

      const sessionId = input.sessionId || parsedConversation.sessionId || `import-${Date.now()}`

      // Check if conversation already exists
      let conversation = await ctx.db.conversation.findFirst({
        where: { sessionId },
      })

      // Create conversation if it doesn't exist
      if (!conversation) {
        conversation = await ctx.db.conversation.create({
          data: {
            sessionId,
            projectPath: input.projectPath || parsedConversation.projectPath,
            title: generateConversationTitle(parsedConversation.messages),
            startedAt: parsedConversation.startedAt,
            endedAt: parsedConversation.endedAt,
            metadata: {
              transcriptPath: input.transcriptPath,
              projectName: extractProjectName(parsedConversation.projectPath),
              imported: true,
              importedAt: new Date(),
              ...parsedConversation.metadata,
            },
          },
        })
      }

      // Import messages
      const messageIds = new Map<number, string>()
      for (const [index, message] of parsedConversation.messages.entries()) {
        const createdMessage = await ctx.db.message.create({
          data: {
            conversationId: conversation.id,
            role: message.role,
            content: message.content,
            toolCalls: message.toolCalls,
            timestamp: message.timestamp,
            metadata: {
              messageIndex: message.messageIndex || index,
              ...message.metadata,
            },
          },
        })
        messageIds.set(message.messageIndex || index, createdMessage.id)
      }

      // Import tool uses
      for (const toolUse of parsedConversation.toolUses) {
        const messageId = messageIds.get(toolUse.messageIndex || 0)
        if (messageId) {
          await ctx.db.toolUse.create({
            data: {
              messageId,
              toolName: toolUse.toolName,
              parameters: toolUse.parameters,
              response: toolUse.response,
              duration: toolUse.duration,
              status: toolUse.status,
              timestamp: toolUse.timestamp,
              metadata: {
                error: toolUse.error,
                ...toolUse.metadata,
              },
            },
          })
        }
      }

      return {
        conversation,
        imported: {
          messages: parsedConversation.messages.length,
          toolUses: parsedConversation.toolUses.length,
        },
      }
    }),

  // Find conversation by session ID
  findBySessionId: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input, ctx }) => {
      const conversation = await ctx.db.conversation.findFirst({
        where: { sessionId: input.sessionId },
        include: {
          messages: {
            orderBy: { timestamp: 'asc' },
            include: {
              toolUses: {
                orderBy: { timestamp: 'asc' },
              },
            },
          },
          _count: {
            select: { messages: true },
          },
        },
      })
      return conversation
    }),

  // Get conversation statistics (optimized with single aggregate query)
  getStats: publicProcedure.query(async ({ ctx }) => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // Use a single aggregated query for conversation stats
    const [conversationStats, totalMessages, totalToolUses, toolStats] = await Promise.all([
      // Single query for all conversation aggregates
      ctx.db.conversation.aggregate({
        _count: {
          _all: true,
          endedAt: true, // Counts non-null values (ended conversations)
        },
        where: {
          // This will be used for total count
        },
      }),
      ctx.db.message.count(),
      ctx.db.toolUse.count(),
      // Get tool usage distribution
      ctx.db.toolUse.groupBy({
        by: ['toolName'],
        _count: { _all: true },
        orderBy: { toolName: 'asc' },
        take: 10, // Top 10 most used tools
      }),
      // Recent conversations (last 7 days)
      ctx.db.conversation.count({
        where: {
          startedAt: { gte: sevenDaysAgo },
        },
      }),
    ])

    const totalConversations = conversationStats._count._all
    const endedConversations = conversationStats._count.endedAt || 0
    const activeConversations = totalConversations - endedConversations

    return {
      totalConversations,
      totalMessages,
      totalToolUses,
      activeConversations,
      recentConversations: await ctx.db.conversation.count({
        where: { startedAt: { gte: sevenDaysAgo } },
      }),
      toolUsageStats: toolStats,
      // Additional metrics
      avgMessagesPerConversation: totalConversations > 0
        ? Math.round(totalMessages / totalConversations)
        : 0,
      avgToolUsesPerConversation: totalConversations > 0
        ? Math.round(totalToolUses / totalConversations)
        : 0,
    }
  }),
})