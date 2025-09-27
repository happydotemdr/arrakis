/**
 * Tool Call Tracker
 *
 * Enhanced tracking and analysis of Claude Code tool calls and function executions,
 * including matching tool calls with their results and detailed execution analysis.
 */

import type {
  ClaudeMessage,
  ClaudeAssistantMessage,
  ClaudeUserMessage,
} from './claude-interceptor'

export interface EnhancedToolCall {
  // Basic info
  id: string
  name: string
  timestamp: string

  // Execution details
  input: Record<string, any>
  output?: any
  error?: string
  duration?: number
  success: boolean

  // Context
  messageUuid: string
  sessionId: string
  parentToolUseId?: string

  // Analysis
  category: ToolCategory
  complexity: 'simple' | 'medium' | 'complex'
  impact: 'low' | 'medium' | 'high'

  // Specific tool data
  fileOperations?: FileOperation[]
  bashCommands?: BashCommand[]
  searchQueries?: SearchQuery[]
}

export interface FileOperation {
  type: 'read' | 'write' | 'edit' | 'create' | 'delete'
  filePath: string
  content?: string
  changes?: {
    linesAdded: number
    linesRemoved: number
    size: number
  }
  success: boolean
  error?: string
}

export interface BashCommand {
  command: string
  output: string
  exitCode?: number
  duration?: number
  success: boolean
  error?: string
}

export interface SearchQuery {
  pattern: string
  type: 'text' | 'regex' | 'glob'
  resultsCount: number
  files: string[]
}

export type ToolCategory =
  | 'file_system'
  | 'code_execution'
  | 'search'
  | 'web_request'
  | 'database'
  | 'mcp_tool'
  | 'system'
  | 'unknown'

/**
 * Enhanced tool call tracker
 */
export class ToolCallTracker {
  private pendingToolCalls: Map<string, Partial<EnhancedToolCall>> = new Map()
  private completedToolCalls: EnhancedToolCall[] = []

  /**
   * Process a message and extract/track tool calls
   */
  processMessage(message: ClaudeMessage): EnhancedToolCall[] {
    const newCompletedCalls: EnhancedToolCall[] = []

    if (message.type === 'assistant') {
      // Track new tool calls
      const toolCalls = this.extractToolCalls(message as ClaudeAssistantMessage)
      for (const call of toolCalls) {
        if (call.id) {
          this.pendingToolCalls.set(call.id, call)
        }
      }
    } else if (message.type === 'user') {
      // Match tool results with pending calls
      const results = this.extractToolResults(message as ClaudeUserMessage)
      for (const result of results) {
        const pendingCall = this.pendingToolCalls.get(result.tool_use_id)
        if (pendingCall) {
          const completedCall = this.completeToolCall(pendingCall, result)
          if (completedCall) {
            this.completedToolCalls.push(completedCall)
            newCompletedCalls.push(completedCall)
            this.pendingToolCalls.delete(result.tool_use_id)
          }
        }
      }
    }

    return newCompletedCalls
  }

  /**
   * Extract tool calls from assistant messages
   */
  private extractToolCalls(
    message: ClaudeAssistantMessage
  ): Partial<EnhancedToolCall>[] {
    return message.message.content
      .filter((c) => c.type === 'tool_use')
      .map((c) => ({
        id: c.id!,
        name: c.name!,
        input: c.input || {},
        timestamp: new Date().toISOString(),
        messageUuid: message.uuid,
        sessionId: message.session_id,
        parentToolUseId: message.parent_tool_use_id || undefined,
        category: this.categorizeToolCall(c.name!),
        complexity: this.assessComplexity(c.name!, c.input || {}),
        impact: this.assessImpact(c.name!, c.input || {}),
      }))
  }

  /**
   * Extract tool results from user messages
   */
  private extractToolResults(
    message: ClaudeUserMessage
  ): Array<{ tool_use_id: string; content: any; error?: boolean }> {
    return message.message.content
      .filter((c) => c.type === 'tool_result')
      .map((c) => ({
        tool_use_id: c.tool_use_id!,
        content: c.content,
        error: (c as any).is_error || false,
      }))
  }

