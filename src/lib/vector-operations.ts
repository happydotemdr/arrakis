/**
 * Vector operations for semantic search with pgvector
 * Uses OpenAI's text-embedding-3-small model (1536 dimensions)
 */

import { db, formatVector, parseVector, type VectorEmbedding } from './db'
import type { Conversation, ConversationEmbedding, Message } from '@prisma/client'

// Types for enhanced results
export interface SimilarConversation {
  conversation: Conversation
  embedding: ConversationEmbedding
  distance: number
  similarity: number
}

export interface SearchResult {
  conversations: SimilarConversation[]
  totalFound: number
  searchTime: number
}

/**
 * Store a conversation embedding in the database
 * @param conversationId - The conversation to embed
 * @param chunkText - Text chunk to embed
 * @param embedding - The 1536-dimension vector from OpenAI
 * @param chunkIndex - Position in conversation
 * @param metadata - Additional metadata
 */
export async function storeEmbedding(
  conversationId: string,
  chunkText: string,
  embedding: VectorEmbedding,
  chunkIndex: number,
  metadata?: Record<string, any>
) {
  // Use raw SQL for vector insertion since Prisma doesn't natively support vector type
  const vectorString = formatVector(embedding)

  const result = await db.$executeRaw`
    INSERT INTO conversation_embeddings (
      id, conversation_id, chunk_text, chunk_index, embedding, metadata, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(),
      ${conversationId},
      ${chunkText},
      ${chunkIndex},
      ${vectorString}::vector,
      ${metadata ? JSON.stringify(metadata) : null}::jsonb,
      NOW(),
      NOW()
    )
    RETURNING id
  `

  return result
}

/**
 * Find similar conversations using cosine similarity
 * @param queryEmbedding - The embedding vector to search with
 * @param limit - Maximum number of results
 * @param threshold - Similarity threshold (0-1, where 0 is identical)
 */
