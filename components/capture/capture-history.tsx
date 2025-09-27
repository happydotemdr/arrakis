/**
 * Capture History Component
 * Shows capture event history and logs
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { History } from 'lucide-react'

export function CaptureHistory() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <History className="mr-2 h-5 w-5" />
          Capture History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <History className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">
            No capture events yet
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Capture events will appear here once you start using Claude Code.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
