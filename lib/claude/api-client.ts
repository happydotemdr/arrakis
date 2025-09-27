/**
 * Real Claude API Client
 * Handles direct integration with Anthropic's Claude API
 */

import Anthropic from '@anthropic-ai/sdk'
import { captureConversation } from '../capture'
import type { ConversationData } from '../capture'

export interface ClaudeMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ClaudeResponse {
  id: string
  model: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
  content: Array<{
    type: string
    text?: string
    name?: string
    input?: any
  }>
  stop_reason: string
  timestamp: string
}

export interface ClaudeStreamChunk {
  type: 'text' | 'tool_use' | 'usage' | 'complete'
  content?: string
  toolCall?: any
  usage?: {
    input_tokens: number
    output_tokens: number
  }
}

export interface ClaudeAPIOptions {
  model?: string
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
  stream?: boolean
  captureToDatabase?: boolean
  username?: string
}

export class ClaudeAPIClient {
  private client: Anthropic
  private defaultModel = 'claude-sonnet-4-20250514'

  constructor() {
    // Explicitly use the API key from environment, prioritizing .env.local
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required')
    }

    console.log(
      '🔑 Using Anthropic API key from environment:',
      apiKey.substring(0, 20) + '...'
    )

    this.client = new Anthropic({
      apiKey,
      // Explicitly set to avoid any local Claude desktop interference
      baseURL: 'https://api.anthropic.com',
    })
  }

  /**
   * Send a message to Claude and get the response
   */
  async sendMessage(
    prompt: string,
    options: ClaudeAPIOptions = {}
  ): Promise<ClaudeResponse> {
    const {
      model = this.defaultModel,
      maxTokens = 4000,
      temperature = 0.7,
      systemPrompt,
      captureToDatabase = true,
      username = 'arrakis-user',
    } = options

    console.log('🤖 Sending message to Claude API...')
    console.log(
      `📝 Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`
    )

    try {
      // Build messages array
      const messages: Anthropic.MessageParam[] = [
        { role: 'user', content: prompt },
      ]

      // Make API call to Claude
      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt || this.getDefaultSystemPrompt(),
        messages,
      })

      // Transform response to our format
      const claudeResponse: ClaudeResponse = {
        id: response.id,
        model: response.model,
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        },
        content: response.content.map((block) => {
          if (block.type === 'text') {
            return {
              type: 'text',
              text: block.text,
            }
          } else if (block.type === 'tool_use') {
            return {
              type: 'tool_use',
              name: block.name,
              input: block.input,
            }
          }
          return { type: block.type }
        }),
        stop_reason: response.stop_reason || 'end_turn',
        timestamp: new Date().toISOString(),
      }

      console.log('✅ Claude API response received')
      console.log(
        `📊 Tokens: ${response.usage.input_tokens} in, ${response.usage.output_tokens} out`
      )

      // Auto-capture to database if enabled
      if (captureToDatabase) {
        await this.captureConversation(
          prompt,
          claudeResponse,
          username,
          systemPrompt
        )
      }

      return claudeResponse
    } catch (error) {
      console.error('❌ Claude API error:', error)
      throw new Error(
        `Claude API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Stream a message to Claude with real-time responses
   */
  async streamMessage(
    prompt: string,
    options: ClaudeAPIOptions = {},
    onChunk?: (chunk: ClaudeStreamChunk) => void
  ): Promise<ClaudeResponse> {
    const {
      model = this.defaultModel,
      maxTokens = 4000,
      temperature = 0.7,
      systemPrompt,
      captureToDatabase = true,
      username = 'arrakis-user',
    } = options

    console.log('🔄 Starting Claude API stream...')

    try {
      const messages: Anthropic.MessageParam[] = [
        { role: 'user', content: prompt },
      ]

      const stream = this.client.messages.stream({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt || this.getDefaultSystemPrompt(),
        messages,
      })

      let fullResponse = ''
      let usage = { input_tokens: 0, output_tokens: 0 }
      let responseId = ''
      let responseModel = model

      // Process stream chunks
      for await (const chunk of stream) {
        if (chunk.type === 'message_start') {
          responseId = chunk.message.id
          responseModel = chunk.message.model
          usage = chunk.message.usage
        } else if (chunk.type === 'content_block_delta') {
          if (chunk.delta.type === 'text_delta') {
            const textChunk = chunk.delta.text
            fullResponse += textChunk

            // Send chunk to callback if provided
            onChunk?.({
              type: 'text',
              content: textChunk,
            })
          }
        } else if (chunk.type === 'message_delta') {
          if (chunk.usage) {
            usage.output_tokens = chunk.usage.output_tokens
          }
        }
      }

      // Send completion notification
      onChunk?.({
        type: 'complete',
        usage,
      })

      // Build final response
      const claudeResponse: ClaudeResponse = {
        id: responseId,
        model: responseModel,
        usage,
        content: [
          {
            type: 'text',
            text: fullResponse,
          },
        ],
        stop_reason: 'end_turn',
        timestamp: new Date().toISOString(),
      }

      console.log('✅ Claude API stream completed')
      console.log(
        `📊 Tokens: ${usage.input_tokens} in, ${usage.output_tokens} out`
      )

      // Auto-capture to database if enabled
      if (captureToDatabase) {
        await this.captureConversation(
          prompt,
          claudeResponse,
          username,
          systemPrompt
        )
      }

      return claudeResponse
    } catch (error) {
      console.error('❌ Claude API stream error:', error)
      throw new Error(
        `Claude API stream failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Capture conversation to database
   */
  private async captureConversation(
    prompt: string,
    response: ClaudeResponse,
    username: string,
    systemPrompt?: string
  ): Promise<void> {
    try {
      const conversationData: ConversationData = {
        title: this.generateTitle(prompt),
        claudeSessionId: response.id,
        messages: [
          {
            role: 'user',
            content: prompt,
            timestamp: new Date(Date.now() - 1000).toISOString(), // 1 second before response
            metadata: {
              source: 'arrakis-demo',
              apiCall: true,
            },
          },
          {
            role: 'assistant',
            content:
              response.content.find((c) => c.type === 'text')?.text || '',
            timestamp: response.timestamp,
            metadata: {
              source: 'claude-api',
              modelUsed: response.model,
              stopReason: response.stop_reason,
              toolCalls: response.content.filter((c) => c.type === 'tool_use'),
            },
          },
        ],
        metadata: {
          source: 'manual',
          timestamp: response.timestamp,
          sessionInfo: {
            projectPath: process.cwd(),
            workingDirectory: process.cwd(),
          },
          performance: {
            totalTokens:
              response.usage.input_tokens + response.usage.output_tokens,
            totalCost: this.calculateCost(response.usage, response.model),
            duration: 0, // Will be calculated by capture system
          },
        },
      }

      const sessionId = await captureConversation(conversationData)
      console.log(`💾 Conversation captured to database: ${sessionId}`)
    } catch (error) {
      console.error('❌ Failed to capture conversation to database:', error)
      // Don't throw - capture failures shouldn't break the API call
    }
  }

  /**
   * Generate a title from the prompt
   */
  private generateTitle(prompt: string): string {
    // Take first 50 characters and clean up
    const title = prompt.trim().substring(0, 50).replace(/\n/g, ' ')
    return title.length < prompt.length ? `${title}...` : title
  }

  /**
   * Calculate approximate cost based on token usage
   */
  private calculateCost(
    usage: { input_tokens: number; output_tokens: number },
    model: string
  ): number {
    // Claude 3.5 Sonnet pricing (approximate)
    const inputCostPer1K = 0.003 // $3 per 1M tokens
    const outputCostPer1K = 0.015 // $15 per 1M tokens

    const inputCost = (usage.input_tokens / 1000) * inputCostPer1K
    const outputCost = (usage.output_tokens / 1000) * outputCostPer1K

    return Number((inputCost + outputCost).toFixed(6))
  }

  /**
   * Get default system prompt for Claude API calls
   */
  private getDefaultSystemPrompt(): string {
    return `You are Claude, an AI assistant created by Anthropic. You are being accessed through the Arrakis conversation capture system, which allows users to capture, search, and analyze AI conversations.

You should be helpful, harmless, and honest. Respond to the user's questions and requests in a clear and informative way.

Current context:
- Working directory: ${process.cwd()}
- Platform: ${process.platform}
- Date: ${new Date().toLocaleDateString()}

The user is testing the real Claude API integration through the Arrakis demo interface.`
  }
}

// Export default instance
export const claudeClient = new ClaudeAPIClient()
