import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Health check endpoint for Render.com load balancer
export async function GET() {
  try {
    // Check database connectivity
    const start = performance.now()
    await db.$queryRaw`SELECT 1`
    const dbLatency = performance.now() - start

    // Check if database response is healthy (< 1000ms)
    const isHealthy = dbLatency < 1000

    const healthData = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: isHealthy ? 'up' : 'slow',
          latency: Math.round(dbLatency),
          unit: 'ms'
        },
        api: {
          status: 'up',
          version: process.env.npm_package_version || '0.1.0'
        }
      },
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      }
    }

    return NextResponse.json(healthData, {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Database connection failed',
        services: {
          database: {
            status: 'down',
            error: (error as Error).message
          }
        }
      },
      { status: 503 }
    )
  }
}