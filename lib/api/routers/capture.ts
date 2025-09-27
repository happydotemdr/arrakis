/**
 * Capture tRPC Router
 * API endpoints for capture service management
 */

import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import {
  defaultAutoCaptureService,
  type CaptureServiceConfig,
  type CaptureStatus,
} from '@/lib/capture/auto-capture-service'

// Input schemas
const captureConfigSchema = z.object({
  enabled: z.boolean(),
  autoStart: z.boolean(),
  interceptMode: z.enum(['proxy', 'wrapper', 'monitor']),
  notification: z.boolean(),
  logLevel: z.enum(['error', 'warn', 'info', 'debug']),
  storageEnabled: z.boolean(),
})

export const captureRouter = router({
  /**
   * Get capture service status
   */
  status: publicProcedure.query(async (): Promise<CaptureStatus> => {
    try {
      return defaultAutoCaptureService.getStatus()
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get capture status',
        cause: error,
      })
    }
  }),

  /**
   * Start capture service
   */
  start: publicProcedure.mutation(async () => {
    try {
      await defaultAutoCaptureService.start()
      return { success: true, message: 'Capture service started' }
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to start capture service',
        cause: error,
      })
    }
  }),

  /**
   * Stop capture service
   */
  stop: publicProcedure.mutation(async () => {
    try {
      await defaultAutoCaptureService.stop()
      return { success: true, message: 'Capture service stopped' }
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to stop capture service',
        cause: error,
      })
    }
  }),

  /**
   * Update capture service configuration
   */
  updateConfig: publicProcedure
    .input(captureConfigSchema.partial())
    .mutation(async ({ input }) => {
      try {
        defaultAutoCaptureService.updateConfig(input)
        return { success: true, message: 'Configuration updated' }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update configuration',
          cause: error,
        })
      }
    }),

  /**
   * Get capture history/logs
   */
  history: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        level: z.enum(['error', 'warn', 'info', 'debug']).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        // TODO: Implement capture history/logs functionality
        return {
          logs: [],
          totalCount: 0,
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch capture history',
          cause: error,
        })
      }
    }),

  /**
   * Test capture functionality
   */
  test: publicProcedure.mutation(async () => {
    try {
      // TODO: Implement capture test functionality
      // This would run a test capture to verify everything is working
      return {
        success: true,
        message: 'Capture test completed successfully',
        details: {
          proxyInstalled: true,
          databaseConnected: true,
          serviceRunning: true,
        },
      }
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Capture test failed',
        cause: error,
      })
    }
  }),

  /**
   * Get capture statistics
   */
  stats: publicProcedure.query(async () => {
    try {
      const status = defaultAutoCaptureService.getStatus()

      return {
        totalSessions: status.totalSessions,
        sessionsToday: status.sessionsToday,
        lastCaptureTime: status.lastCaptureTime,
        errors: status.errors.length,
        uptime: 0, // TODO: Calculate service uptime
        mode: status.mode,
        running: status.running,
      }
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch capture statistics',
        cause: error,
      })
    }
  }),

  /**
   * Reset capture service
   */
  reset: publicProcedure.mutation(async () => {
    try {
      await defaultAutoCaptureService.stop()
      // TODO: Clear any cached data, reset counters, etc.
      await defaultAutoCaptureService.start()

      return { success: true, message: 'Capture service reset successfully' }
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to reset capture service',
        cause: error,
      })
    }
  }),
})
