/**
 * Sidebar Navigation
 * Main navigation sidebar for the dashboard
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Home,
  MessageSquare,
  Search,
  Settings,
  Activity,
  Database,
  BookOpen,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Sessions', href: '/sessions', icon: MessageSquare },
  { name: 'Conversations', href: '/conversations', icon: BookOpen },
  { name: 'Search', href: '/search', icon: Search },
  { name: 'Capture', href: '/capture', icon: Activity },
]

const adminNavigation = [
  { name: 'Database', href: '/database', icon: Database },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col bg-slate-900">
      {/* Logo */}
      <div className="flex h-16 items-center px-6">
        <h1 className="text-xl font-bold text-white">Arrakis</h1>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 space-y-1 px-4 py-4">
        <div className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon
                  className={cn(
                    'mr-3 h-5 w-5',
                    isActive ? 'text-white' : 'text-slate-400'
                  )}
                />
                {item.name}
              </Link>
            )
          })}
        </div>

        {/* Divider */}
        <div className="border-t border-slate-700 pt-4">
          <div className="space-y-1">
            {adminNavigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  <Icon
                    className={cn(
                      'mr-3 h-5 w-5',
                      isActive ? 'text-white' : 'text-slate-400'
                    )}
                  />
                  {item.name}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-700 p-4">
        <div className="flex items-center text-sm text-slate-400">
          <div className="h-2 w-2 rounded-full bg-green-400 mr-2" />
          Capture Service Active
        </div>
      </div>
    </div>
  )
}
