/**
 * Sessions List Page
 * Browse and filter all captured Claude Code sessions
 */

import { SessionsList } from '@/components/sessions/sessions-list'
import { SessionsFilters } from '@/components/sessions/sessions-filters'
import { SessionsSearch } from '@/components/sessions/sessions-search'

export default function SessionsPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Sessions</h1>
          <p className="text-slate-600 mt-2">
            Browse and manage your captured Claude Code conversations
          </p>
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <SessionsSearch />
        </div>
        <div className="lg:w-80">
          <SessionsFilters />
        </div>
      </div>

      {/* Sessions list */}
      <SessionsList />
    </div>
  )
}
