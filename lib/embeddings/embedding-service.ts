/**
 * OpenAI Embedding Service - Phase 6 System A
 * Generates vector embeddings for conversation content using OpenAI's API
 */

import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Embedding model configuration
const EMBEDDING_MODEL = 'text-embedding-3-small' // Cost-effective, good performance
const EMBEDDING_DIMENSIONS = 1536 // Default dimensions for text-embedding-3-small
const MAX_CHUNK_SIZE = 8000 // Token limit for embedding model

export interface EmbeddingChunk {
  text: string
  startIndex: number
  endIndex: number
  embedding?: number[]
}

export interface EmbeddingResult {
  chunks: EmbeddingChunk[]
  totalTokens: number
  model: string
  dimensions: number
}

/**
 * Generate embeddings for a piece of text
 * Automatically chunks large text if needed
 */
export async function generateEmbedding(
  text: string,
  options: {
    chunkSize?: number
    overlapSize?: number
    metadata?: Record<string, any>
  } = {}
): Promise<EmbeddingResult> {
  const { chunkSize = MAX_CHUNK_SIZE, overlapSize = 200 } = options

  try {
    // Clean and prepare text
    const cleanedText = cleanTextForEmbedding(text)

    if (!cleanedText.trim()) {
      throw new Error('Text is empty after cleaning')
    }

    // Split into chunks if text is too long
    const chunks = splitTextIntoChunks(cleanedText, chunkSize, overlapSize)

    console.log(`📊 Embedding ${chunks.length} chunks with model ${EMBEDDING_MODEL}`)

    // Generate embeddings for each chunk
    const embeddedChunks: EmbeddingChunk[] = []
    let totalTokens = 0

    for (const chunk of chunks) {
      try {
        const response = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: chunk.text,
          dimensions: EMBEDDING_DIMENSIONS,
        })

        embeddedChunks.push({
          ...chunk,
          embedding: response.data[0].embedding,
        })

        totalTokens += response.usage.total_tokens

        // Add small delay to avoid rate limiting
        if (chunks.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (error) {
        console.error(`❌ Failed to embed chunk: ${chunk.text.substring(0, 100)}...`, error)
        // Add chunk without embedding for tracking
        embeddedChunks.push(chunk)
      }
    }

    console.log(`✅ Generated embeddings for ${embeddedChunks.length} chunks (${totalTokens} tokens)`)

    return {
      chunks: embeddedChunks,
      totalTokens,
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
    }
  } catch (error) {
    console.error('❌ Failed to generate embeddings:', error)
    throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * More efficient for processing many texts at once
 */
export async function generateBatchEmbeddings(
  texts: string[],
  options: {
    batchSize?: number
    chunkSize?: number
    metadata?: Record<string, any>[]
  } = {}
): Promise<EmbeddingResult[]> {
  const { batchSize = 5 } = options
  const results: EmbeddingResult[] = []

  console.log(`🔄 Processing ${texts.length} texts in batches of ${batchSize}`)

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    const batchPromises = batch.map(text => generateEmbedding(text, options))

    try {
      const batchResults = await Promise.allSettled(batchPromises)

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          console.error('❌ Batch embedding failed:', result.reason)
          // Add empty result for failed embedding
          results.push({
            chunks: [{ text: '', startIndex: 0, endIndex: 0 }],
            totalTokens: 0,
            model: EMBEDDING_MODEL,
            dimensions: EMBEDDING_DIMENSIONS,
          })
        }
      }

      // Rate limiting delay between batches
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    } catch (error) {
      console.error('❌ Batch processing error:', error)
    }
  }

  console.log(`✅ Completed batch embedding: ${results.length} results`)
  return results
}

/**
 * Clean text to improve embedding quality
 */
function cleanTextForEmbedding(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Remove HTML tags if any
    .replace(/<[^>]*>/g, '')
    // Trim whitespace
    .trim()
}

/**
 * Split text into chunks with overlap for better context preservation
 */
function splitTextIntoChunks(
  text: string,
  chunkSize: number,
  overlapSize: number
): EmbeddingChunk[] {
  if (text.length <= chunkSize) {
    return [{
      text,
      startIndex: 0,
      endIndex: text.length,
    }]
  }

  const chunks: EmbeddingChunk[] = []
  let startIndex = 0

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + chunkSize, text.length)
    let chunkText = text.slice(startIndex, endIndex)

    // Try to break at sentence boundaries for better context
    if (endIndex < text.length) {
      const lastSentenceEnd = Math.max(
        chunkText.lastIndexOf('.'),
        chunkText.lastIndexOf('!'),
        chunkText.lastIndexOf('?')
      )

      if (lastSentenceEnd > chunkSize * 0.7) {
        chunkText = chunkText.slice(0, lastSentenceEnd + 1)
      }
    }

    chunks.push({
      text: chunkText.trim(),
      startIndex,
      endIndex: startIndex + chunkText.length,
    })

    // Calculate next start position with overlap
    const nextStart = startIndex + chunkText.length - overlapSize
    startIndex = Math.max(nextStart, startIndex + 1)

    // Prevent infinite loop
    if (startIndex >= endIndex) {
      break
    }
  }

  return chunks.filter(chunk => chunk.text.length > 0)
}

/**
 * Calculate cosine similarity between two embedding vectors
 */
export function calculateCosineSimilarity(
  vectorA: number[],
  vectorB: number[]
): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same dimensions')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i]
    normA += vectorA[i] * vectorA[i]
    normB += vectorB[i] * vectorB[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)

  if (denominator === 0) {
    return 0
  }

  return dotProduct / denominator
}

/**
 * Validate OpenAI API key is configured
 */
export function validateEmbeddingConfiguration(): boolean {
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is required for embeddings')
    return false
  }

  console.log('✅ OpenAI embedding service configured')
  return true
}

export { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, MAX_CHUNK_SIZE }