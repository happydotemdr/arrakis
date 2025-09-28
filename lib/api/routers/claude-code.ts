/**
 * Claude Code tRPC Router (System B)
 *
 * API endpoints for the Claude Code component of the dual strategy.
 * This provides programmatic access to Claude Code with full tool capabilities.
 */

import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import {
  claudeCodeManager,
  executeClaudeCodeTask,
  getClaudeCodeSession,
  getAllClaudeCodeSessions
} from '@/lib/claude-code/claude-code-manager'
import {
  TASK_TEMPLATES,
  getTaskTemplate,
  getTaskTemplatesByCategory,
  createQuickAnalysisTask,
  createDemoTask
} from '@/lib/claude-code/task-templates'
import type { ClaudeCodeTask } from '@/lib/claude-code/claude-code-manager'

// Input schemas
const executeTaskSchema = z.object({
  templateId: z.string().optional(),
  customPrompt: z.string().optional(),
  title: z.string().optional(),
  workingDirectory: z.string().optional(),
  timeout: z.number().min(1000).max(30 * 60 * 1000).optional(), // 1 second to 30 minutes
  captureToDatabase: z.boolean().default(true)
})

const customTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  prompt: z.string().min(10, 'Prompt must be at least 10 characters'),
  workingDirectory: z.string().optional(),
  timeout: z.number().min(1000).max(30 * 60 * 1000).optional(),
  captureToDatabase: z.boolean().default(true)
})

const sessionQuerySchema = z.object({
  sessionId: z.string().uuid()
})

