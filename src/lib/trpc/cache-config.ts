import { QueryClient } from '@tanstack/react-query'

// Optimized cache configuration for tRPC queries
export const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      // Aggressive caching for conversation data
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes (was cacheTime)
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if ((error as any)?.status >= 400 && (error as any)?.status < 500) {
          return false
        }
        return failureCount < 3
      },
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: 'always',
    },
    mutations: {
      retry: 1,
    },
  },
})

// Cache key configurations for different query types
export const cacheConfig = {
  // Conversation list: Cache aggressively, users don't expect real-time updates
  conversationList: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  },

  // Conversation details: Medium cache, users might edit
  conversationDetails: {
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  },

  // Stats: Cache very aggressively, doesn't change often
  stats: {
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
  },

  // Search results: Short cache for fresh results
  search: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  },
} as const

// Prefetch helper for conversation list
export const prefetchConversations = async (queryClient: QueryClient) => {
  return queryClient.prefetchQuery({
    queryKey: ['conversation', 'getAll'],
    queryFn: () => {
      // This would be called from the actual tRPC client
      // Implementation depends on your tRPC setup
    },
    ...cacheConfig.conversationList,
  })
}

// Helper to invalidate related caches when data changes
export const invalidateConversationCaches = (queryClient: QueryClient, conversationId?: string) => {
  // Invalidate conversation list
  queryClient.invalidateQueries({ queryKey: ['conversation', 'getAll'] })

  // Invalidate stats
  queryClient.invalidateQueries({ queryKey: ['conversation', 'getStats'] })

  // If specific conversation, invalidate its details
  if (conversationId) {
    queryClient.invalidateQueries({
      queryKey: ['conversation', 'getById', { id: conversationId }]
    })
  }
}

// Optimistic update helpers
export const optimisticUpdateHelpers = {
  // Update conversation list after creating new conversation
  addConversationToList: (queryClient: QueryClient, newConversation: any) => {
    queryClient.setQueryData(['conversation', 'getAll'], (old: any) => {
      if (!old) return old
      return {
        ...old,
        items: [newConversation, ...old.items],
      }
    })
  },

  // Update conversation details
  updateConversationDetails: (queryClient: QueryClient, conversationId: string, updates: any) => {
    queryClient.setQueryData(['conversation', 'getById', { id: conversationId }], (old: any) => {
      if (!old) return old
      return { ...old, ...updates }
    })
  },
}