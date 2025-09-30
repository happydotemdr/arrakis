import { api } from '@/lib/trpc/server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { MessageSquare, Database, Zap, Activity } from 'lucide-react'

export default async function DashboardPage() {
  const stats = await api.conversation.getStats()

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-cyber-green cyber-glow tracking-wider">
          &gt; SYSTEM_DASHBOARD
        </h1>
        <p className="text-muted-foreground font-mono text-sm">
          Real-time conversation monitoring and statistics
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cyber-border hover:shadow-cyber transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              Total Conversations
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-cyber-cyan" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cyber-green font-mono cyber-glow">
              {stats.totalConversations}
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              RECORDS_STORED
            </p>
          </CardContent>
        </Card>

        <Card className="cyber-border hover:shadow-cyber transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              Total Messages
            </CardTitle>
            <Database className="h-4 w-4 text-cyber-cyan" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cyber-green font-mono cyber-glow">
              {stats.totalMessages}
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              DATA_POINTS
            </p>
          </CardContent>
        </Card>

        <Card className="cyber-border hover:shadow-cyber transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              Tool Uses
            </CardTitle>
            <Zap className="h-4 w-4 text-cyber-amber" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cyber-amber font-mono">
              {stats.totalToolUses}
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              OPERATIONS_LOGGED
            </p>
          </CardContent>
        </Card>

        <Card className="cyber-border hover:shadow-cyber transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              Active Sessions
            </CardTitle>
            <Activity className="h-4 w-4 text-cyber-green" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cyber-green font-mono cyber-glow">
              {stats.activeConversations}
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              LIVE_CONNECTIONS
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="cyber-border">
          <CardHeader>
            <CardTitle className="text-cyber-green font-mono cyber-glow">
              &gt; SYSTEM_STATUS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-mono text-muted-foreground">
                Database Connection
              </span>
              <span className="text-cyber-green font-mono text-sm flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-cyber-green animate-pulse" />
                ONLINE
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-mono text-muted-foreground">
                API Status
              </span>
              <span className="text-cyber-green font-mono text-sm flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-cyber-green animate-pulse" />
                OPERATIONAL
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-mono text-muted-foreground">
                Recent Activity (7 days)
              </span>
              <span className="text-cyber-cyan font-mono text-sm">
                {stats.recentConversations} SESSIONS
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="cyber-border">
          <CardHeader>
            <CardTitle className="text-cyber-green font-mono cyber-glow">
              &gt; QUICK_ACCESS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="/conversations"
              className="block px-3 py-2 rounded text-sm font-mono text-muted-foreground hover:text-cyber-green hover:bg-muted transition-colors border border-transparent hover:border-border"
            >
              &gt; VIEW_ALL_CONVERSATIONS
            </a>
            <a
              href="/stats"
              className="block px-3 py-2 rounded text-sm font-mono text-muted-foreground hover:text-cyber-green hover:bg-muted transition-colors border border-transparent hover:border-border"
            >
              &gt; DETAILED_STATISTICS
            </a>
            <div className="block px-3 py-2 rounded text-sm font-mono text-muted-foreground/50 cursor-not-allowed">
              &gt; EXPORT_DATA [DISABLED]
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-xs text-muted-foreground font-mono">
          &gt; SYSTEM_TIMESTAMP: {new Date().toISOString()}
        </p>
      </div>
    </div>
  )
}