/**
 * Claude Code Sessions Monitor
 * Real-time monitoring of Claude Code task sessions
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Square,
  Eye,
  ExternalLink,
  RefreshCw,
  Terminal,
  FileText
} from 'lucide-react'
import { api } from '@/components/providers/trpc-provider'
import { formatDistanceToNow } from 'date-fns'

interface Session {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  title: string
  startTime: Date
  endTime?: Date
  duration: number
  hasOutput: boolean
  hasError: boolean
  conversationId?: string
}

export function ClaudeCodeSessions() {
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Fetch all sessions
  const { data: sessionsData, isLoading, refetch } = api.claudeCode.getAllSessions.useQuery(
    undefined,
    {
      refetchInterval: autoRefresh ? 2000 : false, // Refresh every 2 seconds if enabled
    }
  )

  // Fetch detailed session data
  const { data: sessionDetail, refetch: refetchDetail } = api.claudeCode.getSession.useQuery(
    { sessionId: selectedSession! },
    {
      enabled: !!selectedSession,
      refetchInterval: selectedSession && autoRefresh ? 2000 : false,
    }
  )

  // Stop session mutation
  const stopSessionMutation = api.claudeCode.stopSession.useMutation({
    onSuccess: () => {
      console.log('Session Stopped: The Claude Code session has been stopped.')
      refetch()
    },
    onError: (error: any) => {
      console.error('Failed to Stop Session:', error.message)
    }
  })

  const sessions = sessionsData?.sessions || []
  const runningSessions = sessions.filter((s: any) => s.status === 'running')
  const completedSessions = sessions.filter((s: any) => s.status === 'completed')
  const failedSessions = sessions.filter((s: any) => s.status === 'failed')

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Running</Badge>
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="secondary">Pending</Badge>
    }
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  const handleStopSession = async (sessionId: string) => {
    await stopSessionMutation.mutateAsync({ sessionId })
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading sessions...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Sessions</span>
              <span className="text-2xl font-bold">{sessions.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Running</span>
              <span className="text-2xl font-bold text-blue-600">{runningSessions.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Completed</span>
              <span className="text-2xl font-bold text-green-600">{completedSessions.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Failed</span>
              <span className="text-2xl font-bold text-red-600">{failedSessions.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Sessions Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sessions List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Claude Code Sessions</CardTitle>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
                  {autoRefresh ? 'Auto' : 'Manual'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {sessions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No Claude Code sessions found.
                    <br />
                    Start a task to see sessions here.
                  </div>
                ) : (
                  sessions.map((session: any) => (
                    <div
                      key={session.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedSession === session.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedSession(session.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(session.status)}
                          <span className="font-medium text-sm">{session.title}</span>
                        </div>
                        {getStatusBadge(session.status)}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Started {formatDistanceToNow(new Date(session.startTime))} ago</div>
                        <div>Duration: {formatDuration(session.duration)}</div>
                        {session.conversationId && (
                          <div className="flex items-center">
                            <FileText className="h-3 w-3 mr-1" />
                            Captured to database
                          </div>
                        )}
                      </div>
                      {session.status === 'running' && (
                        <div className="mt-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStopSession(session.id)
                            }}
                          >
                            <Square className="h-3 w-3 mr-1" />
                            Stop
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Session Detail */}
        <Card>
          <CardHeader>
            <CardTitle>Session Details</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedSession ? (
              <div className="text-center py-8 text-muted-foreground">
                Select a session to view details
              </div>
            ) : !sessionDetail ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading session details...
              </div>
            ) : (
              <div className="space-y-4">
                {/* Session Info */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status</span>
                    {getStatusBadge(sessionDetail.session.status)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Duration</span>
                    <span className="text-sm">{formatDuration(sessionDetail.session.duration)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Started</span>
                    <span className="text-sm">
                      {formatDistanceToNow(new Date(sessionDetail.session.startTime))} ago
                    </span>
                  </div>
                  {sessionDetail.session.conversationId && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Conversation</span>
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/sessions/${sessionDetail.session.conversationId}`}>
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View
                        </a>
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Session Output */}
                <div>
                  <div className="flex items-center mb-2">
                    <Terminal className="h-4 w-4 mr-2" />
                    <span className="font-medium text-sm">Output</span>
                  </div>
                  <ScrollArea className="h-[200px] w-full border rounded-md p-3 bg-muted/30">
                    {sessionDetail.session.output ? (
                      <pre className="text-xs whitespace-pre-wrap font-mono">
                        {sessionDetail.session.output}
                      </pre>
                    ) : (
                      <div className="text-xs text-muted-foreground space-y-2">
                        {sessionDetail.session.status === 'running' ? (
                          <div>
                            <div className="flex items-center space-x-2 mb-2">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Claude Code is executing...</span>
                            </div>
                            <div className="pl-5 space-y-1 text-xs">
                              <div>• Reading and analyzing codebase</div>
                              <div>• Running commands and tools</div>
                              <div>• Processing and generating output</div>
                            </div>
                            <div className="mt-2 text-xs italic">
                              Output will appear here as Claude Code works
                            </div>
                          </div>
                        ) : (
                          'No output available'
                        )}
                      </div>
                    )}
                  </ScrollArea>
                </div>

                {/* Error Display */}
                {sessionDetail.session.error && (
                  <div>
                    <div className="flex items-center mb-2">
                      <XCircle className="h-4 w-4 mr-2 text-red-500" />
                      <span className="font-medium text-sm text-red-700">Error</span>
                    </div>
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                      <pre className="text-xs text-red-700 whitespace-pre-wrap">
                        {sessionDetail.session.error}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex space-x-2">
                  {sessionDetail.session.status === 'running' && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleStopSession(selectedSession)}
                    >
                      <Square className="h-3 w-3 mr-1" />
                      Stop Session
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => refetchDetail()}>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Refresh
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}