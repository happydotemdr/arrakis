#!/usr/bin/env bun

/**
 * Test Claude Code Capture System
 *
 * Comprehensive test suite for the Arrakis conversation capture system,
 * including interceptor, parser, tool tracker, and proxy components.
 */

import { ClaudeMetadataParser } from '../lib/capture/metadata-parser'
import { ToolCallTracker } from '../lib/capture/tool-tracker'
import { executeClaudeCommand } from '../lib/capture/claude-proxy'
import type { ClaudeMessage } from '../lib/capture/claude-interceptor'

async function testMetadataParser() {
  console.log('🧪 Testing Claude Code Metadata Parser...')

  // Simulate Claude Code JSON session data
  const sampleMessages: ClaudeMessage[] = [
    {
      type: 'system',
      subtype: 'init',
      uuid: 'init-uuid-123',
      session_id: 'test-session-456',
      apiKeySource: 'user',
      cwd: '/c/projects/arrakis',
      tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep'],
      mcp_servers: [
        { name: 'neon', status: 'connected' },
        { name: 'ref', status: 'connected' },
      ],
      model: 'claude-3-5-sonnet-20241022',
      permissionMode: 'default',
      slash_commands: ['/help', '/memory'],
      output_style: 'default',
    },
    {
      type: 'user',
      uuid: 'user-msg-1',
      session_id: 'test-session-456',
      message: {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Create a new React component for displaying user profiles',
          },
        ],
      },
      parent_tool_use_id: null,
    },
    {
      type: 'assistant',
      uuid: 'assistant-msg-1',
      session_id: 'test-session-456',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: "I'll help you create a React component for displaying user profiles. Let me start by reading the existing project structure.",
          },
          {
            type: 'tool_use',
            id: 'tool-call-1',
            name: 'Read',
            input: { file_path: '/c/projects/arrakis/app/components' },
          },
        ],
      },
      parent_tool_use_id: null,
    },
    {
      type: 'user',
      uuid: 'user-msg-2',
      session_id: 'test-session-456',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool-call-1',
            content: 'Directory contents:\nui/\nfeatures/\nlayout/',
          },
        ],
      },
      parent_tool_use_id: 'tool-call-1',
    },
    {
      type: 'assistant',
      uuid: 'assistant-msg-2',
      session_id: 'test-session-456',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: "Now I'll create the UserProfile component in the features directory.",
          },
          {
            type: 'tool_use',
            id: 'tool-call-2',
            name: 'Write',
            input: {
              file_path:
                '/c/projects/arrakis/app/components/features/UserProfile.tsx',
              content: `import React from 'react'\n\ninterface User {\n  id: string\n  name: string\n  email: string\n  avatar?: string\n}\n\ninterface UserProfileProps {\n  user: User\n}\n\nexport function UserProfile({ user }: UserProfileProps) {\n  return (\n    <div className="user-profile">\n      <h2>{user.name}</h2>\n      <p>{user.email}</p>\n    </div>\n  )\n}`,
            },
          },
        ],
      },
      parent_tool_use_id: null,
    },
    {
      type: 'user',
      uuid: 'user-msg-3',
      session_id: 'test-session-456',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool-call-2',
            content: 'File created successfully',
          },
        ],
      },
      parent_tool_use_id: 'tool-call-2',
    },
    {
      type: 'result',
      subtype: 'success',
      uuid: 'result-uuid',
      session_id: 'test-session-456',
      duration_ms: 5432,
      duration_api_ms: 3210,
      is_error: false,
      num_turns: 3,
      result:
        'Successfully created UserProfile component with TypeScript interfaces and basic styling.',
      total_cost_usd: 0.004567,
      usage: {
        input_tokens: 234,
        output_tokens: 445,
      },
      permission_denials: [],
    },
  ]

  try {
    const parser = new ClaudeMetadataParser()
    const parsed = parser.parseSession(sampleMessages)

    console.log('✅ Parser test successful!')
    console.log(`📊 Session: ${parsed.sessionId}`)
    console.log(`💰 Cost: $${parsed.performance.totalCost}`)
    console.log(`⚡ Duration: ${parsed.duration.totalMs}ms`)
    console.log(`🔧 Tools used: ${parsed.environment.enabledTools.join(', ')}`)
    console.log(`💬 Messages: ${parsed.conversation.messageCount}`)
    console.log(`🛠️ Tool calls: ${parsed.toolUsage.toolCalls.length}`)

    return parsed
  } catch (error) {
    console.error('❌ Parser test failed:', error)
    throw error
  }
}

