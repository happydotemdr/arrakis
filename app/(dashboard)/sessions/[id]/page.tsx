/**
 * Session Detail Page
 * Detailed view of a single Claude Code conversation
 */

import { SessionHeader } from '@/components/sessions/session-header'
import { ConversationThread } from '@/components/sessions/conversation-thread'
import { SessionMetadata } from '@/components/sessions/session-metadata'

interface SessionDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function SessionDetailPage({
  params,
}: SessionDetailPageProps) {
  const { id: sessionId } = await params

  return (
    <div className="space-y-6">
      {/* Session header with title and actions */}
      <SessionHeader sessionId={sessionId} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main conversation thread */}
        <div className="lg:col-span-3">
          <ConversationThread sessionId={sessionId} />
        </div>

        {/* Session metadata sidebar */}
        <div className="lg:col-span-1">
          <SessionMetadata sessionId={sessionId} />
        </div>
      </div>
    </div>
  )
}
