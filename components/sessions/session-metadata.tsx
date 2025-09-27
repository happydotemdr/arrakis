/**
 * Session Metadata Component
 * Display session metadata in a sidebar
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Clock,
  DollarSign,
  MessageSquare,
  FolderOpen,
  GitBranch,
} from 'lucide-react'
import { api } from '@/components/providers/trpc-provider'
import { formatDistanceToNow } from 'date-fns'

interface SessionMetadataProps {
  sessionId: string
}

export function SessionMetadata({ sessionId }: SessionMetadataProps) {
  const { data: session, isLoading } = api.sessions.byId.useQuery(sessionId)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-slate-200 rounded w-full"></div>
              <div className="h-4 bg-slate-200 rounded w-3/4"></div>
              <div className="h-4 bg-slate-200 rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!session) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session Info</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Session not found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Basic session info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <div>
              <p className="text-sm font-medium">Created</p>
              <p className="text-xs text-slate-500">
                {formatDistanceToNow(new Date(session.createdAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-slate-500" />
            <div>
              <p className="text-sm font-medium">Messages</p>
              <p className="text-xs text-slate-500">
                {session.messageCount || 0} total
              </p>
            </div>
          </div>

          {(session.metadata as any)?.performance?.totalCost && (
            <div className="flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-slate-500" />
              <div>
                <p className="text-sm font-medium">Cost</p>
                <p className="text-xs text-slate-500">
                  ${(session.metadata as any).performance.totalCost.toFixed(6)}
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium mb-1">Status</p>
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
        </CardContent>
      </Card>

      {/* Project info */}
      {(session.metadata as any)?.sessionInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(session.metadata as any).sessionInfo.projectPath && (
              <div className="flex items-start space-x-2">
                <FolderOpen className="w-4 h-4 text-slate-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Project Path</p>
                  <p className="text-xs text-slate-500 break-all">
                    {(session.metadata as any).sessionInfo.projectPath}
                  </p>
                </div>
              </div>
            )}

            {(session.metadata as any).sessionInfo.workingDirectory && (
              <div className="flex items-start space-x-2">
                <FolderOpen className="w-4 h-4 text-slate-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Working Directory</p>
                  <p className="text-xs text-slate-500 break-all">
                    {(session.metadata as any).sessionInfo.workingDirectory}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Performance info */}
      {(session.metadata as any)?.performance && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(session.metadata as any).performance.totalTokens && (
              <div>
                <p className="text-sm font-medium">Total Tokens</p>
                <p className="text-xs text-slate-500">
                  {(
                    session.metadata as any
                  ).performance.totalTokens.toLocaleString()}
                </p>
              </div>
            )}

            {(session.metadata as any).performance.duration && (
              <div>
                <p className="text-sm font-medium">Duration</p>
                <p className="text-xs text-slate-500">
                  {Math.round(
                    (session.metadata as any).performance.duration / 1000
                  )}
                  s
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
