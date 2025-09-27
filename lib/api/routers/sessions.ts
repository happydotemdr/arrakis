/**
 * Sessions tRPC Router
 * API endpoints for session management and retrieval
 */

import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import {
  getSessions,
  getSessionById,
  getSessionMessages,
} from '@/lib/db/queries'
import { TRPCError } from '@trpc/server'

// Input schemas
const sessionFiltersSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['active', 'completed', 'error']).optional(),
  minCost: z.number().optional(),
  maxCost: z.number().optional(),
  toolsUsed: z.array(z.string()).optional(),
})

const paginationSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
})

export const sessionsRouter = router({
  /**
   * Get paginated list of sessions with optional filters
   */
  list: publicProcedure
    .input(
      z.object({
        filters: sessionFiltersSchema.optional(),
        pagination: paginationSchema.optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const { filters, pagination } = input
        const sessions = await getSessions({
          filters,
          limit: pagination?.limit || 20,
          cursor: pagination?.cursor,
        })

        return {
          sessions,
          nextCursor:
            sessions.length === (pagination?.limit || 20)
              ? sessions[sessions.length - 1].id
              : null,
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch sessions',
          cause: error,
        })
      }
    }),

  /**
   * Get session by ID with full details
   */
  byId: publicProcedure
    .input(z.string().uuid())
    .query(async ({ input: sessionId }) => {
      try {
        const session = await getSessionById(sessionId)

        if (!session) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Session not found',
          })
        }

        return session
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch session',
          cause: error,
        })
      }
    }),

  /**
   * Get messages for a session
   */
  messages: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      try {
        const { sessionId, limit, offset } = input
        const messages = await getSessionMessages(sessionId, { limit, offset })

        return messages
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch session messages',
          cause: error,
        })
      }
    }),

  /**
   * Get session statistics
   */
  stats: publicProcedure.query(async () => {
    try {
      // TODO: Implement session statistics
      return {
        totalSessions: 0,
        sessionsThisWeek: 0,
        totalMessages: 0,
        totalCost: 0,
        averageSessionLength: 0,
        topTools: [],
      }
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch session statistics',
        cause: error,
      })
    }
  }),

  /**
   * Delete session
   */
  delete: publicProcedure
    .input(z.string().uuid())
    .mutation(async ({ input: sessionId }) => {
      try {
        // TODO: Implement session deletion
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'Session deletion not implemented yet',
        })
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete session',
          cause: error,
        })
      }
    }),

  /**
   * Export session
   */
  export: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        format: z.enum(['json', 'markdown', 'pdf']),
        includeMetadata: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { sessionId, format, includeMetadata } = input

        // Get session with messages
        const session = await getSessionById(sessionId)
        if (!session) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Session not found',
          })
        }

        const messages = await getSessionMessages(sessionId, {
          limit: 1000,
          offset: 0,
        })

        const exportData = {
          session: {
            id: session.id,
            title: session.title,
            createdAt: session.createdAt,
            status: session.status,
            ...(includeMetadata && { metadata: session.metadata }),
          },
          messages: messages.map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt,
            ...(includeMetadata && {
              tokens: msg.tokens,
              costUsd: msg.costUsd,
              metadata: msg.metadata,
            }),
          })),
          exportedAt: new Date(),
          format,
        }

        // Format data based on requested format
        let content: string
        let mimeType: string
        let filename: string

        switch (format) {
          case 'json':
            content = JSON.stringify(exportData, null, 2)
            mimeType = 'application/json'
            filename = `session-${sessionId}.json`
            break

          case 'markdown':
            content = formatAsMarkdown(exportData)
            mimeType = 'text/markdown'
            filename = `session-${sessionId}.md`
            break

          case 'pdf':
            // For MVP, we'll export as markdown and let client handle PDF conversion
            content = formatAsMarkdown(exportData)
            mimeType = 'text/markdown'
            filename = `session-${sessionId}.md`
            break

          default:
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Unsupported export format',
            })
        }

        return {
          content,
          mimeType,
          filename,
          size: Buffer.byteLength(content, 'utf8'),
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to export session',
          cause: error,
        })
      }
    }),

  /**
   * Bulk export sessions
   */
  bulkExport: publicProcedure
    .input(
      z.object({
        sessionIds: z.array(z.string().uuid()),
        format: z.enum(['json', 'markdown', 'pdf']),
        includeMetadata: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { sessionIds, format, includeMetadata } = input

        const exportResults = []

        for (const sessionId of sessionIds) {
          try {
            const session = await getSessionById(sessionId)
            if (!session) continue

            const messages = await getSessionMessages(sessionId, {
              limit: 1000,
              offset: 0,
            })

            exportResults.push({
              session: {
                id: session.id,
                title: session.title,
                createdAt: session.createdAt,
                status: session.status,
                ...(includeMetadata && { metadata: session.metadata }),
              },
              messages: messages.map((msg) => ({
                id: msg.id,
                role: msg.role,
                content: msg.content,
                createdAt: msg.createdAt,
                ...(includeMetadata && {
                  tokens: msg.tokens,
                  costUsd: msg.costUsd,
                  metadata: msg.metadata,
                }),
              })),
            })
          } catch (error) {
            console.error(`Failed to export session ${sessionId}:`, error)
          }
        }

        const bulkExportData = {
          sessions: exportResults,
          exportedAt: new Date(),
          format,
          totalSessions: exportResults.length,
        }

        let content: string
        let mimeType: string
        let filename: string

        switch (format) {
          case 'json':
            content = JSON.stringify(bulkExportData, null, 2)
            mimeType = 'application/json'
            filename = `arrakis-conversations-${Date.now()}.json`
            break

          case 'markdown':
            content = formatBulkAsMarkdown(bulkExportData)
            mimeType = 'text/markdown'
            filename = `arrakis-conversations-${Date.now()}.md`
            break

          case 'pdf':
            content = formatBulkAsMarkdown(bulkExportData)
            mimeType = 'text/markdown'
            filename = `arrakis-conversations-${Date.now()}.md`
            break

          default:
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Unsupported export format',
            })
        }

        return {
          content,
          mimeType,
          filename,
          size: Buffer.byteLength(content, 'utf8'),
          exportedSessionsCount: exportResults.length,
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to bulk export sessions',
          cause: error,
        })
      }
    }),
})

