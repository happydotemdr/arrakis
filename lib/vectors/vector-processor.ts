/**
 * Vector Processing Pipeline - Phase 6 System A
 * Background processing for conversation embeddings
 */

import { db } from '@/lib/db'
import {
  messages,
  sessions,
  messageEmbeddings,
  sessionEmbeddings,
  embeddingQueue,
  embeddingProcessingLog,
} from '@/lib/db/schema'
import { eq, and, desc, inArray } from 'drizzle-orm'
import {
  generateEmbedding,
  generateBatchEmbeddings,
  validateEmbeddingConfiguration,
} from '@/lib/embeddings/embedding-service'

export interface ProcessingStats {
  processed: number
  failed: number
  skipped: number
  totalTime: number
  totalTokens: number
}

/**
 * Process pending items in the embedding queue
 */
export async function processEmbeddingQueue(
  options: {
    batchSize?: number
    maxRetries?: number
    priority?: number[]
  } = {}
): Promise<ProcessingStats> {
  const { batchSize = 10, maxRetries = 3, priority = [1, 2, 3, 4, 5] } = options

  if (!validateEmbeddingConfiguration()) {
    throw new Error('Embedding configuration is invalid')
  }

  console.log(`🔄 Processing embedding queue (batch size: ${batchSize})`)

  const stats: ProcessingStats = {
    processed: 0,
    failed: 0,
    skipped: 0,
    totalTime: 0,
    totalTokens: 0,
  }

  try {
    // Get pending items from queue
    const queueItems = await db
      .select()
      .from(embeddingQueue)
      .where(
        and(
          eq(embeddingQueue.status, 'pending'),
          inArray(embeddingQueue.priority, priority)
        )
      )
      .orderBy(embeddingQueue.priority, embeddingQueue.createdAt)
      .limit(batchSize)

    if (queueItems.length === 0) {
      console.log('✅ No pending items in embedding queue')
      return stats
    }

    console.log(`📋 Found ${queueItems.length} pending items to process`)

    for (const item of queueItems) {
      const startTime = Date.now()

      try {
        // Skip items that have exceeded retry limit
        if (item.retryCount >= maxRetries) {
          await updateQueueItem(item.id, 'failed', 'Max retries exceeded')
          stats.skipped++
          continue
        }

        // Mark as processing
        await updateQueueItem(item.id, 'processing')

        let result: any
        if (item.itemType === 'message') {
          result = await processMessageEmbedding(parseInt(item.itemId))
        } else if (item.itemType === 'session') {
          result = await processSessionEmbedding(item.itemId)
        } else {
          throw new Error(`Unknown item type: ${item.itemType}`)
        }

        // Mark as completed
        await updateQueueItem(item.id, 'completed')

        // Log success
        await logProcessingResult({
          itemType: item.itemType,
          itemId: item.itemId,
          operation: 'embed',
          status: 'success',
          processingTimeMs: Date.now() - startTime,
          tokenCount: result.totalTokens,
          chunkCount: result.chunks?.length || 1,
          model: result.model,
        })

        stats.processed++
        stats.totalTokens += result.totalTokens || 0
        stats.totalTime += Date.now() - startTime

        console.log(`✅ Processed ${item.itemType} ${item.itemId} (${result.totalTokens} tokens)`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`❌ Failed to process ${item.itemType} ${item.itemId}:`, errorMessage)

        // Increment retry count or mark as failed
        const newRetryCount = item.retryCount + 1
        const newStatus = newRetryCount >= maxRetries ? 'failed' : 'pending'

        await updateQueueItem(item.id, newStatus, errorMessage, newRetryCount)

        // Log failure
        await logProcessingResult({
          itemType: item.itemType,
          itemId: item.itemId,
          operation: 'embed',
          status: 'error',
          processingTimeMs: Date.now() - startTime,
          errorMessage,
        })

        stats.failed++
      }

      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log(`🎯 Processing complete: ${stats.processed} processed, ${stats.failed} failed, ${stats.skipped} skipped`)
    return stats
  } catch (error) {
    console.error('❌ Queue processing error:', error)
    throw error
  }
}

/**
 * Process embedding for a single message
 */
export async function processMessageEmbedding(messageId: number) {
  console.log(`📝 Processing message embedding: ${messageId}`)

  // Get message data
  const messageData = await db
    .select()
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1)

  if (messageData.length === 0) {
    throw new Error(`Message ${messageId} not found`)
  }

  const message = messageData[0]

  // Check if embedding already exists
  const existingEmbedding = await db
    .select()
    .from(messageEmbeddings)
    .where(eq(messageEmbeddings.messageId, messageId))
    .limit(1)

  if (existingEmbedding.length > 0) {
    console.log(`⚠️ Embedding already exists for message ${messageId}`)
    return { totalTokens: 0, model: 'existing', chunks: [] }
  }

  // Prepare text for embedding
  const textContent = `${message.role}: ${message.content}`

  // Generate embedding
  const embeddingResult = await generateEmbedding(textContent)

  // Store embedding (using the first chunk for now)
  if (embeddingResult.chunks.length > 0 && embeddingResult.chunks[0].embedding) {
    await db.insert(messageEmbeddings).values({
      messageId: messageId,
      embedding: JSON.stringify(embeddingResult.chunks[0].embedding),
      model: embeddingResult.model,
    })

    // Update message embedding status
    await db
      .update(messages)
      .set({ embeddingStatus: 'completed' })
      .where(eq(messages.id, messageId))

    console.log(`✅ Stored embedding for message ${messageId}`)
  }

  return embeddingResult
}