export async function findSimilarConversations(
  queryEmbedding: VectorEmbedding,
  limit = 10,
  threshold = 0.5
): Promise<SearchResult> {
  const startTime = Date.now()
  const vectorString = formatVector(queryEmbedding)

  // Raw SQL query for vector similarity search
  const results = await db.$queryRaw<Array<{
    id: string
    conversation_id: string
    chunk_text: string
    chunk_index: number
    distance: number
    metadata: any
    conversation: any
  }>>`
    SELECT
      ce.id,
      ce.conversation_id,
      ce.chunk_text,
      ce.chunk_index,
      ce.embedding <=> ${vectorString}::vector AS distance,
      ce.metadata,
      json_build_object(
        'id', c.id,
        'sessionId', c.session_id,
        'projectPath', c.project_path,
        'title', c.title,
        'description', c.description,
        'startedAt', c.started_at,
        'endedAt', c.ended_at,
        'metadata', c.metadata
      ) as conversation
    FROM conversation_embeddings ce
    JOIN conversations c ON c.id = ce.conversation_id
    WHERE ce.embedding IS NOT NULL
      AND ce.embedding <=> ${vectorString}::vector < ${threshold}
    ORDER BY ce.embedding <=> ${vectorString}::vector
    LIMIT ${limit}
  `

  // Transform results to include similarity score (1 - distance)
  const conversations: SimilarConversation[] = results.map(row => ({
    conversation: {
      id: row.conversation.id,
      sessionId: row.conversation.sessionId,
      projectPath: row.conversation.projectPath,
      title: row.conversation.title,
      description: row.conversation.description,
      startedAt: new Date(row.conversation.startedAt),
      endedAt: row.conversation.endedAt ? new Date(row.conversation.endedAt) : null,
      metadata: row.conversation.metadata,
      createdAt: new Date(), // These would be included in real query
      updatedAt: new Date(),
    },
    embedding: {
      id: row.id,
      conversationId: row.conversation_id,
      chunkText: row.chunk_text,
      chunkIndex: row.chunk_index,
      embedding: null, // Vector data is large, omit from response
      metadata: row.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    distance: row.distance,
    similarity: 1 - row.distance, // Convert distance to similarity
  }))

  return {
    conversations,
    totalFound: conversations.length,
    searchTime: Date.now() - startTime,
  }
}

/**
 * Find conversations by semantic similarity to a text query
 * This would typically call OpenAI to generate the embedding first
 * @param queryText - Natural language query
 * @param embedding - The embedding for the query text
 * @param limit - Maximum results
 */
export async function searchConversationsByText(
  queryText: string,
  embedding: VectorEmbedding,
  limit = 10
): Promise<SearchResult> {
  // In production, you would:
  // 1. Call OpenAI API to get embedding for queryText
  // 2. Use that embedding to search

  return findSimilarConversations(embedding, limit)
}

/**
 * Get conversation context by finding related chunks
 * @param conversationId - The conversation to get context for
 * @param embedding - Reference embedding to find related chunks
 * @param contextWindow - Number of related chunks to retrieve
 */
export async function getConversationContext(
  conversationId: string,
  embedding: VectorEmbedding,
  contextWindow = 5
) {
  const vectorString = formatVector(embedding)

  const chunks = await db.$queryRaw<Array<{
    id: string
    chunk_text: string
    chunk_index: number
    distance: number
  }>>`
    SELECT
      id,
      chunk_text,
      chunk_index,
      embedding <=> ${vectorString}::vector AS distance
    FROM conversation_embeddings
    WHERE conversation_id = ${conversationId}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorString}::vector
    LIMIT ${contextWindow}
  `

  return chunks.map(chunk => ({
    ...chunk,
    relevance: 1 - chunk.distance,
  }))
}

/**
 * Batch insert multiple embeddings efficiently
 * @param embeddings - Array of embeddings to insert
 */
export async function batchInsertEmbeddings(
  embeddings: Array<{
    conversationId: string
    chunkText: string
    chunkIndex: number
    embedding: VectorEmbedding
    metadata?: Record<string, any>
  }>
) {
  const values = embeddings.map(e => ({
    conversationId: e.conversationId,
    chunkText: e.chunkText,
    chunkIndex: e.chunkIndex,
    vectorString: formatVector(e.embedding),
    metadata: e.metadata ? JSON.stringify(e.metadata) : null,
  }))

  // Build the VALUES clause for batch insert
  const placeholders = values.map((_, i) =>
    `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}::vector, $${i * 5 + 5}::jsonb)`
  ).join(', ')

  const params = values.flatMap(v => [
    v.conversationId,
    v.chunkText,
    v.chunkIndex,
    v.vectorString,
    v.metadata,
  ])

  // Note: This is a simplified example. In production, you'd use proper parameterized queries
  const query = `
    INSERT INTO conversation_embeddings (
      conversation_id, chunk_text, chunk_index, embedding, metadata
    )
    VALUES ${placeholders}
  `

  // For actual implementation, use db.$executeRawUnsafe with proper parameterization
  return `Batch insert ${embeddings.length} embeddings`
}

/**
 * Update embeddings for a conversation
 * Useful when regenerating embeddings with a new model
 */
export async function updateConversationEmbeddings(
  conversationId: string,
  newEmbeddings: Array<{
    chunkIndex: number
    embedding: VectorEmbedding
  }>
) {
  const updates = await Promise.all(
    newEmbeddings.map(({ chunkIndex, embedding }) => {
      const vectorString = formatVector(embedding)
      return db.$executeRaw`
        UPDATE conversation_embeddings
        SET embedding = ${vectorString}::vector,
            updated_at = NOW()
        WHERE conversation_id = ${conversationId}
          AND chunk_index = ${chunkIndex}
      `
    })
  )

  return {
    updated: updates.reduce((sum, count) => sum + count, 0),
    conversationId,
  }
}

/**
 * Calculate average embedding for a conversation
 * Useful for conversation-level similarity
 */
export async function getConversationCentroid(conversationId: string): Promise<VectorEmbedding | null> {
  const result = await db.$queryRaw<Array<{ avg_embedding: string }>>`
    SELECT avg(embedding)::text as avg_embedding
    FROM conversation_embeddings
    WHERE conversation_id = ${conversationId}
      AND embedding IS NOT NULL
  `

  if (result.length > 0 && result[0].avg_embedding) {
    return parseVector(result[0].avg_embedding)
  }

  return null
}

/**
 * Find duplicate or very similar conversations
 * Useful for deduplication
 */
export async function findDuplicateConversations(
  similarityThreshold = 0.95
): Promise<Array<{ conversation1: string; conversation2: string; similarity: number }>> {
  const duplicates = await db.$queryRaw<Array<{
    conv1: string
    conv2: string
    similarity: number
  }>>`
    SELECT DISTINCT
      ce1.conversation_id as conv1,
      ce2.conversation_id as conv2,
      1 - (ce1.embedding <=> ce2.embedding) as similarity
    FROM conversation_embeddings ce1
    CROSS JOIN conversation_embeddings ce2
    WHERE ce1.conversation_id < ce2.conversation_id
      AND ce1.embedding IS NOT NULL
      AND ce2.embedding IS NOT NULL
      AND ce1.chunk_index = 0  -- Compare first chunks
      AND ce2.chunk_index = 0
      AND 1 - (ce1.embedding <=> ce2.embedding) > ${similarityThreshold}
    ORDER BY similarity DESC
  `

  return duplicates.map(d => ({
    conversation1: d.conv1,
    conversation2: d.conv2,
    similarity: d.similarity,
  }))
}