/**
 * Conversation Capture Service
 *
 * This service handles capturing Claude Code conversations and storing them
 * in the database for later search and analysis.
 */

import { randomUUID } from 'crypto'
import {
  createUser,
  createSession,
  createMessage,
  getOrCreateUser,
} from '../db/queries'
import type { NewSession, NewMessage } from '../db/schema'

export interface ConversationMetadata {
  source: 'claude-code' | 'manual' | 'import'
  timestamp: string
  sessionInfo?: {
    projectPath?: string
    gitBranch?: string
    workingDirectory?: string
  }
  performance?: {
    totalTokens?: number
    totalCost?: number
    duration?: number
  }
}

export interface MessageData {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
  tokens?: number
  costUsd?: string
  metadata?: Record<string, any>
}

export interface ConversationData {
  title?: string
  messages: MessageData[]
  metadata?: ConversationMetadata
  claudeSessionId?: string
}

/**
 * Main conversation capture service
 */
export class ConversationCapture {
  private username: string

  constructor(username: string = 'default-user') {
    this.username = username
  }

  /**
   * Capture a complete conversation and store it in the database
   */
  async captureConversation(data: ConversationData): Promise<string> {
    try {
      // Ensure user exists
      const user = await getOrCreateUser(this.username)

      // Generate session title if not provided
      const title = data.title || this.generateTitle(data.messages)

      // Create session
      const sessionData: NewSession = {
        userId: user.id,
        claudeSessionId: data.claudeSessionId || randomUUID(),
        title,
        metadata: data.metadata || {},
      }

      const session = await createSession(sessionData)

      // Store all messages
      const messagePromises = data.messages.map(async (msgData) => {
        const messageData: NewMessage = {
          sessionId: session.id,
          role: msgData.role,
          content: msgData.content,
          tokens: msgData.tokens,
          costUsd: msgData.costUsd,
          metadata: msgData.metadata || {},
        }

        return createMessage(messageData)
      })

      await Promise.all(messagePromises)

      console.log(
        `✅ Captured conversation: ${title} (${data.messages.length} messages)`
      )
      return session.id
    } catch (error) {
      console.error('❌ Failed to capture conversation:', error)
      throw error
    }
  }

  /**
   * Capture a single message and add it to an existing session
   */
  async captureMessage(
    sessionId: string,
    messageData: MessageData
  ): Promise<void> {
    try {
      const newMessage: NewMessage = {
        sessionId,
        role: messageData.role,
        content: messageData.content,
        tokens: messageData.tokens,
        costUsd: messageData.costUsd,
        metadata: messageData.metadata || {},
      }

      await createMessage(newMessage)
      console.log(
        `✅ Captured message: ${messageData.role} - ${messageData.content.substring(0, 50)}...`
      )
    } catch (error) {
      console.error('❌ Failed to capture message:', error)
      throw error
    }
  }

  /**
   * Generate a meaningful title from conversation messages
   */
  private generateTitle(messages: MessageData[]): string {
    // Find the first substantial user message
    const firstUserMessage = messages.find(
      (msg) => msg.role === 'user' && msg.content.length > 10
    )

    if (firstUserMessage) {
      // Extract first sentence or up to 50 characters
      const content = firstUserMessage.content.trim()
      const firstSentence = content.split(/[.!?]/)[0]
      return firstSentence.length > 50
        ? content.substring(0, 47) + '...'
        : firstSentence
    }

    // Fallback to timestamp-based title
    return `Conversation ${new Date().toLocaleDateString()}`
  }

  /**
   * Parse Claude Code session output and extract conversation data
   */
  parseClaudeOutput(output: string): ConversationData {
    // This is a placeholder for parsing Claude Code output
    // Implementation will depend on the specific format of Claude Code logs/output

    const lines = output.split('\n')
    const messages: MessageData[] = []

    // Basic parsing logic - this will need to be enhanced based on actual format
    let currentMessage = ''
    let currentRole: 'user' | 'assistant' | 'system' = 'user'

    for (const line of lines) {
      if (line.trim().startsWith('user:')) {
        if (currentMessage) {
          messages.push({
            role: currentRole,
            content: currentMessage.trim(),
          })
        }
        currentRole = 'user'
        currentMessage = line.replace(/^user:\s*/, '')
      } else if (line.trim().startsWith('assistant:')) {
        if (currentMessage) {
          messages.push({
            role: currentRole,
            content: currentMessage.trim(),
          })
        }
        currentRole = 'assistant'
        currentMessage = line.replace(/^assistant:\s*/, '')
      } else {
        currentMessage += '\n' + line
      }
    }

    // Add final message
    if (currentMessage) {
      messages.push({
        role: currentRole,
        content: currentMessage.trim(),
      })
    }

    return {
      messages,
      metadata: {
        source: 'claude-code',
        timestamp: new Date().toISOString(),
      },
    }
  }
}

/**
 * Default instance for easy usage
 */
export const defaultCapture = new ConversationCapture()

/**
 * Convenience function for quick conversation capture
 */
export async function captureConversation(
  data: ConversationData
): Promise<string> {
  return defaultCapture.captureConversation(data)
}

/**
 * Convenience function for capturing a single message
 */
export async function captureMessage(
  sessionId: string,
  messageData: MessageData
): Promise<void> {
  return defaultCapture.captureMessage(sessionId, messageData)
}