/**
 * Process embedding for a session summary
 */
export async function processSessionEmbedding(sessionId: string) {
  console.log(`📚 Processing session embedding: ${sessionId}`)

  // Get session data with messages
  const sessionData = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1)

  if (sessionData.length === 0) {
    throw new Error(`Session ${sessionId} not found`)
  }

  const session = sessionData[0]

  // Check if embedding already exists
  const existingEmbedding = await db
    .select()
    .from(sessionEmbeddings)
    .where(eq(sessionEmbeddings.sessionId, sessionId))
    .limit(1)

  if (existingEmbedding.length > 0) {
    console.log(`⚠️ Embedding already exists for session ${sessionId}`)
    return { totalTokens: 0, model: 'existing', chunks: [] }
  }

  // Get session messages for summary
  const sessionMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(messages.timestamp)

  // Create summary text for embedding
  const summaryText = createSessionSummary(session, sessionMessages)

  // Generate embedding
  const embeddingResult = await generateEmbedding(summaryText)

  // Store embedding
  if (embeddingResult.chunks.length > 0 && embeddingResult.chunks[0].embedding) {
    await db.insert(sessionEmbeddings).values({
      sessionId: sessionId,
      summaryText: summaryText,
      embedding: JSON.stringify(embeddingResult.chunks[0].embedding),
      model: embeddingResult.model,
      tokenCount: embeddingResult.totalTokens,
    })

    // Update session embedding status
    await db
      .update(sessions)
      .set({ embeddingStatus: 'completed' })
      .where(eq(sessions.id, sessionId))

    console.log(`✅ Stored embedding for session ${sessionId}`)
  }

  return embeddingResult
}

/**
 * Create a summary of a session for embedding
 */
function createSessionSummary(session: any, messages: any[]): string {
  const title = session.title || 'Untitled Session'
  const messageCount = messages.length
  const duration = session.endTime
    ? new Date(session.endTime).getTime() - new Date(session.startTime).getTime()
    : 0

  // Extract key topics and themes from messages
  const userMessages = messages.filter(m => m.role === 'user').slice(0, 3)
  const assistantMessages = messages.filter(m => m.role === 'assistant').slice(0, 3)

  const userTopics = userMessages.map(m => m.content.substring(0, 200)).join(' ')
  const assistantTopics = assistantMessages.map(m => m.content.substring(0, 200)).join(' ')

  return `
Session: ${title}
Messages: ${messageCount}
Duration: ${Math.round(duration / 1000 / 60)} minutes
User topics: ${userTopics}
Assistant topics: ${assistantTopics}
Tags: ${session.tags || ''}
Summary: This session covered ${messageCount} exchanges focusing on ${title.toLowerCase()}.
  `.trim()
}

/**
 * Update queue item status
 */
async function updateQueueItem(
  queueId: number,
  status: string,
  errorMessage?: string,
  retryCount?: number
) {
  const updateData: any = {
    status,
    updatedAt: new Date(),
  }

  if (errorMessage) {
    updateData.errorMessage = errorMessage
  }

  if (retryCount !== undefined) {
    updateData.retryCount = retryCount
  }

  if (status === 'completed' || status === 'failed') {
    updateData.processedAt = new Date()
  }

  await db.update(embeddingQueue).set(updateData).where(eq(embeddingQueue.id, queueId))
}

/**
 * Log processing result
 */
async function logProcessingResult(data: {
  itemType: string
  itemId: string
  operation: string
  status: string
  processingTimeMs: number
  tokenCount?: number
  chunkCount?: number
  model?: string
  errorMessage?: string
}) {
  await db.insert(embeddingProcessingLog).values(data)
}

/**
 * Get processing statistics
 */
export async function getProcessingStats(hours: number = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000)

  const logs = await db
    .select()
    .from(embeddingProcessingLog)
    .where(eq(embeddingProcessingLog.createdAt, since))

  const successful = logs.filter(l => l.status === 'success')
  const failed = logs.filter(l => l.status === 'error')

  const totalTokens = successful.reduce((sum, log) => sum + (log.tokenCount || 0), 0)
  const avgProcessingTime = successful.length > 0
    ? successful.reduce((sum, log) => sum + (log.processingTimeMs || 0), 0) / successful.length
    : 0

  return {
    period: `${hours} hours`,
    successful: successful.length,
    failed: failed.length,
    totalTokens,
    avgProcessingTime: Math.round(avgProcessingTime),
    successRate: successful.length > 0 ? (successful.length / logs.length) * 100 : 0,
  }
}

/**
 * Add items to embedding queue
 */
export async function queueForEmbedding(
  items: Array<{ type: 'message' | 'session'; id: string; priority?: number }>
) {
  const queueItems = items.map(item => ({
    itemType: item.type,
    itemId: item.id,
    priority: item.priority || 5,
  }))

  await db
    .insert(embeddingQueue)
    .values(queueItems)
    .onConflictDoNothing()

  console.log(`📥 Queued ${items.length} items for embedding`)
}