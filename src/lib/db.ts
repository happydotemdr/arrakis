import { PrismaClient, Prisma } from '@prisma/client'

// Define log levels based on environment
const logLevels: Prisma.LogLevel[] = process.env.NODE_ENV === 'production'
  ? ['error', 'warn']
  : ['query', 'error', 'warn', 'info']

// Global singleton for Prisma Client to prevent multiple instances in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: logLevels,
    errorFormat: 'pretty',
  })

// Preserve Prisma client instance in development to avoid connection pool exhaustion
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}

// Type helper for working with vector embeddings
export type VectorEmbedding = number[]

// Helper to format vector for SQL queries
export function formatVector(embedding: VectorEmbedding): string {
  return `[${embedding.join(',')}]`
}

// Helper to parse vector from database
export function parseVector(vectorString: string | null): VectorEmbedding | null {
  if (!vectorString) return null
  try {
    // Remove brackets and split by comma
    const cleaned = vectorString.replace(/[\[\]]/g, '')
    return cleaned.split(',').map(Number)
  } catch {
    return null
  }
}

// DEPRECATED: These functions had SQL injection vulnerabilities
// Use the safe functions in vector-operations.ts (findSimilarConversations) instead
// which use parameterized queries via Prisma's $queryRaw template tag
export const vectorQueries = {
  findSimilar: () => {
    throw new Error('DEPRECATED: Use findSimilarConversations from vector-operations.ts')
  },
  findWithinDistance: () => {
    throw new Error('DEPRECATED: Use findSimilarConversations from vector-operations.ts')
  },
}

// Export Prisma namespace for type access
export * from '@prisma/client'