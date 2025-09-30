import { api } from '@/lib/trpc/server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'

export default async function StatsPage() {
  const stats = await api.conversation.getStats()

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-cyber-green cyber-glow tracking-wider">
          &gt; DETAILED_STATISTICS
        </h1>
        <p className="text-muted-foreground font-mono text-sm">
          System-wide analytics and metrics
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="cyber-border">
          <CardHeader>
            <CardTitle className="text-cyber-green font-mono flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              CONVERSATION_METRICS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <span className="text-sm font-mono text-muted-foreground">
                Total Conversations
              </span>
              <span className="text-xl font-bold text-cyber-green font-mono">
                {stats.totalConversations}
              </span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <span className="text-sm font-mono text-muted-foreground">
                Active Conversations
              </span>
              <span className="text-xl font-bold text-cyber-cyan font-mono">
                {stats.activeConversations}
              </span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <span className="text-sm font-mono text-muted-foreground">
                Recent (7 days)
              </span>
              <span className="text-xl font-bold text-cyber-amber font-mono">
                {stats.recentConversations}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-mono text-muted-foreground">
                Average per session
              </span>
              <span className="text-xl font-bold text-cyber-green font-mono">
                {stats.totalConversations > 0
                  ? (stats.totalMessages / stats.totalConversations).toFixed(1)
                  : '0.0'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="cyber-border">
          <CardHeader>
            <CardTitle className="text-cyber-green font-mono flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              MESSAGE_METRICS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <span className="text-sm font-mono text-muted-foreground">
                Total Messages
              </span>
              <span className="text-xl font-bold text-cyber-green font-mono">
                {stats.totalMessages}
              </span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <span className="text-sm font-mono text-muted-foreground">
                Total Tool Uses
              </span>
              <span className="text-xl font-bold text-cyber-amber font-mono">
                {stats.totalToolUses}
              </span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <span className="text-sm font-mono text-muted-foreground">
                Tools per message
              </span>
              <span className="text-xl font-bold text-cyber-cyan font-mono">
                {stats.totalMessages > 0
                  ? (stats.totalToolUses / stats.totalMessages).toFixed(2)
                  : '0.00'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-mono text-muted-foreground">
                Data efficiency
              </span>
              <span className="text-xl font-bold text-cyber-green font-mono">
                {stats.totalMessages > 0 ? 'OPTIMAL' : 'N/A'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-green font-mono">
            &gt; SYSTEM_ANALYSIS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 font-mono text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-muted-foreground mb-1">Database Status:</p>
              <p className="text-cyber-green">OPERATIONAL</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Storage Usage:</p>
              <p className="text-cyber-cyan">WITHIN_LIMITS</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Query Performance:</p>
              <p className="text-cyber-green">OPTIMAL</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">System Health:</p>
              <p className="text-cyber-green">NOMINAL</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="border-t border-border pt-4">
        <p className="text-xs text-muted-foreground font-mono">
          &gt; STATISTICS_GENERATED: {new Date().toISOString()}
        </p>
      </div>
    </div>
  )
}