'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { trpc } from '@/lib/trpc/client'

interface ClaudeResponse {
  id: string
  model: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
  content: Array<{
    type: string
    text?: string
    name?: string
    input?: any
  }>
  stop_reason: string
  timestamp: string
}

export default function DemoPage() {
  const [prompt, setPrompt] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [claudeResponse, setClaudeResponse] = useState<ClaudeResponse | null>(
    null
  )
  const [systemPrompt, setSystemPrompt] = useState('')
  const [userPrompt, setUserPrompt] = useState('')
  const [toolCalls, setToolCalls] = useState<any[]>([])

  const handleSubmit = async () => {
    if (!prompt.trim()) return

    setIsProcessing(true)

    try {
      console.log('🚀 Demo: Starting real Claude API call...')

      // Direct Claude API call (bypasses tRPC issues)
      const apiResponse = await fetch('/api/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          options: {
            model: 'claude-sonnet-4-20250514',
            maxTokens: 4000,
            temperature: 0.7,
            captureToDatabase: true,
            username: 'arrakis-user',
            systemPrompt:
              'You are Claude, an AI assistant. You are being accessed through the Arrakis conversation capture system. Please provide a helpful response to the user.',
          },
        }),
      })

      const response = await apiResponse.json()

      if (response.success && response.data) {
        const claudeResponse = response.data

        // Build system and user prompts for display
        const systemPrompt = `You are Claude, an AI assistant created by Anthropic. You are being accessed through the Arrakis conversation capture system.

Current context:
- Working directory: C:/projects/arrakis
- Platform: win32
- Date: ${new Date().toLocaleDateString()}
- This is the Arrakis interface testing real Claude API integration`

        const userPrompt = `User: ${prompt.trim()}

[This message was sent through the Arrakis interface to the real Claude API]`

        setSystemPrompt(systemPrompt)
        setUserPrompt(userPrompt)
        setClaudeResponse(claudeResponse)
        setToolCalls(
          claudeResponse.content.filter((c: any) => c.type === 'tool_use')
        )

        console.log('✅ Demo: Real Claude API call completed successfully')
        console.log(
          `📊 Usage: ${claudeResponse.usage.input_tokens} input + ${claudeResponse.usage.output_tokens} output tokens`
        )
      } else {
        throw new Error(
          response.error || 'Failed to get response from Claude API'
        )
      }
    } catch (error) {
      console.error('❌ Demo: Real Claude API error:', error)

      // Show error to user
      const errorResponse: ClaudeResponse = {
        id: `error_${Date.now()}`,
        model: 'error',
        usage: { input_tokens: 0, output_tokens: 0 },
        content: [
          {
            type: 'text',
            text: `Error calling Claude API: ${error instanceof Error ? error.message : 'Unknown error'}

This could be due to:
- Invalid API key configuration
- Network connectivity issues
- API rate limits
- Server errors

Please check the browser console for more details.`,
          },
        ],
        stop_reason: 'error',
        timestamp: new Date().toISOString(),
      }

      setClaudeResponse(errorResponse)
      setToolCalls([])
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="retro-terminal min-h-screen bg-black">
      <div className="container mx-auto p-6 space-y-6 retro-scanlines">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold font-mono">ARRAKIS TERMINAL</h1>
          <p className="text-muted-foreground font-mono">
            Direct neural interface to Claude AI consciousness // All
            transmissions captured
          </p>
          <div className="flex items-center space-x-2 text-sm">
            <span className="inline-flex items-center rounded-full bg-cyan-950 border border-cyan-400 px-2.5 py-0.5 text-xs font-medium text-cyan-400 font-mono">
              LIVE FEED
            </span>
            <span className="inline-flex items-center rounded-full bg-green-950 border border-green-400 px-2.5 py-0.5 text-xs font-medium text-green-400 font-mono">
              AUTO-LOG
            </span>
            <span className="inline-flex items-center rounded-full bg-orange-950 border border-orange-400 px-2.5 py-0.5 text-xs font-medium text-orange-400 font-mono">
              ENHANCED
            </span>
          </div>
        </div>

        <Card className="bg-black border-cyan-400">
          <CardHeader>
            <CardTitle className="text-cyan-400 font-mono">
              [NEURAL INTERFACE]
            </CardTitle>
            <CardDescription className="text-green-400 font-mono">
              Establish direct connection to Claude consciousness matrix
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="ENTER TRANSMISSION... > _"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="bg-black border-green-400 text-green-400 font-mono placeholder:text-green-600"
            />
            <Button
              onClick={handleSubmit}
              disabled={!prompt.trim() || isProcessing}
              className="w-full bg-orange-900 border border-orange-400 text-orange-400 hover:bg-orange-800 font-mono"
            >
              {isProcessing ? 'TRANSMITTING...' : 'INITIATE NEURAL LINK'}
            </Button>
          </CardContent>
        </Card>

        {(isProcessing || claudeResponse) && (
          <Card className="bg-black border-cyan-400">
            <CardHeader>
              <CardTitle className="text-cyan-400 font-mono">
                [TRANSMISSION ANALYSIS]
              </CardTitle>
              <CardDescription className="text-green-400 font-mono">
                Real-time neural pathway monitoring and data extraction
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isProcessing ? (
                <div className="flex items-center space-x-2 text-orange-400 font-mono">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-400"></div>
                  <span>
                    NEURAL PATHWAYS ACTIVE... CONSCIOUSNESS LINK ESTABLISHED...
                  </span>
                </div>
              ) : (
                <Tabs defaultValue="response" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 bg-black border border-green-400">
                    <TabsTrigger
                      value="response"
                      className="text-green-400 font-mono data-[state=active]:bg-green-900 data-[state=active]:text-green-300"
                    >
                      RESPONSE
                    </TabsTrigger>
                    <TabsTrigger
                      value="system"
                      className="text-green-400 font-mono data-[state=active]:bg-green-900 data-[state=active]:text-green-300"
                    >
                      SYSTEM
                    </TabsTrigger>
                    <TabsTrigger
                      value="user"
                      className="text-green-400 font-mono data-[state=active]:bg-green-900 data-[state=active]:text-green-300"
                    >
                      INPUT
                    </TabsTrigger>
                    <TabsTrigger
                      value="metadata"
                      className="text-green-400 font-mono data-[state=active]:bg-green-900 data-[state=active]:text-green-300"
                    >
                      METADATA
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="response" className="space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Badge className="bg-cyan-950 border-cyan-400 text-cyan-400 font-mono">
                          ID: {claudeResponse?.id}
                        </Badge>
                        <Badge className="bg-orange-950 border-orange-400 text-orange-400 font-mono">
                          {claudeResponse?.model}
                        </Badge>
                      </div>

                      <ScrollArea className="h-96 w-full border-green-400 border bg-black rounded p-4">
                        <div className="space-y-4">
                          {claudeResponse?.content.map((content, index) => (
                            <div key={index} className="space-y-2">
                              {content.type === 'text' && (
                                <div className="max-w-none">
                                  <pre className="whitespace-pre-wrap font-mono text-sm text-green-400 bg-black p-3 rounded border border-green-600">
                                    {content.text}
                                  </pre>
                                </div>
                              )}
                              {content.type === 'tool_use' && (
                                <Card className="bg-black border-orange-400">
                                  <CardHeader className="pb-2">
                                    <div className="flex items-center space-x-2">
                                      <Badge className="bg-orange-950 border-orange-400 text-orange-400 font-mono">
                                        TOOL EXEC
                                      </Badge>
                                      <span className="font-mono text-sm text-orange-400">
                                        {content.name}
                                      </span>
                                    </div>
                                  </CardHeader>
                                  <CardContent>
                                    <pre className="text-xs bg-black text-orange-300 p-2 rounded border border-orange-600 overflow-x-auto font-mono">
                                      {JSON.stringify(content.input, null, 2)}
                                    </pre>
                                  </CardContent>
                                </Card>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </TabsContent>

                  <TabsContent value="system">
                    <ScrollArea className="h-96 w-full border rounded p-4">
                      <pre className="text-xs whitespace-pre-wrap">
                        {systemPrompt}
                      </pre>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="user">
                    <ScrollArea className="h-96 w-full border rounded p-4">
                      <pre className="text-xs whitespace-pre-wrap">
                        {userPrompt}
                      </pre>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="metadata" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Token Usage</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">
                              Input:
                            </span>
                            <span className="font-mono">
                              {claudeResponse?.usage.input_tokens}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">
                              Output:
                            </span>
                            <span className="font-mono">
                              {claudeResponse?.usage.output_tokens}
                            </span>
                          </div>
                          <Separator />
                          <div className="flex justify-between font-semibold">
                            <span className="text-sm">Total:</span>
                            <span className="font-mono">
                              {(claudeResponse?.usage.input_tokens || 0) +
                                (claudeResponse?.usage.output_tokens || 0)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">
                            Response Details
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">
                              Stop Reason:
                            </span>
                            <Badge variant="outline">
                              {claudeResponse?.stop_reason}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">
                              Timestamp:
                            </span>
                            <span className="font-mono text-xs">
                              {claudeResponse?.timestamp &&
                                new Date(
                                  claudeResponse.timestamp
                                ).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">
                              Tool Calls:
                            </span>
                            <span className="font-mono">
                              {toolCalls.length}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">
                          Raw JSON Response
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-64 w-full">
                          <pre className="text-xs bg-muted p-2 rounded">
                            {JSON.stringify(claudeResponse, null, 2)}
                          </pre>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
