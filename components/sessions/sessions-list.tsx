/**
 * Sessions List Component
 * Paginated list of all captured sessions
 */

'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageSquare, Clock, DollarSign, ExternalLink } from 'lucide-react'
import { api } from '@/components/providers/trpc-provider'
import { formatDistanceToNow } from 'date-fns'

export function SessionsList() {
  const { data: sessionsData, isLoading } = api.sessions.list.useQuery({
    pagination: { limit: 20 },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const allSessions = sessionsData?.sessions || []

  if (allSessions.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <MessageSquare className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">
            No sessions found
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Start using Claude Code to see captured conversations here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {allSessions.map((session) => (
        <Card key={session.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-2">
                  <h3 className="text-lg font-medium text-slate-900 truncate">
                    {session.title || 'Untitled Session'}
                  </h3>
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

                <div className="flex items-center space-x-6 text-sm text-slate-500">
                  <div className="flex items-center">
                    <Clock className="mr-1 h-4 w-4" />
                    {formatDistanceToNow(new Date(session.createdAt), {
                      addSuffix: true,
                    })}
                  </div>
                  <div className="flex items-center">
                    <MessageSquare className="mr-1 h-4 w-4" />
                    {session.messageCount || 0} messages
                  </div>
                  {(session.metadata as any)?.performance?.totalCost && (
                    <div className="flex items-center">
                      <DollarSign className="mr-1 h-4 w-4" />$
                      {(session.metadata as any).performance.totalCost.toFixed(
                        4
                      )}
                    </div>
                  )}
                </div>

                {(session.metadata as any)?.sessionInfo?.projectPath && (
                  <p className="mt-2 text-xs text-slate-400">
                    {(session.metadata as any).sessionInfo.projectPath}
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2 ml-4">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/sessions/${session.id}`}>
                    View
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Load more functionality can be added later with infinite queries */}
    </div>
  )
}
