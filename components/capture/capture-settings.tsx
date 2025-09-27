/**
 * Capture Settings Component
 * Configuration options for the capture service
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings } from 'lucide-react'

export function CaptureSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings className="mr-2 h-5 w-5" />
          Settings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Capture Mode</h4>
            <p className="text-xs text-slate-500">
              Configuration options coming soon...
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">Notifications</h4>
            <p className="text-xs text-slate-500">
              Notification settings coming soon...
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
