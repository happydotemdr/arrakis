/**
 * Claude Code Process Manager (System B)
 *
 * This service programmatically invokes Claude Code with full tool access,
 * allowing Claude to work directly on the Arrakis codebase as an AI developer.
 *
 * Part of the dual Claude strategy:
 * - System A: Basic Claude API (text only)
 * - System B: Claude Code SDK (full tools) <- THIS
 */

import { spawn, type ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { captureConversation } from '../capture'
import type { ConversationData } from '../capture'

export interface ClaudeCodeTask {
  id: string
  title: string
  prompt: string
  workingDirectory?: string
  timeout?: number // in milliseconds
  captureToDatabase?: boolean
}

export interface ClaudeCodeSession {
  id: string
  task: ClaudeCodeTask
  status: 'pending' | 'running' | 'completed' | 'failed'
  startTime: Date
  endTime?: Date
  output: string[]
  error?: string
  process?: ChildProcess
  conversationId?: string
}

export interface ClaudeCodeResult {
  sessionId: string
  success: boolean
  output: string
  duration: number
  conversationId?: string
  error?: string
}

/**
 * Claude Code Process Manager
 * Manages programmatic Claude Code sessions for the dual strategy
 */
export class ClaudeCodeManager extends EventEmitter {
  private sessions: Map<string, ClaudeCodeSession> = new Map()
  private tempDir: string

  constructor(tempDir: string = join(process.cwd(), '.claude-code-temp')) {
    super()
    this.tempDir = tempDir
  }

  /**
   * Execute a Claude Code task
   */
  async executeTask(task: ClaudeCodeTask): Promise<string> {
    const sessionId = task.id || randomUUID()

    const session: ClaudeCodeSession = {
      id: sessionId,
      task,
      status: 'pending',
      startTime: new Date(),
      output: []
    }

    this.sessions.set(sessionId, session)
    this.emit('session_started', session)

    try {
      // Ensure temp directory exists
      await mkdir(this.tempDir, { recursive: true })

      // Create a prompt file for Claude Code
      const promptFile = join(this.tempDir, `prompt-${sessionId}.md`)
      await writeFile(promptFile, this.formatPrompt(task))

      // Set working directory
      const workingDir = task.workingDirectory || process.cwd()

      console.log(`🚀 Starting Claude Code session: ${sessionId}`)
      console.log(`📁 Working directory: ${workingDir}`)
      console.log(`📝 Prompt file: ${promptFile}`)

      // Start Claude Code process
      const claudeArgs = [
        'code',
        '--cwd', workingDir,
        '--file', promptFile,
        '--output-format', 'stream-json'
      ]

      const claudeProcess = spawn('claude', claudeArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: workingDir,
        env: process.env
      })

      session.process = claudeProcess
      session.status = 'running'
      this.emit('session_running', session)

      // Handle stdout
      claudeProcess.stdout?.on('data', (data) => {
        const output = data.toString()
        session.output.push(output)
        this.emit('session_output', { sessionId, output })
        console.log(`📤 [${sessionId}] Output:`, output.substring(0, 200) + '...')
      })

      // Handle stderr
      claudeProcess.stderr?.on('data', (data) => {
        const error = data.toString()
        session.output.push(`ERROR: ${error}`)
        this.emit('session_error', { sessionId, error })
        console.error(`❌ [${sessionId}] Error:`, error)
      })

      // Handle process completion
      claudeProcess.on('close', async (code) => {
        session.endTime = new Date()
        session.status = code === 0 ? 'completed' : 'failed'

        if (code !== 0) {
          session.error = `Process exited with code ${code}`
        }

        console.log(`✅ Claude Code session ${sessionId} finished with code ${code}`)

        // Capture to database if enabled
        if (task.captureToDatabase !== false) {
          try {
            session.conversationId = await this.captureSessionToDatabase(session)
          } catch (error) {
            console.error('Failed to capture session to database:', error)
          }
        }

        this.emit('session_completed', session)
      })

      // Set timeout if specified
      if (task.timeout) {
        setTimeout(() => {
          if (session.status === 'running') {
            console.log(`⏰ Timeout reached for session ${sessionId}`)
            this.stopSession(sessionId)
            session.error = 'Timeout'
            session.status = 'failed'
          }
        }, task.timeout)
      }

      return sessionId

    } catch (error) {
      session.status = 'failed'
      session.error = error instanceof Error ? error.message : 'Unknown error'
      session.endTime = new Date()

      this.emit('session_failed', session)
      throw error
    }
  }

  /**
   * Get session status
   */
  getSession(sessionId: string): ClaudeCodeSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * Get all sessions
   */
  getAllSessions(): ClaudeCodeSession[] {
    return Array.from(this.sessions.values())
  }

  /**
   * Stop a running session
   */
  stopSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session || session.status !== 'running') {
      return false
    }

    if (session.process) {
      session.process.kill('SIGTERM')
      session.status = 'failed'
      session.error = 'Manually stopped'
      session.endTime = new Date()

      this.emit('session_stopped', session)
      return true
    }

    return false
  }

  /**
   * Wait for session completion
   */
  async waitForCompletion(sessionId: string): Promise<ClaudeCodeResult> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    return new Promise((resolve, reject) => {
      const checkStatus = () => {
        if (session.status === 'completed') {
          resolve({
            sessionId,
            success: true,
            output: session.output.join('\n'),
            duration: session.endTime!.getTime() - session.startTime.getTime(),
            conversationId: session.conversationId
          })
        } else if (session.status === 'failed') {
          resolve({
            sessionId,
            success: false,
            output: session.output.join('\n'),
            duration: session.endTime ? session.endTime.getTime() - session.startTime.getTime() : 0,
            error: session.error,
            conversationId: session.conversationId
          })
        } else {
          // Still running, check again in 500ms
          setTimeout(checkStatus, 500)
        }
      }

      checkStatus()

      // Set a maximum wait time of 10 minutes
      setTimeout(() => {
        reject(new Error('Session wait timeout'))
      }, 10 * 60 * 1000)
    })
  }

  /**
   * Format the prompt for Claude Code
   */
  private formatPrompt(task: ClaudeCodeTask): string {
    return `# Claude Code Task: ${task.title}

## Context
You are Claude Code, working on the Arrakis conversation capture system as part of a "dual Claude strategy" proof of concept.

This is **System B** - the Claude Code component with full tool access. You have access to:
- Read, Write, Edit files
- Bash commands
- File system operations
- Full development capabilities

## Your Task
${task.prompt}

## Working Directory
You are working in: ${task.workingDirectory || process.cwd()}

## Project Information
- This is the Arrakis project - a Next.js app for capturing Claude conversations
- Database: Neon PostgreSQL with Drizzle ORM
- Tech stack: Next.js 15, React 19, TypeScript, Tailwind CSS
- See the README.md and CLAUDE.md files for more context

## Important Guidelines
- Make real, meaningful changes that demonstrate your capabilities
- Test your changes with appropriate commands (npm run type-check, npm run build, etc.)
- Be thorough but focused on the specific task
- Capture your reasoning and approach in your responses
- This is a proof of concept to show how Claude Code can improve the system itself

Please begin working on this task now.`
  }

  /**
   * Capture session to database
   */
  private async captureSessionToDatabase(session: ClaudeCodeSession): Promise<string> {
    const duration = session.endTime!.getTime() - session.startTime.getTime()

    const conversationData: ConversationData = {
      title: `Claude Code: ${session.task.title}`,
      claudeSessionId: session.id,
      messages: [
        {
          role: 'user',
          content: session.task.prompt,
          timestamp: session.startTime.toISOString(),
          metadata: {
            source: 'claude-code-manager',
            task_type: 'programmatic',
            session_id: session.id
          }
        },
        {
          role: 'assistant',
          content: session.output.join('\n'),
          timestamp: (session.endTime || new Date()).toISOString(),
          metadata: {
            source: 'claude-code',
            session_id: session.id,
            working_directory: session.task.workingDirectory,
            execution_status: session.status,
            duration_ms: duration
          }
        }
      ],
      metadata: {
        source: 'claude-code',
        timestamp: session.startTime.toISOString(),
        sessionInfo: {
          projectPath: session.task.workingDirectory || process.cwd(),
          workingDirectory: session.task.workingDirectory || process.cwd()
        },
        performance: {
          totalTokens: 0, // Will be updated by capture system
          totalCost: 0, // Will be calculated by capture system
          duration
        }
      }
    }

    return await captureConversation(conversationData)
  }

  /**
   * Cleanup old sessions and temp files
   */
  async cleanup(): Promise<void> {
    // Stop any running sessions
    for (const session of this.sessions.values()) {
      if (session.status === 'running') {
        this.stopSession(session.id)
      }
    }

    // Clear sessions older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.startTime < oneHourAgo) {
        this.sessions.delete(sessionId)
      }
    }
  }
}

// Singleton instance
export const claudeCodeManager = new ClaudeCodeManager()

// Convenience functions
export async function executeClaudeCodeTask(task: ClaudeCodeTask): Promise<ClaudeCodeResult> {
  const sessionId = await claudeCodeManager.executeTask(task)
  return await claudeCodeManager.waitForCompletion(sessionId)
}

export function getClaudeCodeSession(sessionId: string): ClaudeCodeSession | undefined {
  return claudeCodeManager.getSession(sessionId)
}

export function getAllClaudeCodeSessions(): ClaudeCodeSession[] {
  return claudeCodeManager.getAllSessions()
}