export const claudeCodeRouter = router({
  /**
   * Get all available task templates
   */
  getTemplates: publicProcedure.query(() => {
    return {
      success: true,
      templates: TASK_TEMPLATES.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        estimatedDuration: template.estimatedDuration
      }))
    }
  }),

  /**
   * Get task templates by category
   */
  getTemplatesByCategory: publicProcedure
    .input(z.object({ category: z.enum(['analysis', 'improvement', 'feature', 'maintenance', 'testing']) }))
    .query(({ input }) => {
      const templates = getTaskTemplatesByCategory(input.category)
      return {
        success: true,
        category: input.category,
        templates: templates.map(template => ({
          id: template.id,
          name: template.name,
          description: template.description,
          category: template.category,
          estimatedDuration: template.estimatedDuration
        }))
      }
    }),

  /**
   * Execute a task using a template
   */
  executeTask: publicProcedure
    .input(executeTaskSchema)
    .mutation(async ({ input }) => {
      try {
        console.log('🚀 tRPC: Executing Claude Code task...')
        console.log('📋 Input:', JSON.stringify(input, null, 2))

        let task: ClaudeCodeTask

        if (input.templateId) {
          // Use template
          const template = getTaskTemplate(input.templateId)
          if (!template) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: `Template not found: ${input.templateId}`
            })
          }

          task = template.createTask(input.customPrompt)

          // Override template defaults with user input
          if (input.title) task.title = input.title
          if (input.workingDirectory) task.workingDirectory = input.workingDirectory
          if (input.timeout) task.timeout = input.timeout
          if (input.captureToDatabase !== undefined) task.captureToDatabase = input.captureToDatabase

        } else if (input.customPrompt) {
          // Create custom task
          task = {
            id: crypto.randomUUID(),
            title: input.title || 'Custom Claude Code Task',
            prompt: input.customPrompt,
            workingDirectory: input.workingDirectory,
            timeout: input.timeout,
            captureToDatabase: input.captureToDatabase
          }

        } else {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Either templateId or customPrompt is required'
          })
        }

        // Execute the task
        const sessionId = await claudeCodeManager.executeTask(task)

        console.log('✅ tRPC: Claude Code task started:', sessionId)
        return {
          success: true,
          sessionId,
          task: {
            id: task.id,
            title: task.title,
            templateId: input.templateId
          }
        }

      } catch (error) {
        console.error('❌ tRPC: Claude Code task execution failed:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to execute Claude Code task',
          cause: error
        })
      }
    }),

  /**
   * Execute a custom task
   */
  executeCustomTask: publicProcedure
    .input(customTaskSchema)
    .mutation(async ({ input }) => {
      try {
        console.log('🚀 tRPC: Executing custom Claude Code task...')

        const task: ClaudeCodeTask = {
          id: crypto.randomUUID(),
          title: input.title,
          prompt: input.prompt,
          workingDirectory: input.workingDirectory || process.cwd(),
          timeout: input.timeout || 15 * 60 * 1000, // 15 minutes default
          captureToDatabase: input.captureToDatabase
        }

        const sessionId = await claudeCodeManager.executeTask(task)

        console.log('✅ tRPC: Custom Claude Code task started:', sessionId)
        return {
          success: true,
          sessionId,
          task: {
            id: task.id,
            title: task.title
          }
        }

      } catch (error) {
        console.error('❌ tRPC: Custom Claude Code task execution failed:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to execute custom Claude Code task',
          cause: error
        })
      }
    }),

  /**
   * Execute the demo task
   */
  executeDemo: publicProcedure.mutation(async () => {
    try {
      console.log('🎯 tRPC: Executing Claude Code demo task...')

      const task = createDemoTask()
      const sessionId = await claudeCodeManager.executeTask(task)

      console.log('✅ tRPC: Claude Code demo started:', sessionId)
      return {
        success: true,
        sessionId,
        message: 'Claude Code demonstration started! This will show the full capabilities of System B.'
      }

    } catch (error) {
      console.error('❌ tRPC: Claude Code demo execution failed:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to execute Claude Code demo',
        cause: error
      })
    }
  }),

  /**
   * Execute quick analysis
   */
  executeQuickAnalysis: publicProcedure
    .input(z.object({ focus: z.string().optional() }))
    .mutation(async ({ input }) => {
      try {
        console.log('🔍 tRPC: Executing quick analysis...')

        const task = createQuickAnalysisTask(input.focus)
        const sessionId = await claudeCodeManager.executeTask(task)

        console.log('✅ tRPC: Quick analysis started:', sessionId)
        return {
          success: true,
          sessionId,
          message: 'Quick analysis started!'
        }

      } catch (error) {
        console.error('❌ tRPC: Quick analysis execution failed:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to execute quick analysis',
          cause: error
        })
      }
    }),

  /**
   * Get session status
   */
  getSession: publicProcedure
    .input(sessionQuerySchema)
    .query(({ input }) => {
      const session = getClaudeCodeSession(input.sessionId)

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Session not found: ${input.sessionId}`
        })
      }

      return {
        success: true,
        session: {
          id: session.id,
          status: session.status,
          title: session.task.title,
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.endTime ?
            session.endTime.getTime() - session.startTime.getTime() :
            Date.now() - session.startTime.getTime(),
          output: session.output.join('\n'),
          error: session.error,
          conversationId: session.conversationId
        }
      }
    }),

  /**
   * Get all sessions
   */
  getAllSessions: publicProcedure.query(() => {
    const sessions = getAllClaudeCodeSessions()

    return {
      success: true,
      sessions: sessions.map(session => ({
        id: session.id,
        status: session.status,
        title: session.task.title,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.endTime ?
          session.endTime.getTime() - session.startTime.getTime() :
          Date.now() - session.startTime.getTime(),
        hasOutput: session.output.length > 0,
        hasError: !!session.error,
        conversationId: session.conversationId
      }))
    }
  }),

  /**
   * Stop a running session
   */
  stopSession: publicProcedure
    .input(sessionQuerySchema)
    .mutation(({ input }) => {
      try {
        const success = claudeCodeManager.stopSession(input.sessionId)

        if (!success) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Session not found or not running'
          })
        }

        return {
          success: true,
          message: 'Session stopped successfully'
        }

      } catch (error) {
        console.error('❌ tRPC: Failed to stop session:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to stop session',
          cause: error
        })
      }
    }),

  /**
   * Wait for session completion (with timeout)
   */
  waitForCompletion: publicProcedure
    .input(sessionQuerySchema)
    .mutation(async ({ input }) => {
      try {
        const result = await claudeCodeManager.waitForCompletion(input.sessionId)

        return {
          success: true,
          result: {
            sessionId: result.sessionId,
            completed: result.success,
            output: result.output,
            duration: result.duration,
            conversationId: result.conversationId,
            error: result.error
          }
        }

      } catch (error) {
        console.error('❌ tRPC: Failed to wait for completion:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to wait for session completion',
          cause: error
        })
      }
    }),

  /**
   * Get system status
   */
  getStatus: publicProcedure.query(async () => {
    try {
      // Check if Claude CLI is available
      const { exec } = require('child_process')
      const isClaudeAvailable = await new Promise<boolean>((resolve) => {
        exec('claude --version', (error: any) => {
          resolve(!error)
        })
      })

      const sessions = getAllClaudeCodeSessions()
      const runningSessions = sessions.filter(s => s.status === 'running')

      return {
        success: true,
        status: {
          claudeCliAvailable: isClaudeAvailable,
          totalSessions: sessions.length,
          runningSessions: runningSessions.length,
          availableTemplates: TASK_TEMPLATES.length,
          systemReady: isClaudeAvailable
        }
      }

    } catch (error) {
      console.error('❌ tRPC: Failed to get system status:', error)
      return {
        success: false,
        status: {
          claudeCliAvailable: false,
          totalSessions: 0,
          runningSessions: 0,
          availableTemplates: TASK_TEMPLATES.length,
          systemReady: false
        },
        error: 'Failed to check system status'
      }
    }
  })
})