#!/usr/bin/env bun

/**
 * Background Worker Process for Arrakis
 * Handles AI processing, embeddings generation, and other background tasks
 */

import { Worker as BullMQWorker } from 'bullmq'
import IORedis from 'ioredis'
import { z } from 'zod'

// Environment validation
const envSchema = z.object({
  REDIS_URL: z.string().url('Redis URL is required'),
  DATABASE_URL: z.string().url('Database URL is required'),
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API key is required'),
  ANTHROPIC_API_KEY: z.string().min(1, 'Anthropic API key is required'),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('production'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

// Parse environment variables
const env = envSchema.parse(process.env)

// Redis connection
const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  lazyConnect: true,
})

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`)

  try {
    // Close workers
    await Promise.all(workers.map(worker => worker.close()))
    console.log('Workers closed successfully')

    // Close Redis connection
    await redis.quit()
    console.log('Redis connection closed')

    process.exit(0)
  } catch (error) {
    console.error('Error during shutdown:', error)
    process.exit(1)
  }
}

// Job processors
const processors = {
  // Process message embeddings
  'generate-embeddings': async (job: any) => {
    const { messageId, content } = job.data
    console.log(`Processing embeddings for message ${messageId}`)

    try {
      // Import the vector processor dynamically to avoid circular deps
      const { generateMessageEmbedding } = await import('../lib/vectors/vector-processor')

      const result = await generateMessageEmbedding(messageId, content)
      console.log(`Successfully generated embeddings for message ${messageId}`)

      return result
    } catch (error) {
      console.error(`Failed to generate embeddings for message ${messageId}:`, error)
      throw error
    }
  },

  // Process conversation analysis
  'analyze-conversation': async (job: any) => {
    const { sessionId } = job.data
    console.log(`Analyzing conversation for session ${sessionId}`)

    try {
      // Import the analysis processor dynamically
      const { analyzeConversation } = await import('../lib/context/context-retrieval')

      const result = await analyzeConversation(sessionId)
      console.log(`Successfully analyzed conversation for session ${sessionId}`)

      return result
    } catch (error) {
      console.error(`Failed to analyze conversation for session ${sessionId}:`, error)
      throw error
    }
  },

  // Process Claude API requests
  'claude-request': async (job: any) => {
    const { messages, options } = job.data
    console.log(`Processing Claude API request with ${messages.length} messages`)

    try {
      // Import the Claude service dynamically
      const { processClaudeRequest } = await import('../lib/capture/claude-service')

      const result = await processClaudeRequest(messages, options)
      console.log('Successfully processed Claude API request')

      return result
    } catch (error) {
      console.error('Failed to process Claude API request:', error)
      throw error
    }
  },

  // Cleanup old data
  'cleanup-data': async (job: any) => {
    const { olderThanDays = 30 } = job.data
    console.log(`Cleaning up data older than ${olderThanDays} days`)

    try {
      // Import the cleanup service dynamically
      const { cleanupOldData } = await import('../lib/db/cleanup')

      const result = await cleanupOldData(olderThanDays)
      console.log(`Successfully cleaned up old data: ${result.deletedRecords} records removed`)

      return result
    } catch (error) {
      console.error('Failed to cleanup old data:', error)
      throw error
    }
  },
}

// Create workers for each job type
const workers: BullMQWorker[] = []

Object.entries(processors).forEach(([jobType, processor]) => {
  const worker = new BullMQWorker(
    jobType,
    processor,
    {
      connection: redis,
      concurrency: env.NODE_ENV === 'production' ? 10 : 5,
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  )

  // Worker event handlers
  worker.on('completed', (job) => {
    console.log(`Job ${job.id} (${jobType}) completed successfully`)
  })

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} (${jobType}) failed:`, err.message)
  })

  worker.on('error', (err) => {
    console.error(`Worker error for ${jobType}:`, err)
  })

  workers.push(worker)
  console.log(`Started worker for job type: ${jobType}`)
})

// Health check endpoint (if needed)
const startHealthServer = () => {
  if (env.NODE_ENV === 'development') {
    const http = require('http')

    const server = http.createServer((req: any, res: any) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          status: 'healthy',
          workers: workers.length,
          timestamp: new Date().toISOString(),
        }))
      } else {
        res.writeHead(404)
        res.end('Not Found')
      }
    })

    const port = process.env.WORKER_PORT || 3001
    server.listen(port, () => {
      console.log(`Worker health server listening on port ${port}`)
    })
  }
}

// Signal handlers for graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Start the worker
const main = async () => {
  try {
    console.log('Starting Arrakis background worker...')
    console.log(`Environment: ${env.NODE_ENV}`)
    console.log(`Log level: ${env.LOG_LEVEL}`)
    console.log(`Workers: ${workers.length}`)

    // Test Redis connection
    await redis.ping()
    console.log('Redis connection established')

    // Start health server in development
    startHealthServer()

    console.log('Arrakis worker is ready and waiting for jobs!')

  } catch (error) {
    console.error('Failed to start worker:', error)
    process.exit(1)
  }
}

// Start the application
main().catch((error) => {
  console.error('Worker startup error:', error)
  process.exit(1)
})