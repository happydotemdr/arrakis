/**
 * Header Component
 * Top header bar with user info and actions
 */

'use client'

import { Bell, User, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side - could add breadcrumbs or page title */}
        <div className="flex items-center space-x-4">
          <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600" />
          <div>
            <p className="text-sm font-medium text-slate-900">
              Claude Code Capture
            </p>
            <p className="text-xs text-slate-500">
              Real-time conversation monitoring
            </p>
          </div>
        </div>

        {/* Right side - user actions */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 text-xs"></span>
          </Button>

          {/* Settings */}
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>

          {/* User profile */}
          <Button variant="ghost" size="icon">
            <User className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}