  /**
   * Complete a tool call by matching it with its result
   */
  private completeToolCall(
    pendingCall: Partial<EnhancedToolCall>,
    result: { tool_use_id: string; content: any; error?: boolean }
  ): EnhancedToolCall | null {
    if (!pendingCall.id || !pendingCall.name || !pendingCall.input) {
      return null
    }

    const completed: EnhancedToolCall = {
      ...(pendingCall as EnhancedToolCall),
      output: result.content,
      success: !result.error,
      error: result.error
        ? this.extractErrorMessage(result.content)
        : undefined,
    }

    // Add specific analysis based on tool type
    this.enhanceWithSpecificAnalysis(completed)

    return completed
  }

  /**
   * Enhance tool call with specific analysis based on tool type
   */
  private enhanceWithSpecificAnalysis(toolCall: EnhancedToolCall) {
    switch (toolCall.name.toLowerCase()) {
      case 'read':
        toolCall.fileOperations = this.analyzeFileRead(toolCall)
        break
      case 'write':
        toolCall.fileOperations = this.analyzeFileWrite(toolCall)
        break
      case 'edit':
        toolCall.fileOperations = this.analyzeFileEdit(toolCall)
        break
      case 'bash':
        toolCall.bashCommands = this.analyzeBashCommand(toolCall)
        break
      case 'grep':
      case 'glob':
        toolCall.searchQueries = this.analyzeSearchCommand(toolCall)
        break
    }
  }

  /**
   * Analyze file read operations
   */
  private analyzeFileRead(toolCall: EnhancedToolCall): FileOperation[] {
    const filePath =
      toolCall.input.file_path || toolCall.input.path || 'unknown'

    return [
      {
        type: 'read',
        filePath,
        success: toolCall.success,
        error: toolCall.error,
        changes: toolCall.output
          ? {
              linesAdded: 0,
              linesRemoved: 0,
              size:
                typeof toolCall.output === 'string'
                  ? toolCall.output.length
                  : 0,
            }
          : undefined,
      },
    ]
  }

  /**
   * Analyze file write operations
   */
  private analyzeFileWrite(toolCall: EnhancedToolCall): FileOperation[] {
    const filePath =
      toolCall.input.file_path || toolCall.input.path || 'unknown'
    const content = toolCall.input.content || ''

    return [
      {
        type: 'write',
        filePath,
        content,
        success: toolCall.success,
        error: toolCall.error,
        changes: {
          linesAdded: content.split('\n').length,
          linesRemoved: 0,
          size: content.length,
        },
      },
    ]
  }

  /**
   * Analyze file edit operations
   */
  private analyzeFileEdit(toolCall: EnhancedToolCall): FileOperation[] {
    const filePath =
      toolCall.input.file_path || toolCall.input.path || 'unknown'
    const oldString = toolCall.input.old_string || ''
    const newString = toolCall.input.new_string || ''

    const oldLines = oldString.split('\n').length
    const newLines = newString.split('\n').length

    return [
      {
        type: 'edit',
        filePath,
        success: toolCall.success,
        error: toolCall.error,
        changes: {
          linesAdded: Math.max(0, newLines - oldLines),
          linesRemoved: Math.max(0, oldLines - newLines),
          size: newString.length - oldString.length,
        },
      },
    ]
  }

  /**
   * Analyze bash command execution
   */
  private analyzeBashCommand(toolCall: EnhancedToolCall): BashCommand[] {
    const command = toolCall.input.command || 'unknown'
    const output =
      typeof toolCall.output === 'string'
        ? toolCall.output
        : JSON.stringify(toolCall.output || '')

    return [
      {
        command,
        output,
        success: toolCall.success,
        error: toolCall.error,
        exitCode: toolCall.success ? 0 : 1, // Simplified assumption
      },
    ]
  }

