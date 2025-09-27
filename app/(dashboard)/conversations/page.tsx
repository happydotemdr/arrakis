/**
 * Enhanced Conversations Page - Phase 6 System A
 * Advanced conversation management with tags, filters, and export capabilities
 */

'use client'

import { useState } from 'react'
import { ConversationBrowser } from '@/components/conversations/conversation-browser'
import { ConversationFilters } from '@/components/conversations/conversation-filters'
import { ConversationSearch } from '@/components/conversations/conversation-search'
import { ConversationActions } from '@/components/conversations/conversation-actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Plus, Download, Filter, Search, Tags } from 'lucide-react'

export type ConversationFilters = {
  dateRange?: {
    from?: Date
    to?: Date
  }
  tags?: string[]
  status?: ('active' | 'completed' | 'error')[]
  costRange?: {
    min?: number
    max?: number
  }
  models?: string[]
  sortBy?: 'date' | 'cost' | 'messages' | 'title'
  sortOrder?: 'asc' | 'desc'
  searchQuery?: string
}

export default function ConversationsPage() {
  const [activeFilters, setActiveFilters] = useState<ConversationFilters>({
    sortBy: 'date',
    sortOrder: 'desc',
  })
  const [selectedConversations, setSelectedConversations] = useState<string[]>(
    []
  )
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'timeline'>('list')

  const handleFiltersChange = (filters: ConversationFilters) => {
    setActiveFilters(filters)
  }

  const handleSelectionChange = (conversationIds: string[]) => {
    setSelectedConversations(conversationIds)
  }

  const activeFilterCount = Object.keys(activeFilters).filter(
    (key) =>
      activeFilters[key as keyof ConversationFilters] !== undefined &&
      key !== 'sortBy' &&
      key !== 'sortOrder'
  ).length

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Conversations</h1>
          <p className="text-slate-600 mt-2">
            Manage, search, and analyze your Claude Code conversations with
            advanced filtering and organization
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {selectedConversations.length > 0 && (
            <Badge variant="secondary" className="text-sm">
              {selectedConversations.length} selected
            </Badge>
          )}
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={selectedConversations.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export ({selectedConversations.length})
          </Button>
        </div>
      </div>

      {/* Enhanced Search and Controls */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            {/* Search Bar */}
            <div className="flex-1">
              <ConversationSearch
                value={activeFilters.searchQuery || ''}
                onChange={(query) =>
                  setActiveFilters((prev) => ({ ...prev, searchQuery: query }))
                }
                placeholder="Search conversations by content, title, or metadata..."
              />
            </div>

            {/* View Mode Toggle */}
            <Tabs
              value={viewMode}
              onValueChange={(value) => setViewMode(value as typeof viewMode)}
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="list">List</TabsTrigger>
                <TabsTrigger value="grid">Grid</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Filters Toggle */}
            <Button
              variant="outline"
              size="sm"
              className={
                activeFilterCount > 0 ? 'bg-blue-50 border-blue-200' : ''
              }
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
            </Button>
          </div>

          {/* Active Filters Display */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-200">
              {activeFilters.tags && activeFilters.tags.length > 0 && (
                <div className="flex items-center space-x-1">
                  <Tags className="h-3 w-3 text-slate-500" />
                  {activeFilters.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              {activeFilters.status && activeFilters.status.length > 0 && (
                <div className="flex space-x-1">
                  {activeFilters.status.map((status) => (
                    <Badge key={status} variant="outline" className="text-xs">
                      {status}
                    </Badge>
                  ))}
                </div>
              )}
              {activeFilters.dateRange && activeFilters.dateRange.from && activeFilters.dateRange.to && (
                <Badge variant="outline" className="text-xs">
                  {activeFilters.dateRange.from.toLocaleDateString()} -{' '}
                  {activeFilters.dateRange.to.toLocaleDateString()}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setActiveFilters({ sortBy: 'date', sortOrder: 'desc' })
                }
                className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700"
              >
                Clear all
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters Sidebar (collapsible) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <ConversationFilters
            filters={activeFilters}
            onChange={handleFiltersChange}
          />
        </div>

        {/* Main Conversation Browser */}
        <div className="lg:col-span-3">
          <ConversationBrowser
            filters={activeFilters}
            viewMode={viewMode}
            selectedConversations={selectedConversations}
            onSelectionChange={handleSelectionChange}
          />
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedConversations.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <Card className="shadow-lg border-blue-200">
            <CardContent className="p-4">
              <ConversationActions
                selectedConversations={selectedConversations}
                onActionComplete={() => setSelectedConversations([])}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
