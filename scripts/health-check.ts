#!/usr/bin/env bun

/**
 * Health Check Script for Arrakis
 * Verifies database connectivity, Redis connectivity, and application health
 */

import { z } from 'zod'

// Environment validation
const envSchema = z.object({
  DATABASE_URL: z.string().url('Database URL is required'),
  REDIS_URL: z.string().optional(),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('production'),
})

interface HealthStatus {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  checks: {
    database: {
      status: 'pass' | 'fail'
      responseTime?: number
      error?: string
    }
    redis?: {
      status: 'pass' | 'fail'
      responseTime?: number
      error?: string
    }
    application: {
      status: 'pass' | 'fail'
      version: string
      uptime: number
    }
  }
}

const checkDatabase = async (): Promise<HealthStatus['checks']['database']> => {
  const startTime = Date.now()

  try {
    // Import database connection
    const { db } = await import('../lib/db/db')

    // Simple query to test connectivity
    await db.execute('SELECT 1 as health_check')

    return {
      status: 'pass',
      responseTime: Date.now() - startTime,
    }
  } catch (error) {
    return {
      status: 'fail',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown database error',
    }
  }
}

const checkRedis = async (redisUrl: string): Promise<HealthStatus['checks']['redis']> => {
  const startTime = Date.now()

  try {
    const IORedis = (await import('ioredis')).default
    const redis = new IORedis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
    })

    await redis.ping()
    await redis.quit()

    return {
      status: 'pass',
      responseTime: Date.now() - startTime,
    }
  } catch (error) {
    return {
      status: 'fail',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown Redis error',
    }
  }
}

const getApplicationHealth = (): HealthStatus['checks']['application'] => {
  try {
    const packageJson = require('../package.json')

    return {
      status: 'pass',
      version: packageJson.version || '0.1.0',
      uptime: process.uptime(),
    }
  } catch (error) {
    return {
      status: 'fail',
      version: 'unknown',
      uptime: process.uptime(),
    }
  }
}

const performHealthCheck = async (): Promise<HealthStatus> => {
  const env = envSchema.parse(process.env)

  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: 'fail' },
      application: getApplicationHealth(),
    },
  }

  // Check database
  health.checks.database = await checkDatabase()

  // Check Redis if configured
  if (env.REDIS_URL) {
    health.checks.redis = await checkRedis(env.REDIS_URL)
  }

  // Determine overall health status
  const hasFailures = [
    health.checks.database.status === 'fail',
    health.checks.redis?.status === 'fail',
    health.checks.application.status === 'fail',
  ].some(Boolean)

  health.status = hasFailures ? 'unhealthy' : 'healthy'

  return health
}

// CLI usage
const main = async () => {
  try {
    const health = await performHealthCheck()

    // Output results
    console.log(JSON.stringify(health, null, 2))

    // Exit with appropriate code
    const exitCode = health.status === 'healthy' ? 0 : 1
    process.exit(exitCode)

  } catch (error) {
    console.error('Health check failed:', error)

    const errorHealth: HealthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: 'fail',
          error: 'Health check script failed to execute',
        },
        application: {
          status: 'fail',
          version: 'unknown',
          uptime: process.uptime(),
        },
      },
    }

    console.log(JSON.stringify(errorHealth, null, 2))
    process.exit(1)
  }
}

// Export for use as a module
export { performHealthCheck, type HealthStatus }

// Run if called directly
if (import.meta.main) {
  main()
}