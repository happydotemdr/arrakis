/**
 * Capture Status & Settings Page
 * Monitor and configure the automatic capture service
 */

import { CaptureServiceStatus } from '@/components/capture/capture-service-status'
import { CaptureSettings } from '@/components/capture/capture-settings'
import { CaptureHistory } from '@/components/capture/capture-history'
import { CaptureSetup } from '@/components/capture/capture-setup'

export default function CapturePage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Capture Service</h1>
        <p className="text-slate-600 mt-2">
          Monitor and configure automatic Claude Code conversation capture
        </p>
      </div>

      {/* Service status */}
      <CaptureServiceStatus />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Setup instructions */}
        <div className="space-y-6">
          <CaptureSetup />
          <CaptureSettings />
        </div>

        {/* Capture history */}
        <div>
          <CaptureHistory />
        </div>
      </div>
    </div>
  )
}
