import { z } from 'zod'
import { createTRPCRouter, publicProcedure } from '@/server/api/trpc'
import { parseTranscriptFile, generateConversationTitle, extractProjectName } from '@/lib/claude/parser'
import type { ParsedConversation } from '@/lib/claude/types'

export const conversationRouter = createTRPCRouter({
  // Get all conversations
  getAll: publicProcedure.query(async ({ ctx }) => {
    const conversations = await ctx.db.conversation.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { messages: true },
        },
      },
    })
    return conversations
  }),

  // Get a conversation by ID with all messages
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const conversation = await ctx.db.conversation.findUnique({
        where: { id: input.id },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      })
      return conversation
    }),

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

  // Get conversation statistics
  getStats: publicProcedure.query(async ({ ctx }) => {
    const [
      totalConversations,
      totalMessages,
      totalToolUses,
      activeConversations,
      recentConversations,
    ] = await Promise.all([
      ctx.db.conversation.count(),
      ctx.db.message.count(),
      ctx.db.toolUse.count(),
      ctx.db.conversation.count({
        where: {
          endedAt: null,
        },
      }),
      ctx.db.conversation.count({
        where: {
          startedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      }),
    ])

    return {
      totalConversations,
      totalMessages,
      totalToolUses,
      activeConversations,
      recentConversations,
    }
  }),
})