/**
 * Claude Code Proxy
 *
 * A comprehensive wrapper/proxy for Claude Code that captures conversations
 * in real-time with full metadata, tool calls, and performance analytics.
 */

import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { ClaudeInterceptor } from './claude-interceptor'
import { ClaudeMetadataParser, type ParsedSession } from './metadata-parser'
import { ToolCallTracker, type EnhancedToolCall } from './tool-tracker'
import { captureConversation } from './index'
import type { ConversationData } from './index'

export interface ProxyOptions {
  // Capture settings
  enableCapture?: boolean
  captureMode?: 'realtime' | 'post_session' | 'both'
  username?: string

  // Claude Code settings
  claudeArgs?: string[]
  outputFormat?: 'text' | 'json' | 'stream-json'
  verbose?: boolean

  // Database settings
  autoStore?: boolean
  sessionPrefix?: string

  // Analysis settings
  enableAnalytics?: boolean
  enableToolTracking?: boolean
}

export interface SessionSummary {
  sessionId: string
  arrakisSessionId?: string
  title: string
  startTime: string
  endTime: string
  duration: number
  cost: number
  messageCount: number
  toolCallsCount: number
  success: boolean
  metadata: ParsedSession
}

/**
 * Main Claude Code Proxy
 */
export class ClaudeProxy extends EventEmitter {
  private interceptor: ClaudeInterceptor
  private parser: ClaudeMetadataParser
  private toolTracker: ToolCallTracker
  private activeSessions: Map<string, SessionContext> = new Map()

  constructor() {
    super()
    this.interceptor = new ClaudeInterceptor()
    this.parser = new ClaudeMetadataParser()
    this.toolTracker = new ToolCallTracker()

    this.setupEventHandlers()
  }

  /**
   * Execute Claude Code command with full capture
   */
  async executeCommand(
    prompt: string,
    options: ProxyOptions = {}
  ): Promise<{ output: string; summary: SessionSummary }> {
    const opts = this.mergeDefaultOptions(options)

    console.log('🚀 Starting Claude Code proxy execution...')
    console.log(
      `📝 Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`
    )

    const sessionContext = new SessionContext()
    const sessionId = sessionContext.sessionId

    this.activeSessions.set(sessionId, sessionContext)

    try {
      // Build Claude Code command
      const claudeArgs = this.buildClaudeArgs(prompt, opts)

      // Start capture if enabled
      if (opts.enableCapture) {
        await this.startCapture(sessionId, claudeArgs, opts)
      }

      // Execute Claude Code
      const output = await this.runClaudeCommand(
        claudeArgs,
        sessionContext,
        opts
      )

      // Process session results
      const summary = await this.finalizeSession(sessionContext, opts)

      console.log('✅ Claude Code execution completed')
      console.log(
        `📊 Summary: ${summary.messageCount} messages, $${summary.cost}, ${summary.toolCallsCount} tool calls`
      )

      return { output, summary }
    } catch (error) {
      console.error('❌ Claude Code execution failed:', error)
      throw error
    } finally {
      this.activeSessions.delete(sessionId)
    }
  }

  /**
   * Resume existing Claude Code session
   */
  async resumeSession(
    sessionId: string,
    prompt: string,
    options: ProxyOptions = {}
  ): Promise<{ output: string; summary: SessionSummary }> {
    const opts = {
      ...options,
      claudeArgs: [...(options.claudeArgs || []), '--resume', sessionId],
    }
    return this.executeCommand(prompt, opts)
  }

  /**
   * Continue most recent Claude Code session
   */
  async continueSession(
    prompt: string,
    options: ProxyOptions = {}
  ): Promise<{ output: string; summary: SessionSummary }> {
    const opts = {
      ...options,
      claudeArgs: [...(options.claudeArgs || []), '--continue'],
    }
    return this.executeCommand(prompt, opts)
  }

  /**
   * Analyze existing session data
   */
  async analyzeSession(sessionJsonData: string): Promise<ParsedSession> {
    return this.parser.parseFromJsonString(sessionJsonData)
  }

