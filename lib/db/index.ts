import { drizzle } from 'drizzle-orm/neon-serverless'
import { Pool } from '@neondatabase/serverless'
import * as schema from './schema'

// Database connection
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Create connection pool
const pool = new Pool({ connectionString })

// Create drizzle instance
export const db = drizzle(pool, {
  schema,
  logger: process.env.NODE_ENV === 'development',
})

// Export schema for external use
export * from './schema'
export type Database = typeof db
