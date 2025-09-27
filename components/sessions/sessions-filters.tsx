/**
 * Sessions Filters Component
 * Filter and sort options for sessions list
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Filter } from 'lucide-react'

export function SessionsFilters() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-base">
          <Filter className="mr-2 h-4 w-4" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Status</h4>
            <div className="space-y-2">
              <label className="flex items-center text-sm">
                <input type="checkbox" className="mr-2" defaultChecked />
                Active
              </label>
              <label className="flex items-center text-sm">
                <input type="checkbox" className="mr-2" defaultChecked />
                Completed
              </label>
              <label className="flex items-center text-sm">
                <input type="checkbox" className="mr-2" />
                Error
              </label>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Date Range</h4>
            <p className="text-xs text-slate-500">Date picker coming soon...</p>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Cost Range</h4>
            <p className="text-xs text-slate-500">Cost slider coming soon...</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
