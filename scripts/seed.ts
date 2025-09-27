#!/usr/bin/env bun

import { db } from '../lib/db'
import { createUser, createSession, createMessage } from '../lib/db/queries'

async function seed() {
  console.log('🌱 Seeding database...')

  try {
    // Create a demo user
    const user = await createUser({
      username: 'demo-user',
      settings: {
        theme: 'light',
        searchHistory: [],
      },
    })
    console.log('✅ Created demo user:', user.username)

    // Create a demo session
    const session = await createSession({
      userId: user.id,
      claudeSessionId: 'demo-session-001',
      title: 'Getting Started with Arrakis',
      metadata: {
        source: 'seed-script',
        tags: ['demo', 'tutorial'],
      },
    })
    console.log('✅ Created demo session:', session.title)

    // Create some demo messages
    const messages = [
      {
        sessionId: session.id,
        role: 'user' as const,
        content:
          'Hello! I want to learn about conversation capture with Arrakis.',
        tokens: 12,
        costUsd: '0.000024',
      },
      {
        sessionId: session.id,
        role: 'assistant' as const,
        content:
          'Welcome to Arrakis! This system captures and indexes your Claude Code conversations, making them searchable with semantic AI-powered search. You can find specific discussions, code solutions, and insights from all your past interactions.',
        tokens: 45,
        costUsd: '0.000090',
      },
      {
        sessionId: session.id,
        role: 'user' as const,
        content: 'How does the semantic search work?',
        tokens: 8,
        costUsd: '0.000016',
      },
      {
        sessionId: session.id,
        role: 'assistant' as const,
        content:
          'The semantic search uses OpenAI text embeddings to understand the meaning behind your queries. Instead of just keyword matching, it can find relevant conversations even when you use different words. For example, searching for "bug fix" might find discussions about "debugging" or "resolving issues".',
        tokens: 52,
        costUsd: '0.000104',
      },
    ]

    for (const messageData of messages) {
      const message = await createMessage(messageData)
      console.log(
        '✅ Created message:',
        message.role,
        '-',
        message.content.substring(0, 50) + '...'
      )
    }

    console.log('🎉 Database seeded successfully!')
    console.log(`📊 Created: 1 user, 1 session, ${messages.length} messages`)
  } catch (error) {
    console.error('❌ Failed to seed database:', error)
    process.exit(1)
  }
}

// Run the seed function
seed()
  .catch((error) => {
    console.error('❌ Seed script failed:', error)
    process.exit(1)
  })
  .finally(() => {
    process.exit(0)
  })
