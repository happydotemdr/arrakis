/**
 * Capture Status Component
 * Shows current status of the automatic capture service
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Activity, Play, Square, AlertCircle } from 'lucide-react'
import { api } from '@/components/providers/trpc-provider'

export function CaptureStatus() {
  const { data: status, isLoading } = api.capture.status.useQuery()
  const startMutation = api.capture.start.useMutation()
  const stopMutation = api.capture.stop.useMutation()

  const handleToggle = async () => {
    if (status?.running) {
      await stopMutation.mutateAsync()
    } else {
      await startMutation.mutateAsync()
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="mr-2 h-5 w-5" />
            Capture Service
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  const isRunning = status?.running || false
  const hasErrors = (status?.errors?.length || 0) > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Activity className="mr-2 h-5 w-5" />
            Capture Service
          </div>
          <div className="flex items-center space-x-2">
            <div
              className={`h-3 w-3 rounded-full ${
                isRunning ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm font-medium">
              {isRunning ? 'Active' : 'Stopped'}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Status information */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Mode</p>
              <p className="font-medium">{status?.mode || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-slate-500">Sessions Today</p>
              <p className="font-medium">{status?.sessionsToday || 0}</p>
            </div>
            <div>
              <p className="text-slate-500">Total Sessions</p>
              <p className="font-medium">{status?.totalSessions || 0}</p>
            </div>
            <div>
              <p className="text-slate-500">Last Capture</p>
              <p className="font-medium">
                {status?.lastCaptureTime
                  ? new Date(status.lastCaptureTime).toLocaleTimeString()
                  : 'Never'}
              </p>
            </div>
          </div>

          {/* Error alerts */}
          {hasErrors && (
            <div className="rounded-md bg-red-50 p-3">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-2" />
                <div>
                  <h4 className="text-sm font-medium text-red-800">
                    Capture Errors Detected
                  </h4>
                  <div className="mt-1 text-xs text-red-700">
                    {status?.errors?.slice(0, 2).map((error, index) => (
                      <p key={index}>{error}</p>
                    ))}
                    {(status?.errors?.length || 0) > 2 && (
                      <p>...and {(status?.errors?.length || 0) - 2} more</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex space-x-2">
            <Button
              onClick={handleToggle}
              disabled={startMutation.isPending || stopMutation.isPending}
              variant={isRunning ? 'destructive' : 'default'}
              size="sm"
            >
              {isRunning ? (
                <>
                  <Square className="mr-2 h-4 w-4" />
                  Stop Capture
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Capture
                </>
              )}
            </Button>
            <Button variant="outline" size="sm">
              View Settings
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
