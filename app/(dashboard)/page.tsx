/**
 * Dashboard Overview Page
 * Main dashboard showing capture statistics and recent sessions
 */

import { DashboardStats } from '@/components/dashboard/dashboard-stats'
import { RecentSessions } from '@/components/dashboard/recent-sessions'
import { CaptureStatus } from '@/components/dashboard/capture-status'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-2">
          Overview of your Claude Code conversation capture activity
        </p>
      </div>

      {/* Capture status card */}
      <CaptureStatus />

      {/* Stats grid */}
      <DashboardStats />

      {/* Recent sessions */}
      <RecentSessions />
    </div>
  )
}
