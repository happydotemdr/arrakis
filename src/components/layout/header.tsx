import { Terminal } from 'lucide-react'

export function Header() {
  return (
    <header className="flex h-16 items-center border-b border-border bg-card px-6 cyber-border">
      <div className="flex items-center gap-3">
        <Terminal className="h-6 w-6 text-cyber-green" />
        <h1 className="text-xl font-bold text-cyber-green cyber-glow tracking-wider">
          ARRAKIS://TERMINAL
        </h1>
      </div>
      <div className="ml-auto flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-cyber-green animate-pulse" />
          <span className="text-sm text-muted-foreground font-mono">
            SYSTEM ACTIVE
          </span>
        </div>
      </div>
    </header>
  )
}