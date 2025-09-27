/**
 * Conversation Filters Component - Phase 6 System A
 * Advanced filtering sidebar with tags, date ranges, costs, and more
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { format } from 'date-fns'
import {
  CalendarIcon,
  ChevronDown,
  ChevronUp,
  Filter,
  Tag,
  DollarSign,
  Cpu,
  Clock,
  X,
} from 'lucide-react'

interface ConversationFiltersProps {
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
  onChange: (filters: any) => void
}

export function ConversationFilters({
  filters,
  onChange,
}: ConversationFiltersProps) {
  const [expandedSections, setExpandedSections] = useState({
    date: true,
    tags: true,
    status: true,
    cost: true,
    models: true,
    sort: true,
  })

  // Mock data - in real app, these would come from APIs
  const availableTags = [
    { id: 1, name: 'debugging', color: '#ef4444', count: 23 },
    { id: 2, name: 'development', color: '#10b981', count: 45 },
    { id: 3, name: 'learning', color: '#3b82f6', count: 12 },
    { id: 4, name: 'research', color: '#8b5cf6', count: 8 },
    { id: 5, name: 'optimization', color: '#f59e0b', count: 15 },
    { id: 6, name: 'planning', color: '#06b6d4', count: 7 },
    { id: 7, name: 'review', color: '#ec4899', count: 19 },
  ]

  const availableModels = [
    { name: 'claude-3-5-sonnet-20241022', count: 67 },
    { name: 'claude-3-opus-20240229', count: 23 },
    { name: 'claude-3-haiku-20240307', count: 12 },
    { name: 'gpt-4-turbo', count: 8 },
  ]

  const statusOptions = [
    { value: 'active', label: 'Active', count: 12 },
    { value: 'completed', label: 'Completed', count: 89 },
    { value: 'error', label: 'Error', count: 3 },
  ]

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const updateFilters = (newFilters: Partial<typeof filters>) => {
    onChange({ ...filters, ...newFilters })
  }

  const toggleTag = (tagName: string) => {
    const currentTags = filters.tags || []
    const newTags = currentTags.includes(tagName)
      ? currentTags.filter((t) => t !== tagName)
      : [...currentTags, tagName]
    updateFilters({ tags: newTags })
  }

  const toggleStatus = (status: 'active' | 'completed' | 'error') => {
    const currentStatus = filters.status || []
    const newStatus = currentStatus.includes(status)
      ? currentStatus.filter((s) => s !== status)
      : [...currentStatus, status]
    updateFilters({ status: newStatus })
  }

  const toggleModel = (model: string) => {
    const currentModels = filters.models || []
    const newModels = currentModels.includes(model)
      ? currentModels.filter((m) => m !== model)
      : [...currentModels, model]
    updateFilters({ models: newModels })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-base">
          <Filter className="mr-2 h-4 w-4" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Range Filter */}
        <div>
          <Button
            variant="ghost"
            onClick={() => toggleSection('date')}
            className="w-full justify-between p-0 h-auto font-medium text-sm"
          >
            <div className="flex items-center">
              <CalendarIcon className="mr-2 h-4 w-4" />
              Date Range
            </div>
            {expandedSections.date ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {expandedSections.date && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs">
                      {filters.dateRange?.from
                        ? format(filters.dateRange.from, 'MMM dd')
                        : 'From'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.dateRange?.from}
                      onSelect={(date) =>
                        updateFilters({
                          dateRange: {
                            from: date,
                            to: filters.dateRange?.to,
                          },
                        })
                      }
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs">
                      {filters.dateRange?.to
                        ? format(filters.dateRange.to, 'MMM dd')
                        : 'To'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.dateRange?.to}
                      onSelect={(date) =>
                        updateFilters({
                          dateRange: {
                            from: filters.dateRange?.from,
                            to: date,
                          },
                        })
                      }
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex space-x-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateFilters({
                      dateRange: {
                        from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                        to: new Date(),
                      },
                    })
                  }
                  className="text-xs"
                >
                  Last 7 days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateFilters({
                      dateRange: {
                        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                        to: new Date(),
                      },
                    })
                  }
                  className="text-xs"
                >
                  Last 30 days
                </Button>
              </div>

              {filters.dateRange && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateFilters({ dateRange: undefined })}
                  className="text-xs text-slate-500"
                >
                  <X className="mr-1 h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Tags Filter */}
        <div>
          <Button
            variant="ghost"
            onClick={() => toggleSection('tags')}
            className="w-full justify-between p-0 h-auto font-medium text-sm"
          >
            <div className="flex items-center">
              <Tag className="mr-2 h-4 w-4" />
              Tags{' '}
              {filters.tags &&
                filters.tags.length > 0 &&
                `(${filters.tags.length})`}
            </div>
            {expandedSections.tags ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {expandedSections.tags && (
            <div className="mt-3 space-y-2">
              {availableTags.map((tag) => (
                <div key={tag.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={filters.tags?.includes(tag.name) || false}
                      onCheckedChange={() => toggleTag(tag.name)}
                    />
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm">{tag.name}</span>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500">{tag.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Status Filter */}
        <div>
          <Button
            variant="ghost"
            onClick={() => toggleSection('status')}
            className="w-full justify-between p-0 h-auto font-medium text-sm"
          >
            <div className="flex items-center">
              <Clock className="mr-2 h-4 w-4" />
              Status{' '}
              {filters.status &&
                filters.status.length > 0 &&
                `(${filters.status.length})`}
            </div>
            {expandedSections.status ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {expandedSections.status && (
            <div className="mt-3 space-y-2">
              {statusOptions.map((status) => (
                <div
                  key={status.value}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={
                        filters.status?.includes(status.value as any) || false
                      }
                      onCheckedChange={() => toggleStatus(status.value as any)}
                    />
                    <span className="text-sm">{status.label}</span>
                  </div>
                  <span className="text-xs text-slate-500">{status.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Cost Range Filter */}
        <div>
          <Button
            variant="ghost"
            onClick={() => toggleSection('cost')}
            className="w-full justify-between p-0 h-auto font-medium text-sm"
          >
            <div className="flex items-center">
              <DollarSign className="mr-2 h-4 w-4" />
              Cost Range
            </div>
            {expandedSections.cost ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {expandedSections.cost && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Min ($)</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={filters.costRange?.min || ''}
                    onChange={(e) =>
                      updateFilters({
                        costRange: {
                          min: parseFloat(e.target.value) || 0,
                          max: filters.costRange?.max,
                        },
                      })
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Max ($)</Label>
                  <Input
                    type="number"
                    placeholder="∞"
                    value={filters.costRange?.max || ''}
                    onChange={(e) =>
                      updateFilters({
                        costRange: {
                          min: filters.costRange?.min,
                          max: parseFloat(e.target.value) || undefined,
                        },
                      })
                    }
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Models Filter */}
        <div>
          <Button
            variant="ghost"
            onClick={() => toggleSection('models')}
            className="w-full justify-between p-0 h-auto font-medium text-sm"
          >
            <div className="flex items-center">
              <Cpu className="mr-2 h-4 w-4" />
              Models{' '}
              {filters.models &&
                filters.models.length > 0 &&
                `(${filters.models.length})`}
            </div>
            {expandedSections.models ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {expandedSections.models && (
            <div className="mt-3 space-y-2">
              {availableModels.map((model) => (
                <div
                  key={model.name}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={filters.models?.includes(model.name) || false}
                      onCheckedChange={() => toggleModel(model.name)}
                    />
                    <span className="text-sm truncate" title={model.name}>
                      {model.name
                        .replace(/claude-3-|-\d{8}/g, '')
                        .replace(/gpt-/, 'GPT-')}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">{model.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Sort Options */}
        <div>
          <Button
            variant="ghost"
            onClick={() => toggleSection('sort')}
            className="w-full justify-between p-0 h-auto font-medium text-sm"
          >
            Sort & Order
            {expandedSections.sort ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {expandedSections.sort && (
            <div className="mt-3 space-y-3">
              <div>
                <Label className="text-xs">Sort by</Label>
                <Select
                  value={filters.sortBy || 'date'}
                  onValueChange={(value) =>
                    updateFilters({ sortBy: value as any })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="cost">Cost</SelectItem>
                    <SelectItem value="messages">Messages</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Order</Label>
                <Select
                  value={filters.sortOrder || 'desc'}
                  onValueChange={(value) =>
                    updateFilters({ sortOrder: value as any })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Clear All Filters */}
        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange({ sortBy: 'date', sortOrder: 'desc' })}
            className="w-full text-xs"
          >
            Clear All Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
