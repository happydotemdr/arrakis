#!/usr/bin/env node

/**
 * Claude Code Hook Script - Conversation Capture (V2 - Bulletproof Edition)
 *
 * Enhanced with:
 * - Structured logging with request tracing
 * - File-based queue for failed requests
 * - Automatic retry with exponential backoff
 * - Complete observability
 *
 * Environment Variables:
 * - CLAUDE_HOOK_API_URL: Webhook endpoint URL
 * - CLAUDE_HOOK_API_KEY: Bearer token for authentication
 * - CLAUDE_HOOK_DEBUG: Enable debug logging (true/false)
 * - CLAUDE_HOOK_ENABLED: Enable/disable hook (true/false, default: true)
 */

const logger = require('./lib/logger');
const webhookClient = require('./lib/webhook-client');
const queueManager = require('./lib/queue-manager');
const IdGenerator = require('./lib/id-generator');
const CONFIG = require('./lib/config');

// Hook environment variables provided by Claude Code
const HOOK_ENV = {
  event: process.env.CLAUDE_HOOK_EVENT,
  sessionId: process.env.CLAUDE_SESSION_ID,
  projectPath: process.env.CLAUDE_PROJECT_DIR,
  transcriptPath: process.env.CLAUDE_TRANSCRIPT_PATH,
  userPrompt: process.env.CLAUDE_USER_PROMPT,
  toolName: process.env.CLAUDE_TOOL_NAME,
  toolParameters: process.env.CLAUDE_TOOL_PARAMETERS,
  toolResult: process.env.CLAUDE_TOOL_RESULT,
  toolDuration: process.env.CLAUDE_TOOL_DURATION,
  toolStatus: process.env.CLAUDE_TOOL_STATUS,
  toolError: process.env.CLAUDE_TOOL_ERROR,
};

/**
 * Main execution function
 */
async function main() {
  const startTime = Date.now();

  try {
    // Check if hook is enabled
    if (!CONFIG.webhook.url || CONFIG.webhook.url.includes('localhost')) {
      logger.warn('Webhook URL not configured or pointing to localhost', {
        url: CONFIG.webhook.url
      });
      process.exit(0);
    }

    // Validate required environment
    if (!HOOK_ENV.event) {
      logger.error('CLAUDE_HOOK_EVENT not provided');
      process.exit(1);
    }

    // Generate tracing IDs
    const requestId = IdGenerator.generateRequestId();
    const traceId = IdGenerator.generateTraceId(HOOK_ENV.sessionId);

    logger.debug('Hook triggered', {
      requestId,
      traceId,
      event: HOOK_ENV.event,
      sessionId: HOOK_ENV.sessionId
    });

    // Build webhook payload
    const payload = buildHookPayload();

    // Send webhook with tracing
    const result = await webhookClient.send(CONFIG.webhook.url, payload, {
      requestId,
      traceId,
      retryCount: 0
    });

    const duration = Date.now() - startTime;

    if (result.success) {
      logger.info('Hook completed successfully', {
        requestId,
        traceId,
        event: HOOK_ENV.event,
        duration,
        statusCode: result.statusCode
      });
      process.exit(0);
    } else {
      // Handle failure
      if (result.shouldQueue) {
        // Queue for persistent retry
        await queueManager.enqueue(requestId, payload, result.error, 0);

        logger.warn('Webhook failed but queued for retry', {
          requestId,
          traceId,
          event: HOOK_ENV.event,
          error: result.error.message,
          duration
        });

        // Exit gracefully - don't break Claude Code
        process.exit(0);
      } else {
        // Non-retryable error
        logger.error('Webhook failed (not queued)', {
          requestId,
          traceId,
          event: HOOK_ENV.event,
          error: result.error.message,
          code: result.error.code,
          statusCode: result.error.statusCode,
          duration
        });

        // Exit gracefully for non-retryable errors too
        process.exit(0);
      }
    }

  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('Unhandled error in hook', {
      event: HOOK_ENV.event,
      error: error.message,
      stack: error.stack,
      duration
    });

    // Always exit gracefully to not break Claude Code
    process.exit(0);
  }
}

/**
 * Build hook payload based on event type
 */
function buildHookPayload() {
  const basePayload = {
    event: HOOK_ENV.event,
    timestamp: new Date().toISOString(),
    sessionId: HOOK_ENV.sessionId,
    projectPath: HOOK_ENV.projectPath,
    transcriptPath: HOOK_ENV.transcriptPath,
  };

  // Add event-specific data
  switch (HOOK_ENV.event) {
    case 'SessionStart':
      return {
        ...basePayload,
        userInfo: {
          platform: process.platform,
          nodeVersion: process.version,
        }
      };

    case 'UserPromptSubmit':
      return {
        ...basePayload,
        prompt: HOOK_ENV.userPrompt,
      };

    case 'PreToolUse':
      return {
        ...basePayload,
        toolName: HOOK_ENV.toolName,
        parameters: parseJsonSafely(HOOK_ENV.toolParameters),
      };

    case 'PostToolUse':
      return {
        ...basePayload,
        toolName: HOOK_ENV.toolName,
        parameters: parseJsonSafely(HOOK_ENV.toolParameters),
        response: parseJsonSafely(HOOK_ENV.toolResult),
        duration: parseInt(HOOK_ENV.toolDuration) || undefined,
        status: HOOK_ENV.toolStatus || 'success',
        error: HOOK_ENV.toolError,
      };

    case 'Stop':
      return {
        ...basePayload,
        reason: 'user_stop',
      };

    case 'SessionEnd':
      return {
        ...basePayload,
        // Could add transcript stats here if needed
      };

    default:
      return basePayload;
  }
}

/**
 * Parse JSON safely
 */
function parseJsonSafely(jsonString) {
  if (!jsonString) return undefined;

  try {
    return JSON.parse(jsonString);
  } catch {
    return jsonString; // Return as string if not valid JSON
  }
}

// Run main function
if (require.main === module) {
  main();
}