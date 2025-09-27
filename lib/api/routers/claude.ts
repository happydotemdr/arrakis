/**
 * Claude API tRPC Router
 * Real Claude API integration endpoints
 */

import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { claudeClient, type ClaudeAPIOptions } from '@/lib/claude/api-client'

// Input schemas
const claudeMessageSchema = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty'),
  options: z
    .object({
      model: z.string().optional(),
      maxTokens: z.number().min(1).max(8000).optional(),
      temperature: z.number().min(0).max(2).optional(),
      systemPrompt: z.string().optional(),
      captureToDatabase: z.boolean().default(true),
      username: z.string().default('arrakis-user'),
    })
    .optional(),
})

const claudeStreamSchema = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty'),
  options: z
    .object({
      model: z.string().optional(),
      maxTokens: z.number().min(1).max(8000).optional(),
      temperature: z.number().min(0).max(2).optional(),
      systemPrompt: z.string().optional(),
      captureToDatabase: z.boolean().default(true),
      username: z.string().default('arrakis-user'),
    })
    .optional(),
})

export const claudeRouter = router({
  /**
   * Send a message to Claude API
   */
  sendMessage: publicProcedure
    .input(claudeMessageSchema)
    .mutation(async ({ input }) => {
      try {
        console.log('🚀 tRPC: Processing Claude API request...')
        console.log('📋 Input received:', JSON.stringify(input, null, 2))

        const { prompt, options } = input

        // Sanitize options to prevent JSON issues
        const sanitizedOptions = {
          model: options?.model || 'claude-sonnet-4-20250514',
          maxTokens: options?.maxTokens || 4000,
          temperature: options?.temperature || 0.7,
          captureToDatabase: options?.captureToDatabase !== false,
          username: options?.username || 'arrakis-user',
          systemPrompt: options?.systemPrompt?.replace(/\\/g, '/') || undefined,
        }

        console.log(
          '🧹 Sanitized options:',
          JSON.stringify(sanitizedOptions, null, 2)
        )

        const response = await claudeClient.sendMessage(
          prompt,
          sanitizedOptions
        )

        console.log('✅ tRPC: Claude API request completed')
        return {
          success: true,
          data: response,
        }
      } catch (error) {
        console.error('❌ tRPC: Claude API error:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get Claude response',
          cause: error,
        })
      }
    }),

  /**
   * Stream a message to Claude API (for future real-time features)
   */
  streamMessage: publicProcedure
    .input(claudeStreamSchema)
    .mutation(async ({ input }) => {
      try {
        console.log('🔄 tRPC: Starting Claude API stream...')

        const { prompt, options = {} } = input

        // For now, we'll use the regular sendMessage since tRPC doesn't handle streams easily
        // In the future, we can implement WebSocket streaming
        const response = await claudeClient.sendMessage(prompt, options)

        console.log('✅ tRPC: Claude API stream completed')
        return {
          success: true,
          data: response,
          streaming: false, // Indicate this was not actually streamed
        }
      } catch (error) {
        console.error('❌ tRPC: Claude API stream error:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to stream Claude response',
          cause: error,
        })
      }
    }),

  /**
   * Test Claude API connection
   */
  test: publicProcedure.mutation(async () => {
    try {
      console.log('🔧 tRPC: Testing Claude API connection...')

      const testResponse = await claudeClient.sendMessage(
        'Respond with "Connection test successful" to confirm the API is working.',
        {
          maxTokens: 50,
          captureToDatabase: false, // Don't store test messages
        }
      )

      console.log('✅ tRPC: Claude API test completed')
      return {
        success: true,
        message: 'Claude API connection successful',
        details: {
          responseId: testResponse.id,
          model: testResponse.model,
          tokensUsed:
            testResponse.usage.input_tokens + testResponse.usage.output_tokens,
          responseText:
            testResponse.content.find((c) => c.type === 'text')?.text || '',
        },
      }
    } catch (error) {
      console.error('❌ tRPC: Claude API test failed:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Claude API test failed',
        cause: error,
      })
    }
  }),

  /**
   * Get Claude API status and models
   */
  status: publicProcedure.query(async () => {
    try {
      const hasApiKey = !!process.env.ANTHROPIC_API_KEY

      return {
        connected: hasApiKey,
        apiKeyConfigured: hasApiKey,
        availableModels: [
          'claude-sonnet-4-20250514',
          'claude-3-5-sonnet-20241022', // deprecated
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307',
        ],
        defaultModel: 'claude-sonnet-4-20250514',
        estimatedCost: {
          inputPer1K: 0.003,
          outputPer1K: 0.015,
          currency: 'USD',
        },
      }
    } catch (error) {
      console.error('❌ tRPC: Failed to get Claude API status:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get Claude API status',
        cause: error,
      })
    }
  }),

  /**
   * Get usage statistics
   */
  usage: publicProcedure.query(async () => {
    try {
      // TODO: Implement usage tracking from database
      // For now, return placeholder data
      return {
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        requestsToday: 0,
        tokensToday: 0,
        costToday: 0,
        averageResponseTime: 0,
        successRate: 100,
      }
    } catch (error) {
      console.error('❌ tRPC: Failed to get usage statistics:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get usage statistics',
        cause: error,
      })
    }
  }),
})
