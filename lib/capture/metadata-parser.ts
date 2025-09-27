/**
 * Claude Code Metadata Parser
 *
 * Parses and extracts rich metadata from Claude Code JSON sessions,
 * including tool calls, performance metrics, and conversation context.
 */

import type {
  ClaudeMessage,
  ClaudeAssistantMessage,
  ClaudeUserMessage,
  ClaudeSystemMessage,
  ClaudeResultMessage,
} from './claude-interceptor'

export interface ParsedSession {
  // Basic session info
  sessionId: string
  title: string
  duration: {
    totalMs: number
    apiMs: number
    startTime: string
    endTime: string
  }

  // Performance metrics
  performance: {
    totalCost: number
    inputTokens: number
    outputTokens: number
    totalTokens: number
    costPerToken: number
    turnsCount: number
    isError: boolean
  }

  // Environment context
  environment: {
    model: string
    cwd: string
    apiKeySource: string
    permissionMode: string
    outputStyle: string
    enabledTools: string[]
    mcpServers: Array<{ name: string; status: string }>
    slashCommands: string[]
  }

  // Tool usage analysis
  toolUsage: {
    toolCalls: ToolCall[]
    permissionDenials: PermissionDenial[]
    toolFrequency: Record<string, number>
    successRate: number
  }

  // Conversation analysis
  conversation: {
    messageCount: number
    userMessages: number
    assistantMessages: number
    averageMessageLength: number
    topics: string[]
    codeBlocks: CodeBlock[]
  }

  // Raw messages
  messages: ParsedMessage[]
}

export interface ParsedMessage {
  uuid: string
  type: 'user' | 'assistant' | 'system'
  timestamp: string
  content: string
  toolCalls?: ToolCall[]
  metadata: Record<string, any>
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, any>
  result?: any
  error?: string
  duration?: number
  success: boolean
}

export interface PermissionDenial {
  toolName: string
  toolUseId: string
  toolInput: Record<string, unknown>
  reason?: string
}

export interface CodeBlock {
  language: string
  code: string
  lineCount: number
  context: string
}

/**
 * Main metadata parser class
 */
export class ClaudeMetadataParser {
  /**
   * Parse a complete Claude Code session from JSON messages
   */
  parseSession(messages: ClaudeMessage[]): ParsedSession {
    const systemMessage = messages.find((m) => m.type === 'system') as
      | ClaudeSystemMessage
      | undefined
    const resultMessage = messages.find((m) => m.type === 'result') as
      | ClaudeResultMessage
      | undefined
    const conversationMessages = messages.filter(
      (m) => m.type === 'user' || m.type === 'assistant'
    )

    if (!systemMessage) {
      throw new Error('No system init message found in session')
    }

    const sessionId = systemMessage.session_id
    const parsedMessages = this.parseMessages(conversationMessages)
    const toolUsage = this.analyzeToolUsage(
      parsedMessages,
      (resultMessage?.permission_denials || []).map((denial) => ({
        toolName: denial.tool_name,
        toolUseId: denial.tool_use_id,
        toolInput: denial.tool_input,
      }))
    )
    const conversation = this.analyzeConversation(parsedMessages)

    return {
      sessionId,
      title: this.generateTitle(parsedMessages),

      duration: {
        totalMs: resultMessage?.duration_ms || 0,
        apiMs: resultMessage?.duration_api_ms || 0,
        startTime: new Date().toISOString(), // Would need to track this properly
        endTime: new Date().toISOString(),
      },

      performance: {
        totalCost: resultMessage?.total_cost_usd || 0,
        inputTokens: resultMessage?.usage?.input_tokens || 0,
        outputTokens: resultMessage?.usage?.output_tokens || 0,
        totalTokens:
          (resultMessage?.usage?.input_tokens || 0) +
          (resultMessage?.usage?.output_tokens || 0),
        costPerToken: this.calculateCostPerToken(resultMessage),
        turnsCount: resultMessage?.num_turns || 0,
        isError: resultMessage?.is_error || false,
      },

      environment: {
        model: systemMessage.model,
        cwd: systemMessage.cwd,
        apiKeySource: systemMessage.apiKeySource,
        permissionMode: systemMessage.permissionMode,
        outputStyle: systemMessage.output_style,
        enabledTools: systemMessage.tools,
        mcpServers: systemMessage.mcp_servers,
        slashCommands: systemMessage.slash_commands,
      },

      toolUsage,
      conversation,
      messages: parsedMessages,
    }
  }

  /**
   * Parse individual messages and extract metadata
   */
  private parseMessages(
    messages: (ClaudeUserMessage | ClaudeAssistantMessage)[]
  ): ParsedMessage[] {
    return messages.map((msg) => {
      const baseMessage: ParsedMessage = {
        uuid: msg.uuid,
        type: msg.type as 'user' | 'assistant',
        timestamp: new Date().toISOString(), // Would extract from actual timestamp
        content: this.extractTextContent(msg.message.content),
        metadata: {
          parent_tool_use_id: msg.parent_tool_use_id,
          raw_content: msg.message.content,
        },
      }

      // Extract tool calls for assistant messages
      if (msg.type === 'assistant') {
        const toolCalls = this.extractToolCalls(msg as ClaudeAssistantMessage)
        if (toolCalls.length > 0) {
          baseMessage.toolCalls = toolCalls
        }
      }

      return baseMessage
    })
  }

