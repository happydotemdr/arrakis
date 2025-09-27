/**
 * Templates tRPC Router
 * API endpoints for conversation template management
 */

import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { db } from '@/lib/db'
import { conversationTemplates } from '@/lib/db/schema'
import { TRPCError } from '@trpc/server'
import { eq, and, or, like, desc, sql } from 'drizzle-orm'

// Input schemas
const templateCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  template: z.string().min(1),
  category: z.string().default('general'),
  isPublic: z.boolean().default(false),
  userId: z.number().default(1), // For now, default to user 1
})

const templateUpdateSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  template: z.string().min(1).optional(),
  category: z.string().optional(),
  isPublic: z.boolean().optional(),
})

const templateFiltersSchema = z.object({
  category: z.string().optional(),
  isPublic: z.boolean().optional(),
  userId: z.number().optional(),
  search: z.string().optional(),
})

export const templatesRouter = router({
  /**
   * Get all templates with optional filters
   */
  list: publicProcedure
    .input(templateFiltersSchema.optional())
    .query(async ({ input }) => {
      try {
        const filters = input || {}

        // Build where conditions
        const conditions = []

        if (filters.category) {
          conditions.push(eq(conversationTemplates.category, filters.category))
        }

        if (filters.isPublic !== undefined) {
          conditions.push(eq(conversationTemplates.isPublic, filters.isPublic))
        }

        if (filters.userId) {
          conditions.push(eq(conversationTemplates.userId, filters.userId))
        }

        if (filters.search) {
          conditions.push(
            or(
              like(conversationTemplates.name, `%${filters.search}%`),
              like(conversationTemplates.description, `%${filters.search}%`),
              like(conversationTemplates.template, `%${filters.search}%`)
            )
          )
        }

        // Build final query
        const baseQuery = db.select().from(conversationTemplates)
        const finalQuery = conditions.length > 0
          ? baseQuery.where(and(...conditions))
          : baseQuery

        const templates = await finalQuery.orderBy(
          desc(conversationTemplates.usageCount),
          desc(conversationTemplates.createdAt)
        )

        return templates
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch templates',
          cause: error,
        })
      }
    }),

  /**
   * Get template by ID
   */
  byId: publicProcedure.input(z.number()).query(async ({ input: id }) => {
    try {
      const template = await db
        .select()
        .from(conversationTemplates)
        .where(eq(conversationTemplates.id, id))
        .limit(1)

      if (template.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found',
        })
      }

      return template[0]
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch template',
        cause: error,
      })
    }
  }),

  /**
   * Create new template
   */
  create: publicProcedure
    .input(templateCreateSchema)
    .mutation(async ({ input }) => {
      try {
        const newTemplate = await db
          .insert(conversationTemplates)
          .values({
            ...input,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning()

        return newTemplate[0]
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create template',
          cause: error,
        })
      }
    }),

  /**
   * Update template
   */
  update: publicProcedure
    .input(templateUpdateSchema)
    .mutation(async ({ input }) => {
      try {
        const { id, ...updateData } = input

        const updatedTemplate = await db
          .update(conversationTemplates)
          .set({
            ...updateData,
            updatedAt: new Date(),
          })
          .where(eq(conversationTemplates.id, id))
          .returning()

        if (updatedTemplate.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Template not found',
          })
        }

        return updatedTemplate[0]
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update template',
          cause: error,
        })
      }
    }),

  /**
   * Delete template
   */
  delete: publicProcedure.input(z.number()).mutation(async ({ input: id }) => {
    try {
      const deletedTemplate = await db
        .delete(conversationTemplates)
        .where(eq(conversationTemplates.id, id))
        .returning()

      if (deletedTemplate.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found',
        })
      }

      return { success: true }
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete template',
        cause: error,
      })
    }
  }),

  /**
   * Use template (increment usage count and return processed template)
   */
  use: publicProcedure
    .input(
      z.object({
        id: z.number(),
        variables: z.record(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { id, variables = {} } = input

        // Get template
        const template = await db
          .select()
          .from(conversationTemplates)
          .where(eq(conversationTemplates.id, id))
          .limit(1)

        if (template.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Template not found',
          })
        }

        const foundTemplate = template[0]!

        // Increment usage count
        await db
          .update(conversationTemplates)
          .set({
            usageCount: sql`${conversationTemplates.usageCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(conversationTemplates.id, id))

        // Process template with variables
        let processedTemplate = foundTemplate.template

        // Replace variables in template (e.g., {{variable}} with actual values)
        for (const [key, value] of Object.entries(variables)) {
          const placeholder = `{{${key}}}`
          processedTemplate = processedTemplate.replace(
            new RegExp(placeholder, 'g'),
            value
          )
        }

        return {
          ...foundTemplate,
          processedTemplate,
          usageCount: (foundTemplate.usageCount || 0) + 1,
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to use template',
          cause: error,
        })
      }
    }),

  /**
   * Get template categories
   */
  categories: publicProcedure.query(async () => {
    try {
      const categories = await db
        .select({
          category: conversationTemplates.category,
          count: sql<number>`count(*)`,
        })
        .from(conversationTemplates)
        .groupBy(conversationTemplates.category)
        .orderBy(desc(sql`count(*)`))

      return categories
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch categories',
        cause: error,
      })
    }
  }),

  /**
   * Get popular templates (by usage count)
   */
  popular: publicProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ input }) => {
      try {
        const popularTemplates = await db
          .select()
          .from(conversationTemplates)
          .where(eq(conversationTemplates.isPublic, true))
          .orderBy(desc(conversationTemplates.usageCount))
          .limit(input.limit)

        return popularTemplates
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch popular templates',
          cause: error,
        })
      }
    }),
})
