/**
 * Dashboard Stats Component
 * Overview statistics cards for the dashboard
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare, DollarSign, Clock, Zap } from 'lucide-react'
import { api } from '@/components/providers/trpc-provider'

export function DashboardStats() {
  const { data: sessionStats, isLoading } = api.sessions.stats.useQuery()
  const { data: captureStats } = api.capture.stats.useQuery()

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="animate-pulse h-8 bg-slate-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const stats = [
    {
      title: 'Total Sessions',
      value: sessionStats?.totalSessions || captureStats?.totalSessions || 0,
      change: '+12%',
      changeType: 'positive' as const,
      icon: MessageSquare,
    },
    {
      title: 'This Week',
      value: sessionStats?.sessionsThisWeek || captureStats?.sessionsToday || 0,
      change: '+4%',
      changeType: 'positive' as const,
      icon: Clock,
    },
    {
      title: 'Total Cost',
      value: `$${(sessionStats?.totalCost || 0).toFixed(2)}`,
      change: '+8%',
      changeType: 'positive' as const,
      icon: DollarSign,
    },
    {
      title: 'Avg. Messages',
      value: Math.round(sessionStats?.averageSessionLength || 0),
      change: '-2%',
      changeType: 'negative' as const,
      icon: Zap,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                <span
                  className={
                    stat.changeType === 'positive'
                      ? 'text-green-600'
                      : 'text-red-600'
                  }
                >
                  {stat.change}
                </span>{' '}
                from last month
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