// Helper functions for export formatting
function formatAsMarkdown(exportData: any): string {
  const { session, messages } = exportData

  let markdown = `# ${session.title || 'Untitled Conversation'}\n\n`
  markdown += `**Session ID:** ${session.id}\n`
  markdown += `**Created:** ${new Date(session.createdAt).toLocaleString()}\n`
  markdown += `**Status:** ${session.status}\n\n`

  if (session.metadata?.sessionInfo?.projectPath) {
    markdown += `**Project:** ${session.metadata.sessionInfo.projectPath}\n\n`
  }

  markdown += `---\n\n`

  for (const message of messages) {
    const role = message.role.charAt(0).toUpperCase() + message.role.slice(1)
    markdown += `## ${role}\n\n`
    markdown += `${message.content}\n\n`

    if (message.metadata && Object.keys(message.metadata).length > 0) {
      markdown += `*Metadata: ${JSON.stringify(message.metadata)}*\n\n`
    }

    markdown += `---\n\n`
  }

  markdown += `*Exported on ${new Date().toLocaleString()}*\n`

  return markdown
}

function formatBulkAsMarkdown(bulkExportData: any): string {
  let markdown = `# Arrakis Conversation Export\n\n`
  markdown += `**Exported:** ${new Date(bulkExportData.exportedAt).toLocaleString()}\n`
  markdown += `**Total Sessions:** ${bulkExportData.totalSessions}\n\n`
  markdown += `---\n\n`

  for (const sessionData of bulkExportData.sessions) {
    const singleExport = {
      session: sessionData.session,
      messages: sessionData.messages,
      exportedAt: bulkExportData.exportedAt,
      format: bulkExportData.format,
    }

    markdown += formatAsMarkdown(singleExport)
    markdown += `\n\n`
  }

  return markdown
}
