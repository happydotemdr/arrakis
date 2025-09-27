/**
 * Capture Service Status Component
 * Detailed status view for the capture service
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity } from 'lucide-react'

export function CaptureServiceStatus() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Activity className="mr-2 h-5 w-5" />
          Service Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Service Status</span>
            <span className="text-sm text-green-600">Running</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Capture Mode</span>
            <span className="text-sm">Proxy</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Sessions Captured</span>
            <span className="text-sm">0</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
