/**
 * Session Header Component
 * Header for session detail page with title and actions
 */

'use client'

import { Button } from '@/components/ui/button'
import { ArrowLeft, Download, Share, Trash2 } from 'lucide-react'
import { api } from '@/components/providers/trpc-provider'
import Link from 'next/link'

interface SessionHeaderProps {
  sessionId: string
}

export function SessionHeader({ sessionId }: SessionHeaderProps) {
  const { data: session, isLoading } = api.sessions.byId.useQuery(sessionId)

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/3 mb-2"></div>
        <div className="h-4 bg-slate-200 rounded w-1/4"></div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/sessions">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sessions
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {session?.title || 'Untitled Session'}
          </h1>
          <p className="text-sm text-slate-500">Session ID: {sessionId}</p>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Button variant="outline" size="sm">
          <Share className="h-4 w-4 mr-2" />
          Share
        </Button>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        <Button variant="outline" size="sm">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </div>
    </div>
  )
}
