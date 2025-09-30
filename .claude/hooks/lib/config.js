const path = require('path');
const os = require('os');

const CONFIG = {
  // Logging configuration
  logging: {
    enabled: true,
    level: process.env.CLAUDE_HOOK_DEBUG === 'true' ? 'debug' : 'info',
    directory: path.join(process.cwd(), '.claude', 'logs'),
    files: {
      success: 'webhook-success.log',
      error: 'webhook-error.log',
      queue: 'webhook-queue.log',
      debug: 'webhook-debug.log'
    },
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    asyncWrite: true,
    flushInterval: 10000 // 10 seconds (optimized: 50% fewer I/O operations)
  },

  // Queue configuration
  queue: {
    enabled: true,
    directory: path.join(process.cwd(), '.claude', 'queue'),
    subdirs: {
      pending: 'pending',
      processing: 'processing',
      failed: 'failed'
    },
    maxRetries: 5,
    retryDelays: [60000, 300000, 900000, 3600000, 7200000], // 1m, 5m, 15m, 1h, 2h
    maxQueueSize: 1000,
    maxFileAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  },

  // Webhook configuration
  webhook: {
    url: process.env.CLAUDE_HOOK_API_URL || 'http://localhost:3000/api/claude-hooks',
    apiKey: process.env.CLAUDE_HOOK_API_KEY,
    timeout: parseInt(process.env.CLAUDE_HOOK_TIMEOUT || '5000'),
    maxRetries: parseInt(process.env.CLAUDE_HOOK_RETRY_ATTEMPTS || '3'),
    retryDelay: parseInt(process.env.CLAUDE_HOOK_RETRY_DELAY || '1000'),
    retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET'],
    retryableStatusCodes: [500, 502, 503, 504, 429]
  },

  // System information
  system: {
    hostname: os.hostname(),
    platform: os.platform(),
    nodeVersion: process.version
  }
};

module.exports = CONFIG;