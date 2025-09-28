/**
 * Context Retrieval System - Phase 6 System A
 * Intelligent context injection for enhanced AI responses
 */

import { searchConversations, findSimilarConversations } from '@/lib/search/semantic-search'
import { db } from '@/lib/db'
import { messages, sessions } from '@/lib/db/schema'
import { eq, desc, and, sql } from 'drizzle-orm'

export interface ContextItem {
  type: 'conversation' | 'message' | 'session_summary'
  id: string
  content: string
  relevance: number
  metadata: {
    sessionId?: string
    timestamp?: string
    title?: string
    role?: string
  }
}

export interface ContextOptions {
  maxItems?: number
  relevanceThreshold?: number
  includeCurrentSession?: boolean
  includeRecentSessions?: boolean
  includeSimilarSessions?: boolean
  contextWindow?: number // Number of recent messages to consider
}

export interface RetrievedContext {
  items: ContextItem[]
  totalRelevance: number
  sources: {
    currentSession: number
    recentSessions: number
    similarSessions: number
    searchResults: number
  }
  processingTime: number
}

/**
 * Main context retrieval function
 * Gathers relevant context for enhancing AI responses
 */
export async function retrieveContext(
  query: string,
  sessionId?: string,
  options: ContextOptions = {}
): Promise<RetrievedContext> {
  const startTime = Date.now()
  const {
    maxItems = 10,
    relevanceThreshold = 0.3,
    includeCurrentSession = true,
    includeRecentSessions = true,
    includeSimilarSessions = true,
    contextWindow = 10,
  } = options

  console.log(`🧠 Retrieving context for query: "${query}"`)

  const contextItems: ContextItem[] = []
  const sources = {
    currentSession: 0,
    recentSessions: 0,
    similarSessions: 0,
    searchResults: 0,
  }

  try {
    // 1. Current session context (if session provided)
    if (includeCurrentSession && sessionId) {
      const currentSessionContext = await getCurrentSessionContext(
        sessionId,
        query,
        contextWindow
      )
      contextItems.push(...currentSessionContext)
      sources.currentSession = currentSessionContext.length
    }

    // 2. Semantic search across all conversations
    const searchResults = await searchConversations({
      query,
      limit: maxItems * 2, // Get more to allow filtering
      threshold: relevanceThreshold,
      searchType: 'hybrid',
      includeContext: true,
    })

    for (const result of searchResults.results) {
      if (result.similarity && result.similarity >= relevanceThreshold) {
        // Skip items from current session to avoid duplication
        if (sessionId && result.metadata.sessionId === sessionId) continue

        contextItems.push({
          type: result.type === 'session' ? 'session_summary' : 'message',
          id: result.id,
          content: result.content,
          relevance: result.similarity,
          metadata: {
            sessionId: result.metadata.sessionId,
            timestamp: result.metadata.timestamp,
            title: result.metadata.title,
            role: result.metadata.role,
          },
        })
      }
    }
    sources.searchResults = searchResults.results.length

    // 3. Recent sessions context
    if (includeRecentSessions) {
      const recentSessionsContext = await getRecentSessionsContext(query, sessionId)
      contextItems.push(...recentSessionsContext)
      sources.recentSessions = recentSessionsContext.length
    }

    // 4. Similar sessions context
    if (includeSimilarSessions && sessionId) {
      const similarSessionsContext = await getSimilarSessionsContext(sessionId)
      contextItems.push(...similarSessionsContext)
      sources.similarSessions = similarSessionsContext.length
    }

    // Deduplicate and rank by relevance
    const deduplicatedItems = deduplicateContextItems(contextItems)
    const rankedItems = rankContextItems(deduplicatedItems, query)
    const finalItems = rankedItems.slice(0, maxItems)

    const totalRelevance = finalItems.reduce((sum, item) => sum + item.relevance, 0)
    const processingTime = Date.now() - startTime

    console.log(`✅ Context retrieved: ${finalItems.length} items (${processingTime}ms)`)

    return {
      items: finalItems,
      totalRelevance,
      sources,
      processingTime,
    }
  } catch (error) {
    console.error('❌ Context retrieval error:', error)
    throw new Error(`Context retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get context from the current session
 */
async function getCurrentSessionContext(
  sessionId: string,
  query: string,
  contextWindow: number
): Promise<ContextItem[]> {
  try {
    // Get recent messages from current session
    const recentMessages = await db
      .select({
        id: messages.id,
        content: messages.content,
        role: messages.role,
        timestamp: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(desc(messages.createdAt))
      .limit(contextWindow)

    const contextItems: ContextItem[] = []

    for (const message of recentMessages) {
      // Calculate relevance based on keyword overlap and recency
      const relevance = calculateMessageRelevance(query, message.content, message.timestamp)

      if (relevance > 0.1) { // Lower threshold for current session
        contextItems.push({
          type: 'message',
          id: message.id.toString(),
          content: message.content,
          relevance,
          metadata: {
            sessionId,
            timestamp: message.timestamp.toISOString(),
            role: message.role,
          },
        })
      }
    }

    return contextItems.sort((a, b) => b.relevance - a.relevance)
  } catch (error) {
    console.error('Error getting current session context:', error)
    return []
  }
}

/**
 * Get context from recent sessions
 */
async function getRecentSessionsContext(
  query: string,
  excludeSessionId?: string
): Promise<ContextItem[]> {
  try {
    // Get recent sessions
    const recentSessions = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        startTime: sessions.createdAt,
        messageCount: sessions.messageCount,
      })
      .from(sessions)
      .where(excludeSessionId ? sql`${sessions.id} != ${excludeSessionId}` : undefined)
      .orderBy(desc(sessions.createdAt))
      .limit(20)

    const contextItems: ContextItem[] = []

    for (const session of recentSessions) {
      if (!session.title) continue

      // Calculate relevance based on title similarity
      const relevance = calculateTitleRelevance(query, session.title)

      if (relevance > 0.2) {
        contextItems.push({
          type: 'session_summary',
          id: session.id,
          content: `Session: ${session.title} (${session.messageCount || 0} messages)`,
          relevance,
          metadata: {
            sessionId: session.id,
            timestamp: session.startTime?.toISOString(),
            title: session.title,
          },
        })
      }
    }

    return contextItems.sort((a, b) => b.relevance - a.relevance).slice(0, 5)
  } catch (error) {
    console.error('Error getting recent sessions context:', error)
    return []
  }
}

/**
 * Get context from similar sessions
 */
async function getSimilarSessionsContext(sessionId: string): Promise<ContextItem[]> {
  try {
    const similarSessions = await findSimilarConversations(sessionId, 5)

    return similarSessions.map(session => ({
      type: 'session_summary' as const,
      id: session.id,
      content: session.content,
      relevance: session.similarity || 0.5,
      metadata: {
        sessionId: session.metadata.sessionId,
        timestamp: session.metadata.timestamp,
        title: session.metadata.title,
      },
    }))
  } catch (error) {
    console.error('Error getting similar sessions context:', error)
    return []
  }
}

/**
 * Calculate message relevance based on content and recency
 */
function calculateMessageRelevance(
  query: string,
  content: string,
  timestamp: Date
): number {
  // Keyword relevance
  const keywordRelevance = calculateKeywordRelevance(query, content)

  // Recency bonus (more recent = higher relevance)
  const ageInHours = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60)
  const recencyBonus = Math.max(0, 1 - ageInHours / (24 * 7)) * 0.2 // Decay over a week

  // Content length penalty (very short or very long messages are less relevant)
  const idealLength = 200
  const lengthPenalty = Math.abs(content.length - idealLength) / idealLength * 0.1

  return Math.max(0, keywordRelevance + recencyBonus - lengthPenalty)
}

/**
 * Calculate title relevance
 */
function calculateTitleRelevance(query: string, title: string): number {
  const queryWords = query.toLowerCase().split(/\s+/)
  const titleWords = title.toLowerCase().split(/\s+/)

  let matches = 0
  for (const queryWord of queryWords) {
    for (const titleWord of titleWords) {
      if (titleWord.includes(queryWord) || queryWord.includes(titleWord)) {
        matches++
      }
    }
  }

  return Math.min(matches / queryWords.length, 1.0)
}

/**
 * Calculate keyword relevance
 */
function calculateKeywordRelevance(query: string, content: string): number {
  const queryWords = query.toLowerCase().split(/\s+/)
  const contentWords = content.toLowerCase().split(/\s+/)

  let exactMatches = 0
  let partialMatches = 0

  for (const queryWord of queryWords) {
    let found = false
    for (const contentWord of contentWords) {
      if (contentWord === queryWord) {
        exactMatches++
        found = true
        break
      } else if (contentWord.includes(queryWord) || queryWord.includes(contentWord)) {
        if (!found) {
          partialMatches++
          found = true
        }
      }
    }
  }

  const exactScore = exactMatches / queryWords.length
  const partialScore = partialMatches / queryWords.length * 0.5

  return Math.min(exactScore + partialScore, 1.0)
}

/**
 * Remove duplicate context items
 */
function deduplicateContextItems(items: ContextItem[]): ContextItem[] {
  const seen = new Set<string>()
  const deduplicated: ContextItem[] = []

  for (const item of items) {
    const key = `${item.type}-${item.id}`
    if (!seen.has(key)) {
      seen.add(key)
      deduplicated.push(item)
    }
  }

  return deduplicated
}

/**
 * Rank context items by relevance and diversity
 */
function rankContextItems(items: ContextItem[], query: string): ContextItem[] {
  // First sort by relevance
  const sorted = items.sort((a, b) => b.relevance - a.relevance)

  // Apply diversity bonus to ensure variety in results
  const diversified: ContextItem[] = []
  const sessionsSeen = new Set<string>()

  for (const item of sorted) {
    let diversityBonus = 0

    // Bonus for different sessions
    if (item.metadata.sessionId && !sessionsSeen.has(item.metadata.sessionId)) {
      diversityBonus += 0.1
      sessionsSeen.add(item.metadata.sessionId)
    }

    // Bonus for different types
    const typeCount = diversified.filter(d => d.type === item.type).length
    if (typeCount === 0) diversityBonus += 0.05

    item.relevance += diversityBonus
    diversified.push(item)
  }

  return diversified.sort((a, b) => b.relevance - a.relevance)
}

/**
 * Format context for injection into AI prompts
 */
export function formatContextForPrompt(context: RetrievedContext): string {
  if (context.items.length === 0) {
    return ''
  }

  const contextText = context.items
    .map((item, index) => {
      const type = item.type === 'session_summary' ? 'Session' : 'Message'
      const timestamp = item.metadata.timestamp
        ? new Date(item.metadata.timestamp).toLocaleDateString()
        : 'Unknown date'

      return `[Context ${index + 1}] ${type} (${timestamp}, relevance: ${item.relevance.toFixed(2)}):
${item.content.substring(0, 500)}${item.content.length > 500 ? '...' : ''}`
    })
    .join('\n\n')

  return `

## Relevant Context
Based on previous conversations, here is some relevant context that might help with your response:

${contextText}

Please use this context to provide a more informed and helpful response. Reference the context when relevant, but focus primarily on the current user's question.

---
`
}

/**
 * Get context statistics for monitoring
 */
export async function getContextStats(): Promise<{
  averageRelevance: number
  averageProcessingTime: number
  commonQueryTypes: Array<{ pattern: string; count: number }>
}> {
  // This would be implemented with actual usage tracking
  // For now, return mock data
  return {
    averageRelevance: 0.72,
    averageProcessingTime: 145,
    commonQueryTypes: [
      { pattern: 'how to', count: 45 },
      { pattern: 'explain', count: 38 },
      { pattern: 'debug', count: 32 },
      { pattern: 'optimize', count: 28 },
    ],
  }
}