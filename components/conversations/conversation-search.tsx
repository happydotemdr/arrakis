/**
 * Conversation Search Component - Phase 6 System A
 * Advanced search with autocomplete and search suggestions
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, X, Clock, Tag } from 'lucide-react'

interface ConversationSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function ConversationSearch({
  value,
  onChange,
  placeholder,
}: ConversationSearchProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('arrakis-recent-searches')
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to load recent searches:', e)
      }
    }
  }, [])

  // Save recent searches to localStorage
  const saveRecentSearch = (search: string) => {
    if (!search.trim()) return

    const updated = [
      search,
      ...recentSearches.filter((s) => s !== search),
    ].slice(0, 5)
    setRecentSearches(updated)
    localStorage.setItem('arrakis-recent-searches', JSON.stringify(updated))
  }

  // Generate search suggestions based on input
  useEffect(() => {
    if (!value.trim()) {
      setSuggestions([])
      return
    }

    // Mock suggestions - in a real app, these would come from an API
    const mockSuggestions = [
      'debugging react hooks',
      'performance optimization',
      'typescript errors',
      'database queries',
      'component architecture',
      'state management',
      'api integration',
      'error handling',
      'testing strategies',
      'build configuration',
    ]

    const filtered = mockSuggestions
      .filter(
        (suggestion) =>
          suggestion.toLowerCase().includes(value.toLowerCase()) &&
          suggestion.toLowerCase() !== value.toLowerCase()
      )
      .slice(0, 3)

    setSuggestions(filtered)
  }, [value])

  const handleSearch = (searchValue: string) => {
    onChange(searchValue)
    saveRecentSearch(searchValue)
    setIsExpanded(false)
    inputRef.current?.blur()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(value)
    } else if (e.key === 'Escape') {
      setIsExpanded(false)
      inputRef.current?.blur()
    }
  }

  const clearSearch = () => {
    onChange('')
    setIsExpanded(false)
  }

  const clearRecentSearches = () => {
    setRecentSearches([])
    localStorage.removeItem('arrakis-recent-searches')
  }

  return (
    <div className="relative">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsExpanded(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Search conversations...'}
          className="pl-10 pr-10"
        />
        {value && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSearch}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Search Dropdown */}
      {isExpanded && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
          {/* Current Suggestions */}
          {suggestions.length > 0 && (
            <div className="p-3 border-b border-slate-100">
              <h4 className="text-xs font-medium text-slate-600 mb-2">
                Suggestions
              </h4>
              <div className="space-y-1">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSearch(suggestion)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 rounded-md flex items-center"
                  >
                    <Search className="mr-2 h-3 w-3 text-slate-400" />
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div className="p-3 border-b border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-slate-600">
                  Recent Searches
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearRecentSearches}
                  className="text-xs text-slate-500 h-auto p-1"
                >
                  Clear
                </Button>
              </div>
              <div className="space-y-1">
                {recentSearches.map((search, index) => (
                  <button
                    key={index}
                    onClick={() => handleSearch(search)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 rounded-md flex items-center"
                  >
                    <Clock className="mr-2 h-3 w-3 text-slate-400" />
                    {search}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Tips */}
          <div className="p-3">
            <h4 className="text-xs font-medium text-slate-600 mb-2">
              Search Tips
            </h4>
            <div className="space-y-2 text-xs text-slate-500">
              <div className="flex items-start space-x-2">
                <Tag className="mt-0.5 h-3 w-3 flex-shrink-0" />
                <span>
                  Search by content, titles, file paths, or conversation
                  metadata
                </span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="mt-0.5 font-mono bg-slate-100 px-1 rounded text-xs">
                  tag:
                </span>
                <span>Search by tags (e.g., "tag:debugging")</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="mt-0.5 font-mono bg-slate-100 px-1 rounded text-xs">
                  model:
                </span>
                <span>Filter by model (e.g., "model:claude-3")</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="mt-0.5 font-mono bg-slate-100 px-1 rounded text-xs">
                  cost:{'>'} 5
                </span>
                <span>Filter by cost range</span>
              </div>
            </div>
          </div>

          {/* No Results */}
          {value && suggestions.length === 0 && recentSearches.length === 0 && (
            <div className="p-6 text-center text-slate-500">
              <Search className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p className="text-sm">No suggestions available</p>
              <p className="text-xs">Press Enter to search for "{value}"</p>
            </div>
          )}
        </div>
      )}

      {/* Click outside to close */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsExpanded(false)}
        />
      )}
    </div>
  )
}
