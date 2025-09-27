/**
 * Search Results Component
 * Display search results with highlighting
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare } from 'lucide-react'

export function SearchResults() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Search Results</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <MessageSquare className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">
            No search results
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Enter a search query to find conversations.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
