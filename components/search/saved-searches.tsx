/**
 * Saved Searches Component
 * Manage saved search queries
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bookmark } from 'lucide-react'

export function SavedSearches() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-sm">
          <Bookmark className="mr-2 h-4 w-4" />
          Saved Searches
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-4">
          <p className="text-sm text-slate-500">No saved searches yet.</p>
        </div>
      </CardContent>
    </Card>
  )
}
