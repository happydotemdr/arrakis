/**
 * Automatic Capture Service
 *
 * A background service that automatically monitors and captures Claude Code sessions
 * without user intervention. Uses transparent proxy injection and process monitoring.
 */

import { EventEmitter } from 'events'
import { spawn, type ChildProcess } from 'child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { ClaudeProxy } from './claude-proxy'
import { defaultInterceptor } from './claude-interceptor'

export interface CaptureServiceConfig {
  enabled: boolean
  autoStart: boolean
  interceptMode: 'proxy' | 'wrapper' | 'monitor'
  notification: boolean
  logLevel: 'error' | 'warn' | 'info' | 'debug'
  storageEnabled: boolean
}

export interface CaptureStatus {
  running: boolean
  sessionsToday: number
  totalSessions: number
  lastCaptureTime: string | null
  errors: string[]
  mode: string
}

/**
 * Automatic Capture Service for Claude Code
 */
export class AutoCaptureService extends EventEmitter {
  private config: CaptureServiceConfig
  private configPath: string
  private isRunning: boolean = false
  private claudeProxy: ClaudeProxy
  private watchers: ChildProcess[] = []
  private status: CaptureStatus

  constructor() {
    super()

    this.configPath = join(homedir(), '.arrakis', 'capture-config.json')
    this.config = this.loadConfig()
    this.claudeProxy = new ClaudeProxy()
    this.status = {
      running: false,
      sessionsToday: 0,
      totalSessions: 0,
      lastCaptureTime: null,
      errors: [],
      mode: this.config.interceptMode,
    }

    this.setupEventHandlers()
  }

  /**
   * Start the automatic capture service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.log('info', 'Auto-capture service already running')
      return
    }

    this.log('info', 'Starting Arrakis auto-capture service...')

    try {
      // Setup proxy injection based on mode
      switch (this.config.interceptMode) {
        case 'proxy':
          await this.setupProxyMode()
          break
        case 'wrapper':
          await this.setupWrapperMode()
          break
        case 'monitor':
          await this.setupMonitorMode()
          break
      }

      this.isRunning = true
      this.status.running = true
      this.status.mode = this.config.interceptMode

      this.emit('service_started', { mode: this.config.interceptMode })
      this.log(
        'info',
        `✅ Auto-capture service started in ${this.config.interceptMode} mode`
      )
    } catch (error) {
      this.handleError('Failed to start auto-capture service', error)
      throw error
    }
  }

  /**
   * Stop the automatic capture service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    this.log('info', 'Stopping auto-capture service...')

    // Stop all watchers
    this.watchers.forEach((watcher) => {
      if (!watcher.killed) {
        watcher.kill('SIGTERM')
      }
    })
    this.watchers = []

    // Cleanup proxy/wrapper
    await this.cleanup()

    this.isRunning = false
    this.status.running = false
    this.emit('service_stopped')
    this.log('info', '✅ Auto-capture service stopped')
  }

  /**
   * Get current service status
   */
  getStatus(): CaptureStatus {
    return { ...this.status }
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<CaptureServiceConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.saveConfig()
    this.emit('config_updated', this.config)
    this.log('info', 'Configuration updated')
  }

  /**
   * Setup proxy mode - intercepts all claude commands transparently
   */
  private async setupProxyMode(): Promise<void> {
    this.log('info', 'Setting up transparent proxy mode...')

    // Create claude wrapper script that calls our proxy
    const claudeWrapperPath = this.createClaudeWrapper()

    // Setup PATH manipulation to intercept claude commands
    await this.setupPathIntercept(claudeWrapperPath)

    this.log('info', '✅ Proxy mode configured')
  }

  /**
   * Setup wrapper mode - replaces claude command with our wrapper
   */
  private async setupWrapperMode(): Promise<void> {
    this.log('info', 'Setting up wrapper mode...')

    // Create alias or symlink for claude command
    await this.createClaudeAlias()

    this.log('info', '✅ Wrapper mode configured')
  }

  /**
   * Setup monitor mode - monitors process list for claude commands
   */
  private async setupMonitorMode(): Promise<void> {
    this.log('info', 'Setting up process monitor mode...')

    // Start process monitor that watches for claude processes
    const monitor = this.startProcessMonitor()
    this.watchers.push(monitor)

    this.log('info', '✅ Monitor mode configured')
  }

  /**
   * Create claude wrapper script
   */
  private createClaudeWrapper(): string {
    const arrakisDir = join(homedir(), '.arrakis')
    if (!existsSync(arrakisDir)) {
      mkdirSync(arrakisDir, { recursive: true })
    }

    const isWindows = process.platform === 'win32'
    const wrapperPath = join(arrakisDir, isWindows ? 'claude.bat' : 'claude')

    const wrapperContent = isWindows
      ? this.getWindowsWrapper()
      : this.getUnixWrapper()

    writeFileSync(wrapperPath, wrapperContent, { mode: 0o755 })

    this.log('debug', `Created Claude wrapper at: ${wrapperPath}`)
    return wrapperPath
  }

  /**
   * Get Windows wrapper script content
   */
  private getWindowsWrapper(): string {
    return `@echo off
REM Arrakis Auto-Capture Wrapper for Claude Code
node "${join(__dirname, 'claude-wrapper.js')}" %*
`
  }

  /**
   * Get Unix wrapper script content
   */
  private getUnixWrapper(): string {
    return `#!/bin/bash
# Arrakis Auto-Capture Wrapper for Claude Code
node "${join(__dirname, 'claude-wrapper.js')}" "$@"
`
  }