  /**
   * Analyze search commands
   */
  private analyzeSearchCommand(toolCall: EnhancedToolCall): SearchQuery[] {
    const pattern = toolCall.input.pattern || toolCall.input.query || 'unknown'
    const type = toolCall.name === 'grep' ? 'regex' : 'glob'

    let resultsCount = 0
    let files: string[] = []

    if (Array.isArray(toolCall.output)) {
      resultsCount = toolCall.output.length
      files = toolCall.output.map((item) =>
        typeof item === 'string' ? item : item.file || 'unknown'
      )
    }

    return [
      {
        pattern,
        type,
        resultsCount,
        files,
      },
    ]
  }

  /**
   * Categorize tool calls
   */
  private categorizeToolCall(toolName: string): ToolCategory {
    const name = toolName.toLowerCase()

    if (['read', 'write', 'edit', 'glob'].includes(name)) {
      return 'file_system'
    } else if (['bash'].includes(name)) {
      return 'code_execution'
    } else if (['grep', 'search'].includes(name)) {
      return 'search'
    } else if (['webfetch', 'websearch'].includes(name)) {
      return 'web_request'
    } else if (name.startsWith('mcp__')) {
      return 'mcp_tool'
    } else {
      return 'unknown'
    }
  }

  /**
   * Assess complexity of tool call
   */
  private assessComplexity(
    toolName: string,
    input: Record<string, any>
  ): 'simple' | 'medium' | 'complex' {
    const inputSize = JSON.stringify(input).length

    if (inputSize < 100) return 'simple'
    if (inputSize < 1000) return 'medium'
    return 'complex'
  }

  /**
   * Assess impact of tool call
   */
  private assessImpact(
    toolName: string,
    input: Record<string, any>
  ): 'low' | 'medium' | 'high' {
    const name = toolName.toLowerCase()

    if (['read', 'grep', 'glob'].includes(name)) {
      return 'low' // Read-only operations
    } else if (['edit'].includes(name)) {
      return 'medium' // Modifications
    } else if (['write', 'bash'].includes(name)) {
      return 'high' // Creation or execution
    }

    return 'medium'
  }

  /**
   * Extract error message from tool result
   */
  private extractErrorMessage(content: any): string {
    if (typeof content === 'string') {
      return content
    } else if (content && typeof content === 'object') {
      return content.error || content.message || JSON.stringify(content)
    }
    return 'Unknown error'
  }

  /**
   * Get all completed tool calls
   */
  getCompletedToolCalls(): EnhancedToolCall[] {
    return [...this.completedToolCalls]
  }

  /**
   * Get tool usage statistics
   */
  getStatistics(): {
    totalCalls: number
    successRate: number
    categoryBreakdown: Record<ToolCategory, number>
    complexityBreakdown: Record<string, number>
    topTools: Array<{ name: string; count: number }>
  } {
    const total = this.completedToolCalls.length
    const successful = this.completedToolCalls.filter((c) => c.success).length

    const categoryBreakdown = this.completedToolCalls.reduce(
      (acc, call) => {
        acc[call.category] = (acc[call.category] || 0) + 1
        return acc
      },
      {} as Record<ToolCategory, number>
    )

    const complexityBreakdown = this.completedToolCalls.reduce(
      (acc, call) => {
        acc[call.complexity] = (acc[call.complexity] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    const toolFrequency = this.completedToolCalls.reduce(
      (acc, call) => {
        acc[call.name] = (acc[call.name] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    const topTools = Object.entries(toolFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }))

    return {
      totalCalls: total,
      successRate: total > 0 ? successful / total : 1,
      categoryBreakdown,
      complexityBreakdown,
      topTools,
    }
  }

  /**
   * Reset tracker for new session
   */
  reset() {
    this.pendingToolCalls.clear()
    this.completedToolCalls = []
  }
}

/**
 * Default tracker instance
 */
export const defaultToolTracker = new ToolCallTracker()
