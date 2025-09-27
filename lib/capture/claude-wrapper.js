#!/usr/bin/env node

/**
 * Claude Code Wrapper for Automatic Capture
 *
 * This script transparently wraps Claude Code commands to enable automatic
 * conversation capture without user intervention.
 */

const { spawn } = require('child_process')
const path = require('path')

// Import our capture modules (using require for compatibility)
const { defaultInterceptor } = require('./claude-interceptor')
const { executeClaudeCommand } = require('./claude-proxy')

/**
 * Main wrapper function
 */
async function wrapClaudeCommand() {
  const args = process.argv.slice(2)

  console.log('🎯 Arrakis: Intercepting Claude Code command...')
  console.log(`📝 Args: ${args.join(' ')}`)

  try {
    // Check if this is an interactive command that we should proxy
    if (shouldUseProxy(args)) {
      // Use our proxy for full capture
      await executeClaudeCommandWithProxy(args)
    } else {
      // Use interceptor for background capture
      await executeClaudeCommandWithInterceptor(args)
    }
  } catch (error) {
    console.error('❌ Arrakis wrapper error:', error.message)
    // Fall back to direct claude execution
    await executeOriginalClaudeCommand(args)
  }
}

/**
 * Determine if we should use proxy vs interceptor
 */
function shouldUseProxy(args) {
  // Use proxy for interactive commands
  const interactiveFlags = ['--print', '-p', '--continue', '--resume']
  return args.some((arg) => interactiveFlags.includes(arg)) || args.length === 1
}

/**
 * Execute using our proxy (full control)
 */
async function executeClaudeCommandWithProxy(args) {
  console.log('🔄 Using Arrakis proxy for capture...')

  // Extract prompt from args
  const prompt = args.find((arg) => !arg.startsWith('-')) || ''

  const options = {
    enableCapture: true,
    autoStore: true,
    claudeArgs: args.filter((arg) => arg.startsWith('-')),
    verbose: true,
  }

  try {
    const {
      default: { executeClaudeCommand },
    } = await import('./claude-proxy.js')
    const result = await executeClaudeCommand(prompt, options)
    console.log(result.output)
    console.log(
      `\n📊 Captured session: ${result.summary.arrakisSessionId || 'pending'}`
    )
  } catch (error) {
    console.error('Proxy execution failed:', error.message)
    throw error
  }
}

/**
 * Execute using interceptor (background capture)
 */
async function executeClaudeCommandWithInterceptor(args) {
  console.log('🎧 Using Arrakis interceptor for capture...')

  try {
    // Start interceptor
    const sessionId = await defaultInterceptor.interceptSession(args)
    console.log(`🎯 Started intercept session: ${sessionId}`)

    // Execute original command
    await executeOriginalClaudeCommand(args)
  } catch (error) {
    console.error('Interceptor execution failed:', error.message)
    throw error
  }
}

/**
 * Execute original Claude command as fallback
 */
async function executeOriginalClaudeCommand(args) {
  console.log('⚡ Executing original Claude Code command...')

  return new Promise((resolve, reject) => {
    // Find the original claude executable
    const claudePath = findOriginalClaude()

    const claudeProcess = spawn(claudePath, args, {
      stdio: 'inherit',
      env: process.env,
    })

    claudeProcess.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Claude Code exited with code ${code}`))
      }
    })

    claudeProcess.on('error', (error) => {
      reject(error)
    })
  })
}

/**
 * Find the original claude executable
 */
function findOriginalClaude() {
  // Look for claude in PATH, excluding our wrapper directory
  const pathEnv = process.env.PATH || ''
  const pathSeparator = process.platform === 'win32' ? ';' : ':'
  const paths = pathEnv.split(pathSeparator)

  const wrapperDir = path.dirname(__filename)
  const claudeExecutable =
    process.platform === 'win32' ? 'claude.exe' : 'claude'

  for (const dir of paths) {
    if (dir !== wrapperDir && dir !== path.dirname(wrapperDir)) {
      const claudePath = path.join(dir, claudeExecutable)
      try {
        const fs = require('fs')
        if (fs.existsSync(claudePath)) {
          return claudePath
        }
      } catch (error) {
        // Continue searching
      }
    }
  }

  // Fallback to global claude
  return 'claude'
}

/**
 * Handle script execution
 */
if (require.main === module) {
  wrapClaudeCommand().catch((error) => {
    console.error('❌ Claude wrapper failed:', error.message)
    process.exit(1)
  })
}

module.exports = {
  wrapClaudeCommand,
  executeOriginalClaudeCommand,
  findOriginalClaude,
}
