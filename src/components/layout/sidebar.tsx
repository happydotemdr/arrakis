'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, MessageSquare, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'DASHBOARD', icon: Home },
  { href: '/conversations', label: 'CONVERSATIONS', icon: MessageSquare },
  { href: '/stats', label: 'STATISTICS', icon: BarChart3 },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 border-r border-border bg-card cyber-border flex-shrink-0">
      <div className="p-4 border-b border-border">
        <div className="text-xs text-muted-foreground font-mono">
          &gt; NAVIGATION_MENU
        </div>
      </div>
      <nav className="flex flex-col gap-1 p-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded px-3 py-2 font-mono text-sm transition-all',
                isActive
                  ? 'bg-primary/10 text-cyber-green cyber-glow border border-primary/30'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground hover:border hover:border-border',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="absolute bottom-4 left-4 right-4">
        <div className="text-xs text-muted-foreground font-mono border-t border-border pt-4">
          &gt; v0.1.0_ALPHA
        </div>
      </div>
    </aside>
  )
}