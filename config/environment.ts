/**
 * Environment Configuration for Arrakis
 * Handles environment-specific settings for development, staging, and production
 */

import { z } from 'zod'

// Environment schema validation
const envSchema = z.object({
  // Environment settings
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('production'),
  NEXT_PUBLIC_ENV: z.enum(['development', 'staging', 'production']).default('production'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Database
  DATABASE_URL: z.string().url('Database URL is required'),

  // Redis (optional)
  REDIS_URL: z.string().url().optional(),

  // AI Services
  ANTHROPIC_API_KEY: z.string().min(1, 'Anthropic API key is required'),
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API key is required'),

  // Application URLs
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  // Feature flags
  ENABLE_QUERY_LOGGING: z.string().transform(val => val === 'true').default('false'),
  ENABLE_DEV_TOOLS: z.string().transform(val => val === 'true').default('false'),

  // Performance settings
  NODE_OPTIONS: z.string().optional(),

  // Render.com specific
  RENDER_SERVICE_ID: z.string().optional(),
  RENDER_SERVICE_NAME: z.string().optional(),
})

// Parse and validate environment variables
const env = envSchema.parse(process.env)

// Environment-specific configurations
const environmentConfig = {
  development: {
    database: {
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      max: 10, // max connections
    },
    redis: {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    },
    features: {
      enableQueryLogging: true,
      enableDevTools: true,
      enableDebugMode: true,
    },
    ai: {
      openai: {
        maxRetries: 3,
        timeout: 30000,
      },
      anthropic: {
        maxRetries: 3,
        timeout: 30000,
      },
    },
    monitoring: {
      enableDetailedLogs: true,
      logLevel: 'debug' as const,
    },
  },

  staging: {
    database: {
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 20, // max connections
    },
    redis: {
      retryDelayOnFailover: 200,
      maxRetriesPerRequest: 5,
    },
    features: {
      enableQueryLogging: false,
      enableDevTools: false,
      enableDebugMode: false,
    },
    ai: {
      openai: {
        maxRetries: 5,
        timeout: 45000,
      },
      anthropic: {
        maxRetries: 5,
        timeout: 45000,
      },
    },
    monitoring: {
      enableDetailedLogs: true,
      logLevel: 'info' as const,
    },
  },

  production: {
    database: {
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 60000,
      max: 50, // max connections
    },
    redis: {
      retryDelayOnFailover: 500,
      maxRetriesPerRequest: 10,
    },
    features: {
      enableQueryLogging: false,
      enableDevTools: false,
      enableDebugMode: false,
    },
    ai: {
      openai: {
        maxRetries: 10,
        timeout: 60000,
      },
      anthropic: {
        maxRetries: 10,
        timeout: 60000,
      },
    },
    monitoring: {
      enableDetailedLogs: false,
      logLevel: 'warn' as const,
    },
  },
} as const

// Get current environment configuration
const currentEnv = env.NEXT_PUBLIC_ENV
const config = environmentConfig[currentEnv]

// Application configuration object
export const appConfig = {
  // Environment info
  env: currentEnv,
  isDevelopment: currentEnv === 'development',
  isStaging: currentEnv === 'staging',
  isProduction: currentEnv === 'production',

  // Environment variables
  database: {
    url: env.DATABASE_URL,
    ...config.database,
  },

  redis: {
    url: env.REDIS_URL,
    ...config.redis,
  },

  ai: {
    anthropic: {
      apiKey: env.ANTHROPIC_API_KEY,
      ...config.ai.anthropic,
    },
    openai: {
      apiKey: env.OPENAI_API_KEY,
      ...config.ai.openai,
    },
  },

  app: {
    url: env.NEXT_PUBLIC_APP_URL,
    logLevel: env.LOG_LEVEL,
  },

  features: {
    queryLogging: env.ENABLE_QUERY_LOGGING || config.features.enableQueryLogging,
    devTools: env.ENABLE_DEV_TOOLS || config.features.enableDevTools,
    debugMode: config.features.enableDebugMode,
  },

  monitoring: config.monitoring,

  // Render.com specific
  render: {
    serviceId: env.RENDER_SERVICE_ID,
    serviceName: env.RENDER_SERVICE_NAME,
  },
} as const

// Type exports
export type AppConfig = typeof appConfig
export type Environment = typeof currentEnv

// Environment utilities
export const getEnvironmentInfo = () => ({
  environment: currentEnv,
  isDevelopment: appConfig.isDevelopment,
  isStaging: appConfig.isStaging,
  isProduction: appConfig.isProduction,
  features: appConfig.features,
})

// Database configuration helper
export const getDatabaseConfig = () => ({
  connectionString: appConfig.database.url,
  ssl: appConfig.isProduction ? { rejectUnauthorized: false } : false,
  ...appConfig.database,
})

// Redis configuration helper
export const getRedisConfig = () => {
  if (!appConfig.redis.url) {
    return null
  }

  return {
    url: appConfig.redis.url,
    ...appConfig.redis,
  }
}

// Logging configuration
export const getLogConfig = () => ({
  level: appConfig.monitoring.logLevel,
  enableDetailedLogs: appConfig.monitoring.enableDetailedLogs,
  enableQueryLogging: appConfig.features.queryLogging,
})

// Export individual configs for convenience
export { env }

// Default export
export default appConfig