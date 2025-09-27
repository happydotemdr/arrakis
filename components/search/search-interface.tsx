/**
 * Search Interface Component
 * Main search input and controls
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Filter } from 'lucide-react'

export function SearchInterface() {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Search className="mr-2 h-5 w-5" />
          Search Conversations
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex space-x-2">
          <Input
            placeholder="Search for messages, tools, or topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Button>
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
          <Button variant="outline">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
