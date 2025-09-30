const https = require('https');
const http = require('http');
const { URL } = require('url');
const CONFIG = require('./config');
const logger = require('./logger');
const IdGenerator = require('./id-generator');

/**
 * WebhookClient - HTTP client with retry logic and request tracing
 * Features:
 * - Automatic retry with exponential backoff
 * - Request/trace/span ID generation
 * - Error classification (retryable vs non-retryable)
 * - Timeout protection
 */
class WebhookClient {
  constructor() {
    this.config = CONFIG.webhook;
  }

  /**
   * Send webhook with tracing
   * @param {string} url - Webhook URL
   * @param {object} payload - Webhook payload
   * @param {object} context - Request context (requestId, traceId, retryCount)
   * @returns {Promise<object>} Result with success status and metadata
   */
  async send(url, payload, context = {}) {
    const requestId = context.requestId || IdGenerator.generateRequestId();
    const traceId = context.traceId || IdGenerator.generateTraceId(payload.sessionId || 'unknown');
    const spanId = IdGenerator.generateSpanId('webhook', 0);

    const startTime = Date.now();

    logger.debug('Sending webhook', {
      requestId,
      traceId,
      spanId,
      url,
      event: payload.event
    });

    // Add tracing headers to payload
    const tracedPayload = {
      ...payload,
      _trace: {
        requestId,
        traceId,
        spanId,
        timestamp: new Date().toISOString()
      }
    };

    try {
      const response = await this.sendWithRetry(url, tracedPayload, requestId, traceId);
      const duration = Date.now() - startTime;

      logger.info('Webhook sent successfully', {
        requestId,
        traceId,
        spanId,
        event: payload.event,
        statusCode: response.statusCode,
        duration,
        retryCount: context.retryCount || 0
      });

      return {
        success: true,
        requestId,
        traceId,
        statusCode: response.statusCode,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Webhook failed', {
        requestId,
        traceId,
        spanId,
        event: payload.event,
        error: error.message,
        code: error.code,
        statusCode: error.statusCode,
        duration,
        retryCount: context.retryCount || 0
      });

      return {
        success: false,
        requestId,
        traceId,
        error,
        duration,
        shouldQueue: this.shouldQueue(error)
      };
    }
  }

  /**
   * Send request with immediate retries
   */
  async sendWithRetry(url, payload, requestId, traceId) {
    let lastError;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logger.debug('Retrying webhook', {
            requestId,
            traceId,
            attempt: attempt + 1,
            maxRetries: this.config.maxRetries
          });
          await this.sleep(this.config.retryDelay);
        }

        return await this.sendRequest(url, payload, requestId);
      } catch (error) {
        lastError = error;

        // Don't retry non-retryable errors
        if (!this.isRetryable(error)) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  /**
   * Make HTTP/HTTPS request
   */
  sendRequest(url, payload, requestId) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const postData = JSON.stringify(payload);

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'Claude-Code-Webhook/1.0',
          'X-Request-ID': requestId,
          'Authorization': this.config.apiKey ? `Bearer ${this.config.apiKey}` : undefined
        },
        timeout: this.config.timeout
      };

      const req = protocol.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, body: data });
          } else {
            const error = new Error(`HTTP ${res.statusCode}: ${data}`);
            error.statusCode = res.statusCode;
            error.code = 'HTTP_ERROR';
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        const error = new Error('Request timeout');
        error.code = 'ETIMEDOUT';
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Check if error should be retried immediately
   */
  isRetryable(error) {
    // Network errors
    if (this.config.retryableErrors.includes(error.code)) {
      return true;
    }

    // HTTP status codes
    if (error.statusCode && this.config.retryableStatusCodes.includes(error.statusCode)) {
      return true;
    }

    return false;
  }

  /**
   * Check if error should be queued for persistent retry
   */
  shouldQueue(error) {
    return this.isRetryable(error);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new WebhookClient();