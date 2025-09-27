/**
 * Claude Code Session Interceptor
 *
 * This service intercepts and captures Claude Code conversations in real-time,
 * preserving all rich JSON metadata including tool calls, costs, and context.
 */

import { spawn, type ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { captureConversation, captureMessage } from './index'
import type { ConversationData, MessageData } from './index'

// Claude Code Message Types (based on SDK documentation)
export interface ClaudeAssistantMessage {
  type: 'assistant'
  uuid: string
  session_id: string
  message: {
    role: 'assistant'
    content: Array<{
      type: 'text' | 'tool_use'
      text?: string
      id?: string
      name?: string
      input?: Record<string, any>
    }>
  }
  parent_tool_use_id: string | null
}

export interface ClaudeUserMessage {
  type: 'user'
  uuid: string
  session_id: string
  message: {
    role: 'user'
    content: Array<{
      type: 'text' | 'tool_result'
      text?: string
      tool_use_id?: string
      content?: any
    }>
  }
  parent_tool_use_id: string | null
}

export interface ClaudeSystemMessage {
  type: 'system'
  subtype: 'init'
  uuid: string
  session_id: string
  apiKeySource: string
  cwd: string
  tools: string[]
  mcp_servers: Array<{ name: string; status: string }>
  model: string
  permissionMode: string
  slash_commands: string[]
  output_style: string
}

export interface ClaudeResultMessage {
  type: 'result'
  subtype: 'success' | 'error_max_turns' | 'error_during_execution'
  uuid: string
  session_id: string
  duration_ms: number
  duration_api_ms: number
  is_error: boolean
  num_turns: number
  result?: string
  total_cost_usd: number
  usage: {
    input_tokens: number
    output_tokens: number
  }
  permission_denials: Array<{
    tool_name: string
    tool_use_id: string
    tool_input: Record<string, unknown>
  }>
}

export type ClaudeMessage =
  | ClaudeAssistantMessage
  | ClaudeUserMessage
  | ClaudeSystemMessage
  | ClaudeResultMessage

/**
 * Claude Code Session Interceptor
 */
export class ClaudeInterceptor extends EventEmitter {
  private sessions: Map<string, SessionContext> = new Map()
  private currentProcess: ChildProcess | null = null

  constructor() {
    super()
  }

  /**
   * Start intercepting a Claude Code session
   */
  async interceptSession(args: string[] = []): Promise<string> {
    const sessionId = randomUUID()

    // Ensure we capture JSON output
    const claudeArgs = [...args, '--output-format', 'stream-json', '--verbose']

    console.log('🎯 Starting Claude Code interception:', claudeArgs.join(' '))

    const claudeProcess = spawn('claude', claudeArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    })

    this.currentProcess = claudeProcess
    const context = new SessionContext(sessionId)
    this.sessions.set(sessionId, context)

    // Handle JSON stream output
    claudeProcess.stdout?.on('data', (data) => {
      this.parseClaudeOutput(data.toString(), context)
    })

    // Handle errors
    claudeProcess.stderr?.on('data', (data) => {
      console.error('Claude Code stderr:', data.toString())
    })

    // Handle process exit
    claudeProcess.on('close', async (code) => {
      console.log(`Claude Code process exited with code ${code}`)
      await this.finalizeSession(context)
    })

    return sessionId
  }

  /**
   * Parse Claude Code JSON output stream
   */
  private parseClaudeOutput(data: string, context: SessionContext) {
    const lines = data.split('\n').filter((line) => line.trim())

    for (const line of lines) {
      try {
        const message: ClaudeMessage = JSON.parse(line)
        this.processMessage(message, context)
      } catch (error) {
        // Skip non-JSON lines (may be regular output)
        if (line.trim() && !line.includes('Query:')) {
          console.log('Non-JSON output:', line)
        }
      }
    }
  }

  /**
   * Process individual Claude messages
   */
  private processMessage(message: ClaudeMessage, context: SessionContext) {
    console.log(
      `📨 Processing ${message.type} message:`,
      message.uuid || 'no-uuid'
    )

    switch (message.type) {
      case 'system':
        if (message.subtype === 'init') {
          context.initMessage = message
          context.claudeSessionId = message.session_id
        }
        break

      case 'user':
        context.messages.push(this.convertUserMessage(message))
        break

      case 'assistant':
        context.messages.push(this.convertAssistantMessage(message))
        break

      case 'result':
        context.resultMessage = message
        context.isComplete = true
        break
    }

    // Emit event for real-time processing
    this.emit('message', { message, context })
  }

  /**
   * Convert Claude user message to our format
   */
  private convertUserMessage(msg: ClaudeUserMessage): MessageData {
    const textContent = msg.message.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n')

    return {
      role: 'user',
      content: textContent,
      timestamp: new Date().toISOString(),
      metadata: {
        uuid: msg.uuid,
        parent_tool_use_id: msg.parent_tool_use_id,
        raw_content: msg.message.content,
      },
    }
  }

  /**
   * Convert Claude assistant message to our format
   */
  private convertAssistantMessage(msg: ClaudeAssistantMessage): MessageData {
    const textContent = msg.message.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n')

    const toolCalls = msg.message.content.filter((c) => c.type === 'tool_use')

    return {
      role: 'assistant',
      content: textContent,
      timestamp: new Date().toISOString(),
      metadata: {
        uuid: msg.uuid,
        parent_tool_use_id: msg.parent_tool_use_id,
        tool_calls: toolCalls,
        raw_content: msg.message.content,
      },
    }
  }

  /**
   * Finalize and store session when complete
   */
  private async finalizeSession(context: SessionContext) {
    if (!context.isComplete || !context.resultMessage) {
      console.warn('⚠️ Session incomplete, storing partial data')
    }

    const conversationData: ConversationData = {
      title: this.generateSessionTitle(context),
      claudeSessionId: context.claudeSessionId,
      messages: context.messages,
      metadata: {
        source: 'claude-code',
        timestamp: new Date().toISOString(),
        sessionInfo: context.initMessage
          ? {
              projectPath: context.initMessage.cwd,
              workingDirectory: context.initMessage.cwd,
            }
          : undefined,
        performance: context.resultMessage
          ? {
              totalTokens:
                context.resultMessage.usage.input_tokens +
                context.resultMessage.usage.output_tokens,
              totalCost: context.resultMessage.total_cost_usd,
              duration: context.resultMessage.duration_ms,
            }
          : undefined,
      },
    }

    try {
      const sessionId = await captureConversation(conversationData)
      console.log(`✅ Captured Claude Code session: ${sessionId}`)
      console.log(
        `📊 Stats: ${context.messages.length} messages, $${context.resultMessage?.total_cost_usd || 0}`
      )

      this.emit('session_complete', { sessionId, context })
    } catch (error) {
      console.error('❌ Failed to store session:', error)
      this.emit('session_error', { error, context })
    }

    // Cleanup
    this.sessions.delete(context.arrakisSessionId)
  }

  /**
   * Generate meaningful session title
   */
  private generateSessionTitle(context: SessionContext): string {
    if (context.messages.length === 0) {
      return 'Empty Claude Code Session'
    }

    const firstUserMessage = context.messages.find((m) => m.role === 'user')
    if (firstUserMessage && firstUserMessage.content.length > 10) {
      const content = firstUserMessage.content.trim()
      const firstSentence = content.split(/[.!?]/)[0]
      return firstSentence.length > 50
        ? content.substring(0, 47) + '...'
        : firstSentence
    }

    return `Claude Code Session ${new Date().toLocaleDateString()}`
  }

  /**
   * Stop current interception
   */
  stop() {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM')
      this.currentProcess = null
    }
  }
}

/**
 * Session context for tracking conversation state
 */
class SessionContext {
  arrakisSessionId: string
  claudeSessionId: string = ''
  messages: MessageData[] = []
  initMessage: ClaudeSystemMessage | null = null
  resultMessage: ClaudeResultMessage | null = null
  isComplete: boolean = false

  constructor(arrakisSessionId: string) {
    this.arrakisSessionId = arrakisSessionId
  }
}

/**
 * Default interceptor instance
 */
export const defaultInterceptor = new ClaudeInterceptor()

/**
 * Convenience function to start interception
 */
export async function interceptClaudeSession(
  args: string[] = []
): Promise<string> {
  return defaultInterceptor.interceptSession(args)
}
