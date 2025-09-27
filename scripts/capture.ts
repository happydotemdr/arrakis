#!/usr/bin/env bun

/**
 * Conversation Capture CLI
 *
 * This script provides a command-line interface for capturing conversations
 * manually or from files.
 */

import { captureConversation } from '../lib/capture'
import type { ConversationData, MessageData } from '../lib/capture'

async function captureFromExample() {
  console.log('🎯 Testing conversation capture with example data...')

  const exampleConversation: ConversationData = {
    title: 'Setting up Arrakis conversation capture',
    claudeSessionId: 'test-session-' + Date.now(),
    messages: [
      {
        role: 'user',
        content:
          'I want to set up a conversation capture system for Claude Code sessions.',
        tokens: 15,
        costUsd: '0.000030',
      },
      {
        role: 'assistant',
        content:
          "I'll help you set up Arrakis, a conversation capture system for Claude Code. This system will automatically store your conversations and make them searchable using semantic AI-powered search.",
        tokens: 35,
        costUsd: '0.000070',
      },
      {
        role: 'user',
        content: 'How does the database schema work?',
        tokens: 8,
        costUsd: '0.000016',
      },
      {
        role: 'assistant',
        content:
          'The database schema consists of four main tables: users (for authentication), sessions (conversation groups), messages (individual chat messages), and message_embeddings (for vector search). The schema uses PostgreSQL with pgvector extension for semantic similarity search.',
        tokens: 48,
        costUsd: '0.000096',
      },
    ],
    metadata: {
      source: 'manual',
      timestamp: new Date().toISOString(),
      sessionInfo: {
        projectPath: '/c/projects/arrakis',
        gitBranch: 'feature/phase1-foundation',
        workingDirectory: 'arrakis',
      },
      performance: {
        totalTokens: 106,
        totalCost: 0.000212,
        duration: 45,
      },
    },
  }

  try {
    const sessionId = await captureConversation(exampleConversation)
    console.log('✅ Successfully captured conversation!')
    console.log(`📝 Session ID: ${sessionId}`)
    console.log(`💬 Messages: ${exampleConversation.messages.length}`)
    console.log(`🎯 Title: ${exampleConversation.title}`)

    return sessionId
  } catch (error) {
    console.error('❌ Failed to capture conversation:', error)
    throw error
  }
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === 'example') {
    await captureFromExample()
  } else if (args[0] === 'help') {
    console.log(`
🎯 Arrakis Conversation Capture CLI

Usage:
  bun run scripts/capture.ts [command]

Commands:
  example     Capture an example conversation (default)
  help        Show this help message

Examples:
  bun run scripts/capture.ts
  bun run scripts/capture.ts example
`)
  } else {
    console.error('❌ Unknown command:', args[0])
    console.log('Run "bun run scripts/capture.ts help" for usage information.')
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('❌ Capture script failed:', error)
  process.exit(1)
})