  /**
   * Get session statistics
   */
  getSessionStatistics(): {
    totalSessions: number
    activeSessions: number
    toolCallStats: ReturnType<ToolCallTracker['getStatistics']>
  } {
    return {
      totalSessions: this.activeSessions.size,
      activeSessions: this.activeSessions.size,
      toolCallStats: this.toolTracker.getStatistics(),
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers() {
    this.interceptor.on('message', ({ message, context }) => {
      // Track tool calls in real-time
      const newToolCalls = this.toolTracker.processMessage(message)
      if (newToolCalls.length > 0) {
        this.emit('tool_calls', {
          toolCalls: newToolCalls,
          sessionId: context.claudeSessionId,
        })
      }

      // Emit message events
      this.emit('claude_message', {
        message,
        sessionId: context.claudeSessionId,
      })
    })

    this.interceptor.on('session_complete', ({ sessionId, context }) => {
      this.emit('session_complete', { sessionId, context })
    })

    this.interceptor.on('session_error', ({ error, context }) => {
      this.emit('session_error', { error, context })
    })
  }

  /**
   * Start capture for session
   */
  private async startCapture(
    sessionId: string,
    claudeArgs: string[],
    options: ProxyOptions
  ) {
    if (options.captureMode === 'realtime' || options.captureMode === 'both') {
      // Real-time capture via interceptor
      await this.interceptor.interceptSession(claudeArgs)
    }
  }

  /**
   * Run Claude Code command
   */
  private async runClaudeCommand(
    args: string[],
    context: SessionContext,
    options: ProxyOptions
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const claudeProcess = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env,
      })

      let output = ''
      let errorOutput = ''

      claudeProcess.stdout?.on('data', (data) => {
        const chunk = data.toString()
        output += chunk

        // Parse JSON messages if in stream mode
        if (options.outputFormat === 'stream-json') {
          this.parseStreamingOutput(chunk, context)
        }
      })

      claudeProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString()
      })

      claudeProcess.on('close', (code) => {
        context.endTime = new Date()
        context.exitCode = code || 1
        context.output = output
        context.errorOutput = errorOutput

        if (code === 0) {
          resolve(output)
        } else {
          reject(
            new Error(`Claude Code exited with code ${code}: ${errorOutput}`)
          )
        }
      })

      claudeProcess.on('error', (error) => {
        reject(error)
      })

      // Send prompt if provided directly
      if (args.includes('-p') || args.includes('--print')) {
        claudeProcess.stdin?.end()
      }
    })
  }

  /**
   * Parse streaming JSON output
   */
  private parseStreamingOutput(data: string, context: SessionContext) {
    const lines = data.split('\n').filter((line) => line.trim())

    for (const line of lines) {
      try {
        const message = JSON.parse(line)
        context.messages.push(message)

        // Track tool calls
        const toolCalls = this.toolTracker.processMessage(message)
        context.toolCalls.push(...toolCalls)

        this.emit('streaming_message', { message, context })
      } catch (error) {
        // Skip non-JSON lines
      }
    }
  }

  /**
   * Finalize session and create summary
   */
  private async finalizeSession(
    context: SessionContext,
    options: ProxyOptions
  ): Promise<SessionSummary> {
    const duration = context.endTime.getTime() - context.startTime.getTime()

    let parsedSession: ParsedSession | null = null
    let arrakisSessionId: string | undefined

    // Parse session metadata if we have JSON data
    if (context.messages.length > 0) {
      try {
        parsedSession = this.parser.parseSession(context.messages)
      } catch (error) {
        console.warn('Failed to parse session metadata:', error)
      }
    }

    // Store in database if enabled
    if (options.autoStore && parsedSession) {
      try {
        const conversationData: ConversationData = {
          title: parsedSession.title,
          claudeSessionId: parsedSession.sessionId,
          messages: parsedSession.messages.map((m) => ({
            role: m.type as 'user' | 'assistant',
            content: m.content,
            timestamp: m.timestamp,
            metadata: m.metadata,
          })),
          metadata: {
            source: 'claude-code',
            timestamp: context.startTime.toISOString(),
            sessionInfo: {
              projectPath: parsedSession.environment.cwd,
              workingDirectory: parsedSession.environment.cwd,
            },
            performance: {
              totalTokens: parsedSession.performance.totalTokens,
              totalCost: parsedSession.performance.totalCost,
              duration: duration,
            },
          },
        }

        arrakisSessionId = await captureConversation(conversationData)
        console.log(`💾 Stored session in Arrakis: ${arrakisSessionId}`)
      } catch (error) {
        console.error('Failed to store session in database:', error)
      }
    }

    const summary: SessionSummary = {
      sessionId: context.sessionId,
      arrakisSessionId,
      title: parsedSession?.title || 'Claude Code Session',
      startTime: context.startTime.toISOString(),
      endTime: context.endTime.toISOString(),
      duration,
      cost: parsedSession?.performance.totalCost || 0,
      messageCount: parsedSession?.conversation.messageCount || 0,
      toolCallsCount: context.toolCalls.length,
      success: context.exitCode === 0,
      metadata: parsedSession || ({} as ParsedSession),
    }

    return summary
  }

  /**
   * Build Claude Code arguments
   */
  private buildClaudeArgs(prompt: string, options: ProxyOptions): string[] {
    const args: string[] = []

    // Add print mode for non-interactive execution
    args.push('--print')

    // Add prompt
    args.push(prompt)

    // Add output format
    if (options.outputFormat) {
      args.push('--output-format', options.outputFormat)
    } else if (options.enableCapture) {
      args.push('--output-format', 'stream-json')
    }

    // Add verbose mode
    if (options.verbose) {
      args.push('--verbose')
    }

    // Add custom args
    if (options.claudeArgs) {
      args.push(...options.claudeArgs)
    }

    return args
  }

  /**
   * Merge default options
   */
  private mergeDefaultOptions(options: ProxyOptions): Required<ProxyOptions> {
    return {
      enableCapture: true,
      captureMode: 'both',
      username: 'arrakis-user',
      claudeArgs: [],
      outputFormat: 'stream-json',
      verbose: false,
      autoStore: true,
      sessionPrefix: 'arrakis',
      enableAnalytics: true,
      enableToolTracking: true,
      ...options,
    }
  }
}

/**
 * Session context for tracking execution
 */
class SessionContext {
  sessionId: string = new Date().getTime().toString()
  startTime: Date = new Date()
  endTime: Date = new Date()
  exitCode: number = 0
  output: string = ''
  errorOutput: string = ''
  messages: any[] = []
  toolCalls: EnhancedToolCall[] = []
}

/**
 * Default proxy instance
 */
export const defaultProxy = new ClaudeProxy()

/**
 * Convenience functions
 */
export async function executeClaudeCommand(
  prompt: string,
  options?: ProxyOptions
) {
  return defaultProxy.executeCommand(prompt, options)
}

export async function resumeClaudeSession(
  sessionId: string,
  prompt: string,
  options?: ProxyOptions
) {
  return defaultProxy.resumeSession(sessionId, prompt, options)
}

export async function continueClaudeSession(
  prompt: string,
  options?: ProxyOptions
) {
  return defaultProxy.continueSession(prompt, options)
}
