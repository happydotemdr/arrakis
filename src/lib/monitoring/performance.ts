// Performance monitoring utilities for Arrakis

export interface PerformanceMetric {
  name: string
  value: number
  unit: 'ms' | 'count' | 'bytes' | 'percent'
  timestamp: Date
  context?: Record<string, any>
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private timers: Map<string, number> = new Map()

  // Start timing an operation
  startTimer(name: string, context?: Record<string, any>): void {
    this.timers.set(name, performance.now())
    if (context) {
      this.timers.set(`${name}_context`, context as any)
    }
  }

  // End timing and record metric
  endTimer(name: string): number {
    const startTime = this.timers.get(name)
    if (!startTime) {
      console.warn(`Timer '${name}' was not started`)
      return 0
    }

    const duration = performance.now() - startTime
    const contextValue = this.timers.get(`${name}_context`)
    const context = (typeof contextValue === 'object' ? contextValue : undefined) as Record<string, any> | undefined

    this.recordMetric({
      name,
      value: duration,
      unit: 'ms',
      timestamp: new Date(),
      context,
    })

    this.timers.delete(name)
    this.timers.delete(`${name}_context`)

    return duration
  }

  // Record a custom metric
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric)

    // Log slow operations in development
    if (process.env.NODE_ENV === 'development') {
      if (metric.unit === 'ms' && metric.value > 100) {
        console.warn(`[SLOW OPERATION] ${metric.name}: ${metric.value}ms`, metric.context)
      }
    }

    // Keep only last 1000 metrics to prevent memory leaks
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }

  // Get performance summary
  getSummary(): {
    totalMetrics: number
    slowOperations: PerformanceMetric[]
    averages: Record<string, number>
  } {
    const slowOperations = this.metrics.filter(
      m => m.unit === 'ms' && m.value > 100
    )

    const averages: Record<string, number> = {}
    const operationGroups = this.metrics.reduce((acc, metric) => {
      if (!acc[metric.name]) acc[metric.name] = []
      acc[metric.name].push(metric.value)
      return acc
    }, {} as Record<string, number[]>)

    Object.entries(operationGroups).forEach(([name, values]) => {
      averages[name] = values.reduce((sum, val) => sum + val, 0) / values.length
    })

    return {
      totalMetrics: this.metrics.length,
      slowOperations,
      averages,
    }
  }

  // Clear all metrics
  clear(): void {
    this.metrics = []
    this.timers.clear()
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor()

// HOC for timing tRPC operations
export function withTiming<T extends (...args: any[]) => any>(
  fn: T,
  operationName: string
): T {
  return ((...args: any[]) => {
    performanceMonitor.startTimer(operationName, {
      args: args.length,
      timestamp: new Date().toISOString(),
    })

    try {
      const result = fn(...args)

      // Handle promises
      if (result && typeof result.then === 'function') {
        return result
          .then((value: any) => {
            performanceMonitor.endTimer(operationName)
            return value
          })
          .catch((error: any) => {
            performanceMonitor.endTimer(operationName)
            performanceMonitor.recordMetric({
              name: `${operationName}_error`,
              value: 1,
              unit: 'count',
              timestamp: new Date(),
              context: { error: error.message },
            })
            throw error
          })
      }

      // Handle synchronous operations
      performanceMonitor.endTimer(operationName)
      return result
    } catch (error) {
      performanceMonitor.endTimer(operationName)
      performanceMonitor.recordMetric({
        name: `${operationName}_error`,
        value: 1,
        unit: 'count',
        timestamp: new Date(),
        context: { error: (error as Error).message },
      })
      throw error
    }
  }) as T
}

// Database query timing decorator
export function timeQuery<T extends (...args: any[]) => any>(
  queryName: string,
  fn: T
): T {
  return withTiming(fn, `db_${queryName}`)
}

// API endpoint timing decorator
export function timeAPI<T extends (...args: any[]) => any>(
  endpointName: string,
  fn: T
): T {
  return withTiming(fn, `api_${endpointName}`)
}

// React hook for accessing performance data
export function usePerformanceMetrics() {
  const summary = performanceMonitor.getSummary()

  return {
    summary,
    recordMetric: (metric: PerformanceMetric) => performanceMonitor.recordMetric(metric),
    clear: () => performanceMonitor.clear(),
  }
}

// Utility for measuring component render times
export function measureRender(componentName: string) {
  return {
    start: () => performanceMonitor.startTimer(`render_${componentName}`),
    end: () => performanceMonitor.endTimer(`render_${componentName}`),
  }
}