  /**
   * Extract text content from message content array
   */
  private extractTextContent(content: Array<any>): string {
    return content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n')
      .trim()
  }

  /**
   * Extract tool calls from assistant messages
   */
  private extractToolCalls(msg: ClaudeAssistantMessage): ToolCall[] {
    return msg.message.content
      .filter((c) => c.type === 'tool_use')
      .map((c) => ({
        id: c.id || 'unknown',
        name: c.name || 'unknown',
        input: c.input || {},
        success: true, // Would need to track results
      }))
  }

  /**
   * Analyze tool usage patterns
   */
  private analyzeToolUsage(
    messages: ParsedMessage[],
    denials: PermissionDenial[]
  ): {
    toolCalls: ToolCall[]
    permissionDenials: PermissionDenial[]
    toolFrequency: Record<string, number>
    successRate: number
  } {
    const allToolCalls = messages.flatMap((m) => m.toolCalls || [])
    const toolFrequency: Record<string, number> = {}

    allToolCalls.forEach((call) => {
      toolFrequency[call.name] = (toolFrequency[call.name] || 0) + 1
    })

    const successfulCalls = allToolCalls.filter((call) => call.success).length
    const successRate =
      allToolCalls.length > 0 ? successfulCalls / allToolCalls.length : 1

    return {
      toolCalls: allToolCalls,
      permissionDenials: denials,
      toolFrequency,
      successRate,
    }
  }

  /**
   * Analyze conversation patterns
   */
  private analyzeConversation(messages: ParsedMessage[]): {
    messageCount: number
    userMessages: number
    assistantMessages: number
    averageMessageLength: number
    topics: string[]
    codeBlocks: CodeBlock[]
  } {
    const userMessages = messages.filter((m) => m.type === 'user').length
    const assistantMessages = messages.filter(
      (m) => m.type === 'assistant'
    ).length

    const totalLength = messages.reduce((sum, m) => sum + m.content.length, 0)
    const averageMessageLength =
      messages.length > 0 ? totalLength / messages.length : 0

    const codeBlocks = this.extractCodeBlocks(messages)
    const topics = this.extractTopics(messages)

    return {
      messageCount: messages.length,
      userMessages,
      assistantMessages,
      averageMessageLength,
      topics,
      codeBlocks,
    }
  }

  /**
   * Extract code blocks from conversation
   */
  private extractCodeBlocks(messages: ParsedMessage[]): CodeBlock[] {
    const codeBlocks: CodeBlock[] = []
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g

    messages.forEach((msg) => {
      let match
      while ((match = codeBlockRegex.exec(msg.content)) !== null) {
        const language = match[1] || 'unknown'
        const code = match[2].trim()
        const lineCount = code.split('\n').length

        codeBlocks.push({
          language,
          code,
          lineCount,
          context: msg.content.substring(
            Math.max(0, match.index - 100),
            match.index
          ),
        })
      }
    })

    return codeBlocks
  }

  /**
   * Extract topics/keywords from conversation
   */
  private extractTopics(messages: ParsedMessage[]): string[] {
    // Simple keyword extraction - could be enhanced with NLP
    const text = messages
      .map((m) => m.content)
      .join(' ')
      .toLowerCase()
    const keywords = [
      'database',
      'api',
      'function',
      'error',
      'bug',
      'test',
      'deploy',
      'react',
      'typescript',
      'javascript',
      'python',
      'sql',
      'docker',
      'git',
      'github',
      'npm',
      'yarn',
      'webpack',
      'next.js',
      'express',
    ]

    return keywords.filter((keyword) => text.includes(keyword))
  }

  /**
   * Calculate cost per token
   */
  private calculateCostPerToken(
    resultMessage: ClaudeResultMessage | undefined
  ): number {
    if (!resultMessage?.usage || !resultMessage.total_cost_usd) return 0

    const totalTokens =
      resultMessage.usage.input_tokens + resultMessage.usage.output_tokens
    return totalTokens > 0 ? resultMessage.total_cost_usd / totalTokens : 0
  }

  /**
   * Generate session title from content
   */
  private generateTitle(messages: ParsedMessage[]): string {
    const firstUserMessage = messages.find((m) => m.type === 'user')

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
   * Parse session from raw JSON string
   */
  parseFromJsonString(jsonData: string): ParsedSession {
    const lines = jsonData.split('\n').filter((line) => line.trim())
    const messages: ClaudeMessage[] = []

    for (const line of lines) {
      try {
        const message = JSON.parse(line) as ClaudeMessage
        messages.push(message)
      } catch (error) {
        console.warn('Failed to parse JSON line:', line.substring(0, 100))
      }
    }

    return this.parseSession(messages)
  }
}

/**
 * Default parser instance
 */
export const defaultParser = new ClaudeMetadataParser()

/**
 * Convenience function for parsing sessions
 */
export function parseClaudeSession(messages: ClaudeMessage[]): ParsedSession {
  return defaultParser.parseSession(messages)
}

/**
 * Parse from JSON string
 */
export function parseClaudeSessionFromJson(jsonData: string): ParsedSession {
  return defaultParser.parseFromJsonString(jsonData)
}
