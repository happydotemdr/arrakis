import { api } from '@/lib/trpc/server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { MessageSquare, Clock, Terminal } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

export default async function ConversationsPage() {
  const data = await api.conversation.getAll({ limit: 50 })
  const conversations = data?.items || []

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-cyber-green cyber-glow tracking-wider">
          &gt; CONVERSATION_LOG
        </h1>
        <p className="text-muted-foreground font-mono text-sm">
          {conversations.length} conversation(s) in database
        </p>
      </div>

      {conversations.length === 0 ? (
        <Card className="cyber-border">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Terminal className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-mono text-cyber-green mb-2">
              NO_DATA_AVAILABLE
            </h3>
            <p className="text-sm text-muted-foreground font-mono text-center">
              No conversations have been recorded yet.
              <br />
              Start a conversation to see it appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {conversations.map((conversation) => (
            <Link key={conversation.id} href={`/conversations/${conversation.id}`}>
              <Card className="cyber-border hover:shadow-cyber-strong transition-all cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="h-2 w-2 rounded-full bg-cyber-green animate-pulse mt-1" />
                    <div className="text-xs font-mono text-cyber-cyan">
                      #{conversation.id.slice(0, 8)}
                    </div>
                  </div>
                  <CardTitle className="text-cyber-green font-mono text-base line-clamp-2">
                    {conversation.title}
                  </CardTitle>
                  {conversation.description && (
                    <p className="text-xs text-muted-foreground font-mono line-clamp-2 mt-2">
                      {conversation.description}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />
                        <span>{conversation._count?.messages || 0} MSG</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(new Date(conversation.updatedAt))}</span>
                      </div>
                    </div>

                    {conversation.messages && conversation.messages.length > 0 && (
                      <div className="text-xs font-mono text-muted-foreground border-t border-border pt-2">
                        <span className="text-cyber-cyan">&gt;</span>{' '}
                        {conversation.messages[0].content.slice(0, 60)}
                        {conversation.messages[0].content.length > 60 ? '...' : ''}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="border-t border-border pt-4">
        <p className="text-xs text-muted-foreground font-mono">
          &gt; QUERY_EXECUTED: {new Date().toISOString()}
        </p>
      </div>
    </div>
  )
}