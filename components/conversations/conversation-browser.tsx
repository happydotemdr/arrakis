/**
 * Conversation Browser Component - Phase 6 System A
 * Advanced conversation display with multiple view modes, sorting, and selection
 */

'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { api } from '@/components/providers/trpc-provider'
import { formatDistanceToNow } from 'date-fns'
import {
  MessageSquare,
  Clock,
  DollarSign,
  ExternalLink,
  Tag,
  Cpu,
  FileText,
  Calendar,
  TrendingUp,
  Grid3X3,
  List,
} from 'lucide-react'

interface ConversationBrowserProps {
  filters: {
    dateRange?: { from?: Date; to?: Date }
    tags?: string[]
    status?: ('active' | 'completed' | 'error')[]
    costRange?: { min?: number; max?: number }
    models?: string[]
    sortBy?: 'date' | 'cost' | 'messages' | 'title'
    sortOrder?: 'asc' | 'desc'
    searchQuery?: string
  }
  viewMode: 'list' | 'grid' | 'timeline'
  selectedConversations: string[]
  onSelectionChange: (conversationIds: string[]) => void
}

export function ConversationBrowser({
  filters,
  viewMode,
  selectedConversations,
  onSelectionChange,
}: ConversationBrowserProps) {
  const { data: conversationsData, isLoading } = api.sessions.list.useQuery({
    pagination: { limit: 50 },
    filters: {
      startDate: filters.dateRange?.from?.toISOString(),
      endDate: filters.dateRange?.to?.toISOString(),
      status: filters.status?.[0], // For now, handle single status
    },
  })

  // Filter and sort conversations based on filters
  const filteredConversations = useMemo(() => {
    let conversations = conversationsData?.sessions || []

    // Apply search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      conversations = conversations.filter(
        (conv) =>
          conv.title?.toLowerCase().includes(query) ||
          (conv.metadata as any)?.sessionInfo?.projectPath
            ?.toLowerCase()
            .includes(query)
      )
    }

    // Apply cost range filter
    if (filters.costRange) {
      conversations = conversations.filter((conv) => {
        const cost = (conv.metadata as any)?.performance?.totalCost || 0
        return (
          cost >= (filters.costRange?.min || 0) &&
          cost <= (filters.costRange?.max || Infinity)
        )
      })
    }

    // Apply sorting
    if (filters.sortBy) {
      conversations.sort((a, b) => {
        let aValue: any, bValue: any

        switch (filters.sortBy) {
          case 'date':
            aValue = new Date(a.createdAt)
            bValue = new Date(b.createdAt)
            break
          case 'cost':
            aValue = (a.metadata as any)?.performance?.totalCost || 0
            bValue = (b.metadata as any)?.performance?.totalCost || 0
            break
          case 'messages':
            aValue = a.messageCount || 0
            bValue = b.messageCount || 0
            break
          case 'title':
            aValue = a.title || 'Untitled'
            bValue = b.title || 'Untitled'
            break
          default:
            return 0
        }

        if (aValue < bValue) return filters.sortOrder === 'asc' ? -1 : 1
        if (aValue > bValue) return filters.sortOrder === 'asc' ? 1 : -1
        return 0
      })
    }

    return conversations
  }, [conversationsData?.sessions, filters])

  const handleConversationSelect = (
    conversationId: string,
    selected: boolean
  ) => {
    if (selected) {
      onSelectionChange([...selectedConversations, conversationId])
    } else {
      onSelectionChange(
        selectedConversations.filter((id) => id !== conversationId)
      )
    }
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      onSelectionChange(filteredConversations.map((conv) => conv.id))
    } else {
      onSelectionChange([])
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (filteredConversations.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <MessageSquare className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">
            No conversations found
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {filters.searchQuery || Object.keys(filters).length > 2
              ? 'Try adjusting your filters or search criteria.'
              : 'Start using Claude Code to see captured conversations here.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  // List View
  if (viewMode === 'list') {
    return (
      <div className="space-y-4">
        {/* Select All Header */}
        <div className="flex items-center space-x-3 px-2 py-1 text-sm text-slate-600">
          <Checkbox
            checked={
              selectedConversations.length === filteredConversations.length
            }
            onCheckedChange={handleSelectAll}
          />
          <span>
            {selectedConversations.length > 0
              ? `${selectedConversations.length} of ${filteredConversations.length} selected`
              : `${filteredConversations.length} conversations`}
          </span>
        </div>

        {filteredConversations.map((conversation) => (
          <Card
            key={conversation.id}
            className="hover:shadow-md transition-shadow"
          >
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                {/* Selection Checkbox */}
                <Checkbox
                  checked={selectedConversations.includes(conversation.id)}
                  onCheckedChange={(checked) =>
                    handleConversationSelect(
                      conversation.id,
                      checked as boolean
                    )
                  }
                />

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-lg font-medium text-slate-900 truncate">
                      {conversation.title || 'Untitled Session'}
                    </h3>
                    <Badge
                      variant={
                        conversation.status === 'completed'
                          ? 'default'
                          : conversation.status === 'active'
                            ? 'secondary'
                            : 'destructive'
                      }
                    >
                      {conversation.status}
                    </Badge>
                  </div>

                  {/* Metadata Row */}
                  <div className="flex items-center space-x-6 text-sm text-slate-500 mb-3">
                    <div className="flex items-center">
                      <Clock className="mr-1 h-4 w-4" />
                      {formatDistanceToNow(new Date(conversation.createdAt), {
                        addSuffix: true,
                      })}
                    </div>
                    <div className="flex items-center">
                      <MessageSquare className="mr-1 h-4 w-4" />
                      {conversation.messageCount || 0} messages
                    </div>
                    {(conversation.metadata as any)?.performance?.totalCost && (
                      <div className="flex items-center">
                        <DollarSign className="mr-1 h-4 w-4" />$
                        {(
                          conversation.metadata as any
                        ).performance.totalCost.toFixed(4)}
                      </div>
                    )}
                    {(conversation.metadata as any)?.sessionInfo?.model && (
                      <div className="flex items-center">
                        <Cpu className="mr-1 h-4 w-4" />
                        {(conversation.metadata as any).sessionInfo.model}
                      </div>
                    )}
                  </div>

                  {/* Project Path */}
                  {(conversation.metadata as any)?.sessionInfo?.projectPath && (
                    <p className="text-xs text-slate-400 mb-2">
                      📁{' '}
                      {(conversation.metadata as any).sessionInfo.projectPath}
                    </p>
                  )}

                  {/* Tags (Mock for now - will be real when backend supports it) */}
                  <div className="flex items-center space-x-2">
                    <Tag className="h-3 w-3 text-slate-400" />
                    <div className="flex space-x-1">
                      <Badge variant="outline" className="text-xs">
                        development
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        debugging
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/sessions/${conversation.id}`}>
                      View
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Grid View
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredConversations.map((conversation) => (
          <Card
            key={conversation.id}
            className="hover:shadow-md transition-shadow"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <Checkbox
                  checked={selectedConversations.includes(conversation.id)}
                  onCheckedChange={(checked) =>
                    handleConversationSelect(
                      conversation.id,
                      checked as boolean
                    )
                  }
                />
                <Badge variant="outline" className="text-xs">
                  {conversation.status}
                </Badge>
              </div>

              <h3 className="font-medium text-slate-900 mb-2 line-clamp-2">
                {conversation.title || 'Untitled Session'}
              </h3>

              <div className="space-y-2 text-sm text-slate-500 mb-4">
                <div className="flex items-center">
                  <Calendar className="mr-1 h-3 w-3" />
                  {formatDistanceToNow(new Date(conversation.createdAt), {
                    addSuffix: true,
                  })}
                </div>
                <div className="flex items-center">
                  <MessageSquare className="mr-1 h-3 w-3" />
                  {conversation.messageCount || 0} messages
                </div>
                {(conversation.metadata as any)?.performance?.totalCost && (
                  <div className="flex items-center">
                    <TrendingUp className="mr-1 h-3 w-3" />$
                    {(
                      conversation.metadata as any
                    ).performance.totalCost.toFixed(4)}
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center">
                <div className="flex space-x-1">
                  <Badge variant="secondary" className="text-xs">
                    dev
                  </Badge>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/sessions/${conversation.id}`}>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Timeline View
  if (viewMode === 'timeline') {
    return (
      <div className="space-y-6">
        {filteredConversations.map((conversation, index) => (
          <div key={conversation.id} className="flex">
            {/* Timeline Line */}
            <div className="flex flex-col items-center mr-4">
              <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow"></div>
              {index < filteredConversations.length - 1 && (
                <div className="w-px h-16 bg-slate-200 mt-2"></div>
              )}
            </div>

            {/* Content */}
            <Card className="flex-1 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      checked={selectedConversations.includes(conversation.id)}
                      onCheckedChange={(checked) =>
                        handleConversationSelect(
                          conversation.id,
                          checked as boolean
                        )
                      }
                    />
                    <div>
                      <h3 className="font-medium text-slate-900 mb-1">
                        {conversation.title || 'Untitled Session'}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {formatDistanceToNow(new Date(conversation.createdAt), {
                          addSuffix: true,
                        })}{' '}
                        • {conversation.messageCount || 0} messages
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/sessions/${conversation.id}`}>
                      View
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    )
  }

  return null
}
