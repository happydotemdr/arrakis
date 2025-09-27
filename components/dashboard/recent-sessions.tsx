/**
 * Recent Sessions Component
 * Shows the most recent conversation sessions
 */

'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageSquare, Clock, DollarSign, ExternalLink } from 'lucide-react'
import { api } from '@/components/providers/trpc-provider'
import { formatDistanceToNow } from 'date-fns'

export function RecentSessions() {
  const { data: sessionsData, isLoading } = api.sessions.list.useQuery({
    pagination: { limit: 5 },
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const sessions = sessionsData?.sessions || []

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center">
          <MessageSquare className="mr-2 h-5 w-5" />
          Recent Sessions
        </CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/sessions">
            View All
            <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-2 text-sm font-medium text-slate-900">
              No sessions yet
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Start using Claude Code to see captured conversations here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-start justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-medium text-slate-900 truncate">
                      {session.title || 'Untitled Session'}
                    </h4>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        session.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : session.status === 'active'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {session.status}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center space-x-4 text-xs text-slate-500">
                    <div className="flex items-center">
                      <Clock className="mr-1 h-3 w-3" />
                      {formatDistanceToNow(new Date(session.createdAt), {
                        addSuffix: true,
                      })}
                    </div>
                    <div className="flex items-center">
                      <MessageSquare className="mr-1 h-3 w-3" />
                      {session.messageCount || 0} messages
                    </div>
                    {(session.metadata as any)?.performance?.totalCost && (
                      <div className="flex items-center">
                        <DollarSign className="mr-1 h-3 w-3" />$
                        {(
                          session.metadata as any
                        ).performance.totalCost.toFixed(4)}
                      </div>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/dashboard/sessions/${session.id}`}>
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
