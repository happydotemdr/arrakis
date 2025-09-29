#!/usr/bin/env node

/**
 * Claude Code Hook Script - Conversation Capture
 *
 * This script captures Claude Code conversation events and sends them to our API endpoint
 * for storage and analysis. It handles all hook events: SessionStart, UserPromptSubmit,
 * PreToolUse, PostToolUse, Stop, and SessionEnd.
 *
 * Environment Variables:
 * - CLAUDE_HOOK_API_URL: URL of the API endpoint (defaults to localhost:3000)
 * - CLAUDE_HOOK_DEBUG: Enable debug logging (true/false)
 * - CLAUDE_HOOK_ENABLED: Enable/disable hook (true/false, default: true)
 * - CLAUDE_HOOK_TIMEOUT: Request timeout in ms (default: 10000)
 */

const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// Configuration from environment variables
const CONFIG = {
  apiUrl: process.env.CLAUDE_HOOK_API_URL || 'http://localhost:3000/api/claude-hooks',
  apiKey: process.env.CLAUDE_HOOK_API_KEY, // API key for authentication
  debug: process.env.CLAUDE_HOOK_DEBUG === 'true',
  enabled: process.env.CLAUDE_HOOK_ENABLED !== 'false',
  timeout: parseInt(process.env.CLAUDE_HOOK_TIMEOUT || '10000'),
  retryAttempts: parseInt(process.env.CLAUDE_HOOK_RETRY_ATTEMPTS || '2'),
  retryDelay: parseInt(process.env.CLAUDE_HOOK_RETRY_DELAY || '1000'),
};

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
  try {
    // Check if hook is enabled
    if (!CONFIG.enabled) {
      if (CONFIG.debug) {
        console.log('[Claude Hook] Hook disabled via CLAUDE_HOOK_ENABLED');
      }
      return;
    }

    // Validate required environment
    if (!HOOK_ENV.event) {
      console.error('[Claude Hook] CLAUDE_HOOK_EVENT not provided');
      process.exit(1);
    }

    if (CONFIG.debug) {
      console.log(`[Claude Hook] Processing ${HOOK_ENV.event} event`);
      console.log(`[Claude Hook] Session ID: ${HOOK_ENV.sessionId}`);
      console.log(`[Claude Hook] Project Path: ${HOOK_ENV.projectPath}`);
    }

    // Build hook payload based on event type
    const payload = buildHookPayload();

    // Send hook data to API
    const result = await sendHookData(payload);

    if (CONFIG.debug) {
      console.log(`[Claude Hook] Success:`, result);
    }

  } catch (error) {
    console.error(`[Claude Hook] Error:`, error.message);

    // Don't fail the hook - just log the error
    // This ensures Claude Code continues working even if our hook fails
    process.exit(0);
  }
}

/**
 * Build hook payload based on event type and available environment variables
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
        userInfo: getUserInfo(),
      };

    case 'UserPromptSubmit':
      return {
        ...basePayload,
        prompt: HOOK_ENV.userPrompt,
        promptId: generateId(),
      };

    case 'PreToolUse':
      return {
        ...basePayload,
        toolName: HOOK_ENV.toolName,
        parameters: parseJsonSafely(HOOK_ENV.toolParameters),
        toolId: generateId(),
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
        toolId: generateId(),
      };

    case 'Stop':
      return {
        ...basePayload,
        reason: 'user_stop',
      };

    case 'SessionEnd':
      const sessionEndPayload = {
        ...basePayload,
        duration: calculateSessionDuration(),
      };

      // Add transcript parsing if available
      if (HOOK_ENV.transcriptPath) {
        try {
          const transcriptStats = getTranscriptStats(HOOK_ENV.transcriptPath);
          Object.assign(sessionEndPayload, transcriptStats);
        } catch (error) {
          if (CONFIG.debug) {
            console.warn('[Claude Hook] Could not read transcript stats:', error.message);
          }
        }
      }

      return sessionEndPayload;

    default:
      return basePayload;
  }
}

/**
 * Get basic user info (non-sensitive)
 */
function getUserInfo() {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Parse JSON safely, return undefined if invalid
 */
function parseJsonSafely(jsonString) {
  if (!jsonString) return undefined;

  try {
    return JSON.parse(jsonString);
  } catch {
    return jsonString; // Return as string if not valid JSON
  }
}

/**
 * Generate a simple ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Calculate session duration (placeholder - would need session start time)
 */
function calculateSessionDuration() {
  // This is a placeholder - in a real implementation, we'd track session start time
  return undefined;
}

/**
 * Get basic transcript statistics
 */
function getTranscriptStats(transcriptPath) {
  try {
    if (!fs.existsSync(transcriptPath)) {
      return {};
    }

    const content = fs.readFileSync(transcriptPath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());

    let messageCount = 0;
    let toolUseCount = 0;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'message') messageCount++;
        if (entry.type === 'tool_use') toolUseCount++;
      } catch {
        // Ignore invalid JSON lines
      }
    }

    return {
      messageCount,
      toolUseCount,
      transcriptLines: lines.length,
    };
  } catch {
    return {};
  }
}

/**
 * Send hook data to API endpoint with retry logic
 */
async function sendHookData(payload) {
  for (let attempt = 1; attempt <= CONFIG.retryAttempts; attempt++) {
    try {
      if (CONFIG.debug && attempt > 1) {
        console.log(`[Claude Hook] Retry attempt ${attempt}/${CONFIG.retryAttempts}`);
      }

      const result = await makeHttpRequest(payload);
      return result;

    } catch (error) {
      if (attempt === CONFIG.retryAttempts) {
        throw error;
      }

      if (CONFIG.debug) {
        console.log(`[Claude Hook] Attempt ${attempt} failed: ${error.message}`);
      }

      // Wait before retry
      await sleep(CONFIG.retryDelay);
    }
  }
}

/**
 * Make HTTP request to API endpoint
 */
function makeHttpRequest(payload) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(CONFIG.apiUrl);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const postData = JSON.stringify(payload);

      const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Claude-Code-Hook/1.0',
      };

      // Add API key if configured
      if (CONFIG.apiKey) {
        headers['Authorization'] = `Bearer ${CONFIG.apiKey}`;
      }

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers,
        timeout: CONFIG.timeout,
      };

      const req = httpModule.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const response = JSON.parse(data);
              resolve(response);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout (${CONFIG.timeout}ms)`));
      });

      req.write(postData);
      req.end();

    } catch (error) {
      reject(new Error(`Request setup failed: ${error.message}`));
    }
  });
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Handle uncaught exceptions gracefully
process.on('uncaughtException', (error) => {
  console.error('[Claude Hook] Uncaught exception:', error.message);
  process.exit(0); // Don't break Claude Code
});

process.on('unhandledRejection', (error) => {
  console.error('[Claude Hook] Unhandled rejection:', error?.message || error);
  process.exit(0); // Don't break Claude Code
});

// Run the main function
if (require.main === module) {
  main();
}