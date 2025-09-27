/**
 * Capture Setup Component
 * Setup instructions and automated configuration
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Settings, CheckCircle, AlertCircle } from 'lucide-react'

export function CaptureSetup() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings className="mr-2 h-5 w-5" />
          Setup Instructions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium">Database Connected</h4>
              <p className="text-xs text-slate-500">
                Successfully connected to Neon PostgreSQL
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium">Proxy Setup Required</h4>
              <p className="text-xs text-slate-500 mb-2">
                Add the following to your shell profile:
              </p>
              <code className="text-xs bg-slate-100 p-2 rounded block">
                export PATH="~/.arrakis:$PATH"
              </code>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium">Auto-start Configuration</h4>
              <p className="text-xs text-slate-500 mb-2">
                Configure the service to start automatically
              </p>
              <Button size="sm" variant="outline">
                Configure Auto-start
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
