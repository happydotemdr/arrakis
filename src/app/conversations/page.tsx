'use client'

import { api } from '@/lib/trpc/provider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDate, truncateText } from '@/lib/utils'
import { MessageSquare, Plus, Clock } from 'lucide-react'
import Link from 'next/link'

export default function ConversationsPage() {
  const { data: conversations, isLoading, error } = api.conversation.getAll.useQuery()

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-lg text-muted-foreground">Loading conversations...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-lg text-red-600">Error loading conversations: {error.message}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Conversations</h1>
            <p className="text-muted-foreground mt-2">
              Manage your conversation history
            </p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Conversation
          </Button>
        </div>

        {!conversations || conversations.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No conversations yet</h3>
            <p className="text-muted-foreground mb-6">
              Start your first conversation to see it here.
            </p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Conversation
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {conversations.map((conversation) => (
              <Card key={conversation.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg line-clamp-2">
                    {conversation.title}
                  </CardTitle>
                  {conversation.description && (
                    <CardDescription className="line-clamp-2">
                      {truncateText(conversation.description, 100)}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {conversation.messages && conversation.messages.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        <strong>Last message:</strong>{' '}
                        {truncateText(conversation.messages[0].content, 80)}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        <span>{conversation._count?.messages || 0} messages</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>{formatDate(new Date(conversation.updatedAt))}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Link href={`/conversations/${conversation.id}`} className="flex-1">
                        <Button size="sm" className="w-full">
                          View
                        </Button>
                      </Link>
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}