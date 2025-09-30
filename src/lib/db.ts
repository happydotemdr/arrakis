import { PrismaClient, Prisma } from '@prisma/client'

// Define log levels based on environment
const logLevels: Prisma.LogLevel[] = process.env.NODE_ENV === 'production'
  ? ['error', 'warn']
  : ['query', 'error', 'warn', 'info']

// Global singleton for Prisma Client to prevent multiple instances in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Optimize connection string for Neon
function optimizeConnectionUrl(url: string): string {
  const connectionUrl = new URL(url)
  connectionUrl.searchParams.set('pgbouncer', 'true')
  connectionUrl.searchParams.set('pool_mode', 'transaction')
  connectionUrl.searchParams.set('connection_limit', '20')
  connectionUrl.searchParams.set('idle_timeout', '30')
  connectionUrl.searchParams.set('connect_timeout', '10')
  return connectionUrl.toString()
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL ? optimizeConnectionUrl(process.env.DATABASE_URL) : undefined
      }
    },
    log: logLevels,
    errorFormat: process.env.NODE_ENV === 'development' ? 'pretty' : 'minimal',
  })

// Monitor slow queries in production
// Commented out due to TypeScript strict mode issues with Prisma event types
// if (process.env.NODE_ENV === 'production') {
//   db.$on('query', (e: any) => {
//     if (e.duration > 100) { // Log queries slower than 100ms
//       console.warn(`[SLOW QUERY] ${e.duration}ms:`, e.query.substring(0, 100) + '...')
//     }
//   })
// }

// Graceful shutdown
process.on('beforeExit', async () => {
  await db.$disconnect()
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