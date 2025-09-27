/**
 * Search Filters Component
 * Advanced search filtering options
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Filter } from 'lucide-react'

export function SearchFilters() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-sm">
          <Filter className="mr-2 h-4 w-4" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Date Range</h4>
            <p className="text-xs text-slate-500">Coming soon...</p>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">Message Type</h4>
            <p className="text-xs text-slate-500">Coming soon...</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
