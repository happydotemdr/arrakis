import { api } from '@/lib/trpc/server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { MessageSquare, User, Bot, Clock, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { notFound } from 'next/navigation'

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const conversation = await api.conversation.getById({ id })

  if (!conversation) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/conversations"
          className="text-cyber-cyan hover:text-cyber-green transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 space-y-1">
          <h1 className="text-2xl font-bold text-cyber-green cyber-glow tracking-wider font-mono">
            &gt; {conversation.title}
          </h1>
          <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
            <span>ID: {conversation.id.slice(0, 12)}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(new Date(conversation.createdAt))}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {conversation.messages.length} messages
            </span>
          </div>
        </div>
      </div>

      {conversation.description && (
        <Card className="cyber-border">
          <CardContent className="pt-6">
            <p className="text-sm font-mono text-muted-foreground">
              {conversation.description}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {conversation.messages.length === 0 ? (
          <Card className="cyber-border">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground font-mono">
                NO_MESSAGES_RECORDED
              </p>
            </CardContent>
          </Card>
        ) : (
          conversation.messages.map((message, index) => {
            const isUser = message.role === 'user'
            const isAssistant = message.role === 'assistant'
            const Icon = isUser ? User : isAssistant ? Bot : MessageSquare

            return (
              <Card
                key={message.id}
                className={`cyber-border ${
                  isUser
                    ? 'border-cyber-cyan/30'
                    : isAssistant
                      ? 'border-cyber-green/30'
                      : 'border-border'
                }`}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-8 w-8 rounded flex items-center justify-center ${
                        isUser
                          ? 'bg-cyber-cyan/10 text-cyber-cyan'
                          : isAssistant
                            ? 'bg-cyber-green/10 text-cyber-green'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-sm font-mono uppercase">
                        {message.role}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground font-mono">
                        {formatDate(new Date(message.timestamp))}
                      </p>
                    </div>
                    <div className="text-xs font-mono text-muted-foreground">
                      #{index + 1}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap font-mono text-sm text-foreground bg-transparent p-0 border-0">
                      {message.content}
                    </pre>
                  </div>

                  {message.toolCalls &&
                    Array.isArray(message.toolCalls) &&
                    message.toolCalls.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-xs font-mono text-cyber-amber mb-2">
                          TOOL_CALLS: {message.toolCalls.length}
                        </p>
                      </div>
                    )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-xs text-muted-foreground font-mono">
          &gt; END_OF_CONVERSATION_LOG
        </p>
      </div>
    </div>
  )
}