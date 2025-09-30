import { useMemo } from 'react'
import { api } from '@/lib/trpc/provider'
import { cacheConfig } from '@/lib/trpc/cache-config'

// Optimized hook for conversation list with built-in performance optimizations
export function useOptimizedConversations(options?: {
  limit?: number
  enabled?: boolean
}) {
  const { limit = 50, enabled = true } = options || {}

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = api.conversation.getAll.useInfiniteQuery(
    { limit },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled,
      ...cacheConfig.conversationList,
      // Prevent background refetching for better UX
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    }
  )

  // Memoize flattened conversations to prevent unnecessary re-renders
  const conversations = useMemo(() => {
    if (!data) return []
    return data.pages.flatMap((page) => page.items)
  }, [data])

  // Memoize conversation count for stats
  const totalCount = useMemo(() => {
    if (!data) return 0
    // Estimate total based on pagination
    const loadedCount = conversations.length
    const hasMore = hasNextPage
    return hasMore ? loadedCount + 1 : loadedCount // +1 for estimated remaining
  }, [conversations.length, hasNextPage])

  return {
    conversations,
    totalCount,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    // Utility functions
    refreshData: () => {
      // This could trigger a refetch if needed
    },
  }
}

// Optimized hook for conversation details with smart caching
export function useOptimizedConversation(
  id: string,
  options?: {
    includeToolUses?: boolean
    enabled?: boolean
  }
) {
  const { includeToolUses = false, enabled = true } = options || {}

  const {
    data: conversation,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = api.conversation.getById.useInfiniteQuery(
    { id, includeToolUses, limit: 100 },
    {
      getNextPageParam: (lastPage) => lastPage?.nextCursor,
      enabled: enabled && !!id,
      ...cacheConfig.conversationDetails,
    }
  )

  // Memoize flattened messages
  const messages = useMemo(() => {
    if (!conversation?.pages) return []
    return conversation.pages.flatMap((page) => page?.messages || [])
  }, [conversation])

  // Get conversation metadata (stays stable across message pagination)
  const conversationData = useMemo(() => {
    if (!conversation?.pages?.[0]) return null
    const firstPage = conversation.pages[0]
    return {
      id: firstPage.id,
      sessionId: firstPage.sessionId,
      projectPath: firstPage.projectPath,
      title: firstPage.title,
      description: firstPage.description,
      startedAt: firstPage.startedAt,
      endedAt: firstPage.endedAt,
      metadata: firstPage.metadata,
      createdAt: firstPage.createdAt,
      updatedAt: firstPage.updatedAt,
      _count: firstPage._count,
    }
  }, [conversation?.pages?.[0]])

  return {
    conversation: conversationData,
    messages,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    // Computed values
    messageCount: messages.length,
    totalMessageCount: conversationData?._count?.messages || 0,
  }
}

// Optimized stats hook with minimal re-renders
export function useOptimizedStats() {
  const { data: stats, isLoading, isError, error } = api.conversation.getStats.useQuery(
    undefined,
    {
      ...cacheConfig.stats,
      // Stats don't change often, so we can be very aggressive with caching
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
    }
  )

  return {
    stats,
    isLoading,
    isError,
    error,
  }
}