  /**
   * Setup PATH interception
   */
  private async setupPathIntercept(wrapperPath: string): Promise<void> {
    // This would modify shell profile files to prepend our wrapper directory to PATH
    // Implementation depends on shell (bash, zsh, fish, etc.)
    this.log('info', `PATH intercept setup for wrapper: ${wrapperPath}`)

    // Note: In production, this would modify ~/.bashrc, ~/.zshrc, etc.
    // For now, we'll just log the required manual step
    console.log(`
📋 Manual Setup Required:
Add this to your shell profile (~/.bashrc, ~/.zshrc, etc.):
export PATH="${dirname(wrapperPath)}:$PATH"

Or run: echo 'export PATH="${dirname(wrapperPath)}:$PATH"' >> ~/.bashrc
`)
  }

  /**
   * Create claude alias
   */
  private async createClaudeAlias(): Promise<void> {
    // Create symlink or alias for claude command
    this.log('info', 'Creating claude command alias...')

    // Implementation would create appropriate alias for the platform
    console.log(`
📋 Manual Setup Required:
Add this alias to your shell profile:
alias claude='node ${join(__dirname, 'claude-wrapper.js')}'
`)
  }

  /**
   * Start process monitor
   */
  private startProcessMonitor(): ChildProcess {
    this.log('info', 'Starting process monitor for Claude Code...')

    // Monitor running processes for claude commands
    const isWindows = process.platform === 'win32'
    const command = isWindows ? 'wmic' : 'ps'
    const args = isWindows
      ? ['process', 'get', 'name,processid,commandline']
      : ['aux']

    const monitor = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    monitor.stdout?.on('data', (data) => {
      this.processMonitorOutput(data.toString())
    })

    monitor.on('exit', () => {
      // Restart monitor after delay
      setTimeout(() => {
        if (this.isRunning) {
          const newMonitor = this.startProcessMonitor()
          this.watchers.push(newMonitor)
        }
      }, 5000)
    })

    return monitor
  }

  /**
   * Process monitor output to detect claude commands
   */
  private processMonitorOutput(output: string): void {
    if (output.toLowerCase().includes('claude')) {
      this.log('debug', 'Detected Claude Code process')
      // Extract process info and start capture
      this.handleDetectedClaudeProcess(output)
    }
  }

  /**
   * Handle detected claude process
   */
  private async handleDetectedClaudeProcess(
    processInfo: string
  ): Promise<void> {
    try {
      this.log('info', '🎯 Detected Claude Code execution, starting capture...')

      // Start interceptor for this session
      const sessionId = await defaultInterceptor.interceptSession()

      this.status.sessionsToday++
      this.status.totalSessions++
      this.status.lastCaptureTime = new Date().toISOString()

      this.emit('session_detected', { sessionId, processInfo })
    } catch (error) {
      this.handleError('Failed to capture detected Claude session', error)
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Listen to interceptor events
    defaultInterceptor.on('session_complete', (data) => {
      this.emit('session_captured', data)
      this.log('info', `✅ Session captured: ${data.sessionId}`)
    })

    defaultInterceptor.on('session_error', (data) => {
      this.handleError('Session capture failed', data.error)
    })

    // Handle proxy events
    this.claudeProxy.on('claude_message', (data) => {
      this.emit('message_captured', data)
    })
  }

  /**
   * Load configuration from file
   */
  private loadConfig(): CaptureServiceConfig {
    const defaultConfig: CaptureServiceConfig = {
      enabled: true,
      autoStart: false,
      interceptMode: 'proxy',
      notification: true,
      logLevel: 'info',
      storageEnabled: true,
    }

    if (!existsSync(this.configPath)) {
      // Create default config
      this.saveConfig(defaultConfig)
      return defaultConfig
    }

    try {
      const configData = readFileSync(this.configPath, 'utf-8')
      return { ...defaultConfig, ...JSON.parse(configData) }
    } catch (error) {
      this.log('warn', 'Failed to load config, using defaults')
      return defaultConfig
    }
  }

  /**
   * Save configuration to file
   */
  private saveConfig(config: CaptureServiceConfig = this.config): void {
    try {
      const configDir = dirname(this.configPath)
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true })
      }

      writeFileSync(this.configPath, JSON.stringify(config, null, 2))
    } catch (error) {
      this.log('error', 'Failed to save configuration')
    }
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    // Cleanup any temporary files, aliases, etc.
    this.log('info', 'Cleaning up auto-capture resources...')
  }

  /**
   * Handle errors
   */
  private handleError(message: string, error: any): void {
    const errorMsg = `${message}: ${error?.message || error}`
    this.status.errors.push(errorMsg)
    this.log('error', errorMsg)
    this.emit('error', { message, error })
  }

  /**
   * Log messages based on level
   */
  private log(
    level: 'error' | 'warn' | 'info' | 'debug',
    message: string
  ): void {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 }
    const configLevel = levels[this.config.logLevel]
    const messageLevel = levels[level]

    if (messageLevel <= configLevel) {
      const timestamp = new Date().toISOString()
      console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`)
    }
  }
}

/**
 * Default auto-capture service instance
 */
export const defaultAutoCaptureService = new AutoCaptureService()

/**
 * Convenience functions
 */
export async function startAutoCapture(): Promise<void> {
  return defaultAutoCaptureService.start()
}

export async function stopAutoCapture(): Promise<void> {
  return defaultAutoCaptureService.stop()
}

export function getAutoCaptureStatus(): CaptureStatus {
  return defaultAutoCaptureService.getStatus()
}
