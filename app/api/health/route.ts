/**
 * Health Check API Endpoint for Render.com
 * Provides comprehensive application health status
 */

import { NextRequest, NextResponse } from 'next/server'
import { performHealthCheck, type HealthStatus } from '../../../scripts/health-check'

// Health check endpoint
export async function GET(request: NextRequest) {
  try {
    // Perform comprehensive health check
    const health = await performHealthCheck()

    // Return appropriate HTTP status code
    const statusCode = health.status === 'healthy' ? 200 : 503

    return new NextResponse(JSON.stringify(health, null, 2), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check': 'true',
      },
    })

  } catch (error) {
    console.error('Health check endpoint error:', error)

    const errorHealth: HealthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: 'fail',
          error: 'Health check endpoint failed',
        },
        application: {
          status: 'fail',
          version: 'unknown',
          uptime: process.uptime(),
        },
      },
    }

    return new NextResponse(JSON.stringify(errorHealth, null, 2), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check': 'true',
      },
    })
  }
}

// Support HEAD requests for basic health checking
export async function HEAD(request: NextRequest) {
  try {
    const health = await performHealthCheck()
    const statusCode = health.status === 'healthy' ? 200 : 503

    return new NextResponse(null, {
      status: statusCode,
      headers: {
        'X-Health-Check': 'true',
        'X-Health-Status': health.status,
      },
    })

  } catch (error) {
    return new NextResponse(null, {
      status: 503,
      headers: {
        'X-Health-Check': 'true',
        'X-Health-Status': 'unhealthy',
      },
    })
  }
}

// Options for CORS if needed
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}