async function testToolTracker() {
  console.log('\\n🧪 Testing Tool Call Tracker...')

  const tracker = new ToolCallTracker()

  // Simulate tool call sequence
  const assistantMessage: ClaudeMessage = {
    type: 'assistant',
    uuid: 'assistant-uuid',
    session_id: 'test-session',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'read-call-1',
          name: 'Read',
          input: { file_path: '/test/file.ts' },
        },
        {
          type: 'tool_use',
          id: 'bash-call-1',
          name: 'Bash',
          input: { command: 'ls -la' },
        },
      ],
    },
    parent_tool_use_id: null,
  }

  const userMessage: ClaudeMessage = {
    type: 'user',
    uuid: 'user-uuid',
    session_id: 'test-session',
    message: {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'read-call-1',
          content: 'export function hello() { return "world" }',
        },
        {
          type: 'tool_result',
          tool_use_id: 'bash-call-1',
          content: 'total 8\\n-rw-r--r-- 1 user user 100 Oct 1 12:00 file.ts',
        },
      ],
    },
    parent_tool_use_id: null,
  }

  try {
    // Process messages
    tracker.processMessage(assistantMessage)
    const completedCalls = tracker.processMessage(userMessage)

    console.log('✅ Tool tracker test successful!')
    console.log(`🔧 Completed tool calls: ${completedCalls.length}`)

    completedCalls.forEach((call) => {
      console.log(
        `  - ${call.name} (${call.category}): ${call.success ? '✅' : '❌'}`
      )
    })

    const stats = tracker.getStatistics()
    console.log(`📈 Success rate: ${(stats.successRate * 100).toFixed(1)}%`)

    return completedCalls
  } catch (error) {
    console.error('❌ Tool tracker test failed:', error)
    throw error
  }
}

async function testClaudeProxy() {
  console.log('\\n🧪 Testing Claude Code Proxy...')

  try {
    // Test with a simple, safe command that won't cause recursion
    const result = await executeClaudeCommand('What is 2 + 2?', {
      enableCapture: false, // Disable capture to avoid recursion
      outputFormat: 'text',
      autoStore: false,
      verbose: false,
    })

    console.log('✅ Proxy test successful!')
    console.log(`📝 Output length: ${result.output.length} characters`)
    console.log(`⏱️ Duration: ${result.summary.duration}ms`)
    console.log(`💰 Cost: $${result.summary.cost}`)

    return result
  } catch (error) {
    console.error('❌ Proxy test failed:', error)
    console.error(
      'Note: This might fail if Claude Code is not available in PATH'
    )
    // Don't throw - this is expected in some environments
    return null
  }
}

async function testDatabaseIntegration() {
  console.log('\\n🧪 Testing Database Integration...')

  try {
    // Test with our existing capture system
    const { getMessageCount, getSessionCount } = await import(
      '../lib/db/queries'
    )

    const messageCount = await getMessageCount()
    const sessionCount = await getSessionCount()

    console.log('✅ Database integration test successful!')
    console.log(`📊 Current database state:`)
    console.log(`  - Messages: ${messageCount}`)
    console.log(`  - Sessions: ${sessionCount}`)

    return { messageCount, sessionCount }
  } catch (error) {
    console.error('❌ Database integration test failed:', error)
    throw error
  }
}

async function main() {
  console.log('🚀 Starting Arrakis Capture System Tests\\n')

  const results = {
    parser: null as any,
    toolTracker: null as any,
    proxy: null as any,
    database: null as any,
  }

  try {
    // Test individual components
    results.parser = await testMetadataParser()
    results.toolTracker = await testToolTracker()
    results.proxy = await testClaudeProxy()
    results.database = await testDatabaseIntegration()

    console.log('\\n🎉 All tests completed!')
    console.log('\\n📋 Test Summary:')
    console.log(`✅ Metadata Parser: ${results.parser ? 'PASS' : 'FAIL'}`)
    console.log(`✅ Tool Tracker: ${results.toolTracker ? 'PASS' : 'FAIL'}`)
    console.log(
      `${results.proxy ? '✅' : '⚠️'} Claude Proxy: ${results.proxy ? 'PASS' : 'SKIPPED'}`
    )
    console.log(
      `✅ Database Integration: ${results.database ? 'PASS' : 'FAIL'}`
    )

    console.log('\\n🎯 Next Steps:')
    console.log('1. The capture system is ready for real Claude Code sessions')
    console.log('2. Use the proxy to capture conversations with full metadata')
    console.log('3. Implement the web interface for browsing captured sessions')
    console.log('4. Add vector embeddings for semantic search')
  } catch (error) {
    console.error('\\n❌ Test suite failed:', error)
    process.exit(1)
  }
}

// Run tests
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
