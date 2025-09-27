/**
 * Direct Claude API Route
 * Bypasses tRPC for reliable Claude integration
 */

import { type NextRequest, NextResponse } from 'next/server'
import { claudeClient } from '@/lib/claude/api-client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, options = {} } = body

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    console.log('🚀 Direct API: Processing Claude request...')
    console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`)

    // Set up options with defaults
    const claudeOptions = {
      model: options.model || 'claude-sonnet-4-20250514',
      maxTokens: options.maxTokens || 4000,
      temperature: options.temperature || 0.7,
      captureToDatabase: options.captureToDatabase !== false,
      username: options.username || 'arrakis-user',
      systemPrompt:
        options.systemPrompt ||
        'You are Claude, an AI assistant. You are being accessed through the Arrakis conversation capture system. Please provide a helpful response.',
    }

    // Call Claude API
    const response = await claudeClient.sendMessage(prompt, claudeOptions)

    console.log('✅ Direct API: Claude response received')
    console.log(
      `📊 Tokens: ${response.usage.input_tokens} in, ${response.usage.output_tokens} out`
    )

    return NextResponse.json({
      success: true,
      data: response,
    })
  } catch (error) {
    console.error('❌ Direct API: Claude error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Claude API endpoint ready',
    timestamp: new Date().toISOString(),
  })
}
