/**
 * Conversation Thread Component
 * Display the conversation messages in a thread format
 */

'use client'

import { Card, CardContent } from '@/components/ui/card'
import { User, Bot, Wrench } from 'lucide-react'
import { api } from '@/components/providers/trpc-provider'
import { formatDistanceToNow } from 'date-fns'

interface ConversationThreadProps {
  sessionId: string
}

export function ConversationThread({ sessionId }: ConversationThreadProps) {
  const { data: messages, isLoading } = api.sessions.messages.useQuery({
    sessionId,
    limit: 100,
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
                  <div className="h-4 bg-slate-200 rounded w-20"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-full"></div>
                  <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!messages || messages.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Bot className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">
            No messages found
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            This session doesn't contain any messages.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {messages.map((message, index) => (
        <Card
          key={index}
          className={`${message.role === 'user' ? 'ml-12' : 'mr-12'}`}
        >
          <CardContent className="p-6">
            <div className="flex items-start space-x-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  message.role === 'user'
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-purple-100 text-purple-600'
                }`}
              >
                {message.role === 'user' ? (
                  <User className="w-5 h-5" />
                ) : (
                  <Bot className="w-5 h-5" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-sm font-medium capitalize">
                    {message.role}
                  </span>
                  {message.createdAt && (
                    <span className="text-xs text-slate-500">
                      {formatDistanceToNow(new Date(message.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  )}
                </div>

                <div className="prose prose-sm max-w-none">
                  <p className="text-sm text-slate-900 whitespace-pre-wrap">
                    {message.content}
                  </p>
                </div>

                {/* Tool calls display */}
                {(message.metadata as any)?.tool_calls &&
                  (message.metadata as any).tool_calls.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {(message.metadata as any).tool_calls.map(
                        (toolCall: any, toolIndex: number) => (
                          <div
                            key={toolIndex}
                            className="bg-slate-50 rounded-md p-3 border"
                          >
                            <div className="flex items-center space-x-2 mb-2">
                              <Wrench className="w-4 h-4 text-slate-500" />
                              <span className="text-sm font-medium text-slate-700">
                                {toolCall.name}
                              </span>
                            </div>
                            {toolCall.input && (
                              <pre className="text-xs text-slate-600 bg-slate-100 rounded p-2 overflow-x-auto">
                                {JSON.stringify(toolCall.input, null, 2)}
                              </pre>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
