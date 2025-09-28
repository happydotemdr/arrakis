/**
 * Semantic Search Engine - Phase 6 System A
 * AI-powered conversation search using vector embeddings
 */

import { db } from '@/lib/db'
import {
  messages,
  sessions,
  messageEmbeddings,
  sessionEmbeddings,
} from '@/lib/db/schema'
import { eq, desc, and, or, like, sql } from 'drizzle-orm'
import {
  generateEmbedding,
  calculateCosineSimilarity,
} from '@/lib/embeddings/embedding-service'

export interface SearchOptions {
  query: string
  limit?: number
  threshold?: number // Similarity threshold (0-1)
  filters?: {
    sessionIds?: string[]
    dateRange?: { from: Date; to: Date }
    messageTypes?: ('user' | 'assistant')[]
    minSimilarity?: number
  }
  searchType?: 'semantic' | 'hybrid' | 'keyword'
  includeContext?: boolean // Include surrounding messages
}

export interface SearchResult {
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

export interface SearchResponse {
  results: SearchResult[]
  totalFound: number
  searchTime: number
  searchType: string
  query: string
}

/**
 * Main search function with hybrid semantic and keyword search
 */
export async function searchConversations(
  options: SearchOptions
): Promise<SearchResponse> {
  const startTime = Date.now()
  const { query, limit = 20, searchType = 'hybrid' } = options

  console.log(`🔍 Searching conversations: "${query}" (${searchType})`)

  try {
    let results: SearchResult[] = []

    switch (searchType) {
      case 'semantic':
        results = await performSemanticSearch(options)
        break
      case 'keyword':
        results = await performKeywordSearch(options)
        break
      case 'hybrid':
      default:
        results = await performHybridSearch(options)
        break
    }

    // Add context if requested
    if (options.includeContext) {
      results = await addContextToResults(results)
    }

    const searchTime = Date.now() - startTime

    console.log(`✅ Search completed: ${results.length} results in ${searchTime}ms`)

    return {
      results: results.slice(0, limit),
      totalFound: results.length,
      searchTime,
      searchType,
      query,
    }
  } catch (error) {
    console.error('❌ Search error:', error)
    throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Semantic search using vector embeddings
 */
async function performSemanticSearch(options: SearchOptions): Promise<SearchResult[]> {
  const { query, threshold = 0.7, filters } = options

  // Generate embedding for search query
  const queryEmbeddingResult = await generateEmbedding(query)
  if (!queryEmbeddingResult.chunks[0]?.embedding) {
    throw new Error('Failed to generate query embedding')
  }

  const queryEmbedding = queryEmbeddingResult.chunks[0].embedding
  const results: SearchResult[] = []

  // Search message embeddings
  const messageEmbeddingRows = await db
    .select({
      embedding: messageEmbeddings.embedding,
      messageId: messageEmbeddings.messageId,
      model: messageEmbeddings.model,
    })
    .from(messageEmbeddings)
    .innerJoin(messages, eq(messageEmbeddings.messageId, messages.id))
    .limit(1000) // Limit for performance

  for (const row of messageEmbeddingRows) {
    try {
      const storedEmbedding = JSON.parse(row.embedding)
      const similarity = calculateCosineSimilarity(queryEmbedding, storedEmbedding)

      if (similarity >= threshold) {
        // Get full message data
        const messageData = await db
          .select()
          .from(messages)
          .where(eq(messages.id, row.messageId))
          .limit(1)

        if (messageData.length > 0) {
          const message = messageData[0]
          results.push({
            type: 'message',
            id: message.id.toString(),
            content: message.content,
            similarity,
            metadata: {
              messageId: message.id,
              sessionId: message.sessionId,
              timestamp: message.createdAt.toISOString(),
              role: message.role,
            },
          })
        }
      }
    } catch (error) {
      console.error('Error processing embedding:', error)
    }
  }

  // Search session embeddings
  const sessionEmbeddingRows = await db
    .select({
      embedding: sessionEmbeddings.embedding,
      sessionId: sessionEmbeddings.sessionId,
      summaryText: sessionEmbeddings.summaryText,
      model: sessionEmbeddings.model,
    })
    .from(sessionEmbeddings)
    .innerJoin(sessions, eq(sessionEmbeddings.sessionId, sessions.id))
    .limit(500) // Limit for performance

  for (const row of sessionEmbeddingRows) {
    try {
      const storedEmbedding = JSON.parse(row.embedding)
      const similarity = calculateCosineSimilarity(queryEmbedding, storedEmbedding)

      if (similarity >= threshold) {
        // Get full session data
        const sessionData = await db
          .select()
          .from(sessions)
          .where(eq(sessions.id, row.sessionId))
          .limit(1)

        if (sessionData.length > 0) {
          const session = sessionData[0]
          results.push({
            type: 'session',
            id: session.id,
            content: row.summaryText,
            similarity,
            metadata: {
              sessionId: session.id,
              title: session.title || 'Untitled Session',
              timestamp: session.createdAt?.toISOString(),
              messageCount: session.messageCount || 0,
            },
          })
        }
      }
    } catch (error) {
      console.error('Error processing session embedding:', error)
    }
  }

  // Sort by similarity (highest first)
  return results.sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
}

/**
 * Keyword search using traditional text matching
 */
async function performKeywordSearch(options: SearchOptions): Promise<SearchResult[]> {
  const { query, filters } = options
  const searchPattern = `%${query}%`
  const results: SearchResult[] = []

  // Build message search conditions
  let messageWhereConditions: any[] = [
    like(messages.content, searchPattern)
  ]

  if (filters?.dateRange) {
    messageWhereConditions.push(
      and(
        sql`${messages.createdAt} >= ${filters.dateRange.from}`,
        sql`${messages.createdAt} <= ${filters.dateRange.to}`
      )
    )
  }

  if (filters?.messageTypes?.length) {
    messageWhereConditions.push(sql`${messages.role} IN (${filters.messageTypes.join(',')})`)
  }

  // Search messages
  const messageResults = await db
    .select({
      id: messages.id,
      content: messages.content,
      role: messages.role,
      sessionId: messages.sessionId,
      timestamp: messages.createdAt,
    })
    .from(messages)
    .where(and(...messageWhereConditions))
    .orderBy(desc(messages.createdAt))
    .limit(500)

  for (const message of messageResults) {
    results.push({
      type: 'message',
      id: message.id.toString(),
      content: message.content,
      metadata: {
        messageId: message.id,
        sessionId: message.sessionId,
        timestamp: message.timestamp.toISOString(),
        role: message.role,
      },
    })
  }

  // Search sessions
  const sessionResults = await db
    .select({
      id: sessions.id,
      title: sessions.title,
      startTime: sessions.createdAt,
      messageCount: sessions.messageCount,
    })
    .from(sessions)
    .where(like(sessions.title, searchPattern))
    .orderBy(desc(sessions.createdAt))
    .limit(100)

  for (const session of sessionResults) {
    results.push({
      type: 'session',
      id: session.id,
      content: session.title || 'Untitled Session',
      metadata: {
        sessionId: session.id,
        title: session.title || 'Untitled Session',
        timestamp: session.startTime?.toISOString(),
        messageCount: session.messageCount || 0,
      },
    })
  }

  return results
}

/**
 * Hybrid search combining semantic and keyword approaches
 */
async function performHybridSearch(options: SearchOptions): Promise<SearchResult[]> {
  const { query } = options

  // Run both semantic and keyword searches
  const [semanticResults, keywordResults] = await Promise.all([
    performSemanticSearch({ ...options, threshold: 0.6 }),
    performKeywordSearch(options),
  ])

  // Combine and deduplicate results
  const combinedResults = new Map<string, SearchResult>()

  // Add semantic results with higher weight
  for (const result of semanticResults) {
    const key = `${result.type}-${result.id}`
    combinedResults.set(key, {
      ...result,
      similarity: (result.similarity || 0) * 1.2, // Boost semantic results
    })
  }

  // Add keyword results, merge if already exists
  for (const result of keywordResults) {
    const key = `${result.type}-${result.id}`
    const existing = combinedResults.get(key)

    if (existing) {
      // Combine scores
      existing.similarity = Math.max(existing.similarity || 0, 0.8) // Boost if found in both
    } else {
      combinedResults.set(key, {
        ...result,
        similarity: calculateKeywordRelevance(query, result.content),
      })
    }
  }

  // Convert to array and sort by relevance
  return Array.from(combinedResults.values())
    .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
}

/**
 * Calculate keyword relevance score
 */
function calculateKeywordRelevance(query: string, content: string): number {
  const queryWords = query.toLowerCase().split(/\s+/)
  const contentWords = content.toLowerCase().split(/\s+/)

  let matches = 0
  for (const queryWord of queryWords) {
    for (const contentWord of contentWords) {
      if (contentWord.includes(queryWord) || queryWord.includes(contentWord)) {
        matches++
      }
    }
  }

  return Math.min(matches / queryWords.length, 1.0)
}

/**
 * Add conversation context to search results
 */
async function addContextToResults(results: SearchResult[]): Promise<SearchResult[]> {
  const messageResults = results.filter(r => r.type === 'message')

  for (const result of messageResults) {
    if (!result.metadata.messageId || !result.metadata.sessionId) continue

    try {
      // Get messages before and after this message
      const contextMessages = await db
        .select({
          id: messages.id,
          role: messages.role,
          content: messages.content,
          timestamp: messages.createdAt,
        })
        .from(messages)
        .where(eq(messages.sessionId, result.metadata.sessionId))
        .orderBy(messages.createdAt)

      const currentIndex = contextMessages.findIndex(
        m => m.id === result.metadata.messageId
      )

      if (currentIndex >= 0) {
        const before = contextMessages
          .slice(Math.max(0, currentIndex - 2), currentIndex)
          .map(m => ({
            role: m.role,
            content: m.content.substring(0, 200) + (m.content.length > 200 ? '...' : ''),
            timestamp: m.timestamp.toISOString(),
          }))

        const after = contextMessages
          .slice(currentIndex + 1, currentIndex + 3)
          .map(m => ({
            role: m.role,
            content: m.content.substring(0, 200) + (m.content.length > 200 ? '...' : ''),
            timestamp: m.timestamp.toISOString(),
          }))

        result.context = { before, after }
      }
    } catch (error) {
      console.error('Error adding context:', error)
    }
  }

  return results
}

/**
 * Get search suggestions based on recent searches and popular terms
 */
export async function getSearchSuggestions(partial: string): Promise<string[]> {
  if (partial.length < 2) return []

  const suggestions: string[] = []

  try {
    // Get popular terms from recent sessions
    const recentSessions = await db
      .select({ title: sessions.title })
      .from(sessions)
      .where(like(sessions.title, `%${partial}%`))
      .orderBy(desc(sessions.createdAt))
      .limit(5)

    for (const session of recentSessions) {
      if (session.title && !suggestions.includes(session.title)) {
        suggestions.push(session.title)
      }
    }

    // Add common search patterns
    const commonPatterns = [
      'debug', 'error', 'implementation', 'how to', 'explain', 'optimize',
      'performance', 'security', 'best practices', 'troubleshoot'
    ]

    for (const pattern of commonPatterns) {
      if (pattern.includes(partial.toLowerCase()) && !suggestions.includes(pattern)) {
        suggestions.push(pattern)
      }
    }

    return suggestions.slice(0, 8)
  } catch (error) {
    console.error('Error getting search suggestions:', error)
    return []
  }
}

/**
 * Search similar conversations to a given session
 */
export async function findSimilarConversations(
  sessionId: string,
  limit: number = 10
): Promise<SearchResult[]> {
  try {
    // Get the session embedding
    const sessionEmbedding = await db
      .select()
      .from(sessionEmbeddings)
      .where(eq(sessionEmbeddings.sessionId, sessionId))
      .limit(1)

    if (sessionEmbedding.length === 0) {
      console.log(`No embedding found for session ${sessionId}`)
      return []
    }

    const queryEmbedding = JSON.parse(sessionEmbedding[0].embedding)
    const results: SearchResult[] = []

    // Find similar sessions
    const otherSessionEmbeddings = await db
      .select()
      .from(sessionEmbeddings)
      .innerJoin(sessions, eq(sessionEmbeddings.sessionId, sessions.id))
      .where(sql`${sessionEmbeddings.sessionId} != ${sessionId}`)
      .limit(100)

    for (const row of otherSessionEmbeddings) {
      try {
        const storedEmbedding = JSON.parse(row.session_embeddings.embedding)
        const similarity = calculateCosineSimilarity(queryEmbedding, storedEmbedding)

        if (similarity > 0.5) {
          results.push({
            type: 'session',
            id: row.sessions.id,
            content: row.session_embeddings.summaryText,
            similarity,
            metadata: {
              sessionId: row.sessions.id,
              title: row.sessions.title || 'Untitled Session',
              timestamp: row.sessions.createdAt?.toISOString(),
              messageCount: row.sessions.messageCount || 0,
            },
          })
        }
      } catch (error) {
        console.error('Error processing similar session:', error)
      }
    }

    return results
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .slice(0, limit)
  } catch (error) {
    console.error('Error finding similar conversations:', error)
    return []
  }
}