/**
 * Semantic Search Component
 * Enhanced search interface with AI-powered semantic search
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Filter,
  MessageSquare,
  Brain,
  Clock,
  User,
  Bot,
  ChevronRight,
  Sparkles
} from 'lucide-react'
import { api } from '@/components/providers/trpc-provider'

interface SearchResult {
  type: 'message' | 'session'
  id: string
  content: string
  similarity?: number
  metadata: {
    sessionId?: string
    messageId?: number
    timestamp?: string
    role?: string
    title?: string
    messageCount?: number
  }
  context?: {
    before?: Array<{ role: string; content: string; timestamp: string }>
    after?: Array<{ role: string; content: string; timestamp: string }>
  }
}

export function SemanticSearch() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchType, setSearchType] = useState<'semantic' | 'hybrid' | 'text'>('hybrid')
  const [hasSearched, setHasSearched] = useState(false)

  const {
    data: searchResults,
    isLoading,
    error,
    refetch
  } = api.search.conversations.useQuery(
    {
      query: searchQuery,
      type: searchType,
      limit: 20,
    },
    {
      enabled: false, // Only run when explicitly triggered
    }
  )

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      setHasSearched(true)
      refetch()
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const formatSimilarity = (similarity?: number) => {
    if (!similarity) return ''
    return `${(similarity * 100).toFixed(1)}%`
  }

  const truncateContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + '...'
  }

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return ''
    return new Date(timestamp).toLocaleString()
  }

  return (
    <div className="space-y-6">
      {/* Search Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Brain className="mr-2 h-5 w-5 text-blue-500" />
            Semantic Search
            <Sparkles className="ml-2 h-4 w-4 text-yellow-500" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="flex space-x-2">
            <Input
              placeholder="Ask anything about your conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button
              onClick={handleSearch}
              disabled={!searchQuery.trim() || isLoading}
            >
              {isLoading ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {isLoading ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Search Type Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Search type:</span>
            {(['semantic', 'hybrid', 'text'] as const).map((type) => (
              <Button
                key={type}
                variant={searchType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchType(type)}
              >
                {type === 'semantic' && <Brain className="h-3 w-3 mr-1" />}
                {type === 'hybrid' && <Sparkles className="h-3 w-3 mr-1" />}
                {type === 'text' && <Search className="h-3 w-3 mr-1" />}
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Search Results</span>
              {searchResults && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span>{searchResults.totalCount} results</span>
                  <span>•</span>
                  <span>{searchResults.processingTime}ms</span>
                  <Badge variant="secondary">{searchResults.searchType}</Badge>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">
                  Search failed: {error.message}
                </p>
                <p className="text-red-600 text-xs mt-1">
                  This might be due to missing embeddings or API configuration.
                </p>
              </div>
            )}

            {isLoading && (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-20 bg-gray-200 rounded-lg"></div>
                  </div>
                ))}
              </div>
            )}

            {searchResults && searchResults.results.length === 0 && !isLoading && (
              <div className="text-center py-8">
                <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No results found
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Try a different search query or ensure embeddings are generated.
                </p>
              </div>
            )}

            {searchResults && searchResults.results.length > 0 && (
              <div className="space-y-4">
                {searchResults.results.map((result: SearchResult, index: number) => (
                  <div
                    key={`${result.type}-${result.id}-${index}`}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    {/* Result Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {result.type === 'message' ? (
                          result.metadata.role === 'user' ? (
                            <User className="h-4 w-4 text-blue-500" />
                          ) : (
                            <Bot className="h-4 w-4 text-green-500" />
                          )
                        ) : (
                          <MessageSquare className="h-4 w-4 text-purple-500" />
                        )}
                        <Badge variant="outline">
                          {result.type === 'message' ? result.metadata.role : 'session'}
                        </Badge>
                        {result.similarity && (
                          <Badge variant="secondary">
                            {formatSimilarity(result.similarity)} match
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(result.metadata.timestamp)}
                      </div>
                    </div>

                    {/* Result Content */}
                    <div className="space-y-2">
                      <p className="text-sm leading-relaxed">
                        {truncateContent(result.content)}
                      </p>

                      {/* Context */}
                      {result.context && (result.context.before?.length || result.context.after?.length) && (
                        <div className="bg-gray-50 rounded p-3 space-y-2">
                          <p className="text-xs font-medium text-gray-600">Context:</p>
                          {result.context.before?.map((msg, i) => (
                            <div key={`before-${i}`} className="text-xs text-gray-600 pl-2 border-l-2 border-gray-300">
                              <span className="font-medium">{msg.role}:</span> {truncateContent(msg.content, 100)}
                            </div>
                          ))}
                          <div className="text-xs text-gray-700 pl-2 border-l-2 border-blue-400 font-medium">
                            → Current result
                          </div>
                          {result.context.after?.map((msg, i) => (
                            <div key={`after-${i}`} className="text-xs text-gray-600 pl-2 border-l-2 border-gray-300">
                              <span className="font-medium">{msg.role}:</span> {truncateContent(msg.content, 100)}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action Button */}
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a href={`/sessions/${result.metadata.sessionId}`}>
                            View Conversation
                            <ChevronRight className="h-3 w-3 ml-1" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search Tips */}
      {!hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Search Tips</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-2">
            <p>• <strong>Semantic search</strong> finds meaning, not just keywords</p>
            <p>• Try questions like "How do I debug errors?" or "Performance optimization tips"</p>
            <p>• <strong>Hybrid search</strong> combines semantic and keyword matching</p>
            <p>• <strong>Text search</strong> uses traditional keyword matching</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}